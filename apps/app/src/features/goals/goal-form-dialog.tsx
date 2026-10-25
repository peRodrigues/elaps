import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Goal, GoalPeriod } from '@elaps/core';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { activeAreas, activeGroups, useCatalog } from '@/data/catalog';
import { isDuplicateGoalError, useCreateGoal, useUpdateGoalTarget } from '@/data/goals';
import { splitMinutes } from '@/features/goals/goal-label';

export type GoalFormTarget = { kind: 'create' } | { kind: 'edit'; goal: Goal; minutes: number };

const PERIODS: GoalPeriod[] = ['day', 'week', 'month'];
const TOTAL = 'total';

/** Valor do seletor de alvo: 'total', 'group:<id>' ou 'area:<id>'. */
function parseTarget(value: string) {
  const [kind, id = null] = value.split(':') as [string, string | undefined];
  if (kind === 'group') return { target_kind: 'group' as const, group_id: id, area_id: null };
  if (kind === 'area') return { target_kind: 'area' as const, group_id: null, area_id: id };
  return { target_kind: 'total' as const, group_id: null, area_id: null };
}

/** Criar meta (alvo, período e tempo) ou editar só o tempo. */
export function GoalFormDialog({
  target,
  onClose,
}: {
  target: GoalFormTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const isEdit = target.kind === 'edit';
  const initial = splitMinutes(isEdit ? target.minutes : 60);

  const [goalTarget, setGoalTarget] = useState(TOTAL);
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [hours, setHours] = useState(String(initial.h));
  const [minutes, setMinutes] = useState(String(initial.m));
  const [error, setError] = useState<string | null>(null);

  const create = useCreateGoal();
  const update = useUpdateGoalTarget();
  const busy = create.isPending || update.isPending;

  const groups = catalog.data ? activeGroups(catalog.data) : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (!Number.isInteger(total) || total <= 0) {
      setError(t('goals.form.required'));
      return;
    }
    try {
      if (target.kind === 'edit') {
        await update.mutateAsync({ goal: target.goal, target_minutes: total });
        toast.success(t('goals.toast.saved'));
      } else {
        await create.mutateAsync({ ...parseTarget(goalTarget), period, target_minutes: total });
        toast.success(t('goals.toast.created'));
      }
      onClose();
    } catch (err) {
      setError(t(isDuplicateGoalError(err) ? 'goals.form.duplicate' : 'goals.form.failed'));
    }
  }

  const clearError = () => setError(null);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>
              {t(isEdit ? 'goals.form.editTitle' : 'goals.form.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t(isEdit ? 'goals.form.editBody' : 'goals.form.createBody')}
            </DialogDescription>
          </DialogHeader>

          {!isEdit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="goal-target">{t('goals.form.targetLabel')}</Label>
                <Select
                  value={goalTarget}
                  onValueChange={(v) => {
                    setGoalTarget(v);
                    clearError();
                  }}
                >
                  <SelectTrigger id="goal-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TOTAL}>{t('goals.target.total')}</SelectItem>
                    {groups.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>{t('goals.form.groupsLabel')}</SelectLabel>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={`group:${g.id}`}>
                              <span
                                aria-hidden
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: g.color }}
                              />
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}
                    {groups.map((g) => {
                      const areas = activeAreas(catalog.data!, g.id);
                      if (areas.length === 0) return null;
                      return (
                        <SelectGroup key={g.id}>
                          <SelectSeparator />
                          <SelectLabel>{t('goals.form.areasLabel', { group: g.name })}</SelectLabel>
                          {areas.map((a) => (
                            <SelectItem key={a.id} value={`area:${a.id}`}>
                              <span
                                aria-hidden
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: g.color }}
                              />
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="goal-period">{t('goals.form.periodLabel')}</Label>
                <Select
                  value={period}
                  onValueChange={(v) => {
                    setPeriod(PERIODS.find((p) => p === v) ?? 'week');
                    clearError();
                  }}
                >
                  <SelectTrigger id="goal-period" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`goals.periodName.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('goals.form.amountLabel')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="goal-hours" className="text-xs text-muted-foreground">
                  {t('goals.form.hours')}
                </Label>
                <Input
                  id="goal-hours"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={744}
                  autoFocus={isEdit}
                  value={hours}
                  aria-invalid={!!error}
                  onChange={(e) => {
                    setHours(e.target.value);
                    clearError();
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="goal-minutes" className="text-xs text-muted-foreground">
                  {t('goals.form.minutes')}
                </Label>
                <Input
                  id="goal-minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  step={5}
                  value={minutes}
                  aria-invalid={!!error}
                  onChange={(e) => {
                    setMinutes(e.target.value);
                    clearError();
                  }}
                />
              </div>
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t('goals.form.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('goals.form.saving') : t('goals.form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
