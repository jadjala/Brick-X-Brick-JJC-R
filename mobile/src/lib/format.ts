import { formatInTimeZone } from 'date-fns-tz';

export const PHT = 'Asia/Manila';

export function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '—';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export function formatTimePHT(iso: string | null): string {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), PHT, 'HH:mm');
}

export function toPhtDate(d: Date): string {
  return formatInTimeZone(d, PHT, 'yyyy-MM-dd');
}
export const todayPhtDate = (): string => toPhtDate(new Date());
export const yesterdayPhtDate = (): string => toPhtDate(new Date(Date.now() - 86_400_000));

export function nowPhtTime(): string {
  return formatInTimeZone(new Date(), PHT, 'HH:mm');
}

/** PHT calendar date + "HH:mm" wall time → ISO timestamptz (+08:00 fixed). */
export function phtIso(dateYmd: string, timeHHmm: string): string {
  return `${dateYmd}T${timeHHmm}:00+08:00`;
}

/** "2026-06-28 / SAT" section header. */
export function formatDateHeader(ymd: string): string {
  const day = formatInTimeZone(new Date(`${ymd}T00:00:00+08:00`), PHT, 'EEE').toUpperCase();
  return `${ymd} / ${day}`;
}

const ymdNum = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
export function inCorrectionWindow(workDate: string): boolean {
  const age = ymdNum(todayPhtDate()) - ymdNum(workDate);
  return age === 0 || age === 1;
}
