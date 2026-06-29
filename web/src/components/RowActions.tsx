import { MoreHorizontal, Eye, LogIn, LogOut, UserX, Undo2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { Role } from '@/lib/types';
import {
  type DashRow,
  canView,
  canProxyIn,
  canProxyOut,
  canMarkAbsent,
  canUndo,
  hasAnyAction,
} from '@/lib/dash';

export type RowAction = 'view' | 'clock-in' | 'clock-out' | 'mark-absent' | 'undo';

export function RowActions({
  row,
  role,
  onAction,
}: {
  row: DashRow;
  role: Role;
  onAction: (action: RowAction, row: DashRow) => void;
}) {
  if (!hasAnyAction(row, role)) {
    return <span className="font-mono text-xs text-concrete">—</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Row actions"
          className="border-2 border-ink bg-paper p-1 text-ink transition-colors hover:bg-ink hover:text-paper data-[state=open]:bg-ink data-[state=open]:text-paper"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {canView(row) && (
          <DropdownMenuItem onSelect={() => onAction('view', row)}>
            <Eye className="h-3.5 w-3.5" strokeWidth={2.5} /> View
          </DropdownMenuItem>
        )}
        {canProxyIn(row, role) && (
          <DropdownMenuItem onSelect={() => onAction('clock-in', row)}>
            <LogIn className="h-3.5 w-3.5" strokeWidth={2.5} /> Proxy Clock In
          </DropdownMenuItem>
        )}
        {canProxyOut(row, role) && (
          <DropdownMenuItem onSelect={() => onAction('clock-out', row)}>
            <LogOut className="h-3.5 w-3.5" strokeWidth={2.5} /> Proxy Clock Out
          </DropdownMenuItem>
        )}
        {canMarkAbsent(row) && (
          <DropdownMenuItem onSelect={() => onAction('mark-absent', row)}>
            <UserX className="h-3.5 w-3.5" strokeWidth={2.5} /> Mark Absent
          </DropdownMenuItem>
        )}
        {canUndo(row) && (
          <DropdownMenuItem onSelect={() => onAction('undo', row)}>
            <Undo2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Undo
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
