import type { PeriodSummary } from './metrics';
import type { Area, DayKey, Group } from './types';

// Formato do resumo compartilhado, igual para o app (imagem e link) e para o
// site que mostra /s/<token>. É só o que se mostra: sem ids, user_id, notas,
// tags nem horários de sessão. Vai para `shares.payload` (jsonb).

export interface SharePayloadV1 {
  version: 1;
  period: {
    /** Rótulo pronto para exibir (ex.: "Semana de 19/10 a 25/10"). */
    label: string;
    /** Primeiro e último dia (inclusivo), no fuso abaixo. */
    start: DayKey;
    end: DayKey;
    /** Fuso IANA do perfil. */
    timezone: string;
    days: number;
  };
  total_ms: number;
  daily_average_ms: number;
  streak: { current: number; longest: number };
  /** Maior primeiro. `areas` só existe quando os nomes das áreas não são ocultados. */
  groups: { name: string; color: string; ms: number; areas?: { name: string; ms: number }[] }[];
  /** Um ponto por dia do período, na ordem. */
  daily: { date: DayKey; ms: number }[];
  /** `cells[dia da semana (0 = segunda)][hora 0–23]` em ms. */
  heatmap?: number[][];
}

export interface ShareOptions {
  /** Rótulo do período, já formatado. */
  label: string;
  /** Não leva os nomes das áreas (os grupos continuam). */
  hideAreaNames: boolean;
  /** Inclui o mapa de calor 7x24 (padrão: sim). */
  includeHeatmap?: boolean;
}

const NO_GROUP = { name: 'Outros', color: '#999999' };

/** Reduz o resumo de um período ao que pode ser compartilhado. */
export function toSharePayload(
  summary: PeriodSummary,
  catalog: { groups: readonly Group[]; areas: readonly Area[] },
  options: ShareOptions,
): SharePayloadV1 {
  const groupById = new Map(catalog.groups.map((g) => [g.id, g]));
  const areaById = new Map(catalog.areas.map((a) => [a.id, a]));
  const { period } = summary;

  return {
    version: 1,
    period: {
      label: options.label,
      start: period.first_day,
      end: period.last_day,
      timezone: period.timezone,
      days: period.days,
    },
    total_ms: summary.totals.total_ms,
    daily_average_ms: summary.daily_average_ms,
    streak: { current: summary.streaks.current, longest: summary.streaks.longest },
    groups: summary.totals.groups.map((g) => {
      const group = g.group_id === null ? undefined : groupById.get(g.group_id);
      return {
        name: group?.name ?? NO_GROUP.name,
        color: group?.color ?? NO_GROUP.color,
        ms: g.ms,
        ...(options.hideAreaNames
          ? {}
          : {
              areas: g.areas.map((a) => ({
                name: areaById.get(a.area_id)?.name ?? 'Outra área',
                ms: a.ms,
              })),
            }),
      };
    }),
    daily: summary.daily.map((d) => ({ date: d.date, ms: d.ms })),
    ...(options.includeHeatmap === false
      ? {}
      : { heatmap: summary.heatmap.cells.map((row) => [...row]) }),
  };
}
