import { describe, expect, it } from 'vitest';
import { summarizePeriod, toSharePayload, weekPeriod, type MetricsInput } from '../src';
import { HOUR, SP, areas, groups, pause, session } from './fixtures';

const WEEK = weekPeriod('2026-10-21T12:00:00Z', SP);

// Segunda 19/10: 2 h de HTML (com 30 min de pausa); terça 20/10: 1 h de Cliente.
const html = session('html', '2026-10-19T13:00:00Z', '2026-10-19T15:00:00Z', {
  note: 'segredo da nota',
});
const input: MetricsInput = {
  sessions: [html, session('cliente', '2026-10-20T13:00:00Z', '2026-10-20T14:00:00Z')],
  pauses: [pause(html, '2026-10-19T14:00:00Z', '2026-10-19T14:30:00Z')],
  areas,
  groups,
  now: '2026-12-31T00:00:00Z',
};
const summary = summarizePeriod(input, WEEK);
const label = 'Semana de 19/10 a 25/10';

describe('toSharePayload', () => {
  it('reduz o resumo ao formato v1', () => {
    const p = toSharePayload(summary, { groups, areas }, { label, hideAreaNames: false });
    expect(p.version).toBe(1);
    expect(p.period).toEqual({
      label,
      start: '2026-10-19',
      end: '2026-10-25',
      timezone: SP,
      days: 7,
    });
    expect(p.total_ms).toBe(2.5 * HOUR);
    expect(p.streak).toEqual({ current: summary.streaks.current, longest: 2 });
    expect(p.groups).toEqual([
      {
        name: 'Estudo',
        color: '#3366ff',
        ms: 1.5 * HOUR,
        areas: [{ name: 'HTML', ms: 1.5 * HOUR }],
      },
      { name: 'Trabalho', color: '#ff6633', ms: HOUR, areas: [{ name: 'Cliente', ms: HOUR }] },
    ]);
    expect(p.daily).toHaveLength(7);
    expect(p.daily[0]).toEqual({ date: '2026-10-19', ms: 1.5 * HOUR });
    expect(p.heatmap).toHaveLength(7);
    expect(p.heatmap![0]).toHaveLength(24);
  });

  it('hideAreaNames remove os nomes das áreas e mantém os grupos', () => {
    const p = toSharePayload(summary, { groups, areas }, { label, hideAreaNames: true });
    expect(p.groups.map((g) => g.name)).toEqual(['Estudo', 'Trabalho']);
    for (const g of p.groups) expect(g).not.toHaveProperty('areas');
    const json = JSON.stringify(p);
    expect(json).not.toContain('HTML');
    expect(json).not.toContain('Cliente');
  });

  it('não leva ids, user_id, notas nem tags', () => {
    const json = JSON.stringify(
      toSharePayload(summary, { groups, areas }, { label, hideAreaNames: false }),
    );
    for (const secret of ['u1', 'estudo"', 'trabalho"', 'html"', 'segredo da nota', html.id]) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toMatch(/user_id|session_id|group_id|area_id|note|tag/);
  });

  it('heatmap é opcional', () => {
    const p = toSharePayload(
      summary,
      { groups, areas },
      { label, hideAreaNames: false, includeHeatmap: false },
    );
    expect(p).not.toHaveProperty('heatmap');
  });

  it('grupo ou área desconhecidos viram nomes genéricos', () => {
    const orphan: MetricsInput = {
      ...input,
      sessions: [session('fantasma', '2026-10-19T13:00:00Z', '2026-10-19T14:00:00Z')],
      pauses: [],
      areas: [],
      groups: [],
    };
    const p = toSharePayload(
      summarizePeriod(orphan, WEEK),
      { groups: [], areas: [] },
      { label, hideAreaNames: false },
    );
    expect(p.groups).toEqual([
      { name: 'Outros', color: '#999999', ms: HOUR, areas: [{ name: 'Outra área', ms: HOUR }] },
    ]);
  });

  it('é serializável em JSON sem perda', () => {
    const p = toSharePayload(summary, { groups, areas }, { label, hideAreaNames: false });
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});
