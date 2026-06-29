import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-2 border-ink bg-paper shadow-hard', className)} {...props} />;
}
