import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { GoalPeriod, GoalProgress, Period } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { useCatalog } from '@/data/catalog';
import { useGoalsProgress } from '@/data/goals';
import { GoalBar } from '@/features/goals/goal-bar';
import { goalLabel } from '@/features/goals/goal-label';

const BY_KIND: Partial<Record<Period['kind'], GoalPeriod[]>> = {
  day: ['day'],
  week: ['week', 'day'],
  month: ['month'],
};
const NONE: GoalPeriod[] = ['day'];

/**
 * Cartão "Metas" do Dashboard: Hoje → diárias; Semana → semanais e as diárias
 * resumidas como "dias batidos"; Mês → mensais. Cada uma mostra o progresso do
 * período atual e o histórico "batida N de M". Intervalo livre: sem cartão.
 */
export function GoalsCard({ kind, period }: { kind: Period['kind']; period: Period }) {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const wanted = BY_KIND[kind];
  const progress = useGoalsProgress({ periods: wanted ?? NONE, history: 8 });

  if (!wanted || !progress.data || !catalog.data) return null;
  const goals = progress.data.filter((p) => wanted.includes(p.goal.period));
  if (goals.length === 0) return null;

  // Semana: as metas diárias viram "dias batidos" dentro da semana selecionada.
  const asDays = (p: GoalProgress) => kind === 'week' && p.goal.period === 'day';
  const daysOf = (p: GoalProgress) => {
    const inWeek = [...p.history, p.current].filter(
      (h) => h.period.first_day >= period.first_day && h.period.first_day <= period.last_day,
    );
    return { met: inWeek.filter((h) => h.met).length, total: inWeek.length };
  };
  const ordered = [...goals].sort((a, b) => Number(asDays(a)) - Number(asDays(b)));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">{t('goals.dashboard.title')}</h2>
          <Link to="/metas" className="text-sm text-muted-foreground underline underline-offset-4">
            {t('goals.dashboard.manage')}
          </Link>
        </div>
        <ul className="flex flex-col gap-5">
          {ordered.map((p) => {
            const label = goalLabel(p.goal, catalog.data, t);
            if (asDays(p)) {
              const { met, total } = daysOf(p);
              return (
                <li key={p.goal.id} className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {label.name}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      {t('goals.period.day')}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {t('goals.dashboard.daysMet', { count: total, met, total })}
                  </span>
                </li>
              );
            }
            return (
              <li key={p.goal.id} className="flex flex-col gap-2">
                <GoalBar
                  label={label}
                  period={t(`goals.period.${p.goal.period}`)}
                  progress={p.current}
                />
                <p className="text-xs text-muted-foreground">
                  {p.history.length === 0
                    ? t('goals.history.none')
                    : t(`goals.history.${p.goal.period}`, {
                        met: p.met_count,
                        total: p.history.length,
                      })}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
