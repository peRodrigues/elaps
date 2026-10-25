import { netDurationMs, toIso, toMs } from './duration';
import type { Instant, Session, SessionPause } from './types';

// Regras do cronômetro. Um ativo por usuário: a sessão com `ended_at` nulo.
// As transições são puras: devolvem o efeito a gravar no banco, não gravam.
// O cronômetro nunca para sozinho; `isForgotten` só avisa.

/** Abaixo disso, ao parar, a tela pergunta "descartar ou salvar?". */
export const MIN_SESSION_MS = 60_000;
/** Rodando sem interrupção há mais que isso: aviso de esquecido. */
export const FORGOTTEN_AFTER_MS = 8 * 3_600_000;

export type TimerStatus = 'stopped' | 'running' | 'paused';
export type TimerAction = 'start' | 'pause' | 'resume' | 'stop';

export type TimerState =
  | { status: 'stopped' }
  | { status: 'running'; session: Session; pauses: SessionPause[] }
  | { status: 'paused'; session: Session; pauses: SessionPause[]; openPause: SessionPause };

const ALLOWED: Record<TimerStatus, readonly TimerAction[]> = {
  stopped: ['start'],
  running: ['pause', 'stop'],
  paused: ['resume', 'stop'],
};

export function canTransition(status: TimerStatus, action: TimerAction): boolean {
  return ALLOWED[status].includes(action);
}

export class TimerInvariantError extends Error {
  override name = 'TimerInvariantError';
}

/**
 * Estado do cronômetro a partir das sessões e pausas do usuário.
 * Lança `TimerInvariantError` se houver mais de uma sessão ativa ou mais de
 * uma pausa aberta na sessão ativa (o banco deve impedir).
 */
export function deriveTimerState(
  sessions: readonly Session[],
  pauses: readonly SessionPause[],
): TimerState {
  const active = sessions.filter((s) => s.ended_at === null);
  if (active.length === 0) return { status: 'stopped' };
  if (active.length > 1) {
    throw new TimerInvariantError(
      `Mais de um cronômetro ativo: ${active.map((s) => s.id).join(', ')}`,
    );
  }
  const session = active[0]!;
  const own = pauses.filter((p) => p.session_id === session.id);
  const open = own.filter((p) => p.resumed_at === null);
  if (open.length > 1) {
    throw new TimerInvariantError(`Mais de uma pausa aberta na sessão ${session.id}`);
  }
  const openPause = open[0];
  return openPause
    ? { status: 'paused', session, pauses: own, openPause }
    : { status: 'running', session, pauses: own };
}

export type TimerCommand =
  | { action: 'start'; area_id: string; user_id: string }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'stop' };

/** O que gravar no banco para efetivar a transição. */
export type TimerEffect =
  | {
      type: 'create_session';
      session: Pick<Session, 'user_id' | 'area_id' | 'started_at' | 'ended_at' | 'source' | 'note'>;
    }
  | { type: 'create_pause'; pause: Pick<SessionPause, 'session_id' | 'paused_at' | 'resumed_at'> }
  | { type: 'close_pause'; pause_id: string; resumed_at: string }
  | {
      type: 'end_session';
      session_id: string;
      ended_at: string;
      /** Pausa aberta a fechar no mesmo instante (parar estando pausado). */
      close_pause: { pause_id: string; resumed_at: string } | null;
      net_ms: number;
      /** Líquido < 1 min: perguntar ao usuário se descarta. */
      confirm_discard: boolean;
    };

export type TimerResult =
  | { ok: true; effect: TimerEffect }
  | { ok: false; error: { code: 'invalid_transition'; from: TimerStatus; action: TimerAction } };

export function applyTimerCommand(
  state: TimerState,
  command: TimerCommand,
  now: Instant,
): TimerResult {
  if (!canTransition(state.status, command.action)) {
    return {
      ok: false,
      error: { code: 'invalid_transition', from: state.status, action: command.action },
    };
  }
  const at = toIso(toMs(now));

  if (command.action === 'start') {
    return {
      ok: true,
      effect: {
        type: 'create_session',
        session: {
          user_id: command.user_id,
          area_id: command.area_id,
          started_at: at,
          ended_at: null,
          source: 'timer',
          note: null,
        },
      },
    };
  }
  // Daqui em diante há sessão ativa (canTransition garante).
  if (state.status === 'stopped') throw new TimerInvariantError('Estado inconsistente');

  if (command.action === 'pause') {
    return {
      ok: true,
      effect: {
        type: 'create_pause',
        pause: { session_id: state.session.id, paused_at: at, resumed_at: null },
      },
    };
  }
  if (command.action === 'resume' && state.status === 'paused') {
    return {
      ok: true,
      effect: { type: 'close_pause', pause_id: state.openPause.id, resumed_at: at },
    };
  }

  // stop
  const net = netDurationMs(state.session, state.pauses, at);
  return {
    ok: true,
    effect: {
      type: 'end_session',
      session_id: state.session.id,
      ended_at: at,
      close_pause:
        state.status === 'paused' ? { pause_id: state.openPause.id, resumed_at: at } : null,
      net_ms: net,
      confirm_discard: shouldConfirmDiscard(net),
    },
  };
}

export function shouldConfirmDiscard(netMs: number): boolean {
  return netMs < MIN_SESSION_MS;
}

/** Tempo líquido do cronômetro agora (0 se parado). */
export function timerElapsedMs(state: TimerState, now: Instant): number {
  return state.status === 'stopped' ? 0 : netDurationMs(state.session, state.pauses, now);
}

/**
 * Há quanto tempo o cronômetro roda sem interação (desde o início ou a última
 * retomada). 0 se parado ou pausado.
 */
export function runningStretchMs(state: TimerState, now: Instant): number {
  if (state.status !== 'running') return 0;
  let since = toMs(state.session.started_at);
  for (const p of state.pauses) {
    if (p.resumed_at !== null) since = Math.max(since, toMs(p.resumed_at));
  }
  return Math.max(0, toMs(now) - since);
}

/** Aviso de esquecido: rodando sem interrupção há mais de 8 h. */
export function isForgotten(state: TimerState, now: Instant): boolean {
  return runningStretchMs(state, now) > FORGOTTEN_AFTER_MS;
}
