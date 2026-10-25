import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type PeriodKind = 'day' | 'week' | 'month' | 'custom';

const KINDS: { kind: PeriodKind; key: string }[] = [
  { kind: 'day', key: 'dashboard.period.day' },
  { kind: 'week', key: 'dashboard.period.week' },
  { kind: 'month', key: 'dashboard.period.month' },
  { kind: 'custom', key: 'dashboard.period.custom' },
];

/** Dia de calendário `yyyy-MM-dd` de uma data escolhida no calendar (hora local do aparelho). */
export function toDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function PeriodPicker({
  kind,
  onKind,
  range,
  onRange,
  rangeLabel,
}: {
  kind: PeriodKind;
  onKind: (k: PeriodKind) => void;
  range: DateRange | undefined;
  onRange: (r: DateRange) => void;
  rangeLabel: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Tabs value={kind} onValueChange={(v) => onKind(v as PeriodKind)}>
        <TabsList className="w-full">
          {KINDS.map(({ kind: k, key }) => (
            <TabsTrigger key={k} value={k}>
              {t(key)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        {kind === 'custom' && (
          <Popover
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setPending(null);
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays className="size-4" />
                {t('dashboard.period.pickRange')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                numberOfMonths={1}
                weekStartsOn={1}
                defaultMonth={range?.from}
                selected={range}
                onDayClick={(day) => {
                  // Dois cliques: o primeiro começa um intervalo novo, o segundo fecha.
                  if (!pending) {
                    setPending(day);
                    onRange({ from: day, to: day });
                    return;
                  }
                  const [from, to] = pending <= day ? [pending, day] : [day, pending];
                  setPending(null);
                  onRange({ from, to });
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
