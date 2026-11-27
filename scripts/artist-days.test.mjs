import test from 'node:test';
import assert from 'node:assert/strict';
import { artistHoursOn, overlapSpans } from '../lib/artist-days.mjs';

const HERE = 'studio-here', ELSEWHERE = 'studio-elsewhere';
// Saturday here 10–6, Monday elsewhere 9–5, Tuesday with no studio set 11–7.
const schedule = [
  { day_of_week: 6, start_time: '10:00:00', end_time: '18:00:00', studio_id: HERE },
  { day_of_week: 1, start_time: '09:00:00', end_time: '17:00:00', studio_id: ELSEWHERE },
  { day_of_week: 2, start_time: '11:00', end_time: '19:00', studio_id: null },
];
// 2026-12-05 is a Saturday, 2026-11-30 a Monday, 2026-12-01 a Tuesday, 2026-12-03 a Thursday.

test('weekly hours at this studio', () => {
  assert.deepEqual(artistHoursOn(schedule, [], HERE, '2026-12-05'), [{ start_time: '10:00', end_time: '18:00' }]);
  assert.deepEqual(artistHoursOn(schedule, [], HERE, '2026-12-01'), [{ start_time: '11:00', end_time: '19:00' }], 'no studio set counts as here');
});

test('days at another studio or not working are empty', () => {
  assert.deepEqual(artistHoursOn(schedule, [], HERE, '2026-11-30'), []);
  assert.deepEqual(artistHoursOn(schedule, [], HERE, '2026-12-03'), []);
  assert.deepEqual(artistHoursOn(schedule, [], ELSEWHERE, '2026-11-30'), [{ start_time: '09:00', end_time: '17:00' }]);
});

test('a day off removes the hours', () => {
  const off = [{ date: '2026-12-05T00:00:00Z', is_blocked: true }];
  assert.deepEqual(artistHoursOn(schedule, off, HERE, '2026-12-05'), []);
  assert.deepEqual(artistHoursOn(schedule, off, HERE, '2026-12-12'), [{ start_time: '10:00', end_time: '18:00' }], 'only that date');
});

test('changed hours replace the weekly hours, at the override studio', () => {
  const changed = [{ date: '2026-12-05', is_blocked: false, start_time: '12:00', end_time: '16:00', studio_id: HERE }];
  assert.deepEqual(artistHoursOn(schedule, changed, HERE, '2026-12-05'), [{ start_time: '12:00', end_time: '16:00' }]);
  // An extra day here, on a day normally spent elsewhere.
  const extra = [{ date: '2026-11-30', is_blocked: false, start_time: '10:00:00', end_time: '15:00:00', studio_id: HERE }];
  assert.deepEqual(artistHoursOn(schedule, extra, HERE, '2026-11-30'), [{ start_time: '10:00', end_time: '15:00' }]);
  assert.deepEqual(artistHoursOn(schedule, extra, ELSEWHERE, '2026-11-30'), [], 'moved away from the usual studio');
  // A day added on a day off entirely.
  const thursday = [{ date: '2026-12-03', is_blocked: false, start_time: '09:00', end_time: '13:00', studio_id: HERE }];
  assert.deepEqual(artistHoursOn(schedule, thursday, HERE, '2026-12-03'), [{ start_time: '09:00', end_time: '13:00' }]);
});

test('without a studio, every working day counts', () => {
  assert.deepEqual(artistHoursOn(schedule, [], '', '2026-11-30'), [{ start_time: '09:00', end_time: '17:00' }]);
});

test('overlapSpans finds when both are free', () => {
  const artist = [{ start_time: '10:00', end_time: '18:00' }];
  const client = [{ start_time: '09:00', end_time: '12:00' }, { start_time: '16:00', end_time: '23:59' }];
  assert.deepEqual(overlapSpans(artist, client), [{ start: 600, end: 720 }, { start: 960, end: 1080 }]);
  assert.deepEqual(overlapSpans(artist, []), []);
});
