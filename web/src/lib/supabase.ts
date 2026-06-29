import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Fail loud rather than silently using a broken client (CLAUDE.md env rule).
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy env.example to .env');
}

// Default options persist the session to localStorage and auto-refresh the JWT.
export const supabase = createClient(url, anon);
