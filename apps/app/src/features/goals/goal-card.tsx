import { useTranslation } from 'react-i18next';
import { Archive, Check, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { GoalPeriodProgress, GoalProgress } from '@elaps/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { GoalLabel } from '@/features/goals/goal-label';
import { periodLabel } from '@/features/goals/goal-label';
import { formatDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';

/** Cor da barra: a do grupo, ou a primária no total. */
const barColor = (label: GoalLabel) => label.color ?? 'var(--primary)';

/** Mini-barras dos períodos anteriores: altura = % do alvo (até 100). */
function History({ progress, label }: { progress: GoalProgress; label: GoalLabel }) {
  const { t } = useTranslation();
  const { history, met_count, goal } = progress;
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('goals.history.none')}</p>;
  }
  return (
    <div className="flex items-end justify-between gap-3">
      <ol
        className="flex h-8 items-end gap-1"
        aria-label={t(`goals.history.${goal.period}`, { met: met_count, total: history.length })}
      >
        {history.map((h: GoalPeriodProgress) => (
          <li
            key={h.period.first_day}
            className="relative flex h-full w-3 items-end overflow-hidden rounded-sm bg-muted"
            title={t(h.met ? 'goals.history.dotMet' : 'goals.history.dotMissed', {
              label: periodLabel(goal.period, h.period.first_day, t),
              done: formatDuration(h.done_ms, t),
              target: formatDuration(h.target_ms, t),
            })}
          >
            <span
              aria-hidden
              className={cn('w-full rounded-sm', !h.met && 'opacity-40')}
              style={{
                height: `${Math.max(6, Math.min(1, h.ratio) * 100)}%`,
                backgroundColor: barColor(label),
              }}
            />
          </li>
        ))}
      </ol>
      <p className="text-right text-xs text-muted-foreground">
        {t(`goals.history.${goal.period}`, { met: met_count, total: history.length })}
      </p>
    </div>
  );
}

export function GoalCard({
  progress,
  label,
  onEdit,
  onArchive,
  onDelete,
}: {
  progress: GoalProgress;
  label: GoalLabel;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { goal, current } = progress;
  const percent = Math.floor(current.ratio * 100);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className={cn(
                'size-4 shrink-0 rounded-full',
                !label.color && 'border-2 border-primary',
              )}
              style={label.color ? { backgroundColor: label.color } : undefined}
            />
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{label.name}</h2>
              <p className="truncate text-xs text-muted-foreground">
                {[label.context, t(`goals.period.${goal.period}`)].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('goals.actions')}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> {t('goals.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onArchive}>
                <Archive /> {t('goals.archive')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 /> {t('goals.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="tabular-nums">
              {t('goals.progress', {
                done: formatDuration(current.done_ms, t),
                target: formatDuration(current.target_ms, t),
              })}
            </span>
            <span className="font-semibold tabular-nums">
              {t('goals.percent', { value: percent })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={label.name}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, percent)}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.min(1, current.ratio) * 100}%`,
                backgroundColor: barColor(label),
              }}
            />
          </div>
          <p
            className={cn(
              'flex items-center gap-1 text-xs',
              current.met ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {current.met ? (
              <>
                <Check className="size-3.5" /> {t('goals.met')}
              </>
            ) : (
              t('goals.remaining', { time: formatDuration(current.remaining_ms, t) })
            )}
          </p>
        </div>

        <History progress={progress} label={label} />
      </CardContent>
    </Card>
  );
}
