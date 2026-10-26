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
