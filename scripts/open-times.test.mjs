import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, clearOpenTimes, lastMonth, loadMonth, monthGrid, monthLabel, weekOf } from '../lib/open-times.mjs';

test('monthGrid starts weeks on Monday and pads with blanks', () => {
  const weeks = monthGrid('2026-11'); // 1 Nov 2026 is a Sunday
  assert.equal(weeks[0].filter(Boolean).length, 1);
  assert.equal(weeks[0][6], '2026-11-01');
  assert.ok(weeks.every(w => w.length === 7));
  assert.equal(weeks.flat().filter(Boolean).length, 30);
});

test('weekOf gives Monday to Sunday, across months', () => {
  assert.deepEqual(weekOf('2026-12-02'), ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
  assert.equal(weekOf('2026-11-30')[0], '2026-11-30');
});

test('month arithmetic and labels', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(monthLabel('2026-11'), 'November 2026');
  assert.equal(lastMonth('2026-11-16'), '2027-03');
});

test('loadMonth asks once per month, from today in the current month', async () => {
  clearOpenTimes();
  const urls = [];
  const fetchFn = async url => { urls.push(url); return { ok: true, json: async () => ({ days: [{ date: '2026-11-20', slots: ['2026-11-20T10:00:00+11:00'] }] }) }; };
  const args = { backend: 'https://b', artistId: 'a', place: 's1', typeId: 't', today: '2026-11-16', fetchFn };
  const [one, two] = await Promise.all([loadMonth({ ...args, month: '2026-11' }), loadMonth({ ...args, month: '2026-11' })]);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /date=2026-11-16&days=15&studio_id=s1/);
  assert.deepEqual(one, two);
  assert.deepEqual(one['2026-11-20'], ['2026-11-20T10:00:00+11:00']);
  await loadMonth({ ...args, month: '2026-12' });
  assert.match(urls[1], /date=2026-12-01&days=31/);
  // Past the horizon: nothing to ask.
  assert.deepEqual(await loadMonth({ ...args, month: '2027-05' }), {});
  assert.equal(urls.length, 2);
});

test('a failed month is asked again', async () => {
  clearOpenTimes();
  let calls = 0;
  const fetchFn = async () => { calls++; return calls === 1 ? { ok: false, json: async () => ({ error: 'down' }) } : { ok: true, json: async () => ({ days: [] }) }; };
  const args = { backend: 'https://b', artistId: 'a', place: '', typeId: 't', today: '2026-11-16', month: '2026-11', fetchFn };
  await assert.rejects(loadMonth(args), /down/);
  assert.deepEqual(await loadMonth(args), {});
  assert.equal(calls, 2);
});
