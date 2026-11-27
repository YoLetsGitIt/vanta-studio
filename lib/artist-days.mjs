// An artist's working hours on a given date at a studio, by the same rules the backend
// uses for open times (booking_availability.go): the weekly schedule, then that date's
// override (a day off clears it; changed hours replace it and can move the day to another
// studio), then the day only counts if it's at this studio.
//
// schedule:  [{ day_of_week, start_time, end_time, studio_id }] from GET /artists/{id}/work-schedule
// overrides: [{ date, is_blocked, start_time, end_time, studio_id }] from the same call with from/to
// Returns [{ start_time: 'HH:MM', end_time: 'HH:MM' }] (empty when the artist isn't working here).

const hhmm = value => String(value ?? '').slice(0, 5);
const toMinutes = value => { const [h, m] = hhmm(value).split(':').map(Number); return h * 60 + (m || 0); };
const endMinutes = value => (hhmm(value) === '23:59' ? 1440 : toMinutes(value));

export function artistHoursOn(schedule = [], overrides = [], studioId = '', date = '') {
  const dow = new Date(`${date}T00:00:00`).getDay();
  const weekly = schedule.find(row => row.day_of_week === dow);
  let hours = weekly ? { start_time: hhmm(weekly.start_time), end_time: hhmm(weekly.end_time) } : null;
  let overrideStudio = null;
  const override = overrides.find(row => String(row.date ?? '').slice(0, 10) === date);
  if (override?.is_blocked) {
    hours = null;
  } else if (override?.start_time && override?.end_time) {
    hours = { start_time: hhmm(override.start_time), end_time: hhmm(override.end_time) };
    overrideStudio = override.studio_id ?? null;
  }
  if (!hours) return [];
  if (studioId) {
    const at = overrideStudio ?? weekly?.studio_id ?? null;
    if (at && String(at) !== String(studioId)) return [];
  }
  return [hours];
}

// Times inside both lists, in minutes from midnight: [{ start, end }].
export function overlapSpans(a = [], b = []) {
  const spans = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(toMinutes(x.start_time), toMinutes(y.start_time));
      const end = Math.min(endMinutes(x.end_time), endMinutes(y.end_time));
      if (end > start) spans.push({ start, end });
    }
  }
  return spans.sort((p, q) => p.start - q.start);
}
