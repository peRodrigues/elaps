import { useTranslation } from 'react-i18next';
import { totals, type MetricsInput, type Period, type SessionTag, type Tag } from '@elaps/core';
import { Card, CardContent } from '@/components/ui/card';
import { tagIdsBySession } from '@/data/tags';
import { formatDuration } from '@/lib/duration';

export interface TagRow {
  /** null = sessões sem tag. */
  tagId: string | null;
  name: string;
  archived: boolean;
  ms: number;
}

/**
 * Tempo líquido por tag no período. Uma sessão com 2 tags conta nas duas (a soma
 * pode passar do total); as sessões sem tag viram a linha "sem tag". Usa o
 * mesmo cálculo do core nas sessões de cada tag, então pausas e recortes batem.
 */
export function tagTotals(
  input: MetricsInput,
  period: Period,
  tags: readonly Tag[],
  links: readonly SessionTag[],
): TagRow[] {
  const byTag = new Map<string, Set<string>>();
  const tagged = new Set<string>();
  for (const [sessionId, ids] of tagIdsBySession(links)) {
    tagged.add(sessionId);
    for (const id of ids) byTag.set(id, (byTag.get(id) ?? new Set()).add(sessionId));
  }
  const msOf = (ids: ReadonlySet<string>) =>
    totals({ ...input, sessions: input.sessions.filter((s) => ids.has(s.id)) }, period).total_ms;

  const rows: TagRow[] = [];
  for (const tag of tags) {
    const ids = byTag.get(tag.id);
    const ms = ids ? msOf(ids) : 0;
    if (ms > 0) rows.push({ tagId: tag.id, name: tag.name, archived: !!tag.archived_at, ms });
  }
  rows.sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name, 'pt-BR'));

  const untagged = new Set(input.sessions.filter((s) => !tagged.has(s.id)).map((s) => s.id));
  const untaggedMs = msOf(untagged);
  if (untaggedMs > 0) rows.push({ tagId: null, name: '', archived: false, ms: untaggedMs });
  return rows;
}

export function TagsCard({ rows }: { rows: TagRow[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => r.ms));
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="font-semibold">{t('tags.card.title')}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('tags.card.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.tagId ?? '_none'} className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {r.tagId === null ? (
                      <em className="text-muted-foreground">{t('tags.card.untagged')}</em>
                    ) : (
                      <>
                        {r.name}
                        {r.archived && (
                          <span className="text-muted-foreground"> {t('tags.archivedMark')}</span>
                        )}
                      </>
                    )}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{formatDuration(r.ms, t)}</span>
                </span>
                <div className="h-2 w-full rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(2, (r.ms / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('tags.card.note')}</p>
      </CardContent>
    </Card>
  );
}
