import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Area, Group } from '@elaps/core';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Grupos e áreas do usuário, inclusive os arquivados. */
export interface Catalog {
  groups: Group[];
  areas: Area[];
}

export const CATALOG_KEY = ['catalog'] as const;

/** Grupos e áreas do usuário (arquivados incluídos; filtre com os helpers abaixo). */
export function useCatalog() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CATALOG_KEY,
    enabled: !!user,
    queryFn: async (): Promise<Catalog> => {
      const [groups, areas] = await Promise.all([
        supabase
          .from('groups')
          .select('id, user_id, name, color, archived_at')
          .order('name', { ascending: true }),
        supabase
          .from('areas')
          .select('id, user_id, group_id, name, archived_at')
          .order('name', { ascending: true }),
      ]);
      if (groups.error) throw groups.error;
      if (areas.error) throw areas.error;
      return { groups: groups.data, areas: areas.data };
    },
  });
}

export const isArchived = (item: Group | Area) => item.archived_at !== null;

/** Grupos não arquivados. */
export const activeGroups = (catalog: Catalog): Group[] =>
  catalog.groups.filter((g) => !g.archived_at);

/** Áreas não arquivadas de grupos não arquivados (o que os seletores devem mostrar). */
export function activeAreas(catalog: Catalog, groupId?: string): Area[] {
  const open = new Set(activeGroups(catalog).map((g) => g.id));
  return catalog.areas.filter(
    (a) => !a.archived_at && open.has(a.group_id) && (!groupId || a.group_id === groupId),
  );
}

/** Nome já usado por outro grupo/área ativo (índice único do banco, código 23505). */
export function isDuplicateNameError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}

/** Cores dos grupos: tons médios que se leem no tema claro e no escuro. */
export const GROUP_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
] as const;

type TableName = 'groups' | 'areas';

/** Quantas sessões somem junto com um grupo ou uma área (para o aviso de exclusão). */
export function useSessionCount(kind: 'group' | 'area', id: string | null) {
  return useQuery({
    queryKey: ['catalog-session-count', kind, id],
    enabled: !!id,
    queryFn: async (): Promise<number> => {
      const base = supabase.from('sessions');
      const { count, error } =
        kind === 'area'
          ? await base.select('id', { count: 'exact', head: true }).eq('area_id', id!)
          : await base
              .select('id, areas!inner(group_id)', { count: 'exact', head: true })
              .eq('areas.group_id', id!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function useCatalogMutation<TVars>(
  fn: (vars: TVars) => PromiseLike<{ error: { code?: string; message: string } | null }>,
  { alsoInvalidate = [] as string[] } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { error } = await fn(vars);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CATALOG_KEY });
      for (const key of alsoInvalidate) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}

const update = (table: TableName, id: string, values: { name?: string; color?: string }) =>
  table === 'groups'
    ? supabase.from('groups').update(values).eq('id', id)
    : supabase.from('areas').update({ name: values.name }).eq('id', id);

const setArchived = (table: TableName, id: string, archived: boolean) => {
  const archived_at = archived ? new Date().toISOString() : null;
  return table === 'groups'
    ? supabase.from('groups').update({ archived_at }).eq('id', id)
    : supabase.from('areas').update({ archived_at }).eq('id', id);
};

const remove = (table: TableName, id: string) =>
  table === 'groups'
    ? supabase.from('groups').delete().eq('id', id)
    : supabase.from('areas').delete().eq('id', id);

export const useCreateGroup = () =>
  useCatalogMutation(({ name, color }: { name: string; color: string }) =>
    supabase.from('groups').insert({ name, color }),
  );

export const useUpdateGroup = () =>
  useCatalogMutation(({ id, ...values }: { id: string; name?: string; color?: string }) =>
    update('groups', id, values),
  );

export const useSetGroupArchived = () =>
  useCatalogMutation(({ id, archived }: { id: string; archived: boolean }) =>
    setArchived('groups', id, archived),
  );

export const useDeleteGroup = () =>
  useCatalogMutation((id: string) => remove('groups', id), {
    alsoInvalidate: ['sessions', 'timer'],
  });

export const useCreateArea = () =>
  useCatalogMutation(({ groupId, name }: { groupId: string; name: string }) =>
    supabase.from('areas').insert({ group_id: groupId, name }),
  );

export const useUpdateArea = () =>
  useCatalogMutation(({ id, name }: { id: string; name: string }) => update('areas', id, { name }));

export const useSetAreaArchived = () =>
  useCatalogMutation(({ id, archived }: { id: string; archived: boolean }) =>
    setArchived('areas', id, archived),
  );

export const useDeleteArea = () =>
  useCatalogMutation((id: string) => remove('areas', id), {
    alsoInvalidate: ['sessions', 'timer'],
  });
