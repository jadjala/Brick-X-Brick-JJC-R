import { Toaster as Sonner, toast } from 'sonner';
import { ApiError } from '@/lib/api';

// Brutalist toasts: square, 2px ink border, hard shadow, mono.
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-3 border-2 border-ink bg-paper p-3 shadow-hard font-mono text-sm',
          title: 'font-bold uppercase tracking-wide',
          description: 'text-steel',
        },
      }}
    />
  );
}

// De-duped notifications. Errors keyed by code so a storm of the same error
// (e.g. session-expired on every refetch) collapses to one toast (gotcha #6).
export const notify = {
  success(message: string) {
    toast.custom(
      () => (
        <div className="flex w-72 items-center gap-3 border-2 border-ink bg-clockedin p-3 font-mono text-sm text-paper shadow-hard">
          <span className="font-bold uppercase tracking-wide">OK</span>
          <span>{message}</span>
        </div>
      ),
      { id: `ok:${message}` },
    );
  },
  error(message: string, code = 'ERROR') {
    toast.custom(
      () => (
        <div className="flex w-72 items-start gap-3 border-2 border-ink bg-absent p-3 font-mono text-sm text-paper shadow-hard">
          <span className="shrink-0 font-bold uppercase tracking-wide">{code}</span>
          <span>{message}</span>
        </div>
      ),
      { id: `err:${code}` },
    );
  },
  apiError(err: unknown) {
    if (err instanceof ApiError) this.error(err.message, err.code);
    else this.error(err instanceof Error ? err.message : 'Something went wrong.', 'ERROR');
  },
};
