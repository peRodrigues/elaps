import { useTranslation } from 'react-i18next';
import { netDurationMs, toMs } from '@elaps/core';
import { tagIdsBySession, useTags } from '@/data/tags';
import type { SessionsWithPauses } from '@/data/timer';
import { TagChips } from '@/features/timer/tag-picker';
import { ColorDot } from '@/features/timer/area-picker';
import type { AreaInfo } from '@/features/timer/catalog-lookup';
import { formatDuration, formatTime } from '@/features/timer/time';

/** Total de hoje e a lista curta das sessões do dia (mais recente primeiro). */
export function TodaySessions({
  data,
  totalMs,
  now,
  timezone,
  lookup,
}: {
  data: SessionsWithPauses;
  totalMs: number;
  now: number;
  timezone: string;
  lookup: (areaId: string) => AreaInfo | undefined;
}) {
  const { t } = useTranslation();
  const tags = useTags();
  const tagIds = tagIdsBySession(data.tags);
  return (
    <section aria-labelledby="today-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="today-title" className="text-lg font-semibold">
          {t('timer.today.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('timer.today.total')}:{' '}
          <span className="font-semibold text-foreground tabular-nums">
            {formatDuration(totalMs, t)}
          </span>
        </p>
      </div>
      {data.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('timer.today.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {data.sessions.map((session) => {
            const info = lookup(session.area_id);
            const start = formatTime(toMs(session.started_at), timezone);
            const end = session.ended_at
              ? formatTime(toMs(session.ended_at), timezone)
              : t('timer.today.inProgress');
            return (
              <li key={session.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ColorDot color={info?.group?.color} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {info?.group?.name} › {info?.area.name}
                  </span>
                  <span className="text-sm tabular-nums">
                    {formatDuration(netDurationMs(session, data.pauses, now), t)}
                  </span>
                </div>
                <p className="pl-4.5 text-xs text-muted-foreground tabular-nums">
                  {start} – {end}
                </p>
                {session.note && <p className="pl-4.5 text-sm">{session.note}</p>}
                <TagChips tagIds={tagIds.get(session.id)} tags={tags.data} className="pl-4.5" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
