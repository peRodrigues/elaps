import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
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
import { shareUrl, useRevokeShare, useShares, type ShareRow } from '@/data/shares';

const dateFormat = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

/** Seção "Links compartilhados" de Ajustes: copiar e revogar. */
export function SharesSection() {
  const { t } = useTranslation();
  const shares = useShares();
  const revoke = useRevokeShare();
  const [revoking, setRevoking] = useState<ShareRow | null>(null);

  async function copy(share: ShareRow) {
    try {
      await navigator.clipboard.writeText(shareUrl(share.token));
      toast.success(t('share.copiedToast'));
    } catch {
      toast.error(t('share.errors.copy'));
    }
  }

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await revoke.mutateAsync(revoking.id);
      toast.success(t('share.revoked'));
    } catch {
      toast.error(t('share.errors.revoke'));
    }
    setRevoking(null);
  }

  const list = shares.data ?? [];
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">{t('share.section.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('share.section.hint')}</p>
        </div>
        {shares.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t('share.errors.load')}
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('share.section.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-xl bg-muted p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{s.period_label}</span>
                  <Badge variant={s.revoked_at ? 'outline' : 'secondary'}>
                    {t(s.revoked_at ? 'share.section.revoked' : 'share.section.active')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('share.section.createdAt', { date: dateFormat(s.created_at) })}
                  {s.hide_area_names && ` · ${t('share.section.hidden')}`}
                </p>
                {!s.revoked_at && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void copy(s)}>
                      <Copy className="size-4" /> {t('share.copy')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRevoking(s)}>
                      {t('share.revoke')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <AlertDialog open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('share.revokeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('share.revokeBody', { label: revoking?.period_label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>{t('share.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={revoke.isPending}
            >
              {t('share.revokeConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
