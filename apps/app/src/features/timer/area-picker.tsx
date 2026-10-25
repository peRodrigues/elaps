import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
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
import { activeGroups, useCatalog } from '@/data/catalog';
import { QuickCreate } from '@/features/groups/quick-create';
import type { PickerGroup } from '@/features/timer/catalog-lookup';

export function ColorDot({ color }: { color: string | undefined }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? 'var(--muted-foreground)' }}
    />
  );
}

/** Valor da opção fixa "+ Nova área" (nunca é um id de área). */
const NEW_AREA = '__new-area__';

export function AreaPicker({
  options,
  value,
  onChange,
}: {
  options: PickerGroup[];
  value: string | undefined;
  onChange: (areaId: string) => void;
}) {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const [creating, setCreating] = useState(false);
  const noGroups = !!catalog.data && activeGroups(catalog.data).length === 0;

  const dialog = creating && (
    <QuickCreate
      kind="area"
      defaultGroupId={options.find((o) => o.areas.some((a) => a.id === value))?.group.id}
      onClose={() => setCreating(false)}
      // Já seleciona a área criada.
      onCreated={(created) => created.kind === 'area' && onChange(created.id)}
    />
  );

  if (noGroups) {
    return (
      <>
        <Button className="h-12 w-full text-base" onClick={() => setCreating(true)}>
          {t('groups.firstGroup')}
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <Select
        value={value}
        onValueChange={(next) => (next === NEW_AREA ? setCreating(true) : onChange(next))}
      >
        <SelectTrigger aria-label={t('timer.areaLabel')} className="h-12 w-full text-base">
          <SelectValue placeholder={t('timer.areaPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {options.map(({ group, areas }) => (
            <SelectGroup key={group.id}>
              <SelectLabel className="flex items-center gap-2">
                <ColorDot color={group.color} />
                {group.name}
              </SelectLabel>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id} className="pl-6">
                  <ColorDot color={group.color} />
                  {area.name}
                  <span className="sr-only">({group.name})</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectSeparator />
          <SelectItem value={NEW_AREA}>{t('groups.newAreaOption')}</SelectItem>
        </SelectContent>
      </Select>
      {dialog}
    </>
  );
}
