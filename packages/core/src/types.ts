// Tipos espelham as linhas do banco como chegam do Supabase (snake_case).
// Todas as datas são strings ISO 8601 em UTC.

export type IsoDateTime = string;
/** Dia de calendário no fuso do perfil, `yyyy-MM-dd`. */
export type DayKey = string;

export type Theme = 'light' | 'dark' | 'system';

/**
 * Padrões do pomodoro no perfil (v2). Faixas garantidas por CHECK no banco.
 * Em `Profile` ficam opcionais enquanto o app não lê essas colunas; o card
 * de pomodoro (V6) os torna obrigatórios ao passar a ler.
 */
export interface PomodoroSettings {
  /** 1–180. */
  pomodoro_focus_min: number;
  /** 1–60. */
  pomodoro_short_break_min: number;
  /** 1–120. */
  pomodoro_long_break_min: number;
  /** Pausa longa a cada N focos, 1–12. */
  pomodoro_long_every: number;
}

export interface Profile extends Partial<PomodoroSettings> {
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

/** Fases de pausa do pomodoro são `SessionPause` comuns. */
export type SessionMode = 'free' | 'pomodoro';

export interface Session {
  id: string;
  user_id: string;
  area_id: string;
  started_at: IsoDateTime;
  /** `null` = cronômetro ativo. */
  ended_at: IsoDateTime | null;
  source: SessionSource;
  note: string | null;
  /**
   * Ausente = `'free'`. Opcional enquanto o app não lê a coluna; o card de
   * pomodoro (V6) o torna obrigatório.
   */
  mode?: SessionMode;
}

export interface SessionPause {
  id: string;
  session_id: string;
  paused_at: IsoDateTime;
  /** `null` = pausa em andamento. */
  resumed_at: IsoDateTime | null;
}

export type GoalTargetKind = 'total' | 'group' | 'area';
/** Semana começa na segunda; dia, semana e mês no fuso do perfil. */
export type GoalPeriod = 'day' | 'week' | 'month';

/**
 * Meta "no mínimo X min" por período. `group_id` só com `target_kind`
 * `'group'`, `area_id` só com `'area'` (CHECK no banco). O alvo em minutos
 * fica em `GoalVersion`.
 */
export interface Goal {
  id: string;
  user_id: string;
  target_kind: GoalTargetKind;
  group_id: string | null;
  area_id: string | null;
  period: GoalPeriod;
  archived_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

/**
 * Alvo de uma meta a partir de um dia. Cada período usa a versão de maior
 * `effective_from` <= o dia em que ele começa; períodos anteriores à primeira
 * versão usam a primeira. Toda meta nasce com uma (RPC `create_goal`).
 */
export interface GoalVersion {
  id: string;
  goal_id: string;
  /** > 0. */
  target_minutes: number;
  effective_from: DayKey;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  archived_at: IsoDateTime | null;
}

export interface SessionTag {
  session_id: string;
  tag_id: string;
  user_id: string;
}

/**
 * Snapshot imutável de um período, lido em público pela RPC `get_share`.
 * Criar = insert de `period_label`, `period_start`, `period_end`, `payload` e
 * `hide_area_names` (o token vem do banco); revogar = update de `revoked_at`.
 */
export interface Share {
  id: string;
  /** 32 caracteres base64url. */
  token: string;
  user_id: string;
  period_label: string;
  /** Primeiro dia do período (inclusivo). */
  period_start: DayKey;
  /** Último dia do período (inclusivo). */
  period_end: DayKey;
  /** Resumo já calculado pelo app; sem nomes de área se `hide_area_names`. */
  payload: unknown;
  hide_area_names: boolean;
  created_at: IsoDateTime;
  revoked_at: IsoDateTime | null;
}

/** Intervalo semiaberto [start, end) em milissegundos epoch. */
export interface Interval {
  start: number;
  end: number;
}

/** Instante aceito pelas funções: ISO, Date ou ms epoch. */
export type Instant = IsoDateTime | Date | number;
