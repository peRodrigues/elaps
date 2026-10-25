import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDuration } from '@/features/timer/time';

/** Parar com tempo ≥ 1 min: nota opcional e Salvar. */
export function StopDialog({
  open,
  areaName,
  netMs,
  busy,
  onCancel,
  onSave,
}: {
  open: boolean;
  areaName: string;
  netMs: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (note: string | null) => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(note.trim() || null);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('timer.stopDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('timer.stopDialog.description', {
                area: areaName,
                duration: formatDuration(netMs, t),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timer-note">{t('timer.stopDialog.noteLabel')}</Label>
            <Textarea
              id="timer-note"
              maxLength={1000}
              placeholder={t('timer.stopDialog.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('timer.stopDialog.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('timer.stopDialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Parar com menos de 1 min: descartar ou salvar. */
export function ShortSessionDialog({
  open,
  netMs,
  busy,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean;
  netMs: number;
  busy: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('timer.shortDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('timer.shortDialog.description', { duration: formatDuration(netMs, t) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('timer.shortDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={onDiscard}>
            {t('timer.shortDialog.discard')}
          </AlertDialogAction>
          <AlertDialogAction disabled={busy} onClick={onSave}>
            {t('timer.shortDialog.save')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
