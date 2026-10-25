import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GOAL_HISTORY_PERIODS,
  goalProgress,
  goalsWindow,
  newVersionEffectiveFrom,
  toIso,
  type Goal,
  type GoalPeriod,
  type GoalProgress,
  type GoalTargetKind,
  type GoalVersion,
  type Session,
  type SessionPause,
} from '@elaps/core';
import { useCatalog } from '@/data/catalog';
import { useNow } from '@/features/timer/time';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

// Metas: a lista fica em ['goals']; as sessões do progresso em
// ['sessions', 'goals', ...], para que cronômetro, sessões e troca de fuso
// (que invalidam ['sessions']) atualizem o progresso. A conta é do @elaps/core.

export const GOALS_KEY = ['goals'] as const;

const SESSION_COLUMNS = 'id, user_id, area_id, started_at, ended_at, source, note';
const PAGE = 1000;
const PAUSE_CHUNK = 100;

export interface GoalsData {
  /** Ativas e arquivadas. */
  goals: Goal[];
  versions: GoalVersion[];
}

const TARGET_KINDS: readonly GoalTargetKind[] = ['total', 'group', 'area'];
const PERIODS: readonly GoalPeriod[] = ['day', 'week', 'month'];

/** Metas e versões do usuário (arquivadas incluídas). */
export function useGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: GOALS_KEY,
    enabled: !!user,
    queryFn: async (): Promise<GoalsData> => {
      const [goals, versions] = await Promise.all([
        supabase
          .from('goals')
          .select('id, user_id, target_kind, group_id, area_id, period, archived_at, created_at')
          .order('created_at', { ascending: true }),
        supabase.from('goal_versions').select('id, goal_id, target_minutes, effective_from'),
      ]);
      if (goals.error) throw goals.error;
      if (versions.error) throw versions.error;
      // O banco garante os valores por CHECK; o tipo gerado diz só string.
      return {
        goals: goals.data.map((g) => ({
          ...g,
          target_kind: TARGET_KINDS.find((k) => k === g.target_kind) ?? 'total',
          period: PERIODS.find((p) => p === g.period) ?? 'day',
        })),
        versions: versions.data,
      };
    },
  });
}

/** Sessões que tocam [start, end) e suas pausas. */
async function fetchTouching(start: string, end: string) {
  const sessions: Session[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('sessions')
      .select(SESSION_COLUMNS)
      .lt('started_at', end)
      .or(`ended_at.is.null,ended_at.gt.${start}`)
      .order('started_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    sessions.push(
      ...data.map((r): Session => ({ ...r, source: r.source === 'manual' ? 'manual' : 'timer' })),
    );
    if (data.length < PAGE) break;
  }
  const pauses: SessionPause[] = [];
  for (let i = 0; i < sessions.length; i += PAUSE_CHUNK) {
    const ids = sessions.slice(i, i + PAUSE_CHUNK).map((s) => s.id);
    const { data, error } = await supabase
      .from('session_pauses')
      .select('id, session_id, paused_at, resumed_at')
      .in('session_id', ids);
    if (error) throw error;
    pauses.push(...data);
  }
  return { sessions, pauses };
}

export interface GoalsProgressOptions {
  /** Só metas destes períodos (ex.: ['day', 'week'] no Cronômetro). Padrão: todos. */
  periods?: readonly GoalPeriod[];
  /** Períodos anteriores no histórico. Padrão: 8. */
  history?: number;
}

/**
 * Progresso das metas ativas no período atual e nos anteriores, no fuso do
 * perfil, com o relógio andando a cada minuto. `data` vem na ordem de criação.
 */
export function useGoalsProgress({
  periods,
  history = GOAL_HISTORY_PERIODS,
}: GoalsProgressOptions = {}) {
  const { user } = useAuth();
  const profile = useProfile();
  const catalog = useCatalog();
  const goals = useGoals();
  const now = useNow(60_000);
  const timezone = profile.data?.timezone;

  // Chave em texto: um array literal novo a cada render não refaz a conta.
  const wanted = periods?.join(',');
  const active = useMemo(
    () =>
      (goals.data?.goals ?? []).filter(
        (g) => !g.archived_at && (!wanted || wanted.split(',').includes(g.period)),
      ),
    [goals.data, wanted],
  );
  const window = timezone ? goalsWindow(active, now, timezone, history) : null;
  const start = window ? toIso(window.start) : undefined;
  const end = window ? toIso(window.end) : undefined;

  const sessions = useQuery({
    queryKey: ['sessions', 'goals', 'progress', start, end, timezone],
    enabled: !!user && !!start && !!end,
    refetchOnWindowFocus: 'always',
    queryFn: () => fetchTouching(start!, end!),
  });

  const data = useMemo((): GoalProgress[] | undefined => {
    if (!timezone || !goals.data || !catalog.data) return undefined;
    if (active.length === 0) return [];
    if (!sessions.data) return undefined;
    const input = { ...sessions.data, ...catalog.data, now };
    return active
      .map((g) => goalProgress(g, goals.data.versions, input, timezone, history))
      .filter((p): p is GoalProgress => p !== null);
  }, [timezone, goals.data, catalog.data, sessions.data, active, now, history]);

  const queries = [profile, catalog, goals, sessions];
  return {
    data,
    isPending: data === undefined && !queries.some((q) => q.isError),
    isError: queries.some((q) => q.isError),
    refetch: () => queries.forEach((q) => void q.refetch()),
  };
}

/** Já existe meta ativa com o mesmo alvo e período (índice único, 23505). */
export function isDuplicateGoalError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}

function useGoalMutation<TVars>(fn: (vars: TVars) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

const check = (error: { code?: string; message: string } | null) => {
  if (error) throw error;
};

export interface NewGoal {
  target_kind: GoalTargetKind;
  group_id: string | null;
  area_id: string | null;
  period: GoalPeriod;
  target_minutes: number;
}

/** Cria a meta já com a primeira versão, vigente desde o início do período atual. */
export function useCreateGoal() {
  const profile = useProfile();
  return useGoalMutation(async (goal: NewGoal) => {
    const timezone = profile.data?.timezone ?? 'America/Sao_Paulo';
    const { error } = await supabase.rpc('create_goal', {
      p_target_kind: goal.target_kind,
      // O tipo gerado não marca os uuids como nuláveis, mas a função aceita
      // null (meta total ou de grupo); omitir o parâmetro não acharia a função.
      p_group_id: goal.group_id as string,
      p_area_id: goal.area_id as string,
      p_period: goal.period,
      p_target_minutes: goal.target_minutes,
      p_effective_from: newVersionEffectiveFrom(goal, Date.now(), timezone),
    });
    check(error);
  });
}

/**
 * Novo alvo vale desde o início do período atual; os anteriores mantêm o
 * antigo. Editar de novo no mesmo período só troca o valor dessa versão.
 */
export function useUpdateGoalTarget() {
  const profile = useProfile();
  return useGoalMutation(
    async ({ goal, target_minutes }: { goal: Goal; target_minutes: number }) => {
      const timezone = profile.data?.timezone ?? 'America/Sao_Paulo';
      const { error } = await supabase.from('goal_versions').upsert(
        {
          goal_id: goal.id,
          target_minutes,
          effective_from: newVersionEffectiveFrom(goal, Date.now(), timezone),
        },
        { onConflict: 'goal_id,effective_from' },
      );
      check(error);
    },
  );
}

export const useSetGoalArchived = () =>
  useGoalMutation(async ({ id, archived }: { id: string; archived: boolean }) => {
    const archived_at = archived ? new Date().toISOString() : null;
    const { error } = await supabase.from('goals').update({ archived_at }).eq('id', id);
    check(error);
  });

/** Exclui a meta e as versões dela (cascata); as sessões não mudam. */
export const useDeleteGoal = () =>
  useGoalMutation(async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    check(error);
  });
