import { z } from 'zod';

// YYYY-MM-DD calendar date (work_date is a Postgres `date`).
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid calendar date');

// ISO timestamptz with explicit offset, e.g. 2026-06-28T08:02:14+08:00.
export const isoTimestamp = z.string().datetime({ offset: true });

const uuid = z.string().uuid();

export const clockInBody = z
  .object({ worker_id: uuid, work_date: isoDate, clock_in_at: isoTimestamp })
  .strict();

export const clockOutBody = z
  .object({ worker_id: uuid, work_date: isoDate, clock_out_at: isoTimestamp })
  .strict();

export const markAbsentBody = z.object({ worker_id: uuid, work_date: isoDate }).strict();

export const undoBody = z.object({ attendance_id: uuid }).strict();

export const editTimeBody = z
  .object({ clock_in_at: isoTimestamp.optional(), clock_out_at: isoTimestamp.optional() })
  .strict()
  .refine((b) => b.clock_in_at !== undefined || b.clock_out_at !== undefined, {
    message: 'Provide clock_in_at and/or clock_out_at.',
  });

export const rosterQuery = z.object({ date: isoDate }).strict();

// Single-day vs range list. Exactly one mode; reject mixing date with from/to.
export const attendanceListQuery = z
  .object({
    project_id: uuid,
    date: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .strict()
  .refine((q) => (q.date ? !q.from && !q.to : !!q.from && !!q.to), {
    message: 'Provide either `date`, or both `from` and `to` (not both modes).',
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '`from` must be <= `to`.' });

export const summaryQuery = z.object({ project_id: uuid, date: isoDate }).strict();

export type ClockInBody = z.infer<typeof clockInBody>;
export type ClockOutBody = z.infer<typeof clockOutBody>;
export type MarkAbsentBody = z.infer<typeof markAbsentBody>;
export type EditTimeBody = z.infer<typeof editTimeBody>;
