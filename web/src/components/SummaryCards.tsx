import { Card, Skeleton } from '@/components/brutalist';
import { formatHours } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AttendanceSummary } from '@/lib/types';

// 7 cards per SPEC §5.2. Values come straight from GET /attendance/summary — no
// client-side recalculation (AC8).
export function SummaryCards({
  summary,
  loading,
}: {
  summary: AttendanceSummary | null;
  loading: boolean;
}) {
  const cards: { label: string; value: string; accent?: string }[] = summary
    ? [
        { label: 'Total Workers', value: String(summary.total_workers) },
        { label: 'Present', value: String(summary.clocked_in), accent: 'text-clockedin' },
        { label: 'Clocked Out', value: String(summary.clocked_out), accent: 'text-clockedout' },
        { label: 'Absent', value: String(summary.absent), accent: 'text-absent' },
        { label: 'No Record', value: String(summary.no_record) },
        { label: 'Total Hours', value: formatHours(summary.total_hours) },
        { label: 'Total OT', value: formatHours(summary.total_overtime), accent: 'text-orange' },
      ]
    : [];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[84px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <Card key={c.label} className="flex flex-col justify-between p-3">
          <span className="font-display text-[10px] font-bold uppercase leading-tight tracking-wider text-steel">
            {c.label}
          </span>
          <span className={cn('mt-2 font-mono text-2xl font-bold leading-none text-ink', c.accent)}>{c.value}</span>
        </Card>
      ))}
    </div>
  );
}
