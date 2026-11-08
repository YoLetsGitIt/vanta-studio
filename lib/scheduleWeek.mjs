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

// Hours the week grid shows: the whole day, midnight to midnight, so every week lines
// up and nothing is clipped. The view opens scrolled to the working day.
export function weekHourRange() {
  return { startHour: 0, endHour: 24 };
}

// Side-by-side lanes for overlapping bookings in one day, like a calendar app.
// Bookings that touch (one ends as the next starts) share a lane.
export function layoutDayLanes(bookings) {
  const sorted = [...bookings].sort((a, b) => a.displayStart - b.displayStart || b.displayEnd - a.displayEnd);
  const placed = [];
  let cluster = [], laneEnds = [], clusterEnd = -Infinity, clusterId = 0;
  const close = () => { for (const item of cluster) item.lanes = laneEnds.length; cluster = []; laneEnds = []; clusterId += 1; };
  for (const booking of sorted) {
    const start = booking.displayStart.getTime(), end = booking.displayEnd.getTime();
    if (start >= clusterEnd) close();
    let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    const item = { ...booking, lane, lanes: 1, cluster: clusterId };
    cluster.push(item); placed.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  close();
  return placed;
}

// At most `max` bookings side by side. In a busier cluster the first max - 1 lanes show
// as usual and everything else folds into "+N" chips in the last lane: one chip per run
// of folded bookings that overlap each other, spanning their times.
export function capDayLanes(placed, max = 3) {
  const shown = [], overflow = [];
  const clusters = new Map();
  for (const item of placed) {
    if (!clusters.has(item.cluster)) clusters.set(item.cluster, []);
    clusters.get(item.cluster).push(item);
  }
  for (const items of clusters.values()) {
    if (items[0].lanes <= max) { shown.push(...items); continue; }
    const hidden = [];
    for (const item of items) {
      if (item.lane < max - 1) shown.push({ ...item, lanes: max });
      else hidden.push(item);
    }
    hidden.sort((a, b) => a.displayStart - b.displayStart);
    let chip = null;
    for (const item of hidden) {
      if (chip && item.displayStart < chip.displayEnd) {
        chip.bookings.push(item);
        if (item.displayEnd > chip.displayEnd) chip.displayEnd = item.displayEnd;
      } else {
        chip = { bookings: [item], displayStart: item.displayStart, displayEnd: item.displayEnd, lane: max - 1, lanes: max };
        overflow.push(chip);
      }
    }
  }
  return { shown, overflow };
}
