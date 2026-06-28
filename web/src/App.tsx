import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sprint 0 boot smoke test only. The real admin (login, attendance dashboard,
// details/audit) is Sprint 2 — do not preempt.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type ApiState = 'checking' | 'ok' | 'down';

function App() {
  const [status, setStatus] = useState<ApiState>('checking');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        const json = (await res.json()) as { ok?: boolean; version?: string };
        if (!alive) return;
        setStatus(json.ok ? 'ok' : 'down');
        setVersion(json.version ?? null);
      } catch {
        if (alive) setStatus('down');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-paper text-ink p-8 md:p-12">
      <p className="font-mono text-xs tracking-[0.3em] text-orange">BRICK × BRICK</p>
      <h1 className="font-display font-bold uppercase text-4xl md:text-6xl tracking-tight mt-1">
        BxB Admin
      </h1>

      <div className="mt-10 max-w-xl border-2 border-ink shadow-hard bg-paper p-6">
        <div className="font-mono text-xs uppercase tracking-widest text-concrete">
          VITE_API_BASE_URL
        </div>
        <div className="font-mono text-sm md:text-base text-ink mt-1 break-all">
          {API_BASE_URL || '(unset — copy env.example to .env)'}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Activity className="h-5 w-5" strokeWidth={2} />
          <span
            className={cn(
              'inline-block border-2 border-ink px-3 py-1 font-mono text-sm font-bold uppercase tracking-wider',
              status === 'ok' && 'bg-clockedin text-paper',
              status === 'down' && 'bg-absent text-paper',
              status === 'checking' && 'bg-concrete text-paper',
            )}
          >
            {status === 'ok'
              ? `API: OK${version ? ` · v${version}` : ''}`
              : status === 'down'
                ? 'API: DOWN'
                : 'API: …'}
          </span>
        </div>
      </div>

      <p className="font-mono text-[10px] tracking-[0.3em] text-steel mt-12 uppercase">
        Web Admin · Sprint 0 boot
      </p>
    </main>
  );
}

export default App;
