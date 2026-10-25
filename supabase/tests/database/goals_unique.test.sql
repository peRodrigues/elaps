-- pgTAP: uma meta ativa por (alvo, período). Rodar com `npm run db:test`.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local');
insert into public.groups (id, user_id, name, color) values
  ('1a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Estudo', '#3B82F6');
insert into public.areas (id, user_id, group_id, name) values
  ('1b000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1a000000-0000-4000-8000-000000000001', 'HTML');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.create_goal('total', null, null, 'day', 120) $$,
  'primeira meta total por dia entra'
);
select throws_ok(
  $$ select public.create_goal('total', null, null, 'day', 60) $$,
  '23505', null, 'segunda meta total por dia ativa falha'
);
select lives_ok(
  $$ select public.create_goal('total', null, null, 'week', 600) $$,
  'meta total por semana (outro período) entra'
);
select lives_ok(
  $$ select public.create_goal('group', '1a000000-0000-4000-8000-000000000001', null, 'day', 60) $$,
  'meta do grupo por dia entra junto da total'
);
select throws_ok(
  $$ select public.create_goal('group', '1a000000-0000-4000-8000-000000000001', null, 'day', 30) $$,
  '23505', null, 'segunda meta do mesmo grupo e período falha'
);
select lives_ok(
  $$ select public.create_goal('area', null, '1b000000-0000-4000-8000-000000000001', 'day', 30) $$,
  'meta de área por dia entra'
);
select throws_ok(
  $$ select public.create_goal('area', null, '1b000000-0000-4000-8000-000000000001', 'day', 30) $$,
  '23505', null, 'segunda meta da mesma área e período falha'
);
select is(
  (select count(*)::int from public.goal_versions),
  4, 'a criação que falha não deixa versão órfã'
);

-- Arquivar libera o par; desarquivar com outra ativa no lugar falha.
update public.goals set archived_at = now() where target_kind = 'total' and period = 'day';
select lives_ok(
  $$ select public.create_goal('total', null, null, 'day', 90) $$,
  'arquivar libera o alvo e o período para uma meta nova'
);
select throws_ok(
  $$ update public.goals set archived_at = null where target_kind = 'total' and period = 'day' and archived_at is not null $$,
  '23505', null, 'desarquivar com outra ativa no mesmo alvo e período falha'
);

-- Outro usuário tem o próprio espaço.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.create_goal('total', null, null, 'day', 120) $$,
  'o B cria a própria meta total por dia'
);

select * from finish();
rollback;
