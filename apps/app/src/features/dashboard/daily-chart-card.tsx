import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { DailyPoint, Group, MetricsInput } from '@elaps/core';
import { dailySeries } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { formatAxisDuration, formatDuration } from '@/lib/duration';
import type { Period } from '@elaps/core';
import type { Lookup } from '@/features/dashboard/lookup';

type Row = { date: string; total: number } & Record<string, number | string>;

const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const fullDay = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: 'UTC',
});

const MIN = 60_000;
const STEPS_MS = [
  15 * MIN,
  30 * MIN,
  60 * MIN,
  120 * MIN,
  180 * MIN,
  240 * MIN,
  360 * MIN,
  720 * MIN,
];

/** Marcas redondas (15 min, 30 min, 1 h, 2 h…) em até 5 intervalos a partir do zero. */
function niceTicks(maxMs: number): number[] {
  const step = STEPS_MS.find((s) => Math.ceil(maxMs / s) <= 5) ?? STEPS_MS[STEPS_MS.length - 1]!;
  const count = Math.max(1, Math.ceil(maxMs / step));
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

function utc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/** Uma fatia por grupo (a cor do grupo), um ponto por dia, com zeros. */
function buildRows(
  input: MetricsInput,
  period: Period,
  groupIds: string[],
): { rows: Row[]; totals: DailyPoint[] } {
  const totals = dailySeries(input, period);
  const rows: Row[] = totals.map((p) => ({ date: p.date, total: p.ms }));
  const byDate = new Map(rows.map((r) => [r.date, r]));
  for (const gid of groupIds) {
    const filtered: MetricsInput = {
      ...input,
      filter: {
        ...input.filter,
        group_ids: [gid],
      },
    };
    for (const p of dailySeries(filtered, period)) byDate.get(p.date)![gid] = p.ms;
  }
  return { rows, totals };
}

export function DailyChartCard({
  input,
  period,
  groups,
  lookup,
}: {
  input: MetricsInput;
  period: Period;
  groups: readonly Group[];
  lookup: Lookup;
}) {
  const { t } = useTranslation();

  // Grupos que têm tempo no período (ordem estável: a do catálogo, por nome).
  const { rows, ids } = useMemo(() => {
    // Um grupo filtrado por vez; o filtro de grupo do input restringe quais entram.
    const allowed = input.filter?.group_ids;
    const candidates = groups.map((g) => g.id).filter((id) => !allowed || allowed.includes(id));
    const { rows } = buildRows(input, period, candidates);
    // Grupos sem tempo no período não viram série.
    const used = candidates.filter((id) => rows.some((r) => ((r[id] as number) ?? 0) > 0));
    return { rows, ids: used };
  }, [input, period, groups]);

  const config: ChartConfig = Object.fromEntries(
    ids.map((id) => [id, { label: lookup.groupName(id), color: lookup.groupColor(id) }]),
  );
  const many = rows.length > 14;
  const ticks = niceTicks(Math.max(0, ...rows.map((r) => r.total)));

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('dashboard.daily.title')}</h2>
        <ChartContainer config={config} className="aspect-[4/3] w-full sm:aspect-video">
          <BarChart data={rows} margin={{ left: 0, right: 4, top: 8 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              interval={rows.length <= 7 ? 0 : 'preserveEnd'}
              minTickGap={many ? 16 : 4}
              tickFormatter={(k: string) =>
                rows.length <= 7 ? weekdayShort.format(utc(k)).replace('.', '') : k.slice(8)
              }
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]!]}
              tickFormatter={(v: number) => formatAxisDuration(v, t)}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]!.payload as Row;
                return (
                  <div className="grid min-w-40 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl">
                    <span className="font-medium capitalize">
                      {fullDay.format(utc(label as string))}
                    </span>
                    {ids
                      .filter((id) => ((row[id] as number) ?? 0) > 0)
                      .map((id) => (
                        <span key={id} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: lookup.groupColor(id) }}
                            />
                            {lookup.groupName(id)}
                          </span>
                          <span className="tabular-nums">
                            {formatDuration(row[id] as number, t)}
                          </span>
                        </span>
                      ))}
                    <span className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                      {t('dashboard.daily.total')}
                      <span className="tabular-nums">{formatDuration(row.total, t)}</span>
                    </span>
                  </div>
                );
              }}
            />
            {ids.map((id) => (
              <Bar
                key={id}
                dataKey={id}
                stackId="day"
                fill={lookup.groupColor(id)}
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={24}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {ids.map((id) => (
            <li key={id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: lookup.groupColor(id) }}
              />
              {lookup.groupName(id)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
