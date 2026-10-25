import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { dayKey, toIso, toMs, type Session } from '@elaps/core';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { Catalog } from '@/data/catalog';
import type { SessionInput } from '@/data/sessions';
import { AreaPicker } from '@/features/timer/area-picker';
import { pickerGroups } from '@/features/timer/catalog-lookup';
import { nextDayKey } from '@/features/sessions/session-time';
import { formatTime, fromWallTime } from '@/features/timer/time';

type Mode = 'end' | 'duration';

interface Fields {
  areaId: string | undefined;
  date: string;
  start: string;
  end: string;
  minutes: string;
  note: string;
}

/**
 * Lançar (session = undefined) ou editar uma sessão encerrada. Horários no fuso
 * do perfil; fim antes do início = termina no dia seguinte.
 */
export function SessionFormDialog({
  session,
  catalog,
  recentAreaIds,
  timezone,
  now,
  busy,
  onCancel,
  onSubmit,
}: {
  session?: Session;
  catalog: Catalog;
  recentAreaIds: readonly string[];
  timezone: string;
  now: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: SessionInput) => void;
}) {
  const { t } = useTranslation();
  const editing = !!session;

  const [initial] = useState<Fields>(() => {
    if (session) {
      const start = toMs(session.started_at);
      return {
        areaId: session.area_id,
        date: dayKey(start, timezone),
        start: formatTime(start, timezone),
        end: session.ended_at ? formatTime(toMs(session.ended_at), timezone) : '',
        minutes: '30',
        note: session.note ?? '',
      };
    }
    return {
      areaId: undefined,
      date: dayKey(now, timezone),
      start: '',
      end: '',
      minutes: '30',
      note: '',
    };
  });

  const [fields, setFields] = useState(initial);
  const [mode, setMode] = useState<Mode>('end');
  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  const options = useMemo(() => {
    const groups = pickerGroups(catalog, recentAreaIds);
    // Sessão de área arquivada: mostra a área dela para não perder o valor.
    const own = session && catalog.areas.find((a) => a.id === session.area_id);
    if (own && !groups.some((g) => g.areas.some((a) => a.id === own.id))) {
      const group = catalog.groups.find((g) => g.id === own.group_id);
      if (group) groups.unshift({ group, areas: [own] });
    }
    return groups;
  }, [catalog, recentAreaIds, session]);
  const areaId = fields.areaId ?? options[0]?.areas[0]?.id;

  // Horários calculados; um campo não alterado na edição mantém os segundos originais.
  const startMs =
    session && fields.date === initial.date && fields.start === initial.start
      ? toMs(session.started_at)
      : fromWallTime(`${fields.date}T${fields.start}`, timezone);
  let endMs = NaN;
  if (mode === 'duration') {
    endMs = startMs + Number(fields.minutes) * 60_000;
  } else if (
    session?.ended_at &&
    fields.date === initial.date &&
    fields.start === initial.start &&
    fields.end === initial.end
  ) {
    endMs = toMs(session.ended_at);
  } else if (fields.end && fields.end !== fields.start) {
    endMs = fromWallTime(`${fields.date}T${fields.end}`, timezone);
    if (endMs <= startMs)
      endMs = fromWallTime(`${nextDayKey(fields.date)}T${fields.end}`, timezone);
  }
  const endsNextDay = Number.isFinite(endMs) && dayKey(endMs, timezone) !== fields.date;

  let error: string | null = null;
  if (!areaId) error = t('sessions.form.errors.area');
  else if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    error =
      mode === 'end' && fields.end && fields.end === fields.start
        ? t('sessions.form.errors.endBeforeStart')
        : t('sessions.form.errors.invalid');
  } else if (endMs <= startMs) error = t('sessions.form.errors.endBeforeStart');
  else if (endMs > now) error = t('sessions.form.errors.future');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (error || !areaId) return;
    onSubmit({
      area_id: areaId,
      started_at: toIso(startMs),
      ended_at: toIso(endMs),
      note: fields.note.trim() || null,
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>
              {t(editing ? 'sessions.form.editTitle' : 'sessions.form.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {t(editing ? 'sessions.form.editDescription' : 'sessions.form.addDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>{t('sessions.form.area')}</Label>
            <AreaPicker options={options} value={areaId} onChange={(id) => set({ areaId: id })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-date">{t('sessions.form.date')}</Label>
            <Input
              id="session-date"
              type="date"
              value={fields.date}
              max={dayKey(now, timezone)}
              onChange={(e) => set({ date: e.target.value })}
            />
          </div>

          {!editing && (
            <Tabs value={mode} onValueChange={(m) => setMode(m as Mode)}>
              <TabsList className="w-full">
                <TabsTrigger value="end">{t('sessions.form.byEnd')}</TabsTrigger>
                <TabsTrigger value="duration">{t('sessions.form.byDuration')}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-start">{t('sessions.form.start')}</Label>
              <Input
                id="session-start"
                type="time"
                value={fields.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </div>
            {mode === 'end' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-end">{t('sessions.form.end')}</Label>
                <Input
                  id="session-end"
                  type="time"
                  value={fields.end}
                  onChange={(e) => set({ end: e.target.value })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-minutes">{t('sessions.form.duration')}</Label>
                <Input
                  id="session-minutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={fields.minutes}
                  onChange={(e) => set({ minutes: e.target.value })}
                />
              </div>
            )}
          </div>
          {endsNextDay && !error && (
            <p className="text-sm text-muted-foreground">{t('sessions.form.endsNextDay')}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-note">{t('sessions.form.note')}</Label>
            <Textarea
              id="session-note"
              maxLength={1000}
              placeholder={t('sessions.form.notePlaceholder')}
              value={fields.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </div>

          {error && (fields.start || editing) && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('sessions.form.cancel')}
            </Button>
            <Button type="submit" disabled={!!error || busy}>
              {t('sessions.form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
