import { todayPhtDate } from './format.js';
import type { RowStatus, Role } from './types.js';

// Unified table row — single-date mode maps from RosterRow, range mode from
// AttendanceJoined.
export type DashRow = {
  key: string;
  worker_id: string;
  full_name: string;
  position: string | null;
  project_name: string;
  work_date: string;
  status: RowStatus;
  attendance_id: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_hours: number | null;
  overtime: number | null;
  recorded_by_name: string | null;
};

const WEB_ROLES: Role[] = ['admin', 'general_manager', 'project_manager'];
export const isWebRole = (role: Role) => WEB_ROLES.includes(role);

const ymdNum = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** today or yesterday in PHT (correction window, §0.4). */
export function inCorrectionWindow(workDate: string): boolean {
  const age = ymdNum(todayPhtDate()) - ymdNum(workDate);
  return age === 0 || age === 1;
}

// Row-action availability = §1 role matrix × current status × correction window.
export const canView = (r: DashRow) => r.attendance_id !== null;
export const canProxyIn = (r: DashRow, role: Role) => r.status === 'no_record' && isWebRole(role);
export const canProxyOut = (r: DashRow, role: Role) => r.status === 'clocked_in' && isWebRole(role);
export const canMarkAbsent = (r: DashRow) => r.status === 'no_record';
export const canUndo = (r: DashRow) => r.status !== 'no_record' && inCorrectionWindow(r.work_date);
export const hasAnyAction = (r: DashRow, role: Role) =>
  canView(r) || canProxyIn(r, role) || canProxyOut(r, role) || canMarkAbsent(r) || canUndo(r);
