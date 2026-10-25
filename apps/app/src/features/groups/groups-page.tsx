import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Area, Group } from '@elaps/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  isDuplicateNameError,
  useCatalog,
  useSetAreaArchived,
  useSetGroupArchived,
} from '@/data/catalog';
import { DeleteDialog, type DeleteTarget } from '@/features/groups/delete-dialog';
import { NameDialog, type NameDialogTarget } from '@/features/groups/name-dialog';
import { cn } from '@/lib/utils';

type Dialog =
  { type: 'name'; target: NameDialogTarget } | { type: 'delete'; target: DeleteTarget } | null;

function RowMenu({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('groups.actions')}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GroupsPage() {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const setGroupArchived = useSetGroupArchived();
  const setAreaArchived = useSetAreaArchived();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function toggleArchived(kind: 'group' | 'area', id: string, archived: boolean) {
    try {
      if (kind === 'group') await setGroupArchived.mutateAsync({ id, archived });
      else await setAreaArchived.mutateAsync({ id, archived });
      toast.success(t(archived ? 'groups.toast.archived' : 'groups.toast.unarchived'));
    } catch (err) {
      toast.error(
        t(isDuplicateNameError(err) ? 'groups.toast.unarchiveDuplicate' : 'groups.toast.failed'),
      );
    }
  }

  const openName = (target: NameDialogTarget) => setDialog({ type: 'name', target });
  const openDelete = (target: DeleteTarget) => setDialog({ type: 'delete', target });

  const groups = catalog.data?.groups ?? [];
  const areas = catalog.data?.areas ?? [];
  const areasOf = (g: Group) => areas.filter((a) => a.group_id === g.id);
  const activeGroups = groups.filter((g) => !g.archived_at);
  // Arquivados: grupos arquivados (com tudo) e áreas arquivadas de grupos ativos.
  const archivedGroups = groups.filter((g) => g.archived_at);
  const archivedAreas = areas.filter(
    (a) => a.archived_at && activeGroups.some((g) => g.id === a.group_id),
  );
  const archivedCount = archivedGroups.length + archivedAreas.length;

  function areaRow(g: Group, a: Area, archived: boolean) {
    return (
      <li key={a.id} className="flex items-center justify-between gap-2 pl-6">
        <span className={cn('truncate text-sm', archived && 'text-muted-foreground')}>
          {a.name}
        </span>
        <RowMenu>
          <DropdownMenuItem onSelect={() => openName({ kind: 'area', group: g, area: a })}>
            <Pencil /> {t('groups.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toggleArchived('area', a.id, !archived)}>
            {archived ? <ArchiveRestore /> : <Archive />}
            {t(archived ? 'groups.unarchive' : 'groups.archive')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => openDelete({ kind: 'area', item: a })}
          >
            <Trash2 /> {t('groups.delete')}
          </DropdownMenuItem>
        </RowMenu>
      </li>
    );
  }

  function groupCard(g: Group, archived: boolean) {
    const list = areasOf(g).filter((a) => (archived ? true : !a.archived_at));
    return (
      <Card key={g.id}>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-full"
                style={{ backgroundColor: g.color }}
              />
              <h2 className={cn('truncate font-semibold', archived && 'text-muted-foreground')}>
                {g.name}
              </h2>
            </div>
            <RowMenu>
              <DropdownMenuItem onSelect={() => openName({ kind: 'group', group: g })}>
                <Pencil /> {t('groups.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleArchived('group', g.id, !archived)}>
                {archived ? <ArchiveRestore /> : <Archive />}
                {t(archived ? 'groups.unarchive' : 'groups.archive')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => openDelete({ kind: 'group', item: g })}
              >
                <Trash2 /> {t('groups.delete')}
              </DropdownMenuItem>
            </RowMenu>
          </div>
          {list.length === 0 ? (
            <p className="pl-7 text-sm text-muted-foreground">{t('groups.noAreas')}</p>
          ) : (
            <ul className="flex flex-col">{list.map((a) => areaRow(g, a, !!a.archived_at))}</ul>
          )}
          {!archived && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => openName({ kind: 'area', group: g })}
            >
              <Plus className="size-4" /> {t('groups.newArea')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  let body: ReactNode;
  if (catalog.isPending) {
    body = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  } else if (catalog.isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {t('groups.loadError')}
        </p>
        <Button variant="outline" onClick={() => void catalog.refetch()}>
          {t('groups.retry')}
        </Button>
      </div>
    );
  } else if (groups.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <h2 className="font-semibold">{t('groups.empty.title')}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{t('groups.empty.body')}</p>
        <Button onClick={() => openName({ kind: 'group' })}>
          <Plus className="size-4" /> {t('groups.newGroup')}
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex flex-col gap-3">{activeGroups.map((g) => groupCard(g, false))}</div>
        {archivedCount > 0 && (
          <section className="flex flex-col gap-3">
            <Button
              variant="ghost"
              className="justify-start"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', !showArchived && '-rotate-90')}
              />
              {t('groups.archivedSection', { count: archivedCount })}
            </Button>
            {showArchived && (
              <div className="flex flex-col gap-3">
                {archivedGroups.map((g) => groupCard(g, true))}
                {archivedAreas.map((a) => {
                  const g = groups.find((x) => x.id === a.group_id)!;
                  return (
                    <Card key={a.id}>
                      <CardContent className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            aria-hidden
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: g.color }}
                          />
                          {g.name}
                        </span>
                        <ul>{areaRow(g, a, true)}</ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('pages.groups.title')}</h1>
        {groups.length > 0 && (
          <Button onClick={() => openName({ kind: 'group' })}>
            <Plus className="size-4" /> {t('groups.newGroup')}
          </Button>
        )}
      </header>
      {body}
      {dialog?.type === 'name' && (
        <NameDialog target={dialog.target} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'delete' && (
        <DeleteDialog target={dialog.target} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
