import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { notify } from '@/components/ui/toaster';
import { todayPhtDate } from '@/lib/format';
import type { Project, RosterRow, AttendanceJoined, AttendanceSummary } from '@/lib/types';
import type { DashRow } from '@/lib/dash';
import { Header } from '@/components/Header';
import { FilterStrip, type Filters } from '@/components/FilterStrip';
import { SummaryCards } from '@/components/SummaryCards';
import { AttendanceTable } from '@/components/AttendanceTable';
import type { RowAction } from '@/components/RowActions';
import { TimePickerDialog } from '@/components/TimePickerDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingScreen } from '@/components/brutalist';

type DialogState = { kind: RowAction; row: DashRow } | null;

export function AttendanceDashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const today = todayPhtDate();
  const [filters, setFilters] = useState<Filters>({
    mode: 'single',
    date: today,
    from: today,
    to: today,
    projectId: '',
    statuses: ['clocked_in', 'clocked_out', 'absent', 'no_record'],
  });
  const [dialog, setDialog] = useState<DialogState>(null);

  const projectsQ = useApi(() => api.get<Project[]>('/me/projects'), []);

  // Default to the first project once the list loads.
  useEffect(() => {
    if (!filters.projectId && projectsQ.data && projectsQ.data.length > 0) {
      setFilters((f) => ({ ...f, projectId: projectsQ.data![0].id }));
    }
  }, [projectsQ.data, filters.projectId]);

  const { mode, date, from, to, projectId } = filters;
  const ready = Boolean(projectId);

  const rosterQ = useApi(
    () =>
      mode === 'single' && ready
        ? api.get<RosterRow[]>(`/projects/${projectId}/roster?date=${date}`)
        : Promise.resolve<RosterRow[]>([]),
    [mode, projectId, date],
  );
  const listQ = useApi(
    () =>
      mode === 'range' && ready
        ? api.get<AttendanceJoined[]>(`/attendance?from=${from}&to=${to}&project_id=${projectId}`)
        : Promise.resolve<AttendanceJoined[]>([]),
    [mode, projectId, from, to],
  );
  const summaryQ = useApi(
    () =>
      mode === 'single' && ready
        ? api.get<AttendanceSummary>(`/attendance/summary?date=${date}&project_id=${projectId}`)
        : Promise.resolve<AttendanceSummary | null>(null),
    [mode, projectId, date],
  );

  // Surface API errors (e.g. 403 unassigned project) as a clean toast, no crash.
  useEffect(() => {
    const err = rosterQ.error ?? listQ.error ?? summaryQ.error ?? projectsQ.error;
    if (err) notify.apiError(err);
  }, [rosterQ.error, listQ.error, summaryQ.error, projectsQ.error]);

  const projectName = useMemo(
    () => projectsQ.data?.find((p) => p.id === projectId)?.name ?? '',
    [projectsQ.data, projectId],
  );

  const allRows: DashRow[] = useMemo(() => {
    if (mode === 'single') {
      return (rosterQ.data ?? []).map((r) => ({
        key: r.worker_id,
        worker_id: r.worker_id,
        full_name: r.full_name,
        position: r.position,
        project_name: projectName,
        work_date: date,
        status: r.status,
        attendance_id: r.attendance_id,
        clock_in_at: r.clock_in_at,
        clock_out_at: r.clock_out_at,
        total_hours: r.total_hours,
        overtime: r.overtime,
        recorded_by_name: r.recorded_by_name,
      }));
    }
    return (listQ.data ?? []).map((a) => ({
      key: a.id,
      worker_id: a.worker_id,
      full_name: a.full_name,
      position: a.position,
      project_name: a.project_name,
      work_date: a.work_date,
      status: a.status,
      attendance_id: a.id,
      clock_in_at: a.clock_in_at,
      clock_out_at: a.clock_out_at,
      total_hours: a.total_hours,
      overtime: a.overtime,
      recorded_by_name: a.recorded_by_name,
    }));
  }, [mode, rosterQ.data, listQ.data, projectName, date]);

 const rows = useMemo(
  () =>
    allRows
      .filter((r) => filters.statuses.includes(r.status))
      .sort((a, b) => {
        // 1. Sort by date ascending (earliest first)
        if (a.work_date !== b.work_date) {
          return a.work_date.localeCompare(b.work_date);
        }
        // 2. Same date → sort by worker name, alphabetically
        return a.full_name.localeCompare(b.full_name);
      }),
  [allRows, filters.statuses],
);

  const tableLoading = mode === 'single' ? rosterQ.loading : listQ.loading;

  const refresh = () => {
    rosterQ.refetch();
    listQ.refetch();
    summaryQ.refetch();
  };

  const onAction = (action: RowAction, row: DashRow) => {
    if (action === 'view') {
      if (row.attendance_id) navigate(`/attendance/${row.attendance_id}`);
      return;
    }
    setDialog({ kind: action, row });
  };

  // Action runners — toast + refetch on success; keep dialog open on error.
  const runWrite = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      notify.success(okMsg);
      setDialog(null);
      refresh();
    } catch (err) {
      notify.apiError(err);
    }
  };

  if (projectsQ.loading) return <LoadingScreen label="LOADING PROJECTS" />;

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <FilterStrip projects={projectsQ.data ?? []} filters={filters} onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} />

      <main className="flex flex-col gap-5 px-4 py-5 md:px-6">
        {(projectsQ.data?.length ?? 0) === 0 ? (
          <div className="border-2 border-dashed border-steel p-12 text-center font-mono text-sm uppercase tracking-widest text-steel">
            No projects assigned to your account.
          </div>
        ) : (
          <>
            {mode === 'single' ? (
              <SummaryCards summary={summaryQ.data} loading={summaryQ.loading} />
            ) : (
              <div className="border-2 border-ink bg-paper p-3 font-mono text-xs uppercase tracking-widest text-steel shadow-hard">
                Summary cards reflect a single date — switch to single-date mode to view them.
              </div>
            )}

            <AttendanceTable rows={rows} loading={tableLoading} role={profile?.role ?? 'site_manager'} onAction={onAction} />
            <p className="font-mono text-[11px] text-concrete">
              {rows.length} row{rows.length === 1 ? '' : 's'} · {mode === 'single' ? date : `${from} → ${to}`}
            </p>
          </>
        )}
      </main>

      <TimePickerDialog
        open={dialog?.kind === 'clock-in' || dialog?.kind === 'clock-out'}
        kind={dialog?.kind === 'clock-out' ? 'clock-out' : 'clock-in'}
        row={dialog?.row ?? null}
        onClose={() => setDialog(null)}
        onConfirm={async (iso) => {
          if (!dialog) return;
          const { row, kind } = dialog;
          if (kind === 'clock-in') {
            await runWrite(
              () => api.post('/attendance/clock-in', { worker_id: row.worker_id, work_date: row.work_date, clock_in_at: iso }),
              `Clocked in ${row.full_name}`,
            );
          } else {
            await runWrite(
              () => api.post('/attendance/clock-out', { worker_id: row.worker_id, work_date: row.work_date, clock_out_at: iso }),
              `Clocked out ${row.full_name}`,
            );
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'mark-absent'}
        title="Mark Absent"
        message={dialog ? `Mark ${dialog.row.full_name} absent for ${dialog.row.work_date}?` : ''}
        confirmLabel="Mark Absent"
        variant="primary"
        onClose={() => setDialog(null)}
        onConfirm={() =>
          runWrite(
            () => api.post('/attendance/mark-absent', { worker_id: dialog!.row.worker_id, work_date: dialog!.row.work_date }),
            `Marked ${dialog!.row.full_name} absent`,
          )
        }
      />

      <ConfirmDialog
        open={dialog?.kind === 'undo'}
        title="Undo Record"
        message={dialog ? `Delete the attendance record for ${dialog.row.full_name} on ${dialog.row.work_date}? This is logged.` : ''}
        confirmLabel="Undo"
        variant="danger"
        onClose={() => setDialog(null)}
        onConfirm={() =>
          runWrite(
            () => api.post('/attendance/undo', { attendance_id: dialog!.row.attendance_id }),
            `Reverted ${dialog!.row.full_name}`,
          )
        }
      />
    </div>
  );
}
