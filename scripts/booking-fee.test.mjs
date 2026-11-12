import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingFee, depositCharge, payWays, BOOKING_FEE_NOTE } from '../lib/booking-fee.mjs';

test('the fee matches the server for common deposits', () => {
  assert.equal(bookingFee(50), 2);
  assert.equal(bookingFee(100), 3.5);
  assert.equal(bookingFee(150), 5);
  assert.equal(bookingFee(33.33), 1.5);
  assert.equal(bookingFee(0), 0);
});

test('a deposit through Vanta shows the fee and the total, from the server when sent', () => {
  assert.deepEqual(depositCharge(100, { card: true }), { deposit: 100, fee: 3.5, total: 103.5, throughVanta: true, bank: false });
  assert.deepEqual(depositCharge(100, { card: true, booking_fee: 4, total: 104, bank: true }), { deposit: 100, fee: 4, total: 104, throughVanta: true, bank: true });
  // An artist's own booking (no studio options): paid through Vanta.
  assert.equal(depositCharge(100, undefined).total, 103.5);
});

test('a deposit paid straight to the studio has no fee', () => {
  assert.deepEqual(depositCharge(100, { card: false, manual: { payid: 'pay@ink.example' } }), { deposit: 100, fee: 0, total: 100, throughVanta: false, bank: false });
});

test('the fee is never described as a card or payment fee', () => {
  for (const text of [BOOKING_FEE_NOTE, payWays(true), payWays(false)]) {
    assert.doesNotMatch(text, /surcharge|processing|card fee|payment fee|transaction/i);
  }
  assert.match(BOOKING_FEE_NOTE, /same however you pay/);
});
