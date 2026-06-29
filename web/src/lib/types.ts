// Mirrors the API response shapes (SPEC §7 / sprint-1-verification).

export type Role = 'admin' | 'general_manager' | 'project_manager' | 'site_manager';
export type AttendanceStatus = 'clocked_in' | 'clocked_out' | 'absent';
export type RowStatus = AttendanceStatus | 'no_record';

export type Profile = { id: string; full_name: string; role: Role };

export type Project = {
  id: string;
  name: string;
  location: string | null;
  standard_hours: number;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
};

// GET /projects/:id/roster — one row per active worker, status may be no_record.
export type RosterRow = {
  worker_id: string;
  full_name: string;
  position: string | null;
  status: RowStatus;
  attendance_id: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_hours: number | null;
  overtime: number | null;
  recorded_by_name: string | null;
};

// GET /attendance(/:id) — attendance row joined with worker + project.
export type AttendanceJoined = {
  id: string;
  worker_id: string;
  project_id: string;
  work_date: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  recorded_by: string;
  notes: string | null;
  total_hours: number | null;
  overtime: number | null;
  created_at: string;
  updated_at: string;
  full_name: string;
  position: string | null;
  project_name: string;
  recorded_by_name: string | null;
};

export type AttendanceSummary = {
  total_workers: number;
  clocked_in: number;
  clocked_out: number;
  absent: number;
  no_record: number;
  total_hours: number;
  total_overtime: number;
};

export type AttendanceLog = {
  id: string;
  attendance_id: string | null;
  worker_id: string;
  work_date: string;
  action:
    | 'clock_in'
    | 'clock_out'
    | 'mark_absent'
    | 'undo'
    | 'proxy_clock_in'
    | 'proxy_clock_out'
    | 'edit_time';
  actor_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
  actor_name: string;
  actor_role: Role;
};
