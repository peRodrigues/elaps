import { createClient } from '@supabase/supabase-js';
import type { SharePayloadV1 } from '@elaps/core';

/** Linha devolvida pela RPC pública get_share (sem user_id nem token). */
export interface PublicShare {
  period_label: string;
  period_start: string;
  period_end: string;
  hide_area_names: boolean;
  created_at: string;
  payload: SharePayloadV1;
}

const TOKEN = /^[A-Za-z0-9_-]{32,}$/;

/**
 * Lê o retrato pelo token com a chave publishable (a RPC é security definer).
 * Devolve null se o token é inválido, não existe ou foi revogado.
 */
export async function getShare(token: string): Promise<PublicShare | null> {
  if (!TOKEN.test(token)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY não configurados');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc('get_share', { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  const payload = row.payload as unknown as SharePayloadV1;
  if (payload?.version !== 1) return null;
  return { ...row, payload };
}
