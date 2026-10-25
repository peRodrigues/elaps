// Tipos espelham as linhas do banco como chegam do Supabase (snake_case).
// Todas as datas são strings ISO 8601 em UTC.

export type IsoDateTime = string;
/** Dia de calendário no fuso do perfil, `yyyy-MM-dd`. */
export type DayKey = string;

export type Theme = 'light' | 'dark' | 'system';

export interface Profile {
  id: string;
  /** Fuso IANA, ex.: `America/Sao_Paulo`. */
  timezone: string;
  theme: Theme;
}

export interface Group {
  id: string;
  user_id: string;
  name: string;
  color: string;
  archived_at: IsoDateTime | null;
}

export interface Area {
  id: string;
  user_id: string;
  group_id: string;
  name: string;
  archived_at: IsoDateTime | null;
}

export type SessionSource = 'timer' | 'manual';

export interface Session {
  id: string;
  user_id: string;
  area_id: string;
  started_at: IsoDateTime;
  /** `null` = cronômetro ativo. */
  ended_at: IsoDateTime | null;
  source: SessionSource;
  note: string | null;
}

export interface SessionPause {
  id: string;
  session_id: string;
  paused_at: IsoDateTime;
  /** `null` = pausa em andamento. */
  resumed_at: IsoDateTime | null;
}

/** Intervalo semiaberto [start, end) em milissegundos epoch. */
export interface Interval {
  start: number;
  end: number;
}

/** Instante aceito pelas funções: ISO, Date ou ms epoch. */
export type Instant = IsoDateTime | Date | number;
