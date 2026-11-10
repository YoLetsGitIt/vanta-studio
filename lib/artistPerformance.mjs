// An artist's performance over a date range, from their completed bookings
// (GET /studio/me/artists/{id}/earnings). Dates are "YYYY-MM-DD" in local time.

const DAY = 86400000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = n => String(n).padStart(2, '0');
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d); };
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / DAY);
const mondayOf = key => addDays(key, -((fromKey(key).getDay() + 6) % 7));
const clientKey = name => String(name ?? '').trim().toLowerCase();
const shortDate = key => { const d = fromKey(key); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

function dated(entries) {
  return (entries ?? []).filter(e => e.chosen_time).map(e => {
    return { ...e, key: toKey(new Date(e.chosen_time)), sales: Number(e.gross) || 0 };
  });
}

function totals(list) {
  const sales = list.reduce((n, e) => n + e.sales, 0);
  return {
    sales,
    tattoos: list.length,
    avgTicket: list.length ? sales / list.length : 0,
    earnings: list.reduce((n, e) => n + (Number(e.artist_cut) || 0), 0),
  };
}

// Percentage change, or null when there's nothing to compare with.
const percent = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

// The period of the same length that ends the day before `start`.
export function rangeBefore(start, end) {
  const length = daysBetween(start, end) + 1;
  return { start: addDays(start, -length), end: addDays(start, -1) };
}

function buildTrend(list, start, end) {
  const days = daysBetween(start, end) + 1;
  const unit = days <= 31 ? 'day' : days <= 183 ? 'week' : 'month';
  const bucketOf = key => (unit === 'day' ? key : unit === 'week' ? mondayOf(key) : `${key.slice(0, 7)}-01`);
  const trend = [];
  const index = new Map();
  let at = bucketOf(start);
  while (at <= end && trend.length < 400) {
    const label = unit === 'month' ? MONTHS[fromKey(at).getMonth()] : shortDate(at < start ? start : at);
    index.set(at, trend.length);
    trend.push({ label, sales: 0, tattoos: 0 });
    if (unit === 'day') at = addDays(at, 1);
    else if (unit === 'week') at = addDays(at, 7);
    else { const d = fromKey(at); d.setMonth(d.getMonth() + 1); at = toKey(d); }
  }
  for (const e of list) {
    const bar = trend[index.get(bucketOf(e.key))];
    if (bar) { bar.sales += e.sales; bar.tattoos += 1; }
  }
  return { unit, trend };
}

export function artistPerformance(entries, start, end, { compare = true } = {}) {
  const all = dated(entries);
  const list = all.filter(e => e.key >= start && e.key <= end);
  const current = totals(list);

  let previous = null;
  let change = { sales: null, tattoos: null, avgTicket: null, earnings: null };
  if (compare) {
    const before = rangeBefore(start, end);
    previous = { ...totals(all.filter(e => e.key >= before.start && e.key <= before.end)), range: before };
    change = Object.fromEntries(Object.keys(change).map(k => [k, percent(current[k], previous[k])]));
  }

  const bySource = new Map();
  for (const e of list) {
    const s = bySource.get(e.source) ?? { source: e.source, count: 0, sales: 0 };
    s.count += 1;
    s.sales += e.sales;
    bySource.set(e.source, s);
  }
  const sources = [...bySource.values()]
    .map(s => ({ ...s, share: Math.round((s.count / list.length) * 100) }))
    .sort((a, b) => b.count - a.count || b.sales - a.sales);

  const weekdays = WEEKDAYS.map(label => ({ label, count: 0, sales: 0 }));
  for (const e of list) {
    const day = weekdays[(fromKey(e.key).getDay() + 6) % 7];
    day.count += 1;
    day.sales += e.sales;
  }
  // Only when one day is actually ahead.
  const topCount = Math.max(...weekdays.map(d => d.count));
  const leaders = weekdays.filter(d => d.count === topCount);
  const busiest = list.length && leaders.length === 1 ? leaders[0] : null;

  // Clients are matched by name, since a booking's client may have no account.
  const byClient = new Map();
  for (const e of list) {
    const c = byClient.get(clientKey(e.client_name)) ?? { name: String(e.client_name ?? '').trim(), sales: 0, visits: 0 };
    c.sales += e.sales;
    c.visits += 1;
    byClient.set(clientKey(e.client_name), c);
  }
  const visitsToDate = new Map();
  for (const e of all) if (e.key <= end) visitsToDate.set(clientKey(e.client_name), (visitsToDate.get(clientKey(e.client_name)) ?? 0) + 1);
  const returning = [...byClient.keys()].filter(k => visitsToDate.get(k) > 1).length;
  const top = [...byClient.values()].sort((a, b) => b.sales - a.sales || b.visits - a.visits).slice(0, 5);

  return { current, previous, change, ...buildTrend(list, start, end), sources, weekdays, busiest, clients: { unique: byClient.size, returning, top } };
}
