import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { RolePill } from '@/components/brutalist';

export function Header() {
  const { profile, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 md:px-6">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-lg font-bold uppercase tracking-tight text-paper md:text-xl">
          Brick × Brick
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-orange">Admin</span>
      </div>
      <div className="flex items-center gap-3">
        {profile && (
          <div className="hidden items-center gap-2 border-2 border-paper/40 px-3 py-1 sm:flex">
            <span className="font-mono text-xs text-paper">{profile.full_name}</span>
            <RolePill role={profile.role} />
          </div>
        )}
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-2 border-2 border-paper bg-transparent px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2.5} />
          Sign Out
        </button>
      </div>
    </header>
  );
}
