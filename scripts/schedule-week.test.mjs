import assert from 'node:assert/strict';
import test from 'node:test';
import { weekDates, weekSchedule, weekRangeLabel, localDateKey, calendarDayAfter } from '../lib/scheduleWeek.mjs';

process.env.TZ = 'Australia/Melbourne';

test('Monday–Sunday weeks cross month and year boundaries correctly', () => {
  assert.deepEqual(weekDates(new Date('2026-11-01T12:00:00+11:00')).map(localDateKey), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(localDateKey(weekDates(new Date('2027-01-03T12:00:00+11:00'))[0]), '2026-12-28');
  assert.match(weekRangeLabel(new Date('2027-01-03T12:00:00+11:00')), /2026/);
  assert.match(weekRangeLabel(new Date('2027-01-03T12:00:00+11:00')), /2027/);
});

test('UTC date fields cannot move a local Monday appointment into Sunday', () => {
  const week = weekSchedule([{ bookingId: 'early', chosenTime: '2026-10-25T21:30:00Z', date: '2026-10-25', durationMins: 60 }], new Date('2026-10-26T12:00:00+11:00'));
  assert.equal(week[0].bookings[0].entry.bookingId, 'early');
  assert.equal(week[0].bookings[0].displayStart.getHours(), 8);
});

test('all bookings remain visible, including simultaneous and after-hours appointments', () => {
  const entries = Array.from({ length: 8 }, (_, index) => ({ bookingId: `booking-${index}`, chosenTime: `2026-10-26T${index < 6 ? '10' : '22'}:00:00+11:00`, durationMins: 60 }));
  const monday = weekSchedule(entries, new Date('2026-10-26T12:00:00+11:00'))[0];
  assert.equal(monday.bookings.length, 8);
  assert.equal(new Set(monday.bookings.map(({ entry }) => entry.bookingId)).size, 8);
  assert.equal(monday.bookings.at(-1).start.getHours(), 22);
});

test('overnight bookings carry across week boundaries without including bookings ending at midnight', () => {
  const week = weekSchedule([
    { bookingId: 'carry', chosenTime: '2026-10-25T23:00:00+11:00', durationMins: 180 },
    { bookingId: 'ended', chosenTime: '2026-10-25T23:00:00+11:00', durationMins: 60 },
    { bookingId: 'overnight', chosenTime: '2026-10-26T23:00:00+11:00', durationMins: 180 },
    { bookingId: 'invalid', chosenTime: 'invalid' },
  ], new Date('2026-10-26T12:00:00+11:00'));
  assert.deepEqual(week[0].bookings.map(({ entry }) => entry.bookingId), ['carry', 'overnight']);
  assert.equal(week[0].bookings[0].continuesFrom, true);
  assert.equal(week[0].bookings[1].continuesInto, true);
  assert.equal(week[1].bookings[0].displayEnd.getHours(), 2);
});

test('calendar arithmetic and overnight durations survive daylight saving', () => {
  const sunday = new Date('2026-10-04T00:00:00+10:00');
  assert.equal((calendarDayAfter(sunday, 1) - sunday) / 3600000, 23);
  const week = weekSchedule([{ bookingId: 'dst', chosenTime: '2026-10-03T23:00:00+10:00', durationMins: 240 }], sunday);
  assert.equal(week[6].key, '2026-10-04');
  assert.equal(week[6].bookings[0].displayEnd.getHours(), 4);
});

test('time grid always shows the whole day, midnight to midnight', async () => {
  const { weekHourRange } = await import('../lib/scheduleWeek.mjs');
  const date = new Date('2026-10-26T12:00:00+11:00');
  assert.deepEqual(weekHourRange(weekSchedule([], date)), { startHour: 0, endHour: 24 });
  const busy = weekSchedule([
    { bookingId: 'early', chosenTime: '2026-10-27T06:30:00+11:00', durationMins: 60 },
    { bookingId: 'night', chosenTime: '2026-10-28T23:00:00+11:00', durationMins: 180 },
  ], date);
  assert.deepEqual(weekHourRange(busy), { startHour: 0, endHour: 24 });
});

test('overlapping bookings get side-by-side lanes; back-to-back bookings stay full width', async () => {
  const { layoutDayLanes } = await import('../lib/scheduleWeek.mjs');
  const at = (id, time, durationMins) => ({ bookingId: id, chosenTime: `2026-10-26T${time}:00+11:00`, durationMins });
  const [monday] = weekSchedule([at('a', '10:00', 120), at('b', '11:00', 60), at('c', '12:00', 60), at('d', '15:00', 60)], new Date('2026-10-26T12:00:00+11:00'));
  const lanes = Object.fromEntries(layoutDayLanes(monday.bookings).map(item => [item.entry.bookingId, [item.lane, item.lanes]]));
  assert.deepEqual(lanes.a, [0, 2]);
  assert.deepEqual(lanes.b, [1, 2]);
  assert.deepEqual(lanes.c, [0, 1], 'c starts as a and b end, so it overlaps nothing and is full width');
  assert.deepEqual(lanes.d, [0, 1], 'a separate booking later in the day is full width');
});

test('three or more at once become one full-width group card; one or two show as bookings', async () => {
  const { layoutDayLanes, groupDayLanes } = await import('../lib/scheduleWeek.mjs');
  const at = (id, time, durationMins) => ({ bookingId: id, chosenTime: `2026-10-26T${time}:00+11:00`, durationMins });
  const day = bookings => weekSchedule(bookings, new Date('2026-10-26T12:00:00+11:00'))[0].bookings;
  const ids = items => items.map(item => item.entry.bookingId);

  // Two at once: side by side, no group.
  const two = groupDayLanes(layoutDayLanes(day([at('a', '10:00', 60), at('b', '10:00', 60)])));
  assert.deepEqual(two.groups, []);
  assert.deepEqual(two.shown.map(item => [item.lane, item.lanes]), [[0, 2], [1, 2]]);

  // Six overlapping, plus a later booking on its own (full width, as usual).
  const six = groupDayLanes(layoutDayLanes(day([
    at('a', '10:00', 240), at('b', '10:00', 120), at('c', '10:30', 60), at('d', '11:00', 60), at('e', '11:00', 120), at('f', '11:30', 30),
    at('g', '16:00', 60),
  ])));
  assert.deepEqual(six.shown.map(item => [item.entry.bookingId, item.lane, item.lanes]), [['g', 0, 1]]);
  assert.equal(six.groups.length, 1);
  const group = six.groups[0];
  // Every booking in it, in start order (same start: left to right), spanning their times.
  const lane = Object.fromEntries(group.bookings.map(item => [item.entry.bookingId, item.lane]));
  assert.deepEqual(ids(group.bookings), ['a', 'b', 'c', ...(lane.d < lane.e ? ['d', 'e'] : ['e', 'd']), 'f']);
  assert.equal(group.displayStart.getTime(), new Date('2026-10-26T10:00:00+11:00').getTime());
  assert.equal(group.displayEnd.getTime(), new Date('2026-10-26T14:00:00+11:00').getTime());
  // Each keeps its lane, for the thin bars that show when each one runs.
  assert.ok(group.lanes >= 3 && group.bookings.every(item => item.lane < group.lanes));

  // Three at once is already a group.
  const three = groupDayLanes(layoutDayLanes(day([at('a', '10:00', 60), at('b', '10:00', 60), at('c', '10:00', 60)])));
  assert.deepEqual([three.shown.length, three.groups.map(g => g.bookings.length)], [0, [3]]);
});

test('a group card lists each booking as a row at its start time, stacked when they collide', async () => {
  const { stackGroupRows } = await import('../lib/scheduleWeek.mjs');
  // Card 200px tall, rows 20px. Offsets are where each booking starts (0 = top, 1 = bottom).
  const one = stackGroupRows([0, 0, 0.5], 200, 20);
  assert.deepEqual(one.rows.map(r => r.top), [0, 20, 100], 'two at the top stack; the later one sits at its time');
  assert.equal(one.hidden, 0);

  // A row never lands past the bottom: the rest become "+N more" in the last row's place.
  const crowded = stackGroupRows([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 100, 20);
  assert.deepEqual(crowded.rows.map(r => r.index), [0, 1, 2, 3]);
  assert.equal(crowded.hidden, 6);
  assert.equal(crowded.moreTop, 80);

  // Late starters move up just enough to fit above the bottom edge.
  const late = stackGroupRows([0, 0.95], 200, 20);
  assert.deepEqual(late.rows.map(r => r.top), [0, 180]);
});
