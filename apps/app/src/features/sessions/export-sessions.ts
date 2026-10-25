import {
  dayKey,
  netDurationMs,
  toMs,
  type Period,
  type Session,
  type SessionPause,
} from '@elaps/core';
import { buildSessionsCsv, csvBlob, csvFileName, type SessionCsvRow } from '@/lib/csv-sessions';
import { supabase } from '@/lib/supabase';
import type { AreaInfo } from '@/features/timer/catalog-lookup';

const EXPORT_PAGE = 500;

export interface ExportFilter {
  period: Period | null;
  areaIds: string[] | null;
}

/** Todas as sessões encerradas do filtro (todas as páginas), da mais antiga à mais recente. */
async function fetchAll({ period, areaIds }: ExportFilter) {
  const sessions: Session[] = [];
  const pauses: SessionPause[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    let query = supabase
      .from('sessions')
      .select('id, user_id, area_id, started_at, ended_at, source, note')
      .not('ended_at', 'is', null);
    if (period) query = query.lt('started_at', period.end).gt('ended_at', period.start);
    if (areaIds) query = query.in('area_id', areaIds);
    const { data, error } = await query
      .order('started_at', { ascending: true })
      .order('id')
      .range(from, from + EXPORT_PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []).map((row): Session => ({
      ...row,
      source: row.source === 'manual' ? 'manual' : 'timer',
    }));
    sessions.push(...page);
    for (let i = 0; i < page.length; i += 100) {
      const res = await supabase
        .from('session_pauses')
        .select('id, session_id, paused_at, resumed_at')
        .in(
          'session_id',
          page.slice(i, i + 100).map((s) => s.id),
        );
      if (res.error) throw new Error(res.error.message);
      pauses.push(...(res.data ?? []));
    }
    if (page.length < EXPORT_PAGE) return { sessions, pauses };
  }
}

export interface SessionsExport {
  blob: Blob;
  fileName: string;
  count: number;
}

/** Monta o CSV das sessões encerradas que batem com o filtro da tela. */
export async function exportSessions(
  filter: ExportFilter,
  timezone: string,
  lookup: (areaId: string) => AreaInfo | undefined,
): Promise<SessionsExport> {
  const { sessions, pauses } = await fetchAll(filter);
  const rows: SessionCsvRow[] = sessions.map((s) => {
    const startMs = toMs(s.started_at);
    const endMs = toMs(s.ended_at!);
    const netMs = netDurationMs(s, pauses, endMs);
    const info = lookup(s.area_id);
    return {
      startMs,
      endMs,
      netMs,
      pausedMs: endMs - startMs - netMs,
      group: info?.group?.name ?? '',
      area: info?.area.name ?? '',
      tags: '',
      note: s.note ?? '',
      source: s.source === 'manual' ? 'manual' : 'cronômetro',
    };
  });
  const first = rows[0]?.startMs ?? Date.now();
  const last = rows[rows.length - 1]?.endMs ?? first;
  return {
    blob: csvBlob(buildSessionsCsv(rows, timezone)),
    fileName: csvFileName(
      filter.period?.first_day ?? dayKey(first, timezone),
      filter.period?.last_day ?? dayKey(last, timezone),
    ),
    count: rows.length,
  };
}

/** Dispara o download no navegador. */
export function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
