import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { Period, Session, SessionPause, SessionTag } from '@elaps/core';
import { fetchSessionTags, writeSessionTags } from '@/data/tags';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Histórico de sessões: lista paginada, lançamento manual, edição e exclusão.
// Mexer em sessões muda o cronômetro, as listas do dia e o dashboard.

const PAGE_SIZE = 30;
const SESSION_COLUMNS = 'id, user_id, area_id, started_at, ended_at, source, note, mode';

/** A sessão mudou ou sumiu em outro aparelho. */
export class SessionConflictError extends Error {
  override name = 'SessionConflictError';
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  // P0002: edit_session não achou a sessão (excluída em outro aparelho).
  if (error.code === 'P0002') throw new SessionConflictError(error.message);
  throw new Error(error.message);
}

function toSession(
  row: Omit<Session, 'source' | 'mode'> & { source: string; mode: string },
): Session {
  return {
    ...row,
    source: row.source === 'manual' ? 'manual' : 'timer',
    mode: row.mode === 'pomodoro' ? 'pomodoro' : 'free',
  };
}

export interface SessionFilter {
  /** null = todo o histórico. */
  period: Period | null;
  /** Restringe a estas áreas (null = todas). */
  areaIds: string[] | null;
  /** Só sessões que tenham qualquer uma destas tags (null/vazio = todas). */
  tagIds?: string[] | null;
}

export interface SessionPage {
  sessions: Session[];
  pauses: SessionPause[];
  tags: SessionTag[];
  next: number | undefined;
}

/** Sessões que tocam o período (ou todas), mais recente primeiro, em páginas. */
export function useSessionList(filter: SessionFilter) {
  const { user } = useAuth();
  const { period, areaIds } = filter;
  const tagIds = filter.tagIds?.length ? filter.tagIds : null;
  return useInfiniteQuery({
    queryKey: ['sessions', 'list', period?.start ?? null, period?.end ?? null, areaIds, tagIds],
    enabled: !!user,
    initialPageParam: 0,
    // Ao trocar o filtro, a lista anterior fica na tela até a nova chegar.
    placeholderData: keepPreviousData,
    getNextPageParam: (last: SessionPage) => last.next,
    queryFn: async ({ pageParam }): Promise<SessionPage> => {
      // Com tags, o embed !inner deixa só as sessões que têm alguma delas (uma linha por sessão).
      const columns = tagIds ? `${SESSION_COLUMNS}, session_tags!inner(tag_id)` : SESSION_COLUMNS;
      let query = supabase.from('sessions').select(columns as typeof SESSION_COLUMNS);
      if (period) {
        query = query
          .lt('started_at', period.end)
          .or(`ended_at.is.null,ended_at.gt.${period.start}`);
      }
      if (areaIds) query = query.in('area_id', areaIds);
      if (tagIds) query = query.in('session_tags.tag_id', tagIds);
      const { data, error } = await query
        .order('started_at', { ascending: false })
        .order('id')
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      check(error);
      const sessions = (data ?? []).map(
        ({ id, user_id, area_id, started_at, ended_at, source, note, mode }) =>
          toSession({ id, user_id, area_id, started_at, ended_at, source, note, mode }),
      );
      const tags = await fetchSessionTags(sessions.map((x) => x.id));
      let pauses: SessionPause[] = [];
      if (sessions.length > 0) {
        const res = await supabase
          .from('session_pauses')
          .select('id, session_id, paused_at, resumed_at')
          .in(
            'session_id',
            sessions.map((s) => s.id),
          );
        check(res.error);
        pauses = res.data ?? [];
      }
      return {
        sessions,
        pauses,
        tags,
        next: sessions.length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
      };
    },
  });
}

export interface SessionInput {
  area_id: string;
  started_at: string;
  ended_at: string;
  note: string | null;
  /** Tags da sessão (omitido = não mexe). */
  tag_ids?: string[];
}

function useInvalidateSessions() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['sessions', 'timer', 'dashboard'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

/** Lançamento manual (já nasce encerrado). */
export function useCreateManualSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ tag_ids, ...input }: SessionInput) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert({ ...input, note: input.note?.trim() || null, source: 'manual' })
        .select('id')
        .single();
      check(error);
      if (tag_ids?.length) await writeSessionTags(data!.id, tag_ids);
    },
    onSettled: invalidate,
  });
}

/** Edita área, início, fim e nota numa transação (RPC edit_session corta as pausas). */
export function useEditSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ id, ...input }: SessionInput & { id: string }) => {
      const { error } = await supabase.rpc('edit_session', {
        p_session_id: id,
        p_area_id: input.area_id,
        p_started_at: input.started_at,
        p_ended_at: input.ended_at,
        p_note: input.note ?? '',
      });
      check(error);
      if (input.tag_ids) await writeSessionTags(id, input.tag_ids);
    },
    onSettled: invalidate,
  });
}

/** Exclui de vez (as pausas vão em cascata). */
export function useDeleteSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('sessions').delete().eq('id', id).select('id');
      check(error);
      if (!data?.length) throw new SessionConflictError('sessão já excluída');
    },
    onSettled: invalidate,
  });
}
