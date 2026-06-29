import { describe, it, expect, afterAll } from 'vitest';
import {
  setClockForTests,
  resetClockForTests,
  todayPHT,
  isInCorrectionWindow,
  isWorkDateAllowed,
  isWithinWorkHours,
  isFuture,
  phtDate,
  phtHour,
  toPhtIso,
  addDaysToYmd,
} from '../src/lib/time.js';

// Freeze "now" at 2026-06-29T04:00:00Z == 2026-06-29 12:00 PHT.
const FROZEN = new Date('2026-06-29T04:00:00Z');
setClockForTests(() => FROZEN);
afterAll(() => resetClockForTests());

describe('PHT date helpers', () => {
  it('todayPHT', () => expect(todayPHT()).toBe('2026-06-29'));
  it('correction window = today + yesterday only (G7)', () => {
    expect(isInCorrectionWindow('2026-06-29')).toBe(true);
    expect(isInCorrectionWindow('2026-06-28')).toBe(true);
    expect(isInCorrectionWindow('2026-06-27')).toBe(false);
  });
  it('work date allowed within [0,90] days, not future (G10)', () => {
    expect(isWorkDateAllowed('2026-06-29')).toBe(true);
    expect(isWorkDateAllowed('2026-06-30')).toBe(false); // future
    expect(isWorkDateAllowed(addDaysToYmd('2026-06-29', -100))).toBe(false);
    expect(isWorkDateAllowed(addDaysToYmd('2026-06-29', -90))).toBe(true);
  });
});

describe('work-hours + future guards', () => {
  it('isWithinWorkHours [05:00,23:00] PHT (G12)', () => {
    expect(isWithinWorkHours(new Date('2026-06-29T04:00:00Z'))).toBe(true); // 12:00 PHT
    expect(isWithinWorkHours(new Date('2026-06-28T19:00:00Z'))).toBe(false); // 03:00 PHT
    expect(isWithinWorkHours(new Date('2026-06-28T21:00:00Z'))).toBe(true); // 05:00 PHT
    expect(isWithinWorkHours(new Date('2026-06-29T15:00:00Z'))).toBe(true); // 23:00 PHT
    expect(isWithinWorkHours(new Date('2026-06-28T20:00:00Z'))).toBe(false); // 04:00 PHT
  });
  it('isFuture (>1 min ahead) (G8)', () => {
    expect(isFuture(new Date(FROZEN.getTime() + 2 * 60000))).toBe(true);
    expect(isFuture(new Date(FROZEN.getTime() + 30 * 1000))).toBe(false);
    expect(isFuture(new Date(FROZEN.getTime() - 60000))).toBe(false);
  });
});

describe('formatting', () => {
  it('phtDate / phtHour', () => {
    expect(phtDate(new Date('2026-06-29T04:00:00Z'))).toBe('2026-06-29');
    expect(phtHour(new Date('2026-06-29T04:00:00Z'))).toBe(12);
  });
  it('toPhtIso emits +08:00', () => {
    expect(toPhtIso(new Date('2026-06-29T00:00:00Z'))).toBe('2026-06-29T08:00:00+08:00');
    expect(toPhtIso(null)).toBeNull();
  });
  it('addDaysToYmd', () => {
    expect(addDaysToYmd('2026-06-29', 1)).toBe('2026-06-30');
    expect(addDaysToYmd('2026-06-01', -1)).toBe('2026-05-31');
  });
});
