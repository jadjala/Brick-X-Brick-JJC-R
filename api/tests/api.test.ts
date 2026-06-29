import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { pool } from '../src/lib/db.js';
import { token, bearer } from './helpers.js';

// Integration tests against the live hosted DB. Deterministic + isolated via
// dedicated temp workers and a fixed yesterday date with in-work-hours times.
let app: Express;
let tSM = '', tAdmin = '', tPM = '';
let BGC = '', KAT = '', KW = '';
let yday = '', today = '', old = '';
let W1 = '', W2 = '', W3 = '';
const SMOKE = `__TEST_${Date.now()}`;

beforeAll(async () => {
  app = createApp();
  [tSM, tAdmin, tPM] = await Promise.all([
    token('princess@bxb.test'),
    token('admin@bxb.test'),
    token('pm@bxb.test'),
  ]);
  const p = await pool.query('select id,name from projects');
  BGC = p.rows.find((r) => r.name === 'BGC Verdana Tower').id;
  KAT = p.rows.find((r) => r.name === 'Katipunan Renovation').id;
  KW = (await pool.query('select id from workers where project_id=$1 limit 1', [KAT])).rows[0].id;
  const d = await pool.query(
    `select to_char((now() at time zone 'Asia/Manila')::date,'YYYY-MM-DD') today,
            to_char((now() at time zone 'Asia/Manila')::date-1,'YYYY-MM-DD') yday,
            to_char((now() at time zone 'Asia/Manila')::date-10,'YYYY-MM-DD') old`,
  );
  ({ today, yday, old } = d.rows[0]);
  const w = await pool.query(
    `insert into workers (project_id, full_name, position) values
       ($1,$2,'Tester'),($1,$3,'Tester'),($1,$4,'Tester') returning id`,
    [BGC, `${SMOKE}_A`, `${SMOKE}_B`, `${SMOKE}_C`],
  );
  [W1, W2, W3] = w.rows.map((r) => r.id);
});

afterAll(async () => {
  const ids = [W1, W2, W3];
  await pool.query('delete from attendance_logs where worker_id = any($1)', [ids]);
  await pool.query('delete from attendance where worker_id = any($1)', [ids]);
  await pool.query('delete from workers where id = any($1)', [ids]);
  await pool.end();
});

const inTs = () => `${yday}T08:00:00+08:00`;
const outTs = () => `${yday}T17:00:00+08:00`;
const isEnvelope = (b: any) => b?.error && typeof b.error.code === 'string' && typeof b.error.message === 'string';

let ciId = '';

describe('Identity (§7.1)', () => {
  it('GET /health open, 200', async () => {
    const r = await request(app).get('/api/v1/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, version: '1.0.0' });
  });
  it('GET /me without token → 401 AUTH_REQUIRED (G1)', async () => {
    const r = await request(app).get('/api/v1/me');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('AUTH_REQUIRED');
  });
  it('GET /me → identity', async () => {
    const r = await request(app).get('/api/v1/me').set(bearer(tSM));
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('site_manager');
  });
  it('GET /me/projects scoped by role', async () => {
    expect((await request(app).get('/api/v1/me/projects').set(bearer(tSM))).body).toHaveLength(1);
    expect((await request(app).get('/api/v1/me/projects').set(bearer(tAdmin))).body).toHaveLength(3);
    expect((await request(app).get('/api/v1/me/projects').set(bearer(tPM))).body).toHaveLength(2);
  });
});

describe('Projects + roster (§7.2)', () => {
  it('GET /projects scoped', async () => {
    expect((await request(app).get('/api/v1/projects').set(bearer(tSM))).body).toHaveLength(1);
    expect((await request(app).get('/api/v1/projects').set(bearer(tAdmin))).body).toHaveLength(3);
  });
  it('GET /projects/:id 200 / 403 / 404', async () => {
    expect((await request(app).get(`/api/v1/projects/${BGC}`).set(bearer(tSM))).status).toBe(200);
    expect((await request(app).get(`/api/v1/projects/${KAT}`).set(bearer(tSM))).status).toBe(403);
    expect((await request(app).get(`/api/v1/projects/00000000-0000-0000-0000-000000000000`).set(bearer(tAdmin))).status).toBe(404);
  });
  it('GET roster 200 for assigned, 403 for unassigned', async () => {
    const r = await request(app).get(`/api/v1/projects/${BGC}/roster?date=${today}`).set(bearer(tSM));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect((await request(app).get(`/api/v1/projects/${KAT}/roster?date=${today}`).set(bearer(tSM))).status).toBe(403);
  });
});

describe('Attendance writes (§7.3) + guards (§10)', () => {
  it('clock-in malformed → 400 (G11)', async () => {
    const r = await request(app).post('/api/v1/attendance/clock-in').set(bearer(tSM)).send({ worker_id: 'x' });
    expect(r.status).toBe(400);
  });
  it('clock-in future time → 422 (G8)', async () => {
    const future = new Date(Date.now() + 10 * 60000).toISOString();
    const r = await request(app).post('/api/v1/attendance/clock-in').set(bearer(tSM)).send({ worker_id: W1, work_date: yday, clock_in_at: future });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('INVALID_INPUT');
  });
  it('AC13 — SM clock-in on unassigned project → 403 (G9)', async () => {
    const r = await request(app).post('/api/v1/attendance/clock-in').set(bearer(tSM)).send({ worker_id: KW, work_date: yday, clock_in_at: inTs() });
    expect(r.status).toBe(403);
    expect(isEnvelope(r.body)).toBe(true);
  });
  it('clock-in happy → 201 clocked_in', async () => {
    const r = await request(app).post('/api/v1/attendance/clock-in').set(bearer(tSM)).send({ worker_id: W1, work_date: yday, clock_in_at: inTs() });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('clocked_in');
    ciId = r.body.id;
  });
  it('AC3 — duplicate clock-in → 409 DUPLICATE (G3)', async () => {
    const r = await request(app).post('/api/v1/attendance/clock-in').set(bearer(tSM)).send({ worker_id: W1, work_date: yday, clock_in_at: inTs() });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('DUPLICATE');
  });
  it('AC5 — clock-out before clock-in → 422 (G5)', async () => {
    const r = await request(app).post('/api/v1/attendance/clock-out').set(bearer(tSM)).send({ worker_id: W1, work_date: yday, clock_out_at: `${yday}T07:00:00+08:00` });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('INVALID_INPUT');
  });
  it('clock-out happy → 200 clocked_out, 9h', async () => {
    const r = await request(app).post('/api/v1/attendance/clock-out').set(bearer(tSM)).send({ worker_id: W1, work_date: yday, clock_out_at: outTs() });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('clocked_out');
    expect(r.body.total_hours).toBe(9);
  });
  it('AC4 — clock-out without clock-in → 409 INVALID_STATE (G4)', async () => {
    const r = await request(app).post('/api/v1/attendance/clock-out').set(bearer(tSM)).send({ worker_id: W2, work_date: yday, clock_out_at: outTs() });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INVALID_STATE');
  });
  it('AC6 — mark-absent on existing → 409 INVALID_STATE (G6)', async () => {
    const r = await request(app).post('/api/v1/attendance/mark-absent').set(bearer(tSM)).send({ worker_id: W1, work_date: yday });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INVALID_STATE');
  });
  it('mark-absent happy on fresh worker → 201 absent', async () => {
    const r = await request(app).post('/api/v1/attendance/mark-absent').set(bearer(tSM)).send({ worker_id: W3, work_date: yday });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('absent');
  });
  it('edit-time SM → 403, admin → 200 (matrix)', async () => {
    expect((await request(app).patch(`/api/v1/attendance/${ciId}/edit-time`).set(bearer(tSM)).send({ clock_in_at: inTs() })).status).toBe(403);
    const r = await request(app).patch(`/api/v1/attendance/${ciId}/edit-time`).set(bearer(tAdmin)).send({ clock_in_at: `${yday}T08:30:00+08:00` });
    expect(r.status).toBe(200);
    expect(r.body.total_hours).toBe(8.5);
  });
});

describe('Attendance reads (§7.4)', () => {
  it('GET /attendance single + range; mixing → 400', async () => {
    expect((await request(app).get(`/api/v1/attendance?date=${yday}&project_id=${BGC}`).set(bearer(tSM))).status).toBe(200);
    expect((await request(app).get(`/api/v1/attendance?from=${yday}&to=${today}&project_id=${BGC}`).set(bearer(tSM))).status).toBe(200);
    expect((await request(app).get(`/api/v1/attendance?date=${yday}&from=${yday}&to=${today}&project_id=${BGC}`).set(bearer(tSM))).status).toBe(400);
  });
  it('GET /attendance/summary shape', async () => {
    const r = await request(app).get(`/api/v1/attendance/summary?date=${yday}&project_id=${BGC}`).set(bearer(tSM));
    expect(r.status).toBe(200);
    for (const k of ['total_workers', 'clocked_in', 'clocked_out', 'absent', 'no_record', 'total_hours', 'total_overtime'])
      expect(r.body).toHaveProperty(k);
  });
  it('GET /attendance/:id joined + /:id/logs newest-first', async () => {
    const one = await request(app).get(`/api/v1/attendance/${ciId}`).set(bearer(tSM));
    expect(one.status).toBe(200);
    expect(one.body.full_name).toContain('__TEST');
    const logs = await request(app).get(`/api/v1/attendance/${ciId}/logs`).set(bearer(tSM));
    expect(logs.status).toBe(200);
    expect(logs.body[0].actor_name).toBeTruthy();
  });
  it('GET /attendance/:id missing → 404', async () => {
    expect((await request(app).get(`/api/v1/attendance/00000000-0000-0000-0000-000000000000`).set(bearer(tSM))).status).toBe(404);
  });
});

describe('Undo window (§7.3 / G7)', () => {
  it('AC7 — undo yesterday → 200, then 404', async () => {
    expect((await request(app).post('/api/v1/attendance/undo').set(bearer(tSM)).send({ attendance_id: ciId })).body.ok).toBe(true);
    expect((await request(app).post('/api/v1/attendance/undo').set(bearer(tSM)).send({ attendance_id: ciId })).status).toBe(404);
  });
  it('AC7 — undo 10-day-old → 422 OUT_OF_WINDOW', async () => {
    const ins = await pool.query(
      `insert into attendance (worker_id,project_id,work_date,status,recorded_by)
       values ($1,$2,$3,'absent',(select id from profiles where role='site_manager' limit 1)) returning id`,
      [W2, BGC, old],
    );
    const r = await request(app).post('/api/v1/attendance/undo').set(bearer(tSM)).send({ attendance_id: ins.rows[0].id });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('OUT_OF_WINDOW');
    await pool.query('delete from attendance where id=$1', [ins.rows[0].id]);
  });
});

describe('Race condition (G3 via UNIQUE)', () => {
  it('two parallel clock-ins → one 201, one 409', async () => {
    // W2 has no row yesterday; use a fixed in-work-hours time (independent of wall clock).
    const body = { worker_id: W2, work_date: yday, clock_in_at: inTs() };
    await pool.query('delete from attendance where worker_id=$1 and work_date=$2', [W2, yday]);
    const send = () => request(app).post('/api/v1/attendance/clock-in').set(bearer(tSM)).send(body);
    const [a, b] = await Promise.all([send(), send()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const codes = [a.body?.status, b.body?.error?.code];
    expect(codes).toContain('clocked_in');
    expect(codes).toContain('DUPLICATE');
    await pool.query('delete from attendance_logs where worker_id=$1 and work_date=$2', [W2, yday]);
    await pool.query('delete from attendance where worker_id=$1 and work_date=$2', [W2, yday]);
  });
});
