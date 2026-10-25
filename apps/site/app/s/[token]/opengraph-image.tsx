import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

// Camadas por fundo, como no app: página, cartão branco, trilho das barras.
const PAGE = '#f4f4f5';
const CARD = '#ffffff';
const INK = '#18181b';
const MUTED = '#71717a';
const TRACK = '#e4e4e7';

// O satori (next/og) não lê woff2 nem fonte variável: woff estático, copiado do
// fontsource para assets/og-fonts (licença OFL ao lado). O next.config inclui a
// pasta no trace da função, para o arquivo existir na Vercel.
const fontFile = (name: string) => readFile(join(process.cwd(), 'assets/og-fonts', name));

/** Imagem de prévia (WhatsApp, X…): total, período e barras dos grupos. */
export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await getShare(token);
  // Link inexistente ou revogado: sem imagem (404).
  if (!share) notFound();
  const { payload } = share;
  const groups = payload.groups.slice(0, 4);
  const max = Math.max(1, ...groups.map((g) => g.ms));
  const [inter400, inter600, poppins700] = await Promise.all([
    fontFile('inter-latin-400-normal.woff'),
    fontFile('inter-latin-600-normal.woff'),
    fontFile('poppins-latin-700-normal.woff'),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PAGE,
        padding: '48px 56px',
        fontFamily: 'Inter',
        color: INK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 52, fontWeight: 700, fontFamily: 'Poppins' }}>Elaps</div>
        <div style={{ fontSize: 32, color: MUTED }}>{payload.period.label}</div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          marginTop: 28,
          padding: '32px 40px',
          background: CARD,
          borderRadius: 32,
        }}
      >
        <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>TEMPO TOTAL</div>
        <div
          style={{
            display: 'flex',
            fontSize: 112,
            fontWeight: 700,
            lineHeight: 1.1,
            fontFamily: 'Poppins',
          }}
        >
          {formatDuration(payload.total_ms)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
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
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: inter400, weight: 400, style: 'normal' },
        { name: 'Inter', data: inter600, weight: 600, style: 'normal' },
        { name: 'Poppins', data: poppins700, weight: 700, style: 'normal' },
      ],
    },
  );
}
