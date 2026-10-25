import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
  isEmptyPlan,
  pomodoroState,
  skipPomodoroPhase,
  toMs,
  type PomodoroPhase,
  type PomodoroPlan,
  type SessionMode,
  type TimerState,
} from '@elaps/core';
import { TimerConflictError, useApplyPomodoro } from '@/data/timer';

// Pomodoro no cronômetro: a fase sai do @elaps/core; aqui só se grava o plano
// (viradas devidas) pela RPC e se avisa nas viradas.

const MODE_KEY = 'elaps.timer.mode';

/** Último modo escolhido ao iniciar (só neste aparelho). */
export function useStoredMode(): [SessionMode, (mode: SessionMode) => void] {
  const [mode, setMode] = useState<SessionMode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'pomodoro' ? 'pomodoro' : 'free';
    } catch {
      return 'free';
    }
  });
  const update = (next: SessionMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
  };
  return [mode, update];
}

/** Pede permissão de notificação uma vez (no clique de iniciar um pomodoro). */
export function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => undefined);
  }
}

/** Bipe curto pelo Web Audio (sem arquivo de som). */
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => void ctx.close();
  } catch {
    // Sem áudio (navegador bloqueou): só a notificação.
  }
}

export function phaseLabel(phase: PomodoroPhase, t: TFunction): string {
  if (phase.kind === 'focus') {
    return t(phase.paused ? 'pomodoro.phase.focusPaused' : 'pomodoro.phase.focus', {
      index: phase.cycle_index,
      size: phase.cycle_size,
    });
  }
  return t(`pomodoro.phase.${phase.kind}`);
}

function announce(phase: PomodoroPhase, t: TFunction) {
  beep();
  // Com a tela à vista o bipe basta; a notificação é para a aba em segundo plano.
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    document.visibilityState === 'visible'
  ) {
    return;
  }
  const min = Math.round(phase.length_ms / 60_000);
  const title = t(`pomodoro.notify.${phase.kind}`);
  const body =
    phase.kind === 'focus'
      ? t('pomodoro.notify.focusBody', { index: phase.cycle_index, size: phase.cycle_size, min })
      : t('pomodoro.notify.breakBody', { min });
  try {
    new Notification(title, { body, tag: 'elaps-pomodoro' });
  } catch {
    // Alguns navegadores móveis só notificam por service worker: fica o bipe.
  }
}

/**
 * Virada recente o bastante para avisar (não as de horas atrás, da
 * reconciliação). Folgado porque a aba em segundo plano roda o relógio devagar.
 */
const LIVE_MS = 90_000;

function lastTransitionMs(plan: PomodoroPlan): number | null {
  const times: number[] = [];
  if (plan.close_open_at) times.push(toMs(plan.close_open_at));
  for (const b of plan.new_pauses) {
    times.push(toMs(b.paused_at));
    if (b.resumed_at) times.push(toMs(b.resumed_at));
  }
  return times.length ? Math.max(...times) : null;
}

/**
 * Fase do pomodoro da sessão ativa (null no modo livre) e "Pular fase". Grava
 * sozinho as viradas devidas, com os horários exatos: no limite do relógio, ao
 * abrir e ao voltar do segundo plano (o cronômetro recarrega ao focar).
 */
export function usePomodoro(state: TimerState, now: number) {
  const { t } = useTranslation();
  const apply = useApplyPomodoro();
  const tried = useRef<string | null>(null);
  const announced = useRef<string | null>(null);

  const session = state.status === 'stopped' ? null : state.session;
  const config = session?.mode === 'pomodoro' ? session.pomodoro_config : null;
  const pauses = state.status === 'stopped' ? [] : state.pauses;
  const pomo = session && config ? pomodoroState(session, pauses, config, now) : null;

  const planKey =
    session && pomo && !isEmptyPlan(pomo.plan)
      ? `${session.id}:${JSON.stringify(pomo.plan)}`
      : null;

  useEffect(() => {
    if (!session || !pomo || !planKey || apply.isPending || tried.current === planKey) return;
    tried.current = planKey;
    const last = lastTransitionMs(pomo.plan);
    const live = last !== null && Date.now() - last < LIVE_MS;
    apply.mutate(
      { sessionId: session.id, plan: pomo.plan },
      {
        onSuccess: () => {
          const key = `${session.id}:${pomo.phase.kind}:${pomo.phase.focus_count}`;
          if (live && announced.current !== key) {
            announced.current = key;
            announce(pomo.phase, t);
          }
        },
        // Conflito: outro aparelho gravou antes; o recarregamento recalcula.
        // Outro erro (rede): tenta de novo daqui a pouco.
        onError: (error) => {
          if (error instanceof TimerConflictError) return;
          toast.error(t('timer.error'));
          setTimeout(() => {
            if (tried.current === planKey) tried.current = null;
          }, 5_000);
        },
      },
    );
  }, [planKey, session, pomo, apply, t]);

  async function skip() {
    if (!session || !config || state.status === 'stopped') return;
    const plan = skipPomodoroPhase(session, state.pauses, config, Date.now());
    if (!plan) return;
    try {
      await apply.mutateAsync({ sessionId: session.id, plan });
    } catch (error) {
      if (error instanceof TimerConflictError) toast.info(t('timer.conflict'));
      else toast.error(t('timer.error'));
    }
  }

  return {
    phase: pomo?.phase ?? null,
    /** Viradas devidas ainda não gravadas (gravar antes de parar). */
    pendingPlan: pomo && !isEmptyPlan(pomo.plan) ? pomo.plan : null,
    skip,
    applyPlan: (plan: PomodoroPlan) => apply.mutateAsync({ sessionId: session!.id, plan }),
    busy: apply.isPending,
  };
}
