import type { Instant, Interval, Session, SessionPause } from './types';

export function toMs(instant: Instant): number {
  if (typeof instant === 'number') return instant;
  if (instant instanceof Date) return instant.getTime();
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new RangeError(`Data inválida: ${instant}`);
  return ms;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Fim efetivo da sessão: `ended_at`, ou `now` se ainda está rodando. */
export function sessionEndMs(session: Session, now: Instant): number {
  return session.ended_at === null ? toMs(now) : toMs(session.ended_at);
}

/**
 * Trechos em que a sessão de fato contou tempo: [início, fim) menos as pausas.
 * Pausa aberta vai até o fim efetivo (que é `now` numa sessão ativa).
 * Pausas fora da sessão são recortadas; pausas sobrepostas são unidas.
 * Só as pausas desta sessão são consideradas, então pode passar a lista toda.
 */
export function activeIntervals(
  session: Session,
  pauses: readonly SessionPause[],
  now: Instant,
): Interval[] {
  const start = toMs(session.started_at);
  const end = sessionEndMs(session, now);
  if (end <= start) return [];

  const cuts = pauses
    .filter((p) => p.session_id === session.id)
    .map((p) => ({
      start: Math.max(start, toMs(p.paused_at)),
      end: Math.min(end, p.resumed_at === null ? end : toMs(p.resumed_at)),
    }))
    .filter((p) => p.end > p.start)
    .sort((a, b) => a.start - b.start);

  const result: Interval[] = [];
  let cursor = start;
  for (const cut of cuts) {
    if (cut.start > cursor) result.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  }
  if (end > cursor) result.push({ start: cursor, end });
  return result;
}

/** Tempo líquido da sessão em ms (duração menos pausas). */
export function netDurationMs(
  session: Session,
  pauses: readonly SessionPause[],
  now: Instant,
): number {
  return sumIntervals(activeIntervals(session, pauses, now));
}

export function sumIntervals(intervals: readonly Interval[]): number {
  let total = 0;
  for (const i of intervals) total += i.end - i.start;
  return total;
}

export function clipInterval(interval: Interval, bounds: Interval): Interval | null {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return end > start ? { start, end } : null;
}
