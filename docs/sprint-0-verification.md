# Sprint 0 — Verification

> Foundation: workspace skeletons, Supabase schema + RLS, seed. No business
> endpoints or UI screens (those are Sprints 1–2).
>
> **Status legend:** ✅ done & verified · ⏸ blocked (waiting on you) · ⬜ not started

---

## 0. Pre-flight conflicts surfaced (spec wins over sprint prompt)

These were flagged and decided before any code was written:

| # | Conflict | Resolution (your call) |
|---|---|---|
| C1 | Pre-existing **JS** scaffold (api controllers/routes/services, mobile screens, `api/db` SQL, Lovable `web/` note) preempted Sprints 1–2 and broke the pinned TS stack. | Archived to `_archive/legacy-js-scaffold/` (git-ignored), then clean TS Sprint 0. |
| C2 | `project_assignments`: SPEC §0.2 says unique "where role = site_manager", but §2.1 DDL has no role column; §14 + matrix require the PM assigned to BGC + Cavite. | Added `role` column; partial unique restricted to `site_manager`. |
| C3 | Live Supabase steps need CLI + creds. | Creds provided. Migrations applied + seed run via `pg` over the IPv4 pooler (CLI not needed). ✅ |
| C4 | Sprint DoD says commit+push; CLAUDE.md says never commit. | CLAUDE.md wins — you handle git. I leave the tree ready. |
| C5 | `web/` was only a README claiming "Lovable web admin app" — no code; it referenced an unrelated Lovable marketing landing page. | Confirmed stale (no Lovable import coming). Archived to `_archive/legacy-web/`; `web/` scaffolded clean. |

---

## 1. What was implemented (tasks A–E)

### A. Workspace scaffolding
- ✅ **A1** `.gitignore` — appended `build/`, `.env.local`, `.env.*.local`, `.DS_Store`, and `_archive/` (kept existing lines).
- ✅ **A2** `api/` — Express + TypeScript. `package.json` (dev/build/start), strict `tsconfig` (ES2022, NodeNext, `rootDir: src`, `outDir: dist`), `src/index.ts` (CORS + JSON + `GET /api/v1/health` + §11 error envelope), `src/lib/env.ts` (zod, fail-fast), `src/lib/supabase.ts` (service-role client), `src/lib/errors.ts` (AppError + asyncHandler + envelope), `env.example`.
- ✅ **A3** `web/` — Vite + React + TS + Tailwind + shadcn config. `package.json` (dev/build/preview), `vite.config.ts` (`@` alias, port 5173), strict tsconfig, Tailwind config with SPEC §13 brutalist tokens + `--radius:0` + hard shadows, `components.json` (shadcn New York, no radius), `src/lib/utils.ts` (`cn`), `src/index.css` (tokens + shadcn HSL vars), `src/App.tsx` boot smoke test (Space Grotesk header, JetBrains Mono `VITE_API_BASE_URL` line, pings `/health`, API: OK/DOWN pill), `env.example`.
- ✅ **A4** `mobile/` — Expo SDK 51 + TypeScript. `app.json` (name `BxB`, slug `bxb-mobile`, scheme `bxb`, portrait), `App.tsx` boot smoke test (reads `EXPO_PUBLIC_API_BASE_URL`, pings `/health`, shows API: OK / DOWN, brutalist ink/paper/mono), `env.example`.
- ✅ **A5** `supabase/` — `config.toml`, `migrations/`, `seed/` (`seed.ts` + `package.json` + `env.example`), `README.md`.

### B. Migrations (`supabase/migrations/`)
- ✅ **0001** extensions (`pgcrypto`), enums (`user_role`, `attendance_status`), `profiles`, `auth.users → profiles` trigger.
- ✅ **0002** `projects`, `project_assignments` (+ role col, SM-only partial unique, project+user unique), `workers` (+ indexes).
- ✅ **0003** `attendance` (`UNIQUE(worker_id, work_date)` + indexes + `updated_at` trigger), `attendance_logs` (+ indexes).
- ✅ **0004** RLS enabled on all 6 tables; helper fns `auth.user_role()` + `auth.is_assigned_to()`; one policy per (table, command).
- All migrations are **idempotent** (`if not exists`, `create or replace`, guarded `do $$` enum blocks, `drop policy if exists`).

### C. RLS — see policy table in §3 below.

### D. Seed (`supabase/seed/seed.ts`)
- ✅ Idempotent: users short-circuit on existing email; projects/assignments/workers `upsert` on natural keys; attendance `upsert` on `(worker_id, work_date)`; logs wiped+rebuilt for the seeded dates only.
- ✅ 6 users (`*@bxb.test` / `password`), 3 projects, assignments (3 SMs + PM on BGC + Cavite), 18 workers (BGC 8 / Cavite 6 / Katipunan 4 per §14), yesterday + today attendance with matching `attendance_logs`.

### E. Boot verification
- ✅ **API** — typecheck clean; boots; `GET /api/v1/health` → `{"ok":true,"version":"1.0.0"}`; unknown route → §11 `NOT_FOUND` envelope.
- ✅ **Mobile** — `tsc --noEmit` clean; `expo config` resolves SDK 51; `expo start` reaches "Waiting on http://localhost:8081" with no errors.
- ✅ **Web** — `tsc -b && vite build` succeeds (1566 modules); `npm run dev` serves on http://localhost:5173 and the page reads `VITE_API_BASE_URL` + pings `/health`.
- ✅ **Migrations applied** — all 4 applied cleanly to the hosted project via the IPv4 session pooler; RLS enabled on all 6 tables; 20 policies created (attendance 4, attendance_logs 2, profiles 2, project_assignments 4, projects 4, workers 4).
- ✅ **Seed ran twice** — identical counts both runs (idempotent).
- ✅ **DB sanity query** (post-seed):

```json
{ "profiles": 6, "projects": 3, "assignments": 5, "workers": 18,
  "today_attendance": 9, "attendance_total": 25, "logs": 25 }
```
(25 attendance = 16 yesterday + 9 today; assignments = 3 SM + PM on 2 projects.)

- ✅ **RLS functional spot-check** (anon key + real user JWTs):
  - SM `princess` → sees only **BGC** (1 project, 8 workers).
  - PM `ramon` → sees **BGC + Cavite** (confirms the role-column fix, C2).
  - `admin` → sees all 3 projects.
  - **AC13 backstop:** SM inserting attendance into an unassigned project → blocked by RLS (`42501 new row violates row-level security policy`).

---

## 2. Archived inventory (for Sprint 2 reference)

Moved to `_archive/legacy-js-scaffold/` (git-ignored, kept locally):

```
api/  → package.json, server.js, .env.example, db/migrations/001_init.sql, db/seed.sql,
        src/app.js, src/config/supabase.js, src/controllers/{attendance,export}.controller.js,
        src/middleware/auth.js, src/routes/{attendance,me,projects}.routes.js,
        src/services/{attendance.service,overtime}.js, src/utils/errors.js
mobile/ → package.json, App.tsx, src/components/WorkerRow.tsx, src/lib/{api,supabase}.ts,
          src/navigation/index.tsx, src/screens/{Dashboard,History,Login,Roster}Screen.tsx
```

Moved to `_archive/legacy-web/` (git-ignored):

```
web/   → README.md (stale "Lovable web admin app" placeholder; unrelated marketing page)
```

---

## 3. RLS policy matrix

Helpers: `auth.user_role()` (current user's role), `auth.is_assigned_to(project_id)`
(active assignment exists — true for both PM and SM). API uses the service-role
key and **bypasses** RLS; these are the backstop for direct client access.

| Table | Cmd | Allowed | Expected outcome |
|---|---|---|---|
| profiles | SELECT | own row; admin/GM all | user sees self; admin/GM see everyone |
| profiles | UPDATE | own row; admin any | non-admin can't change `role` (trigger `prevent_role_change`) |
| projects | SELECT | admin/GM all; PM/SM if assigned | scoped list per role |
| projects | INSERT/UPDATE/DELETE | admin only | only admin mutates projects |
| project_assignments | SELECT | admin/GM all; own rows; PM for assigned projects | scoped |
| project_assignments | INSERT/UPDATE/DELETE | admin/GM; PM for assigned projects | SM cannot assign |
| workers | SELECT | admin/GM all; PM/SM if assigned | scoped roster |
| workers | INSERT/UPDATE/DELETE | admin/GM; PM if assigned | **SM read-only** (cannot create workers) |
| attendance | SELECT | admin/GM all; PM/SM if assigned | scoped reads |
| attendance | INSERT/UPDATE/DELETE | admin/GM; PM/SM if assigned | correction window enforced by API (Sprint 1), not RLS |
| attendance_logs | SELECT | admin/GM all; assigned via worker's project | survives `attendance_id` going null after undo |
| attendance_logs | INSERT | **service-role only** (`with check (false)`) | clients never write logs directly |

---

## 4. Deviations from the prompt / SPEC

1. **`project_assignments.role` + SM-only partial unique** (C2) — honors §0.2 verbatim, §14 (PM on 2 projects), and the §1 matrix. Reuses the existing `user_role` enum rather than a new type.
2. **`attendance_logs.attendance_id ON DELETE SET NULL`** (not `CASCADE` as in §2.1 DDL) — SPEC §6 says on undo "the row is deleted; **log retained**". Cascade would delete the audit log. RLS scopes logs via the worker's project so this still works post-undo.
3. **Added unique indexes** `projects(name)`, `project_assignments(project_id,user_id)`, `workers(project_id,full_name)` — required for idempotent seed upserts.
4. **Katipunan has 4 workers** — sprint task D5 said "≥5 per project," but SPEC §14 specifies 4 for Katipunan. Spec wins. Totals: BGC 8, Cavite 6, Katipunan 4 = 18 (≈ "~15").
5. **RLS helpers in `public`, not `auth`** — the sprint prompt specified `auth.user_role()` / `auth.is_assigned_to()`, but the hosted `postgres` role lacks `CREATE` on the `auth` schema (`permission denied for schema auth`). Moved to `public.current_user_role()` (renamed to avoid clashing with the `user_role` enum) and `public.is_assigned_to()`; all policy references updated. `auth.uid()` (a built-in) is still used. **Verified working** against the live DB.
6. **`api/.env` placeholder created** for the local boot smoke test (git-ignored). **Replace its values with the real Supabase creds.**
7. **No git commit** (C4) — tree left ready; you commit.
8. **xlsx high-severity advisory** — `xlsx` (SheetJS) is the SPEC §9 pinned export lib and carries a known npm advisory with no patched npm release. Kept per pinned stack; will revisit at Sprint 3 (export).
9. **DATABASE_URL points at the IPv4 pooler, not the direct host** — the provided direct host `db.<ref>.supabase.co` is **IPv6-only** (no A record) and unreachable from this network. Migrations were applied via the Supabase **session pooler** (`aws-1-ap-northeast-1.pooler.supabase.com:5432`, user `postgres.<ref>`). `api/.env` and `supabase/seed/.env` now use this pooler URL (password URL-encoded). Use the direct host only from an IPv6-capable network.

---

## 5. Acceptance criteria (SPEC §12)

Sprint 0 covers **no** AC directly (foundation only). It unblocks:
- **Sprint 1 makes testable:** AC3, AC4, AC5, AC6, AC7, AC13 (API guards + RLS), AC14 (error envelope — envelope shape already in place).
- **Sprint 2:** AC1, AC2, AC8, AC9, AC12.
- **Sprint 3:** AC10 (realtime), AC11 (export).

Schema-level groundwork verifiable now once the DB is applied: `UNIQUE(worker_id, work_date)` (AC3), RLS scoping (AC13), envelope shape (AC14).

---

## 6. Manual test commands

```bash
# API (placeholder .env already present; swap in real creds)
cd api && npm install && npm run dev
curl http://localhost:4000/api/v1/health          # → {"ok":true,"version":"1.0.0"}
curl http://localhost:4000/api/v1/nope            # → §11 NOT_FOUND envelope

# Mobile
cd mobile && npm install && npx expo start         # Metro → http://localhost:8081

# Web
cd web && npm install && npm run dev        # → http://localhost:5173 (shows API: OK/DOWN)

# Database (after installing Supabase CLI + supabase link --project-ref <ref>)
cd supabase && supabase db push
cd supabase/seed && cp env.example .env  # fill creds
npm install && npm run seed                        # run twice to prove idempotency
```

Sanity query (Supabase SQL editor):
```sql
select
  (select count(*) from profiles)  as profiles,
  (select count(*) from projects)  as projects,
  (select count(*) from workers)   as workers,
  (select count(*) from attendance where work_date = current_date) as today_attendance,
  (select count(*) from attendance_logs) as logs;
```

Sanity output (live, post-seed):

```json
{ "profiles": 6, "projects": 3, "assignments": 5, "workers": 18,
  "today_attendance": 9, "attendance_total": 25, "logs": 25 }
```

> Note: migrations were applied over the IPv4 **session pooler** (the provided
> direct `db.<ref>` host is IPv6-only and unreachable here). To apply via the
> Supabase CLI instead: `supabase link --project-ref rthrywanzluiahamfjmg`
> then `supabase db push` from an IPv6-capable network, or keep using the pooler
> `DATABASE_URL` already in `supabase/seed/.env`.
