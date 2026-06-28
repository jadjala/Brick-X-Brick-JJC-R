import express from 'express';
import cors from 'cors';
import { env } from './lib/env.js';
import { asyncHandler, errorHandler, notFoundHandler } from './lib/errors.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health is the only unauthenticated endpoint (SPEC §0.7 / §7.1). Business
// endpoints + auth middleware arrive in Sprint 1.
const router = express.Router();
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, version: '1.0.0' });
  }),
);

app.use('/api/v1', router);

// 404 + error envelope (SPEC §11). Registered last.
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}/api/v1  (TZ=${env.TZ})`);
});
