import { describe, expect, it } from 'vitest';
import {
  FORGOTTEN_AFTER_MS,
  TimerInvariantError,
  applyTimerCommand,
  canTransition,
  deriveTimerState,
  isForgotten,
  timerElapsedMs,
  toIso,
  toMs,
  type TimerAction,
  type TimerCommand,
  type TimerState,
  type TimerStatus,
} from '../src';
import { HOUR, MIN, pause, session } from './fixtures';

const T0 = '2026-10-20T10:00:00Z';
const at = (ms: number) => toIso(toMs(T0) + ms);

const done = session('html', '2026-10-19T10:00:00Z', '2026-10-19T11:00:00Z');
const active = session('html', T0, null);
const openPause = pause(active, at(10 * MIN), null);

const stopped: TimerState = deriveTimerState([done], []);
const running: TimerState = deriveTimerState([done, active], []);
const paused: TimerState = deriveTimerState([done, active], [openPause]);

const commands: Record<TimerAction, TimerCommand> = {
  start: { action: 'start', area_id: 'js', user_id: 'u1' },
  pause: { action: 'pause' },
  resume: { action: 'resume' },
  stop: { action: 'stop' },
};

describe('estado do cronômetro', () => {
  it('deriva parado, rodando e pausado', () => {
    expect(stopped.status).toBe('stopped');
    expect(running.status).toBe('running');
    expect(paused.status).toBe('paused');
    if (paused.status === 'paused') expect(paused.openPause.id).toBe(openPause.id);
  });

  it('mais de um ativo viola o invariante', () => {
    const outro = session('js', T0, null);
    expect(() => deriveTimerState([active, outro], [])).toThrow(TimerInvariantError);
  });

  it('duas pausas abertas violam o invariante', () => {
    const p2 = pause(active, at(20 * MIN), null);
    expect(() => deriveTimerState([active], [openPause, p2])).toThrow(TimerInvariantError);
  });
});

describe('transições', () => {
  const states: Record<TimerStatus, TimerState> = { stopped, running, paused };
  const valid: [TimerStatus, TimerAction][] = [
    ['stopped', 'start'],
    ['running', 'pause'],
    ['running', 'stop'],
    ['paused', 'resume'],
    ['paused', 'stop'],
  ];
  const all = (['stopped', 'running', 'paused'] as const).flatMap((s) =>
    (['start', 'pause', 'resume', 'stop'] as const).map(
      (a) => [s, a] as [TimerStatus, TimerAction],
    ),
  );
  const invalid = all.filter(([s, a]) => !valid.some(([vs, va]) => vs === s && va === a));

  it.each(valid)('%s → %s é válida', (status, action) => {
    expect(canTransition(status, action)).toBe(true);
    expect(applyTimerCommand(states[status], commands[action], at(HOUR)).ok).toBe(true);
  });

  it.each(invalid)('%s → %s é inválida', (status, action) => {
    expect(canTransition(status, action)).toBe(false);
    expect(applyTimerCommand(states[status], commands[action], at(HOUR))).toEqual({
      ok: false,
      error: { code: 'invalid_transition', from: status, action },
    });
  });

  it('iniciar cria sessão de timer aberta', () => {
    const r = applyTimerCommand(stopped, commands.start, T0);
    expect(r).toEqual({
      ok: true,
      effect: {
        type: 'create_session',
        session: {
          user_id: 'u1',
          area_id: 'js',
          started_at: '2026-10-20T10:00:00.000Z',
          ended_at: null,
          source: 'timer',
          note: null,
        },
      },
    });
  });

  it('pausar cria pausa aberta; retomar fecha a pausa aberta', () => {
    expect(applyTimerCommand(running, commands.pause, at(5 * MIN))).toMatchObject({
      ok: true,
      effect: { type: 'create_pause', pause: { session_id: active.id, resumed_at: null } },
    });
    expect(applyTimerCommand(paused, commands.resume, at(30 * MIN))).toMatchObject({
      ok: true,
      effect: { type: 'close_pause', pause_id: openPause.id, resumed_at: at(30 * MIN) },
    });
  });

  it('parar pausado fecha a pausa no mesmo instante e não conta a pausa', () => {
    const r = applyTimerCommand(paused, commands.stop, at(HOUR));
    expect(r).toMatchObject({
      ok: true,
      effect: {
        type: 'end_session',
        session_id: active.id,
        ended_at: at(HOUR),
        close_pause: { pause_id: openPause.id, resumed_at: at(HOUR) },
        net_ms: 10 * MIN,
        confirm_discard: false,
      },
    });
  });
});

describe('regra de < 60 s ao parar', () => {
  const stopAt = (state: TimerState, ms: number) => {
    const r = applyTimerCommand(state, commands.stop, at(ms));
    if (!r.ok || r.effect.type !== 'end_session') throw new Error('esperava end_session');
    return r.effect;
  };

  it('59 s pergunta se descarta', () => {
    expect(stopAt(running, 59_000)).toMatchObject({ net_ms: 59_000, confirm_discard: true });
  });

  it('exatamente 60 s não pergunta', () => {
    expect(stopAt(running, 60_000).confirm_discard).toBe(false);
  });

  it('usa o tempo líquido: 2 min com 1,5 min de pausa pergunta', () => {
    const p = pause(active, at(15_000), at(105_000));
    const state = deriveTimerState([active], [p]);
    expect(stopAt(state, 2 * MIN)).toMatchObject({ net_ms: 30_000, confirm_discard: true });
  });
});

describe('aviso de esquecido (> 8 h) e nunca para sozinho', () => {
  it('8 h exatas não avisa; 8 h + 1 ms avisa', () => {
    expect(isForgotten(running, at(FORGOTTEN_AFTER_MS))).toBe(false);
    expect(isForgotten(running, at(FORGOTTEN_AFTER_MS + 1))).toBe(true);
  });

  it('continua rodando e contando depois do aviso', () => {
    const now = at(30 * HOUR);
    expect(isForgotten(running, now)).toBe(true);
    expect(deriveTimerState([active], []).status).toBe('running');
    expect(timerElapsedMs(running, now)).toBe(30 * HOUR);
  });

  it('pausado não avisa', () => {
    expect(isForgotten(paused, at(20 * HOUR))).toBe(false);
  });

  it('conta desde a última retomada', () => {
    const p = pause(active, at(4 * HOUR), at(5 * HOUR));
    const state = deriveTimerState([active], [p]);
    expect(isForgotten(state, at(12 * HOUR))).toBe(false); // 7 h desde a retomada
    expect(isForgotten(state, at(13 * HOUR + 1))).toBe(true);
  });

  it('parado nunca avisa', () => {
    expect(isForgotten(stopped, at(100 * HOUR))).toBe(false);
    expect(timerElapsedMs(stopped, at(HOUR))).toBe(0);
  });
});
