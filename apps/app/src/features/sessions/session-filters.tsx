import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Catalog } from '@/data/catalog';
import { ColorDot } from '@/features/timer/area-picker';
import { TagFilter } from '@/features/timer/tag-picker';

export type PeriodChoice = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface FilterState {
  period: PeriodChoice;
  /** Usados só em 'custom' (yyyy-MM-dd, inclusivos). */
  from: string;
  to: string;
  /** 'all', 'g:<id do grupo>' ou 'a:<id da área>'. */
  scope: string;
  /** Qualquer uma destas tags (vazio = sem filtro). */
  tagIds: string[];
}

const PERIODS: PeriodChoice[] = ['all', 'today', 'week', 'month', 'custom'];

export function SessionFilters({
  value,
  onChange,
  catalog,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  catalog: Catalog;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const groups = [...catalog.groups].sort(
    (a, b) => Number(!!a.archived_at) - Number(!!b.archived_at) || a.name.localeCompare(b.name),
  );
  const archived = (item: { archived_at: string | null }) =>
    item.archived_at ? ` ${t('sessions.filters.archived')}` : '';

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Select
          value={value.period}
          onValueChange={(period) => set({ period: period as PeriodChoice })}
        >
          <SelectTrigger aria-label={t('sessions.filters.period')} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`sessions.filters.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.scope} onValueChange={(scope) => set({ scope })}>
          <SelectTrigger aria-label={t('sessions.filters.scope')} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sessions.filters.allGroups')}</SelectItem>
            {groups.map((group) => (
              <SelectGroup key={group.id}>
                <SelectItem value={`g:${group.id}`} className="font-medium">
                  <ColorDot color={group.color} />
                  {group.name}
                  {archived(group)}
                </SelectItem>
                {catalog.areas
                  .filter((a) => a.group_id === group.id)
                  .map((area) => (
                    <SelectItem key={area.id} value={`a:${area.id}`} className="pl-8">
                      {area.name}
                      {archived(area)}
                      <span className="sr-only">({group.name})</span>
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TagFilter value={value.tagIds} onChange={(tagIds) => set({ tagIds })} />
      {value.period === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-from">{t('sessions.filters.from')}</Label>
            <Input
              id="filter-from"
              type="date"
              value={value.from}
              max={value.to}
              onChange={(e) => e.target.value && set({ from: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-to">{t('sessions.filters.to')}</Label>
            <Input
              id="filter-to"
              type="date"
              value={value.to}
              min={value.from}
              onChange={(e) => e.target.value && set({ to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
