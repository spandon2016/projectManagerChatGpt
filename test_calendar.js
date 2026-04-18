// Quick test to verify non-working days are being treated as weekends
// This is a CommonJS version to test the Calendar logic

class Calendar {
  constructor(opts = {}) {
    this.workStartHour = typeof opts.workStartHour === 'number' ? opts.workStartHour : 9;
    this.workEndHour = typeof opts.workEndHour === 'number' ? opts.workEndHour : 17;
    // store non-working days as strings 'YYYY-MM-DD'
    this.nonWorkingDays = new Set((opts.nonWorkingDays || []).map(d => Calendar.toDateKey(d)));
    console.log('Calendar initialized with non-working days:', Array.from(this.nonWorkingDays));
  }

  static toDateKey(d) {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  isWeekend(d) {
    const date = new Date(d);
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  isWorkingDay(d) {
    const date = new Date(d);
    const key = Calendar.toDateKey(date);
    if (!key) return false;
    if (this.nonWorkingDays.has(key)) {
      console.log(`  ${key} is a non-working day`);
      return false;
    }
    if (this.isWeekend(date)) {
      console.log(`  ${key} is a weekend`);
      return false;
    }
    return true;
  }

  setToWorkStart(d) {
    const r = new Date(d);
    console.log(`setToWorkStart input: ${d.toISOString()}, workStartHour: ${this.workStartHour}`);
    r.setUTCHours(this.workStartHour, 0, 0, 0);
    console.log(`setToWorkStart output: ${r.toISOString()}`);
    return r;
  }

  setToWorkEnd(d) {
    const r = new Date(d);
    console.log(`setToWorkEnd input: ${d.toISOString()}, workEndHour: ${this.workEndHour}`);
    r.setUTCHours(this.workEndHour, 0, 0, 0);
    console.log(`setToWorkEnd output: ${r.toISOString()}`);
    return r;
  }

  adjustToWorkStart(date) {
    let d = new Date(date);
    console.log(`  adjustToWorkStart input: ${d.toISOString()}`);
    // move forward to next working day start if necessary
    while (!this.isWorkingDay(d)) {
      d.setDate(d.getDate() + 1);
      d = this.setToWorkStart(d);
    }
    const startOfDay = this.setToWorkStart(d);
    const endOfDay = this.setToWorkEnd(d);
    console.log(`  d=${d.toISOString()}, startOfDay=${startOfDay.toISOString()}, endOfDay=${endOfDay.toISOString()}`);

    if (d < startOfDay) {
      console.log(`  d < startOfDay, returning ${startOfDay.toISOString()}`);
      return startOfDay;
    }
    if (d >= endOfDay) {
      console.log(`  d >= endOfDay, moving to next day`);
      // move to next day start
      d.setDate(d.getDate() + 1);
      d = this.setToWorkStart(d);
      while (!this.isWorkingDay(d)) d.setDate(d.getDate() + 1);
      console.log(`  adjusted to ${this.setToWorkStart(d).toISOString()}`);
      return this.setToWorkStart(d);
    }
    console.log(`  returning d: ${d.toISOString()}`);
    return d;
  }

  addWorkingHours(startDate, hours) {
    console.log(`\nAdding ${hours} hours from ${startDate.toISOString()}`);
    let remaining = hours;
    let cursor = this.adjustToWorkStart(startDate);
    console.log(`Cursor adjusted to: ${cursor.toISOString()}`);

    while (remaining > 0) {
      const endOfDay = this.setToWorkEnd(cursor);
      const available = (endOfDay - cursor) / (1000 * 60 * 60);
      console.log(`Cursor: ${cursor.toISOString()}, Available today: ${available}h, Remaining: ${remaining}h`);
      
      if (available <= 0) {
        console.log('No time available today, moving to next working day');
        cursor.setDate(cursor.getDate() + 1);
        while (!this.isWorkingDay(cursor)) {
          console.log(`Skipping ${Calendar.toDateKey(cursor)}`);
          cursor.setDate(cursor.getDate() + 1);
        }
        cursor = this.setToWorkStart(cursor);
        console.log(`Moved to next working day: ${cursor.toISOString()}`);
        continue;
      }
      
      if (remaining <= available) {
        const result = new Date(cursor.getTime() + remaining * 60 * 60 * 1000);
        console.log(`Final result: ${result.toISOString()}`);
        return result;
      }
      
      remaining -= available;
      console.log(`Consumed ${available} hours, moving to next day. Remaining: ${remaining}h`);
      cursor.setDate(cursor.getDate() + 1);
      while (!this.isWorkingDay(cursor)) {
        console.log(`Skipping ${Calendar.toDateKey(cursor)}`);
        cursor.setDate(cursor.getDate() + 1);
      }
      cursor = this.setToWorkStart(cursor);
    }
    return cursor;
  }
}

// Test case: Mon 4/21 is a working day, Tue 4/22 is a non-working day, Wed 4/23 is a working day
// All 9 AM to 5 PM = 8 hours per day

const nonWorkingDates = ['2026-04-22']; // Tuesday
const cal = new Calendar({ 
  workStartHour: 9, 
  workEndHour: 17,
  nonWorkingDays: nonWorkingDates 
});

// Start Mon 4/21 9 AM UTC, add 16 hours
// Expected: 8 hours Mon, 8 hours Wed (skip Tue) = Wed 5 PM
const startDate = new Date('2026-04-21T09:00:00Z');
const result = cal.addWorkingHours(startDate, 16);

console.log('\n=== TEST RESULT ===');
console.log(`Start: ${startDate.toISOString()} (${startDate.toUTCString()})`);
console.log(`Add: 16 hours`);
console.log(`Non-working day: ${nonWorkingDates[0]} (Tuesday)`);
console.log(`Result: ${result.toISOString()} (${result.toUTCString()})`);
console.log(`Expected: 2026-04-23T17:00:00.000Z (Wed 5 PM UTC)`);
console.log(`Match: ${result.toISOString() === '2026-04-23T17:00:00.000Z' ? '✓ PASS' : '✗ FAIL'}`);
