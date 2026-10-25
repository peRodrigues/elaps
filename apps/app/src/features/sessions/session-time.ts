import { dayKey, toMs, todayPeriod, type DayKey } from '@elaps/core';
import { formatTime, fromWallTime } from '@/features/timer/time';

/** `yyyy-MM-dd` do dia seguinte (aritmética de calendário, sem fuso). */
export function nextDayKey(key: DayKey): DayKey {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Título do grupo de um dia: Hoje, Ontem ou "sábado, 24 de outubro". */
export function dayTitle(
  key: DayKey,
  now: number,
  timezone: string,
  labels: { today: string; yesterday: string },
): string {
  const todayStart = toMs(todayPeriod(now, timezone).start);
  if (key === dayKey(todayStart, timezone)) return labels.today;
  if (key === dayKey(todayStart - 1, timezone)) return labels.yesterday;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromWallTime(`${key}T12:00`, timezone));
}

/** "14:00 – 14:30", com "(+1 dia)" quando termina no dia seguinte. */
export function timeRange(
  startMs: number,
  endMs: number | null,
  timezone: string,
  labels: { inProgress: string; nextDay: string },
): string {
  const start = formatTime(startMs, timezone);
  if (endMs === null) return `${start} – ${labels.inProgress}`;
  const crosses = dayKey(endMs, timezone) !== dayKey(startMs, timezone);
  return `${start} – ${formatTime(endMs, timezone)}${crosses ? ` (${labels.nextDay})` : ''}`;
}
