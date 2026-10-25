const pad = (n: number) => String(n).padStart(2, '0');

/** Duração legível em pt-BR: 45 s, 25 min, 2 h, 1 h 05 min. */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  const totalMin = Math.floor(safe / 60_000);
  if (totalMin === 0) return `${Math.floor(safe / 1000)} s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${pad(m)} min`;
}

export const days = (count: number) => `${count} ${count === 1 ? 'dia' : 'dias'}`;

export const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

/** Dia da semana (0 = segunda) de uma data yyyy-MM-dd. */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
}

/** dd/mm de uma data yyyy-MM-dd. */
export const shortDate = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
