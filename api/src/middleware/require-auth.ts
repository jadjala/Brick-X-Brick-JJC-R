import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../lib/auth.js';

// G1: every route except /health requires a valid JWT. Attaches req.user.
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.user = await authenticate(req.header('authorization'));
    next();
  } catch (err) {
    next(err);
  }
}
