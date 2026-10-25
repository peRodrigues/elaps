import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { formatDuration } from '@/lib/format';
import { getShare } from '@/lib/share';

// Literal (o Next lê estaticamente): um link revogado some em até 2 minutos.
export const revalidate = 120;
// Sem páginas pré-geradas: cada token é gerado na primeira visita e depois regerado (ISR).
export const generateStaticParams = async () => [];
export const alt = 'Resumo de tempo no Elaps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#0f172a';
const MUTED = '#64748b';
const TRACK = '#e2e8f0';

/** Imagem de prévia (WhatsApp, X…): total, período e barras dos grupos. */
export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await getShare(token);
  // Link inexistente ou revogado: sem imagem (404).
  if (!share) notFound();
  const { payload } = share;
  const groups = payload.groups.slice(0, 4);
  const max = Math.max(1, ...groups.map((g) => g.ms));

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        padding: '56px 72px',
        fontFamily: 'sans-serif',
        color: INK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 52, fontWeight: 700 }}>Elaps</div>
        <div style={{ fontSize: 32, color: MUTED }}>{payload.period.label}</div>
      </div>
      <div style={{ display: 'flex', fontSize: 26, color: MUTED, marginTop: 36 }}>TEMPO TOTAL</div>
      <div style={{ display: 'flex', fontSize: 120, fontWeight: 800, lineHeight: 1.1 }}>
        {formatDuration(payload.total_ms)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
        {groups.map((g) => (
          <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              <span>{g.name}</span>
              <span>{formatDuration(g.ms)}</span>
            </div>
            <div style={{ display: 'flex', height: 14, background: TRACK, borderRadius: 7 }}>
              <div
                style={{
                  width: `${Math.max(3, (g.ms / max) * 100)}%`,
                  background: g.color,
                  borderRadius: 7,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
