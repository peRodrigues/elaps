-- Elaps: schema inicial.
-- Tempo é contado por grupo -> área. Uma sessão pertence a uma área; pausas
-- pertencem a uma sessão. Os nomes espelham packages/core/src/types.ts.
-- Todas as datas são timestamptz (UTC no banco; o fuso do perfil é só exibição).

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------

-- Mantém updated_at em dia em qualquer UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Fuso IANA válido para o Postgres (ex.: 'America/Sao_Paulo').
create function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ---------------------------------------------------------------------------
-- profiles: 1:1 com auth.users, criado pelo trigger handle_new_user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo'
    check (public.is_valid_timezone(timezone)),
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- security definer: roda como dono da função, porque quem insere em
-- auth.users é o serviço de auth, sem permissão em public.profiles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Alvo das FKs compostas (id, user_id): é o que impede, no banco, uma área
  -- de apontar para grupo de outro usuário.
  unique (id, user_id)
);

-- Nome único por usuário, sem diferenciar maiúsculas, entre os não arquivados
-- (arquivar libera o nome para um grupo novo).
create unique index groups_name_unique_active
  on public.groups (user_id, lower(name))
  where archived_at is null;

create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- areas
-- ---------------------------------------------------------------------------

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Mesmo user_id do grupo; excluir o grupo exclui as áreas.
  foreign key (group_id, user_id) references public.groups (id, user_id) on delete cascade
);

create index areas_group_id_idx on public.areas (group_id);

-- Nome único por grupo, sem diferenciar maiúsculas, entre as não arquivadas.
create unique index areas_name_unique_active
  on public.areas (group_id, lower(name))
  where archived_at is null;

create trigger areas_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sessions: ended_at nulo = cronômetro ativo
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'timer' check (source in ('timer', 'manual')),
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mesmo user_id da área; excluir a área exclui as sessões.
  foreign key (area_id, user_id) references public.areas (id, user_id) on delete cascade,
  constraint sessions_ends_after_start check (ended_at is null or ended_at > started_at),
  -- Lançamento manual já nasce com início e fim; só o cronômetro fica aberto.
  constraint sessions_manual_has_end check (source = 'timer' or ended_at is not null)
);

-- No máximo um cronômetro ativo por usuário.
create unique index sessions_one_active_per_user
  on public.sessions (user_id)
  where ended_at is null;

create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index sessions_area_id_idx on public.sessions (area_id);

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- session_pauses: resumed_at nulo = pausa aberta
-- ---------------------------------------------------------------------------

-- Sem user_id: o dono é o da sessão (RLS e trigger abaixo checam por ela).
create table public.session_pauses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  paused_at timestamptz not null default now(),
  resumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_pauses_resumes_after_pause check (resumed_at is null or resumed_at > paused_at)
);

-- No máximo uma pausa aberta por sessão.
create unique index session_pauses_one_open_per_session
  on public.session_pauses (session_id)
  where resumed_at is null;

create trigger session_pauses_updated_at
  before update on public.session_pauses
  for each row execute function public.set_updated_at();

-- A pausa tem de caber na sessão: começa depois do início, termina antes do
-- fim; pausa aberta só em sessão ativa. Roda com os direitos de quem grava,
-- então sessão de outro usuário aparece como "não encontrada".
create function public.check_pause_within_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  s public.sessions;
begin
  select * into s from public.sessions where id = new.session_id;
  if not found then
    raise exception 'sessão % não encontrada', new.session_id using errcode = '23503';
  end if;
  if new.paused_at < s.started_at then
    raise exception 'pausa começa antes da sessão' using errcode = '23514';
  end if;
  if s.ended_at is not null then
    if new.resumed_at is null then
      raise exception 'pausa aberta em sessão encerrada' using errcode = '23514';
    end if;
    if new.resumed_at > s.ended_at then
      raise exception 'pausa termina depois da sessão' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger session_pauses_within_session
  before insert or update on public.session_pauses
  for each row execute function public.check_pause_within_session();

-- Ao editar início/fim de uma sessão, as pausas fechadas têm de continuar
-- dentro dela. A pausa aberta não bloqueia o encerramento: é fechada no mesmo
-- instante pelo trigger sessions_close_open_pause (parar estando pausado).
create function public.check_session_bounds_for_pauses()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.session_pauses p
    where p.session_id = new.id
      and (
        p.paused_at < new.started_at
        or (new.ended_at is not null and coalesce(p.resumed_at, p.paused_at) > new.ended_at)
      )
  ) then
    raise exception 'sessão % ficaria com pausa fora do intervalo', new.id using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger sessions_bounds_cover_pauses
  before update of started_at, ended_at on public.sessions
  for each row execute function public.check_session_bounds_for_pauses();

create function public.close_open_pause_on_session_end()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.session_pauses
     set resumed_at = new.ended_at
   where session_id = new.id and resumed_at is null and paused_at < new.ended_at;
  -- Pausa aberta no exato instante do fim teria duração zero: descarta.
  delete from public.session_pauses
   where session_id = new.id and resumed_at is null;
  return null;
end;
$$;

create trigger sessions_close_open_pause
  after update of ended_at on public.sessions
  for each row
  when (old.ended_at is null and new.ended_at is not null)
  execute function public.close_open_pause_on_session_end();

-- ---------------------------------------------------------------------------
-- RLS: cada usuário só lê e escreve o que é dele. Sem política para anon.
-- (select auth.uid()) é avaliado uma vez por consulta, não por linha.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.areas enable row level security;
alter table public.sessions enable row level security;
alter table public.session_pauses enable row level security;

-- profiles: nasce pelo trigger e morre com o usuário; o app só lê e altera.
create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: alterar o próprio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groups: dono" on public.groups
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "areas: dono" on public.areas
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "sessions: dono" on public.sessions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "session_pauses: dono da sessão" on public.session_pauses
  for all to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

create index session_pauses_session_id_idx on public.session_pauses (session_id);
