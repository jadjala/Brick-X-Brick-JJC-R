import { toPhtIso } from './time.js';
import { calculateHours, calculateOvertime } from './hours.js';

// Shapes returned to clients. Timestamps are emitted in PHT (+08:00) per §7.2.

export function presentProject(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    standard_hours: Number(r.standard_hours),
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status,
    created_at: r.created_at,
  };
}

type AttRow = {
  id: string;
  worker_id: string;
  project_id: string;
  work_date: string;
  status: 'clocked_in' | 'clocked_out' | 'absent';
  clock_in_at: Date | null;
  clock_out_at: Date | null;
  recorded_by: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

/** A bare attendance row (write endpoints return this). */
export function presentAttendance(r: AttRow, standardHours?: number) {
  const total = calculateHours(r.clock_in_at, r.clock_out_at);
  return {
    id: r.id,
    worker_id: r.worker_id,
    project_id: r.project_id,
    work_date: r.work_date,
    status: r.status,
    clock_in_at: toPhtIso(r.clock_in_at),
    clock_out_at: toPhtIso(r.clock_out_at),
    recorded_by: r.recorded_by,
    notes: r.notes,
    total_hours: total,
    overtime: standardHours === undefined ? null : calculateOvertime(total, standardHours),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** Attendance joined with worker + project + recorder (read endpoints). */
export function presentAttendanceJoined(
  r: AttRow & {
    worker_name: string;
    position: string | null;
    project_name: string;
    standard_hours: string | number;
    recorded_by_name: string | null;
  },
) {
  const std = Number(r.standard_hours);
  return {
    ...presentAttendance(r, std),
    full_name: r.worker_name,
    position: r.position,
    project_name: r.project_name,
    recorded_by_name: r.recorded_by_name,
  };
}
