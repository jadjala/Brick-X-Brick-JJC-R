# Brick × Brick — Attendance Module Specification

> **Status:** v1.0 — Source of truth for implementation
> **Owner:** FourLoop (Princess, solo execution)
> **Client:** JJC-R Blueprints and Drafting Services
> **Scope:** Web Admin (full) + Site Manager Mobile App (full). No worker-facing app.
> **Last updated:** 2026-06-28

This document is referenced by section number (e.g. "§2.3") throughout the implementation plan and Claude Code prompts. **Read this end-to-end before writing any code.**

---

## §0 — Core Rules (Non-negotiable)

These are invariants. Every endpoint, screen, and database constraint must uphold them.

1. **Workers have no user account.** They are records, not users. The Site Manager records all attendance on their behalf.
2. **One Site Manager per project at a time.** Enforced by a UNIQUE constraint on `project_assignments` where role = `site_manager` and `is_active = true`.
3. **One attendance record per worker per day.** Enforced by `UNIQUE(worker_id, work_date)`.
4. **Correction window = today + yesterday.** Any `undo` or edit outside this window is rejected at both the API and RLS layers.
5. **All timestamps are stored as `timestamptz` and presented in PHT (UTC+8).**
6. **Every state-changing action is logged** to `attendance_logs` with actor, before, and after state.
7. **No unauthenticated endpoint** except `GET /health`.
8. **Authorization is always two-layer:** Express middleware checks JWT + role + project assignment; Postgres RLS is the backstop.

---

## §1 — Roles & Permissions Matrix

Four roles exist as a Postgres enum: `admin`, `general_manager`, `project_manager`, `site_manager`.

| Action | admin | general_manager | project_manager | site_manager |
|---|---|---|---|---|
| View all projects | ✅ | ✅ | ✅ assigned only | ✅ assigned only |
| Create / edit projects | ✅ | ❌ | ❌ | ❌ |
| Assign Site Manager to project | ✅ | ✅ | ✅ assigned only | ❌ |
| Create / edit workers | ✅ | ✅ | ✅ assigned only | ❌ |
| View attendance dashboard (web) | ✅ | ✅ | ✅ assigned only | ❌ |
| Record attendance (mobile) | ❌ | ❌ | ❌ | ✅ own project only |
| Proxy clock in/out (web) | ✅ | ✅ | ✅ assigned only | ❌ |
| Mark absent | ✅ | ✅ | ✅ assigned only | ✅ own project only |
| Undo within correction window | ✅ | ✅ | ✅ assigned only | ✅ own project only |
| Export XLSX | ✅ | ✅ | ✅ assigned only | ❌ |
| View audit timeline | ✅ | ✅ | ✅ assigned only | ❌ |

**Mobile app = Site Manager only.** Other roles using mobile is out of scope for MVP.

---

## §2 — Domain Model & State Machine

### §2.1 — Entities

```sql
-- profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'site_manager',
  created_at timestamptz default now()
);
create type user_role as enum ('admin','general_manager','project_manager','site_manager');

-- projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  standard_hours numeric(4,2) not null default 8.00,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz default now()
);

-- project_assignments (which SM runs which project)
create table project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz default now(),
  unique (project_id, is_active) where (is_active = true) -- one active SM per project
);

-- workers
create table workers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  full_name text not null,
  position text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- attendance (one row per worker per day)
create table attendance (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers(id) on delete restrict,
  project_id uuid not null references projects(id) on delete restrict,
  work_date date not null,
  status attendance_status not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  recorded_by uuid not null references profiles(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (worker_id, work_date)
);
create type attendance_status as enum ('clocked_in','clocked_out','absent');

-- attendance_logs (audit)
create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references attendance(id) on delete cascade,
  worker_id uuid not null references workers(id),
  work_date date not null,
  action text not null, -- 'clock_in' | 'clock_out' | 'mark_absent' | 'undo' | 'proxy_clock_in' | 'proxy_clock_out' | 'edit_time'
  actor_id uuid not null references profiles(id),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz default now()
);
```

### §2.2 — Status semantics

| Status | Meaning |
|---|---|
| `no_record` | **Implicit** — no row exists in `attendance` for this worker/date. Not a stored value. |
| `clocked_in` | Has `clock_in_at`, no `clock_out_at`. Worker is on-site (or was at clock-in time). |
| `clocked_out` | Has both `clock_in_at` and `clock_out_at`. Day complete. |
| `absent` | No clock times. Worker did not show up. |

### §2.3 — State Machine (allowed transitions)

```
                   ┌────────────────────────────────┐
                   │                                │
                   │      no_record (no row)        │
                   │                                │
                   └────┬───────────────────┬───────┘
                        │                   │
              clock_in  │                   │  mark_absent
                        ▼                   ▼
                ┌──────────────┐    ┌──────────────┐
                │  clocked_in  │    │   absent     │
                └──────┬───────┘    └──────┬───────┘
                       │                   │
            clock_out  │                   │  undo
                       ▼                   ▼
                ┌──────────────┐    ┌──────────────┐
                │ clocked_out  │    │  no_record   │
                └──────┬───────┘    └──────────────┘
                       │
                  undo │
                       ▼
                ┌──────────────┐
                │  no_record   │
                └──────────────┘
```

**Rules:**
- `clocked_in → clocked_out` is the only "forward" transition allowed.
- All "back" moves go through **undo** which deletes the row.
- `clocked_out → clocked_in` directly is **not allowed**. The SM must undo first, then clock in again.
- All transitions are subject to the **correction window** (§0.4) if going backward.

---

## §3 — Hours & Overtime

- **Total Hours** = `(clock_out_at − clock_in_at)` in hours, rounded to the nearest minute.
- **Overtime** = `max(0, total_hours − project.standard_hours)`.
- **Display format:** `"8h 30m"` for whole+fractional; `"—"` (em dash) when clock-out has not occurred.
- **Partial hours are not accrued** — a `clocked_in` row without `clock_out_at` reports `total_hours = null` and the UI shows `"—"`.
- **Negative or zero durations** are rejected at write time (clock-out cannot equal or precede clock-in).
- **Cross-midnight shifts** are out of scope for MVP — `work_date` is the calendar date of clock-in; if clock-out lands the next day before midnight + 4h grace, accept it; otherwise reject with 422.

---

## §4 — Mobile App (Site Manager)

### §4.1 — Screens

1. **Login** — Supabase email/password; token stored in Expo SecureStore.
2. **Roster** — main working screen. Project + date selector, worker list, action buttons.
3. **History** — read-only scroll of past attendance for the current project.

### §4.2 — Roster screen

- On mount: call `GET /me/projects` → auto-select if exactly one assignment, otherwise show a picker.
- Date defaults to today (PHT). Date picker allows today and yesterday only (matches correction window).
- Renders `GET /projects/:id/roster?date=YYYY-MM-DD`.
- **Per-row layout:**
  - Worker name + position
  - Status pill (color per §13)
  - Action button(s) based on status:
    - `no_record` → `[Clock In]` `[Mark Absent]`
    - `clocked_in` → `[Clock Out]`
    - `clocked_out` → `[Undo]`
    - `absent` → `[Undo]`
- **Bottom summary chips:** Present / Clocked Out / Absent / No Record counts.
- **Optimistic UI:** action button shows the new state immediately; if the API call fails, revert and show error toast.
- **Tap debounce:** 400ms — prevents double-fire on slow networks.

### §4.3 — Time confirm bottom-sheet

Triggered by Clock In and Clock Out buttons.

- Default: **now** (PHT).
- Field: editable time picker, scope = today only.
- Validation:
  - No future times (>1 min ahead of now is rejected client-side).
  - Within work-hours bound: 05:00 – 23:00 PHT (configurable, server validates).
  - For clock-out: must be > clock-in time.
- Buttons: `[Confirm]` `[Cancel]`.

### §4.4 — History screen

- Read-only.
- Shows the last 30 days of attendance for the SM's current project.
- Pull-to-refresh.
- Each row: date, worker name, status, hours, recorded_by name.

### §4.5 — Realtime

- Subscribes to Supabase Realtime on the `attendance` table, filtered to current project.
- On insert/update/delete: patch the matching row in local state; recompute summary chips.
- Connection indicator in the header: green dot = live, gray = polling fallback.

---

## §5 — Web Admin Dashboard

### §5.1 — Pages

- `/login`
- `/attendance` — main dashboard
- `/attendance/:id` — details + audit timeline

### §5.2 — Attendance dashboard

**Top bar (filters):**
- Date picker (single date or range)
- Project dropdown (scoped by role per §1)
- Status filter (multi-select: clocked_in, clocked_out, absent, no_record)

**Summary cards:**
- Total Workers
- Present (clocked_in)
- Clocked Out
- Absent
- No Record
- Total Hours Today (sum)
- Total OT Today (sum)

**Table columns:**
| Worker | Position | Project | Status | Clock In | Clock Out | Total Hours | Overtime | Recorded By | Actions |

**Row actions** (subject to role + correction window):
- `[View]` — go to details page
- `[Proxy Clock In]` — opens time picker; only when status = no_record
- `[Proxy Clock Out]` — opens time picker; only when status = clocked_in
- `[Mark Absent]` — only when status = no_record
- `[Undo]` — only when correction window allows

**`[Export XLSX]`** button — exports current filtered view per §9.

### §5.3 — Details page

- All fields of the attendance record.
- **Audit timeline:** vertical list of `attendance_logs` rows, newest first. Each entry shows:
  - Action (badge)
  - Actor name + role
  - Timestamp (PHT, with seconds)
  - Diff: before → after state

### §5.4 — Realtime

- Web subscribes to `attendance` changes scoped to the active project filter.
- On change: patch the row, recompute summary cards, flash the row briefly.
- No full refetch.

---

## §6 — Audit Logging

Every state-changing endpoint writes one `attendance_logs` row in the same transaction as the data write. If the log write fails, the whole transaction rolls back.

**Log action vocabulary** (canonical strings):
- `clock_in` — SM clocked in a worker via mobile
- `clock_out` — SM clocked out a worker via mobile
- `proxy_clock_in` — PM/GM/admin clocked in via web
- `proxy_clock_out` — PM/GM/admin clocked out via web
- `mark_absent` — marked absent
- `undo` — reversed a prior action (the row is deleted; log retained)
- `edit_time` — clock_in_at or clock_out_at edited

**`before_state` and `after_state`** are JSON snapshots of the attendance row (or `null` on create/delete).

---

## §7 — API Contracts

**Base URL:** `/api/v1`
**Auth header:** `Authorization: Bearer <supabase_jwt>` on all endpoints except `/health`.
**Content-Type:** `application/json` for all requests/responses except `/export` which returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### §7.1 — Health & Identity

```
GET /health
  200 → { "ok": true, "version": "1.0.0" }

GET /me
  200 → { "id": "uuid", "full_name": "Mario Reyes", "role": "site_manager" }

GET /me/projects
  200 → [ { "id": "uuid", "name": "BGC Verdana Tower", "standard_hours": 8.00, ... } ]
```

### §7.2 — Projects & Roster

```
GET /projects
  200 → array of projects (scoped by role)

GET /projects/:id
  200 → single project
  404 → NOT_FOUND

GET /projects/:id/roster?date=YYYY-MM-DD
  200 → [
    {
      "worker_id": "uuid",
      "full_name": "Jomar Cruz",
      "position": "Mason",
      "status": "clocked_in" | "clocked_out" | "absent" | "no_record",
      "attendance_id": "uuid" | null,
      "clock_in_at": "2026-06-28T08:02:14+08:00" | null,
      "clock_out_at": "2026-06-28T17:31:00+08:00" | null,
      "total_hours": 9.48 | null,
      "overtime": 1.48 | null,
      "recorded_by_name": "Princess Lopez" | null
    }, ...
  ]
  403 → FORBIDDEN (not assigned to this project)
```

### §7.3 — Attendance writes

```
POST /attendance/clock-in
  body: { worker_id, work_date: "YYYY-MM-DD", clock_in_at: "ISO timestamptz" }
  201 → attendance object
  409 → DUPLICATE (worker already has a record for that date)
  422 → INVALID_INPUT (future time, out-of-window, malformed)
  403 → FORBIDDEN (worker not in user's project)

POST /attendance/clock-out
  body: { worker_id, work_date, clock_out_at }
  200 → attendance object
  409 → INVALID_STATE (no prior clock-in; or already clocked_out)
  422 → INVALID_INPUT (clock_out_at <= clock_in_at; future time)
  403 → FORBIDDEN

POST /attendance/mark-absent
  body: { worker_id, work_date }
  201 → attendance object (status: absent)
  409 → INVALID_STATE (record already exists)
  403 → FORBIDDEN

POST /attendance/undo
  body: { attendance_id }
  200 → { "ok": true }
  422 → OUT_OF_WINDOW (work_date older than yesterday)
  404 → NOT_FOUND
  403 → FORBIDDEN

PATCH /attendance/:id/edit-time
  body: { clock_in_at?, clock_out_at? }
  200 → attendance object
  422 → INVALID_INPUT
  403 → FORBIDDEN (web roles only)
```

### §7.4 — Attendance reads

```
GET /attendance?date=YYYY-MM-DD&project_id=uuid
  200 → array of attendance rows with worker info joined

GET /attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&project_id=uuid
  200 → array (range query)

GET /attendance/summary?date=YYYY-MM-DD&project_id=uuid
  200 → {
    "total_workers": 12,
    "clocked_in": 3,
    "clocked_out": 7,
    "absent": 1,
    "no_record": 1,
    "total_hours": 56.5,
    "total_overtime": 4.0
  }

GET /attendance/:id
  200 → attendance object with worker + project joined

GET /attendance/:id/logs
  200 → array of attendance_logs rows, newest first
```

### §7.5 — Export

```
GET /attendance/export?date=YYYY-MM-DD&project_id=uuid
GET /attendance/export?from=YYYY-MM-DD&to=YYYY-MM-DD&project_id=uuid
  200 → binary .xlsx (see §9)
  Headers: Content-Disposition: attachment; filename="..."
```

---

## §8 — Realtime

- **Provider:** Supabase Realtime on the `attendance` and `attendance_logs` tables.
- **Channels:** clients subscribe to `attendance:project_id=eq.<uuid>`. RLS scopes what they actually receive.
- **SLA:** a change made on one client must be visible on another within **5 seconds**.
- **Fallback:** if the realtime socket drops, the client polls `GET /attendance?date=today` every 30s until reconnect. The UI shows a "polling" indicator.
- **Backpressure:** clients debounce summary recompute to 200ms — many quick updates coalesce.

---

## §9 — XLSX Export

- **Library:** SheetJS (`xlsx`), server-side, returns a `Buffer`.
- **Filename:** `attendance_<project_slug>_<from>_to_<to>.xlsx` — single-date export uses `<date>_<date>`.
  - `project_slug` is `kebab-case(project.name)`.
  - Example: `attendance_bgc-verdana-tower_2026-06-28_to_2026-06-28.xlsx`
- **Sheet name:** `Attendance`
- **Columns (in order):**

| Column | Type | Format |
|---|---|---|
| Worker | string | full_name |
| Position | string | |
| Project | string | project name |
| Date | date | YYYY-MM-DD |
| Status | string | clocked_in / clocked_out / absent / no_record |
| Clock In | time | HH:MM (24h) or empty |
| Clock Out | time | HH:MM (24h) or empty |
| Total Hours | number | decimal, 2dp, or empty |
| Overtime | number | decimal, 2dp, or empty |
| Recorded By | string | actor full_name |

- **Header row:** bold, frozen.
- **Row order:** by Project, then Worker name A→Z, then Date ascending.

---

## §10 — Validation & Guards (Server-side)

Each is enforced and unit-tested.

| # | Guard | Returns |
|---|---|---|
| G1 | Auth required on all routes except `/health` | 401 AUTH_REQUIRED |
| G2 | Role + assignment check (middleware) | 403 FORBIDDEN |
| G3 | `UNIQUE(worker_id, work_date)` — duplicate clock-in | 409 DUPLICATE |
| G4 | Clock-out requires existing `clock_in_at` | 409 INVALID_STATE |
| G5 | `clock_out_at > clock_in_at` | 422 INVALID_INPUT |
| G6 | `mark-absent` only from no_record | 409 INVALID_STATE |
| G7 | `undo` only when `work_date IN (today, yesterday)` PHT | 422 OUT_OF_WINDOW |
| G8 | No future timestamps (>1 min ahead of server now) | 422 INVALID_INPUT |
| G9 | Worker must belong to user's assigned project (SM only) | 403 FORBIDDEN |
| G10 | `work_date` not older than 90 days | 422 INVALID_INPUT |
| G11 | Body schema validation (zod) | 400 INVALID_INPUT |
| G12 | Clock times within 05:00–23:00 PHT | 422 INVALID_INPUT |

---

## §11 — Error Envelope

All error responses use this exact shape:

```json
{
  "error": {
    "code": "DUPLICATE",
    "message": "An attendance record already exists for this worker on this date.",
    "details": { "worker_id": "uuid", "work_date": "2026-06-28" }
  }
}
```

**Codes:** `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE`, `INVALID_STATE`, `INVALID_INPUT`, `OUT_OF_WINDOW`, `INTERNAL`.

**HTTP status map:**
- `400` → INVALID_INPUT (malformed body / schema fail)
- `401` → AUTH_REQUIRED
- `403` → FORBIDDEN
- `404` → NOT_FOUND
- `409` → DUPLICATE | INVALID_STATE
- `422` → OUT_OF_WINDOW | semantic INVALID_INPUT
- `500` → INTERNAL (logged, generic message returned)

The frontend reads `error.code` for branching and `error.message` for display.

---

## §12 — Acceptance Criteria (14)

All 14 must pass before demo sign-off.

- **AC1** — An SM can log into the mobile app with Supabase credentials and only see their assigned project.
- **AC2** — From the roster, an SM can clock in a worker; the row reflects `clocked_in` within 1 second (optimistic).
- **AC3** — A duplicate clock-in for the same worker/date returns 409 DUPLICATE with a clear toast message.
- **AC4** — Clock-out without a prior clock-in returns 409 INVALID_STATE.
- **AC5** — Clock-out time earlier than clock-in returns 422 INVALID_INPUT.
- **AC6** — `mark-absent` from any state other than no_record returns 409 INVALID_STATE.
- **AC7** — `undo` works for today and yesterday; rejected with 422 OUT_OF_WINDOW for any older date.
- **AC8** — Web dashboard summary cards (Present / Clocked Out / Absent / No Record) match `GET /attendance/summary` exactly.
- **AC9** — Total Hours and Overtime columns render as `"8h 30m"` / `"—"` and use `project.standard_hours` for OT.
- **AC10** — A mobile clock-in appears on the web dashboard within 5 seconds without manual refresh.
- **AC11** — XLSX export honors current filters and contains all columns per §9 with correct hour math.
- **AC12** — The Details page audit timeline shows who did what, when, with before→after diffs.
- **AC13** — A user with no SM assignment on a project cannot record attendance there; blocked at BOTH the API (403) and RLS layers.
- **AC14** — All error responses match the §11 envelope shape with consistent `code` values.

---

## §13 — Design System (Brutalist / Industrial)

> Construction subject matter — the UI should feel like a job site, not a SaaS dashboard.

### §13.1 — Tokens

```css
/* Color */
--ink:        #0A0A0A;   /* primary text, borders */
--paper:      #F5F5F0;   /* background */
--steel:      #3D3D3D;   /* secondary text */
--concrete:   #8A8A8A;   /* muted */
--orange:     #FF6B00;   /* safety-orange, primary action */
--yellow:     #FFD60A;   /* hazard, warnings */
--green:      #1F7A3A;   /* clocked_in */
--red:        #B91C1C;   /* errors, absent */
--blue:       #1E40AF;   /* clocked_out */

/* Type */
--font-mono:    "JetBrains Mono", ui-monospace, monospace;
--font-display: "Space Grotesk", system-ui, sans-serif;
--font-body:    "Inter", system-ui, sans-serif;

/* Geometry */
--border-w:   2px;
--border:     2px solid var(--ink);
--radius:     0;                          /* no rounded corners, ever */
--shadow:     4px 4px 0 var(--ink);       /* hard offset, no blur */
--shadow-sm:  2px 2px 0 var(--ink);

/* Spacing — exposed 8px grid */
--g1: 8px;  --g2: 16px;  --g3: 24px;  --g4: 32px;  --g5: 48px;
```

### §13.2 — Component rules

- **All borders 2px solid `--ink`.** No subtle gray lines.
- **No `border-radius` anywhere.** Cards, buttons, inputs, pills — all sharp rectangles.
- **Buttons:** chunky, uppercase labels, mono font, hard shadow. On press: shadow collapses (`translate(2px,2px); box-shadow:none`).
- **Status pills:** rectangle, mono uppercase text, solid fill from §13.1:
  - `clocked_in` → green bg, paper text
  - `clocked_out` → blue bg, paper text
  - `absent` → red bg, paper text
  - `no_record` → ink border, ink text, paper bg
- **Tables:** monospace numbers, ink grid lines, header row in ink bg / paper text.
- **Timestamps & numbers:** always monospace.
- **Headers:** Space Grotesk, heavy weights (700/900), uppercase.
- **Body text:** Inter.
- **Forms:** flat fields with 2px ink border, no focus ring — instead, focus shifts the field by (-2px, -2px) and adds the hard shadow.
- **Icons:** stroke-based (Lucide), 2px stroke width, never filled.

### §13.3 — Mobile-specific

- Same tokens. The mobile app is dense and information-first.
- Status pills are full-width on each row for tap-friendly visibility.
- Action buttons are large (min 48px tall), uppercase, monospace.
- No swipe gestures for destructive actions — tap-confirm always.

---

## §14 — Seed Data (for development & demo)

**Projects:**
- BGC Verdana Tower (Taguig) — standard_hours 8
- Cavite Industrial Warehouse (Imus) — standard_hours 8
- Katipunan Renovation (Quezon City) — standard_hours 9

**Users:**
- admin@bxb.test / password — role: admin
- gm@bxb.test / password — role: general_manager
- pm@bxb.test / password — role: project_manager (assigned: BGC, Cavite)
- princess@bxb.test / password — role: site_manager (assigned: BGC)
- carl@bxb.test / password — role: site_manager (assigned: Cavite)
- chelsie@bxb.test / password — role: site_manager (assigned: Katipunan)

**Workers (sample, per project):**
- BGC: Mario Reyes (Foreman), Jomar Cruz (Mason), Aileen Santos (Steelworker), + 5 more
- Cavite: 6 workers
- Katipunan: 4 workers

Seed yesterday's and today's attendance with a realistic mix of statuses so the dashboard has data on first boot.

---

## §15 — Out of Scope (MVP)

Explicit non-goals so Claude Code doesn't drift:

- Worker-facing app or self-clock
- Geofencing / GPS verification
- Biometric / face capture
- Payroll calculation (just hour totals, not pay)
- Multi-project worker assignments (one worker = one active project)
- Cross-midnight shifts beyond a 4h grace
- Push notifications
- SMS / email reminders
- Multi-tenant / multi-organization
- Internationalization (Filipino English only)
- Dark mode

---

**End of spec.** Any behavior not described here is at the implementer's discretion but must not violate §0.