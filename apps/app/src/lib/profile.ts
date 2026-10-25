import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@elaps/core';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const THEMES: readonly Profile['theme'][] = ['light', 'dark', 'system'];

const PROFILE_COLUMNS =
  'id, timezone, theme, pomodoro_focus_min, pomodoro_short_break_min, pomodoro_long_break_min, pomodoro_long_every';

/** Perfil do usuário logado (fuso IANA, tema e padrões do pomodoro). */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      // O banco garante os valores por CHECK; o tipo gerado diz só string.
      const theme = THEMES.find((t) => t === data.theme) ?? 'system';
      return { ...data, theme };
    },
  });
}

type ProfilePatch = Partial<Omit<Profile, 'id'>>;

/** Altera fuso, tema e/ou pomodoro do perfil; a tela muda na hora e volta atrás se o banco recusar. */
export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['profile', user?.id];
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user!.id);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: (_data, _err, patch) => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      // O fuso define o dia de cada sessão: tudo que é medido por dia precisa recarregar.
      if (patch.timezone) {
        for (const k of ['sessions', 'timer', 'dashboard', 'catalog-session-count']) {
          void queryClient.invalidateQueries({ queryKey: [k] });
        }
      }
    },
  });
}
