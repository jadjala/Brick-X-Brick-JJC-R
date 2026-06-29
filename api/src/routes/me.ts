import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { query } from '../lib/db.js';
import { isGlobalRole } from '../lib/access.js';
import { presentProject } from '../lib/presenters.js';

export const meRouter = Router();

// GET /me — identity from req.user (auth middleware already loaded the profile).
meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const u = req.user!;
    res.json({ id: u.id, full_name: u.full_name, role: u.role });
  }),
);

// GET /me/projects — projects the user can act on.
meRouter.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const u = req.user!;
    const { rows } = isGlobalRole(u.role)
      ? await query(`select * from projects where status = 'active' order by name`)
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
