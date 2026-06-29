# Sprint 1 — Verification (API: Auth + Endpoints + Guards)

> All of SPEC §7 implemented in `api/` (Express + TypeScript). Auth, every
> endpoint, every guard, the §11 envelope. No UI / realtime / export (later
> sprints). **42 automated tests pass** (`npm test`); a 35-check live smoke
> across roles/guards passed against the hosted DB.

---

## 1. What was implemented (tasks A–G)

- **A. Auth** — `lib/auth.ts` (JWT verify + cached profile lookup → `req.user`), `middleware/require-auth.ts` (global except `/health`), `require-role.ts`, `require-assignment.ts`. `lib/access.ts` holds the shared `assertProjectAccess` used by both middleware and write handlers.
- **B. Helpers** — `lib/time.ts` (`now`/`nowPHT`/`todayPHT`/`isInCorrectionWindow`/`isWithinWorkHours`/`isFuture` + `phtDate`/`phtHour`/`toPhtIso`/`addDaysToYmd`, injectable clock), `lib/hours.ts` (`calculateHours`/`calculateOvertime`/`formatHours`), `lib/errors.ts` extended (AppError + asyncHandler + §11 envelope + ZodError→400). `lib/db.ts` (pg pool + `withTransaction`).
- **C. Identity** — `routes/me.ts`: `GET /me`, `GET /me/projects`.
- **D. Projects + roster** — `routes/projects.ts`: `GET /projects`, `GET /projects/:id`, `GET /projects/:id/roster` (single left-join query, no N+1).
- **E. Writes** — `routes/attendance.ts`: clock-in, clock-out, mark-absent, undo, edit-time. Each wraps the data write + `attendance_logs` write in one `pg` transaction.
- **F. Reads** — same file: `GET /attendance` (single + range), `/attendance/summary`, `/attendance/:id`, `/attendance/:id/logs`.
- **G. Wired** in `app.ts` (factory, for tests) + `index.ts` (listen). zod schemas in `schemas/attendance.ts`.

**Transaction approach:** `pg` directly for **all** DB access (reads and writes). `@supabase/supabase-js` has no transaction support, and SPEC §6 requires the data + log writes to share one transaction — so `withTransaction()` (BEGIN/COMMIT/ROLLBACK) is used for every state change. Joined reads (roster, list, summary, details) are plain parameterized SQL.

---

## 2. Endpoint table

| Method + path | Happy | Key guards / rules | Log action |
|---|---|---|---|
| `GET /health` | 200 | open (G1 exempt) | — |
| `GET /me` | 200 | G1 | — |
| `GET /me/projects` | 200 | G1; role-scoped | — |
| `GET /projects` | 200 | G1; role-scoped | — |
| `GET /projects/:id` | 200 | G1, G2 (403), 404 | — |
| `GET /projects/:id/roster?date` | 200 | G1, G2/G9 (assignment) | — |
| `POST /attendance/clock-in` | 201 | G3 (dup→409), G8, G10, G12, G9 | `clock_in` / `proxy_clock_in` |
| `POST /attendance/clock-out` | 200 | G4, G5, G8, G12 (+grace) | `clock_out` / `proxy_clock_out` |
| `POST /attendance/mark-absent` | 201 | G6 (exists→409), G10, G9 | `mark_absent` |
| `POST /attendance/undo` | 200 | G7 (window→422), 404, G2 | `undo` |
| `PATCH /attendance/:id/edit-time` | 200 | web roles only (SM→403), G5, G8, G12 | `edit_time` |
| `GET /attendance?date|from&to&project_id` | 200 | G1, G2; mixing modes→400 | — |
| `GET /attendance/summary?date&project_id` | 200 | G1, G2 | — |
| `GET /attendance/:id` | 200 | G1, G2 (403), 404 | — |
| `GET /attendance/:id/logs` | 200 | G1, G2; newest-first | — |

`proxy_*` actions are written when the actor is admin/GM/PM (web); plain `clock_in`/`clock_out` for the SM (mobile).

---

## 3. Acceptance criteria (Sprint 1 scope)

All proven live. Get a token first:

```bash
SB=https://rthrywanzluiahamfjmg.supabase.co
ANON='<VITE_SUPABASE_ANON_KEY from web/.env>'
TOKEN=$(curl -s "$SB/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H 'content-type: application/json' \
  -d '{"email":"princess@bxb.test","password":"password"}' | jq -r .access_token)
# Pick a project + a no_record worker:
PID=$(curl -s localhost:4000/api/v1/me/projects -H "authorization: Bearer $TOKEN" | jq -r '.[0].id')
# Use yesterday + 08:00/17:00 PHT for write tests (valid work-hours, in-window).
```

| AC | Result | Proof (curl) | Observed |
|---|---|---|---|
| **AC3** duplicate clock-in → 409 DUPLICATE | ✅ | `POST /attendance/clock-in` twice (same worker/date) | 2nd → `409 {"error":{"code":"DUPLICATE",...}}` |
| **AC4** clock-out w/o clock-in → 409 INVALID_STATE | ✅ | `POST /attendance/clock-out` on a no_record worker | `409 {"error":{"code":"INVALID_STATE",...}}` |
| **AC5** clock-out before clock-in → 422 INVALID_INPUT | ✅ | clock-out at `07:00` after clock-in `08:00` | `422 {"error":{"code":"INVALID_INPUT",...}}` |
| **AC6** mark-absent from non-no_record → 409 INVALID_STATE | ✅ | `POST /attendance/mark-absent` on a clocked-in worker | `409 {"error":{"code":"INVALID_STATE",...}}` |
| **AC7** undo today/yesterday ok; older → 422 OUT_OF_WINDOW | ✅ | undo a yesterday row (200 `{"ok":true}`); undo a 10-day-old row | older → `422 {"error":{"code":"OUT_OF_WINDOW",...}}` |
| **AC13** unassigned SM cannot record → 403 (API) **and** RLS | ✅ | princess (SM BGC) clock-in on a Katipunan worker | API `403 FORBIDDEN`; RLS direct-insert `42501` (proven Sprint 0) |
| **AC14** all errors use §11 envelope | ✅ | every error above | `{ "error": { "code", "message", "details?" } }` consistently |

Representative happy-path bodies (live):

```json
// POST /attendance/clock-in → 201
{ "id":"…","worker_id":"…","project_id":"…","work_date":"2026-06-28",
  "status":"clocked_in","clock_in_at":"2026-06-28T08:00:00+08:00","clock_out_at":null,
  "total_hours":null,"overtime":null, … }

// POST /attendance/clock-out → 200  (8h+OT after edit-time set in to 08:30)
{ "status":"clocked_out","clock_in_at":"2026-06-28T08:30:00+08:00",
  "clock_out_at":"2026-06-28T17:00:00+08:00","total_hours":8.5,"overtime":0.5, … }

// GET /attendance/summary → 200
{ "total_workers":10,"clocked_in":4,"clocked_out":1,"absent":0,
  "no_record":5,"total_hours":8.5,"total_overtime":0.5 }
```

---

## 4. Race-condition test (G3)

`tests/api.test.ts` → "two parallel clock-ins". Fires two identical `POST /attendance/clock-in` via `Promise.all` for the same `(worker_id, work_date)`. **Result: statuses `[201, 409]`** — exactly one insert wins; the other is translated from Postgres `23505` to `409 DUPLICATE`. No check-then-insert in app code; the `UNIQUE(worker_id, work_date)` constraint is the synchronization primitive (CLAUDE.md gotcha #1).

## 5. Transaction-integrity test (§6)

`tests/transaction.test.ts`. Inside one `withTransaction`, inserts a valid attendance row then an `attendance_logs` row with a **non-existent `actor_id`** (FK violation). The transaction rejects, and a follow-up query confirms **no attendance row persisted** — proving the data write rolls back when the log write fails.

---

## 6. Tests

`npm test` → **42 passing** across 4 files (vitest):
- `tests/hours.test.ts` (8) — §3 math incl. the 9.48 / 1.48 spec example.
- `tests/time.test.ts` (8) — correction window, work-hours, future, PHT formatting (frozen clock).
- `tests/api.test.ts` (25) — happy + adverse per endpoint, all Sprint-1 ACs, race condition.
- `tests/transaction.test.ts` (1) — §6 rollback.

**Runner: vitest** (chosen over `node --test` because Vitest's Vite resolver transparently handles the project's NodeNext `.js`-extension ESM imports with no loader shim). Integration tests run against the live hosted DB using **dedicated temp workers** on a fixed yesterday date with in-work-hours times, and clean themselves up (logs → attendance → workers) in `afterAll`. After the suite, the DB is back to the exact seed state (18 workers / 25 attendance / 25 logs).

---

## 7. Deviations from SPEC / this prompt (with reasoning)

1. **JWT verified with ES256 via JWKS, not HS256 `SUPABASE_JWT_SECRET`** (sprint A1 said HS256). The hosted project signs access tokens with **ES256** (token header `alg: ES256`, `kid`), so the legacy HS256 secret cannot verify them. `lib/auth.ts` verifies against the project JWKS (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`) with issuer check — still local + cached (no per-request Auth call, CLAUDE.md gotcha). `SUPABASE_JWT_SECRET` is now **optional** in `env.ts`. This is reality-vs-spec; the spec's HS256 assumption is stale. **Recommend updating SPEC/CLAUDE.md env notes.**
2. **`pg` for all DB access** (not supabase-js for reads). Needed real transactions for §6; using pg uniformly keeps reads/writes consistent and gives clean joined SQL. (Sprint hinted pg-writes + supabase-js-reads; consolidated to pg.)
3. **Cross-midnight grace implemented** (§3): clock-out may land next-day in PHT only up to **04:00** (≤ midnight + 4h); otherwise G12's 05:00–23:00 applies. `clock_in_at` must fall on `work_date` (PHT) for consistency.
4. **Missing worker → 404, unassigned worker → 403.** Sprint E1 lists 403 for "worker not in user's project"; a worker that doesn't exist at all returns 404 NOT_FOUND (403 only when it exists but the caller isn't assigned). Inactive workers are treated as not found for writes.
5. **edit-time preserves `status`** and only updates the provided clock columns; hours are recomputed from the new times. `recorded_by` is left as the original recorder; the editor is captured as the log `actor_id`.
6. **`date` columns returned as `YYYY-MM-DD` strings** (pg type-parser override for OID 1082) to stop `work_date` drifting through JS `Date`/timezone.

No Sprint 0 migrations were modified.

---

## 8. Open questions for Princess

1. **`SUPABASE_JWT_SECRET` is now unused** (ES256/JWKS). Keep it in `env.example` for a possible HS256 fallback, or drop it from the spec env list? (Currently optional.)
2. **G12 vs §3 cross-midnight grace** genuinely conflict for early-morning clock-outs (a 02:00 next-day clock-out is allowed by the grace but outside 05:00–23:00). I let the grace win for a next-day clock-out ≤ 04:00. Confirm that's the intended precedence.
3. **Roster `date`** is currently unbounded (any valid date). The mobile UI restricts to today/yesterday; should the API also reject roster reads outside a window, or keep reads unrestricted?

---

## 9. Manual verification commands

```bash
cd api && npm install && npm run dev          # boots on :4000
npm test                                       # 42 passing
# token + AC checks: see §3 above
# Postman: import docs/postman/bxb.postman_collection.json (sets {{auth_token}} via Supabase sign-in)
```
