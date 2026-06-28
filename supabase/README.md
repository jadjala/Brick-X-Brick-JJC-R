# supabase/ — schema, RLS, seed

Schema, Row-Level Security, and seed data for the BxB Attendance Module.
We use the **hosted** Supabase project — do **not** start the local Docker stack.

## Layout

```
supabase/
├── config.toml              # CLI config (hosted project; link by project ref)
├── migrations/
│   ├── 0001_init_enums_and_profiles.sql
│   ├── 0002_projects_and_workers.sql
│   ├── 0003_attendance.sql
│   └── 0004_rls.sql
└── seed/
    ├── seed.ts              # idempotent seed (SPEC §14)
    ├── package.json
    └── env.example
```

## Prerequisites

- **Supabase CLI** — install one of:
  - Scoop (Windows): `scoop install supabase`
  - npm (local dev dep): `npx supabase --version`
  - or download from https://github.com/supabase/cli/releases
- A linked hosted project: `supabase login` then `supabase link --project-ref <ref>`.

## Apply migrations

```bash
cd supabase
supabase db push        # applies migrations/*.sql to the linked hosted project
```

Migrations are **idempotent** — re-running `db push` (or re-applying a file) will
not error. RLS is enabled on every table in `0004_rls.sql`.

## Seed

```bash
cd supabase/seed
cp env.example .env     # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run seed            # safe to run repeatedly (idempotent)
```

The seed creates 6 users (`*@bxb.test`, password `password`), 3 projects,
assignments (3 SMs + the PM on BGC + Cavite), workers, and yesterday/today
attendance with audit logs.

## Reset (destructive — ask first)

There is no automated reset script. To wipe and reapply, in the Supabase SQL
editor drop the public tables + custom types, then `supabase db push` and re-seed:

```sql
drop table if exists attendance_logs, attendance, workers,
  project_assignments, projects, profiles cascade;
drop type if exists attendance_status, user_role cascade;
```

> Run destructive SQL only when you intend to lose data (CLAUDE.md "Things to NOT do").

## Sanity query

```sql
select
  (select count(*) from profiles)  as profiles,
  (select count(*) from projects)  as projects,
  (select count(*) from workers)   as workers,
  (select count(*) from attendance where work_date = current_date) as today_attendance,
  (select count(*) from attendance_logs) as logs;
```
