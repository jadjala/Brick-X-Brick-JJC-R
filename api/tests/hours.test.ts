import { describe, it, expect } from 'vitest';
import { calculateHours, calculateOvertime, formatHours } from '../src/lib/hours.js';

const d = (s: string) => new Date(s);

describe('calculateHours (SPEC §3)', () => {
  it('rounds to nearest minute then expresses as decimal hours', () => {
    // 08:02:14 → 17:31:00 = 9h28m46s → round 9h29m → 9.48
    expect(calculateHours(d('2026-06-28T08:02:14+08:00'), d('2026-06-28T17:31:00+08:00'))).toBe(9.48);
  });
  it('exact 9 hours', () => {
    expect(calculateHours(d('2026-06-28T08:00:00+08:00'), d('2026-06-28T17:00:00+08:00'))).toBe(9);
  });
  it('null when clock-out missing (partial day)', () => {
    expect(calculateHours(d('2026-06-28T08:00:00+08:00'), null)).toBeNull();
  });
  it('null for non-positive duration', () => {
    expect(calculateHours(d('2026-06-28T17:00:00+08:00'), d('2026-06-28T08:00:00+08:00'))).toBeNull();
  });
});

describe('calculateOvertime', () => {
  it('max(0, hours - standard)', () => {
    expect(calculateOvertime(9.48, 8)).toBe(1.48);
    expect(calculateOvertime(7, 8)).toBe(0);
    expect(calculateOvertime(9, 9)).toBe(0);
  });
  it('null-safe', () => {
    expect(calculateOvertime(null, 8)).toBeNull();
  });
});

describe('formatHours', () => {
  it('formats "Hh Mm"', () => {
    expect(formatHours(8.5)).toBe('8h 30m');
    expect(formatHours(9.48)).toBe('9h 29m');
    expect(formatHours(8)).toBe('8h 0m');
  });
  it('em dash for null', () => {
    expect(formatHours(null)).toBe('—');
  });
});
