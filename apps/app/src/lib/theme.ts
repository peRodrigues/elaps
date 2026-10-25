import { useCallback, useEffect, useState } from 'react';
import { useProfile, useUpdateProfile } from '@/lib/profile';

export type Theme = 'light' | 'dark' | 'system';

// Cache só para o primeiro desenho; o index.html lê a mesma chave antes do React.
const KEY = 'elaps-theme';
const THEME_COLORS = { light: '#ffffff', dark: '#0a0a0a' };
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function readCache(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // storage indisponível: cai no padrão
  }
  return 'system';
}

function writeCache(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage indisponível: vale só nesta sessão
  }
}

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
}

/** Tema do usuário: o perfil manda quando carregado; antes disso vale o cache local. */
export function useTheme() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const [cached, setCached] = useState<Theme>(readCache);
  const theme = profile.data?.theme ?? cached;

  useEffect(() => {
    if (profile.data) writeCache(profile.data.theme);
  }, [profile.data]);

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return;
    const m = media();
    const onChange = () => apply('system');
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [theme]);

  const { mutate } = update;
  const setTheme = useCallback(
    (next: Theme) => {
      writeCache(next);
      setCached(next);
      if (profile.data) mutate({ theme: next });
    },
    [mutate, profile.data],
  );

  return { theme, setTheme };
}
