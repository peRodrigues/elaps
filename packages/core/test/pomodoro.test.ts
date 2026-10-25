import { describe, expect, it } from 'vitest';
import {
  isEmptyPlan,
  netDurationMs,
  pomodoroState,
  skipPomodoroPhase,
  toMs,
  type PomodoroPlan,
  type PomodoroSettings,
  type SessionPause,
} from '../src';
import { MIN, session } from './fixtures';

const CLASSIC: PomodoroSettings = {
  pomodoro_focus_min: 25,
  pomodoro_short_break_min: 5,
  pomodoro_long_break_min: 15,
  pomodoro_long_every: 4,
};

const START = '2026-10-20T10:00:00.000Z';
const at = (min: number) => new Date(toMs(START) + min * MIN).toISOString();
const s = session('html', START, null, { mode: 'pomodoro', pomodoro_config: CLASSIC });

let seq = 0;
const p = (
  pausedMin: number,
  resumedMin: number | null,
  kind: 'manual' | 'break' = 'break',
): SessionPause => ({
  id: `p${++seq}`,
  session_id: s.id,
  paused_at: at(pausedMin),
  resumed_at: resumedMin === null ? null : at(resumedMin),
  kind,
});

/** Aplica o plano às pausas, como a RPC faria. */
function apply(pauses: SessionPause[], plan: PomodoroPlan): SessionPause[] {
  const out = pauses.map((x) =>
    plan.close_open_at && x.resumed_at === null && x.kind === 'break'
      ? { ...x, resumed_at: plan.close_open_at }
      : x,
  );
  for (const b of plan.new_pauses) {
    out.push({ id: `p${++seq}`, session_id: s.id, kind: 'break', ...b });
  }
  return out;
}

describe('fase atual', () => {
  it('foco 1/4 logo após iniciar, com contagem regressiva', () => {
    const { phase, plan } = pomodoroState(s, [], CLASSIC, at(10));
    expect(phase).toMatchObject({
      kind: 'focus',
      cycle_index: 1,
      cycle_size: 4,
      focus_count: 0,
      paused: false,
      remaining_ms: 15 * MIN,
      ends_at: toMs(at(25)),
    });
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it('no limite do foco cria a pausa curta no instante exato', () => {
    const { phase, plan } = pomodoroState(s, [], CLASSIC, at(26));
    expect(plan).toEqual({
      expected_pauses: 0,
      close_open_at: null,
      new_pauses: [{ paused_at: at(25), resumed_at: null }],
    });
    expect(phase).toMatchObject({ kind: 'short_break', cycle_index: 1, remaining_ms: 4 * MIN });
  });

  it('no fim da pausa gravada fecha no instante exato e volta ao foco 2/4', () => {
    const { phase, plan } = pomodoroState(s, [p(25, null)], CLASSIC, at(31));
    expect(plan).toEqual({ expected_pauses: 1, close_open_at: at(30), new_pauses: [] });
    expect(phase).toMatchObject({ kind: 'focus', cycle_index: 2, remaining_ms: 24 * MIN });
  });

  it('pausa longa depois do 4º foco e o ciclo recomeça', () => {
    // focos 0–25, 30–55, 60–85, 90–115; pausas curtas de 5; longa 115–130.
    const pauses = [p(25, 30), p(55, 60), p(85, 90), p(115, null)];
    const during = pomodoroState(s, pauses, CLASSIC, at(120)).phase;
    expect(during).toMatchObject({
      kind: 'long_break',
      cycle_index: 4,
      focus_count: 4,
      length_ms: 15 * MIN,
      remaining_ms: 10 * MIN,
    });
    const after = pomodoroState(s, pauses, CLASSIC, at(131));
    expect(after.plan.close_open_at).toBe(at(130));
    expect(after.phase).toMatchObject({ kind: 'focus', cycle_index: 1, focus_count: 4 });
  });
});

describe('pausa manual no meio do foco', () => {
  it('congela o relógio do foco e empurra o limite', () => {
    // Foco desde 0; pausa manual 10–20: o foco termina em 35, não em 25.
    const manual = p(10, 20, 'manual');
    const paused = pomodoroState(s, [p(10, null, 'manual')], CLASSIC, at(40)).phase;
    expect(paused).toMatchObject({
      kind: 'focus',
      paused: true,
      remaining_ms: 15 * MIN,
      ends_at: null,
    });
    expect(isEmptyPlan(pomodoroState(s, [p(10, null, 'manual')], CLASSIC, at(500)).plan)).toBe(
      true,
    );

    const running = pomodoroState(s, [manual], CLASSIC, at(30));
    expect(running.phase).toMatchObject({
      kind: 'focus',
      remaining_ms: 5 * MIN,
      ends_at: toMs(at(35)),
    });
    const due = pomodoroState(s, [manual], CLASSIC, at(36));
    expect(due.plan.new_pauses).toEqual([{ paused_at: at(35), resumed_at: null }]);
  });

  it('pausa sem kind conta como manual', () => {
    const { kind: _drop, ...legacy } = p(10, 20, 'manual');
    void _drop;
    const { phase } = pomodoroState(s, [legacy], CLASSIC, at(30));
    expect(phase.ends_at).toBe(toMs(at(35)));
  });
});

describe('reconciliação com o app fechado', () => {
  it('3 h fechado: grava todas as viradas com horários exatos, sem buracos', () => {
    // Fechado durante o foco 1, aberto às 13:00 (180 min).
    const { phase, plan } = pomodoroState(s, [], CLASSIC, at(180));
    // Ciclo de 4 focos = 4·25 + 3·5 + 15 = 130 min; depois foco 130–155, pausa 155–160,
    // foco 160–185 em andamento.
    expect(plan.new_pauses).toEqual([
      { paused_at: at(25), resumed_at: at(30) },
      { paused_at: at(55), resumed_at: at(60) },
      { paused_at: at(85), resumed_at: at(90) },
      { paused_at: at(115), resumed_at: at(130) },
      { paused_at: at(155), resumed_at: at(160) },
    ]);
    expect(phase).toMatchObject({
      kind: 'focus',
      cycle_index: 2,
      focus_count: 5,
      remaining_ms: 5 * MIN,
    });
    // Tempo líquido = só os focos: 5·25 + 20 = 145 min.
    expect(netDurationMs(s, apply([], plan), at(180))).toBe(145 * MIN);
  });

  it('fechado no meio de uma pausa gravada: fecha a aberta e segue', () => {
    const { plan, phase } = pomodoroState(s, [p(25, null)], CLASSIC, at(62));
    expect(plan).toEqual({
      expected_pauses: 1,
      close_open_at: at(30),
      new_pauses: [{ paused_at: at(55), resumed_at: at(60) }],
    });
    expect(phase).toMatchObject({ kind: 'focus', cycle_index: 3 });
  });

  it('a última virada pode ficar aberta', () => {
    const { plan } = pomodoroState(s, [], CLASSIC, at(57));
    expect(plan.new_pauses).toEqual([
      { paused_at: at(25), resumed_at: at(30) },
      { paused_at: at(55), resumed_at: null },
    ]);
  });

  it('reaplicar depois de gravar não gera nada (idempotente)', () => {
    const first = pomodoroState(s, [], CLASSIC, at(180)).plan;
    const after = pomodoroState(s, apply([], first), CLASSIC, at(180));
    expect(isEmptyPlan(after.plan)).toBe(true);
    expect(after.plan.expected_pauses).toBe(5);
  });

  it('valores curtos (foco 1, pausa 1, longa 2, a cada 2)', () => {
    const short = {
      pomodoro_focus_min: 1,
      pomodoro_short_break_min: 1,
      pomodoro_long_break_min: 2,
      pomodoro_long_every: 2,
    };
    const { plan, phase } = pomodoroState(s, [], short, at(6.5));
    expect(plan.new_pauses).toEqual([
      { paused_at: at(1), resumed_at: at(2) },
      { paused_at: at(3), resumed_at: at(5) },
      { paused_at: at(6), resumed_at: null },
    ]);
    expect(phase).toMatchObject({ kind: 'short_break', cycle_index: 1, remaining_ms: 0.5 * MIN });
  });
});

describe('pular fase', () => {
  it('no foco, começa a pausa agora', () => {
    expect(skipPomodoroPhase(s, [], CLASSIC, at(10))).toEqual({
      expected_pauses: 0,
      close_open_at: null,
      new_pauses: [{ paused_at: at(10), resumed_at: null }],
    });
  });

  it('na pausa gravada, volta ao foco agora', () => {
    expect(skipPomodoroPhase(s, [p(25, null)], CLASSIC, at(27))).toEqual({
      expected_pauses: 1,
      close_open_at: at(27),
      new_pauses: [],
    });
  });

  it('na pausa ainda não gravada, grava já fechada agora', () => {
    expect(skipPomodoroPhase(s, [], CLASSIC, at(27))?.new_pauses).toEqual([
      { paused_at: at(25), resumed_at: at(27) },
    ]);
  });

  it('pular o foco cedo conta como foco concluído (a próxima pausa segue a ordem)', () => {
    const pauses = [p(10, 15)]; // foco 1 pulado em 10
    const { phase } = pomodoroState(s, pauses, CLASSIC, at(20));
    expect(phase).toMatchObject({ kind: 'focus', cycle_index: 2, remaining_ms: 20 * MIN });
  });

  it('com o foco em pausa manual não há o que pular', () => {
    expect(skipPomodoroPhase(s, [p(10, null, 'manual')], CLASSIC, at(12))).toBeNull();
  });
});
