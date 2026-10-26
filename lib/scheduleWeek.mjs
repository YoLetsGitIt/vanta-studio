// Local calendar dates, rather than 24-hour arithmetic, keep weeks intact at DST.
export function weekStartFor(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function calendarDayAfter(date, offset) {
  const day = new Date(date);
  day.setDate(day.getDate() + offset);
  return day;
}

export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function weekDates(date) {
  const start = weekStartFor(date);
  return Array.from({ length: 7 }, (_, index) => calendarDayAfter(start, index));
}

export function weekRangeLabel(date, locale = 'en-AU') {
  const start = weekStartFor(date), end = calendarDayAfter(start, 6);
  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short',
    ...(start.getFullYear() !== end.getFullYear() ? { year: 'numeric' } : {}),
  });
  return format.formatRange ? format.formatRange(start, end) : `${format.format(start)} – ${format.format(end)}`;
}

// Include every appointment, and carry overnight bookings into the next day.
// The API's date field is UTC; chosenTime is the source for the displayed day.
export function weekSchedule(entries, date) {
  return weekDates(date).map(day => {
    const next = calendarDayAfter(day, 1);
    const bookings = [];
    for (const entry of entries) {
      const start = new Date(entry.chosenTime);
      if (!Number.isFinite(start.getTime())) continue;
      const duration = Number(entry.durationMins) > 0 ? Number(entry.durationMins) : 60;
      const end = new Date(start.getTime() + duration * 60000);
      if (start >= next || end <= day) continue;
      bookings.push({
        entry, start, end,
        displayStart: new Date(Math.max(start.getTime(), day.getTime())),
        displayEnd: new Date(Math.min(end.getTime(), next.getTime())),
        continuesFrom: start < day,
        continuesInto: end > next,
      });
    }
    bookings.sort((a, b) => a.displayStart - b.displayStart || a.start - b.start || String(a.entry.clientName).localeCompare(String(b.entry.clientName)));
    return { date: day, key: localDateKey(day), bookings };
  });
}
