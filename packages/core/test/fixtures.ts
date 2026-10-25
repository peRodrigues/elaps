import type { Area, Group, Session, SessionPause } from '../src';

export const MIN = 60_000;
export const HOUR = 60 * MIN;

let seq = 0;
const nextId = (prefix: string) => `${prefix}${++seq}`;

export function session(
  area_id: string,
  started_at: string,
  ended_at: string | null,
  extra: Partial<Session> = {},
): Session {
  return {
    id: nextId('s'),
    user_id: 'u1',
    area_id,
    started_at,
    ended_at,
    source: 'timer',
    note: null,
    ...extra,
  };
}

export function pause(s: Session, paused_at: string, resumed_at: string | null): SessionPause {
  return { id: nextId('p'), session_id: s.id, paused_at, resumed_at };
}

export const groups: Group[] = [
  { id: 'estudo', user_id: 'u1', name: 'Estudo', color: '#3366ff', archived_at: null },
  { id: 'trabalho', user_id: 'u1', name: 'Trabalho', color: '#ff6633', archived_at: null },
  {
    id: 'antigo',
    user_id: 'u1',
    name: 'Antigo',
    color: '#999999',
    archived_at: '2026-01-01T00:00:00Z',
  },
];

export const areas: Area[] = [
  { id: 'html', user_id: 'u1', group_id: 'estudo', name: 'HTML', archived_at: null },
  { id: 'js', user_id: 'u1', group_id: 'estudo', name: 'JS', archived_at: null },
  { id: 'cliente', user_id: 'u1', group_id: 'trabalho', name: 'Cliente', archived_at: null },
  {
    id: 'velha',
    user_id: 'u1',
    group_id: 'antigo',
    name: 'Velha',
    archived_at: '2026-01-01T00:00:00Z',
  },
];

export const SP = 'America/Sao_Paulo';
export const NY = 'America/New_York';
