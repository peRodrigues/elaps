import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  return (
    <Select value={value} onValueChange={onChange}>
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
      </SelectContent>
    </Select>
  );
}
