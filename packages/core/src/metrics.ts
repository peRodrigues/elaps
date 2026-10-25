import { dayKey, hourOfDay, nextDayStartMs, nextHourStartMs, weekdayMondayFirst } from './calendar';
import { activeIntervals, clipInterval, toMs } from './duration';
import { elapsedDays, periodDayKeys, previousPeriod, type Period } from './periods';
import type { Area, DayKey, Group, Instant, Interval, Session, SessionPause } from './types';

// Métricas sobre as sessões de um período, no fuso do período (o do perfil).
// Cada sessão vira trechos ativos (duração menos pausas) e cada trecho é
// recortado nos limites de dia/hora locais: uma sessão que cruza a meia-noite
// conta em cada dia o que rodou nele, e a pausa sai do balde onde ocorreu.
// Passe as sessões que tocam o período (started_at < fim e ended_at nulo ou
// > início) e suas pausas; arquivados continuam contando.

export interface MetricsInput {
  sessions: readonly Session[];
  pauses: readonly SessionPause[];
  areas: readonly Area[];
  groups: readonly Group[];
  /** Fim das sessões e pausas abertas. */
  now: Instant;
  /** Restringe a estes grupos/áreas (ambos opcionais, combinam com E). */
  filter?: { group_ids?: readonly string[]; area_ids?: readonly string[] };
}

export interface AreaTotal {
  area_id: string;
  group_id: string | null;
  ms: number;
}

export interface GroupTotal {
  /** `null` agrupa sessões de área desconhecida (não veio em `areas`). */
  group_id: string | null;
  ms: number;
  /** Áreas do grupo com tempo, maior primeiro. Soma = `ms`. */
  areas: AreaTotal[];
}

export interface Totals {
  total_ms: number;
  /** Maior primeiro. */
  groups: GroupTotal[];
  areas: AreaTotal[];
}

export interface DailyPoint {
  date: DayKey;
  ms: number;
}

export interface Heatmap {
  /** `cells[weekday][hour]` em ms; weekday 0 = segunda … 6 = domingo; hour 0–23 local. */
  cells: number[][];
  max_ms: number;
}

export interface Streaks {
  /** Dias seguidos com tempo terminando hoje (ou ontem, se hoje ainda está em 0). */
  current: number;
  longest: number;
}

export interface Comparison {
  current: Totals;
  previous: Totals;
  previous_period: Period;
  delta_ms: number;
  /** (atual − anterior) / anterior; `null` se o anterior é 0. */
  change_ratio: number | null;
  groups: { group_id: string | null; current_ms: number; previous_ms: number; delta_ms: number }[];
}

/** Trechos ativos de cada sessão, já recortados ao período e filtrados. */
interface Piece extends Interval {
  area_id: string;
}

function pieces(input: MetricsInput, period: Period): Piece[] {
  const bounds = { start: toMs(period.start), end: toMs(period.end) };
  const groupOf = areaGroupLookup(input.areas);
  const { group_ids, area_ids } = input.filter ?? {};
  const out: Piece[] = [];
  for (const session of input.sessions) {
    if (area_ids && !area_ids.includes(session.area_id)) continue;
    if (group_ids) {
      const g = groupOf.get(session.area_id);
      if (g === undefined || !group_ids.includes(g)) continue;
    }
    for (const interval of activeIntervals(session, input.pauses, input.now)) {
      const clipped = clipInterval(interval, bounds);
      if (clipped) out.push({ ...clipped, area_id: session.area_id });
    }
  }
  return out;
}

function areaGroupLookup(areas: readonly Area[]): Map<string, string> {
  return new Map(areas.map((a) => [a.id, a.group_id]));
}

/** Corta [start, end) nos limites dados por `next` e entrega cada fatia a `add`. */
function bucketize(
  interval: Interval,
  next: (ms: number) => number,
  add: (sliceStart: number, ms: number) => void,
): void {
  let t = interval.start;
  while (t < interval.end) {
    const boundary = Math.min(next(t), interval.end);
    if (boundary <= t)
      throw new Error(`Limite de balde não avançou em ${new Date(t).toISOString()}`);
    add(t, boundary - t);
    t = boundary;
  }
}

/** Totais por área e por grupo no período (total do grupo = soma das áreas). */
export function totals(input: MetricsInput, period: Period): Totals {
  const byArea = new Map<string, number>();
  for (const p of pieces(input, period)) {
    byArea.set(p.area_id, (byArea.get(p.area_id) ?? 0) + (p.end - p.start));
  }
  const groupOf = areaGroupLookup(input.areas);
  const areas: AreaTotal[] = [...byArea]
    .map(([area_id, ms]) => ({ area_id, group_id: groupOf.get(area_id) ?? null, ms }))
    .sort(byMsDesc);

  const groupMap = new Map<string | null, GroupTotal>();
  for (const a of areas) {
    const g = groupMap.get(a.group_id) ?? { group_id: a.group_id, ms: 0, areas: [] };
    g.ms += a.ms;
    g.areas.push(a);
    groupMap.set(a.group_id, g);
  }
  const groups = [...groupMap.values()].sort(byMsDesc);
  return { total_ms: areas.reduce((s, a) => s + a.ms, 0), groups, areas };
}

/** Tempo por dia local do período, um ponto por dia, com zeros. */
export function dailySeries(input: MetricsInput, period: Period): DailyPoint[] {
  const tz = period.timezone;
  const byDay = new Map<DayKey, number>(periodDayKeys(period).map((k) => [k, 0]));
  for (const p of pieces(input, period)) {
    bucketize(
      p,
      (t) => nextDayStartMs(t, tz),
      (t, ms) => {
        const k = dayKey(t, tz);
        byDay.set(k, (byDay.get(k) ?? 0) + ms);
      },
    );
  }
  return [...byDay].map(([date, ms]) => ({ date, ms }));
}

/** Heatmap dia da semana × hora local, somando todo o período. */
export function heatmap(input: MetricsInput, period: Period): Heatmap {
  const tz = period.timezone;
  const cells = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const p of pieces(input, period)) {
    bucketize(
      p,
      (t) => nextHourStartMs(t, tz),
      (t, ms) => {
        cells[weekdayMondayFirst(t, tz)]![hourOfDay(t, tz)]! += ms;
      },
    );
  }
  return { cells, max_ms: Math.max(0, ...cells.flat()) };
}

/**
 * Média diária: total ÷ dias do período que já começaram em `now`
 * (a semana atual na quarta divide por 3, não por 7).
 */
export function dailyAverageMs(totalMs: number, period: Period, now: Instant): number {
  return totalMs / elapsedDays(period, now);
}

/**
 * Streaks de dias com tempo > 0 numa série diária contínua e ordenada.
 * `today` define o fim do streak atual; dia de hoje ainda em 0 não o quebra.
 * Para o streak atual, a série precisa cobrir dias suficientes para trás.
 */
export function streaks(series: readonly DailyPoint[], today: DayKey): Streaks {
  let longest = 0;
  let run = 0;
  for (const point of series) {
    if (point.date > today) break;
    run = point.ms > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const upToToday = series.filter((p) => p.date <= today);
  let i = upToToday.length - 1;
  if (i >= 0 && upToToday[i]!.date === today && upToToday[i]!.ms === 0) i--;
  let current = 0;
  for (; i >= 0 && upToToday[i]!.ms > 0; i--) current++;
  return { current, longest };
}

/** Totais do período contra o período anterior de mesmo número de dias. */
export function compareWithPrevious(input: MetricsInput, period: Period): Comparison {
  const prevPeriod = previousPeriod(period);
  const current = totals(input, period);
  const previous = totals(input, prevPeriod);
  const ids = new Set([...current.groups, ...previous.groups].map((g) => g.group_id));
  const msOf = (t: Totals, id: string | null) => t.groups.find((g) => g.group_id === id)?.ms ?? 0;
  return {
    current,
    previous,
    previous_period: prevPeriod,
    delta_ms: current.total_ms - previous.total_ms,
    change_ratio:
      previous.total_ms === 0 ? null : (current.total_ms - previous.total_ms) / previous.total_ms,
    groups: [...ids].map((group_id) => {
      const current_ms = msOf(current, group_id);
      const previous_ms = msOf(previous, group_id);
      return { group_id, current_ms, previous_ms, delta_ms: current_ms - previous_ms };
    }),
  };
}

/**
 * Resumo completo do período, serializável: base do dashboard e do
 * compartilhamento futuro (imagem/página pública). Para o streak atual cobrir
 * mais que o período, passe `streakSeries` com o histórico.
 */
export interface PeriodSummary {
  period: Period;
  totals: Totals;
  daily: DailyPoint[];
  heatmap: Heatmap;
  daily_average_ms: number;
  streaks: Streaks;
  comparison: Comparison;
}

export function summarizePeriod(
  input: MetricsInput,
  period: Period,
  options: { streakSeries?: readonly DailyPoint[] } = {},
): PeriodSummary {
  const t = totals(input, period);
  const daily = dailySeries(input, period);
  return {
    period,
    totals: t,
    daily,
    heatmap: heatmap(input, period),
    daily_average_ms: dailyAverageMs(t.total_ms, period, input.now),
    streaks: streaks(options.streakSeries ?? daily, dayKey(toMs(input.now), period.timezone)),
    comparison: compareWithPrevious(input, period),
  };
}

function byMsDesc(a: { ms: number }, b: { ms: number }): number {
  return b.ms - a.ms;
}
