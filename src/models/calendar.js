class Calendar {
  constructor(opts = {}) {
    this.workStartHour = typeof opts.workStartHour === 'number' ? opts.workStartHour : 9;
    this.workEndHour = typeof opts.workEndHour === 'number' ? opts.workEndHour : 17;
    // store non-working days as strings 'YYYY-MM-DD'
    this.nonWorkingDays = new Set((opts.nonWorkingDays || []).map(d => Calendar.toDateKey(d)));
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
    if (this.nonWorkingDays.has(key)) return false;
    if (this.isWeekend(date)) return false;
    return true;
  }

  setToWorkStart(d) {
    const r = new Date(d);
    r.setUTCHours(this.workStartHour, 0, 0, 0);
    return r;
  }

  setToWorkEnd(d) {
    const r = new Date(d);
    r.setUTCHours(this.workEndHour, 0, 0, 0);
    return r;
  }

  adjustToWorkStart(date) {
    let d = new Date(date);
    // move forward to next working day start if necessary
    // if it's before work start, set to start
    while (!this.isWorkingDay(d)) {
      d.setDate(d.getDate() + 1);
      d = this.setToWorkStart(d);
    }
    const startOfDay = this.setToWorkStart(d);
    const endOfDay = this.setToWorkEnd(d);

    if (d < startOfDay) return startOfDay;
    if (d >= endOfDay) {
      // move to next day start
      d.setDate(d.getDate() + 1);
      d = this.setToWorkStart(d);
      while (!this.isWorkingDay(d)) d.setDate(d.getDate() + 1);
      return this.setToWorkStart(d);
    }
    return d;
  }

  addWorkingHours(startDate, hours) {
    let remaining = hours;
    let cursor = this.adjustToWorkStart(startDate);

    while (remaining > 0) {
      const endOfDay = this.setToWorkEnd(cursor);
      const available = (endOfDay - cursor) / (1000 * 60 * 60);
      if (available <= 0) {
        cursor.setDate(cursor.getDate() + 1);
        while (!this.isWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1);
        cursor = this.setToWorkStart(cursor);
        continue;
      }
      if (remaining <= available) {
        return new Date(cursor.getTime() + remaining * 60 * 60 * 1000);
      }
      remaining -= available;
      cursor.setDate(cursor.getDate() + 1);
      while (!this.isWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1);
      cursor = this.setToWorkStart(cursor);
    }
    return cursor;
  }

  workingHoursBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      throw new RangeError('End date must be valid and no earlier than start date');
    }

    let totalMilliseconds = 0;
    const day = new Date(start);
    day.setUTCHours(0, 0, 0, 0);

    while (day <= end) {
      const dayOfWeek = day.getUTCDay();
      const dateKey = Calendar.toDateKey(day);
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !this.nonWorkingDays.has(dateKey)) {
        const workStart = this.setToWorkStart(day).getTime();
        const workEnd = this.setToWorkEnd(day).getTime();
        const overlapStart = Math.max(start.getTime(), workStart);
        const overlapEnd = Math.min(end.getTime(), workEnd);
        totalMilliseconds += Math.max(0, overlapEnd - overlapStart);
      }
      day.setUTCDate(day.getUTCDate() + 1);
    }

    return Math.round((totalMilliseconds / 3600000) * 100) / 100;
  }

  addNonWorkingDay(date) {
    const key = Calendar.toDateKey(date);
    if (!key) return false;
    this.nonWorkingDays.add(key);
    return true;
  }

  removeNonWorkingDay(date) {
    const key = Calendar.toDateKey(date);
    if (!key) return false;
    return this.nonWorkingDays.delete(key);
  }

  getNonWorkingDays() {
    return Array.from(this.nonWorkingDays).sort();
  }

  toJSON() {
    return { workStartHour: this.workStartHour, workEndHour: this.workEndHour, nonWorkingDays: this.getNonWorkingDays() };
  }

  static fromObject(obj = {}) {
    return new Calendar({ workStartHour: obj.workStartHour, workEndHour: obj.workEndHour, nonWorkingDays: obj.nonWorkingDays || [] });
  }
}

export default Calendar;
