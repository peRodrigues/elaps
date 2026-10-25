import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDuration } from '@/lib/format';
import { getShare } from '@/lib/share';
import { ShareView } from '@/components/share-view';

// Literal (o Next lê estaticamente): um link revogado some em até 2 minutos.
export const revalidate = 120;
// Sem páginas pré-geradas: cada token é gerado na primeira visita e depois regerado (ISR).
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = await getShare(token);
  if (!share)
    return { title: 'Link indisponível · Elaps', robots: { index: false, follow: false } };
  const { payload } = share;
  const title = `${formatDuration(payload.total_ms)} em ${payload.period.label} · Elaps`;
  const description = `Resumo de tempo no Elaps: ${payload.period.label}.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', locale: 'pt_BR', siteName: 'Elaps' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const share = await getShare(token);
  if (!share) notFound();
  return <ShareView payload={share.payload} />;
}
