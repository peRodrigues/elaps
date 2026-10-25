import { toIso, toMs } from './duration';
import type { Instant, PomodoroSettings, Session, SessionPause } from './types';

// Fases do pomodoro, derivadas só de (início, pausas, retrato da config, agora).
// Foco = sessão rodando; pausa curta/longa = session_pause com kind 'break'.
// O foco conta tempo de foco efetivo: uma pausa manual congela o relógio dele.
// A k-ésima pausa de pomodoro (1, 2, …) é longa se k for múltiplo de
// pomodoro_long_every. As transições devidas (o app estava fechado, em
// segundo plano ou o relógio passou de um limite) saem com os horários exatos
// e são gravadas de uma vez pela RPC apply_pomodoro.

export type PomodoroPhaseKind = 'focus' | 'short_break' | 'long_break';

export interface PomodoroPhase {
  kind: PomodoroPhaseKind;
  /** Foco atual no ciclo (1…`cycle_size`); na pausa, o foco que acabou de terminar. */
  cycle_index: number;
  /** Focos por ciclo (`pomodoro_long_every`). */
  cycle_size: number;
  /** Focos concluídos na sessão. */
  focus_count: number;
  /** Pausa manual em andamento no foco: o relógio da fase está parado. */
  paused: boolean;
  /** Duração total da fase. */
  length_ms: number;
  remaining_ms: number;
  /** Quando a fase termina se nada mudar; `null` com o foco pausado. */
  ends_at: number | null;
}

/** Pausa a criar pela RPC; só a última pode ficar aberta. */
export interface PlannedBreak {
  paused_at: string;
  resumed_at: string | null;
}

/** Escrita que leva o banco ao estado de `now`. Vazia = nada a fazer. */
export interface PomodoroPlan {
  /** Total de pausas da sessão que o cálculo viu (precondição da RPC). */
  expected_pauses: number;
  /** Fechar a pausa de pomodoro aberta neste instante. */
  close_open_at: string | null;
  new_pauses: PlannedBreak[];
}

export interface PomodoroState {
  phase: PomodoroPhase;
  plan: PomodoroPlan;
}

/** Teto de viradas aplicadas de uma vez (dias com o app fechado e foco de 1 min). */
export const MAX_POMODORO_TRANSITIONS = 2000;

const MIN = 60_000;

export const isEmptyPlan = (plan: PomodoroPlan) =>
  plan.close_open_at === null && plan.new_pauses.length === 0;

function breakLengthMs(k: number, config: PomodoroSettings): number {
  return (
    (k % config.pomodoro_long_every === 0
      ? config.pomodoro_long_break_min
      : config.pomodoro_short_break_min) * MIN
  );
}

function breakKind(k: number, config: PomodoroSettings): PomodoroPhaseKind {
  return k % config.pomodoro_long_every === 0 ? 'long_break' : 'short_break';
}

/**
 * Fase em `now` e as viradas que faltam gravar. `pauses` pode trazer pausas
 * de outras sessões (são ignoradas). Pausa sem `kind` conta como manual.
 */
export function pomodoroState(
  session: Pick<Session, 'id' | 'started_at'>,
  pauses: readonly SessionPause[],
  config: PomodoroSettings,
  now: Instant,
): PomodoroState {
  const nowMs = toMs(now);
  const focusMs = config.pomodoro_focus_min * MIN;
  const N = config.pomodoro_long_every;
  const own = pauses
    .filter((p) => p.session_id === session.id)
    .sort((a, b) => toMs(a.paused_at) - toMs(b.paused_at));

  // Percorre o que já está no banco.
  let k = 0; // pausas de pomodoro já começadas = focos concluídos
  let t = toMs(session.started_at); // desde quando o foco atual roda
  let focusUsed = 0;
  let openBreakStart: number | null = null;
  let openManual = false;
  for (const p of own) {
    const start = toMs(p.paused_at);
    if ((p.kind ?? 'manual') === 'break') {
      k++;
      if (p.resumed_at === null) {
        openBreakStart = start;
        break;
      }
      t = toMs(p.resumed_at);
      focusUsed = 0;
    } else {
      focusUsed += Math.max(0, start - t);
      if (p.resumed_at === null) {
        openManual = true;
        break;
      }
      t = toMs(p.resumed_at);
    }
  }

  const plan: PomodoroPlan = { expected_pauses: own.length, close_open_at: null, new_pauses: [] };
  const focusPhase = (remaining: number, endsAt: number | null, paused: boolean) => ({
    phase: {
      kind: 'focus' as const,
      cycle_index: (k % N) + 1,
      cycle_size: N,
      focus_count: k,
      paused,
      length_ms: focusMs,
      remaining_ms: remaining,
      ends_at: endsAt,
    },
    plan,
  });

  if (openManual) return focusPhase(Math.max(0, focusMs - focusUsed), null, true);

  // Daqui em diante, extrapola as viradas até `now`.
  let breakStart = openBreakStart;
  let virtualBreak: PlannedBreak | null = null;
  for (let i = 0; i <= MAX_POMODORO_TRANSITIONS; i++) {
    if (breakStart === null) {
      // Foco rodando desde t, com focusUsed já gasto.
      const boundary = t + Math.max(0, focusMs - focusUsed);
      if (boundary > nowMs || i === MAX_POMODORO_TRANSITIONS) {
        return focusPhase(boundary - nowMs, boundary, false);
      }
      k++;
      breakStart = boundary;
      virtualBreak = { paused_at: toIso(boundary), resumed_at: null };
      plan.new_pauses.push(virtualBreak);
    } else {
      const length = breakLengthMs(k, config);
      const end = breakStart + length;
      if (end > nowMs || i === MAX_POMODORO_TRANSITIONS) {
        return {
          phase: {
            kind: breakKind(k, config),
            cycle_index: ((k - 1) % N) + 1,
            cycle_size: N,
            focus_count: k,
            paused: false,
            length_ms: length,
            remaining_ms: end - nowMs,
            ends_at: end,
          },
          plan,
        };
      }
      if (virtualBreak) virtualBreak.resumed_at = toIso(end);
      else plan.close_open_at = toIso(end);
      virtualBreak = null;
      breakStart = null;
      t = end;
      focusUsed = 0;
    }
  }
  throw new Error('inalcançável');
}

/**
 * Plano para "Pular fase" em `now`: no foco, começa a pausa agora; na pausa,
 * volta ao foco agora. Inclui as viradas devidas antes disso. `null` com o
 * foco em pausa manual (retome antes).
 */
export function skipPomodoroPhase(
  session: Pick<Session, 'id' | 'started_at'>,
  pauses: readonly SessionPause[],
  config: PomodoroSettings,
  now: Instant,
): PomodoroPlan | null {
  const { phase, plan } = pomodoroState(session, pauses, config, now);
  if (phase.paused) return null;
  const at = toIso(toMs(now));
  const last = plan.new_pauses[plan.new_pauses.length - 1];
  if (phase.kind === 'focus') {
    plan.new_pauses.push({ paused_at: at, resumed_at: null });
  } else if (last && last.resumed_at === null) {
    // A pausa atual ainda nem foi gravada: grava já fechada agora.
    last.resumed_at = at;
  } else {
    plan.close_open_at = at;
  }
  return plan;
}
