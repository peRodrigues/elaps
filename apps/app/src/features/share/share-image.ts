import type { SharePayloadV1 } from '@elaps/core';

// Imagem do resumo em canvas puro (sem dependência), tema claro, 1080 x 1350.
// Sai só do SharePayloadV1: o mesmo dado que vai para o link público.

export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1350;

export interface ShareImageLabels {
  total: string;
  average: string;
  streak: string;
  longest: string;
  /** Título do gráfico diário. */
  daily: string;
  /** Já com o número: "3 dias". */
  days: (count: number) => string;
  duration: (ms: number) => string;
  /** Letras dos dias da semana, segunda primeiro. */
  weekdays: string[];
}

const FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const PAD = 72;
const INK = '#0f172a';
const MUTED = '#64748b';
const TRACK = '#e2e8f0';
const CARD = '#f1f5f9';
/** Barras do dia: o total do dia não é de um grupo só, então não leva cor de grupo. */
const DAILY = '#334155';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Desenha o resumo e devolve o PNG. */
export async function renderShareImage(
  payload: SharePayloadV1,
  labels: ShareImageLabels,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_IMAGE_WIDTH;
  canvas.height = SHARE_IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  const inner = SHARE_IMAGE_WIDTH - PAD * 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);
  ctx.textBaseline = 'alphabetic';

  // Cabeçalho
  ctx.fillStyle = INK;
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText('Elaps', PAD, 130);
  ctx.fillStyle = MUTED;
  ctx.font = `400 36px ${FONT}`;
  ctx.fillText(fit(ctx, payload.period.label, inner), PAD, 192);

  // Total
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(labels.total.toUpperCase(), PAD, 300);
  ctx.fillStyle = INK;
  ctx.font = `800 132px ${FONT}`;
  ctx.fillText(fit(ctx, labels.duration(payload.total_ms), inner), PAD, 430);

  // Média e sequência
  const boxW = (inner - 2 * 24) / 3;
  const stats = [
    [labels.average, labels.duration(payload.daily_average_ms)],
    [labels.streak, labels.days(payload.streak.current)],
    [labels.longest, labels.days(payload.streak.longest)],
  ] as const;
  stats.forEach(([name, value], i) => {
    const x = PAD + i * (boxW + 24);
    ctx.fillStyle = CARD;
    roundRect(ctx, x, 490, boxW, 150, 24);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = `400 26px ${FONT}`;
    ctx.fillText(fit(ctx, name, boxW - 40), x + 24, 540);
    ctx.fillStyle = INK;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(fit(ctx, value, boxW - 40), x + 24, 604);
  });

  // Barras por grupo: a altura da linha se ajusta ao número de grupos (até 6).
  // Com poucos grupos (e áreas visíveis) cada linha leva as áreas principais.
  const groups = payload.groups.slice(0, 6);
  const maxGroup = Math.max(1, ...groups.map((g) => g.ms));
  const withAreas = groups.length <= 2 && groups.some((g) => g.areas?.length);
  const compact = groups.length >= 5;
  const rowH = withAreas ? 130 : compact ? 56 : 84;
  const nameFont = compact ? 28 : 34;
  const barH = compact ? 12 : 18;
  let y = 700;
  for (const g of groups) {
    ctx.fillStyle = INK;
    ctx.font = `600 ${nameFont}px ${FONT}`;
    const time = labels.duration(g.ms);
    ctx.textAlign = 'right';
    ctx.fillText(time, PAD + inner, y);
    const timeW = ctx.measureText(time).width;
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, g.name, inner - timeW - 24), PAD, y);
    const barY = y + (compact ? 12 : 18);
    ctx.fillStyle = TRACK;
    roundRect(ctx, PAD, barY, inner, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = g.color;
    roundRect(ctx, PAD, barY, Math.max(barH, inner * (g.ms / maxGroup)), barH, barH / 2);
    ctx.fill();
    if (withAreas && g.areas?.length) {
      ctx.fillStyle = MUTED;
      ctx.font = `400 26px ${FONT}`;
      const line = g.areas
        .slice(0, 3)
        .map((area) => `${area.name} ${labels.duration(area.ms)}`)
        .join('  ·  ');
      ctx.fillText(fit(ctx, line, inner), PAD, barY + barH + 36);
    }
    y += rowH;
  }

  // Série diária (total do dia, em cor neutra): logo abaixo dos grupos, com título.
  const titleY = y + 36;
  ctx.fillStyle = MUTED;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(labels.daily.toUpperCase(), PAD, titleY);
  const chartTop = titleY + 36;
  const chartH = Math.min(240, Math.max(100, 1190 - chartTop));
  const n = payload.daily.length;
  const maxDay = Math.max(1, ...payload.daily.map((d) => d.ms));
  const gap = n > 14 ? 4 : 12;
  const barW = (inner - gap * (n - 1)) / n;
  payload.daily.forEach((d, i) => {
    const h = d.ms === 0 ? 4 : Math.max(8, chartH * (d.ms / maxDay));
    ctx.fillStyle = d.ms === 0 ? TRACK : DAILY;
    roundRect(ctx, PAD + i * (barW + gap), chartTop + chartH - h, barW, h, Math.min(8, barW / 2));
    ctx.fill();
  });
  ctx.fillStyle = MUTED;
  ctx.font = `400 26px ${FONT}`;
  const axisY = chartTop + chartH + 40;
  if (n <= 7) {
    ctx.textAlign = 'center';
    payload.daily.forEach((d, i) => {
      const [yy, mm, dd] = d.date.split('-').map(Number);
      const weekday = (new Date(Date.UTC(yy!, mm! - 1, dd!)).getUTCDay() + 6) % 7;
      ctx.fillText(labels.weekdays[weekday] ?? '', PAD + i * (barW + gap) + barW / 2, axisY);
    });
  } else {
    const short = (key: string) => key.slice(8, 10) + '/' + key.slice(5, 7);
    ctx.textAlign = 'left';
    ctx.fillText(short(payload.daily[0]!.date), PAD, axisY);
    ctx.textAlign = 'right';
    ctx.fillText(short(payload.daily[n - 1]!.date), PAD + inner, axisY);
  }

  // Rodapé discreto
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('elaps', SHARE_IMAGE_WIDTH / 2, SHARE_IMAGE_HEIGHT - 48);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG não gerado'))),
      'image/png',
    ),
  );
}
