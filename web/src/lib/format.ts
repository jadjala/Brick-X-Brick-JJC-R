  import { formatInTimeZone } from 'date-fns-tz';

  export const PHT = 'Asia/Manila';

  /** Decimal hours → "8h 30m", or "—" when null (SPEC §3 / AC9). */
  export function formatHours(hours: number | null): string {
    if (hours === null || hours === undefined) return '—';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  /** ISO timestamptz → "HH:MM" in PHT, or "—" when null. */
  export function formatTimePHT(iso: string | null): string {
    if (!iso) return '—';
    return formatInTimeZone(new Date(iso), PHT, 'HH:mm');
  }

  export function formatDatePHT(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00+08:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  /** ISO timestamptz → "yyyy-MM-dd HH:mm:ss" in PHT (audit timeline). */
  export function formatDateTimePHT(iso: string): string {
    return formatInTimeZone(new Date(iso), PHT, 'yyyy-MM-dd HH:mm:ss');
  }

  /** A JS Date (browser-local) → its PHT calendar date "yyyy-MM-dd" for the API. */
  export function toPhtDate(d: Date): string {
    return formatInTimeZone(d, PHT, 'yyyy-MM-dd');
  }

  export function todayPhtDate(): string {
    return toPhtDate(new Date());
  }

  /** "now" as a PHT ISO string with +08:00 offset (proxy time-picker default). */
  export function nowPhtIso(): string {
    return formatInTimeZone(new Date(), PHT, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  /** PHT current wall-clock time as "HH:mm" (time-input default). */
  export function nowPhtTime(): string {
    return formatInTimeZone(new Date(), PHT, 'HH:mm');
  }

  /**
   * Build a PHT ISO timestamptz from a calendar date + "HH:mm" wall time.
   * PHT is fixed +08:00, so we can append the offset directly.
   */
  export function phtIso(dateYmd: string, timeHHmm: string): string {
    return `${dateYmd}T${timeHHmm}:00+08:00`;
  }
