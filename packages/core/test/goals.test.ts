import { describe, expect, it } from 'vitest';
import {
  goalPeriods,
  goalProgress,
  goalsWindow,
  goalVersionFor,
  newVersionEffectiveFrom,
  toIso,
  type Goal,
  type GoalVersion,
  type MetricsInput,
  type Session,
  type SessionPause,
} from '../src';
import { HOUR, MIN, NY, SP, areas, groups, pause, session } from './fixtures';

const input = (sessions: Session[], now: string, pauses: SessionPause[] = []): MetricsInput => ({
  sessions,
  pauses,
  areas,
  groups,
  now,
});

const goal = (id: string, extra: Partial<Goal>): Goal => ({
  id,
  user_id: 'u1',
  target_kind: 'total',
  group_id: null,
  area_id: null,
  period: 'day',
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...extra,
});

const version = (goal_id: string, target_minutes: number, effective_from: string): GoalVersion => ({
  id: `${goal_id}-${effective_from}`,
  goal_id,
  target_minutes,
  effective_from,
});

// Quarta 21/10/2026, 09:00 em São Paulo (UTC-3): semana de 19 a 25/10.
const NOW = '2026-10-21T12:00:00Z';

describe('períodos da meta', () => {
  it('semana começa na segunda; atual por último', () => {
    const ps = goalPeriods('week', NOW, SP, 2);
    expect(ps.map((p) => [p.first_day, p.last_day])).toEqual([
      ['2026-10-05', '2026-10-11'],
      ['2026-10-12', '2026-10-18'],
      ['2026-10-19', '2026-10-25'],
    ]);
  });

  it('mês de calendário e dia', () => {
    expect(goalPeriods('month', NOW, SP, 2).map((p) => p.first_day)).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ]);
    expect(goalPeriods('day', NOW, SP, 1).map((p) => p.first_day)).toEqual([
      '2026-10-20',
      '2026-10-21',
    ]);
  });

  it('novo alvo vale desde o início do período atual', () => {
    expect(newVersionEffectiveFrom({ period: 'week' }, NOW, SP)).toBe('2026-10-19');
    expect(newVersionEffectiveFrom({ period: 'month' }, NOW, SP)).toBe('2026-10-01');
    expect(newVersionEffectiveFrom({ period: 'day' }, '2026-10-21T02:00:00Z', SP)).toBe(
      '2026-10-20',
    );
  });

  it('janela cobre o histórico da meta mais longa', () => {
    const w = goalsWindow([{ period: 'day' }, { period: 'month' }], NOW, SP, 8)!;
    expect(toIso(w.start)).toBe('2026-02-01T03:00:00.000Z');
    expect(toIso(w.end)).toBe('2026-11-01T03:00:00.000Z');
    expect(goalsWindow([], NOW, SP)).toBeNull();
  });
});

describe('versão vigente', () => {
  const vs = [version('g', 600, '2026-10-18'), version('g', 480, '2026-10-11')];

  it('a de maior effective_from <= início do período; antes da primeira, a primeira', () => {
    expect(goalVersionFor(vs, '2026-10-19')?.target_minutes).toBe(600);
    expect(goalVersionFor(vs, '2026-10-18')?.target_minutes).toBe(600);
    expect(goalVersionFor(vs, '2026-10-12')?.target_minutes).toBe(480);
    expect(goalVersionFor(vs, '2026-10-01')?.target_minutes).toBe(480);
    expect(goalVersionFor([], '2026-10-01')).toBeUndefined();
  });

  it('meta sem versão não tem progresso', () => {
    expect(goalProgress(goal('g', {}), [], input([], NOW), SP)).toBeNull();
  });
});

describe('progresso', () => {
  it('troca de versão no meio do histórico: semanas antigas com 8 h, a atual com 10 h', () => {
    const g = goal('estudo-semana', { target_kind: 'group', group_id: 'estudo', period: 'week' });
    const vs = [version(g.id, 480, '2026-10-11'), version(g.id, 600, '2026-10-18')];
    const sessions = [
      // semana 05–11: 8 h 30 em Estudo (bate os 8 h)
      session('html', '2026-10-06T12:00:00Z', '2026-10-06T20:30:00Z'),
      // semana 12–18: 9 h (bate 8 h; a versão de 10 h começa no domingo 18,
      // depois do início da semana, então não vale para ela)
      session('js', '2026-10-13T10:00:00Z', '2026-10-13T19:00:00Z'),
      // semana 19–25: 9 h até agora (não bate 10 h); Trabalho não conta
      session('html', '2026-10-19T10:00:00Z', '2026-10-19T19:00:00Z'),
      session('cliente', '2026-10-20T10:00:00Z', '2026-10-20T15:00:00Z'),
    ];
    const p = goalProgress(g, vs, input(sessions, NOW), SP, 8)!;

    // Semanas antes de 05–11 terminam antes da primeira versão: fora do histórico.
    expect(p.history.map((h) => [h.period.first_day, h.version.target_minutes, h.met])).toEqual([
      ['2026-10-05', 480, true],
      ['2026-10-12', 480, true],
    ]);
    expect(p.met_count).toBe(2);
    expect(p.current.version.target_minutes).toBe(600);
    expect(p.current.done_ms).toBe(9 * HOUR);
    expect(p.current.target_ms).toBe(10 * HOUR);
    expect(p.current.ratio).toBeCloseTo(0.9);
    expect(p.current.met).toBe(false);
    expect(p.current.remaining_ms).toBe(HOUR);
  });

  it('meta de área por mês, com o limite do mês no fuso do perfil', () => {
    const g = goal('js-mes', { target_kind: 'area', area_id: 'js', period: 'month' });
    const sessions = [
      // 31/10 23:00 em SP (01/11 02:00 UTC): ainda é outubro
      session('js', '2026-11-01T02:00:00Z', '2026-11-01T02:30:00Z'),
      // 01/10 00:30 em SP: outubro; 30/09 23:30: setembro
      session('js', '2026-10-01T03:30:00Z', '2026-10-01T04:00:00Z'),
      session('js', '2026-10-01T02:30:00Z', '2026-10-01T02:50:00Z'),
      session('html', '2026-10-10T12:00:00Z', '2026-10-10T18:00:00Z'),
    ];
    const p = goalProgress(
      g,
      [version(g.id, 60, '2026-09-01')],
      input(sessions, '2026-11-01T02:40:00Z'),
      SP,
      1,
    )!;
    expect(p.current.period.first_day).toBe('2026-10-01');
    expect(p.current.done_ms).toBe(60 * MIN);
    expect(p.current.met).toBe(true);
    expect(p.history[0]!.period.first_day).toBe('2026-09-01');
    expect(p.history[0]!.done_ms).toBe(20 * MIN);
  });

  it('meta total por dia desconta pausas e conta a sessão aberta até agora', () => {
    const g = goal('total-dia', { period: 'day' });
    const open = session('cliente', '2026-10-21T11:00:00Z', null);
    const closed = session('html', '2026-10-21T10:00:00Z', '2026-10-21T10:40:00Z');
    const p = goalProgress(
      g,
      [version(g.id, 120, '2026-10-21')],
      input([open, closed], NOW, [pause(closed, '2026-10-21T10:10:00Z', '2026-10-21T10:20:00Z')]),
      SP,
    )!;
    // 30 min (40 − 10 de pausa) + 60 min abertos
    expect(p.current.done_ms).toBe(90 * MIN);
    expect(p.current.remaining_ms).toBe(30 * MIN);
    expect(p.history).toEqual([]);
  });

  it('arquivados continuam contando (meta, grupo e área)', () => {
    const g = goal('antigo-dia', {
      target_kind: 'group',
      group_id: 'antigo',
      period: 'day',
      archived_at: '2026-10-21T00:00:00Z',
    });
    const p = goalProgress(
      g,
      [version(g.id, 30, '2026-10-01')],
      input([session('velha', '2026-10-21T10:00:00Z', '2026-10-21T10:45:00Z')], NOW),
      SP,
    )!;
    expect(p.current.done_ms).toBe(45 * MIN);
    expect(p.current.met).toBe(true);
    expect(p.current.ratio).toBe(1.5);
  });

  it('no fim do horário de verão o dia tem 25 h e a sessão cai no dia local certo', () => {
    // Nova York: 01/11/2026 volta para UTC-5 às 02:00 locais.
    const g = goal('ny-dia', { period: 'day' });
    const sessions = [
      // 01/11 23:30–23:50 EST (02/11 04:30–04:50 UTC): ainda é dia 01
      session('html', '2026-11-02T04:30:00Z', '2026-11-02T04:50:00Z'),
      // 02/11 00:10–00:40 EST
      session('html', '2026-11-02T05:10:00Z', '2026-11-02T05:40:00Z'),
    ];
    const p = goalProgress(
      g,
      [version(g.id, 25, '2026-10-01')],
      input(sessions, '2026-11-02T12:00:00Z'),
      NY,
      1,
    )!;
    const day1 = p.history[0]!;
    expect(day1.period.first_day).toBe('2026-11-01');
    expect(Date.parse(day1.period.end) - Date.parse(day1.period.start)).toBe(25 * HOUR);
    expect(day1.done_ms).toBe(20 * MIN);
    expect(day1.met).toBe(false);
    expect(p.current.done_ms).toBe(30 * MIN);
    expect(p.current.met).toBe(true);
  });
});
