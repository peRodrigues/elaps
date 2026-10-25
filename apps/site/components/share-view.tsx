import type { SharePayloadV1 } from '@elaps/core';
import { WEEKDAYS, days, formatDuration, shortDate, weekdayOf } from '@/lib/format';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function DailyBars({ daily }: { daily: SharePayloadV1['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.ms));
  const few = daily.length <= 7;
  return (
    <figure>
      <div className="flex h-32 items-end gap-1.5" role="img" aria-label="Tempo por dia">
        {daily.map((d) => (
          <div
            key={d.date}
            title={`${shortDate(d.date)}: ${formatDuration(d.ms)}`}
            className="flex-1 rounded-md"
            style={{
              height: d.ms === 0 ? 4 : `${Math.max(6, (d.ms / max) * 100)}%`,
              background: d.ms === 0 ? 'var(--raised)' : 'var(--bar)',
            }}
          />
        ))}
      </div>
      <figcaption className="mt-2 flex text-xs text-muted">
        {few ? (
          daily.map((d) => (
            <span key={d.date} className="flex-1 text-center">
              {WEEKDAYS[weekdayOf(d.date)]}
            </span>
          ))
        ) : (
          <>
            <span className="flex-1">{shortDate(daily[0]!.date)}</span>
            <span>{shortDate(daily[daily.length - 1]!.date)}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Heatmap({ cells }: { cells: number[][] }) {
  const max = Math.max(1, ...cells.flat());
  return (
    <div className="flex flex-col gap-1" role="img" aria-label="Mapa de calor por hora">
      {cells.map((row, weekday) => (
        <div key={weekday} className="flex items-center gap-1">
          <span className="w-7 shrink-0 text-[10px] text-muted">{WEEKDAYS[weekday]}</span>
          <div className="grid flex-1 grid-cols-24 gap-px">
            {row.map((ms, hour) => (
              <div
                key={hour}
                title={`${String(hour).padStart(2, '0')}h: ${formatDuration(ms)}`}
                className="aspect-square rounded-[2px] bg-raised"
                style={
                  ms > 0 ? { background: 'var(--bar)', opacity: 0.2 + 0.8 * (ms / max) } : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
      <div className="ml-8 flex justify-between text-[10px] text-muted">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

/** Página pública do resumo, a partir do SharePayloadV1 (renderizada no servidor). */
export function ShareView({ payload }: { payload: SharePayloadV1 }) {
  const maxGroup = Math.max(1, ...payload.groups.map((g) => g.ms));
  const hasHeat = !!payload.heatmap && payload.heatmap.some((row) => row.some((ms) => ms > 0));
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-8">
      <header className="px-1 pb-2">
        <p className="font-display text-2xl font-bold">Elaps</p>
        <h1 className="mt-1 font-sans text-lg text-muted">{payload.period.label}</h1>
      </header>

      <section aria-label="Tempo total" className="rounded-2xl bg-surface p-5">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Tempo total</p>
        <p className="font-display text-5xl leading-tight font-bold sm:text-6xl">
          {formatDuration(payload.total_ms)}
        </p>
      </section>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Média por dia" value={formatDuration(payload.daily_average_ms)} />
        <Stat label="Sequência" value={days(payload.streak.current)} />
        <Stat label="Maior sequência" value={days(payload.streak.longest)} />
      </dl>

      <section
        aria-labelledby="groups-title"
        className="flex flex-col gap-4 rounded-2xl bg-surface p-5"
      >
        <h2 id="groups-title" className="text-sm font-semibold">
          Por grupo
        </h2>
        <ul className="flex flex-col gap-4">
          {payload.groups.map((g) => (
            <li key={g.name} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{g.name}</span>
                <span className="font-mono tabular-nums">{formatDuration(g.ms)}</span>
              </div>
              <div className="h-3 rounded-full bg-raised" aria-hidden>
                <div
                  className="h-3 rounded-full"
                  style={{ width: `${Math.max(3, (g.ms / maxGroup) * 100)}%`, background: g.color }}
                />
              </div>
              {g.areas && g.areas.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted">
                  {g.areas.map((a) => (
                    <li key={a.name} className="flex justify-between gap-3">
                      <span>{a.name}</span>
                      <span className="font-mono tabular-nums">{formatDuration(a.ms)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="daily-title"
        className="flex flex-col gap-3 rounded-2xl bg-surface p-5"
      >
        <h2 id="daily-title" className="text-sm font-semibold">
          Por dia
        </h2>
        <DailyBars daily={payload.daily} />
      </section>

      {hasHeat && (
        <section
          aria-labelledby="heat-title"
          className="flex flex-col gap-3 rounded-2xl bg-surface p-5"
        >
          <h2 id="heat-title" className="text-sm font-semibold">
            Quando você mais registra
          </h2>
          <Heatmap cells={payload.heatmap!} />
        </section>
      )}

      <footer className="mt-auto pt-4 text-center text-sm text-muted">Feito com Elaps</footer>
    </main>
  );
}
