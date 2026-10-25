import type { TFunction } from 'i18next';
import type { DayKey, Goal, GoalPeriod } from '@elaps/core';
import type { Catalog } from '@/data/catalog';

export interface GoalLabel {
  name: string;
  /** Grupo da área, quando o alvo é uma área. */
  context: string | null;
  /** Cor do grupo (alvo grupo ou área); `null` no total. */
  color: string | null;
}

/** Nome, contexto e cor do alvo da meta, a partir do catálogo (arquivados incluídos). */
export function goalLabel(goal: Goal, catalog: Catalog | undefined, t: TFunction): GoalLabel {
  if (goal.target_kind === 'group') {
    const g = catalog?.groups.find((x) => x.id === goal.group_id);
    return { name: g?.name ?? '…', context: null, color: g?.color ?? null };
  }
  if (goal.target_kind === 'area') {
    const a = catalog?.areas.find((x) => x.id === goal.area_id);
    const g = catalog?.groups.find((x) => x.id === a?.group_id);
    return { name: a?.name ?? '…', context: g?.name ?? null, color: g?.color ?? null };
  }
  return { name: t('goals.target.total'), context: null, color: null };
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});
const monthName = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Rótulo curto de um período da meta: 19/10, Semana de 19/10, outubro de 2026. */
export function periodLabel(period: GoalPeriod, firstDay: DayKey, t: TFunction): string {
  const date = new Date(`${firstDay}T00:00:00Z`);
  if (period === 'month') return monthName.format(date);
  if (period === 'week') return t('goals.weekOf', { date: dayMonth.format(date) });
  return dayMonth.format(date);
}

/** Minutos → { horas, minutos } para o formulário. */
export const splitMinutes = (total: number) => ({ h: Math.floor(total / 60), m: total % 60 });
