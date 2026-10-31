// Weekly availability windows: { day_of_week: 0-6 (0 = Sunday), start_time: 'HH:mm', end_time: 'HH:mm' }.

// Monday first, the way studios read a week.
export const WEEK_DAYS = [
  { dow: 1, short: 'Mon', long: 'Monday' },
  { dow: 2, short: 'Tue', long: 'Tuesday' },
  { dow: 3, short: 'Wed', long: 'Wednesday' },
  { dow: 4, short: 'Thu', long: 'Thursday' },
  { dow: 5, short: 'Fri', long: 'Friday' },
  { dow: 6, short: 'Sat', long: 'Saturday' },
  { dow: 0, short: 'Sun', long: 'Sunday' },
];

// Half-hour steps from 6am to midnight.
export const TIME_OPTIONS = Array.from({ length: 37 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  return mins === 24 * 60 ? '23:59' : `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

export function formatTime(hhmm) {
  if (!hhmm) return '';
  if (hhmm === '23:59') return 'midnight';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

// [{ day: 'Tuesday', times: '10am – 5pm, 7pm – 9pm' }, …] in Monday-first order.
export function describeAvailability(windows) {
  if (!Array.isArray(windows) || windows.length === 0) return [];
  return WEEK_DAYS
    .map(({ dow, long }) => {
      const times = windows
        .filter(w => w.day_of_week === dow)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map(w => `${formatTime(w.start_time)} – ${formatTime(w.end_time)}`);
      return times.length ? { day: long, times: times.join(', ') } : null;
    })
    .filter(Boolean);
}
