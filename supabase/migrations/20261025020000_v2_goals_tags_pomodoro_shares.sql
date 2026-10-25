-- Elaps v2: metas, tags, pomodoro opcional e compartilhamento.
-- É a única migração da v2 que cria tabelas. Os nomes espelham
-- packages/core/src/types.ts.

-- ---------------------------------------------------------------------------
-- Pomodoro: padrões no perfil e modo por sessão
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column pomodoro_focus_min int not null default 25
    check (pomodoro_focus_min between 1 and 180),
  add column pomodoro_short_break_min int not null default 5
    check (pomodoro_short_break_min between 1 and 60),
  add column pomodoro_long_break_min int not null default 15
    check (pomodoro_long_break_min between 1 and 120),
  -- Pausa longa a cada N focos.
  add column pomodoro_long_every int not null default 4
    check (pomodoro_long_every between 1 and 12);

-- As fases de pausa do pomodoro são session_pauses comuns: o tempo líquido
-- continua certo sem coluna nova.
alter table public.sessions
  add column mode text not null default 'free' check (mode in ('free', 'pomodoro'));

-- Alvo da FK composta de session_tags (sessão e tag do mesmo usuário).
alter table public.sessions
  add constraint sessions_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- goals: meta "no mínimo X min" por período, sobre o total, um grupo ou uma área
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('total', 'group', 'area')),
  group_id uuid,
  area_id uuid,
  -- Semana começa na segunda; dia e semana no fuso do perfil.
  period text not null check (period in ('day', 'week', 'month')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mesmo user_id do grupo/da área (FK com coluna nula não é checada, então
  -- só vale a do alvo preenchido); excluir o grupo ou a área exclui a meta.
  foreign key (group_id, user_id) references public.groups (id, user_id) on delete cascade,
  foreign key (area_id, user_id) references public.areas (id, user_id) on delete cascade,
  constraint goals_target_matches_kind check (
    (target_kind = 'total' and group_id is null and area_id is null)
    or (target_kind = 'group' and group_id is not null and area_id is null)
    or (target_kind = 'area' and area_id is not null and group_id is null)
  )
);

create index goals_user_id_idx on public.goals (user_id);
create index goals_group_id_idx on public.goals (group_id);
create index goals_area_id_idx on public.goals (area_id);

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goal_versions: o alvo em minutos muda sem reescrever o histórico
-- ---------------------------------------------------------------------------

-- Regra de avaliação (implementada no core, V3): cada período usa a versão
-- vigente no dia em que ele começa = a de maior effective_from <= esse dia.
-- Períodos que começam antes da primeira versão usam a primeira (a meta vale
-- desde o período em que foi criada). Sem user_id: o dono é o da meta.
create table public.goal_versions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  target_minutes int not null check (target_minutes > 0),
  -- Dia de calendário no fuso do perfil.
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (goal_id, effective_from)
);

-- Toda meta nasce com uma versão: crie metas por esta função (meta + primeira
-- versão na mesma transação). Mudar o alvo depois = inserir outra versão.
-- security invoker: a RLS vale para as duas tabelas.
create function public.create_goal(
  p_target_kind text,
  p_group_id uuid,
  p_area_id uuid,
  p_period text,
  p_target_minutes int,
  p_effective_from date default null
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  g public.goals;
begin
  insert into public.goals (target_kind, group_id, area_id, period)
  values (p_target_kind, p_group_id, p_area_id, p_period)
  returning * into g;

  insert into public.goal_versions (goal_id, target_minutes, effective_from)
  values (
    g.id,
    p_target_minutes,
    -- Padrão: hoje no fuso do perfil.
    coalesce(p_effective_from, (
      select (now() at time zone p.timezone)::date
      from public.profiles p where p.id = g.user_id
    ))
  );

  return g;
end;
$$;

revoke execute on function public.create_goal(text, uuid, uuid, text, int, date) from public, anon;
grant execute on function public.create_goal(text, uuid, uuid, text, int, date) to authenticated;

-- ---------------------------------------------------------------------------
-- tags e session_tags
-- ---------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- Nome único por usuário, sem diferenciar maiúsculas, entre as não arquivadas.
create unique index tags_name_unique_active
  on public.tags (user_id, lower(name))
  where archived_at is null;

create trigger tags_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

-- user_id existe só para as FKs compostas: sessão e tag do mesmo usuário,
-- garantido no banco. Excluir a sessão ou a tag exclui o vínculo.
create table public.session_tags (
  session_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, tag_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

create index session_tags_tag_id_idx on public.session_tags (tag_id);

-- ---------------------------------------------------------------------------
-- shares: snapshot imutável de um período, lido em público só por get_share
-- ---------------------------------------------------------------------------

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  -- 32 caracteres base64url (192 bits aleatórios). O app não escolhe o token:
  -- a coluna fica fora do grant de insert abaixo.
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_')
    check (token ~ '^[A-Za-z0-9_-]{32,}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Rótulo pronto para exibir (ex.: "Semana de 19 a 25/10") e o intervalo de
  -- dias, inclusivo, no fuso do perfil.
  period_label text not null check (length(btrim(period_label)) between 1 and 80),
  period_start date not null,
  period_end date not null,
  -- Resumo calculado pelo app (summarizePeriod reduzido). Com hide_area_names,
  -- o app já manda o payload sem nomes de área; a flag fica para a exibição.
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536),
  hide_area_names boolean not null default false,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint shares_period_order check (period_end >= period_start)
);

create index shares_user_id_idx on public.shares (user_id, created_at desc);

-- Revogar é a única alteração e não tem volta: o horário é o do banco.
create function public.revoke_share_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null then
    raise exception 'compartilhamento já revogado' using errcode = '23514';
  end if;
  if new.revoked_at is null then
    raise exception 'só é possível revogar um compartilhamento' using errcode = '23514';
  end if;
  new.revoked_at := now();
  return new;
end;
$$;

create trigger shares_revoke_only
  before update on public.shares
  for each row execute function public.revoke_share_only();

-- Leitura pública pelo token. security definer porque anon não tem select na
-- tabela; devolve só o necessário para exibir (nem user_id, nem o próprio
-- token) e nada se o token não existe ou foi revogado.
create function public.get_share(p_token text)
returns table (
  period_label text,
  period_start date,
  period_end date,
  hide_area_names boolean,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.period_label, s.period_start, s.period_end, s.hide_area_names, s.payload, s.created_at
  from public.shares s
  where s.token = p_token and s.revoked_at is null;
$$;

revoke execute on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.goals enable row level security;
alter table public.goal_versions enable row level security;
alter table public.tags enable row level security;
alter table public.session_tags enable row level security;
alter table public.shares enable row level security;

create policy "goals: dono" on public.goals
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "goal_versions: dono da meta" on public.goal_versions
  for all to authenticated
  using (exists (
    select 1 from public.goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.goals g
    where g.id = goal_id and g.user_id = (select auth.uid())
  ));

create index goal_versions_goal_id_idx on public.goal_versions (goal_id);

create policy "tags: dono" on public.tags
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "session_tags: dono" on public.session_tags
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- shares: o dono lê, cria e revoga os seus; anon não tem nada na tabela.
-- Criar = insert simples só com as colunas abaixo (token, id e user_id vêm
-- dos defaults); revogar = update de revoked_at (o trigger põe o horário).
revoke all on public.shares from anon, authenticated;
grant select on public.shares to authenticated;
grant insert (period_label, period_start, period_end, payload, hide_area_names)
  on public.shares to authenticated;
grant update (revoked_at) on public.shares to authenticated;

create policy "shares: dono lê" on public.shares
  for select to authenticated using (user_id = (select auth.uid()));
create policy "shares: dono cria" on public.shares
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "shares: dono revoga" on public.shares
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
