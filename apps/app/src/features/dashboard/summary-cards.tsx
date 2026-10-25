import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { PeriodSummary } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '@/lib/duration';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

/** Seta + variação em tempo e %. Cinza: subir ou descer não é bom nem ruim por si. */
export function Delta({ deltaMs, ratio }: { deltaMs: number; ratio: number | null }) {
  const { t } = useTranslation();
  const Icon = deltaMs > 0 ? ArrowUp : deltaMs < 0 ? ArrowDown : Minus;
  const sign = deltaMs > 0 ? '+' : deltaMs < 0 ? '−' : '';
  const pct = ratio === null ? null : `${Math.round(Math.abs(ratio) * 100)}%`;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Icon className="size-4" aria-hidden />
      <span>
        {sign}
        {formatDuration(Math.abs(deltaMs), t)}
        {pct ? ` (${sign}${pct})` : ''}
      </span>
    </span>
  );
}

export function SummaryCards({ summary }: { summary: PeriodSummary }) {
  const { t } = useTranslation();
  const { comparison, streaks } = summary;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label={t('dashboard.summary.total')}
        value={formatDuration(summary.totals.total_ms, t)}
      />
      <Stat
        label={t('dashboard.summary.average')}
        value={formatDuration(summary.daily_average_ms, t)}
        hint={t('dashboard.summary.averageHint')}
      />
      <Stat
        label={t('dashboard.summary.streak')}
        value={t('dashboard.summary.days', { count: streaks.current })}
        hint={t('dashboard.summary.longest', { count: streaks.longest })}
      />
      <Card>
        <CardContent className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t('dashboard.summary.comparison')}</span>
          <span className="text-lg font-semibold">
            <Delta deltaMs={comparison.delta_ms} ratio={comparison.change_ratio} />
          </span>
          <span className="text-xs text-muted-foreground">{t('dashboard.summary.vsPrevious')}</span>
        </CardContent>
      </Card>
    </div>
  );
}
