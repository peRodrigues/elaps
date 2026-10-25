-- pgTAP: isolamento entre usuários (RLS) e regras de integridade do Elaps.
-- Rodar com `npm run db:test`. Tudo dentro de uma transação desfeita no fim.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Massa: usuários A e B, cada um com grupo, área, sessão encerrada e pausa.
-- Criada como postgres (sem RLS).
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

insert into public.sessions (id, user_id, area_id, started_at, ended_at) values
  ('1c000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 11:00Z'),
  ('2c000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 11:00Z');

insert into public.session_pauses (id, session_id, paused_at, resumed_at) values
  ('1d000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001', '2026-10-19 10:20Z', '2026-10-19 10:30Z'),
  ('2d000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', '2026-10-19 10:20Z', '2026-10-19 10:30Z');

-- ---------------------------------------------------------------------------
-- Trigger de cadastro
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select timezone, theme from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('America/Sao_Paulo'::text, 'system'::text) $$,
  'cadastro em auth.users cria o profile com fuso e tema padrão'
);
select is(
  (select count(*)::int from public.profiles
    where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')),
  2, 'um profile por usuário cadastrado'
);

-- ---------------------------------------------------------------------------
-- Como usuário A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- Leitura: A vê o que é dele e nada do B.
select is((select count(*)::int from public.profiles), 1, 'A lê só o próprio profile');
select is((select count(*)::int from public.groups where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'A não lê grupos do B');
select is((select count(*)::int from public.areas where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'A não lê áreas do B');
select is((select count(*)::int from public.sessions where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'A não lê sessões do B');
select is((select count(*)::int from public.session_pauses where session_id = '2c000000-0000-4000-8000-000000000001'), 0, 'A não lê pausas do B');
select is((select count(*)::int from public.groups), 1, 'A lê o próprio grupo');
select is((select count(*)::int from public.session_pauses), 1, 'A lê a própria pausa');

-- Alterar e excluir linhas do B não afeta nada.
with u as (update public.profiles set theme = 'dark' where id = '22222222-2222-4222-8222-222222222222' returning 1)
  select is(count(*)::int, 0, 'A não altera profile do B') from u;
with u as (update public.groups set name = 'hack' where id = '2a000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não altera grupo do B') from u;
with u as (update public.areas set name = 'hack' where id = '2b000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não altera área do B') from u;
with u as (update public.sessions set note = 'hack' where id = '2c000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não altera sessão do B') from u;
with u as (update public.session_pauses set resumed_at = '2026-10-19 10:25Z' where id = '2d000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não altera pausa do B') from u;
with d as (delete from public.session_pauses where id = '2d000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não exclui pausa do B') from d;
with d as (delete from public.sessions where id = '2c000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não exclui sessão do B') from d;
with d as (delete from public.areas where id = '2b000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não exclui área do B') from d;
with d as (delete from public.groups where id = '2a000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não exclui grupo do B') from d;
with d as (delete from public.profiles where id = '22222222-2222-4222-8222-222222222222' returning 1)
  select is(count(*)::int, 0, 'A não exclui profile do B') from d;

-- Inserir em nome do B é barrado.
select throws_ok(
  $$ insert into public.profiles (id) values ('22222222-2222-4222-8222-222222222222') $$,
  '42501', null, 'A não cria profile'
);
select throws_ok(
  $$ insert into public.groups (user_id, name, color) values ('22222222-2222-4222-8222-222222222222', 'Invasão', '#000000') $$,
  '42501', null, 'A não cria grupo para o B'
);
select throws_ok(
  $$ insert into public.areas (user_id, group_id, name) values ('22222222-2222-4222-8222-222222222222', '2a000000-0000-4000-8000-000000000001', 'Invasão') $$,
  '42501', null, 'A não cria área para o B'
);
select throws_ok(
  $$ insert into public.sessions (user_id, area_id, started_at, ended_at) values ('22222222-2222-4222-8222-222222222222', '2b000000-0000-4000-8000-000000000001', '2026-10-19 12:00Z', '2026-10-19 13:00Z') $$,
  '42501', null, 'A não cria sessão para o B'
);
select throws_ok(
  $$ insert into public.session_pauses (session_id, paused_at, resumed_at) values ('2c000000-0000-4000-8000-000000000001', '2026-10-19 10:40Z', '2026-10-19 10:45Z') $$,
  '23503', null, 'A não cria pausa na sessão do B (sessão invisível para ele)'
);
select throws_ok(
  $$ update public.groups set user_id = '22222222-2222-4222-8222-222222222222' where id = '1a000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'A não transfere o próprio grupo para o B'
);

-- Vínculos só com dados do mesmo usuário (FK composta id + user_id).
select throws_ok(
  $$ insert into public.areas (group_id, name) values ('2a000000-0000-4000-8000-000000000001', 'CSS') $$,
  '23503', null, 'área com grupo de outro usuário falha'
);
select throws_ok(
  $$ insert into public.sessions (area_id, started_at, ended_at) values ('2b000000-0000-4000-8000-000000000001', '2026-10-19 12:00Z', '2026-10-19 13:00Z') $$,
  '23503', null, 'sessão com área de outro usuário falha'
);

-- Regras do cronômetro.
select lives_ok(
  $$ insert into public.sessions (id, area_id, started_at) values ('1c000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', '2026-10-20 10:00Z') $$,
  'primeira sessão ativa entra (user_id vem de auth.uid())'
);
select throws_ok(
  $$ insert into public.sessions (area_id, started_at) values ('1b000000-0000-4000-8000-000000000001', '2026-10-20 10:05Z') $$,
  '23505', null, 'segunda sessão ativa do mesmo usuário falha'
);
select lives_ok(
  $$ insert into public.session_pauses (id, session_id, paused_at) values ('1d000000-0000-4000-8000-000000000002', '1c000000-0000-4000-8000-000000000002', '2026-10-20 10:30Z') $$,
  'primeira pausa aberta entra'
);
select throws_ok(
  $$ insert into public.session_pauses (session_id, paused_at) values ('1c000000-0000-4000-8000-000000000002', '2026-10-20 10:40Z') $$,
  '23505', null, 'segunda pausa aberta na mesma sessão falha'
);
select throws_ok(
  $$ insert into public.session_pauses (session_id, paused_at, resumed_at) values ('1c000000-0000-4000-8000-000000000002', '2026-10-20 09:50Z', '2026-10-20 09:55Z') $$,
  '23514', null, 'pausa antes do início da sessão falha'
);
select throws_ok(
  $$ update public.sessions set ended_at = '2026-10-20 10:20Z' where id = '1c000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'encerrar antes de uma pausa (aberta às 10:30) falha'
);

-- Parar estando pausado fecha a pausa aberta no instante do fim.
update public.sessions set ended_at = '2026-10-20 11:00Z' where id = '1c000000-0000-4000-8000-000000000002';
select is(
  (select resumed_at from public.session_pauses where id = '1d000000-0000-4000-8000-000000000002'),
  '2026-10-20 11:00Z'::timestamptz,
  'parar a sessão fecha a pausa aberta no mesmo instante'
);
select throws_ok(
  $$ insert into public.session_pauses (session_id, paused_at) values ('1c000000-0000-4000-8000-000000000002', '2026-10-20 10:50Z') $$,
  '23514', null, 'pausa aberta em sessão encerrada falha'
);
select throws_ok(
  $$ insert into public.session_pauses (session_id, paused_at, resumed_at) values ('1c000000-0000-4000-8000-000000000002', '2026-10-20 10:50Z', '2026-10-20 11:30Z') $$,
  '23514', null, 'pausa terminando depois da sessão falha'
);

select throws_ok(
  $$ insert into public.sessions (area_id, started_at, ended_at) values ('1b000000-0000-4000-8000-000000000001', '2026-10-21 10:00Z', '2026-10-21 10:00Z') $$,
  '23514', null, 'ended_at = started_at falha'
);
select throws_ok(
  $$ insert into public.sessions (area_id, started_at, ended_at) values ('1b000000-0000-4000-8000-000000000001', '2026-10-21 10:00Z', '2026-10-21 09:00Z') $$,
  '23514', null, 'ended_at < started_at falha'
);
select throws_ok(
  $$ insert into public.sessions (area_id, started_at, source) values ('1b000000-0000-4000-8000-000000000001', '2026-10-21 10:00Z', 'manual') $$,
  '23514', null, 'sessão manual sem fim falha'
);
select throws_ok(
  $$ insert into public.session_pauses (session_id, paused_at, resumed_at) values ('1c000000-0000-4000-8000-000000000001', '2026-10-19 10:40Z', '2026-10-19 10:40Z') $$,
  '23514', null, 'pausa com resumed_at = paused_at falha'
);

-- Nomes únicos (sem diferenciar maiúsculas) entre os não arquivados.
select throws_ok(
  $$ insert into public.groups (name, color) values ('estudo', '#00FF00') $$,
  '23505', null, 'grupo com mesmo nome (case-insensitive) falha'
);
select throws_ok(
  $$ insert into public.areas (group_id, name) values ('1a000000-0000-4000-8000-000000000001', 'html') $$,
  '23505', null, 'área com mesmo nome no grupo (case-insensitive) falha'
);
update public.groups set archived_at = now() where id = '1a000000-0000-4000-8000-000000000001';
select lives_ok(
  $$ insert into public.groups (id, name, color) values ('1a000000-0000-4000-8000-000000000002', 'Estudo', '#00FF00') $$,
  'arquivar libera o nome do grupo'
);

-- Profile: fuso e tema validados.
select throws_ok(
  $$ update public.profiles set timezone = 'Mars/Olympus' $$,
  '23514', null, 'fuso inválido falha'
);
select throws_ok(
  $$ update public.profiles set theme = 'neon' $$,
  '23514', null, 'tema inválido falha'
);

-- Excluir o grupo de vez cascateia para áreas, sessões e pausas.
delete from public.groups where id = '1a000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.areas where group_id = '1a000000-0000-4000-8000-000000000001'), 0, 'excluir grupo exclui as áreas');
select is((select count(*)::int from public.sessions where area_id = '1b000000-0000-4000-8000-000000000001'), 0, 'excluir grupo exclui as sessões');
select is((select count(*)::int from public.session_pauses), 0, 'excluir grupo exclui as pausas');

-- ---------------------------------------------------------------------------
-- Anônimo não vê nem grava nada
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is((select count(*)::int from public.groups), 0, 'anon não lê grupos');
select is((select count(*)::int from public.sessions), 0, 'anon não lê sessões');
select throws_ok(
  $$ insert into public.groups (user_id, name, color) values ('22222222-2222-4222-8222-222222222222', 'X', '#000000') $$,
  '42501', null, 'anon não cria grupo'
);

-- ---------------------------------------------------------------------------
-- Dados do B continuam intactos (conferido sem RLS)
-- ---------------------------------------------------------------------------

reset role;
select results_eq(
  $$ select (select name from public.groups where id = '2a000000-0000-4000-8000-000000000001'),
            (select note from public.sessions where id = '2c000000-0000-4000-8000-000000000001'),
            (select count(*)::int from public.session_pauses where session_id = '2c000000-0000-4000-8000-000000000001'),
            (select theme from public.profiles where id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values ('Estudo'::text, null::text, 1, 'system'::text) $$,
  'nada do B foi alterado ou excluído'
);

select * from finish();
rollback;
