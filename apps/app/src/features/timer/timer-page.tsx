import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import {
  applyTimerCommand,
  isForgotten,
  timerElapsedMs,
  todayPeriod,
  totals,
  type TimerState,
} from '@elaps/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/data/catalog';
import {
  TimerConflictError,
  useAdjustEnd,
  useDiscardSession,
  useRecentAreaIds,
  useTimer,
  useTimerCommand,
  useTodaySessions,
} from '@/data/timer';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { AreaPicker, ColorDot } from '@/features/timer/area-picker';
import { areaLookup, pickerGroups } from '@/features/timer/catalog-lookup';
import { ForgottenDialog } from '@/features/timer/forgotten-dialog';
import { ShortSessionDialog, StopDialog } from '@/features/timer/stop-dialogs';
import { formatClock, formatTime, useNow } from '@/features/timer/time';
import { TodaySessions } from '@/features/timer/today-sessions';

/** Parar congela o instante do clique; o diálogo só decide o que gravar. */
interface Stopping {
  at: number;
  netMs: number;
  short: boolean;
}

export function TimerPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const now = useNow(1000);
  const timer = useTimer();
  const catalog = useCatalog();
  const profile = useProfile();
  const timezone = profile.data?.timezone;
  const today = useTodaySessions(timezone, now);
  const recent = useRecentAreaIds();

  const command = useTimerCommand();
  const discard = useDiscardSession();
  const adjust = useAdjustEnd();
  const busy = command.isPending || discard.isPending || adjust.isPending;

  const [selected, setSelected] = useState<string>();
  const [stopping, setStopping] = useState<Stopping | null>(null);
  const [keptForgotten, setKeptForgotten] = useState<string | null>(null);

  // "Manter" vale até a próxima vez que o app ganhar foco.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && setKeptForgotten(null);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const lookup = useMemo(() => areaLookup(catalog.data), [catalog.data]);
  const options = useMemo(
    () => (catalog.data ? pickerGroups(catalog.data, recent.data ?? []) : []),
    [catalog.data, recent.data],
  );
  const areaId = selected ?? options[0]?.areas[0]?.id;

  function onError(error: Error) {
    if (error instanceof TimerConflictError) toast.info(t('timer.conflict'));
    else toast.error(t('timer.error'));
  }

  if (timer.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{t('timer.loadError')}</p>
        <Button variant="outline" onClick={() => timer.refetch()}>
          {t('timer.retry')}
        </Button>
      </div>
    );
  }
  if (!timer.data || !catalog.data || !timezone) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const state: TimerState = timer.data;
  const active = state.status === 'stopped' ? null : state;
  const activeInfo = active && lookup(active.session.area_id);
  const activeName = activeInfo ? `${activeInfo.group?.name ?? ''} › ${activeInfo.area.name}` : '';

  const todayTotal = today.data
    ? totals(
        { ...today.data, areas: catalog.data.areas, groups: catalog.data.groups, now },
        todayPeriod(now, timezone),
      ).total_ms
    : 0;

  const run = (cmd: Parameters<typeof applyTimerCommand>[1], note?: string | null) =>
    command.mutateAsync({ state, command: cmd, at: Date.now(), note }).catch(onError);

  function onStop() {
    const at = Date.now();
    const result = applyTimerCommand(state, { action: 'stop' }, at);
    if (!result.ok || result.effect.type !== 'end_session') {
      onError(new TimerConflictError('stop'));
      void timer.refetch();
      return;
    }
    setStopping({ at, netMs: result.effect.net_ms, short: result.effect.confirm_discard });
  }

  async function onSave(note: string | null) {
    if (!stopping) return;
    try {
      await command.mutateAsync({ state, command: { action: 'stop' }, at: stopping.at, note });
      toast.success(t('timer.saved'));
    } catch (error) {
      onError(error as Error);
    }
    setStopping(null);
  }

  async function onDiscard() {
    if (!active) return;
    try {
      await discard.mutateAsync(active.session.id);
      toast.success(t('timer.discarded'));
    } catch (error) {
      onError(error as Error);
    }
    setStopping(null);
  }

  const showForgotten =
    state.status === 'running' &&
    !stopping &&
    keptForgotten !== state.session.id &&
    isForgotten(state, now);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t('timer.title')}</h1>

      <Card>
        <CardContent className="flex flex-col gap-6">
          {active ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <ColorDot color={activeInfo?.group?.color} />
                  <span className="truncate">{activeName}</span>
                </span>
                <Badge variant={active.status === 'paused' ? 'secondary' : 'default'}>
                  {t(active.status === 'paused' ? 'timer.paused' : 'timer.running')}
                </Badge>
              </div>
              <p
                role="timer"
                aria-live="off"
                className={`text-center text-6xl font-semibold tabular-nums sm:text-7xl ${
                  active.status === 'paused' ? 'text-muted-foreground' : ''
                }`}
              >
                {formatClock(timerElapsedMs(state, now))}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {active.status === 'running' ? (
                  <Button
                    size="lg"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run({ action: 'pause' })}
                  >
                    <Pause /> {t('timer.pause')}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run({ action: 'resume' })}
                  >
                    <Play /> {t('timer.resume')}
                  </Button>
                )}
                <Button size="lg" disabled={busy} onClick={onStop}>
                  <Square /> {t('timer.stop')}
                </Button>
              </div>
            </>
          ) : options.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">{t('timer.noAreas')}</p>
              <Button asChild variant="outline">
                <Link to="/grupos">{t('timer.goToGroups')}</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="text-center text-6xl font-semibold text-muted-foreground tabular-nums sm:text-7xl">
                {formatClock(0)}
              </p>
              <AreaPicker options={options} value={areaId} onChange={setSelected} />
              <Button
                size="lg"
                className="h-12 text-base"
                disabled={busy || !areaId || !user}
                onClick={() =>
                  areaId && user && run({ action: 'start', area_id: areaId, user_id: user.id })
                }
              >
                <Play /> {t('timer.start')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {today.data && (
        <TodaySessions
          data={today.data}
          totalMs={todayTotal}
          now={now}
          timezone={timezone}
          lookup={lookup}
        />
      )}

      {active && stopping && !stopping.short && (
        <StopDialog
          open
          areaName={activeName}
          netMs={stopping.netMs}
          busy={busy}
          onCancel={() => setStopping(null)}
          onSave={onSave}
        />
      )}
      {active && stopping?.short && (
        <ShortSessionDialog
          open
          netMs={stopping.netMs}
          busy={busy}
          onCancel={() => setStopping(null)}
          onDiscard={onDiscard}
          onSave={() => onSave(null)}
        />
      )}
      {showForgotten && (
        <ForgottenDialog
          key={state.session.id}
          state={state}
          now={now}
          timezone={timezone}
          busy={busy}
          onKeep={() => setKeptForgotten(state.session.id)}
          onAdjust={(endedAt) =>
            adjust
              .mutateAsync({ session: state.session, endedAt })
              .then(() =>
                toast.success(
                  t('timer.forgotten.adjusted', { time: formatTime(endedAt, timezone) }),
                ),
              )
              .catch(onError)
          }
        />
      )}
    </div>
  );
}
