import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArchiveRestore, ChevronDown, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { goalVersionFor, type Goal } from '@elaps/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/data/catalog';
import { isDuplicateGoalError, useGoals, useGoalsProgress, useSetGoalArchived } from '@/data/goals';
import { DeleteGoalDialog } from '@/features/goals/delete-goal-dialog';
import { GoalCard } from '@/features/goals/goal-card';
import { GoalFormDialog, type GoalFormTarget } from '@/features/goals/goal-form-dialog';
import { goalLabel } from '@/features/goals/goal-label';
import { formatDuration } from '@/lib/duration';
import { cn } from '@/lib/utils';

type Dialog = { type: 'form'; target: GoalFormTarget } | { type: 'delete'; goal: Goal } | null;

/** Último alvo da meta (para o arquivado, que não tem progresso calculado). */
const LAST_DAY = '9999-12-31';

export function GoalsPage() {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const goals = useGoals();
  const progress = useGoalsProgress();
  const setArchived = useSetGoalArchived();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function toggleArchived(goal: Goal, archived: boolean) {
    try {
      await setArchived.mutateAsync({ id: goal.id, archived });
      toast.success(t(archived ? 'goals.toast.archived' : 'goals.toast.unarchived'));
    } catch (err) {
      toast.error(
        t(isDuplicateGoalError(err) ? 'goals.toast.unarchiveDuplicate' : 'goals.toast.failed'),
      );
    }
  }

  const openCreate = () => setDialog({ type: 'form', target: { kind: 'create' } });
  const label = (g: Goal) => goalLabel(g, catalog.data, t);
  const archived = (goals.data?.goals ?? []).filter((g) => g.archived_at);

  let body: ReactNode;
  if (progress.isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {t('goals.loadError')}
        </p>
        <Button variant="outline" onClick={progress.refetch}>
          {t('goals.retry')}
        </Button>
      </div>
    );
  } else if (progress.isPending || !progress.data) {
    body = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  } else if (progress.data.length === 0 && archived.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center">
        <h2 className="font-semibold">{t('goals.empty.title')}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{t('goals.empty.body')}</p>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> {t('goals.newGoal')}
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="grid gap-3 md:grid-cols-2">
          {progress.data.map((p) => (
            <GoalCard
              key={p.goal.id}
              progress={p}
              label={label(p.goal)}
              onEdit={() =>
                setDialog({
                  type: 'form',
                  target: { kind: 'edit', goal: p.goal, minutes: p.current.version.target_minutes },
                })
              }
              onArchive={() => void toggleArchived(p.goal, true)}
              onDelete={() => setDialog({ type: 'delete', goal: p.goal })}
            />
          ))}
        </div>
        {archived.length > 0 && (
          <section className="flex flex-col gap-3">
            <Button
              variant="ghost"
              className="justify-start"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', !showArchived && '-rotate-90')}
              />
              {t('goals.archivedSection', { count: archived.length })}
            </Button>
            {showArchived && (
              <ul className="flex flex-col gap-2">
                {archived.map((g) => {
                  const l = label(g);
                  const own = (goals.data?.versions ?? []).filter((v) => v.goal_id === g.id);
                  const minutes = goalVersionFor(own, LAST_DAY)?.target_minutes ?? 0;
                  return (
                    <li key={g.id}>
                      <Card className="py-3">
                        <CardContent className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden
                              className="size-3 shrink-0 rounded-full bg-muted-foreground"
                              style={l.color ? { backgroundColor: l.color } : undefined}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm text-muted-foreground">{l.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {t('goals.archivedTarget', {
                                  target: formatDuration(minutes * 60_000, t),
                                  period: t(`goals.period.${g.period}`),
                                })}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t('goals.actions')}>
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => void toggleArchived(g, false)}>
                                <ArchiveRestore /> {t('goals.unarchive')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDialog({ type: 'delete', goal: g })}
                              >
                                <Trash2 /> {t('goals.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('goals.title')}</h1>
        {(progress.data?.length ?? 0) + archived.length > 0 && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> {t('goals.newGoal')}
          </Button>
        )}
      </header>
      {body}
      {dialog?.type === 'form' && (
        <GoalFormDialog target={dialog.target} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'delete' && (
        <DeleteGoalDialog
          goal={dialog.goal}
          name={label(dialog.goal).name}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
