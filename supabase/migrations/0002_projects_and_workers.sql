-- 0002_projects_and_workers.sql
-- projects, project_assignments, workers. Idempotent.

create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  location        text,
  standard_hours  numeric(4,2) not null default 8.00,
  start_date      date,
  end_date        date,
  status          text not null default 'active' check (status in ('active','paused','completed')),
  created_at      timestamptz default now()
);
-- Natural key for idempotent seed upserts (DEVIATION from SPEC §2.1: added to
-- support re-runnable seeding; project names are unique in practice).
create unique index if not exists projects_name_uniq on public.projects (name);

-- project_assignments: which user runs/oversees which project.
--
-- DEVIATION from Sprint task B2 / SPEC §2.1 DDL, honoring SPEC §0.2 + §14 + §1:
--   §0.2 states the uniqueness rule is "where role = site_manager and is_active",
--   which requires a role column the §2.1 DDL omitted. §14 also assigns the PM to
--   TWO projects (BGC, Cavite) and the §1 matrix scopes PM access to assigned
--   projects (RLS reads this table via auth.is_assigned_to). An unqualified unique
--   on (project_id) where is_active would make a PM and the project's SM collide.
--   Fix: add `role`, and restrict the partial unique to site_manager only.
create table if not exists public.project_assignments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        user_role not null default 'site_manager',
  is_active   boolean not null default true,
  assigned_at timestamptz default now()
);

-- SPEC §0.2: at most one ACTIVE site_manager per project.
create unique index if not exists project_assignments_one_active_sm
  on public.project_assignments (project_id)
  where (is_active = true and role = 'site_manager');

-- A user is assigned to a project at most once (supports idempotent seed upsert).
create unique index if not exists project_assignments_project_user_uniq
  on public.project_assignments (project_id, user_id);

create table if not exists public.workers (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete restrict,
  full_name   text not null,
  position    text,
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);
create index if not exists workers_project_active_idx on public.workers (project_id, is_active);
-- Natural key for idempotent seed upserts.
create unique index if not exists workers_project_name_uniq on public.workers (project_id, full_name);
