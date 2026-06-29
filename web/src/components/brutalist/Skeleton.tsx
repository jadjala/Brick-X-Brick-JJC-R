import { cn } from '@/lib/utils';

/** Chunky hazard-stripe loading bar (no soft pulse). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('brutal-skeleton border-2 border-ink', className)} />;
}

export function LoadingScreen({ label = 'LOADING' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
      <div className="flex w-64 flex-col gap-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-6 w-2/3" />
      </div>
      <span className="font-mono text-xs font-bold uppercase tracking-[0.4em] text-steel">{label}</span>
    </div>
  );
}
