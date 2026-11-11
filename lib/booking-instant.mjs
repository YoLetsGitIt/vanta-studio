// Instant booking on the artist's booking page: the client picks an appointment type
// and one of the artist's open times, fills in the form and pays the deposit to lock
// the time in. Times are shown in the artist's time zone.

export function formatLength(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  const hours = `${h} ${h === 1 ? 'hour' : 'hours'}`;
  return rest ? `${hours} ${rest} min` : hours;
}

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

// "Mon 17 Nov" (no commas, whatever the locale's usual punctuation).
function dayLabel(when, timeZone, locale) {
  const parts = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).formatToParts(when);
  const part = type => parts.find(p => p.type === type)?.value || '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}

// "Mon 17 Nov" for a YYYY-MM-DD date.
export function formatDay(date, locale = 'en-AU') {
  const [y, m, d] = String(date).split('-').map(Number);
  return dayLabel(new Date(Date.UTC(y, m - 1, d)), 'UTC', locale);
}

// "10:30 am" for an RFC3339 time, in the artist's time zone.
export function formatTime(iso, timeZone, locale = 'en-AU') {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso)).toLowerCase();
}

// "Mon 17 Nov, 10:30 am" for an RFC3339 time, in the artist's time zone.
export function formatWhen(iso, timeZone, locale = 'en-AU') {
  return `${dayLabel(new Date(iso), timeZone, locale)}, ${formatTime(iso, timeZone, locale)}`;
}

// The client's time zone differs from the artist's: say which one times are in.
export function zoneNote(timeZone, viewerZone) {
  if (!timeZone || !viewerZone || timeZone === viewerZone) return '';
  return `Times are in ${timeZone.split('/').pop().replaceAll('_', ' ')} time.`;
}

// YYYY-MM-DD, `offset` days after `date`.
export function addDays(date, offset) {
  const [y, m, d] = String(date).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + offset));
  return t.toISOString().slice(0, 10);
}

// Today's date in the artist's time zone.
export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// The page to come back to from payment: this page, without a previous payment's result.
export function returnURL(href) {
  const url = new URL(href);
  for (const key of ['instant', 'b', 't']) url.searchParams.delete(key);
  return url.toString();
}

// The result of a payment the client just came back from, or null.
export function paymentReturn(searchParams) {
  const result = searchParams.get('instant');
  const booking = searchParams.get('b');
  const token = searchParams.get('t');
  if (!['paid', 'cancelled'].includes(result) || !booking || !token) return null;
  return { result, booking, token };
}
