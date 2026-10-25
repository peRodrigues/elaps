import type { Area, Group } from '@elaps/core';
import { activeAreas, activeGroups, type Catalog } from '@/data/catalog';

export interface AreaInfo {
  area: Area;
  group: Group | undefined;
}

/** Área e grupo pelo id da área (inclui arquivados: o histórico continua valendo). */
export function areaLookup(catalog: Catalog | undefined): (areaId: string) => AreaInfo | undefined {
  const areas = new Map(catalog?.areas.map((a) => [a.id, a]));
  const groups = new Map(catalog?.groups.map((g) => [g.id, g]));
  return (areaId) => {
    const area = areas.get(areaId);
    return area && { area, group: groups.get(area.group_id) };
  };
}

export interface PickerGroup {
  group: Group;
  areas: Area[];
}

/**
 * Opções do seletor: só ativos, agrupados por grupo. Grupos e áreas usados há
 * menos tempo vêm primeiro; o resto segue em ordem alfabética.
 */
export function pickerGroups(catalog: Catalog, recentAreaIds: readonly string[]): PickerGroup[] {
  const rank = new Map(recentAreaIds.map((id, i) => [id, i]));
  const areaRank = (a: Area) => rank.get(a.id) ?? Infinity;
  const byRankThenName = (a: Area, b: Area) =>
    areaRank(a) - areaRank(b) || a.name.localeCompare(b.name, 'pt-BR');

  return activeGroups(catalog)
    .map((group) => ({ group, areas: activeAreas(catalog, group.id).sort(byRankThenName) }))
    .filter((g) => g.areas.length > 0)
    .sort(
      (a, b) =>
        areaRank(a.areas[0]!) - areaRank(b.areas[0]!) ||
        a.group.name.localeCompare(b.group.name, 'pt-BR'),
    );
}
