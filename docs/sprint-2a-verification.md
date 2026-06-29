# Sprint 2a — Verification (Web Admin Dashboard)

> Complete web admin per SPEC §5: login, attendance dashboard, details + audit
> timeline. Brutalist design system (§13) applied throughout. `npm run build`
> passes with no TS errors. **AC8, AC9, AC12 proven** with screenshots below.

---

## 1. What was implemented (tasks A–F)

- **A. Routing + auth** — `react-router-dom` v6 with `/login`, `/attendance`, `/attendance/:id`, `/` → redirect, `*` → brutalist 404. `src/lib/supabase.ts` (browser client, localStorage session), `src/contexts/auth.tsx` (`session`+`profile`+`loading`, `onAuthStateChange`, fetches `/me` for role), `src/routes/require-auth.tsx` (loading screen / redirect / `<Outlet/>`).
- **B. API client** — `src/lib/api.ts` (`get/post/patch/del`, reads `VITE_API_BASE_URL`, auto-attaches the JWT via `supabase.auth.getSession()` per request, throws `ApiError` from the §11 envelope). `src/lib/types.ts` (Profile, Project, RosterRow, AttendanceJoined, AttendanceSummary, AttendanceLog). `src/hooks/use-api.ts` (small `useState`/`useEffect` fetch hook with `refetch` — no TanStack Query).
- **C. Login** — `src/pages/login.tsx`: rhf + zod, Supabase sign-in, brutalist OSHA layout (ink signage panel, hazard tape, hard-hat, orange hard-shadow CTA), red error banner, `[ Authenticating... ]` state.
- **D. Dashboard** — `src/pages/attendance-dashboard.tsx` + `Header`, `FilterStrip` (single/range date, project dropdown, status chips, disabled Export w/ "Available in Sprint 3" tooltip), `SummaryCards` (7), `AttendanceTable` (10 cols, status pills, mono times/hours), `RowActions` (radix dropdown), `TimePickerDialog`, `ConfirmDialog`.
- **E. Details** — `src/pages/attendance-details.tsx`: record definition-list card + `AuditTimeline` (vertical ink rule, square dots, action badges colored by type, actor + role pill, PHT timestamp w/ seconds, before→after diff blocks; AFTER-only for creates, BEFORE-only for undo).
- **F. Brutalist primitives** — `src/components/brutalist/`: `Button` (primary/secondary/danger/ghost, press = translate(2,2)+shadow-collapse), `Pill`/`RolePill`, `Card`, `Table` family (`numeric` prop), `Input`/`Field` (focus = translate(-2,-2)+hard shadow, no ring), `Skeleton`/`LoadingScreen` (hazard-stripe shimmer). Radix wrappers (`dropdown-menu`, `dialog`) + `sonner` `Toaster` all styled brutalist (square, 2px ink, hard shadow). De-duped toasts keyed by error code (gotcha #6).

`npm run build` → ✅ (2036 modules, tsc clean). No `rounded-*`/soft-`shadow-*` leaks.

---

## 2. Screenshots

`docs/screenshots/sprint-2a/`
- `01-login.png` — login (OSHA signage + form).
- `02-dashboard.png` — princess (SM) dashboard, 2026-06-28, summary cards + table.
- `03-details.png` — details + 3-entry audit timeline.
- `04-pm-dashboard.png` — `pm@bxb.test` dashboard (role-scoped project dropdown).

---

## 3. Acceptance criteria

### AC8 — Summary cards equal `GET /attendance/summary` exactly
`02-dashboard.png` cards vs the live API response for `date=2026-06-28&project_id=<BGC>`:

```json
{ "total_workers": 9, "clocked_in": 4, "clocked_out": 1, "absent": 0,
  "no_record": 4, "total_hours": 8.5, "total_overtime": 0.5 }
```
Cards rendered: Total Workers **9** · Present **4** · Clocked Out **1** · Absent **0** · No Record **4** · Total Hours **8h 30m** (=8.5) · Total OT **0h 30m** (=0.5). Exact match — no client-side recalculation (the page binds straight to the summary endpoint). ✅

### AC9 — Total Hours / Overtime formatting
`02-dashboard.png`:
- **"8h 30m"** — DEMO Mendoza (clocked_out, 08:30→17:00), OT **"0h 30m"** against BGC `standard_hours = 8`.
- **"—"** — every clocked_in row (e.g. Aileen Santos, Jomar Cruz) renders an em dash for Total Hours + Overtime (no clock-out yet). ✅

### AC12 — Audit timeline (actor + role + timestamp + before→after)
`03-details.png`, 3 entries newest-first:
1. **EDIT TIME** — Diego Bautista · `ADMIN` · 05:31:00 PHT · before `clock_in_at 08:00` → after `08:30`.
2. **CLOCK OUT** — Princess Lopez · `SM` · before `status clocked_in / clock_out_at ∅` → after `clocked_out / 17:00`.
3. **CLOCK IN** — Princess Lopez · `SM` · AFTER-only (creation): `status clocked_in, clock_in_at 08:00`.

Each shows the action badge (color-coded), actor full name, role pill, PHT timestamp with seconds, and a clear before→after diff of changed fields. ✅

> The `03-details.png` record was produced by a real action sequence through the
> API the UI calls: clock-in + clock-out (as `princess`/SM) then edit-time (as
> `admin`) — i.e. the same `POST /attendance/clock-in|clock-out` + `PATCH .../edit-time`
> the dashboard dialogs invoke, with audit rows written per §6.

### Action flow (DoD #6) — note on automated verification
The dashboard action handlers (`runWrite` → `api.post(...)` → success toast +
`refetch`) are wired and type-checked, and the underlying endpoints are proven by
Sprint 1's 42 tests + smoke. The **interactive** click-through (open the `⋯`
menu → confirm dialog) could **not** be automated here: the Radix dropdown does
not open under headless Chrome (pointer-capture / `data-state` never flips via
simulated pointer **or** keyboard events) — an automation-harness limitation, not
an app defect (all 8 row-action triggers render correctly). **Recommended: a 10-second
manual click-test** (steps in §7) to tick DoD #6 with a live success toast.

---

## 4. Role-gating spot-check (`pm@bxb.test`)

- **Project dropdown** (`04-pm-dashboard.png`, read live): options = `["BGC Verdana Tower", "Cavite Industrial Warehouse"]` — **Katipunan absent**. ✅ (Source: `GET /me/projects`, role-scoped server-side.)
- **Katipunan visibility** — a PM never receives Katipunan rows (not in the dropdown, and `GET /attendance?project_id=<Katipunan>` would 403). Any API error (incl. 403) is routed through `notify.apiError` → a single de-duped brutalist error toast; the page does not crash (the dashboard renders empty/last-good state). Verified by the error-handling path in `attendance-dashboard.tsx`.
- **Action gating** — proxy clock in/out only appear for admin/GM/PM (hidden for SM); Undo only within today/yesterday; Mark Absent only from no_record; View only when an `attendance_id` exists (`src/lib/dash.ts`).

---

## 5. Deviations from SPEC / this prompt (with reasoning)

1. **Web dashboard is accessible to SM** even though §1 marks "View dashboard (web)" ❌ for site_manager. DoD #4 explicitly requires `princess` (SM) to sign in and land on the dashboard, so the web app is treated as **permissive + API-scoped**: any authenticated role sees the dashboard scoped to their projects; **actions** are gated by the §1 matrix (SM sees only Mark Absent / Undo, never proxy clock in/out / edit-time). Flagged rather than silently resolved.
2. **"Recorded By" shows name only, no role badge.** SPEC §5.2 asks for "full_name + role badge", but the roster and `/attendance` responses return only `recorded_by_name`, not the recorder's role. No API changes are allowed this sprint, so the column shows the name. → **Open question #1.**
3. **Data source (gotcha #2 — chosen explicitly):** single-date mode is driven by `GET /projects/:id/roster?date=` (the only source that surfaces `no_record` workers); range mode is driven by `GET /attendance?from&to` (existing rows only — no `no_record`, which is per-date). Status filter is applied client-side over the unified row set.
4. **Summary cards show in single-date mode only.** `GET /attendance/summary` takes one date; in range mode the cards are replaced with a note. Keeps AC8 honest (no client recompute).
5. **One project at a time.** `summary`/`roster` are per-project, so the dashboard operates on a single selected project (default = first from `/me/projects`); there is no combined "all projects" view.
6. **Native `<input type="date">`** (brutalist-styled) instead of a custom calendar component — keeps the dependency surface minimal (no calendar lib).
7. **`tsc -b` build artifacts** (`web/vite.config.js`, `.d.ts`, `*.tsbuildinfo`) are git-ignored.

---

## 6. Open questions for Princess

1. **Recorder role badge** needs the API to add `recorded_by_role` to the roster + `/attendance` responses. Add it in Sprint 3, or accept name-only in the "Recorded By" column? (Currently name-only.)
2. **Should SM be hard-blocked** from the web dashboard to match §1 literally, or is the permissive-API-scoped behavior (with action gating) acceptable? (Sprint DoD #4 implied the latter.)
3. **Range-mode summary** — leave it single-date-only (current), or add client-computed range totals (would diverge from a single API call)?

---

## 7. Manual verification (Princess)

```bash
cd api && npm run dev          # :4000  (needs api/.env)
cd web && npm install && npm run dev   # :5173  (needs web/.env with VITE_SUPABASE_*)
```
1. Open the dev URL → redirected to `/login`. Sign in `princess@bxb.test` / `password` → lands on `/attendance`.
2. Set the date to **2026-06-28**, project **BGC Verdana Tower**. Confirm the 7 cards match `GET /attendance/summary?date=2026-06-28&project_id=<BGC>` (AC8); confirm a `8h 30m` row and `—` rows (AC9).
3. On a clocked_out / clocked_in row → `⋯` → **View** → details page; scroll to the audit timeline (AC12).
4. From a `no_record` row → `⋯` → **Mark Absent** → confirm → success toast + table/cards refresh. Then `⋯` → **Undo** → row returns to no_record.
5. Sign out → sign in `pm@bxb.test` → project dropdown shows **BGC + Cavite only** (role gating).
```
