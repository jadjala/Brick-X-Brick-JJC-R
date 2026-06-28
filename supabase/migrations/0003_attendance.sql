-- 0003_attendance.sql
-- attendance (one row per worker per day) + attendance_logs (audit). Idempotent.

create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  worker_id    uuid not null references public.workers(id) on delete restrict,
  project_id   uuid not null references public.projects(id) on delete restrict,
  work_date    date not null,
  status       attendance_status not null,
  clock_in_at  timestamptz,
  clock_out_at timestamptz,
  recorded_by  uuid not null references public.profiles(id),
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (worker_id, work_date)            -- SPEC §0.3 / G3
);
create index if not exists attendance_project_date_idx on public.attendance (project_id, work_date);
create index if not exists attendance_worker_date_idx  on public.attendance (worker_id, work_date);

-- Auto-bump updated_at on any UPDATE.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

create table if not exists public.attendance_logs (
  id            uuid primary key default gen_random_uuid(),
  -- DEVIATION from SPEC §2.1 DDL (on delete cascade): SPEC §6 says on `undo`
  -- "the row is deleted; log retained". Cascade would delete the log too, which
  -- defeats the audit trail. Use SET NULL so the log survives the attendance row.
  attendance_id uuid references public.attendance(id) on delete set null,
  worker_id     uuid not null references public.workers(id),
  work_date     date not null,
  action        text not null,  -- clock_in|clock_out|mark_absent|undo|proxy_clock_in|proxy_clock_out|edit_time
  actor_id      uuid not null references public.profiles(id),
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz default now()
);
create index if not exists attendance_logs_attendance_idx
  on public.attendance_logs (attendance_id, created_at desc);
-- Worker-scoped index supports RLS scoping when attendance_id is null (post-undo).
create index if not exists attendance_logs_worker_idx
  on public.attendance_logs (worker_id, created_at desc);
