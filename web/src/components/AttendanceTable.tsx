import { FileX2 } from 'lucide-react';
import { Table, THead, TH, TBody, TRow, TCell, StatusPill, Skeleton } from '@/components/brutalist';
import { RowActions, type RowAction } from './RowActions';
import { formatHours, formatTimePHT } from '@/lib/format';
import type { Role } from '@/lib/types';
import type { DashRow } from '@/lib/dash';

const COLS = 10;

export function AttendanceTable({
  rows,
  loading,
  role,
  onAction,
}: {
  rows: DashRow[];
  loading: boolean;
  role: Role;
  onAction: (action: RowAction, row: DashRow) => void;
}) {
  return (
    <Table>
      <THead>
        <TH>Worker</TH>
        <TH>Position</TH>
        <TH>Project</TH>
        <TH>Status</TH>
        <TH numeric>Clock In</TH>
        <TH numeric>Clock Out</TH>
        <TH numeric>Total Hours</TH>
        <TH numeric>Overtime</TH>
        <TH>Recorded By</TH>
        <TH>Actions</TH>
      </THead>
      <TBody>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <TRow key={i}>
              <td colSpan={COLS} className="px-3 py-2">
                <Skeleton className="h-6 w-full" />
              </td>
            </TRow>
          ))
        ) : rows.length === 0 ? (
          <TRow>
            <td colSpan={COLS} className="p-0">
              <div className="m-4 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-steel py-16">
                <FileX2 className="h-8 w-8 text-steel" strokeWidth={2} />
                <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-steel">
                  No records for this date / project
                </p>
              </div>
            </td>
          </TRow>
        ) : (
          rows.map((r) => (
            <TRow key={r.key}>
              <TCell className="font-semibold">{r.full_name}</TCell>
              <TCell className="text-steel">{r.position ?? '—'}</TCell>
              <TCell className="text-steel">{r.project_name}</TCell>
              <TCell>
                <StatusPill status={r.status} />
              </TCell>
              <TCell numeric>{formatTimePHT(r.clock_in_at)}</TCell>
              <TCell numeric>{formatTimePHT(r.clock_out_at)}</TCell>
              <TCell numeric>{formatHours(r.total_hours)}</TCell>
              <TCell numeric className={r.overtime ? 'text-orange' : ''}>
                {formatHours(r.overtime)}
              </TCell>
              <TCell className="text-steel">{r.recorded_by_name ?? '—'}</TCell>
              <TCell>
                <RowActions row={r} role={role} onAction={onAction} />
              </TCell>
            </TRow>
          ))
        )}
      </TBody>
    </Table>
  );
}
