import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { GoalPeriodProgress } from '@elaps/core';
import type { GoalLabel } from '@/features/goals/goal-label';
import { formatDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';

/**
 * Progresso de uma meta num período: nome, feito/alvo, barra e quanto falta (ou o
 * check de meta batida). `compact` = barra fina, para o Cronômetro e o Dashboard.
 */
export function GoalBar({
  label,
  period,
  progress,
  compact = false,
}: {
  label: GoalLabel;
  /** "por dia", "por semana"… (já traduzido). */
  period: string;
  progress: GoalPeriodProgress;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const color = label.color ?? 'var(--primary)';
  const percent = Math.floor(progress.ratio * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'size-2.5 shrink-0 self-center rounded-full',
              !label.color && 'bg-primary',
            )}
            style={label.color ? { backgroundColor: label.color } : undefined}
          />
          <span className="truncate font-medium">{label.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{period}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground font-mono tabular-nums">
          {t('goals.progress', {
            done: formatDuration(progress.done_ms, t),
            target: formatDuration(progress.target_ms, t),
          })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label.name} ${period}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        className={cn('overflow-hidden rounded-full bg-muted', compact ? 'h-1.5' : 'h-2.5')}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(1, progress.ratio) * 100}%`, backgroundColor: color }}
        />
      </div>
      <p
        className={cn(
          'flex items-center gap-1 text-xs',
          progress.met ? 'font-medium text-foreground' : 'text-muted-foreground',
        )}
      >
        {progress.met ? (
          <>
            <Check className="size-3.5" /> {t('goals.met')}
          </>
        ) : (
          t('goals.remaining', { time: formatDuration(progress.remaining_ms, t) })
        )}
      </p>
    </div>
  );
}
