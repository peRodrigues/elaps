import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyTimerCommand,
  deriveTimerState,
  toIso,
  toMs,
  todayPeriod,
  type Session,
  type SessionPause,
  type TimerCommand,
  type TimerEffect,
  type TimerState,
} from '@elaps/core';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Cronômetro: o estado vive no banco (sessão com ended_at nulo + pausas).
// As regras são do @elaps/core; aqui só se traduz o efeito em escrita.

const SESSION_COLUMNS = 'id, user_id, area_id, started_at, ended_at, source, note';
const PAUSE_COLUMNS = 'id, session_id, paused_at, resumed_at';

type SessionRow = Omit<Session, 'source'> & { source: string };

/** O tipo gerado diz string; o banco garante 'timer' | 'manual' por CHECK. */
function toSession(row: SessionRow): Session {
  return { ...row, source: row.source === 'manual' ? 'manual' : 'timer' };
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
  if (['23505', '23514', 'P0002'].includes(error.code ?? '')) {
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
  return data ?? [];
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
      return { sessions, pauses: await fetchPauses(sessions.map((s) => s.id)) };
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

async function persist(effect: TimerEffect, note: string | null) {
  switch (effect.type) {
    case 'create_session': {
      const { error } = await supabase.from('sessions').insert(effect.session);
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
}

/** Aplica iniciar/pausar/retomar/parar. Transição inválida = conflito. */
export function useTimerCommand() {
  const invalidate = useInvalidateTimer();
  return useMutation({
    mutationFn: async ({ state, command, at, note = null }: TimerCommandInput) => {
      const result = applyTimerCommand(state, command, at);
      if (!result.ok) throw new TimerConflictError(result.error.code);
      await persist(result.effect, note);
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
