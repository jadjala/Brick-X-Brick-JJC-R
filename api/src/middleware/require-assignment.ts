import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { assertProjectAccess } from '../lib/access.js';

type Source = 'params' | 'body' | 'query';

/**
 * G2/G9: gate a route by project assignment. admin/GM pass through; PM/SM must
 * have an active assignment on the referenced project. Reads the project id from
 * params/body/query under `param`.
 */
export function requireAssignment(opts: { projectIdFrom: Source; param: string }) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError('AUTH_REQUIRED', 'Authentication required.');
      const bag = req[opts.projectIdFrom] as Record<string, unknown>;
      const projectId = bag?.[opts.param];
      if (typeof projectId !== 'string' || projectId.length === 0) {
        throw new AppError('INVALID_INPUT', `Missing project id (${opts.param}).`);
      }
      await assertProjectAccess(req.user, projectId);
      next();
    } catch (err) {
      next(err);
    }
  };
}
