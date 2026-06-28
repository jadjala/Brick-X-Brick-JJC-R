import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client. BYPASSES RLS — server-side only, never exposed to clients
// (CLAUDE.md "Common gotchas" #4). RLS remains the backstop for direct client
// access. Endpoints arrive in Sprint 1; this client is wired up now.
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
