import { describe, expect, it } from 'vitest';
import {
  compareWithPrevious,
  customPeriod,
  dailyAverageMs,
  dailySeries,
  heatmap,
  streaks,
  summarizePeriod,
  todayPeriod,
  totals,
  weekPeriod,
  type DailyPoint,
  type MetricsInput,
  type Session,
  type SessionPause,
} from '../src';
import { HOUR, MIN, NY, SP, areas, groups, pause, session } from './fixtures';

const input = (
  sessions: Session[],
  pauses: SessionPause[] = [],
  now = '2026-12-31T00:00:00Z',
  filter?: MetricsInput['filter'],
): MetricsInput => ({ sessions, pauses, areas, groups, now, ...(filter ? { filter } : {}) });

// Semana de segunda 19/10/2026 a domingo 25/10/2026 em São Paulo (UTC-3).
const WEEK = weekPeriod('2026-10-21T12:00:00Z', SP);

describe('totais por área e grupo', () => {
  it('grupo = soma das áreas (HTML 30 + JS 20 = Estudo 50)', () => {
    const t = totals(
      input([
        session('html', '2026-10-20T13:00:00Z', '2026-10-20T13:30:00Z'),
        session('js', '2026-10-20T14:00:00Z', '2026-10-20T14:20:00Z'),
        session('cliente', '2026-10-20T15:00:00Z', '2026-10-20T15:10:00Z'),
      ]),
      WEEK,
    );
    expect(t.total_ms).toBe(60 * MIN);
    const estudo = t.groups.find((g) => g.group_id === 'estudo')!;
    expect(estudo.ms).toBe(50 * MIN);
    expect(estudo.areas.map((a) => [a.area_id, a.ms])).toEqual([
      ['html', 30 * MIN],
      ['js', 20 * MIN],
    ]);
    expect(t.groups.map((g) => g.group_id)).toEqual(['estudo', 'trabalho']);
  });

  it('arquivados continuam contando', () => {
    const t = totals(
      input([session('velha', '2026-10-20T13:00:00Z', '2026-10-20T14:00:00Z')]),
      WEEK,
    );
    expect(t.groups).toEqual([
      { group_id: 'antigo', ms: HOUR, areas: [{ area_id: 'velha', group_id: 'antigo', ms: HOUR }] },
    ]);
  });

  it('só conta a parte da sessão dentro do período', () => {
    // domingo 18/10 23:00 local → segunda 19/10 01:00 local
    const t = totals(
      input([session('html', '2026-10-19T02:00:00Z', '2026-10-19T04:00:00Z')]),
      WEEK,
    );
    expect(t.total_ms).toBe(HOUR);
  });

  it('sessão ativa e pausa aberta contam até now', () => {
    const s = session('html', '2026-10-20T13:00:00Z', null);
    const p = pause(s, '2026-10-20T13:40:00Z', null);
    const t = totals(input([s], [p], '2026-10-20T15:00:00Z'), WEEK);
    expect(t.total_ms).toBe(40 * MIN);
  });

  it('área desconhecida vai para o grupo null sem perder tempo', () => {
    const t = totals(
      input([session('sumiu', '2026-10-20T13:00:00Z', '2026-10-20T13:05:00Z')]),
      WEEK,
    );
    expect(t.groups[0]).toMatchObject({ group_id: null, ms: 5 * MIN });
  });

  it('filtra por grupo e por área', () => {
    const ss = [
      session('html', '2026-10-20T13:00:00Z', '2026-10-20T13:30:00Z'),
      session('cliente', '2026-10-20T15:00:00Z', '2026-10-20T15:10:00Z'),
    ];
    const now = '2026-12-31T00:00:00Z';
    expect(totals(input(ss, [], now, { group_ids: ['trabalho'] }), WEEK).total_ms).toBe(10 * MIN);
    expect(totals(input(ss, [], now, { area_ids: ['html'] }), WEEK).total_ms).toBe(30 * MIN);
  });
});

describe('virada da meia-noite', () => {
  it('divide a sessão proporcionalmente entre os dias', () => {
    // terça 23:00 → quarta 01:00 local
    const s = session('html', '2026-10-21T02:00:00Z', '2026-10-21T04:00:00Z');
    const d = dailySeries(input([s]), WEEK);
    expect(d.find((p) => p.date === '2026-10-20')!.ms).toBe(HOUR);
    expect(d.find((p) => p.date === '2026-10-21')!.ms).toBe(HOUR);
  });

  it('desconta a pausa do dia em que ela ocorreu', () => {
    // 23:00 → 01:00 local, pausa 23:50 → 00:20
    const s = session('html', '2026-10-21T02:00:00Z', '2026-10-21T04:00:00Z');
    const p = pause(s, '2026-10-21T02:50:00Z', '2026-10-21T03:20:00Z');
    const d = dailySeries(input([s], [p]), WEEK);
    expect(d.find((x) => x.date === '2026-10-20')!.ms).toBe(50 * MIN);
    expect(d.find((x) => x.date === '2026-10-21')!.ms).toBe(40 * MIN);
  });

  it('o dia depende do fuso do período', () => {
    const s = session('html', '2026-10-21T02:00:00Z', '2026-10-21T02:30:00Z'); // 23:00 em SP, 02:00 em UTC
    const utcWeek = weekPeriod('2026-10-21T12:00:00Z', 'UTC');
    expect(dailySeries(input([s]), WEEK).find((x) => x.ms > 0)!.date).toBe('2026-10-20');
    expect(dailySeries(input([s]), utcWeek).find((x) => x.ms > 0)!.date).toBe('2026-10-21');
  });
});

describe('série diária', () => {
  it('um ponto por dia, com zeros, em ordem', () => {
    const d = dailySeries(
      input([session('js', '2026-10-22T13:00:00Z', '2026-10-22T13:25:00Z')]),
      WEEK,
    );
    expect(d).toEqual([
      { date: '2026-10-19', ms: 0 },
      { date: '2026-10-20', ms: 0 },
      { date: '2026-10-21', ms: 0 },
      { date: '2026-10-22', ms: 25 * MIN },
      { date: '2026-10-23', ms: 0 },
      { date: '2026-10-24', ms: 0 },
      { date: '2026-10-25', ms: 0 },
    ]);
  });

  it('sem sessões é tudo zero', () => {
    expect(dailySeries(input([]), WEEK).every((p) => p.ms === 0)).toBe(true);
  });
});

describe('horário de verão (America/New_York)', () => {
  it('dia de 23 h: sessão de 24 h de relógio UTC cabe inteira num dia só de 23 h', () => {
    const day = todayPeriod('2026-03-08T12:00:00Z', NY);
    const s = session('html', '2026-03-08T05:00:00Z', '2026-03-09T04:00:00Z'); // 00:00 → 00:00 local
    const range = customPeriod('2026-03-07', '2026-03-09', NY);
    expect(totals(input([s]), day).total_ms).toBe(23 * HOUR);
    expect(dailySeries(input([s]), range).map((p) => p.ms)).toEqual([0, 23 * HOUR, 0]);
  });

  it('dia de 25 h conta 25 h', () => {
    const s = session('html', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z');
    const range = customPeriod('2026-10-31', '2026-11-02', NY);
    expect(dailySeries(input([s]), range).map((p) => p.ms)).toEqual([0, 25 * HOUR, 0]);
  });

  it('heatmap no fim do DST: a 1 h repetida soma as duas', () => {
    // domingo 01/11 00:00 EDT → 03:00 EST = 4 h reais
    const s = session('html', '2026-11-01T04:00:00Z', '2026-11-01T08:00:00Z');
    const h = heatmap(input([s]), customPeriod('2026-11-01', '2026-11-01', NY));
    const domingo = h.cells[6]!;
    expect(domingo.slice(0, 4)).toEqual([HOUR, 2 * HOUR, HOUR, 0]);
    expect(h.max_ms).toBe(2 * HOUR);
  });

  it('heatmap no início do DST: a 2 h não existe', () => {
    // domingo 08/03 01:00 EST → 04:00 EDT = 2 h reais
    const s = session('html', '2026-03-08T06:00:00Z', '2026-03-08T08:00:00Z');
    const h = heatmap(input([s]), customPeriod('2026-03-08', '2026-03-08', NY));
    expect(h.cells[6]!.slice(0, 5)).toEqual([0, HOUR, 0, HOUR, 0]);
  });
});

describe('heatmap hora × dia da semana', () => {
  it('divide por hora e desconta a pausa da hora em que ocorreu', () => {
    // segunda 19/10 10:30 → 12:15 local, pausa 11:10 → 11:20
    const s = session('html', '2026-10-19T13:30:00Z', '2026-10-19T15:15:00Z');
    const p = pause(s, '2026-10-19T14:10:00Z', '2026-10-19T14:20:00Z');
    const h = heatmap(input([s], [p]), WEEK);
    const segunda = h.cells[0]!;
    expect(segunda[10]).toBe(30 * MIN);
    expect(segunda[11]).toBe(50 * MIN);
    expect(segunda[12]).toBe(15 * MIN);
    expect(h.cells.flat().reduce((a, b) => a + b, 0)).toBe(95 * MIN);
  });

  it('domingo 23:30 → segunda 00:30 cai em domingo/23 h e segunda/0 h', () => {
    // domingo 25/10 23:30 local → segunda 26/10 00:30
    const s = session('js', '2026-10-26T02:30:00Z', '2026-10-26T03:30:00Z');
    const range = customPeriod('2026-10-25', '2026-10-26', SP);
    const h = heatmap(input([s]), range);
    expect(h.cells[6]![23]).toBe(30 * MIN);
    expect(h.cells[0]![0]).toBe(30 * MIN);
  });

  it('soma as semanas do período no mesmo balde', () => {
    const ss = [
      session('js', '2026-10-19T13:00:00Z', '2026-10-19T13:20:00Z'), // seg 10h
      session('js', '2026-10-26T13:00:00Z', '2026-10-26T13:10:00Z'), // seg seguinte 10h
    ];
    const h = heatmap(input(ss), customPeriod('2026-10-19', '2026-11-01', SP));
    expect(h.cells[0]![10]).toBe(30 * MIN);
    expect(h.cells).toHaveLength(7);
    expect(h.cells.every((row) => row.length === 24)).toBe(true);
  });
});

describe('média diária', () => {
  it('período passado divide pelos dias do período', () => {
    expect(dailyAverageMs(7 * HOUR, WEEK, '2026-11-15T00:00:00Z')).toBe(HOUR);
  });

  it('período atual divide só pelos dias já começados', () => {
    expect(dailyAverageMs(3 * HOUR, WEEK, '2026-10-21T12:00:00Z')).toBe(HOUR); // quarta
  });
});

describe('streak', () => {
  const series = (days: [string, number][]): DailyPoint[] =>
    days.map(([date, ms]) => ({ date, ms }));

  it('conta dias seguidos até hoje', () => {
    const s = series([
      ['2026-10-19', HOUR],
      ['2026-10-20', 0],
      ['2026-10-21', HOUR],
      ['2026-10-22', MIN],
      ['2026-10-23', 1],
    ]);
    expect(streaks(s, '2026-10-23')).toEqual({ current: 3, longest: 3 });
  });

  it('hoje ainda em 0 não quebra o streak', () => {
    const s = series([
      ['2026-10-21', HOUR],
      ['2026-10-22', HOUR],
      ['2026-10-23', 0],
    ]);
    expect(streaks(s, '2026-10-23')).toEqual({ current: 2, longest: 2 });
  });

  it('dia de ontem em 0 quebra', () => {
    const s = series([
      ['2026-10-19', HOUR],
      ['2026-10-20', HOUR],
      ['2026-10-21', HOUR],
      ['2026-10-22', 0],
      ['2026-10-23', 0],
    ]);
    expect(streaks(s, '2026-10-23')).toEqual({ current: 0, longest: 3 });
  });

  it('ignora dias depois de hoje', () => {
    const s = series([
      ['2026-10-22', HOUR],
      ['2026-10-23', HOUR],
      ['2026-10-24', 0],
      ['2026-10-25', 0],
    ]);
    expect(streaks(s, '2026-10-23')).toEqual({ current: 2, longest: 2 });
  });

  it('a partir de sessões reais, com sessão cruzando a meia-noite', () => {
    const ss = [
      session('html', '2026-10-20T13:00:00Z', '2026-10-20T14:00:00Z'), // ter
      session('html', '2026-10-22T02:30:00Z', '2026-10-22T03:30:00Z'), // qua 23:30 → qui 00:30
    ];
    const d = dailySeries(input(ss), WEEK);
    expect(streaks(d, '2026-10-22')).toEqual({ current: 3, longest: 3 });
  });
});

describe('comparação com o período anterior', () => {
  const ss = [
    session('html', '2026-10-13T13:00:00Z', '2026-10-13T14:00:00Z'), // semana anterior: 1 h estudo
    session('cliente', '2026-10-14T13:00:00Z', '2026-10-14T13:30:00Z'), // 30 min trabalho
    session('html', '2026-10-20T13:00:00Z', '2026-10-20T14:30:00Z'), // semana atual: 1,5 h estudo
  ];

  it('compara com a semana anterior', () => {
    const c = compareWithPrevious(input(ss), WEEK);
    expect(c.previous_period.first_day).toBe('2026-10-12');
    expect(c.current.total_ms).toBe(90 * MIN);
    expect(c.previous.total_ms).toBe(90 * MIN);
    expect(c.delta_ms).toBe(0);
    expect(c.change_ratio).toBe(0);
    expect(c.groups).toEqual(
      expect.arrayContaining([
        { group_id: 'estudo', current_ms: 90 * MIN, previous_ms: 60 * MIN, delta_ms: 30 * MIN },
        { group_id: 'trabalho', current_ms: 0, previous_ms: 30 * MIN, delta_ms: -30 * MIN },
      ]),
    );
  });

  it('variação relativa', () => {
    const c = compareWithPrevious(input(ss.slice(0, 1).concat(ss[2]!)), WEEK);
    expect(c.change_ratio).toBe(0.5);
  });

  it('anterior zerado dá variação null', () => {
    const c = compareWithPrevious(input([ss[2]!]), WEEK);
    expect(c.previous.total_ms).toBe(0);
    expect(c.change_ratio).toBeNull();
  });
});

describe('resumo do período', () => {
  it('junta tudo e é serializável', () => {
    const ss = [session('html', '2026-10-20T13:00:00Z', '2026-10-20T14:00:00Z')];
    const r = summarizePeriod(input(ss, [], '2026-10-21T12:00:00Z'), WEEK);
    expect(r.totals.total_ms).toBe(HOUR);
    expect(r.daily).toHaveLength(7);
    expect(r.daily_average_ms).toBe(HOUR / 3);
    expect(r.streaks).toEqual({ current: 1, longest: 1 });
    expect(r.comparison.previous.total_ms).toBe(0);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
