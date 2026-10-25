-- Seed de DESENVOLVIMENTO (roda só no Supabase local, em `npm run db:reset`).
--
-- Usuário dev:  dev@elaps.local  /  senha: elaps-dev
-- (senha de brinquedo, só existe no banco local).
--
-- Dados: grupo Estudo (HTML, CSS, JavaScript) e grupo Trabalho (renpy, synq),
-- com ~14 dias de sessões relativas à data do reset, no fuso America/Sao_Paulo:
-- horários variados, um dia sem nada (quebra o streak), uma sessão cruzando a
-- meia-noite, algumas com pausa e uma manual com nota. Nenhuma fica ativa.

-- ---------------------------------------------------------------------------
-- Usuário (auth.users + identidade de e-mail, para o login por senha funcionar)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dev@elaps.local',
  extensions.crypt('elaps-dev', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}', '{}',
  now(), now(),
  -- O serviço de auth não aceita NULL nesses tokens.
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'email',
  '{"sub": "d0000000-0000-4000-8000-000000000001", "email": "dev@elaps.local", "email_verified": true}',
  now(), now(), now()
);
-- O profile (America/Sao_Paulo, tema system) nasce pelo trigger on_auth_user_created.

-- ---------------------------------------------------------------------------
-- Grupos e áreas
-- ---------------------------------------------------------------------------

insert into public.groups (id, user_id, name, color) values
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Estudo', '#3B82F6'),
  ('a0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Trabalho', '#F97316');

insert into public.areas (id, user_id, group_id, name) values
  ('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'HTML'),
  ('b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'CSS'),
  ('b0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'JavaScript'),
  ('b0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'renpy'),
  ('b0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'synq');

-- ---------------------------------------------------------------------------
-- Sessões dos últimos 14 dias (dia 1 = ontem) e suas pausas
-- ---------------------------------------------------------------------------

-- days_ago, área, hora local de início, minutos de relógio, pausa (início em
-- minutos após o começo, duração), origem, nota.
create temporary table seed_plan (
  days_ago int, area text, start_local time, minutes int,
  pause_after int, pause_minutes int, source text, note text
);

insert into seed_plan values
  (14, 'HTML',       '09:00', 50,  null, null, 'timer',  null),
  (14, 'renpy',      '14:30', 120, 60,   15,   'timer',  null),
  (13, 'CSS',        '08:15', 40,  null, null, 'timer',  null),
  (13, 'synq',       '10:00', 180, 90,   30,   'timer',  null),
  (12, 'JavaScript', '19:00', 75,  null, null, 'timer',  null),
  (11, 'HTML',       '07:30', 30,  null, null, 'timer',  null),
  (11, 'renpy',      '13:00', 150, null, null, 'timer',  null),
  (11, 'JavaScript', '21:00', 60,  25,   10,   'timer',  null),
  (10, 'synq',       '09:30', 240, 120,  45,   'timer',  null),
  (9,  'CSS',        '18:00', 45,  null, null, 'timer',  null),
  -- dia 8: nada (quebra o streak)
  (7,  'JavaScript', '10:00', 90,  null, null, 'manual', 'Curso de JS assistido offline, lançado depois'),
  (7,  'renpy',      '15:00', 100, 50,   20,   'timer',  null),
  (6,  'HTML',       '20:00', 35,  null, null, 'timer',  null),
  (5,  'synq',       '08:45', 200, null, null, 'timer',  null),
  (5,  'JavaScript', '17:30', 55,  null, null, 'timer',  null),
  -- cruza a meia-noite: 23:20 -> 00:40 do dia seguinte
  (4,  'JavaScript', '23:20', 80,  30,   10,   'timer',  null),
  (3,  'CSS',        '11:00', 60,  null, null, 'timer',  null),
  (3,  'renpy',      '14:00', 130, 70,   25,   'timer',  null),
  (2,  'synq',       '09:00', 210, 100,  30,   'timer',  null),
  (2,  'HTML',       '22:00', 40,  null, null, 'timer',  null),
  (1,  'JavaScript', '06:50', 45,  null, null, 'timer',  null),
  (1,  'renpy',      '16:00', 95,  null, null, 'timer',  null);

create temporary table seed_sessions as
select
  gen_random_uuid() as id,
  a.id as area_id,
  -- (data local + hora local) interpretado no fuso do perfil -> timestamptz
  (((now() at time zone 'America/Sao_Paulo')::date - p.days_ago) + p.start_local)
    at time zone 'America/Sao_Paulo' as started_at,
  p.*
from seed_plan p
join public.areas a on a.name = p.area;

insert into public.sessions (id, user_id, area_id, started_at, ended_at, source, note)
select id, 'd0000000-0000-4000-8000-000000000001', area_id,
       started_at, started_at + make_interval(mins => minutes), source, note
from seed_sessions;

insert into public.session_pauses (session_id, paused_at, resumed_at)
select id,
       started_at + make_interval(mins => pause_after),
       started_at + make_interval(mins => pause_after + pause_minutes)
from seed_sessions
where pause_after is not null;
