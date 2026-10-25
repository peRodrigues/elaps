import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import type { Totals } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';
import type { Lookup } from '@/features/dashboard/lookup';

/** Barra proporcional ao maior item da lista (a cor é a do grupo). */
function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted" aria-hidden>
      <div
        className="h-2 rounded-full"
        style={{ width: `${Math.max(2, ratio * 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function TotalsCard({ totals, lookup }: { totals: Totals; lookup: Lookup }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const maxGroup = Math.max(1, ...totals.groups.map((g) => g.ms));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="font-semibold">{t('dashboard.totals.title')}</h2>
        <ul className="flex flex-col gap-3">
          {totals.groups.map((g) => {
            const id = g.group_id ?? '_none';
            const expanded = open.has(id);
            const color = lookup.groupColor(g.group_id);
            const maxArea = Math.max(1, ...g.areas.map((a) => a.ms));
            return (
              <li key={id} className="flex flex-col gap-2">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpen((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(id)) next.add(id);
                      return next;
                    })
                  }
                  className="flex flex-col gap-1.5 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 transition-transform',
                          !expanded && '-rotate-90',
                        )}
                        aria-hidden
                      />
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate font-medium">{lookup.groupName(g.group_id)}</span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">
                      {formatDuration(g.ms, t)}
                    </span>
                  </span>
                  <Bar ratio={g.ms / maxGroup} color={color} />
                </button>
                {expanded && (
                  <ul className="flex flex-col gap-2 pl-6">
                    {g.areas.map((a) => (
                      <li key={a.area_id} className="flex flex-col gap-1">
                        <span className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-muted-foreground">
                            {lookup.areaName(a.area_id)}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums">
                            {formatDuration(a.ms, t)}
                          </span>
                        </span>
                        <Bar ratio={a.ms / maxArea} color={color} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
