-- 0001_init_enums_and_profiles.sql
-- Extensions, role/status enums, profiles table, and the auth.users -> profiles trigger.
-- Idempotent: safe to re-run (SPEC DoD "migration is re-runnable without breaking").

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- Role enum (SPEC §1). Created before profiles, which references it.
do $$ begin
  create type user_role as enum ('admin','general_manager','project_manager','site_manager');
exception when duplicate_object then null;
end $$;

-- Attendance status enum (SPEC §2.2). Defined here per Sprint 0 task B1; used by 0003.
do $$ begin
  create type attendance_status as enum ('clocked_in','clocked_out','absent');
exception when duplicate_object then null;
end $$;

-- profiles extends auth.users (SPEC §2.1)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'site_manager',
  created_at  timestamptz default now()
);

-- On new auth user, mirror into profiles. full_name + role come from the
-- user_metadata passed to auth.admin.createUser (lands in raw_user_meta_data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'site_manager')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
