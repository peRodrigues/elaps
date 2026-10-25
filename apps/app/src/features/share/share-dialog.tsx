import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Download, Link2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { toSharePayload, type PeriodSummary } from '@elaps/core';
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
import type { Catalog } from '@/data/catalog';
import { shareUrl, useCreateShare } from '@/data/shares';
import { shareImageLabels } from '@/features/share/labels';
import { renderShareImage } from '@/features/share/share-image';

/** Compartilhar o período atual: imagem (baixar / Web Share) e link público. */
export function ShareDialog({
  summary,
  catalog,
  label,
  onClose,
}: {
  summary: PeriodSummary;
  catalog: Catalog;
  label: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateShare();
  const [hideAreaNames, setHideAreaNames] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const payload = useMemo(
    () => toSharePayload(summary, catalog, { label, hideAreaNames }),
    [summary, catalog, label, hideAreaNames],
  );

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    renderShareImage(payload, shareImageLabels(t))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => !cancelled && toast.error(t('share.errors.image')));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [payload, t]);

  const fileName = `elaps-${payload.period.start}-${payload.period.end}.png`;
  const canShareFile =
    !!image &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([image.blob], fileName, { type: 'image/png' })] });

  function download() {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
  }

  async function shareImage() {
    if (!image) return;
    try {
      await navigator.share({
        files: [new File([image.blob], fileName, { type: 'image/png' })],
        title: 'Elaps',
        text: payload.period.label,
      });
    } catch (error) {
      // Fechar a folha de compartilhamento não é erro.
      if ((error as Error).name !== 'AbortError') toast.error(t('share.errors.share'));
    }
  }

  async function createLink() {
    try {
      const row = await create.mutateAsync({ payload, hideAreaNames });
      setLink(shareUrl(row.token));
      setCopied(false);
    } catch {
      toast.error(t('share.errors.link'));
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast.error(t('share.errors.copy'));
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('share.title')}</DialogTitle>
          <DialogDescription>{payload.period.label}</DialogDescription>
        </DialogHeader>

        <div className="mx-auto aspect-[4/5] w-full max-w-64 overflow-hidden rounded-md border bg-muted">
          {image && (
            <img src={image.url} alt={t('share.previewAlt')} className="size-full object-contain" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="share-hide-areas"
            type="checkbox"
            className="size-4 accent-primary"
            checked={hideAreaNames}
            onChange={(e) => {
              setHideAreaNames(e.target.checked);
              // O link criado tem o payload antigo: precisa de outro.
              setLink(null);
            }}
          />
          <Label htmlFor="share-hide-areas" className="font-normal">
            {t('share.hideAreas')}
          </Label>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={download} disabled={!image}>
            <Download /> {t('share.download')}
          </Button>
          {canShareFile && (
            <Button variant="outline" onClick={() => void shareImage()}>
              <Share2 /> {t('share.shareImage')}
            </Button>
          )}
          {link ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                aria-label={t('share.linkLabel')}
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="outline" onClick={() => void copy()}>
                {copied ? <Check /> : <Copy />} {t(copied ? 'share.copied' : 'share.copy')}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => void createLink()} disabled={create.isPending}>
              <Link2 /> {t('share.createLink')}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t('share.notice')}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('share.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
