import { useQuery } from '@tanstack/react-query';
import {
  customPeriod,
  dayKey,
  previousPeriod,
  type Period,
  type Session,
  type SessionPause,
} from '@elaps/core';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Dashboard: só busca as sessões e as pausas; a conta é do @elaps/core.
// As chaves começam por ['sessions', 'dashboard'] para que cronômetro, sessões
// e troca de fuso (que invalidam ['sessions']) atualizem a tela.

const SESSION_COLUMNS = 'id, user_id, area_id, started_at, ended_at, source, note';
const PAGE = 1000;
const PAUSE_CHUNK = 100;
/** Histórico usado só para o streak. */
export const STREAK_HISTORY_DAYS = 365;

export interface SessionsWithPauses {
  sessions: Session[];
  pauses: SessionPause[];
}

/** Sessões que tocam [start, end): começam antes do fim e terminam depois do início (ou estão abertas). */
async function fetchTouching(start: string, end: string): Promise<SessionsWithPauses> {
  const sessions: Session[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('sessions')
      .select(SESSION_COLUMNS)
      .lt('started_at', end)
      .or(`ended_at.is.null,ended_at.gt.${start}`)
      .order('started_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    // O banco garante 'timer' | 'manual' por CHECK; o tipo gerado diz string.
    sessions.push(
      ...data.map((r): Session => ({ ...r, source: r.source === 'manual' ? 'manual' : 'timer' })),
    );
    if (data.length < PAGE) break;
  }

  const pauses: SessionPause[] = [];
  for (let i = 0; i < sessions.length; i += PAUSE_CHUNK) {
    const ids = sessions.slice(i, i + PAUSE_CHUNK).map((s) => s.id);
    const { data, error } = await supabase
      .from('session_pauses')
      .select('id, session_id, paused_at, resumed_at')
      .in('session_id', ids);
    if (error) throw error;
    pauses.push(...data);
  }
  return { sessions, pauses };
}

/** Sessões do período e do período anterior de mesmo tamanho (para a comparação). */
export function useDashboardSessions(period: Period | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sessions', 'dashboard', 'period', period?.start, period?.end, period?.timezone],
    enabled: !!user && !!period,
    refetchOnWindowFocus: 'always',
    queryFn: () => fetchTouching(previousPeriod(period!).start, period!.end),
  });
}

/** Janela do histórico do streak: os últimos 365 dias até hoje, no fuso do perfil. */
export function streakWindow(now: number, timezone: string): Period {
  const first = dayKey(now - (STREAK_HISTORY_DAYS - 1) * 86_400_000, timezone);
  return customPeriod(first, dayKey(now, timezone), timezone);
}

/** Sessões dos últimos 365 dias, só para a série do streak. */
export function useStreakSessions(window: Period | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      'sessions',
      'dashboard',
      'streak',
      window?.first_day,
      window?.last_day,
      window?.timezone,
    ],
    enabled: !!user && !!window,
    refetchOnWindowFocus: 'always',
    queryFn: () => fetchTouching(window!.start, window!.end),
  });
}
