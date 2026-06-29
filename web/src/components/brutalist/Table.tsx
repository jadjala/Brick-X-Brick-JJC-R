import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto border-2 border-ink">
      <table className={cn('w-full border-collapse', className)} {...props} />
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-ink text-paper">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  numeric,
  className,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <th
      className={cn(
        'border-r-2 border-paper/30 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wider last:border-r-0',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-t-2 border-ink hover:bg-yellow/20', className)} {...props} />;
}

export function TCell({
  children,
  numeric,
  className,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'border-r-2 border-ink/15 px-3 py-2 align-middle text-sm last:border-r-0',
        numeric ? 'text-right font-mono' : 'font-body',
        className,
      )}
    >
      {children}
    </td>
  );
}
