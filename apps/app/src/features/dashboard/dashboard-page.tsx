import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DateRange } from 'react-day-picker';
import {
  customPeriod,
  dailySeries,
  dayKey,
  monthPeriod,
  summarizePeriod,
  todayPeriod,
  weekPeriod,
  type MetricsInput,
  type Period,
} from '@elaps/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/data/catalog';
import { tagIdsBySession, useTags } from '@/data/tags';
import { streakWindow, useDashboardSessions, useStreakSessions } from '@/data/dashboard';
import { ComparisonCard, dayLabel } from '@/features/dashboard/comparison-card';
import { DailyChartCard } from '@/features/dashboard/daily-chart-card';
import { GoalsCard } from '@/features/dashboard/goals-card';
import { HeatmapCard } from '@/features/dashboard/heatmap-card';
import { useLookup } from '@/features/dashboard/lookup';
import {
  fromDayKey,
  PeriodPicker,
  toDayKey,
  type PeriodKind,
} from '@/features/dashboard/period-picker';
import { SummaryCards } from '@/features/dashboard/summary-cards';
import { TagsCard, tagTotals } from '@/features/dashboard/tags-card';
import { TagFilter } from '@/features/timer/tag-picker';
import { TotalsCard } from '@/features/dashboard/totals-card';
import { ShareDialog } from '@/features/share/share-dialog';
import { useProfile } from '@/lib/profile';

const ALL = 'all';

/** Relógio que anda a cada minuto: a sessão ativa e o "hoje" acompanham sem recarregar. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const catalog = useCatalog();
  const lookup = useLookup(catalog.data);
  const now = useNow();
  const timezone = profile.data?.timezone;

  const [kind, setKind] = useState<PeriodKind>('week');
  const [range, setRange] = useState<DateRange | undefined>();
  const [groupId, setGroupId] = useState(ALL);
  const [areaId, setAreaId] = useState(ALL);
  const [sharing, setSharing] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const tags = useTags();

  const todayKey = timezone ? dayKey(now, timezone) : null;

  const period: Period | null = useMemo(() => {
    if (!timezone || !todayKey) return null;
    const at = now;
    if (kind === 'day') return todayPeriod(at, timezone);
    if (kind === 'week') return weekPeriod(at, timezone);
    if (kind === 'month') return monthPeriod(at, timezone);
    const first = range?.from ? toDayKey(range.from) : dayKey(at - 13 * 86_400_000, timezone);
    const last = range?.to ? toDayKey(range.to) : range?.from ? first : todayKey;
    return customPeriod(first <= last ? first : last, first <= last ? last : first, timezone);
  }, [kind, range, timezone, todayKey, now]);

  const histWindow = useMemo(
    () => (timezone && todayKey ? streakWindow(now, timezone) : null),
    [timezone, todayKey, now],
  );

  const sessions = useDashboardSessions(period);
  const streakSessions = useStreakSessions(histWindow);

  const groups = catalog.data?.groups ?? [];
  const areas = catalog.data?.areas ?? [];
  const groupAreas = areas.filter((a) => a.group_id === groupId);

  const filter = useMemo(
    () => ({
      group_ids: groupId === ALL ? undefined : [groupId],
      area_ids: areaId === ALL ? undefined : [areaId],
    }),
    [groupId, areaId],
  );

  const view = useMemo(() => {
    if (!period || !sessions.data || !streakSessions.data || !catalog.data || !histWindow)
      return null;
    const base = { areas: catalog.data.areas, groups: catalog.data.groups, now, filter };
    // Filtro por tag: só as sessões com alguma das tags entram nas métricas.
    const idsOf = tagIdsBySession(sessions.data.tags);
    const kept =
      tagFilter.length === 0
        ? sessions.data.sessions
        : sessions.data.sessions.filter((s) =>
            idsOf.get(s.id)?.some((id) => tagFilter.includes(id)),
          );
    const input: MetricsInput = { sessions: kept, pauses: sessions.data.pauses, ...base };
    const streakInput: MetricsInput = {
      sessions: streakSessions.data.sessions,
      pauses: streakSessions.data.pauses,
      ...base,
    };
    const streakSeries = dailySeries(streakInput, histWindow);
    return { input, summary: summarizePeriod(input, period, { streakSeries }) };
  }, [
    period,
    sessions.data,
    streakSessions.data,
    catalog.data,
    histWindow,
    now,
    filter,
    tagFilter,
  ]);

  const rangeLabel = period
    ? period.days === 1
      ? dayLabel(period.first_day)
      : t('dashboard.period.range', {
          from: dayLabel(period.first_day),
          to: dayLabel(period.last_day),
        })
    : '';

  const loading =
    profile.isPending || catalog.isPending || sessions.isPending || streakSessions.isPending;
  const failed = profile.isError || catalog.isError || sessions.isError || streakSessions.isError;

  let body;
  if (failed) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {t('dashboard.loadError')}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void sessions.refetch();
            void streakSessions.refetch();
            void catalog.refetch();
          }}
        >
          {t('dashboard.retry')}
        </Button>
      </div>
    );
  } else if (loading || !view) {
    body = (
      <div className="flex flex-col gap-3" aria-busy>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  } else if (view.summary.totals.total_ms === 0) {
    body = (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <h2 className="font-semibold">{t('dashboard.empty.title')}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{t('dashboard.empty.body')}</p>
          <Button asChild>
            <Link to="/">{t('dashboard.empty.cta')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    const { summary, input } = view;
    body = (
      <>
        <SummaryCards summary={summary} />
        <GoalsCard
          kind={kind === 'custom' ? 'custom' : summary.period.kind}
          period={summary.period}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <TotalsCard totals={summary.totals} lookup={lookup} />
          <ComparisonCard comparison={summary.comparison} lookup={lookup} />
        </div>
        <DailyChartCard input={input} period={summary.period} groups={groups} lookup={lookup} />
        <TagsCard
          rows={tagTotals(input, summary.period, tags.data ?? [], sessions.data?.tags ?? [])}
        />
        <HeatmapCard heatmap={summary.heatmap} />
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('pages.dashboard.title')}</h1>
        <Button
          variant="outline"
          disabled={!view || view.summary.totals.total_ms === 0}
          onClick={() => setSharing(true)}
        >
          <Share2 /> {t('share.button')}
        </Button>
      </div>

      <PeriodPicker
        kind={kind}
        onKind={setKind}
        range={
          range ??
          (period
            ? { from: fromDayKey(period.first_day), to: fromDayKey(period.last_day) }
            : undefined)
        }
        onRange={setRange}
        rangeLabel={rangeLabel}
      />

      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <Select
          value={groupId}
          onValueChange={(v) => {
            setGroupId(v);
            setAreaId(ALL);
          }}
        >
          <SelectTrigger className="w-full" aria-label={t('dashboard.filter.group')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('dashboard.filter.allGroups')}</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={areaId} onValueChange={setAreaId} disabled={groupId === ALL}>
          <SelectTrigger className="w-full" aria-label={t('dashboard.filter.area')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('dashboard.filter.allAreas')}</SelectItem>
            {groupAreas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="sm:max-w-md">
        <TagFilter value={tagFilter} onChange={setTagFilter} />
      </div>

      {body}
      {sharing && view && catalog.data && period && (
        <ShareDialog
          summary={view.summary}
          catalog={catalog.data}
          label={
            period.days === 1
              ? t('share.label.day', { day: dayLabel(period.first_day) })
              : t(period.kind === 'week' ? 'share.label.week' : 'share.label.range', {
                  from: dayLabel(period.first_day),
                  to: dayLabel(period.last_day),
                })
          }
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
