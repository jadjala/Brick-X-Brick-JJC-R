import { useEffect, useState } from 'react';

type State<T> = { data: T | null; error: unknown; loading: boolean };

/**
 * Minimal fetch hook (no TanStack Query, per sprint scope). Re-runs when `deps`
 * change or `refetch()` is called. `fetcher` is intentionally excluded from the
 * dependency list — pass a `deps` key (filters, ids) to control refetching.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((error) => active && setState({ data: null, error, loading: false }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
