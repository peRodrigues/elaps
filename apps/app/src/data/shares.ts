import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayKey, SharePayloadV1 } from '@elaps/core';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Links públicos: cada um é um retrato congelado de um período (tabela shares).
// O token vem do banco; só o dono lê e revoga. A leitura pública é a RPC get_share.

export const SHARES_KEY = ['shares'] as const;

export interface ShareRow {
  id: string;
  token: string;
  period_label: string;
  period_start: DayKey;
  period_end: DayKey;
  hide_area_names: boolean;
  created_at: string;
  revoked_at: string | null;
}

const COLUMNS =
  'id, token, period_label, period_start, period_end, hide_area_names, created_at, revoked_at';

/** Endereço público do link: <base>/s/<token>. */
export function shareUrl(token: string): string {
  const base = import.meta.env.VITE_SHARE_BASE_URL || 'http://localhost:3000';
  return `${base.replace(/\/+$/, '')}/s/${token}`;
}

/** Links do usuário, o mais novo primeiro (inclui os revogados). */
export function useShares() {
  const { user } = useAuth();
  return useQuery({
    queryKey: SHARES_KEY,
    enabled: !!user,
    queryFn: async (): Promise<ShareRow[]> => {
      const { data, error } = await supabase
        .from('shares')
        .select(COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Cria o link a partir do mesmo payload da imagem. */
export function useCreateShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      payload,
      hideAreaNames,
    }: {
      payload: SharePayloadV1;
      hideAreaNames: boolean;
    }): Promise<ShareRow> => {
      const { data, error } = await supabase
        .from('shares')
        .insert({
          period_label: payload.period.label,
          period_start: payload.period.start,
          period_end: payload.period.end,
          payload: payload as unknown as never,
          hide_area_names: hideAreaNames,
        })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SHARES_KEY }),
  });
}

/** Revoga (sem volta): o banco marca o horário e get_share passa a devolver vazio. */
export function useRevokeShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SHARES_KEY }),
  });
}
