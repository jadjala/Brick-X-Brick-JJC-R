import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Chunky, uppercase, mono, hard shadow. On press: shift (2,2) + collapse shadow.
const button = cva(
  'inline-flex items-center justify-center gap-2 border-2 border-ink font-mono font-bold uppercase tracking-wider transition-[transform,box-shadow] duration-75 select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none',
  {
    variants: {
      variant: {
        primary: 'bg-orange text-paper shadow-hard active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        secondary: 'bg-paper text-ink shadow-hard active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        danger: 'bg-absent text-paper shadow-hard active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        ghost: 'bg-transparent text-ink hover:bg-ink hover:text-paper',
      },
      size: {
        sm: 'h-8 px-3 text-[11px]',
        md: 'h-11 px-5 text-sm',
        lg: 'h-14 px-7 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
