// Montagem do CSV de sessões: módulo puro (sem React nem rede), fácil de testar.

export interface SessionCsvRow {
  startMs: number;
  endMs: number;
  /** Duração líquida (sem pausas), em ms. */
  netMs: number;
  /** Tempo pausado dentro da sessão, em ms. */
  pausedMs: number;
  group: string;
  area: string;
  /** Vazio por enquanto: as tags entram em outro card. */
  tags: string;
  note: string;
  source: 'cronômetro' | 'manual';
}

export const CSV_SEPARATOR = ';';
export const CSV_HEADER = [
  'data',
  'início',
  'fim',
  'duração (min)',
  'pausado (min)',
  'grupo',
  'área',
  'tags',
  'nota',
  'origem',
];

/** Aspas só quando preciso (separador, aspas ou quebra de linha), com `"` dobrado. */
export function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function parts(ms: number, timezone: string) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(ms)) {
    out[p.type] = p.value;
  }
  return out as Record<'day' | 'month' | 'year' | 'hour' | 'minute', string>;
}

/** `dd/mm/aaaa` no fuso. */
export function csvDate(ms: number, timezone: string): string {
  const p = parts(ms, timezone);
  return `${p.day}/${p.month}/${p.year}`;
}

/** `HH:mm` no fuso. */
export function csvTime(ms: number, timezone: string): string {
  const p = parts(ms, timezone);
  return `${p.hour}:${p.minute}`;
}

/** Minutos inteiros (arredonda para baixo). */
export function wholeMinutes(ms: number): number {
  return Math.floor(Math.max(0, ms) / 60_000);
}

/** CSV completo (linhas separadas por CRLF). O BOM é acrescentado por `csvBlob`. */
export function buildSessionsCsv(rows: readonly SessionCsvRow[], timezone: string): string {
  const lines = [CSV_HEADER.map(csvField).join(CSV_SEPARATOR)];
  for (const r of rows) {
    lines.push(
      [
        csvDate(r.startMs, timezone),
        csvTime(r.startMs, timezone),
        csvTime(r.endMs, timezone),
        String(wholeMinutes(r.netMs)),
        String(wholeMinutes(r.pausedMs)),
        r.group,
        r.area,
        r.tags,
        r.note,
        r.source,
      ]
        .map(csvField)
        .join(CSV_SEPARATOR),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

/** Arquivo UTF-8 com BOM (o Excel reconhece os acentos). */
export function csvBlob(csv: string): Blob {
  return new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
}

/** `elaps-sessoes-<inicio>-<fim>.csv`, com os dias no formato aaaa-mm-dd. */
export function csvFileName(firstDay: string, lastDay: string): string {
  return `elaps-sessoes-${firstDay}-${lastDay}.csv`;
}
