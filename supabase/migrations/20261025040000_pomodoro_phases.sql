-- Elaps v2: fases do pomodoro.
--
-- A pausa de pomodoro é uma session_pause comum (o tempo líquido continua
-- certo), marcada com kind = 'break' para não se confundir com a pausa manual:
-- pular o foco cria uma pausa fora do limite, que sem a marca pareceria
-- manual. A duração (curta ou longa) sai da ordem: a k-ésima pausa de
-- pomodoro é longa se k for múltiplo de pomodoro_long_every.
--
-- A sessão guarda um retrato da config ao iniciar: as fases saem dele, então
-- mudar os valores em Ajustes vale para o próximo pomodoro e não reescreve as
-- fases já passadas.

alter table public.session_pauses
  add column kind text not null default 'manual' check (kind in ('manual', 'break'));

-- Os quatro valores do perfil, nas mesmas faixas dos CHECKs de profiles.
create function public.is_valid_pomodoro_config(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(c) = 'object'
    and coalesce((
      -- Chave ausente ou não numérica = false (bool_and ignoraria nulos, e o
      -- case evita converter texto em número).
      select bool_and(
        case
          when jsonb_typeof(c -> k) = 'number'
            then (c ->> k)::numeric = trunc((c ->> k)::numeric)
              and (c ->> k)::numeric between 1 and hi
          else false
        end
      )
      from (values
        ('pomodoro_focus_min', 180),
        ('pomodoro_short_break_min', 60),
        ('pomodoro_long_break_min', 120),
        ('pomodoro_long_every', 12)
      ) as r (k, hi)
    ), false);
$$;

alter table public.sessions
  add column pomodoro_config jsonb,
  add constraint sessions_pomodoro_config_matches_mode check (
    (mode = 'free' and pomodoro_config is null)
    or (mode = 'pomodoro' and public.is_valid_pomodoro_config(pomodoro_config))
  );

-- Pausa de pomodoro só em sessão de pomodoro. Roda com os direitos de quem
-- grava (a RLS já esconde a sessão alheia).
create function public.check_break_in_pomodoro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'break' and not exists (
    select 1 from public.sessions s where s.id = new.session_id and s.mode = 'pomodoro'
  ) then
    raise exception 'pausa de pomodoro em sessão livre' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger session_pauses_break_in_pomodoro
  before insert or update of kind on public.session_pauses
  for each row execute function public.check_break_in_pomodoro();

-- ---------------------------------------------------------------------------
-- apply_pomodoro: aplica numa transação as viradas de fase calculadas pelo app
-- (@elaps/core, reconcilePomodoro/skipPomodoroPhase): fecha a pausa de
-- pomodoro aberta e cria as pausas que faltam, com os horários exatos.
--
-- Contra duplicar (dois aparelhos abertos): trava a sessão e confere que ela
-- tem exatamente p_expected_pauses pausas, o número que o app viu ao calcular.
-- Se outro aparelho gravou antes, a contagem mudou: 40001, e o app recarrega e
-- recalcula. security invoker: a RLS vale; sessão alheia é "não encontrada".
-- ---------------------------------------------------------------------------

create function public.apply_pomodoro(
  p_session_id uuid,
  p_expected_pauses int,
  p_close_open_at timestamptz,
  p_new_pauses jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.sessions;
  n int;
begin
  select * into s from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'sessão % não encontrada', p_session_id using errcode = 'P0002';
  end if;
  if s.mode <> 'pomodoro' then
    raise exception 'sessão % não é de pomodoro', s.id using errcode = '22023';
  end if;
  if s.ended_at is not null then
    raise exception 'sessão % já encerrada', s.id using errcode = '40001';
  end if;

  select count(*) into n from public.session_pauses where session_id = s.id;
  if n <> p_expected_pauses then
    raise exception 'a sessão mudou: % pausas, esperadas %', n, p_expected_pauses
      using errcode = '40001';
  end if;

  if p_close_open_at is not null then
    update public.session_pauses
       set resumed_at = p_close_open_at
     where session_id = s.id and resumed_at is null and kind = 'break';
    if not found then
      raise exception 'não há pausa de pomodoro aberta' using errcode = '40001';
    end if;
  end if;

  -- Em ordem: só a última pode ficar aberta (índice de uma pausa aberta).
  insert into public.session_pauses (session_id, paused_at, resumed_at, kind)
  select s.id, (e ->> 'paused_at')::timestamptz, (e ->> 'resumed_at')::timestamptz, 'break'
  from jsonb_array_elements(coalesce(p_new_pauses, '[]'::jsonb)) as e
  order by (e ->> 'paused_at')::timestamptz;
end;
$$;

revoke execute on function public.apply_pomodoro(uuid, int, timestamptz, jsonb) from public, anon;
grant execute on function public.apply_pomodoro(uuid, int, timestamptz, jsonb) to authenticated;
