import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyTimerCommand,
  deriveTimerState,
  toIso,
  toMs,
  todayPeriod,
  type PomodoroPlan,
  type PomodoroSettings,
  type Session,
  type SessionPause,
  type SessionTag,
  type TimerCommand,
  type TimerEffect,
  type TimerState,
} from '@elaps/core';
import { fetchSessionTags, writeSessionTags } from '@/data/tags';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Cronômetro: o estado vive no banco (sessão com ended_at nulo + pausas).
// As regras são do @elaps/core; aqui só se traduz o efeito em escrita.

const SESSION_COLUMNS =
  'id, user_id, area_id, started_at, ended_at, source, note, mode, pomodoro_config';
const PAUSE_COLUMNS = 'id, session_id, paused_at, resumed_at, kind';

type SessionRow = Omit<Session, 'source' | 'mode' | 'pomodoro_config'> & {
  source: string;
  mode: string;
  pomodoro_config: unknown;
};

/** O tipo gerado diz string/Json; o banco garante os valores por CHECK. */
function toSession(row: SessionRow): Session {
  const pomodoro = row.mode === 'pomodoro';
  return {
    ...row,
    source: row.source === 'manual' ? 'manual' : 'timer',
    mode: pomodoro ? 'pomodoro' : 'free',
    pomodoro_config: pomodoro ? (row.pomodoro_config as PomodoroSettings) : null,
  };
}

/** Outro aparelho mudou o cronômetro antes desta escrita. */
export class TimerConflictError extends Error {
  override name = 'TimerConflictError';
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  // 23505: segunda sessão ativa ou segunda pausa aberta (índices únicos).
  // 23514: a sessão já mudou e a escrita deixaria uma pausa fora dela.
  // P0002: a sessão sumiu (excluída em outro aparelho).
  // 40001: apply_pomodoro viu outra contagem de pausas (outro aparelho gravou antes).
  if (['23505', '23514', 'P0002', '40001'].includes(error.code ?? '')) {
    throw new TimerConflictError(error.message);
  }
  throw new Error(error.message);
}

async function fetchPauses(sessionIds: string[]): Promise<SessionPause[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabase
    .from('session_pauses')
    .select(PAUSE_COLUMNS)
    .in('session_id', sessionIds);
  check(error);
  return (data ?? []).map((p) => ({ ...p, kind: p.kind === 'break' ? 'break' : 'manual' }));
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Cronômetro ativo do usuário. Recarrega ao focar a janela (sem Realtime). */
export function useTimer() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['timer'],
    enabled: !!user,
    refetchOnWindowFocus: 'always',
    queryFn: async (): Promise<TimerState> => {
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_COLUMNS)
        .is('ended_at', null);
      check(error);
      const sessions = (data ?? []).map(toSession);
      return deriveTimerState(sessions, await fetchPauses(sessions.map((s) => s.id)));
    },
  });
}

export interface SessionsWithPauses {
  sessions: Session[];
  pauses: SessionPause[];
  tags: SessionTag[];
}

/** Sessões que tocam o dia de `now` no fuso do perfil (inclui a ativa). */
export function useTodaySessions(timezone: string | undefined, now: number) {
  const { user } = useAuth();
  const period = timezone ? todayPeriod(now, timezone) : null;
  return useQuery({
    queryKey: ['sessions', 'day', period?.first_day, timezone],
    enabled: !!user && !!period,
    refetchOnWindowFocus: 'always',
    queryFn: async (): Promise<SessionsWithPauses> => {
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_COLUMNS)
        .lt('started_at', period!.end)
        .or(`ended_at.is.null,ended_at.gt.${period!.start}`)
        .order('started_at', { ascending: false });
      check(error);
      const sessions = (data ?? []).map(toSession);
      const ids = sessions.map((s) => s.id);
      return { sessions, pauses: await fetchPauses(ids), tags: await fetchSessionTags(ids) };
    },
  });
}

/** Áreas na ordem do uso mais recente (para o seletor). */
export function useRecentAreaIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sessions', 'recent-areas'],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('sessions')
        .select('area_id')
        .order('started_at', { ascending: false })
        .limit(200);
      check(error);
      return [...new Set((data ?? []).map((r) => r.area_id))];
    },
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

async function persist(
  effect: TimerEffect,
  note: string | null,
  tagIds: readonly string[],
  pomodoro: PomodoroSettings | null,
) {
  switch (effect.type) {
    case 'create_session': {
      // Pomodoro: a sessão guarda o retrato da config; as fases saem dele.
      const { error } = await supabase.from('sessions').insert({
        ...effect.session,
        mode: pomodoro ? 'pomodoro' : 'free',
        pomodoro_config: pomodoro ? { ...pomodoro } : null,
      });
      return check(error);
    }
    case 'create_pause': {
      const { error } = await supabase.from('session_pauses').insert(effect.pause);
      return check(error);
    }
    case 'close_pause': {
      const { data, error } = await supabase
        .from('session_pauses')
        .update({ resumed_at: effect.resumed_at })
        .eq('id', effect.pause_id)
        .is('resumed_at', null)
        .select('id');
      check(error);
      if (!data?.length) throw new TimerConflictError('pausa já fechada');
      return;
    }
    case 'end_session': {
      // O trigger sessions_close_open_pause fecha a pausa aberta no mesmo instante.
      const { data, error } = await supabase
        .from('sessions')
        .update({ ended_at: effect.ended_at, note })
        .eq('id', effect.session_id)
        .is('ended_at', null)
        .select('id');
      check(error);
      if (!data?.length) throw new TimerConflictError('sessão já encerrada');
      if (tagIds.length > 0) await writeSessionTags(effect.session_id, tagIds);
    }
  }
}

function useInvalidateTimer() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['timer'] }),
      queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    ]);
}

export interface TimerCommandInput {
  state: TimerState;
  command: TimerCommand;
  /** Instante da ação (ao parar: o clique em Parar, não o Salvar do diálogo). */
  at: number;
  note?: string | null;
  /** Tags da sessão ao parar. */
  tagIds?: string[];
  /** Ao iniciar: config do pomodoro (do perfil) ou null para o modo livre. */
  pomodoro?: PomodoroSettings | null;
}

/** Aplica iniciar/pausar/retomar/parar. Transição inválida = conflito. */
export function useTimerCommand() {
  const invalidate = useInvalidateTimer();
  return useMutation({
    mutationFn: async ({
      state,
      command,
      at,
      note = null,
      tagIds = [],
      pomodoro = null,
    }: TimerCommandInput) => {
      const result = applyTimerCommand(state, command, at);
      if (!result.ok) throw new TimerConflictError(result.error.code);
      await persist(result.effect, note, tagIds, pomodoro);
    },
    onSettled: invalidate,
  });
}

/**
 * Grava viradas de fase do pomodoro (reconciliação, limite do relógio ou
 * Pular fase) pela RPC apply_pomodoro, numa transação. Se outro aparelho
 * gravou antes, a contagem de pausas não bate: TimerConflictError, e o
 * recarregamento recalcula o plano.
 */
export function useApplyPomodoro() {
  const invalidate = useInvalidateTimer();
  return useMutation({
    mutationFn: async ({ sessionId, plan }: { sessionId: string; plan: PomodoroPlan }) => {
      const { error } = await supabase.rpc('apply_pomodoro', {
        p_session_id: sessionId,
        p_expected_pauses: plan.expected_pauses,
        // O tipo gerado não marca como nulável; a função aceita null.
        p_close_open_at: plan.close_open_at as string,
        p_new_pauses: plan.new_pauses.map((b) => ({ ...b })),
      });
      check(error);
    },
    onSettled: invalidate,
  });
}

/** Descarta (apaga) a sessão ativa; as pausas vão em cascata. */
export function useDiscardSession() {
  const invalidate = useInvalidateTimer();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .is('ended_at', null)
        .select('id');
      check(error);
      if (!data?.length) throw new TimerConflictError('sessão já encerrada');
    },
    onSettled: invalidate,
  });
}

/**
 * Encerra a sessão esquecida num horário anterior a agora, pela RPC
 * edit_session: numa transação só, apaga as pausas que começam no novo fim ou
 * depois, corta no novo fim as que o atravessam (inclusive a aberta) e grava.
 */
export function useAdjustEnd() {
  const invalidate = useInvalidateTimer();
  return useMutation({
    mutationFn: async ({ session, endedAt }: { session: Session; endedAt: number }) => {
      if (endedAt <= toMs(session.started_at) || endedAt > Date.now()) {
        throw new RangeError('término fora do intervalo');
      }
      const { error } = await supabase.rpc('edit_session', {
        p_session_id: session.id,
        p_area_id: session.area_id,
        p_started_at: session.started_at,
        p_ended_at: toIso(endedAt),
        p_note: session.note ?? '',
      });
      check(error);
    },
    onSettled: invalidate,
  });
}
