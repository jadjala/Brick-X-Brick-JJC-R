import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import type { Role } from '../lib/auth.js';

// G2 (role half): 403 unless req.user.role is in the allowed set.
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError('AUTH_REQUIRED', 'Authentication required.'));
    if (!allowed.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'Your role is not permitted to perform this action.'));
    }
    next();
  };
}
