import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Area, Group } from '@elaps/core';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GROUP_COLORS,
  isDuplicateNameError,
  useCreateArea,
  useCreateGroup,
  useUpdateArea,
  useUpdateGroup,
} from '@/data/catalog';
import { cn } from '@/lib/utils';

export type NameDialogTarget =
  | { kind: 'group'; group?: Group }
  | {
      kind: 'area';
      /** Grupo fixo (vindo de um card). Sem ele, o diálogo pede o grupo entre `groups`. */
      group?: Group;
      groups?: readonly Group[];
      /** Grupo pré-selecionado quando o diálogo pede o grupo. */
      defaultGroupId?: string;
      area?: Area;
    };

export interface Created {
  kind: 'group' | 'area';
  id: string;
}

/**
 * Criar ou renomear grupo (com cor) ou área. Remontado a cada abertura (key no pai).
 * Criando área sem `group` fixo, pede o grupo (`onNewGroup` oferece criar um novo).
 */
export function NameDialog({
  target,
  onClose,
  onCreated,
  onNewGroup,
}: {
  target: NameDialogTarget;
  onClose: () => void;
  onCreated?: (created: Created, group?: Group) => void;
  onNewGroup?: () => void;
}) {
  const { t } = useTranslation();
  const isGroup = target.kind === 'group';
  const existing = isGroup ? target.group : target.area;

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState((isGroup && target.group?.color) || GROUP_COLORS[6]);
  const [error, setError] = useState<string | null>(null);
  const choices = target.kind === 'area' && !target.group ? (target.groups ?? []) : [];
  const [groupId, setGroupId] = useState(
    target.kind === 'area'
      ? (target.group?.id ?? target.defaultGroupId ?? choices[0]?.id)
      : undefined,
  );
  const areaGroup =
    target.kind === 'area' ? (target.group ?? choices.find((g) => g.id === groupId)) : undefined;

  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();
  const busy =
    createGroup.isPending || updateGroup.isPending || createArea.isPending || updateArea.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('groups.form.required'));
      return;
    }
    try {
      if (target.kind === 'group') {
        if (target.group) {
          await updateGroup.mutateAsync({ id: target.group.id, name: trimmed, color });
        } else {
          const group = await createGroup.mutateAsync({ name: trimmed, color });
          if (group) onCreated?.({ kind: 'group', id: group.id }, group);
        }
      } else if (target.area) {
        await updateArea.mutateAsync({ id: target.area.id, name: trimmed });
      } else {
        if (!areaGroup) {
          setError(t('groups.form.groupRequired'));
          return;
        }
        const area = await createArea.mutateAsync({ groupId: areaGroup.id, name: trimmed });
        if (area) onCreated?.({ kind: 'area', id: area.id });
      }
      toast.success(t(existing ? 'groups.toast.saved' : 'groups.toast.created'));
      onClose();
    } catch (err) {
      setError(
        t(
          isDuplicateNameError(err)
            ? isGroup
              ? 'groups.form.duplicateGroup'
              : 'groups.form.duplicateArea'
            : 'groups.form.failed',
        ),
      );
    }
  }

  const title = isGroup
    ? t(existing ? 'groups.editGroup' : 'groups.newGroup')
    : t(existing ? 'groups.editArea' : 'groups.newArea');

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {isGroup
                ? t('groups.empty.body')
                : areaGroup
                  ? t('groups.form.areaIn', { group: areaGroup.name })
                  : t('groups.form.areaPickGroup')}
            </DialogDescription>
          </DialogHeader>

          {choices.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="area-group">{t('groups.form.groupLabel')}</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger id="area-group" className="w-full">
                  <SelectValue placeholder={t('groups.form.groupPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onNewGroup && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto self-start p-0"
                  disabled={busy}
                  onClick={onNewGroup}
                >
                  {t('groups.form.newGroupInstead')}
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="name-field">
              {t(isGroup ? 'groups.form.groupNameLabel' : 'groups.form.areaNameLabel')}
            </Label>
            <Input
              id="name-field"
              autoFocus
              autoComplete="off"
              maxLength={60}
              value={name}
              placeholder={t(
                isGroup ? 'groups.form.groupNamePlaceholder' : 'groups.form.areaNamePlaceholder',
              )}
              aria-invalid={!!error}
              aria-describedby={error ? 'name-error' : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id="name-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          {isGroup && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t('groups.form.colorLabel')}</legend>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={t('groups.form.colorOption', { color: c })}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={cn(
                      'size-8 rounded-full ring-offset-2 ring-offset-popover transition-shadow',
                      color === c && 'ring-2 ring-foreground',
                    )}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t('groups.form.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? t('groups.form.saving')
                : t(existing ? 'groups.form.save' : 'groups.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
