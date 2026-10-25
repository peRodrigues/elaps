import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Area, Group } from '@elaps/core';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteArea, useDeleteGroup, useSessionCount } from '@/data/catalog';

export type DeleteTarget = { kind: 'group'; item: Group } | { kind: 'area'; item: Area };

/** Confirmação de exclusão definitiva: avisa que as sessões também serão apagadas. */
export function DeleteDialog({ target, onClose }: { target: DeleteTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const isGroup = target.kind === 'group';
  const count = useSessionCount(target.kind, target.item.id);
  const deleteGroup = useDeleteGroup();
  const deleteArea = useDeleteArea();
  const busy = deleteGroup.isPending || deleteArea.isPending;

  async function onConfirm() {
    try {
      if (isGroup) await deleteGroup.mutateAsync(target.item.id);
      else await deleteArea.mutateAsync(target.item.id);
      toast.success(t('groups.toast.deleted'));
      onClose();
    } catch {
      toast.error(t('groups.toast.failed'));
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(isGroup ? 'groups.delete_.titleGroup' : 'groups.delete_.titleArea', {
              name: target.item.name,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(isGroup ? 'groups.delete_.bodyGroup' : 'groups.delete_.bodyArea')}
            {count.data !== undefined && (
              <strong className="mt-2 block text-foreground">
                {count.data === 0
                  ? t('groups.delete_.noSessions')
                  : t('groups.delete_.sessions', { count: count.data })}
              </strong>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('groups.form.cancel')}</AlertDialogCancel>
          {/* Botão comum (não AlertDialogAction): o diálogo só fecha depois de apagar. */}
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? t('groups.delete_.deleting') : t('groups.delete_.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
