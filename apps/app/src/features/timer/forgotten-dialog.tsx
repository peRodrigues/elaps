import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { runningStretchMs, toMs, type TimerState } from '@elaps/core';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDuration, formatTime, fromWallTime, toWallTime } from '@/features/timer/time';

const HOUR = 3_600_000;

/**
 * Aviso de cronômetro esquecido (> 8 h rodando sem interrupção). Nunca para
 * sozinho: o usuário mantém ou escolhe o horário de término.
 */
export function ForgottenDialog({
  state,
  now,
  timezone,
  busy,
  onKeep,
  onAdjust,
}: {
  state: Extract<TimerState, { status: 'running' }>;
  now: number;
  timezone: string;
  busy: boolean;
  onKeep: () => void;
  onAdjust: (endedAt: number) => void;
}) {
  const { t } = useTranslation();
  const startedAt = toMs(state.session.started_at);
  const stretch = runningStretchMs(state, now);
  // Sugestão: 1 h depois da última interação (início ou retomada).
  const [value, setValue] = useState(() =>
    toWallTime(Math.min(now, now - stretch + HOUR), timezone),
  );
  const endedAt = fromWallTime(value, timezone);
  const valid = Number.isFinite(endedAt) && endedAt > startedAt && endedAt <= now;

  return (
    <Dialog open onOpenChange={(next) => !next && onKeep()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onAdjust(endedAt);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('timer.forgotten.title')}</DialogTitle>
            <DialogDescription>
              {t('timer.forgotten.description', { duration: formatDuration(stretch, t) })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timer-end">{t('timer.forgotten.endLabel')}</Label>
            <Input
              id="timer-end"
              type="datetime-local"
              value={value}
              min={toWallTime(startedAt, timezone)}
              max={toWallTime(now, timezone)}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!valid}
            />
            {!valid && (
              <p className="text-sm text-destructive">
                {t('timer.forgotten.invalidEnd', { start: formatTime(startedAt, timezone) })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onKeep}>
              {t('timer.forgotten.keep')}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {t('timer.forgotten.adjust')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
