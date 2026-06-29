import * as DM from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({
  className,
  align = 'end',
  ...props
}: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={4}
        className={cn(
          'z-50 min-w-44 border-2 border-ink bg-paper p-0 shadow-hard',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 border-b-2 border-ink/15 px-3 py-2',
        'font-mono text-xs font-bold uppercase tracking-wider text-ink last:border-b-0',
        'outline-none focus:bg-ink focus:text-paper data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    />
  );
}
