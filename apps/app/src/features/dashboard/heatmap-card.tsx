import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Heatmap } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';

// Escala sequencial de um só tom (azul), do claro ao escuro no tema claro e
// espelhada no tema escuro (mais tempo = mais brilho). Classes literais para o Tailwind achar.
const STEPS = [
  'bg-[#cde2fb] dark:bg-[#0d366b]',
  'bg-[#9ec5f4] dark:bg-[#184f95]',
  'bg-[#6da7ec] dark:bg-[#256abf]',
  'bg-[#3987e5] dark:bg-[#3987e5]',
  'bg-[#256abf] dark:bg-[#6da7ec]',
  'bg-[#1c5cab] dark:bg-[#9ec5f4]',
  'bg-[#0d366b] dark:bg-[#cde2fb]',
] as const;

function stepOf(ms: number, max: number): number {
  return Math.min(STEPS.length - 1, Math.max(0, Math.ceil((ms / max) * STEPS.length) - 1));
}

// 2024-01-01 foi uma segunda-feira: base para os nomes dos dias, segunda primeiro.
const weekdayNames = (style: 'short' | 'long') =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat('pt-BR', { weekday: style, timeZone: 'UTC' })
      .format(Date.UTC(2024, 0, 1 + i))
      .replace('.', ''),
  );
const SHORT = weekdayNames('short');
const LONG = weekdayNames('long');
const HOUR_LABELS = new Set([0, 3, 6, 9, 12, 15, 18, 21]);

export function HeatmapCard({ heatmap }: { heatmap: Heatmap }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<{ day: number; hour: number } | null>(null);
  const { cells, max_ms } = heatmap;

  const readout = active
    ? t('dashboard.heatmap.readout', {
        day: LONG[active.day],
        hour: active.hour,
        next: (active.hour + 1) % 24,
        time: formatDuration(cells[active.day]![active.hour]!, t),
      })
    : t('dashboard.heatmap.hint');

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">{t('dashboard.heatmap.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.heatmap.subtitle')}</p>
        </div>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[320px] gap-[2px]"
            style={{ gridTemplateColumns: '2rem repeat(24, minmax(0, 1fr))' }}
          >
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                aria-hidden
                className="text-center text-[10px] leading-none text-muted-foreground"
              >
                {HOUR_LABELS.has(h) ? h : ''}
              </span>
            ))}
            {cells.map((row, day) => (
              <div key={day} className="contents">
                <span className="self-center text-[11px] text-muted-foreground">{SHORT[day]}</span>
                {row.map((ms, hour) => (
                  <button
                    key={hour}
                    type="button"
                    aria-label={t('dashboard.heatmap.readout', {
                      day: LONG[day],
                      hour,
                      next: (hour + 1) % 24,
                      time: formatDuration(ms, t),
                    })}
                    onMouseEnter={() => setActive({ day, hour })}
                    onFocus={() => setActive({ day, hour })}
                    onClick={() => setActive({ day, hour })}
                    className={cn(
                      'aspect-square min-h-[12px] rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      ms > 0 ? STEPS[stepOf(ms, max_ms)] : 'bg-muted',
                      active?.day === day && active.hour === hour && 'ring-2 ring-foreground',
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="min-h-5 text-sm" aria-live="polite">
            {readout}
          </p>
          <div
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
            aria-hidden
          >
            <span>{t('dashboard.heatmap.less')}</span>
            {STEPS.map((s) => (
              <span key={s} className={cn('size-3 rounded-[3px]', s)} />
            ))}
            <span>{t('dashboard.heatmap.more')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
