import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const PHT = 'Asia/Manila'; // fixed UTC+8, no DST
export const WORK_HOUR_START = 5; // 05:00 PHT (G12)
export const WORK_HOUR_END = 23; // 23:00 PHT (G12)
const FUTURE_SKEW_MS = 60_000; // 1 minute (G8)
const MAX_WORK_DATE_AGE_DAYS = 90; // G10

// Injectable clock so tests can freeze time. Wrap all "current time" reads here.
let clock: () => Date = () => new Date();
export const now = (): Date => clock();
export const setClockForTests = (fn: () => Date): void => {
  clock = fn;
};
export const resetClockForTests = (): void => {
  clock = () => new Date();
};

/** Current instant shifted into PHT wall-clock (for display/formatting). */
export const nowPHT = (): Date => toZonedTime(now(), PHT);

/** PHT calendar date of a given instant (or now), as YYYY-MM-DD. */
export const phtDate = (d: Date = now()): string => formatInTimeZone(d, PHT, 'yyyy-MM-dd');
export const todayPHT = (): string => phtDate(now());

const dayNum = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** True iff workDate is today or yesterday in PHT (correction window, §0.4 / G7). */
export const isInCorrectionWindow = (workDate: string): boolean => {
  const age = dayNum(todayPHT()) - dayNum(workDate);
  return age === 0 || age === 1;
};

/** True iff workDate is not in the future and not older than 90 days (G10). */
export const isWorkDateAllowed = (workDate: string): boolean => {
  const age = dayNum(todayPHT()) - dayNum(workDate);
  return age >= 0 && age <= MAX_WORK_DATE_AGE_DAYS;
};

/** PHT hour (0–23) of an instant. */
export const phtHour = (ts: Date): number => Number(formatInTimeZone(ts, PHT, 'H'));

/** True iff the instant's PHT hour is within work hours [05:00, 23:00] (G12). */
export const isWithinWorkHours = (ts: Date): boolean => {
  const h = phtHour(ts);
  return h >= WORK_HOUR_START && h <= WORK_HOUR_END;
};

/** True iff ts is more than 1 minute ahead of now (G8). */
export const isFuture = (ts: Date): boolean => ts.getTime() > now().getTime() + FUTURE_SKEW_MS;

/** Format an instant as a PHT ISO string with +08:00 offset (SPEC §7.2), or null. */
export const toPhtIso = (d: Date | null): string | null =>
  d === null ? null : formatInTimeZone(d, PHT, "yyyy-MM-dd'T'HH:mm:ssXXX");

/** Add n calendar days to a YYYY-MM-DD string. */
export const addDaysToYmd = (ymd: string, n: number): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};
