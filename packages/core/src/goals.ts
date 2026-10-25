import { toMs } from './duration';
import { totals, type MetricsInput } from './metrics';
import { monthPeriod, todayPeriod, weekPeriod, type Period } from './periods';
import type { DayKey, Goal, GoalPeriod, GoalVersion, Instant } from './types';

// Progresso de metas "no mínimo X min por período". Cada período usa a versão
// vigente no dia em que ele começa (a de maior effective_from <= esse dia);
// um período que começa antes da primeira versão usa a primeira, desde que
// termine depois dela: a meta vale desde o período em que entrou em vigor e
// não tem histórico antes disso. Arquivados (meta, grupo, área) continuam
// contando: o tempo vem de `totals`, filtrado pelo alvo.

/** Períodos anteriores ao atual no histórico padrão. */
export const GOAL_HISTORY_PERIODS = 8;

export interface GoalPeriodProgress {
  period: Period;
  /** Versão aplicada a este período. */
  version: GoalVersion;
  target_ms: number;
  done_ms: number;
  /** feito / alvo, sem teto (1 = 100 %). */
  ratio: number;
  /** feito >= alvo. */
  met: boolean;
  /** Quanto falta para bater (0 se já bateu). */
  remaining_ms: number;
}

export interface GoalProgress {
  goal: Goal;
  current: GoalPeriodProgress;
  /** Períodos anteriores ao atual, do mais antigo ao mais recente. */
  history: GoalPeriodProgress[];
  /** Quantos do `history` foram batidos. */
  met_count: number;
}

const periodOf: Record<GoalPeriod, (now: Instant, timezone: string) => Period> = {
  day: todayPeriod,
  week: weekPeriod,
  month: monthPeriod,
};

/** Período da meta (dia, semana de segunda ou mês, no fuso) que contém `now`. */
export function goalPeriodAt(period: GoalPeriod, now: Instant, timezone: string): Period {
  return periodOf[period](now, timezone);
}

/** O período atual e os `count` anteriores, do mais antigo ao atual. */
export function goalPeriods(
  period: GoalPeriod,
  now: Instant,
  timezone: string,
  count: number,
): Period[] {
  let oldest = goalPeriodAt(period, now, timezone);
  const out = [oldest];
  for (let i = 0; i < count; i++) {
    oldest = goalPeriodAt(period, toMs(oldest.start) - 1, timezone);
    out.unshift(oldest);
  }
  return out;
}

/** Versões da meta em ordem de vigência. */
function sortedVersions(goal: Goal, versions: readonly GoalVersion[]): GoalVersion[] {
  return versions
    .filter((v) => v.goal_id === goal.id)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}

/**
 * Versão vigente num período que começa em `firstDay`: a de maior
 * `effective_from` <= `firstDay`; antes da primeira, a primeira. `undefined`
 * só se não houver versão.
 */
export function goalVersionFor(
  versions: readonly GoalVersion[],
  firstDay: DayKey,
): GoalVersion | undefined {
  const sorted = [...versions].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  let chosen = sorted[0];
  for (const v of sorted) if (v.effective_from <= firstDay) chosen = v;
  return chosen;
}

function filterFor(goal: Goal): NonNullable<MetricsInput['filter']> {
  if (goal.target_kind === 'group' && goal.group_id) return { group_ids: [goal.group_id] };
  if (goal.target_kind === 'area' && goal.area_id) return { area_ids: [goal.area_id] };
  return {};
}

function progressIn(
  goal: Goal,
  version: GoalVersion,
  input: MetricsInput,
  period: Period,
): GoalPeriodProgress {
  const target_ms = version.target_minutes * 60_000;
  // O alvo substitui qualquer filtro do input (`{}` = sem restrição).
  const done_ms = totals({ ...input, filter: filterFor(goal) }, period).total_ms;
  return {
    period,
    version,
    target_ms,
    done_ms,
    ratio: target_ms > 0 ? done_ms / target_ms : 0,
    met: done_ms >= target_ms,
    remaining_ms: Math.max(0, target_ms - done_ms),
  };
}

/**
 * Progresso da meta no período atual (o que contém `input.now`) e nos
 * `history` anteriores em que ela já valia. `null` se a meta não tem versão.
 * `input` precisa trazer as sessões que tocam todo o intervalo (ver
 * `goalsWindow`) e as áreas, inclusive as arquivadas, para o filtro de grupo.
 */
export function goalProgress(
  goal: Goal,
  versions: readonly GoalVersion[],
  input: MetricsInput,
  timezone: string,
  history = GOAL_HISTORY_PERIODS,
): GoalProgress | null {
  const own = sortedVersions(goal, versions);
  const firstEffective = own[0]?.effective_from;
  if (firstEffective === undefined) return null;
  const periods = goalPeriods(goal.period, input.now, timezone, history);
  const current = periods.pop()!;
  const past = periods
    .filter((p) => p.last_day >= firstEffective)
    .map((p) => progressIn(goal, goalVersionFor(own, p.first_day)!, input, p));
  return {
    goal,
    current: progressIn(goal, goalVersionFor(own, current.first_day)!, input, current),
    history: past,
    met_count: past.filter((p) => p.met).length,
  };
}

/** Intervalo [start, end) que cobre o atual e os `history` anteriores de todas as metas. */
export function goalsWindow(
  goals: readonly Pick<Goal, 'period'>[],
  now: Instant,
  timezone: string,
  history = GOAL_HISTORY_PERIODS,
): { start: number; end: number } | null {
  if (goals.length === 0) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const kind of new Set(goals.map((g) => g.period))) {
    start = Math.min(start, toMs(goalPeriods(kind, now, timezone, history)[0]!.start));
    end = Math.max(end, toMs(goalPeriodAt(kind, now, timezone).end));
  }
  return { start, end };
}

/** Novo alvo começa no período atual: os anteriores continuam com o antigo. */
export function newVersionEffectiveFrom(
  goal: Pick<Goal, 'period'>,
  now: Instant,
  timezone: string,
): DayKey {
  return goalPeriodAt(goal.period, now, timezone).first_day;
}
