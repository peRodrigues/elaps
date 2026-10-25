import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Tag } from '@elaps/core';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isDuplicateNameError } from '@/data/catalog';
import {
  useCreateTag,
  useDeleteTag,
  useRenameTag,
  useSetTagArchived,
  useTagSessionCount,
  useTags,
} from '@/data/tags';
import { cn } from '@/lib/utils';

type Dialogs = { type: 'name'; tag?: Tag } | { type: 'delete'; tag: Tag } | null;

/** Seção "Tags" da tela Grupos: criar, renomear, arquivar/desarquivar e excluir. */
export function TagsSection() {
  const { t } = useTranslation();
  const tags = useTags();
  const setArchived = useSetTagArchived();
  const [dialog, setDialog] = useState<Dialogs>(null);

  async function toggleArchived(tag: Tag) {
    const archived = !tag.archived_at;
    try {
      await setArchived.mutateAsync({ id: tag.id, archived });
      toast.success(t(archived ? 'tags.toast.archived' : 'tags.toast.unarchived'));
    } catch (error) {
      toast.error(
        t(isDuplicateNameError(error) ? 'tags.toast.unarchiveDuplicate' : 'tags.errors.failed'),
      );
    }
  }

  const list = tags.data ?? [];
  const sorted = [...list].sort(
    (a, b) =>
      Number(!!a.archived_at) - Number(!!b.archived_at) || a.name.localeCompare(b.name, 'pt-BR'),
  );

  return (
    <section aria-labelledby="tags-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="tags-title" className="text-lg font-semibold">
          {t('tags.title')}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'name' })}>
          <Plus className="size-4" /> {t('tags.new')}
        </Button>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-1">
          {tags.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('tags.errors.load')}
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('tags.empty')}</p>
          ) : (
            <ul>
              {sorted.map((tag) => (
                <li key={tag.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn('truncate text-sm', tag.archived_at && 'text-muted-foreground')}
                    >
                      {tag.name}
                    </span>
                    {tag.archived_at && <Badge variant="outline">{t('tags.archivedBadge')}</Badge>}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('tags.actions', { name: tag.name })}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialog({ type: 'name', tag })}>
                        <Pencil /> {t('tags.rename')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void toggleArchived(tag)}>
                        {tag.archived_at ? <ArchiveRestore /> : <Archive />}
                        {t(tag.archived_at ? 'tags.unarchive' : 'tags.archive')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDialog({ type: 'delete', tag })}
                      >
                        <Trash2 /> {t('tags.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {dialog?.type === 'name' && (
        <TagNameDialog tag={dialog.tag} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'delete' && (
        <TagDeleteDialog tag={dialog.tag} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}

/** Criar (sem `tag`) ou renomear. Nome repetido entre as ativas = erro amigável (23505). */
function TagNameDialog({ tag, onClose }: { tag?: Tag; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateTag();
  const rename = useRenameTag();
  const [name, setName] = useState(tag?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || rename.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('tags.errors.required'));
      return;
    }
    try {
      if (tag) await rename.mutateAsync({ id: tag.id, name: trimmed });
      else await create.mutateAsync(trimmed);
      toast.success(t(tag ? 'tags.toast.renamed' : 'tags.toast.created'));
      onClose();
    } catch (err) {
      setError(t(isDuplicateNameError(err) ? 'tags.errors.duplicate' : 'tags.errors.failed'));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{t(tag ? 'tags.renameTitle' : 'tags.newTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">{t('tags.nameLabel')}</Label>
            <Input
              id="tag-name"
              autoFocus
              maxLength={40}
              placeholder={t('tags.namePlaceholder')}
              value={name}
              aria-invalid={!!error}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t('tags.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('tags.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Exclusão de vez: diz em quantas sessões a tag está (a tag sai delas, as sessões ficam). */
function TagDeleteDialog({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const { t } = useTranslation();
  const count = useTagSessionCount(tag.id);
  const remove = useDeleteTag();

  async function onConfirm() {
    try {
      await remove.mutateAsync(tag.id);
      toast.success(t('tags.toast.deleted'));
      onClose();
    } catch {
      toast.error(t('tags.errors.failed'));
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('tags.deleteTitle', { name: tag.name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('tags.deleteBody')}
            {count.data !== undefined && (
              <strong className="mt-2 block text-foreground">
                {count.data === 0
                  ? t('tags.deleteNoSessions')
                  : t('tags.deleteSessions', { count: count.data })}
              </strong>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{t('tags.cancel')}</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={remove.isPending}>
            {t('tags.deleteConfirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
