
-- 1. Trigger to auto-create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Backfill profiles, subscriptions, daily_goals, user_roles for existing auth users
insert into public.profiles (id, email, nome)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.subscriptions (user_id, status)
select u.id, 'free'::subscription_status
from auth.users u
where not exists (select 1 from public.subscriptions s where s.user_id = u.id);

insert into public.daily_goals (user_id)
select u.id
from auth.users u
where not exists (select 1 from public.daily_goals d where d.user_id = u.id);

insert into public.user_roles (user_id, role)
select u.id, 'user'::public.app_role
from auth.users u
where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'user'::public.app_role);

-- 3. Rewards: add bonus_aplicado + claim_reward function
alter table public.rewards add column if not exists bonus_aplicado boolean not null default false;

create or replace function public.claim_reward(_reward_id uuid)
returns table(scans_added int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rewards;
  today_date date := current_date;
begin
  select * into r from public.rewards where id = _reward_id;
  if r.id is null then raise exception 'Recompensa não encontrada'; end if;
  if r.user_id <> auth.uid() then raise exception 'Não autorizado'; end if;
  if r.bonus_aplicado then
    return query select 0;
    return;
  end if;

  update public.rewards set lida = true, bonus_aplicado = true where id = _reward_id;

  if coalesce(r.bonus_scans, 0) > 0 then
    insert into public.scan_usage (user_id, data, count, bonus)
    values (r.user_id, today_date, 0, r.bonus_scans)
    on conflict (user_id, data) do update
      set bonus = public.scan_usage.bonus + excluded.bonus;
  end if;

  return query select coalesce(r.bonus_scans, 0);
end;
$$;

grant execute on function public.claim_reward(uuid) to authenticated;

-- 4. Food images cache table
create table if not exists public.food_images (
  nome text primary key,
  url text not null,
  updated_at timestamptz not null default now()
);
alter table public.food_images enable row level security;

drop policy if exists food_images_read on public.food_images;
create policy food_images_read on public.food_images for select to authenticated using (true);

drop policy if exists food_images_admin_all on public.food_images;
create policy food_images_admin_all on public.food_images for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Ensure scan_usage has unique (user_id, data) for upsert
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'scan_usage_user_data_key') then
    alter table public.scan_usage add constraint scan_usage_user_data_key unique (user_id, data);
  end if;
end $$;
