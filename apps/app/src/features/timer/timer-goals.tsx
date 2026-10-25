import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { GoalPeriod, GoalProgress } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { useCatalog } from '@/data/catalog';
import { useGoalsProgress } from '@/data/goals';
import { GoalBar } from '@/features/goals/goal-bar';
import { goalLabel } from '@/features/goals/goal-label';
import { areaLookup } from '@/features/timer/catalog-lookup';

const ORDER: Record<GoalPeriod, number> = { day: 0, week: 1, month: 2 };
const RUNNING_PERIODS: GoalPeriod[] = ['day', 'week', 'month'];
const IDLE_PERIODS: GoalPeriod[] = ['day'];

/**
 * Faixa de metas abaixo do cronômetro. Com cronômetro rodando: metas (dia, semana
 * e mês) que incluem a área em andamento (da área, do grupo dela e total). Sem
 * cronômetro: as metas diárias de hoje. O progresso vem do core (a sessão ativa
 * conta até `now`), então não há soma extra aqui.
 */
export function TimerGoals({ activeAreaId }: { activeAreaId: string | undefined }) {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const progress = useGoalsProgress({
    periods: activeAreaId ? RUNNING_PERIODS : IDLE_PERIODS,
    history: 1,
  });

  if (!progress.data || !catalog.data) return null;

  if (progress.data.length === 0) {
    return (
      <p className="text-center text-sm">
        <Link to="/metas" className="text-muted-foreground underline underline-offset-4">
          {t('goals.timer.create')}
        </Link>
      </p>
    );
  }

  const groupId = activeAreaId ? areaLookup(catalog.data)(activeAreaId)?.group?.id : undefined;
  const includes = ({ goal }: GoalProgress) => {
    if (!activeAreaId) return goal.period === 'day';
    return (
      goal.target_kind === 'total' ||
      (goal.target_kind === 'group' && goal.group_id === groupId) ||
      (goal.target_kind === 'area' && goal.area_id === activeAreaId)
    );
  };
  const shown = progress.data
    .filter(includes)
    .sort((a, b) => ORDER[a.goal.period] - ORDER[b.goal.period]);
  if (shown.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">
          {t(activeAreaId ? 'goals.timer.title' : 'goals.timer.today')}
        </h2>
        <ul className="flex flex-col gap-4">
          {shown.map((p) => (
            <li key={p.goal.id}>
              <GoalBar
                compact
                label={goalLabel(p.goal, catalog.data, t)}
                period={t(`goals.period.${p.goal.period}`)}
                progress={p.current}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
