import { query } from './db.js';
import { AppError } from './errors.js';
import type { AuthUser } from './auth.js';

const GLOBAL_ROLES = ['admin', 'general_manager'] as const;
export const isGlobalRole = (role: AuthUser['role']): boolean =>
  (GLOBAL_ROLES as readonly string[]).includes(role);

/** True iff the user has an active assignment (SM or PM) on the project. */
export async function isAssignedTo(userId: string, projectId: string): Promise<boolean> {
  const { rows } = await query(
    `select 1 from project_assignments
       where user_id = $1 and project_id = $2 and is_active = true limit 1`,
    [userId, projectId],
  );
  return rows.length > 0;
}

/**
 * G2/G9 (assignment half) — the PRIMARY authorization gate (service-role
 * bypasses RLS). admin/GM pass; PM/SM must hold an active assignment. Throws
 * FORBIDDEN otherwise. RLS is the backstop for direct client access.
 */
export async function assertProjectAccess(user: AuthUser, projectId: string): Promise<void> {
  if (isGlobalRole(user.role)) return;
  if (await isAssignedTo(user.id, projectId)) return;
  throw new AppError('FORBIDDEN', 'You are not assigned to this project.');
}

/** Resolve a worker to its project, or null if the worker does not exist. */
export async function getWorkerProject(
  workerId: string,
): Promise<{ project_id: string; is_active: boolean } | null> {
  const { rows } = await query<{ project_id: string; is_active: boolean }>(
    'select project_id, is_active from workers where id = $1',
    [workerId],
  );
  return rows[0] ?? null;
}
