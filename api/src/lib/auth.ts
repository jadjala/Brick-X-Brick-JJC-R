import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env } from './env.js';
import { query } from './db.js';
import { AppError } from './errors.js';

export type Role = 'admin' | 'general_manager' | 'project_manager' | 'site_manager';
export type AuthUser = { id: string; full_name: string; role: Role };

// This project signs JWTs with ES256 (asymmetric). We verify against the
// project JWKS (fetched once and cached in-process by jose) — local, no
// per-request call to the Auth server. SUPABASE_JWT_SECRET (legacy HS256) is
// not used here; kept in env only as a fallback hook. See sprint-1 verification.
const issuer = `${env.SUPABASE_URL}/auth/v1`;
const JWKS = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, JWKS, { issuer });
  return payload;
}

// Profile cache: sub -> { user, expires }. The JWT carries the Postgres role
// claim ("authenticated"), NOT our app role — so we read role from profiles
// (CLAUDE.md gotcha #4). Cache 30s to avoid a DB hit on every request.
const TTL_MS = 30_000;
const cache = new Map<string, { user: AuthUser; expires: number }>();

async function loadProfile(sub: string): Promise<AuthUser | null> {
  const hit = cache.get(sub);
  if (hit && hit.expires > Date.now()) return hit.user;

  const { rows } = await query<{ id: string; full_name: string; role: Role }>(
    'select id, full_name, role from profiles where id = $1',
    [sub],
  );
  if (rows.length === 0) return null;
  const user: AuthUser = { id: rows[0].id, full_name: rows[0].full_name, role: rows[0].role };
  cache.set(sub, { user, expires: Date.now() + TTL_MS });
  return user;
}

/** Extract a bearer token from the Authorization header. */
export function bearerFrom(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value.trim() : null;
}

/**
 * Verify a bearer token and resolve the acting user. Throws AppError
 * (AUTH_REQUIRED) on any failure, with distinct messages per case.
 */
export async function authenticate(authHeader: string | undefined): Promise<AuthUser> {
  const token = bearerFrom(authHeader);
  if (!token) throw new AppError('AUTH_REQUIRED', 'Authentication required.');

  let sub: string | undefined;
  try {
    ({ sub } = await verifyToken(token));
  } catch {
    throw new AppError('AUTH_REQUIRED', 'Invalid or expired token.');
  }
  if (!sub) throw new AppError('AUTH_REQUIRED', 'Invalid or expired token.');

  const user = await loadProfile(sub);
  if (!user) throw new AppError('AUTH_REQUIRED', 'Profile not provisioned.');
  return user;
}

/** Test/maintenance hook. */
export const clearProfileCache = (): void => cache.clear();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
