// The artist's open times for instant booking, a month at a time. Months are fetched
// once and kept for the visit, so moving between the month and week views, or back
// to an earlier step, doesn't wait again. The next month is fetched ahead.

// How far ahead clients can book (the server's horizon is 120 days).
export const HORIZON_DAYS = 120;

// 'YYYY-MM' of a YYYY-MM-DD date.
export function monthOf(date) {
  return String(date).slice(0, 7);
}

// 'YYYY-MM' `offset` months after `month`.
export function addMonths(month, offset) {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + offset, 1));
  return t.toISOString().slice(0, 7);
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// 0 = Monday … 6 = Sunday.
function mondayIndex(date) {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function plusDays(date, offset) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

// The month as weeks of 7 (Monday first); days outside the month are null.
export function monthGrid(month) {
  const first = `${month}-01`;
  const cells = Array(mondayIndex(first)).fill(null);
  for (let d = 1; d <= daysInMonth(month); d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// The Monday-to-Sunday week holding `date`.
export function weekOf(date) {
  const monday = plusDays(date, -mondayIndex(date));
  return Array.from({ length: 7 }, (_, i) => plusDays(monday, i));
}

// "November 2026".
export function monthLabel(month, locale = 'en-AU') {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// The last month a client can book in.
export function lastMonth(today) {
  return monthOf(plusDays(today, HORIZON_DAYS));
}

const cache = new Map();

function cacheKey({ artistId, place, typeId, month }) {
  return [artistId, place || '', typeId, month].join('|');
}

// The open times in a month: { 'YYYY-MM-DD': [RFC3339 start, …] }. Days before today
// are left out. Shared by every caller asking for the same month.
export function loadMonth({ backend, artistId, place, typeId, month, today, fetchFn = fetch }) {
  const key = cacheKey({ artistId, place, typeId, month });
  if (cache.has(key)) return cache.get(key);
  const start = monthOf(today) === month ? today : `${month}-01`;
  const days = daysInMonth(month) - Number(start.slice(8)) + 1;
  const placeParam = place ? `&studio_id=${encodeURIComponent(place)}` : '';
  const loading = (month < monthOf(today) || month > lastMonth(today)
    ? Promise.resolve({})
    : fetchFn(`${backend}/artists/${artistId}/open-times?type_id=${typeId}&date=${start}&days=${days}${placeParam}`, { cache: 'no-store' })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Times could not be loaded. Please try again.');
        const out = {};
        for (const d of data.days || []) out[d.date] = d.slots || [];
        return out;
      }))
    .catch(err => { cache.delete(key); throw err; });
  cache.set(key, loading);
  return loading;
}

// Fetches a month ahead of time; failures are ignored (it's fetched again when shown).
export function prefetchMonth(args) {
  loadMonth(args).catch(() => {});
}

// Forget every month: after the client's booking took a time, for instance.
export function clearOpenTimes() {
  cache.clear();
}

// The place times are asked for: the studio, 'personal', or '' (older servers pick).
export function timesPlace(info) {
  return info?.studio_id || (info?.places ? 'personal' : '');
}
