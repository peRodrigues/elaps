-- pgTAP: public.edit_session (edição atômica de área, início, fim e nota).
-- Rodar com `npm run db:test`. Tudo dentro de uma transação desfeita no fim.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Massa (como postgres): A com duas áreas, sessão encerrada com duas pausas e
-- sessão ativa com pausa aberta; B com uma sessão.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local');

insert into public.groups (id, user_id, name, color) values
  ('1a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Estudo', '#3B82F6'),
  ('2a000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Estudo', '#F97316');

insert into public.areas (id, user_id, group_id, name) values
  ('1b000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1a000000-0000-4000-8000-000000000001', 'HTML'),
  ('1b000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '1a000000-0000-4000-8000-000000000001', 'CSS'),
  ('2b000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2a000000-0000-4000-8000-000000000001', 'HTML');

-- Encerrada 10:00–11:00 com pausas 10:10–10:20 e 10:40–10:50.
insert into public.sessions (id, user_id, area_id, started_at, ended_at, note) values
  ('1c000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 11:00Z', 'antes'),
  ('2c000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 11:00Z', null);
insert into public.session_pauses (id, session_id, paused_at, resumed_at) values
  ('1d000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001', '2026-10-19 10:10Z', '2026-10-19 10:20Z'),
  ('1d000000-0000-4000-8000-000000000002', '1c000000-0000-4000-8000-000000000001', '2026-10-19 10:40Z', '2026-10-19 10:50Z');

-- Ativa desde 09:00 de 20/10 com pausa fechada 09:10–09:20 e aberta desde 12:00.
insert into public.sessions (id, user_id, area_id, started_at) values
  ('1c000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-20 09:00Z');
insert into public.session_pauses (id, session_id, paused_at, resumed_at) values
  ('1d000000-0000-4000-8000-000000000003', '1c000000-0000-4000-8000-000000000002', '2026-10-20 09:10Z', '2026-10-20 09:20Z'),
  ('1d000000-0000-4000-8000-000000000004', '1c000000-0000-4000-8000-000000000002', '2026-10-20 12:00Z', null);

-- Atalho de leitura das pausas de uma sessão, em ordem.
create function pg_temp.pauses_of(sid uuid)
returns table (paused_at timestamptz, resumed_at timestamptz)
language sql as $$
  select paused_at, resumed_at from public.session_pauses where session_id = sid order by paused_at
$$;

-- ---------------------------------------------------------------------------
-- Como usuário A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- Fim antes da segunda pausa terminar: ela é cortada no novo fim.
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 10:45Z', 'antes') $$,
  'encurtar o fim para o meio de uma pausa grava'
);
select results_eq(
  $$ select * from pg_temp.pauses_of('1c000000-0000-4000-8000-000000000001') $$,
  $$ values ('2026-10-19 10:10Z'::timestamptz, '2026-10-19 10:20Z'::timestamptz),
            ('2026-10-19 10:40Z'::timestamptz, '2026-10-19 10:45Z'::timestamptz) $$,
  'pausa que atravessa o novo fim é cortada; a anterior fica igual'
);

-- Fim antes da segunda pausa começar: ela some; a primeira é cortada.
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 10:15Z', 'antes') $$,
  'encurtar o fim para antes de uma pausa grava'
);
select results_eq(
  $$ select * from pg_temp.pauses_of('1c000000-0000-4000-8000-000000000001') $$,
  $$ values ('2026-10-19 10:10Z'::timestamptz, '2026-10-19 10:15Z'::timestamptz) $$,
  'pausa depois do novo fim é apagada e a que o atravessa é cortada'
);

-- Início no meio da pausa: corta o começo dela.
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', '2026-10-19 10:12Z', '2026-10-19 10:15Z', 'antes') $$,
  'adiar o início para o meio de uma pausa grava'
);
select results_eq(
  $$ select * from pg_temp.pauses_of('1c000000-0000-4000-8000-000000000001') $$,
  $$ values ('2026-10-19 10:12Z'::timestamptz, '2026-10-19 10:15Z'::timestamptz) $$,
  'pausa que atravessa o novo início é cortada'
);

-- Área, horários e nota mudam juntos; nota vazia vira null.
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000002', '2026-10-19 14:00Z', '2026-10-19 14:30Z', '  ') $$,
  'mover a sessão para outro horário e outra área grava'
);
select results_eq(
  $$ select area_id, started_at, ended_at, note from public.sessions where id = '1c000000-0000-4000-8000-000000000001' $$,
  $$ values ('1b000000-0000-4000-8000-000000000002'::uuid, '2026-10-19 14:00Z'::timestamptz, '2026-10-19 14:30Z'::timestamptz, null::text) $$,
  'área, início, fim e nota (vazia -> null) gravados'
);
select is(
  (select count(*)::int from public.session_pauses where session_id = '1c000000-0000-4000-8000-000000000001'),
  0, 'pausas que ficaram fora do novo horário somem'
);

-- Atomicidade: uma edição inválida não muda nada (nem as pausas).
select throws_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', '2026-10-20 09:00Z', '2026-10-20 09:00Z', null) $$,
  '23514', null, 'fim = início falha'
);
select throws_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000001', '2026-10-20 09:00Z', '2026-10-20 09:15Z', null) $$,
  '23503', null, 'área de outro usuário falha'
);
select results_eq(
  $$ select * from pg_temp.pauses_of('1c000000-0000-4000-8000-000000000002') $$,
  $$ values ('2026-10-20 09:10Z'::timestamptz, '2026-10-20 09:20Z'::timestamptz),
            ('2026-10-20 12:00Z'::timestamptz, null::timestamptz) $$,
  'edição que falhou não mexeu nas pausas (transação única)'
);
select is(
  (select ended_at from public.sessions where id = '1c000000-0000-4000-8000-000000000002'),
  null, 'edição que falhou não encerrou a sessão'
);

-- Encerrar a ativa no passado, no meio da pausa aberta: ela fecha no fim.
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', '2026-10-20 09:00Z', '2026-10-20 12:30Z', null) $$,
  'encerrar a sessão ativa num horário passado grava'
);
select results_eq(
  $$ select * from pg_temp.pauses_of('1c000000-0000-4000-8000-000000000002') $$,
  $$ values ('2026-10-20 09:10Z'::timestamptz, '2026-10-20 09:20Z'::timestamptz),
            ('2026-10-20 12:00Z'::timestamptz, '2026-10-20 12:30Z'::timestamptz) $$,
  'pausa aberta é fechada no novo fim'
);

-- Ativa com pausa aberta que começa depois do novo fim: a pausa some.
insert into public.sessions (id, area_id, started_at) values
  ('1c000000-0000-4000-8000-000000000003', '1b000000-0000-4000-8000-000000000001', '2026-10-21 09:00Z');
insert into public.session_pauses (session_id, paused_at) values
  ('1c000000-0000-4000-8000-000000000003', '2026-10-21 15:00Z');
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000003', '1b000000-0000-4000-8000-000000000001', '2026-10-21 09:00Z', '2026-10-21 10:00Z', 'esquecido') $$,
  'encerrar a ativa antes da pausa aberta grava'
);
select is(
  (select count(*)::int from public.session_pauses where session_id = '1c000000-0000-4000-8000-000000000003'),
  0, 'pausa aberta depois do novo fim é apagada'
);
select is(
  (select ended_at from public.sessions where id = '1c000000-0000-4000-8000-000000000003'),
  '2026-10-21 10:00Z'::timestamptz, 'sessão ativa encerrada no novo fim'
);

-- Sessão de outro usuário: não encontrada.
select throws_ok(
  $$ select public.edit_session('2c000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 10:30Z', 'hack') $$,
  'P0002', null, 'A não edita sessão do B'
);

-- Sobreposição entre sessões continua permitida.
select lives_ok(
  $$ select public.edit_session('1c000000-0000-4000-8000-000000000003', '1b000000-0000-4000-8000-000000000001', '2026-10-20 09:30Z', '2026-10-20 10:30Z', null) $$,
  'sessão pode sobrepor outra do mesmo usuário'
);

-- ---------------------------------------------------------------------------
-- Anônimo não executa; dados do B intactos
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$ select public.edit_session('2c000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 10:30Z', null) $$,
  '42501', null, 'anon não executa edit_session'
);

reset role;
select results_eq(
  $$ select started_at, ended_at, note from public.sessions where id = '2c000000-0000-4000-8000-000000000001' $$,
  $$ values ('2026-10-19 10:00Z'::timestamptz, '2026-10-19 11:00Z'::timestamptz, null::text) $$,
  'sessão do B continua igual'
);

select * from finish();
rollback;
