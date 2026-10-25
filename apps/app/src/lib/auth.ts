import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabasePublishableKey, supabaseUrl } from '@/lib/supabase';

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** true até a sessão salva ser lida na abertura do app. */
  loading: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return value;
}

export const CALLBACK_PATH = '/auth/callback';

/** Só caminhos internos: evita redirecionar para outro site depois do login. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.startsWith('/entrar') || next.startsWith(CALLBACK_PATH)) return '/';
  return next;
}

function callbackUrl(next: string): string {
  const url = new URL(CALLBACK_PATH, window.location.origin);
  url.searchParams.set('next', safeNext(next));
  return url.toString();
}

export async function sendMagicLink(email: string, next: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(next) },
  });
  if (error) throw error;
}

export class ProviderDisabledError extends Error {}

/** Abre o login do Google; falha com ProviderDisabledError se o provedor estiver desligado. */
export async function signInWithGoogle(next: string) {
  // Com o provedor desligado o Supabase mostraria uma página de erro em JSON;
  // pergunta antes às configurações públicas do auth.
  const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabasePublishableKey },
  });
  const settings = res.ok ? ((await res.json()) as { external?: { google?: boolean } }) : null;
  if (!settings?.external?.google) throw new ProviderDisabledError('google');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl(next) },
  });
  if (error) throw error;
}

// Troca o código do retorno por sessão uma vez por código (o StrictMode do
// React roda o efeito duas vezes e o código só vale uma).
const exchanges = new Map<string, Promise<void>>();

export function exchangeCode(code: string): Promise<void> {
  let pending = exchanges.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) throw error;
    });
    exchanges.set(code, pending);
  }
  return pending;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
