-- pgTAP: v2 (metas, tags, pomodoro e compartilhamento): RLS, regras e cascatas.
-- Rodar com `npm run db:test`. Tudo dentro de uma transação desfeita no fim.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Massa (como postgres): A e B, cada um com grupo, área, sessão, meta com
-- versão, tag aplicada e um compartilhamento; A tem também um revogado.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local');

insert into public.groups (id, user_id, name, color) values
  ('1a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Estudo', '#3B82F6'),
  ('1a000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Trabalho', '#F97316'),
  ('2a000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Estudo', '#F97316');

insert into public.areas (id, user_id, group_id, name) values
  ('1b000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1a000000-0000-4000-8000-000000000001', 'HTML'),
  ('1b000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '1a000000-0000-4000-8000-000000000002', 'renpy'),
  ('2b000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2a000000-0000-4000-8000-000000000001', 'HTML');

insert into public.sessions (id, user_id, area_id, started_at, ended_at) values
  ('1c000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 11:00Z'),
  ('1c000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '1b000000-0000-4000-8000-000000000002', '2026-10-19 12:00Z', '2026-10-19 13:00Z'),
  ('2c000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2b000000-0000-4000-8000-000000000001', '2026-10-19 10:00Z', '2026-10-19 11:00Z');

insert into public.goals (id, user_id, target_kind, group_id, area_id, period) values
  ('2e000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'total', null, null, 'day');
insert into public.goal_versions (goal_id, target_minutes, effective_from) values
  ('2e000000-0000-4000-8000-000000000001', 120, '2026-10-01');

insert into public.tags (id, user_id, name) values
  ('1f000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'revisão'),
  ('1f000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'leitura'),
  ('2f000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'revisão');
insert into public.session_tags (session_id, tag_id, user_id) values
  ('2c000000-0000-4000-8000-000000000001', '2f000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222');

insert into public.shares (id, token, user_id, period_label, period_start, period_end, payload) values
  ('15000000-0000-4000-8000-000000000001', 'tokenAtokenAtokenAtokenAtokenAtA', '11111111-1111-4111-8111-111111111111', 'Semana de 19 a 25/10', '2026-10-19', '2026-10-25', '{"totalMs": 3600000}'),
  ('15000000-0000-4000-8000-000000000002', 'revogadoRevogadoRevogadoRevogado', '11111111-1111-4111-8111-111111111111', 'Hoje', '2026-10-19', '2026-10-19', '{"totalMs": 1}'),
  ('25000000-0000-4000-8000-000000000001', 'tokenBtokenBtokenBtokenBtokenBtB', '22222222-2222-4222-8222-222222222222', 'Hoje', '2026-10-19', '2026-10-19', '{"totalMs": 2}');
update public.shares set revoked_at = now() where id = '15000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Colunas novas e padrões
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select pomodoro_focus_min, pomodoro_short_break_min, pomodoro_long_break_min, pomodoro_long_every
     from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (25, 5, 15, 4) $$,
  'profile nasce com os padrões do pomodoro (25/5/15 a cada 4)'
);
select is(
  (select mode from public.sessions where id = '1c000000-0000-4000-8000-000000000001'),
  'free', 'sessão nasce no modo free'
);
select matches(
  (select token from public.shares where id = '25000000-0000-4000-8000-000000000001'),
  '^[A-Za-z0-9_-]{32}$', 'token de teste no formato aceito'
);

-- ---------------------------------------------------------------------------
-- Como usuário A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- Isolamento: nada do B aparece.
select is((select count(*)::int from public.goals), 0, 'A não vê metas do B');
select is((select count(*)::int from public.goal_versions), 0, 'A não vê versões de meta do B');
select is((select count(*)::int from public.tags), 2, 'A vê só as próprias tags');
select is((select count(*)::int from public.session_tags), 0, 'A não vê vínculos de tag do B');
select is((select count(*)::int from public.shares), 2, 'A vê só os próprios compartilhamentos');

-- Pomodoro e modo: faixas.
select throws_ok(
  $$ update public.profiles set pomodoro_focus_min = 0 where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null, 'foco de 0 min falha'
);
select throws_ok(
  $$ update public.profiles set pomodoro_long_every = 13 where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null, 'pausa longa a cada 13 focos falha'
);
select lives_ok(
  $$ update public.profiles set pomodoro_focus_min = 50, pomodoro_short_break_min = 10 where id = '11111111-1111-4111-8111-111111111111' $$,
  'A ajusta o próprio pomodoro'
);
select throws_ok(
  $$ update public.sessions set mode = 'turbo' where id = '1c000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'modo de sessão desconhecido falha'
);
select lives_ok(
  $$ update public.sessions set mode = 'pomodoro' where id = '1c000000-0000-4000-8000-000000000001' $$,
  'sessão em modo pomodoro grava'
);

-- Metas: criação pela RPC já com a primeira versão.
select lives_ok(
  $$ select public.create_goal('total', null, null, 'day', 120) $$,
  'create_goal cria meta total'
);
select results_eq(
  $$ select v.target_minutes, v.effective_from
     from public.goal_versions v join public.goals g on g.id = v.goal_id
     where g.target_kind = 'total' $$,
  $$ values (120, (now() at time zone 'America/Sao_Paulo')::date) $$,
  'a meta nasce com uma versão, vigente desde hoje no fuso do perfil'
);
select lives_ok(
  $$ select public.create_goal('group', '1a000000-0000-4000-8000-000000000001', null, 'week', 600, '2026-10-19') $$,
  'create_goal cria meta de grupo com data explícita'
);
select lives_ok(
  $$ select public.create_goal('area', null, '1b000000-0000-4000-8000-000000000002', 'month', 1200, '2026-10-01') $$,
  'create_goal cria meta de área'
);
select is((select count(*)::int from public.goal_versions), 3, 'cada meta criada tem uma versão');

-- Metas: alvo coerente com o tipo.
select throws_ok(
  $$ insert into public.goals (target_kind, group_id, period) values ('total', '1a000000-0000-4000-8000-000000000001', 'day') $$,
  '23514', null, 'meta total com grupo falha'
);
select throws_ok(
  $$ insert into public.goals (target_kind, period) values ('group', 'week') $$,
  '23514', null, 'meta de grupo sem grupo falha'
);
select throws_ok(
  $$ insert into public.goals (target_kind, group_id, area_id, period) values ('area', '1a000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'week') $$,
  '23514', null, 'meta de área com grupo também falha'
);
select throws_ok(
  $$ insert into public.goals (target_kind, period) values ('total', 'year') $$,
  '23514', null, 'período desconhecido falha'
);
select throws_ok(
  $$ select public.create_goal('area', null, '2b000000-0000-4000-8000-000000000001', 'week', 60) $$,
  '23503', null, 'meta com área de outro usuário falha'
);
select throws_ok(
  $$ insert into public.goals (target_kind, group_id, period) values ('group', '2a000000-0000-4000-8000-000000000001', 'week') $$,
  '23503', null, 'meta com grupo de outro usuário falha'
);
select throws_ok(
  $$ insert into public.goals (user_id, target_kind, period) values ('22222222-2222-4222-8222-222222222222', 'total', 'day') $$,
  '42501', null, 'A não cria meta para o B'
);

-- Versões: alvo positivo, uma por dia de vigência, só em meta própria.
select throws_ok(
  $$ insert into public.goal_versions (goal_id, target_minutes, effective_from)
     select id, 0, '2026-11-01' from public.goals where target_kind = 'group' $$,
  '23514', null, 'versão com 0 min falha'
);
select throws_ok(
  $$ insert into public.goal_versions (goal_id, target_minutes, effective_from)
     select id, 480, '2026-10-19' from public.goals where target_kind = 'group' $$,
  '23505', null, 'duas versões no mesmo dia de vigência falham'
);
select lives_ok(
  $$ insert into public.goal_versions (goal_id, target_minutes, effective_from)
     select id, 480, '2026-10-26' from public.goals where target_kind = 'group' $$,
  'nova versão com outra data grava'
);
select throws_ok(
  $$ insert into public.goal_versions (goal_id, target_minutes, effective_from) values ('2e000000-0000-4000-8000-000000000001', 60, '2026-11-01') $$,
  '42501', null, 'A não cria versão na meta do B'
);
with u as (update public.goals set archived_at = now() where id = '2e000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não arquiva meta do B') from u;

-- Tags: nome único sem diferenciar maiúsculas entre as ativas.
select throws_ok(
  $$ insert into public.tags (name) values ('Revisão') $$,
  '23505', null, 'tag com o mesmo nome (outra caixa) falha'
);
select throws_ok(
  $$ insert into public.tags (name) values ('   ') $$,
  '23514', null, 'tag com nome vazio falha'
);
select lives_ok(
  $$ update public.tags set archived_at = now() where id = '1f000000-0000-4000-8000-000000000001' $$,
  'A arquiva a tag revisão'
);
select lives_ok(
  $$ insert into public.tags (id, name) values ('1f000000-0000-4000-8000-000000000003', 'REVISÃO') $$,
  'arquivar libera o nome para uma tag nova'
);
select throws_ok(
  $$ insert into public.tags (user_id, name) values ('22222222-2222-4222-8222-222222222222', 'invasão') $$,
  '42501', null, 'A não cria tag para o B'
);

-- session_tags: sessão e tag do mesmo usuário.
select lives_ok(
  $$ insert into public.session_tags (session_id, tag_id) values
       ('1c000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000002'),
       ('1c000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000003'),
       ('1c000000-0000-4000-8000-000000000002', '1f000000-0000-4000-8000-000000000002') $$,
  'A aplica as próprias tags às próprias sessões (várias por sessão)'
);
select throws_ok(
  $$ insert into public.session_tags (session_id, tag_id) values ('1c000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000002') $$,
  '23505', null, 'a mesma tag duas vezes na sessão falha'
);
select throws_ok(
  $$ insert into public.session_tags (session_id, tag_id) values ('2c000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000002') $$,
  '23503', null, 'tag do A na sessão do B falha'
);
select throws_ok(
  $$ insert into public.session_tags (session_id, tag_id) values ('1c000000-0000-4000-8000-000000000001', '2f000000-0000-4000-8000-000000000001') $$,
  '23503', null, 'tag do B na sessão do A falha'
);
select throws_ok(
  $$ insert into public.session_tags (session_id, tag_id, user_id) values ('2c000000-0000-4000-8000-000000000001', '2f000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222') $$,
  '42501', null, 'A não cria vínculo em nome do B'
);

-- Cascatas.
delete from public.sessions where id = '1c000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.session_tags where session_id = '1c000000-0000-4000-8000-000000000002'),
  0, 'excluir a sessão exclui os vínculos de tag dela'
);
delete from public.tags where id = '1f000000-0000-4000-8000-000000000003';
select is(
  (select count(*)::int from public.session_tags where tag_id = '1f000000-0000-4000-8000-000000000003'),
  0, 'excluir a tag exclui os vínculos dela'
);
select is((select count(*)::int from public.session_tags), 1, 'o outro vínculo fica');

delete from public.areas where id = '1b000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.goals where target_kind = 'area'), 0, 'excluir a área exclui a meta dela');
delete from public.groups where id = '1a000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.goals where target_kind = 'group'), 0, 'excluir o grupo exclui a meta dele');
select is((select count(*)::int from public.goals), 1, 'a meta total fica');
select is(
  (select count(*)::int from public.goal_versions),
  1, 'as versões das metas excluídas somem junto'
);
delete from public.goals where target_kind = 'total';
select is((select count(*)::int from public.goal_versions), 0, 'excluir a meta exclui as versões');

-- Compartilhamentos: insert só com as colunas do app; token vem do banco.
select lives_ok(
  $$ insert into public.shares (period_label, period_start, period_end, payload, hide_area_names)
     values ('Outubro', '2026-10-01', '2026-10-31', '{"totalMs": 5}', true) $$,
  'A cria um compartilhamento'
);
select matches(
  (select token from public.shares where period_label = 'Outubro'),
  '^[A-Za-z0-9_-]{32}$', 'o token gerado tem 32 caracteres base64url'
);
select isnt(
  (select token from public.shares where period_label = 'Outubro'),
  (select token from public.shares where id = '15000000-0000-4000-8000-000000000001'),
  'tokens diferentes'
);
select throws_ok(
  $$ insert into public.shares (token, period_label, period_start, period_end, payload) values ('escolhidoPeloAppescolhidoPeloApp', 'x', '2026-10-01', '2026-10-01', '{}') $$,
  '42501', null, 'o app não escolhe o token'
);
select throws_ok(
  $$ insert into public.shares (period_label, period_start, period_end, payload) values ('x', '2026-10-02', '2026-10-01', '{}') $$,
  '23514', null, 'fim antes do início falha'
);
select throws_ok(
  $$ insert into public.shares (period_label, period_start, period_end, payload) values ('x', '2026-10-01', '2026-10-01', '[1, 2]') $$,
  '23514', null, 'payload que não é objeto falha'
);
select throws_ok(
  $$ update public.shares set payload = '{"totalMs": 999}' where id = '15000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'o snapshot não muda depois de criado'
);
select throws_ok(
  $$ delete from public.shares where id = '15000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'compartilhamento não é excluído, só revogado'
);
select lives_ok(
  $$ update public.shares set revoked_at = '2000-01-01Z' where period_label = 'Outubro' $$,
  'A revoga o próprio compartilhamento'
);
select ok(
  (select revoked_at > '2026-01-01Z' from public.shares where period_label = 'Outubro'),
  'o horário da revogação é o do banco, não o enviado'
);
select throws_ok(
  $$ update public.shares set revoked_at = null where period_label = 'Outubro' $$,
  '23514', null, 'revogar não tem volta'
);
with u as (update public.shares set revoked_at = now() where id = '25000000-0000-4000-8000-000000000001' returning 1)
  select is(count(*)::int, 0, 'A não revoga compartilhamento do B') from u;
select throws_ok(
  $$ insert into public.shares (user_id, period_label, period_start, period_end, payload) values ('22222222-2222-4222-8222-222222222222', 'x', '2026-10-01', '2026-10-01', '{}') $$,
  '42501', null, 'A não cria compartilhamento para o B'
);

-- ---------------------------------------------------------------------------
-- Como anon: só get_share
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select * from public.shares $$,
  '42501', null, 'anon não tem select em shares'
);
select throws_ok(
  $$ insert into public.shares (period_label, period_start, period_end, payload) values ('x', '2026-10-01', '2026-10-01', '{}') $$,
  '42501', null, 'anon não cria compartilhamento'
);
select results_eq(
  $$ select period_label, period_start, period_end, hide_area_names, payload from public.get_share('tokenAtokenAtokenAtokenAtokenAtA') $$,
  $$ values ('Semana de 19 a 25/10'::text, '2026-10-19'::date, '2026-10-25'::date, false, '{"totalMs": 3600000}'::jsonb) $$,
  'get_share com token válido devolve o snapshot'
);
select is_empty(
  $$ select * from public.get_share('revogadoRevogadoRevogadoRevogado') $$,
  'get_share com token revogado não devolve nada'
);
select is_empty(
  $$ select * from public.get_share('naoExisteNaoExisteNaoExisteNaoEx') $$,
  'get_share com token inexistente não devolve nada'
);
select is((select count(*)::int from public.goals), 0, 'anon não lê metas');
select is((select count(*)::int from public.tags), 0, 'anon não lê tags');
select is((select count(*)::int from public.session_tags), 0, 'anon não lê vínculos de tag');
select throws_ok(
  $$ select public.create_goal('total', null, null, 'day', 60) $$,
  '42501', null, 'anon não executa create_goal'
);

-- ---------------------------------------------------------------------------
-- De volta como postgres: o B continua intacto.
-- ---------------------------------------------------------------------------

reset role;
select results_eq(
  $$ select (select count(*) from public.goals where user_id = '22222222-2222-4222-8222-222222222222')::int,
            (select count(*) from public.goal_versions where goal_id = '2e000000-0000-4000-8000-000000000001')::int,
            (select count(*) from public.tags where user_id = '22222222-2222-4222-8222-222222222222')::int,
            (select count(*) from public.session_tags where user_id = '22222222-2222-4222-8222-222222222222')::int,
            (select count(*) from public.shares where user_id = '22222222-2222-4222-8222-222222222222' and revoked_at is null)::int,
            (select archived_at is null from public.goals where id = '2e000000-0000-4000-8000-000000000001') $$,
  $$ values (1, 1, 1, 1, 1, true) $$,
  'nada do B foi alterado ou excluído'
);

select * from finish();
rollback;
