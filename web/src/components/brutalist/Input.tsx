import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Flat field. Focus shifts (-2,-2) and adds the hard shadow — no focus ring (§13.2).
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full border-2 border-ink bg-paper px-3 font-mono text-sm text-ink',
        'transition-[transform,box-shadow] duration-75 placeholder:text-concrete',
        'focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-hard',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
        {label}
      </label>
      {children}
      {error && <span className="font-mono text-xs text-absent">{error}</span>}
    </div>
  );
}
