import { TZDate } from '@date-fns/tz';
import { addDays, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { DayKey } from './types';

// Contas de calendário no fuso do perfil. Os limites (meia-noite, hora cheia)
// são de relógio local, então um dia pode ter 23 h ou 25 h no horário de verão.

const HOUR_MS = 3_600_000;

export function zoned(ms: number, timezone: string): TZDate {
  return new TZDate(ms, timezone);
}

export function dayKey(ms: number, timezone: string): DayKey {
  const d = zoned(ms, timezone);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Meia-noite local do dia `yyyy-MM-dd`, em ms epoch. */
export function dayStartMs(key: DayKey, timezone: string): number {
  const [y, m, d] = parseDayKey(key);
  return startOfDay(new TZDate(y, m - 1, d, timezone)).getTime();
}

export function startOfDayMs(ms: number, timezone: string): number {
  return startOfDay(zoned(ms, timezone)).getTime();
}

export function nextDayStartMs(ms: number, timezone: string): number {
  return startOfDay(addDays(startOfDay(zoned(ms, timezone)), 1)).getTime();
}

export function addDaysMs(dayStart: number, days: number, timezone: string): number {
  return startOfDay(addDays(zoned(dayStart, timezone), days)).getTime();
}

/** Segunda-feira 00:00 local da semana que contém `ms`. */
export function startOfWeekMs(ms: number, timezone: string): number {
  return startOfWeek(zoned(ms, timezone), { weekStartsOn: 1 }).getTime();
}

export function startOfMonthMs(ms: number, timezone: string): number {
  return startOfMonth(zoned(ms, timezone)).getTime();
}

/**
 * Próxima hora cheia local depois de `ms`. Conta só os minutos locais, sem
 * reconstruir a data: no fim do DST a 01:00 é ambígua e `startOfHour` pode
 * escolher a primeira, voltando no tempo.
 */
export function nextHourStartMs(ms: number, timezone: string): number {
  const d = zoned(ms, timezone);
  const intoHour = d.getMinutes() * 60_000 + d.getSeconds() * 1000 + d.getMilliseconds();
  return ms - intoHour + HOUR_MS;
}

/** Dia da semana com segunda = 0 … domingo = 6. */
export function weekdayMondayFirst(ms: number, timezone: string): number {
  return (zoned(ms, timezone).getDay() + 6) % 7;
}

export function hourOfDay(ms: number, timezone: string): number {
  return zoned(ms, timezone).getHours();
}

/** Dias locais de [start, end), em ordem. */
export function dayKeysBetween(start: number, end: number, timezone: string): DayKey[] {
  const keys: DayKey[] = [];
  for (let t = startOfDayMs(start, timezone); t < end; t = nextDayStartMs(t, timezone)) {
    keys.push(dayKey(t, timezone));
  }
  return keys;
}

export function parseDayKey(key: DayKey): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new RangeError(`Dia inválido (esperado yyyy-MM-dd): ${key}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
