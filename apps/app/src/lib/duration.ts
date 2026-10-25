import type { TFunction } from 'i18next';

const pad = (n: number) => String(n).padStart(2, '0');

/** Duração legível em pt-BR: 45 s, 25 min, 2 h, 1 h 05 min. */
export function formatDuration(ms: number, t: TFunction): string {
  const safe = Math.max(0, ms);
  const totalMin = Math.floor(safe / 60_000);
  if (totalMin === 0) return t('dashboard.duration.s', { s: Math.floor(safe / 1000) });
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return t('dashboard.duration.m', { m });
  if (m === 0) return t('dashboard.duration.h', { h });
  return t('dashboard.duration.hm', { h, m: pad(m) });
}

/** Rótulo curto de eixo: 30 min, 2 h, 1,5 h. */
export function formatAxisDuration(ms: number, t: TFunction): string {
  if (ms === 0) return '0';
  const hours = ms / 3_600_000;
  if (hours < 1) return t('dashboard.duration.m', { m: Math.round(ms / 60_000) });
  return t('dashboard.duration.h', {
    h: Number.isInteger(hours) ? hours : hours.toFixed(1).replace('.', ','),
  });
}
