import express, { Router } from 'express';
import cors from 'cors';
import { asyncHandler, errorHandler, notFoundHandler } from './lib/errors.js';
import { requireAuth } from './middleware/require-auth.js';
import { meRouter } from './routes/me.js';
import { projectsRouter } from './routes/projects.js';
import { attendanceRouter } from './routes/attendance.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const api = Router();

  // Only unauthenticated endpoint (SPEC §0.7 / §7.1).
  api.get(
    '/health',
    asyncHandler(async (_req, res) => {
      res.json({ ok: true, version: '1.0.0' });
    }),
  );

  // G1: everything below requires a valid JWT.
  api.use(requireAuth);
  api.use('/me', meRouter);
  api.use('/projects', projectsRouter);
  api.use('/attendance', attendanceRouter);

  app.use('/api/v1', api);

  // 404 + §11 error envelope. Must be last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
