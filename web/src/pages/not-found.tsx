import { Link } from 'react-router-dom';
import { Button } from '@/components/brutalist';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-6 text-center">
      <div className="hazard-tape h-3 w-full max-w-lg border-2 border-ink" />
      <h1 className="font-mono text-[22vw] font-bold leading-none text-ink md:text-[180px]">404</h1>
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-steel">
        No record at this location
      </p>
      <Link to="/attendance">
        <Button variant="primary">← Back to dashboard</Button>
      </Link>
      <div className="hazard-tape h-3 w-full max-w-lg border-2 border-ink" />
    </main>
  );
}
