import { useEffect, useState } from 'react';
import type { TFunction } from 'i18next';

// Formatação de tempo e conversão de horário de parede no fuso do perfil
// (que pode não ser o do navegador), só com Intl.

const pad = (n: number) => String(n).padStart(2, '0');

/** Relógio do cronômetro: 0:07:05, 12:30:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  return `${h}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Duração legível: 45 s, 25 min, 2 h, 1 h 05 min. */
export function formatDuration(ms: number, t: TFunction): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMin === 0) return t('timer.duration.s', { s: Math.floor(Math.max(0, ms) / 1000) });
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return t('timer.duration.m', { m });
  if (m === 0) return t('timer.duration.h', { h });
  return t('timer.duration.hm', { h, m: pad(m) });
}

/** Hora local HH:mm no fuso. */
export function formatTime(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms);
}

function wallParts(ms: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(ms);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    y: get('year'),
    mo: get('month'),
    d: get('day'),
    h: get('hour'),
    mi: get('minute'),
    s: get('second'),
  };
}

/** Deslocamento do fuso no instante (ms a somar ao UTC para ter o horário local). */
function offsetMs(ms: number, timezone: string): number {
  const p = wallParts(ms, timezone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Valor de <input type="datetime-local"> (yyyy-MM-ddTHH:mm) no fuso. */
export function toWallTime(ms: number, timezone: string): string {
  const p = wallParts(ms, timezone);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Instante de um horário de parede no fuso; NaN se o texto não for válido. */
export function fromWallTime(value: string, timezone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return NaN;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  // Duas passadas acertam o deslocamento perto das viradas de horário de verão.
  const first = asUtc - offsetMs(asUtc, timezone);
  return asUtc - offsetMs(first, timezone);
}

/** Agora, atualizado a cada `intervalMs` (sem tick se null). */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === null) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
