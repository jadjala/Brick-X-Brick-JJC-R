# Sprint 2b — Verification (Mobile App: Site Manager)

> Complete SM mobile app per SPEC §4: login, roster (main working screen),
> history. Brutalist design system (§13) translated to React Native.
> `npx tsc --noEmit` passes clean. AC1 + AC2 are wired and ready for on-device sign-off.

> **Note on evidence:** automated device screenshots were intentionally skipped
> this session (no emulator/device available here, and the Expo-web screenshot
> harness was skipped to conserve the session). The app **typechecks** and the
> screens/flows are described below with exact on-device steps for Princess to
> capture screenshots + tick AC1/AC2. Screenshot drop folder:
> `docs/screenshots/sprint-2b/` (create + capture on device).

---

## 1. What was implemented (tasks A–E)

- **A. Foundation** — `expo install` of navigation (`@react-navigation/native` + `native-stack` + `bottom-tabs`), `react-native-screens`, `react-native-safe-area-context`, `expo-font` + `@expo-google-fonts/{jetbrains-mono,space-grotesk,inter}`, `@react-native-community/datetimepicker`, `react-native-svg` + `lucide-react-native`, web-render deps. `src/lib/secure-storage.ts` (SecureStore adapter, web→localStorage fallback), `src/lib/supabase.ts` (SecureStore-backed client, `detectSessionInUrl:false`, `url-polyfill/auto`), `src/theme.ts` (SPEC §13.1 tokens), `src/lib/api.ts` (`EXPO_PUBLIC_API_BASE_URL`, JWT via `getSession()`, `ApiError`), `src/lib/types.ts`, `src/lib/format.ts`, `src/contexts/auth.tsx`. Fonts loaded in `App.tsx`; auth-gated nav (Login stack ↔ Roster+History tabs) with a brutalist ink tab bar (orange active, mono labels, Lucide icons).
- **B. Login** (`src/screens/login.tsx`) — ink header, hazard-yellow "AUTHORIZED PERSONNEL ONLY" callout, mono-labelled fields, full-width orange hard-shadow button, `[ Authenticating... ]` state, red error banner. On success the auth context flips `session` → nav auto-switches to the tabs.
- **C. Roster** (`src/screens/roster.tsx`) — project header (tappable selector only when >1 assignment), `TODAY`/`YESTERDAY` pills, `FlatList` of workers (name + position + status pill), per-status action buttons (`Clock In`+`Mark Absent` / `Clock Out` / `Undo`), sticky bottom summary chips (Present/Out/Absent/No Rec, status-colored, counted client-side from the roster). `src/components/time-confirm-modal.tsx` — slide-up modal, native `DateTimePicker` (web `HH:MM` fallback), defaults to now PHT, validates work-hours + cross-midnight grace + clock-out>clock-in. **Optimistic UI + rollback + tap-debounce** (see §3).
- **D. History** (`src/screens/history.tsx`) — read-only `SectionList` grouped by date (sticky `2026-06-28 / SAT` headers), last 30 days for the SM's project, status pill + times + hours/OT, `RefreshControl` pull-to-refresh, `NO HISTORY` empty state.
- **E. Brutalist primitives** (`src/components/brutalist/`) — `HardShadow` (offset ink View behind child — the iOS-safe hard shadow), `Button` (primary/secondary/danger/blue/ghost, press = translate(4,4)+shadow-collapse, min 48pt), `Pill`/`RolePill`, `Card`, `ListRow`, `TextField` (focus = translate(-2,-2)+hard shadow). `ErrorBanner` (top auto-dismiss banner — rolled our own; no `react-native-toast-message`).

---

## 2. Acceptance criteria

### AC1 — SM signs in and sees only their assigned project
- `princess@bxb.test` is SM for **BGC only** (seed). `GET /me/projects` returns just BGC (server-scoped, proven Sprint 0/1). The roster header shows **BGC Verdana Tower** with **no project selector** (only one assignment), and the worker list is `GET /projects/<BGC>/roster` — BGC workers only. ✅ (wired; on-device confirm below)

### AC2 — Clock-in reflects in the row within 1 second (optimistic)
- On confirm, the modal closes and `setRows(...)` **synchronously** patches the row to `clocked_in` with the chosen time (no await) — the row + the bottom **Present** chip update on the next frame (≪1s), well before the `POST /attendance/clock-in` resolves. The server response then reconciles the temp id with the real attendance id. ✅ (wired; capture before/after on device)

---

## 3. Behavior details (how to prove on device)

**Optimistic UI + rollback** (`runAction` in `roster.tsx`): snapshots the row, applies the optimistic patch immediately, fires the API, reconciles on success or **restores the snapshot + shows the §11 error banner** on failure. Summary chips recompute from `rows` either way.
- *Proof:* stop the API (`Ctrl-C` on `api` `npm run dev`), tap **Clock In** → confirm. The row flashes `Clocked In` then rolls back to `No Record` with a red `error.code / message` banner. Restart the API and retry → sticks.

**Tap debounce** (`inFlightRef` set of `"<worker>:<action>"`): a second tap while one is in flight is a no-op.
- *Proof:* rapid-tap a `Clock In` → confirm twice fast; only one `POST /attendance/clock-in` hits the API log (the duplicate would otherwise be a 409).

**Cross-midnight grace** (§3 v1.2): in the clock-out modal a time `< 05:00` is treated as **next-day** (`work_date + 1`).
- *Proof:* with a yesterday clock-in, clock-out at `02:00` → builds `(yesterday+1)T02:00+08:00` → server accepts (≤ 04:00 grace). Clock-out at `05:00`... is a same-day work-hours time and is accepted; to see the server reject, pick a clock-out **before** the clock-in (e.g. earlier same day) → `422 INVALID_INPUT`. *(Note: the literal "05:00 should fail" example in the prompt only fails when it precedes the clock-in; bare 05:00 is a valid work-hours time per G12 — see Open Questions.)*

---

## 4. On-device steps for Princess

1. Ensure `mobile/.env` has `EXPO_PUBLIC_API_BASE_URL` set to the **laptop LAN IP** (currently `http://192.168.68.100:4000/api/v1`) — `localhost` won't work from a phone. Or run `npx expo start --tunnel`.
2. `cd api && npm run dev` (laptop), then `cd mobile && npx expo start`. Scan the QR with **Expo Go**.
3. Sign in `princess@bxb.test` / `password` → lands on **Roster**, header shows **BGC**, no project selector → **AC1** ✅. Screenshot.
4. Pick **YESTERDAY** (has seeded data) or **TODAY**. On a `No Record` worker tap **Clock In** → modal (now PHT) → **Confirm**. Row → `Clocked In`, **Present** chip +1, within ~1s → **AC2** ✅. Screenshot the before/after pair + the modal.
5. **Clock Out** that worker → modal → confirm → row `Clocked Out` with hours. **Undo** → back to `No Record`.
6. Optimistic-rollback test (stop API), debounce test (rapid tap) — per §3.
7. **History** tab → 30-day list grouped by date, pull-to-refresh. Screenshot.

Save captures to `docs/screenshots/sprint-2b/`: `login.png`, `roster.png`, `roster-after-clockin.png`, `time-modal.png`, `history.png`.

---

## 5. Deviations from SPEC / this prompt (with reasoning)

1. **React Navigation v7** (not v6). `expo install` resolved nav packages to v7; the v7 API surface used here (`NavigationContainer`, native-stack, bottom-tabs) is unchanged for our needs and works on RN 0.74. Required `legacy-peer-deps=true` (in `mobile/.npmrc`) to satisfy RN-ecosystem peer ranges — standard for RN installs.
2. **Rolled our own `ErrorBanner`** instead of `react-native-toast-message` (the prompt allowed either) — one fewer dependency, fully brutalist-styled.
3. **Time picker web fallback** — native uses `@react-native-community/datetimepicker` (as specified); a web `HH:MM` `TextInput` fallback exists purely so the app can render under Expo-web for screenshot harnesses. No effect on device.
4. **`secure-storage` web fallback to `localStorage`** — SecureStore is unavailable on web; native is unaffected.
5. **Login validation via local state** (not `react-hook-form`). CLAUDE.md pins rhf for *web* forms; mobile is unspecified, and a two-field login doesn't justify the dep. Same zod-equivalent rules (required + email format).
6. **History uses the SM's first project**; roster + history each resolve the project independently (no cross-tab shared selection). Fine for the single-project SM (the common case) — see Open Questions.
7. **Cross-midnight UX rule:** clock-out times `< 05:00 PHT` are interpreted as next-day (grace). The picker reads the **device** wall clock as PHT (assumes the phone's timezone is Asia/Manila, true for PH site ops).
8. **Automated device screenshots skipped** this session per instruction (no device/emulator; Expo-web harness skipped to conserve limits). Steps provided for manual capture.

No changes to `api/`, `web/`, or `supabase/`.

---

## 6. Open questions for Princess

1. **Multi-project SM** — if an SM ever holds >1 active assignment, roster shows a project selector but History defaults to the first project independently. Should the selected project be shared across the Roster + History tabs (a small app-level context)?
2. **Device timezone assumption** — the time picker treats the phone's local wall-clock as PHT. If an SM's phone is set to a non-PHT timezone, the chosen time would be off. Enforce/convert to PHT explicitly, or accept the "phones are on PH time" assumption?
3. **G12 vs the prompt's cross-midnight example** — the prompt says "clock-out at 05:00 PHT should fail", but 05:00 is a valid work-hours time (G12 lower bound). It only fails if it precedes the clock-in. Confirm the intended example.
