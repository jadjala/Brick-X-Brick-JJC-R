// Hours & overtime math (SPEC §3).

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Total hours = (clockOut − clockIn), rounded to the nearest MINUTE, expressed
 * as decimal hours (2dp). Null if either bound is missing (partial day, §3).
 * Returns null for non-positive durations (caller rejects those via G5).
 */
export function calculateHours(clockIn: Date | null, clockOut: Date | null): number | null {
  if (!clockIn || !clockOut) return null;
  const ms = clockOut.getTime() - clockIn.getTime();
  if (ms <= 0) return null;
  const minutes = Math.round(ms / 60_000);
  return round2(minutes / 60);
}

/** Overtime = max(0, hours − standardHours). Null-safe. */
export function calculateOvertime(hours: number | null, standardHours: number): number | null {
  if (hours === null) return null;
  return round2(Math.max(0, hours - standardHours));
}

/** "8h 30m" from decimal hours, or "—" (em dash) when null (§3 display). */
export function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}
