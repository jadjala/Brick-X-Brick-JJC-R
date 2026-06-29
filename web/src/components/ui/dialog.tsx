import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[1px]" />
      <D.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2',
          'border-2 border-ink bg-paper p-6 shadow-hard focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <D.Close
          aria-label="Close"
          className="absolute right-3 top-3 border-2 border-ink bg-paper p-1 text-ink hover:bg-ink hover:text-paper"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof D.Title>) {
  return (
    <D.Title
      className={cn('font-display text-xl font-bold uppercase tracking-tight text-ink', className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof D.Description>) {
  return <D.Description className={cn('mt-1 font-body text-sm text-steel', className)} {...props} />;
}
