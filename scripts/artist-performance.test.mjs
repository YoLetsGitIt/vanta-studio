import test from 'node:test';
import assert from 'node:assert/strict';
import { artistPerformance, rangeBefore } from '../lib/artistPerformance.mjs';

const at = (date, client, gross, cut = gross / 2, source = 'studio') => ({ chosen_time: `${date}T12:00:00`, client_name: client, gross, artist_cut: cut, source });
const entries = [
  at('2026-11-02', 'Ann Lee', 400),            // Mon, this period
  at('2026-11-04', 'Bo Tran', 200, 100, 'walkin'), // Wed
  at('2026-11-04', 'ann lee ', 600),           // Wed, Ann's second visit (name matched loosely)
  at('2026-11-08', 'Cy Ng', 0),                // Sun, no price recorded
  at('2026-10-28', 'Bo Tran', 300),            // previous week
  at('2026-10-29', 'Dee Fox', 300),            // previous week
  at('2026-09-01', 'Old Client', 900),         // long ago
];

test('totals only count bookings inside the range', () => {
  const p = artistPerformance(entries, '2026-11-02', '2026-11-08');
  assert.equal(p.current.sales, 1200);
  assert.equal(p.current.tattoos, 4);
  assert.equal(p.current.avgTicket, 300);
  assert.equal(p.current.earnings, 600);
});

test('the comparison is the same length immediately before', () => {
  assert.deepEqual(rangeBefore('2026-11-02', '2026-11-08'), { start: '2026-10-26', end: '2026-11-01' });
  const p = artistPerformance(entries, '2026-11-02', '2026-11-08');
  assert.equal(p.previous.sales, 600);
  assert.equal(p.previous.tattoos, 2);
  assert.equal(p.change.sales, 100);
  assert.equal(p.change.tattoos, 100);
  assert.equal(p.change.avgTicket, 0);
});

test('a change from nothing has no percentage; no comparison for an open-ended range', () => {
  const fresh = artistPerformance([at('2026-11-03', 'A', 100)], '2026-11-02', '2026-11-08');
  assert.equal(fresh.change.sales, null);
  const all = artistPerformance(entries, '2026-09-01', '2026-11-08', { compare: false });
  assert.equal(all.previous, null);
});

test('the trend fills empty periods and picks day, week or month by length', () => {
  const week = artistPerformance(entries, '2026-11-02', '2026-11-08');
  assert.equal(week.unit, 'day');
  assert.equal(week.trend.length, 7);
  assert.deepEqual(week.trend.map(t => t.sales), [400, 0, 800, 0, 0, 0, 0]);

  const quarter = artistPerformance(entries, '2026-09-01', '2026-11-08', { compare: false });
  assert.equal(quarter.unit, 'week');
  assert.equal(quarter.trend[0].sales, 900);
  assert.equal(quarter.trend.reduce((n, t) => n + t.sales, 0), 2700);

  const year = artistPerformance(entries, '2026-01-01', '2026-11-08', { compare: false });
  assert.equal(year.unit, 'month');
  assert.equal(year.trend.length, 11);
  assert.equal(year.trend[10].sales, 1200);
});

test('sources are ranked with their share of tattoos', () => {
  const p = artistPerformance(entries, '2026-11-02', '2026-11-08');
  assert.deepEqual(p.sources.map(s => [s.source, s.count, s.share]), [['studio', 3, 75], ['walkin', 1, 25]]);
});

test('weekdays run Monday to Sunday', () => {
  const p = artistPerformance(entries, '2026-11-02', '2026-11-08');
  assert.deepEqual(p.weekdays.map(d => d.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(p.weekdays.map(d => d.count), [1, 0, 2, 0, 0, 0, 1]);
  assert.equal(p.busiest.label, 'Wed');
});

test('no busiest day is named when the top days tie', () => {
  const p = artistPerformance([at('2026-11-02', 'A', 100), at('2026-11-03', 'B', 100)], '2026-11-02', '2026-11-08');
  assert.equal(p.busiest, null);
});

test('clients: top spenders, and who has come back', () => {
  const p = artistPerformance(entries, '2026-11-02', '2026-11-08');
  assert.equal(p.clients.unique, 3);
  // Ann twice this period; Bo also came in the previous week. Cy is new.
  assert.equal(p.clients.returning, 2);
  assert.deepEqual(p.clients.top[0], { name: 'Ann Lee', sales: 1000, visits: 2 });
  assert.equal(p.clients.top.length, 3);
});

test('nothing in the range is an empty result, not an error', () => {
  const p = artistPerformance(entries, '2026-06-01', '2026-06-07');
  assert.equal(p.current.tattoos, 0);
  assert.equal(p.current.avgTicket, 0);
  assert.equal(p.busiest, null);
  assert.deepEqual(p.sources, []);
});
