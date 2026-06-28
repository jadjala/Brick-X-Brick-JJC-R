-- 0004_rls.sql
-- Row-Level Security. The API uses the service-role key and BYPASSES RLS; these
-- policies are the backstop for direct Supabase client access (mobile auth flow,
-- Realtime). One policy per (table, command) pair (CLAUDE.md RLS rule #5).
-- Idempotent: helpers use CREATE OR REPLACE; policies are dropped then created.

-- ── Helpers (SECURITY DEFINER so they bypass RLS and avoid policy recursion) ──
-- Placed in `public` (not `auth`): the hosted Supabase `postgres` role lacks
-- CREATE on the `auth` schema. Named current_user_role() to avoid clashing with
-- the `user_role` enum type. (Deviation from Sprint task C wording.)

create or replace function public.current_user_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_assigned_to(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_assignments
    where project_id = p_project_id
      and user_id = auth.uid()
      and is_active = true
  )
$$;

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_assigned_to(uuid) to anon, authenticated;

-- ── Enable RLS on every table ──
alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.project_assignments enable row level security;
alter table public.workers             enable row level security;
alter table public.attendance          enable row level security;
alter table public.attendance_logs     enable row level security;

-- ════════════════════════ profiles ════════════════════════
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.current_user_role() in ('admin','general_manager')
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (
  id = auth.uid() or public.current_user_role() = 'admin'
) with check (
  id = auth.uid() or public.current_user_role() = 'admin'
);

-- "own row but NOT the role column" — RLS can't compare OLD/NEW, so enforce via
-- trigger. Skipped for service-role context (auth.uid() is null there).
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.role is distinct from old.role
     and coalesce(public.current_user_role(), 'site_manager') <> 'admin' then
    raise exception 'Only admin may change a profile role';
  end if;
  return new;
end $$;

drop trigger if exists profiles_no_role_change on public.profiles;
create trigger profiles_no_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ════════════════════════ projects ════════════════════════
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (
  public.current_user_role() in ('admin','general_manager') or public.is_assigned_to(id)
);

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert with check (
  public.current_user_role() = 'admin'
);

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update using (
  public.current_user_role() = 'admin'
) with check (
  public.current_user_role() = 'admin'
);

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete using (
  public.current_user_role() = 'admin'
);

-- ════════════════════ project_assignments ════════════════════
drop policy if exists project_assignments_select on public.project_assignments;
create policy project_assignments_select on public.project_assignments for select using (
  public.current_user_role() in ('admin','general_manager')
  or user_id = auth.uid()
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
);

drop policy if exists project_assignments_insert on public.project_assignments;
create policy project_assignments_insert on public.project_assignments for insert with check (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
);

drop policy if exists project_assignments_update on public.project_assignments;
create policy project_assignments_update on public.project_assignments for update using (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
) with check (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
);

drop policy if exists project_assignments_delete on public.project_assignments;
create policy project_assignments_delete on public.project_assignments for delete using (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
);

-- ════════════════════════ workers ════════════════════════
drop policy if exists workers_select on public.workers;
create policy workers_select on public.workers for select using (
  public.current_user_role() in ('admin','general_manager') or public.is_assigned_to(project_id)
);

-- SM is read-only on workers (matrix: "Create/edit workers" excludes SM).
drop policy if exists workers_insert on public.workers;
create policy workers_insert on public.workers for insert with check (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
);

drop policy if exists workers_update on public.workers;
create policy workers_update on public.workers for update using (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
) with check (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
);

drop policy if exists workers_delete on public.workers;
create policy workers_delete on public.workers for delete using (
  public.current_user_role() in ('admin','general_manager')
  or (public.current_user_role() = 'project_manager' and public.is_assigned_to(project_id))
);

-- ════════════════════════ attendance ════════════════════════
-- Read: admin/GM all; PM + SM via project assignment (is_assigned_to covers both).
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select using (
  public.current_user_role() in ('admin','general_manager') or public.is_assigned_to(project_id)
);

-- Write: admin, GM, and any assigned PM/SM for that project.
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert with check (
  public.current_user_role() in ('admin','general_manager') or public.is_assigned_to(project_id)
);

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update using (
  public.current_user_role() in ('admin','general_manager') or public.is_assigned_to(project_id)
) with check (
  public.current_user_role() in ('admin','general_manager') or public.is_assigned_to(project_id)
);

-- Delete allowed by assignment; the API enforces the correction window (SPEC §0.4/G7).
drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance for delete using (
  public.current_user_role() in ('admin','general_manager') or public.is_assigned_to(project_id)
);

-- ════════════════════════ attendance_logs ════════════════════════
-- Read: same scoping as attendance, via the worker's project (works even after
-- undo nulls attendance_id).
drop policy if exists attendance_logs_select on public.attendance_logs;
create policy attendance_logs_select on public.attendance_logs for select using (
  public.current_user_role() in ('admin','general_manager')
  or exists (
    select 1 from public.workers w
    where w.id = attendance_logs.worker_id and public.is_assigned_to(w.project_id)
  )
);

-- INSERT: service-role only. Clients must never write logs directly; deny all
-- (service role bypasses RLS). No update/delete policies => denied by default.
drop policy if exists attendance_logs_no_client_insert on public.attendance_logs;
create policy attendance_logs_no_client_insert on public.attendance_logs for insert with check (false);
