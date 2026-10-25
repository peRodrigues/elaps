import type { TFunction } from 'i18next';
import { formatDuration } from '@/lib/duration';
import type { ShareImageLabels } from '@/features/share/share-image';

/** Textos da imagem, no mesmo pt-BR do resto do app. */
export function shareImageLabels(t: TFunction): ShareImageLabels {
  return {
    total: t('share.image.total'),
    average: t('share.image.average'),
    streak: t('share.image.streak'),
    longest: t('share.image.longest'),
    daily: t('share.image.daily'),
    days: (count) => t('share.image.days', { count }),
    duration: (ms) => formatDuration(ms, t),
    weekdays: t('share.image.weekdays').split(','),
  };
}
