import { useTranslation } from 'react-i18next';
import type { SessionMode } from '@elaps/core';
import { cn } from '@/lib/utils';

/** Seletor Livre | Pomodoro antes de iniciar. */
export function ModeToggle({
  value,
  onChange,
}: {
  value: SessionMode;
  onChange: (mode: SessionMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t('pomodoro.modeLabel')}
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {(['free', 'pomodoro'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === m
              ? 'bg-card text-foreground dark:bg-accent'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`pomodoro.${m}`)}
        </button>
      ))}
    </div>
  );
}
