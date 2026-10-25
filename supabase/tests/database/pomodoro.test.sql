-- pgTAP: fases do pomodoro (kind das pausas, retrato da config e apply_pomodoro).
-- Rodar com `npm run db:test`. Tudo dentro de uma transação desfeita no fim.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Massa (como postgres): A com uma sessão de pomodoro ativa e uma livre
-- encerrada; B com uma sessão de pomodoro ativa.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local');

insert into public.groups (id, user_id, name, color) values
  ('1a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Estudo', '#3B82F6'),
  ('2a000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Estudo', '#F97316');
insert into public.areas (id, user_id, group_id, name) values
  ('1b000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1a000000-0000-4000-8000-000000000001', 'HTML'),
  ('2b000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2a000000-0000-4000-8000-000000000001', 'HTML');

insert into public.sessions (id, user_id, area_id, started_at, ended_at, mode, pomodoro_config) values
  ('1c000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001',
   '2026-10-20 10:00Z', null, 'pomodoro',
   '{"pomodoro_focus_min": 25, "pomodoro_short_break_min": 5, "pomodoro_long_break_min": 15, "pomodoro_long_every": 4}'),
  ('1c000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001',
   '2026-10-19 10:00Z', '2026-10-19 11:00Z', 'free', null),
  ('2c000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2b000000-0000-4000-8000-000000000001',
   '2026-10-20 10:00Z', null, 'pomodoro',
   '{"pomodoro_focus_min": 25, "pomodoro_short_break_min": 5, "pomodoro_long_break_min": 15, "pomodoro_long_every": 4}');

-- ---------------------------------------------------------------------------
-- Colunas e CHECKs
-- ---------------------------------------------------------------------------

insert into public.session_pauses (id, session_id, paused_at, resumed_at) values
  ('1d000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000002', '2026-10-19 10:10Z', '2026-10-19 10:20Z');
select is(
  (select kind from public.session_pauses where id = '1d000000-0000-4000-8000-000000000001'),
  'manual', 'pausa nasce manual'
);
select throws_ok(
  $$ insert into public.sessions (user_id, area_id, started_at, ended_at, mode) values
       ('11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-18 10:00Z', '2026-10-18 11:00Z', 'pomodoro') $$,
  '23514', null, 'sessão de pomodoro sem retrato da config falha'
);
select throws_ok(
  $$ insert into public.sessions (user_id, area_id, started_at, ended_at, mode, pomodoro_config) values
       ('11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-18 10:00Z', '2026-10-18 11:00Z', 'pomodoro',
        '{"pomodoro_focus_min": 0, "pomodoro_short_break_min": 5, "pomodoro_long_break_min": 15, "pomodoro_long_every": 4}') $$,
  '23514', null, 'retrato com foco fora da faixa falha'
);
select throws_ok(
  $$ insert into public.sessions (user_id, area_id, started_at, ended_at, mode, pomodoro_config) values
       ('11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-18 10:00Z', '2026-10-18 11:00Z', 'pomodoro',
        '{"pomodoro_focus_min": 25.5, "pomodoro_short_break_min": 5, "pomodoro_long_break_min": 15, "pomodoro_long_every": 4}') $$,
  '23514', null, 'retrato com valor fracionário falha'
);
select throws_ok(
  $$ insert into public.sessions (user_id, area_id, started_at, ended_at, mode, pomodoro_config) values
       ('11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-18 10:00Z', '2026-10-18 11:00Z', 'pomodoro',
        '{"pomodoro_focus_min": 25}') $$,
  '23514', null, 'retrato incompleto falha'
);
select throws_ok(
  $$ insert into public.sessions (user_id, area_id, started_at, ended_at, mode, pomodoro_config) values
       ('11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-18 10:00Z', '2026-10-18 11:00Z', 'free',
        '{"pomodoro_focus_min": 25, "pomodoro_short_break_min": 5, "pomodoro_long_break_min": 15, "pomodoro_long_every": 4}') $$,
  '23514', null, 'sessão livre com retrato falha'
);
select throws_ok(
  $$ insert into public.session_pauses (session_id, paused_at, resumed_at, kind) values
       ('1c000000-0000-4000-8000-000000000002', '2026-10-19 10:30Z', '2026-10-19 10:35Z', 'break') $$,
  '23514', null, 'pausa de pomodoro em sessão livre falha'
);

-- ---------------------------------------------------------------------------
-- apply_pomodoro como A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- Reconciliação de uma vez: foco 10:00–10:25, pausa 10:25–10:30, foco
-- 10:30–10:55 e pausa aberta desde 10:55.
select lives_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 0, null,
       '[{"paused_at": "2026-10-20T10:55:00Z", "resumed_at": null},
         {"paused_at": "2026-10-20T10:25:00Z", "resumed_at": "2026-10-20T10:30:00Z"}]') $$,
  'apply_pomodoro cria as pausas que faltam (em qualquer ordem no json)'
);
select results_eq(
  $$ select paused_at, resumed_at, kind from public.session_pauses
     where session_id = '1c000000-0000-4000-8000-000000000001' order by paused_at $$,
  $$ values ('2026-10-20 10:25Z'::timestamptz, '2026-10-20 10:30Z'::timestamptz, 'break'::text),
            ('2026-10-20 10:55Z'::timestamptz, null::timestamptz, 'break'::text) $$,
  'pausas de pomodoro com os horários exatos'
);

-- Segundo aparelho com a visão antiga (0 pausas): conflito, nada duplica.
select throws_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 0, null,
       '[{"paused_at": "2026-10-20T10:25:00Z", "resumed_at": "2026-10-20T10:30:00Z"}]') $$,
  '40001', null, 'contagem diferente da esperada dá 40001'
);
select is(
  (select count(*)::int from public.session_pauses where session_id = '1c000000-0000-4000-8000-000000000001'),
  2, 'nenhuma pausa duplicada'
);

-- Fim da pausa: fecha a aberta no instante exato.
select lives_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 2, '2026-10-20T11:00:00Z', null) $$,
  'apply_pomodoro fecha a pausa de pomodoro aberta'
);
select is(
  (select resumed_at from public.session_pauses where session_id = '1c000000-0000-4000-8000-000000000001' and paused_at = '2026-10-20 10:55Z'),
  '2026-10-20 11:00Z'::timestamptz, 'fechada no horário enviado'
);
select throws_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 2, '2026-10-20T11:05:00Z', null) $$,
  '40001', null, 'fechar sem pausa de pomodoro aberta dá 40001'
);

-- Pausa manual aberta não é fechada pela RPC.
insert into public.session_pauses (session_id, paused_at) values
  ('1c000000-0000-4000-8000-000000000001', '2026-10-20 11:10Z');
select throws_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 3, '2026-10-20T11:15:00Z', null) $$,
  '40001', null, 'a RPC não fecha pausa manual'
);
select throws_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 3, null,
       '[{"paused_at": "2026-10-20T11:20:00Z", "resumed_at": null}]') $$,
  '23505', null, 'segunda pausa aberta continua barrada pelo índice'
);

select throws_ok(
  $$ select public.apply_pomodoro('2c000000-0000-4000-8000-000000000001', 0, null,
       '[{"paused_at": "2026-10-20T10:25:00Z", "resumed_at": "2026-10-20T10:30:00Z"}]') $$,
  'P0002', null, 'sessão de outro usuário é não encontrada'
);
select throws_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000002', 1, null,
       '[{"paused_at": "2026-10-19T10:30:00Z", "resumed_at": "2026-10-19T10:35:00Z"}]') $$,
  '22023', null, 'sessão livre é recusada'
);
select throws_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 3, null,
       '[{"paused_at": "2026-10-20T09:00:00Z", "resumed_at": "2026-10-20T09:05:00Z"}]') $$,
  '23514', null, 'pausa antes do início da sessão falha (trigger existente)'
);

-- edit_session preserva o kind das pausas que corta.
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001',
       '2026-10-20 10:00Z', '2026-10-20 10:58Z', null) $$,
  'encerrar a sessão de pomodoro no meio de uma pausa pela edit_session'
);
select results_eq(
  $$ select paused_at, resumed_at, kind from public.session_pauses
     where session_id = '1c000000-0000-4000-8000-000000000001' order by paused_at $$,
  $$ values ('2026-10-20 10:25Z'::timestamptz, '2026-10-20 10:30Z'::timestamptz, 'break'::text),
            ('2026-10-20 10:55Z'::timestamptz, '2026-10-20 10:58Z'::timestamptz, 'break'::text) $$,
  'a pausa cortada continua break; as depois do fim somem'
);
select throws_ok(
  $$ select public.apply_pomodoro('1c000000-0000-4000-8000-000000000001', 2, null, '[]') $$,
  '40001', null, 'sessão encerrada dá 40001'
);

-- anon não executa.
reset role;
set local role anon;
select throws_ok(
  $$ select public.apply_pomodoro('2c000000-0000-4000-8000-000000000001', 0, null, '[]') $$,
  '42501', null, 'anon não executa apply_pomodoro'
);

reset role;
select is(
  (select count(*)::int from public.session_pauses where session_id = '2c000000-0000-4000-8000-000000000001'),
  0, 'nada do B foi alterado'
);

select * from finish();
rollback;
