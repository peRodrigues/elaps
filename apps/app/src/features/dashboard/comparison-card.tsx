import { useTranslation } from 'react-i18next';
import type { Comparison } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '@/lib/duration';
import { Delta } from '@/features/dashboard/summary-cards';
import type { Lookup } from '@/features/dashboard/lookup';

export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(Date.UTC(y!, m! - 1, d!));
}

export function ComparisonCard({ comparison, lookup }: { comparison: Comparison; lookup: Lookup }) {
  const { t } = useTranslation();
  const prev = comparison.previous_period;
  const groups = [...comparison.groups].sort(
    (a, b) => b.current_ms + b.previous_ms - (a.current_ms + a.previous_ms),
  );
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">{t('dashboard.comparison.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.comparison.previous', {
              from: dayLabel(prev.first_day),
              to: dayLabel(prev.last_day),
              total: formatDuration(comparison.previous.total_ms, t),
            })}
          </p>
        </div>
        <p className="text-lg font-semibold">
          <Delta deltaMs={comparison.delta_ms} ratio={comparison.change_ratio} />
          {comparison.change_ratio === null && comparison.current.total_ms > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t('dashboard.comparison.noBase')}
            </span>
          )}
        </p>
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li
              key={g.group_id ?? '_none'}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: lookup.groupColor(g.group_id) }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{lookup.groupName(g.group_id)}</span>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    {formatDuration(g.current_ms, t)} · {formatDuration(g.previous_ms, t)}
                  </span>
                </span>
              </span>
              <Delta
                deltaMs={g.delta_ms}
                ratio={g.previous_ms === 0 ? null : g.delta_ms / g.previous_ms}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
