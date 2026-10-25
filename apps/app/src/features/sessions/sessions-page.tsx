import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  customPeriod,
  dayKey,
  monthPeriod,
  netDurationMs,
  todayPeriod,
  toMs,
  weekPeriod,
  type Period,
  type Session,
} from '@elaps/core';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog, type Catalog } from '@/data/catalog';
import {
  SessionConflictError,
  useCreateManualSession,
  useDeleteSession,
  useEditSession,
  useSessionList,
  type SessionInput,
} from '@/data/sessions';
import { useRecentAreaIds } from '@/data/timer';
import { useProfile } from '@/lib/profile';
import { DeleteSessionDialog } from '@/features/sessions/delete-session-dialog';
import { SessionFilters, type FilterState } from '@/features/sessions/session-filters';
import { SessionFormDialog } from '@/features/sessions/session-form-dialog';
import { SessionItem } from '@/features/sessions/session-item';
import { dayTitle, timeRange } from '@/features/sessions/session-time';
import { areaLookup } from '@/features/timer/catalog-lookup';
import { formatDuration, useNow } from '@/features/timer/time';

type FormTarget = { kind: 'add' } | { kind: 'edit'; session: Session };

function periodOf(filter: FilterState, now: number, timezone: string): Period | null {
  switch (filter.period) {
    case 'all':
      return null;
    case 'today':
      return todayPeriod(now, timezone);
    case 'week':
      return weekPeriod(now, timezone);
    case 'month':
      return monthPeriod(now, timezone);
    case 'custom':
      return customPeriod(filter.from, filter.to, timezone);
  }
}

function areaIdsOf(scope: string, catalog: Catalog | undefined): string[] | null {
  if (scope.startsWith('a:')) return [scope.slice(2)];
  if (scope.startsWith('g:')) {
    const groupId = scope.slice(2);
    return (catalog?.areas ?? []).filter((a) => a.group_id === groupId).map((a) => a.id);
  }
  return null;
}

export function SessionsPage() {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const catalog = useCatalog();
  const profile = useProfile();
  const recent = useRecentAreaIds();
  const timezone = profile.data?.timezone;

  const [filter, setFilter] = useState<FilterState>(() => ({
    period: 'all',
    from: '',
    to: '',
    scope: 'all',
  }));
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<Session | null>(null);

  // Período personalizado começa na semana atual.
  function changeFilter(next: FilterState) {
    if (next.period === 'custom' && timezone && (!next.from || !next.to)) {
      const week = weekPeriod(now, timezone);
      next = { ...next, from: week.first_day, to: dayKey(now, timezone) };
    }
    setFilter(next);
  }

  const period = timezone ? periodOf(filter, now, timezone) : null;
  const list = useSessionList({
    period,
    areaIds: areaIdsOf(filter.scope, catalog.data),
  });

  const create = useCreateManualSession();
  const edit = useEditSession();
  const remove = useDeleteSession();
  const busy = create.isPending || edit.isPending || remove.isPending;

  const lookup = useMemo(() => areaLookup(catalog.data), [catalog.data]);
  const areaName = (s: Session) => {
    const info = lookup(s.area_id);
    return info ? `${info.group?.name ?? ''} › ${info.area.name}` : '—';
  };

  // Páginas achatadas e agrupadas pelo dia (no fuso do perfil) do início.
  const days = useMemo(() => {
    if (!list.data || !timezone) return [];
    const pauses = list.data.pages.flatMap((p) => p.pauses);
    const byDay = new Map<string, Session[]>();
    for (const s of list.data.pages.flatMap((p) => p.sessions)) {
      const key = dayKey(toMs(s.started_at), timezone);
      byDay.set(key, [...(byDay.get(key) ?? []), s]);
    }
    return [...byDay].map(([key, sessions]) => ({ key, sessions, pauses }));
  }, [list.data, timezone]);

  function onError(error: Error) {
    if (error instanceof SessionConflictError) toast.info(t('sessions.conflict'));
    else toast.error(t('sessions.error'));
  }

  async function onSubmit(input: SessionInput) {
    try {
      if (form?.kind === 'edit') {
        await edit.mutateAsync({ id: form.session.id, ...input });
        toast.success(t('sessions.updated'));
      } else {
        await create.mutateAsync(input);
        toast.success(t('sessions.created'));
      }
      setForm(null);
    } catch (error) {
      onError(error as Error);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t('sessions.deleted'));
    } catch (error) {
      onError(error as Error);
    }
    setDeleting(null);
  }

  if (!catalog.data || !timezone) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('sessions.title')}</h1>
        <Button onClick={() => setForm({ kind: 'add' })}>
          <Plus /> {t('sessions.add')}
        </Button>
      </div>

      <SessionFilters value={filter} onChange={changeFilter} catalog={catalog.data} />

      {list.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t('sessions.loadError')}</p>
          <Button variant="outline" onClick={() => list.refetch()}>
            {t('sessions.retry')}
          </Button>
        </div>
      ) : !list.data ? (
        <Skeleton className="h-64 w-full" />
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('sessions.empty')}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(({ key, sessions, pauses }) => {
            const total = sessions.reduce((sum, s) => sum + netDurationMs(s, pauses, now), 0);
            return (
              <section key={key} aria-labelledby={`day-${key}`} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <h2 id={`day-${key}`} className="text-sm font-semibold first-letter:uppercase">
                    {dayTitle(key, now, timezone, {
                      today: t('sessions.today'),
                      yesterday: t('sessions.yesterday'),
                    })}
                  </h2>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatDuration(total, t)}
                  </span>
                </div>
                <ul className="flex flex-col divide-y rounded-lg border bg-card">
                  {sessions.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      pauses={pauses}
                      info={lookup(s.area_id)}
                      now={now}
                      timezone={timezone}
                      onEdit={() => setForm({ kind: 'edit', session: s })}
                      onDelete={() => setDeleting(s)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          {list.hasNextPage && (
            <Button
              variant="outline"
              className="self-center"
              disabled={list.isFetchingNextPage}
              onClick={() => list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? t('sessions.loading') : t('sessions.loadMore')}
            </Button>
          )}
        </div>
      )}

      {form && (
        <SessionFormDialog
          key={form.kind === 'edit' ? form.session.id : 'add'}
          session={form.kind === 'edit' ? form.session : undefined}
          catalog={catalog.data}
          recentAreaIds={recent.data ?? []}
          timezone={timezone}
          now={now}
          busy={busy}
          onCancel={() => setForm(null)}
          onSubmit={onSubmit}
        />
      )}
      {deleting && (
        <DeleteSessionDialog
          areaName={areaName(deleting)}
          range={timeRange(
            toMs(deleting.started_at),
            deleting.ended_at ? toMs(deleting.ended_at) : null,
            timezone,
            { inProgress: t('sessions.inProgress'), nextDay: t('sessions.nextDay') },
          )}
          duration={formatDuration(
            netDurationMs(deleting, list.data?.pages.flatMap((p) => p.pauses) ?? [], now),
            t,
          )}
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}
