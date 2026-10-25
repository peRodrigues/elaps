import {
  addDaysMs,
  dayKey,
  dayKeysBetween,
  dayStartMs,
  nextDayStartMs,
  startOfDayMs,
  startOfMonthMs,
  startOfWeekMs,
} from './calendar';
import { toIso, toMs } from './duration';
import type { DayKey, Instant } from './types';

export type PeriodKind = 'day' | 'week' | 'month' | 'custom' | 'previous';

/**
 * Período semiaberto [start, end) em dias inteiros do fuso do perfil.
 * Serializável (strings ISO) para ir a um resumo compartilhado.
 */
export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
  timezone: string;
  /** Primeiro e último dia local (inclusivo). */
  first_day: DayKey;
  last_day: DayKey;
  /** Quantidade de dias de calendário (não de 24 h). */
  days: number;
}

function makePeriod(kind: PeriodKind, start: number, end: number, timezone: string): Period {
  const keys = dayKeysBetween(start, end, timezone);
  return {
    kind,
    start: toIso(start),
    end: toIso(end),
    timezone,
    first_day: keys[0] ?? dayKey(start, timezone),
    last_day: keys[keys.length - 1] ?? dayKey(start, timezone),
    days: keys.length,
  };
}

export function todayPeriod(now: Instant, timezone: string): Period {
  const start = startOfDayMs(toMs(now), timezone);
  return makePeriod('day', start, nextDayStartMs(start, timezone), timezone);
}

/** Semana de segunda a domingo que contém `now`. */
export function weekPeriod(now: Instant, timezone: string): Period {
  const start = startOfWeekMs(toMs(now), timezone);
  return makePeriod('week', start, addDaysMs(start, 7, timezone), timezone);
}

/** Mês de calendário que contém `now`. */
export function monthPeriod(now: Instant, timezone: string): Period {
  const start = startOfMonthMs(toMs(now), timezone);
  const nextMonth = startOfMonthMs(addDaysMs(start, 32, timezone), timezone);
  return makePeriod('month', start, nextMonth, timezone);
}

/** Do dia `firstDay` ao dia `lastDay`, ambos inclusivos (`yyyy-MM-dd`). */
export function customPeriod(firstDay: DayKey, lastDay: DayKey, timezone: string): Period {
  const start = dayStartMs(firstDay, timezone);
  const end = nextDayStartMs(dayStartMs(lastDay, timezone), timezone);
  if (end <= start) throw new RangeError(`Período invertido: ${firstDay} > ${lastDay}`);
  return makePeriod('custom', start, end, timezone);
}

/**
 * Período imediatamente anterior com o mesmo número de dias de calendário.
 * Semana → semana anterior; mês de 31 dias → os 31 dias antes dele.
 */
export function previousPeriod(period: Period): Period {
  const start = toMs(period.start);
  return makePeriod(
    'previous',
    addDaysMs(start, -period.days, period.timezone),
    start,
    period.timezone,
  );
}

/** Dias do período que já começaram em `now` (mínimo 1; todos se o período passou). */
export function elapsedDays(period: Period, now: Instant): number {
  const end = Math.min(toMs(period.end), toMs(now) + 1);
  const started = dayKeysBetween(toMs(period.start), end, period.timezone).length;
  return Math.max(1, Math.min(period.days, started));
}

export function periodDayKeys(period: Period): DayKey[] {
  return dayKeysBetween(toMs(period.start), toMs(period.end), period.timezone);
}
