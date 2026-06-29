import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { RowStatus, Role } from '@/lib/types';

const pill = cva(
  'inline-block border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider leading-tight whitespace-nowrap',
  {
    variants: {
      status: {
        clocked_in: 'bg-clockedin text-paper',
        clocked_out: 'bg-clockedout text-paper',
        absent: 'bg-absent text-paper',
        no_record: 'bg-paper text-ink',
      },
    },
    defaultVariants: { status: 'no_record' },
  },
);

const LABEL: Record<RowStatus, string> = {
  clocked_in: 'Clocked In',
  clocked_out: 'Clocked Out',
  absent: 'Absent',
  no_record: 'No Record',
};

export function StatusPill({
  status,
  className,
}: { status: RowStatus } & VariantProps<typeof pill> & { className?: string }) {
  return <span className={cn(pill({ status }), className)}>{LABEL[status]}</span>;
}

const ROLE_ABBR: Record<Role, string> = {
  admin: 'ADMIN',
  general_manager: 'GM',
  project_manager: 'PM',
  site_manager: 'SM',
};

export function RolePill({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block border-2 border-ink bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-paper',
        className,
      )}
    >
      {ROLE_ABBR[role]}
    </span>
  );
}
