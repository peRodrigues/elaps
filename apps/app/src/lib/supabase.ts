import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em apps/app/.env.local (veja apps/app/README.md).',
  );
}

export const supabaseUrl = url;
export const supabasePublishableKey = key;

/** Cliente único do app. */
export const supabase = createClient<Database>(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // O retorno do login é trocado por sessão só em /auth/callback.
    detectSessionInUrl: false,
  },
});
