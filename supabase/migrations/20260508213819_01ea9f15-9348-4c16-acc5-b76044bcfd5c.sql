
-- ENUMS
create type public.app_role as enum ('admin', 'user');
create type public.objetivo_tipo as enum ('perder', 'manter', 'ganhar');
create type public.subscription_status as enum ('free', 'trialing', 'active', 'expired');

-- updated_at helper
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- USER ROLES (criar primeiro)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles_select_own_or_admin" on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "roles_admin_all" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  avatar_url text,
  peso numeric,
  altura numeric,
  idade int,
  objetivo public.objetivo_tipo default 'manter',
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "profiles_update_own_or_admin" on public.profiles for update
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "profiles_insert_own" on public.profiles for insert
  with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- DAILY GOALS
create table public.daily_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calorias int not null default 2000,
  proteina_g int not null default 120,
  carbs_g int not null default 250,
  gordura_g int not null default 65,
  updated_at timestamptz not null default now()
);
alter table public.daily_goals enable row level security;
create policy "goals_select_own_or_admin" on public.daily_goals for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "goals_modify_own" on public.daily_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- FOOD ENTRIES
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  nome text not null,
  porcoes numeric not null default 1,
  calorias numeric not null default 0,
  carbs numeric not null default 0,
  prot numeric not null default 0,
  gord numeric not null default 0,
  foto_url text,
  created_at timestamptz not null default now()
);
create index idx_food_entries_user_date on public.food_entries(user_id, data);
alter table public.food_entries enable row level security;
create policy "entries_select_own_or_admin" on public.food_entries for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "entries_modify_own" on public.food_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- WATER
create table public.water_intake (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  ml int not null,
  created_at timestamptz not null default now()
);
create index idx_water_user_date on public.water_intake(user_id, data);
alter table public.water_intake enable row level security;
create policy "water_select_own_or_admin" on public.water_intake for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "water_modify_own" on public.water_intake for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- FOODS BASIC
create table public.foods_basic (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cal numeric not null,
  carb numeric not null,
  prot numeric not null,
  gord numeric not null,
  foto_url text,
  created_at timestamptz not null default now()
);
alter table public.foods_basic enable row level security;
create policy "foods_select_authenticated" on public.foods_basic for select to authenticated using (true);
create policy "foods_admin_all" on public.foods_basic for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

insert into public.foods_basic (nome, cal, carb, prot, gord) values
('Arroz branco cozido', 130, 28, 2.7, 0.3),
('Arroz integral cozido', 124, 26, 2.6, 1),
('Feijão preto cozido', 77, 14, 4.5, 0.5),
('Feijão carioca cozido', 76, 14, 4.8, 0.5),
('Frango grelhado', 165, 0, 31, 3.6),
('Peito de frango', 110, 0, 23, 1.2),
('Carne bovina (patinho)', 163, 0, 27, 6),
('Carne moída', 250, 0, 26, 17),
('Ovo cozido', 155, 1.1, 13, 11),
('Ovo mexido', 196, 2.2, 13, 15),
('Pão francês', 300, 58, 8, 3),
('Pão integral', 247, 41, 13, 4.2),
('Queijo mussarela', 280, 3, 22, 22),
('Queijo minas', 240, 3, 17, 20),
('Leite integral', 61, 4.8, 3.2, 3.3),
('Iogurte natural', 51, 3.6, 4, 1.5),
('Banana', 89, 23, 1.1, 0.3),
('Maçã', 52, 14, 0.3, 0.2),
('Laranja', 47, 12, 0.9, 0.1),
('Mamão', 43, 11, 0.5, 0.3),
('Aveia em flocos', 389, 66, 17, 7),
('Granola', 470, 64, 10, 20),
('Batata cozida', 87, 20, 1.9, 0.1),
('Batata doce cozida', 86, 20, 1.6, 0.1),
('Macarrão cozido', 158, 31, 5.8, 0.9),
('Salada de alface', 15, 2.9, 1.4, 0.2),
('Tomate', 18, 3.9, 0.9, 0.2),
('Cenoura crua', 41, 10, 0.9, 0.2),
('Abobrinha refogada', 30, 4, 1.5, 1),
('Brócolis cozido', 35, 7, 2.4, 0.4),
('Salmão grelhado', 208, 0, 20, 13),
('Atum em água', 116, 0, 26, 1),
('Azeite de oliva', 884, 0, 0, 100),
('Castanha do Pará', 656, 12, 14, 66);

-- REWARDS
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text,
  bonus_scans int not null default 0,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_rewards_user on public.rewards(user_id);
alter table public.rewards enable row level security;
create policy "rewards_select_own_or_admin" on public.rewards for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "rewards_update_own" on public.rewards for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "rewards_admin_insert" on public.rewards for insert
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "rewards_admin_delete" on public.rewards for delete
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- SCAN USAGE
create table public.scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  count int not null default 0,
  bonus int not null default 0,
  primary key (user_id, data)
);
alter table public.scan_usage enable row level security;
create policy "scan_select_own_or_admin" on public.scan_usage for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "scan_modify_own" on public.scan_usage for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scan_admin_all" on public.scan_usage for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- SUBSCRIPTIONS
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status public.subscription_status not null default 'free',
  trial_end timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subs_select_own_or_admin" on public.subscriptions for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "subs_update_own" on public.subscriptions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subs_insert_own" on public.subscriptions for insert
  with check (auth.uid() = user_id);
create policy "subs_admin_all" on public.subscriptions for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create trigger subs_updated_at before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

-- CHAT
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index idx_chat_user on public.chat_messages(user_id, created_at);
alter table public.chat_messages enable row level security;
create policy "chat_select_own" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "chat_delete_own" on public.chat_messages for delete using (auth.uid() = user_id);

-- AUTO-CREATE on signup (depois de todas as tabelas)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)));
  if new.email = 'silviok5000@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin'::public.app_role) on conflict do nothing;
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user'::public.app_role) on conflict do nothing;
  insert into public.subscriptions (user_id, status) values (new.id, 'free') on conflict do nothing;
  insert into public.daily_goals (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
