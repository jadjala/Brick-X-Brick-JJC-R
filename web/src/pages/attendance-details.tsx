import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { notify } from '@/components/ui/toaster';
import { formatHours, formatTimePHT, formatDateTimePHT } from '@/lib/format';
import type { AttendanceJoined, AttendanceLog } from '@/lib/types';
import { Header } from '@/components/Header';
import { Card, StatusPill, Skeleton } from '@/components/brutalist';
import { AuditTimeline } from '@/components/AuditTimeline';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b-2 border-ink/10 py-2 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <dt className="w-44 shrink-0 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{label}</dt>
      <dd className="font-mono text-sm text-ink">{children}</dd>
    </div>
  );
}

export function AttendanceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const recordQ = useApi(() => api.get<AttendanceJoined>(`/attendance/${id}`), [id]);
  const logsQ = useApi(() => api.get<AttendanceLog[]>(`/attendance/${id}/logs`), [id]);

  useEffect(() => {
    const err = recordQ.error ?? logsQ.error;
    if (err) notify.apiError(err);
  }, [recordQ.error, logsQ.error]);

  const r = recordQ.data;

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6 md:px-6">
        <Link
          to="/attendance"
          className="flex w-fit items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-steel hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back to dashboard
        </Link>

        {recordQ.loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !r ? (
          <Card className="p-8 text-center font-mono text-sm uppercase tracking-widest text-steel">
            Record not found or not accessible.
          </Card>
        ) : (
          <>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-orange">{r.position ?? 'Worker'}</p>
              <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-ink md:text-5xl">
                {r.full_name}
              </h1>
              <p className="mt-1 font-mono text-sm text-steel">{r.project_name}</p>
            </div>

            <Card className="p-5">
              <dl>
                <Row label="Date">{r.work_date}</Row>
                <Row label="Status">
                  <StatusPill status={r.status} />
                </Row>
                <Row label="Clock In">{formatTimePHT(r.clock_in_at)}</Row>
                <Row label="Clock Out">{formatTimePHT(r.clock_out_at)}</Row>
                <Row label="Total Hours">{formatHours(r.total_hours)}</Row>
                <Row label="Overtime">{formatHours(r.overtime)}</Row>
                <Row label="Recorded By">{r.recorded_by_name ?? '—'}</Row>
                <Row label="Notes">{r.notes ?? '—'}</Row>
                <Row label="Created">{formatDateTimePHT(r.created_at)} PHT</Row>
                <Row label="Updated">{formatDateTimePHT(r.updated_at)} PHT</Row>
              </dl>
            </Card>

            <div>
              <h2 className="mb-4 font-display text-xl font-bold uppercase tracking-tight text-ink">Audit Timeline</h2>
              {logsQ.loading ? <Skeleton className="h-32 w-full" /> : <AuditTimeline logs={logsQ.data ?? []} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
