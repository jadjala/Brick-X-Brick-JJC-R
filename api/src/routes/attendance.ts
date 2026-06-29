import { Router } from 'express';
import { asyncHandler, AppError } from '../lib/errors.js';
import { query, withTransaction, type Sql } from '../lib/db.js';
import { assertProjectAccess, getWorkerProject } from '../lib/access.js';
import { requireRole } from '../middleware/require-role.js';
import { requireAssignment } from '../middleware/require-assignment.js';
import { presentAttendance, presentAttendanceJoined } from '../lib/presenters.js';
import { calculateHours, calculateOvertime } from '../lib/hours.js';
import {
  isFuture,
  isWithinWorkHours,
  isWorkDateAllowed,
  isInCorrectionWindow,
  phtDate,
  phtHour,
  addDaysToYmd,
} from '../lib/time.js';
import type { AuthUser } from '../lib/auth.js';
import {
  clockInBody,
  clockOutBody,
  markAbsentBody,
  undoBody,
  editTimeBody,
  attendanceListQuery,
  summaryQuery,
} from '../schemas/attendance.js';

export const attendanceRouter = Router();

const WEB_ROLES = ['admin', 'general_manager', 'project_manager'] as const;

// ── shared helpers ──────────────────────────────────────────────────────────

/** clock_in/out vs proxy_clock_in/out depending on actor (SPEC §6). */
const actionFor = (role: AuthUser['role'], base: 'clock_in' | 'clock_out'): string =>
  role === 'site_manager' ? base : `proxy_${base}`;

/** Insert the audit row inside the same transaction (SPEC §6). */
async function insertLog(
  client: Sql,
  l: {
    attendance_id: string | null;
    worker_id: string;
    work_date: string;
    action: string;
    actor_id: string;
    before_state: unknown;
    after_state: unknown;
  },
): Promise<void> {
  await client.query(
    `insert into attendance_logs
       (attendance_id, worker_id, work_date, action, actor_id, before_state, after_state)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
    [
      l.attendance_id,
      l.worker_id,
      l.work_date,
      l.action,
      l.actor_id,
      l.before_state ? JSON.stringify(l.before_state) : null,
      l.after_state ? JSON.stringify(l.after_state) : null,
    ],
  );
}

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';

/** G8 (future) + G12 (work hours) for a single clock timestamp. */
function assertClockTime(ts: Date, field: string): void {
  if (isFuture(ts)) {
    throw new AppError('INVALID_INPUT', `${field} cannot be in the future.`, { field }, 422);
  }
  if (!isWithinWorkHours(ts)) {
    throw new AppError('INVALID_INPUT', `${field} must be between 05:00 and 23:00 PHT.`, { field }, 422);
  }
}

/** G10 — work_date within the last 90 days and not in the future. */
function assertWorkDate(workDate: string): void {
  if (!isWorkDateAllowed(workDate)) {
    throw new AppError('INVALID_INPUT', 'work_date must be within the last 90 days.', { work_date: workDate }, 422);
  }
}

/** Resolve worker -> project, enforce existence (404) + assignment (403, G9). */
async function resolveWorkerForWrite(user: AuthUser, workerId: string): Promise<string> {
  const worker = await getWorkerProject(workerId);
  if (!worker || !worker.is_active) throw new AppError('NOT_FOUND', 'Worker not found.');
  await assertProjectAccess(user, worker.project_id);
  return worker.project_id;
}

// ── E1. POST /attendance/clock-in ────────────────────────────────────────────
attendanceRouter.post(
  '/clock-in',
  asyncHandler(async (req, res) => {
    const body = clockInBody.parse(req.body);
    const user = req.user!;
    const projectId = await resolveWorkerForWrite(user, body.worker_id);

    assertWorkDate(body.work_date); // G10
    const clockIn = new Date(body.clock_in_at);
    assertClockTime(clockIn, 'clock_in_at'); // G8 + G12
    if (phtDate(clockIn) !== body.work_date) {
      throw new AppError('INVALID_INPUT', 'clock_in_at must fall on work_date (PHT).', undefined, 422);
    }

    const row = await withTransaction(async (client) => {
      let inserted;
      try {
        const r = await client.query(
          `insert into attendance (worker_id, project_id, work_date, status, clock_in_at, recorded_by)
           values ($1,$2,$3,'clocked_in',$4,$5) returning *`,
          [body.worker_id, projectId, body.work_date, clockIn.toISOString(), user.id],
        );
        inserted = r.rows[0];
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new AppError('DUPLICATE', 'An attendance record already exists for this worker on this date.', {
            worker_id: body.worker_id,
            work_date: body.work_date,
          });
        }
        throw err;
      }
      await insertLog(client, {
        attendance_id: inserted.id,
        worker_id: inserted.worker_id,
        work_date: inserted.work_date,
        action: actionFor(user.role, 'clock_in'),
        actor_id: user.id,
        before_state: null,
        after_state: inserted,
      });
      return inserted;
    });

    res.status(201).json(presentAttendance(row));
  }),
);

// ── E2. POST /attendance/clock-out ───────────────────────────────────────────
attendanceRouter.post(
  '/clock-out',
  asyncHandler(async (req, res) => {
    const body = clockOutBody.parse(req.body);
    const user = req.user!;
    await resolveWorkerForWrite(user, body.worker_id);

    const existing = await query<{
      id: string;
      status: string;
      clock_in_at: Date | null;
      work_date: string;
    }>('select * from attendance where worker_id = $1 and work_date = $2', [body.worker_id, body.work_date]);
    if (existing.rows.length === 0) {
      throw new AppError('INVALID_STATE', 'No clock-in exists for this worker on this date.'); // G4
    }
    const prior = existing.rows[0];
    if (prior.status !== 'clocked_in') {
      throw new AppError('INVALID_STATE', `Cannot clock out from status "${prior.status}".`);
    }

    const clockOut = new Date(body.clock_out_at);
    if (isFuture(clockOut)) {
      throw new AppError('INVALID_INPUT', 'clock_out_at cannot be in the future.', undefined, 422); // G8
    }
    if (prior.clock_in_at && clockOut.getTime() <= prior.clock_in_at.getTime()) {
      throw new AppError('INVALID_INPUT', 'clock_out_at must be after clock_in_at.', undefined, 422); // G5
    }
    // G12 + cross-midnight grace (§3): same PHT day must be within work hours;
    // a next-day clock-out is only allowed up to 04:00 PHT (≤ midnight + 4h).
    const outDay = phtDate(clockOut);
    if (outDay === body.work_date) {
      if (!isWithinWorkHours(clockOut)) {
        throw new AppError('INVALID_INPUT', 'clock_out_at must be between 05:00 and 23:00 PHT.', undefined, 422);
      }
    } else if (outDay === addDaysToYmd(body.work_date, 1) && phtHour(clockOut) <= 4) {
      // within cross-midnight grace — accept
    } else {
      throw new AppError('INVALID_INPUT', 'clock_out_at is outside the allowed shift window.', undefined, 422);
    }

    const row = await withTransaction(async (client) => {
      const r = await client.query(
        `update attendance set status = 'clocked_out', clock_out_at = $1
           where id = $2 returning *`,
        [clockOut.toISOString(), prior.id],
      );
      const updated = r.rows[0];
      await insertLog(client, {
        attendance_id: updated.id,
        worker_id: updated.worker_id,
        work_date: updated.work_date,
        action: actionFor(user.role, 'clock_out'),
        actor_id: user.id,
        before_state: prior,
        after_state: updated,
      });
      return updated;
    });

    res.json(presentAttendance(row));
  }),
);

// ── E3. POST /attendance/mark-absent ─────────────────────────────────────────
attendanceRouter.post(
  '/mark-absent',
  asyncHandler(async (req, res) => {
    const body = markAbsentBody.parse(req.body);
    const user = req.user!;
    const projectId = await resolveWorkerForWrite(user, body.worker_id);
    assertWorkDate(body.work_date); // G10

    const row = await withTransaction(async (client) => {
      let inserted;
      try {
        const r = await client.query(
          `insert into attendance (worker_id, project_id, work_date, status, recorded_by)
           values ($1,$2,$3,'absent',$4) returning *`,
          [body.worker_id, projectId, body.work_date, user.id],
        );
        inserted = r.rows[0];
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new AppError('INVALID_STATE', 'An attendance record already exists for this worker on this date.', {
            worker_id: body.worker_id,
            work_date: body.work_date,
          }); // G6
        }
        throw err;
      }
      await insertLog(client, {
        attendance_id: inserted.id,
        worker_id: inserted.worker_id,
        work_date: inserted.work_date,
        action: 'mark_absent',
        actor_id: user.id,
        before_state: null,
        after_state: inserted,
      });
      return inserted;
    });

    res.status(201).json(presentAttendance(row));
  }),
);

// ── E4. POST /attendance/undo ────────────────────────────────────────────────
attendanceRouter.post(
  '/undo',
  asyncHandler(async (req, res) => {
    const body = undoBody.parse(req.body);
    const user = req.user!;

    const found = await query<{ id: string; project_id: string; work_date: string; worker_id: string }>(
      'select * from attendance where id = $1',
      [body.attendance_id],
    );
    if (found.rows.length === 0) throw new AppError('NOT_FOUND', 'Attendance record not found.');
    const prior = found.rows[0];

    await assertProjectAccess(user, prior.project_id); // 403
    if (!isInCorrectionWindow(prior.work_date)) {
      throw new AppError('OUT_OF_WINDOW', 'Undo is only allowed for today or yesterday.', {
        work_date: prior.work_date,
      }); // G7
    }

    await withTransaction(async (client) => {
      // Log first (attendance_id still valid), then delete. The FK is
      // ON DELETE SET NULL, so the delete nulls the log's attendance_id (SPEC §6).
      await insertLog(client, {
        attendance_id: prior.id,
        worker_id: prior.worker_id,
        work_date: prior.work_date,
        action: 'undo',
        actor_id: user.id,
        before_state: prior,
        after_state: null,
      });
      await client.query('delete from attendance where id = $1', [prior.id]);
    });

    res.json({ ok: true });
  }),
);

// ── E5. PATCH /attendance/:id/edit-time (web roles only) ─────────────────────
attendanceRouter.patch(
  '/:id/edit-time',
  requireRole(...WEB_ROLES), // SM excluded (matrix)
  asyncHandler(async (req, res) => {
    const body = editTimeBody.parse(req.body);
    const user = req.user!;

    const found = await query('select * from attendance where id = $1', [req.params.id]);
    if (found.rows.length === 0) throw new AppError('NOT_FOUND', 'Attendance record not found.');
    const prior = found.rows[0] as {
      id: string;
      project_id: string;
      worker_id: string;
      work_date: string;
      clock_in_at: Date | null;
      clock_out_at: Date | null;
    };
    await assertProjectAccess(user, prior.project_id); // PM must be assigned; admin/GM pass

    const newIn = body.clock_in_at ? new Date(body.clock_in_at) : prior.clock_in_at;
    const newOut = body.clock_out_at ? new Date(body.clock_out_at) : prior.clock_out_at;
    if (body.clock_in_at) assertClockTime(newIn!, 'clock_in_at'); // G8 + G12
    if (body.clock_out_at) assertClockTime(newOut!, 'clock_out_at');
    if (newIn && newOut && newOut.getTime() <= newIn.getTime()) {
      throw new AppError('INVALID_INPUT', 'clock_out_at must be after clock_in_at.', undefined, 422); // G5
    }

    const row = await withTransaction(async (client) => {
      const r = await client.query(
        `update attendance set clock_in_at = $1, clock_out_at = $2 where id = $3 returning *`,
        [newIn ? newIn.toISOString() : null, newOut ? newOut.toISOString() : null, prior.id],
      );
      const updated = r.rows[0];
      await insertLog(client, {
        attendance_id: updated.id,
        worker_id: updated.worker_id,
        work_date: updated.work_date,
        action: 'edit_time',
        actor_id: user.id,
        before_state: prior,
        after_state: updated,
      });
      return updated;
    });

    res.json(presentAttendance(row));
  }),
);

// ── F1/F2. GET /attendance?date|from&to&project_id ───────────────────────────
attendanceRouter.get(
  '/',
  requireAssignment({ projectIdFrom: 'query', param: 'project_id' }),
  asyncHandler(async (req, res) => {
    const q = attendanceListQuery.parse(req.query);
    const where = q.date
      ? { clause: 'a.work_date = $2', params: [q.date] }
      : { clause: 'a.work_date between $2 and $3', params: [q.from, q.to] };

    const { rows } = await query(
      `select a.*, w.full_name as worker_name, w.position,
              pr.name as project_name, pr.standard_hours,
              rp.full_name as recorded_by_name
         from attendance a
         join workers w on w.id = a.worker_id
         join projects pr on pr.id = a.project_id
         left join profiles rp on rp.id = a.recorded_by
        where a.project_id = $1 and ${where.clause}
        order by pr.name, w.full_name, a.work_date`,
      [q.project_id, ...where.params],
    );
    res.json(rows.map((r) => presentAttendanceJoined(r as never)));
  }),
);

// ── F3. GET /attendance/summary?date&project_id ──────────────────────────────
attendanceRouter.get(
  '/summary',
  requireAssignment({ projectIdFrom: 'query', param: 'project_id' }),
  asyncHandler(async (req, res) => {
    const q = summaryQuery.parse(req.query);

    const proj = await query('select standard_hours from projects where id = $1', [q.project_id]);
    if (proj.rows.length === 0) throw new AppError('NOT_FOUND', 'Project not found.');
    const std = Number(proj.rows[0].standard_hours);

    const workers = await query<{ n: number }>(
      'select count(*)::int as n from workers where project_id = $1 and is_active = true',
      [q.project_id],
    );
    const totalWorkers = workers.rows[0].n;

    const att = await query<{
      status: 'clocked_in' | 'clocked_out' | 'absent';
      clock_in_at: Date | null;
      clock_out_at: Date | null;
    }>('select status, clock_in_at, clock_out_at from attendance where project_id = $1 and work_date = $2', [
      q.project_id,
      q.date,
    ]);

    let clocked_in = 0,
      clocked_out = 0,
      absent = 0,
      total_hours = 0,
      total_overtime = 0;
    for (const r of att.rows) {
      if (r.status === 'clocked_in') clocked_in++;
      else if (r.status === 'clocked_out') clocked_out++;
      else if (r.status === 'absent') absent++;
      const h = calculateHours(r.clock_in_at, r.clock_out_at);
      if (h !== null) {
        total_hours += h;
        total_overtime += calculateOvertime(h, std) ?? 0;
      }
    }
    const no_record = Math.max(0, totalWorkers - att.rows.length);

    res.json({
      total_workers: totalWorkers,
      clocked_in,
      clocked_out,
      absent,
      no_record,
      total_hours: Math.round(total_hours * 100) / 100,
      total_overtime: Math.round(total_overtime * 100) / 100,
    });
  }),
);

// ── F4. GET /attendance/:id ──────────────────────────────────────────────────
attendanceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select a.*, w.full_name as worker_name, w.position,
              pr.name as project_name, pr.standard_hours,
              rp.full_name as recorded_by_name
         from attendance a
         join workers w on w.id = a.worker_id
         join projects pr on pr.id = a.project_id
         left join profiles rp on rp.id = a.recorded_by
        where a.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Attendance record not found.');
    await assertProjectAccess(req.user!, (rows[0] as { project_id: string }).project_id);
    res.json(presentAttendanceJoined(rows[0] as never));
  }),
);

// ── F5. GET /attendance/:id/logs ─────────────────────────────────────────────
attendanceRouter.get(
  '/:id/logs',
  asyncHandler(async (req, res) => {
    const att = await query('select project_id from attendance where id = $1', [req.params.id]);
    if (att.rows.length === 0) throw new AppError('NOT_FOUND', 'Attendance record not found.');
    await assertProjectAccess(req.user!, (att.rows[0] as { project_id: string }).project_id);

    const { rows } = await query(
      `select l.*, p.full_name as actor_name, p.role as actor_role
         from attendance_logs l
         join profiles p on p.id = l.actor_id
        where l.attendance_id = $1
        order by l.created_at desc`,
      [req.params.id],
    );
    res.json(rows);
  }),
);
