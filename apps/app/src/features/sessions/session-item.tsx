import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Hand, MoreVertical, Pencil, Timer, Trash2 } from 'lucide-react';
import { netDurationMs, toMs, type Session, type SessionPause } from '@elaps/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColorDot } from '@/features/timer/area-picker';
import type { AreaInfo } from '@/features/timer/catalog-lookup';
import { formatDuration } from '@/features/timer/time';
import { timeRange } from '@/features/sessions/session-time';

export function SessionItem({
  session,
  pauses,
  info,
  now,
  timezone,
  onEdit,
  onDelete,
}: {
  session: Session;
  pauses: SessionPause[];
  info: AreaInfo | undefined;
  now: number;
  timezone: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const active = session.ended_at === null;
  const start = toMs(session.started_at);
  const end = session.ended_at ? toMs(session.ended_at) : now;
  const net = netDurationMs(session, pauses, now);
  const paused = end - start - net;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <ColorDot color={info?.group?.color} />
          <span className="min-w-0 truncate text-sm font-medium">
            {info ? `${info.group?.name ?? ''} › ${info.area.name}` : '—'}
          </span>
          {session.source === 'manual' && (
            <span title={t('sessions.manual')} className="shrink-0 text-muted-foreground">
              <Hand className="size-3.5" aria-hidden />
              <span className="sr-only">{t('sessions.manual')}</span>
            </span>
          )}
          {active && <Badge variant="secondary">{t('sessions.inProgress')}</Badge>}
        </div>
        <p className="pl-4.5 text-xs text-muted-foreground tabular-nums">
          {timeRange(start, session.ended_at ? end : null, timezone, {
            inProgress: t('sessions.inProgress'),
            nextDay: t('sessions.nextDay'),
          })}
          {paused >= 60_000 &&
            ` · ${t('sessions.paused', { duration: formatDuration(paused, t) })}`}
        </p>
        {session.note && <p className="pl-4.5 text-sm break-words">{session.note}</p>}
      </div>
      <span className="pt-0.5 text-sm tabular-nums">{formatDuration(net, t)}</span>
      {active ? (
        <Button asChild size="icon" variant="ghost" className="-my-1 size-8">
          <Link to="/" aria-label={t('sessions.openTimer')} title={t('sessions.openTimer')}>
            <Timer />
          </Link>
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="-my-1 size-8"
              aria-label={t('sessions.actions')}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> {t('sessions.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> {t('sessions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
