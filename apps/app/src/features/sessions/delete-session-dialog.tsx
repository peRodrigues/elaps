import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DeleteSessionDialog({
  areaName,
  range,
  duration,
  busy,
  onCancel,
  onConfirm,
}: {
  areaName: string;
  range: string;
  duration: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('sessions.deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('sessions.deleteDialog.description', { area: areaName, range, duration })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('sessions.deleteDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={onConfirm}>
            {t('sessions.deleteDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
