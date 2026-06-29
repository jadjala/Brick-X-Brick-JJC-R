import { createClient } from '@supabase/supabase-js';
import { env } from '../src/lib/env.js';

// Sign in a seeded user and return its access token (ES256 JWT). Used by the
// integration tests to exercise the real auth path.
export async function token(email: string): Promise<string> {
  const c = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'password' });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return data.session.access_token;
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
