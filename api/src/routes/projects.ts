import { Router } from 'express';
import { asyncHandler, AppError } from '../lib/errors.js';
import { query } from '../lib/db.js';
import { isGlobalRole, assertProjectAccess } from '../lib/access.js';
import { presentProject } from '../lib/presenters.js';
import { requireAssignment } from '../middleware/require-assignment.js';
import { rosterQuery } from '../schemas/attendance.js';
import { calculateHours, calculateOvertime } from '../lib/hours.js';
import { toPhtIso } from '../lib/time.js';

export const projectsRouter = Router();

// GET /projects — scoped per §1 matrix.
projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const u = req.user!;
    const { rows } = isGlobalRole(u.role)
      ? await query('select * from projects order by name')
      : await query(
          `select p.* from projects p
             join project_assignments pa on pa.project_id = p.id
            where pa.user_id = $1 and pa.is_active = true
            order by p.name`,
          [u.id],
        );
    res.json(rows.map(presentProject));
  }),
);

// GET /projects/:id — single project (404 if missing, 403 if not visible).
projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('select * from projects where id = $1', [req.params.id]);
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Project not found.');
    await assertProjectAccess(req.user!, req.params.id);
    res.json(presentProject(rows[0]));
  }),
);

// GET /projects/:id/roster?date=YYYY-MM-DD — one row per active worker, left-
// joined to that day's attendance. Single query (no N+1).
projectsRouter.get(
  '/:id/roster',
  requireAssignment({ projectIdFrom: 'params', param: 'id' }),
  asyncHandler(async (req, res) => {
    const { date } = rosterQuery.parse(req.query);

    const exists = await query('select standard_hours from projects where id = $1', [req.params.id]);
    if (exists.rows.length === 0) throw new AppError('NOT_FOUND', 'Project not found.');
    const standardHours = Number(exists.rows[0].standard_hours);

    const { rows } = await query<{
      worker_id: string;
      full_name: string;
      position: string | null;
      attendance_id: string | null;
      status: 'clocked_in' | 'clocked_out' | 'absent' | null;
      clock_in_at: Date | null;
      clock_out_at: Date | null;
      recorded_by_name: string | null;
    }>(
      `select w.id as worker_id, w.full_name, w.position,
              a.id as attendance_id, a.status, a.clock_in_at, a.clock_out_at,
              rp.full_name as recorded_by_name
         from workers w
         left join attendance a on a.worker_id = w.id and a.work_date = $2
         left join profiles rp on rp.id = a.recorded_by
        where w.project_id = $1 and w.is_active = true
        order by w.full_name asc`,
      [req.params.id, date],
    );

    res.json(
      rows.map((r) => {
        const total = calculateHours(r.clock_in_at, r.clock_out_at);
        return {
          worker_id: r.worker_id,
          full_name: r.full_name,
          position: r.position,
          status: r.attendance_id ? r.status : 'no_record',
          attendance_id: r.attendance_id,
          clock_in_at: toPhtIso(r.clock_in_at),
          clock_out_at: toPhtIso(r.clock_out_at),
          total_hours: total,
          overtime: calculateOvertime(total, standardHours),
          recorded_by_name: r.recorded_by_name,
        };
      }),
    );
  }),
);
