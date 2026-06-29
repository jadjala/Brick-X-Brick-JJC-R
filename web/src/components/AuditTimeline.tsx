import { RolePill } from '@/components/brutalist';
import { formatDateTimePHT, formatTimePHT } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AttendanceLog } from '@/lib/types';

const ACTION_COLOR: Record<AttendanceLog['action'], string> = {
  clock_in: 'bg-clockedin text-paper',
  proxy_clock_in: 'bg-clockedin text-paper',
  clock_out: 'bg-clockedout text-paper',
  proxy_clock_out: 'bg-clockedout text-paper',
  mark_absent: 'bg-absent text-paper',
  undo: 'bg-paper text-ink',
  edit_time: 'bg-orange text-paper',
};

// Fields worth showing in a before/after snapshot.
const DIFF_KEYS = ['status', 'clock_in_at', 'clock_out_at', 'notes'] as const;
type State = Record<string, unknown> | null;

const fmt = (key: string, value: unknown): string => {
  if (value === null || value === undefined) return '∅';
  if ((key === 'clock_in_at' || key === 'clock_out_at') && typeof value === 'string') {
    return formatTimePHT(value);
  }
  return String(value);
};

function changedKeys(before: State, after: State): string[] {
  return DIFF_KEYS.filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
}

function StateBlock({ label, accent, state, keys }: { label: string; accent: string; state: State; keys: string[] }) {
  return (
    <div className="border-2 border-ink bg-paper">
      <div className={cn('border-b-2 border-ink px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest', accent)}>
        {label}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 p-2 font-mono text-xs">
        {keys.map((k) => (
          <div key={k} className="contents">
            <dt className="text-steel">{k}</dt>
            <dd className="text-ink">{fmt(k, state?.[k])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AuditTimeline({ logs }: { logs: AttendanceLog[] }) {
  if (logs.length === 0) {
    return <p className="font-mono text-sm uppercase tracking-widest text-steel">No audit entries.</p>;
  }
  return (
    <ol className="relative ml-2 flex flex-col gap-5 border-l-2 border-ink pl-6">
      {logs.map((log) => {
        const keys = changedKeys(log.before_state, log.after_state);
        const showKeys = keys.length ? keys : ['status'];
        return (
          <li key={log.id} className="relative">
            {/* square dot on the rule */}
            <span className="absolute -left-[31px] top-1 h-3 w-3 border-2 border-ink bg-paper" />
            <div className="border-2 border-ink bg-paper p-3 shadow-hard">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn('border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider', ACTION_COLOR[log.action])}>
                  {log.action.replace(/_/g, ' ')}
                </span>
                <span className="font-mono text-[11px] text-steel">{formatDateTimePHT(log.created_at)} PHT</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="font-body text-sm font-semibold text-ink">{log.actor_name}</span>
                <RolePill role={log.actor_role} />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {log.before_state && <StateBlock label="Before" accent="text-steel" state={log.before_state} keys={showKeys} />}
                {log.after_state && <StateBlock label="After" accent="text-orange" state={log.after_state} keys={showKeys} />}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
