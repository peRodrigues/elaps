import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionTag, Tag } from '@elaps/core';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Tags do usuário e vínculos com as sessões (session_tags). O nome é único,
// sem diferenciar maiúsculas, entre as tags não arquivadas (23505).

export const TAGS_KEY = ['tags'] as const;
const TAG_COLUMNS = 'id, user_id, name, archived_at';
const LINK_CHUNK = 100;

/** Tags do usuário, inclusive as arquivadas (as sessões antigas continuam com elas). */
export function useTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TAGS_KEY,
    enabled: !!user,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select(TAG_COLUMNS)
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Tags que podem ser escolhidas (não arquivadas). */
export const activeTags = (tags: readonly Tag[]): Tag[] => tags.filter((t) => !t.archived_at);

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name, 'pt-BR');

/** As tags com estes ids, em ordem alfabética (chips e CSV). */
export function tagsOf(tagIds: readonly string[], tags: readonly Tag[]): Tag[] {
  return tags.filter((t) => tagIds.includes(t.id)).sort(byName);
}

/** Vínculos das sessões dadas (em lotes, para não estourar a URL). */
export async function fetchSessionTags(sessionIds: readonly string[]): Promise<SessionTag[]> {
  const links: SessionTag[] = [];
  for (let i = 0; i < sessionIds.length; i += LINK_CHUNK) {
    const { data, error } = await supabase
      .from('session_tags')
      .select('session_id, tag_id, user_id')
      .in('session_id', sessionIds.slice(i, i + LINK_CHUNK));
    if (error) throw new Error(error.message);
    links.push(...data);
  }
  return links;
}

/** Ids de tag por id de sessão. */
export function tagIdsBySession(links: readonly SessionTag[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const l of links) map.set(l.session_id, [...(map.get(l.session_id) ?? []), l.tag_id]);
  return map;
}

/** Deixa a sessão com exatamente estas tags (apaga as que saíram, insere as novas). */
export async function writeSessionTags(sessionId: string, tagIds: readonly string[]) {
  const current = (await fetchSessionTags([sessionId])).map((l) => l.tag_id);
  const remove = current.filter((id) => !tagIds.includes(id));
  const add = tagIds.filter((id) => !current.includes(id));
  if (remove.length > 0) {
    const { error } = await supabase
      .from('session_tags')
      .delete()
      .eq('session_id', sessionId)
      .in('tag_id', remove);
    if (error) throw new Error(error.message);
  }
  if (add.length > 0) {
    const { error } = await supabase
      .from('session_tags')
      .insert(add.map((tag_id) => ({ session_id: sessionId, tag_id })));
    if (error) throw new Error(error.message);
  }
}

/** Em quantas sessões a tag está (para o aviso de exclusão). */
export function useTagSessionCount(id: string | null) {
  return useQuery({
    queryKey: ['tag-session-count', id],
    enabled: !!id,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('session_tags')
        .select('session_id', { count: 'exact', head: true })
        .eq('tag_id', id!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function useTagMutation<TVars, TResult = void>(
  fn: (vars: TVars) => Promise<TResult>,
  { alsoInvalidate = [] as string[] } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TAGS_KEY });
      for (const key of alsoInvalidate) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}

export const useCreateTag = () =>
  useTagMutation(async (name: string): Promise<Tag> => {
    const { data, error } = await supabase
      .from('tags')
      .insert({ name })
      .select(TAG_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  });

export const useRenameTag = () =>
  useTagMutation(async ({ id, name }: { id: string; name: string }) => {
    const { error } = await supabase.from('tags').update({ name }).eq('id', id);
    if (error) throw error;
  });

export const useSetTagArchived = () =>
  useTagMutation(async ({ id, archived }: { id: string; archived: boolean }) => {
    const archived_at = archived ? new Date().toISOString() : null;
    const { error } = await supabase.from('tags').update({ archived_at }).eq('id', id);
    if (error) throw error;
  });

/** Exclui de vez: os vínculos com as sessões saem em cascata. */
export const useDeleteTag = () =>
  useTagMutation(
    async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    { alsoInvalidate: ['sessions', 'timer'] },
  );
