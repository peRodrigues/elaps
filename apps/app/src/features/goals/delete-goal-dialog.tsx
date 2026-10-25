import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Goal } from '@elaps/core';
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
import { useDeleteGoal } from '@/data/goals';

/** Confirmação de exclusão definitiva da meta (as sessões ficam). */
export function DeleteGoalDialog({
  goal,
  name,
  onClose,
}: {
  goal: Goal;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteGoal();
  const busy = remove.isPending;

  async function onConfirm() {
    try {
      await remove.mutateAsync(goal.id);
      toast.success(t('goals.toast.deleted'));
      onClose();
    } catch {
      toast.error(t('goals.toast.failed'));
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('goals.delete_.title', { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('goals.delete_.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('goals.form.cancel')}</AlertDialogCancel>
          {/* Botão comum (não AlertDialogAction): o diálogo só fecha depois de apagar. */}
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? t('goals.delete_.deleting') : t('goals.delete_.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
