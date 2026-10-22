import { describe, expect, it } from 'vitest';
import Calendar from './calendar.js';

describe('Calendar.workingHoursBetween', () => {
  it('counts working hours across a weekend', () => {
    const calendar = new Calendar();

    expect(calendar.workingHoursBetween(
      '2026-06-05T15:00:00.000Z',
      '2026-06-08T11:00:00.000Z'
    )).toBe(4);
  });

  it('skips configured non-working days and counts partial hours', () => {
    const calendar = new Calendar({ nonWorkingDays: ['2026-06-10'] });

    expect(calendar.workingHoursBetween(
      '2026-06-09T16:00:00.000Z',
      '2026-06-11T10:30:00.000Z'
    )).toBe(2.5);
  });

  it('rejects an end date earlier than the start date', () => {
    const calendar = new Calendar();

    expect(() => calendar.workingHoursBetween(
      '2026-06-08T11:00:00.000Z',
      '2026-06-08T10:00:00.000Z'
    )).toThrow(RangeError);
  });
});
