import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project, RowStatus } from '@/lib/types';

export type Filters = {
  mode: 'single' | 'range';
  date: string;
  from: string;
  to: string;
  projectId: string;
  statuses: RowStatus[];
};

const ALL_STATUSES: RowStatus[] = ['clocked_in', 'clocked_out', 'absent', 'no_record'];
const STATUS_LABEL: Record<RowStatus, string> = {
  clocked_in: 'Clocked In',
  clocked_out: 'Clocked Out',
  absent: 'Absent',
  no_record: 'No Record',
};

const dateInput =
  'h-9 border-2 border-ink bg-paper px-2 font-mono text-sm text-ink focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-hard transition-transform';

export function FilterStrip({
  projects,
  filters,
  onChange,
}: {
  projects: Project[];
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  // Single-select: clicking a status shows only that status. Clicking the
  // active one again clears the filter (back to all). "All active" == no filter.
  const isFiltering = filters.statuses.length === 1;
  const selectStatus = (s: RowStatus) => {
    const soleActive = isFiltering && filters.statuses[0] === s;
    onChange({ statuses: soleActive ? ALL_STATUSES : [s] });
  };

  return (
    <div className="sticky top-[57px] z-20 flex flex-wrap items-end gap-4 border-b-2 border-ink bg-paper px-4 py-3 md:px-6">
      {/* Date mode + inputs */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">Date</span>
        <div className="flex items-center gap-2">
          <div className="flex border-2 border-ink">
            {(['single', 'range'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onChange({ mode: m })}
                className={cn(
                  'px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider',
                  filters.mode === m ? 'bg-ink text-paper' : 'bg-paper text-ink',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {filters.mode === 'single' ? (
            <input
              type="date"
              value={filters.date}
              onChange={(e) => onChange({ date: e.target.value })}
              className={dateInput}
            />
          ) : (
            <div className="flex items-center gap-1">
              <input type="date" value={filters.from} onChange={(e) => onChange({ from: e.target.value })} className={dateInput} />
              <span className="font-mono text-xs text-steel">→</span>
              <input type="date" value={filters.to} onChange={(e) => onChange({ to: e.target.value })} className={dateInput} />
            </div>
          )}
        </div>
      </div>

      {/* Project */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">Project</span>
        <select
          value={filters.projectId}
          onChange={(e) => onChange({ projectId: e.target.value })}
          className={cn(dateInput, 'min-w-52 cursor-pointer')}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">Status</span>
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((s) => {
            const on = isFiltering && filters.statuses[0] === s;
            return (
              <button
                key={s}
                onClick={() => selectStatus(s)}
                className={cn(
                  'border-2 border-ink px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors',
                  on ? 'bg-ink text-paper' : 'bg-paper text-concrete',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ml-auto flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">&nbsp;</span>
        <button
          disabled
          title="Available in Sprint 3"
          className="flex h-9 cursor-not-allowed items-center gap-2 border-2 border-ink bg-paper px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-concrete opacity-60"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
          Export XLSX
        </button>
      </div>
    </div>
  );
}
