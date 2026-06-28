/**
 * BxB Attendance Module — idempotent seed (SPEC §14).
 *
 * Creates 6 auth users + profiles, 3 projects, project_assignments (incl. the PM
 * across BGC + Cavite), workers, and a realistic mix of yesterday/today
 * attendance with matching audit logs. Re-running does not duplicate.
 *
 * Run:  npm run seed   (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in ../../.env or env)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';

// Load .env from supabase/seed/.env, then fall back to supabase/.env.
loadEnv();
loadEnv({ path: '../.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '\n[seed] Missing env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
      '(in supabase/seed/.env or supabase/.env).\n',
  );
  process.exit(1);
}

const TZ = 'Asia/Manila'; // PHT, fixed UTC+8 (no DST)
const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// PHT calendar dates as YYYY-MM-DD.
const todayStr = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
const yesterdayStr = formatInTimeZone(subDays(new Date(), 1), TZ, 'yyyy-MM-dd');

/** PHT clock instant as an ISO timestamptz string (offset is always +08:00). */
const pht = (dateStr: string, h: number, m: number): string =>
  `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`;

const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// ────────────────────────────── data (SPEC §14) ──────────────────────────────

type Role = 'admin' | 'general_manager' | 'project_manager' | 'site_manager';

const USERS: { email: string; full_name: string; role: Role }[] = [
  { email: 'admin@bxb.test', full_name: 'Diego Bautista', role: 'admin' },
  { email: 'gm@bxb.test', full_name: 'Liza Mercado', role: 'general_manager' },
  { email: 'pm@bxb.test', full_name: 'Ramon Villanueva', role: 'project_manager' },
  { email: 'princess@bxb.test', full_name: 'Princess Lopez', role: 'site_manager' },
  { email: 'carl@bxb.test', full_name: 'Carl Domingo', role: 'site_manager' },
  { email: 'chelsie@bxb.test', full_name: 'Chelsie Aquino', role: 'site_manager' },
];
const PASSWORD = 'password';

const PROJECTS = [
  { name: 'BGC Verdana Tower', location: 'Taguig', standard_hours: 8 },
  { name: 'Cavite Industrial Warehouse', location: 'Imus', standard_hours: 8 },
  { name: 'Katipunan Renovation', location: 'Quezon City', standard_hours: 9 },
];

// SM per project + the PM spanning BGC + Cavite (SPEC §14).
const SM_BY_PROJECT: Record<string, string> = {
  'BGC Verdana Tower': 'princess@bxb.test',
  'Cavite Industrial Warehouse': 'carl@bxb.test',
  'Katipunan Renovation': 'chelsie@bxb.test',
};
const PM_PROJECTS = ['BGC Verdana Tower', 'Cavite Industrial Warehouse'];

// Workers per project (SPEC §14: BGC 8, Cavite 6, Katipunan 4).
const WORKERS: Record<string, { full_name: string; position: string }[]> = {
  'BGC Verdana Tower': [
    { full_name: 'Mario Reyes', position: 'Foreman' },
    { full_name: 'Jomar Cruz', position: 'Mason' },
    { full_name: 'Aileen Santos', position: 'Steelworker' },
    { full_name: 'Benjie Dela Cruz', position: 'Carpenter' },
    { full_name: 'Rico Pascual', position: 'Electrician' },
    { full_name: 'Noel Aguilar', position: 'Welder' },
    { full_name: 'Eduardo Ramos', position: 'Laborer' },
    { full_name: 'Marites Gonzales', position: 'Laborer' },
  ],
  'Cavite Industrial Warehouse': [
    { full_name: 'Arnel Tolentino', position: 'Foreman' },
    { full_name: 'Joselito Bautista', position: 'Mason' },
    { full_name: 'Ferdinand Castro', position: 'Steelworker' },
    { full_name: 'Roberto Manalo', position: 'Welder' },
    { full_name: 'Glenda Rivera', position: 'Electrician' },
    { full_name: 'Danilo Flores', position: 'Laborer' },
  ],
  'Katipunan Renovation': [
    { full_name: 'Alfredo Ocampo', position: 'Foreman' },
    { full_name: 'Cristina Navarro', position: 'Carpenter' },
    { full_name: 'Michael Salvador', position: 'Mason' },
    { full_name: 'Jenny Robles', position: 'Laborer' },
  ],
};

// ────────────────────────────── seeding steps ──────────────────────────────

/** Create auth users idempotently; return email -> user id. */
async function seedUsers(): Promise<Record<string, string>> {
  const idByEmail: Record<string, string> = {};

  // Page through existing users to short-circuit creation.
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => u.email && existing.set(u.email, u.id));
    if (data.users.length < 1000) break;
  }

  for (const u of USERS) {
    let id = existing.get(u.email);
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      });
      if (error) throw error;
      id = data.user!.id;
    }
    idByEmail[u.email] = id;
    // Ensure the profile row matches intent (the trigger handles new users; this
    // also repairs pre-existing users seeded before the trigger existed).
    const { error: pErr } = await db
      .from('profiles')
      .upsert({ id, full_name: u.full_name, role: u.role }, { onConflict: 'id' });
    if (pErr) throw pErr;
  }
  return idByEmail;
}

/** Upsert projects by name; return name -> project id. */
async function seedProjects(): Promise<Record<string, string>> {
  const idByName: Record<string, string> = {};
  for (const p of PROJECTS) {
    const { data, error } = await db
      .from('projects')
      .upsert(
        { name: p.name, location: p.location, standard_hours: p.standard_hours, status: 'active' },
        { onConflict: 'name' },
      )
      .select('id, name')
      .single();
    if (error) throw error;
    idByName[data.name] = data.id;
  }
  return idByName;
}

async function seedAssignments(
  users: Record<string, string>,
  projects: Record<string, string>,
): Promise<void> {
  const rows: { project_id: string; user_id: string; role: Role; is_active: boolean }[] = [];
  for (const [projName, smEmail] of Object.entries(SM_BY_PROJECT)) {
    rows.push({ project_id: projects[projName], user_id: users[smEmail], role: 'site_manager', is_active: true });
  }
  for (const projName of PM_PROJECTS) {
    rows.push({ project_id: projects[projName], user_id: users['pm@bxb.test'], role: 'project_manager', is_active: true });
  }
  const { error } = await db
    .from('project_assignments')
    .upsert(rows, { onConflict: 'project_id,user_id' });
  if (error) throw error;
}

/** Upsert workers per project; return project name -> worker rows (id+name+position). */
async function seedWorkers(
  projects: Record<string, string>,
): Promise<Record<string, { id: string; full_name: string; position: string }[]>> {
  const byProject: Record<string, { id: string; full_name: string; position: string }[]> = {};
  for (const [projName, list] of Object.entries(WORKERS)) {
    const rows = list.map((w) => ({ project_id: projects[projName], full_name: w.full_name, position: w.position }));
    const { data, error } = await db
      .from('workers')
      .upsert(rows, { onConflict: 'project_id,full_name' })
      .select('id, full_name, position');
    if (error) throw error;
    byProject[projName] = data;
  }
  return byProject;
}

type AttRow = {
  worker_id: string;
  project_id: string;
  work_date: string;
  status: 'clocked_in' | 'clocked_out' | 'absent';
  clock_in_at: string | null;
  clock_out_at: string | null;
  recorded_by: string;
};

/**
 * Seed yesterday (every worker gets a record: mostly clocked_out, 1-2 absent,
 * 0-1 omitted) and today (~half clocked_in, rest omitted). Idempotent: upsert on
 * (worker_id, work_date), and logs are wiped+rebuilt for the two seeded dates.
 */
async function seedAttendance(
  users: Record<string, string>,
  projects: Record<string, string>,
  workersByProject: Record<string, { id: string; full_name: string; position: string }[]>,
): Promise<{ attendance: number; logs: number }> {
  const attRows: AttRow[] = [];
  const allWorkerIds: string[] = [];

  for (const [projName, workers] of Object.entries(workersByProject)) {
    const projectId = projects[projName];
    const smId = users[SM_BY_PROJECT[projName]];
    workers.forEach((w) => allWorkerIds.push(w.id));

    // ── Yesterday: everyone gets a row except 0-1 omitted; 1-2 absent. ──
    const omitYesterday = workers.length >= 6 ? 1 : 0; // last worker has no row
    const absentCount = Math.min(workers.length, rint(1, 2));
    const present = workers.slice(0, workers.length - omitYesterday);
    present.forEach((w, i) => {
      if (i < absentCount) {
        attRows.push({
          worker_id: w.id, project_id: projectId, work_date: yesterdayStr,
          status: 'absent', clock_in_at: null, clock_out_at: null, recorded_by: smId,
        });
      } else {
        attRows.push({
          worker_id: w.id, project_id: projectId, work_date: yesterdayStr,
          status: 'clocked_out',
          clock_in_at: pht(yesterdayStr, rint(7, 8), rint(0, 59)),
          clock_out_at: pht(yesterdayStr, rint(16, 18), rint(0, 59)),
          recorded_by: smId,
        });
      }
    });

    // ── Today: ~half clocked_in (no clock-out yet), rest omitted. ──
    const half = Math.ceil(workers.length / 2);
    workers.slice(0, half).forEach((w) => {
      attRows.push({
        worker_id: w.id, project_id: projectId, work_date: todayStr,
        status: 'clocked_in',
        clock_in_at: pht(todayStr, rint(7, 8), rint(30, 59)),
        clock_out_at: null, recorded_by: smId,
      });
    });
  }

  // Upsert attendance (idempotent on the unique (worker_id, work_date)).
  const { data: att, error: attErr } = await db
    .from('attendance')
    .upsert(attRows, { onConflict: 'worker_id,work_date' })
    .select('id, worker_id, project_id, work_date, status, clock_in_at, clock_out_at, recorded_by, notes, created_at, updated_at');
  if (attErr) throw attErr;

  // Rebuild logs for the seeded dates only (keeps the script idempotent).
  const { error: delErr } = await db
    .from('attendance_logs')
    .delete()
    .in('work_date', [yesterdayStr, todayStr])
    .in('worker_id', allWorkerIds);
  if (delErr) throw delErr;

  const recorderByProject: Record<string, string> = {};
  for (const projName of Object.keys(projects)) recorderByProject[projects[projName]] = users[SM_BY_PROJECT[projName]];

  const logRows = att.map((a) => ({
    attendance_id: a.id,
    worker_id: a.worker_id,
    work_date: a.work_date,
    action: a.status === 'absent' ? 'mark_absent' : a.status === 'clocked_out' ? 'clock_out' : 'clock_in',
    actor_id: recorderByProject[a.project_id] ?? a.recorded_by,
    before_state: null,
    after_state: a,
  }));
  const { error: logErr } = await db.from('attendance_logs').insert(logRows);
  if (logErr) throw logErr;

  return { attendance: att.length, logs: logRows.length };
}

async function main() {
  console.log(`[seed] PHT today=${todayStr} yesterday=${yesterdayStr}`);
  const users = await seedUsers();
  console.log(`[seed] users ready: ${Object.keys(users).length}`);
  const projects = await seedProjects();
  console.log(`[seed] projects ready: ${Object.keys(projects).length}`);
  await seedAssignments(users, projects);
  console.log(`[seed] assignments ready (3 SM + PM on ${PM_PROJECTS.length} projects)`);
  const workers = await seedWorkers(projects);
  const workerCount = Object.values(workers).reduce((n, w) => n + w.length, 0);
  console.log(`[seed] workers ready: ${workerCount}`);
  const att = await seedAttendance(users, projects, workers);

  console.log('\n────────── seed summary ──────────');
  console.log(`users        : ${Object.keys(users).length}`);
  console.log(`projects     : ${Object.keys(projects).length}`);
  console.log(`workers      : ${workerCount}`);
  console.log(`attendance   : ${att.attendance}  (yesterday + today)`);
  console.log(`audit logs   : ${att.logs}`);
  console.log('──────────────────────────────────\n');
}

main().catch((e) => {
  console.error('[seed] FAILED:', e?.message ?? e);
  process.exit(1);
});
