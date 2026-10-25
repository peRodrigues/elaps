export type * from './types';

export {
  toMs,
  toIso,
  sessionEndMs,
  activeIntervals,
  netDurationMs,
  sumIntervals,
} from './duration';

export { dayKey, dayStartMs, weekdayMondayFirst, hourOfDay } from './calendar';

export {
  todayPeriod,
  weekPeriod,
  monthPeriod,
  customPeriod,
  previousPeriod,
  elapsedDays,
  periodDayKeys,
  type Period,
  type PeriodKind,
} from './periods';

export {
  MIN_SESSION_MS,
  FORGOTTEN_AFTER_MS,
  canTransition,
  deriveTimerState,
  applyTimerCommand,
  shouldConfirmDiscard,
  timerElapsedMs,
  runningStretchMs,
  isForgotten,
  TimerInvariantError,
  type TimerStatus,
  type TimerAction,
  type TimerState,
  type TimerCommand,
  type TimerEffect,
  type TimerResult,
} from './timer';

export {
  totals,
  dailySeries,
  heatmap,
  dailyAverageMs,
  streaks,
  compareWithPrevious,
  summarizePeriod,
  type MetricsInput,
  type AreaTotal,
  type GroupTotal,
  type Totals,
  type DailyPoint,
  type Heatmap,
  type Streaks,
  type Comparison,
  type PeriodSummary,
} from './metrics';
