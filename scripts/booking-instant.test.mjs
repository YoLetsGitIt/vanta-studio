import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatDay, formatLength, formatMoney, formatTime, formatWhen, paymentReturn, returnURL, todayIn, zoneNote } from '../lib/booking-instant.mjs';

test('lengths and money read naturally', () => {
  assert.equal(formatLength(30), '30 min');
  assert.equal(formatLength(60), '1 hour');
  assert.equal(formatLength(150), '2 hours 30 min');
  assert.equal(formatLength(480), '8 hours');
  assert.equal(formatMoney(100), '$100');
  assert.equal(formatMoney(62.5), '$62.50');
});

test('times show in the artist time zone', () => {
  const iso = '2026-11-16T10:30:00+11:00';
  assert.equal(formatTime(iso, 'Australia/Sydney'), '10:30 am');
  assert.equal(formatTime(iso, 'Australia/Perth'), '7:30 am');
  assert.equal(formatWhen(iso, 'Australia/Sydney'), 'Mon 16 Nov, 10:30 am');
  assert.equal(formatDay('2026-11-16'), 'Mon 16 Nov');
  assert.equal(zoneNote('Australia/Sydney', 'Australia/Sydney'), '');
  assert.equal(zoneNote('Australia/Sydney', 'Australia/Perth'), 'Times are in Sydney time.');
});

test('dates step across months and come from the artist zone', () => {
  assert.equal(addDays('2026-11-29', 3), '2026-12-02');
  // 1 pm UTC on the 15th is already the 16th in Sydney.
  assert.equal(todayIn('Australia/Sydney', new Date('2026-11-15T13:00:00Z')), '2026-11-16');
});

test('payment returns to this page, and its result is read back', () => {
  const back = returnURL('https://www.vanta.tattoo/bookings?artist=abc&guest=1&instant=cancelled&b=1&t=2');
  assert.equal(back, 'https://www.vanta.tattoo/bookings?artist=abc&guest=1');
  assert.deepEqual(paymentReturn(new URLSearchParams('artist=abc&instant=paid&b=id1&t=tok')), { result: 'paid', booking: 'id1', token: 'tok' });
  assert.equal(paymentReturn(new URLSearchParams('instant=paid&b=id1')), null);
  assert.equal(paymentReturn(new URLSearchParams('instant=other&b=id1&t=x')), null);
});
