import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { PomodoroSettings } from '@elaps/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProfile, useUpdateProfile } from '@/lib/profile';

/** Mesmas faixas dos CHECKs de profiles. */
const FIELDS: { key: keyof PomodoroSettings; label: string; min: number; max: number }[] = [
  { key: 'pomodoro_focus_min', label: 'settings.pomodoro.focus', min: 1, max: 180 },
  { key: 'pomodoro_short_break_min', label: 'settings.pomodoro.shortBreak', min: 1, max: 60 },
  { key: 'pomodoro_long_break_min', label: 'settings.pomodoro.longBreak', min: 1, max: 120 },
  { key: 'pomodoro_long_every', label: 'settings.pomodoro.longEvery', min: 1, max: 12 },
];

/** Os 4 padrões do pomodoro no perfil (valem para o próximo pomodoro). */
export function PomodoroSettingsForm() {
  const { t } = useTranslation();
  const profile = useProfile();
  const update = useUpdateProfile();
  const [draft, setDraft] = useState<Partial<Record<keyof PomodoroSettings, string>>>({});

  if (!profile.data)
    return <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>;
  const saved = profile.data;
  const value = (key: keyof PomodoroSettings) => draft[key] ?? String(saved[key]);
  const invalid = (f: (typeof FIELDS)[number]) => {
    const n = Number(value(f.key));
    return !Number.isInteger(n) || n < f.min || n > f.max;
  };
  const dirty = FIELDS.some((f) => Number(value(f.key)) !== saved[f.key]);
  const hasError = FIELDS.some(invalid);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (hasError) return;
    const patch = Object.fromEntries(FIELDS.map((f) => [f.key, Number(value(f.key))]));
    try {
      await update.mutateAsync(patch as Partial<PomodoroSettings>);
      setDraft({});
      toast.success(t('settings.pomodoro.saved'));
    } catch {
      toast.error(t('settings.pomodoro.failed'));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <Label htmlFor={f.key} className="text-xs">
              {t(f.label)}
            </Label>
            <Input
              id={f.key}
              type="number"
              inputMode="numeric"
              min={f.min}
              max={f.max}
              value={value(f.key)}
              aria-invalid={invalid(f)}
              aria-describedby={invalid(f) ? `${f.key}-range` : undefined}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
            {invalid(f) && (
              <p id={`${f.key}-range`} className="text-xs text-destructive">
                {t('settings.pomodoro.range', { min: f.min, max: f.max })}
              </p>
            )}
          </div>
        ))}
      </div>
      <Button
        type="submit"
        className="self-start"
        disabled={!dirty || hasError || update.isPending}
      >
        {update.isPending ? t('settings.pomodoro.saving') : t('settings.pomodoro.save')}
      </Button>
    </form>
  );
}
