import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Catalog } from '@/data/catalog';

/** Cor de sessões cuja área não está mais no catálogo. */
const UNKNOWN_COLOR = '#737373';

export interface Lookup {
  groupName: (id: string | null) => string;
  groupColor: (id: string | null) => string;
  areaName: (id: string) => string;
}

/** Nome e cor de grupos e áreas (arquivados contam). */
export function useLookup(catalog: Catalog | undefined): Lookup {
  const { t } = useTranslation();
  return useMemo(() => {
    const groups = new Map((catalog?.groups ?? []).map((g) => [g.id, g]));
    const areas = new Map((catalog?.areas ?? []).map((a) => [a.id, a]));
    return {
      groupName: (id) =>
        id ? (groups.get(id)?.name ?? t('dashboard.noGroup')) : t('dashboard.noGroup'),
      groupColor: (id) => (id ? (groups.get(id)?.color ?? UNKNOWN_COLOR) : UNKNOWN_COLOR),
      areaName: (id) => areas.get(id)?.name ?? t('dashboard.noArea'),
    };
  }, [catalog, t]);
}
