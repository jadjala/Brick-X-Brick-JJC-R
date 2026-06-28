import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

// Required server config. We fail fast with a clear message rather than falling
// back to hardcoded defaults for secrets (CLAUDE.md "Environment variables").
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TZ: z.string().default('Asia/Manila'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n[env] Invalid or missing environment variables:\n${missing}\n\nCopy api/env.example to api/.env and fill it in.\n`);
  process.exit(1);
}

export const env = parsed.data;
