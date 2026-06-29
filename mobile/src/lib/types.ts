// API response shapes (SPEC §7 / sprint-1-verification).

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

export type AttendanceJoined = {
  id: string;
  worker_id: string;
  project_id: string;
  work_date: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_hours: number | null;
  overtime: number | null;
  full_name: string;
  position: string | null;
  project_name: string;
  recorded_by_name: string | null;
};
