'use client';

// Bookings already fetched this visit, so a booking panel opens straight away and then
// quietly refreshes. Anything with data-booking-id="…" starts loading its booking when
// the pointer rests on it (or it gets keyboard focus), before it's clicked.
import { getStudioBooking } from './api';

const saved = new Map();    // id → { booking, at }
const inFlight = new Map(); // id → promise
const FRESH_MS = 5_000;     // a hover fetch this recent isn't repeated
const KEEP_MS = 10 * 60_000;

// Always asks the server; shares a request already on its way.
export function fetchBooking(id) {
  if (inFlight.has(id)) return inFlight.get(id);
  const request = getStudioBooking(id)
    .then(booking => { saved.set(id, { booking, at: Date.now() }); return booking; })
    .finally(() => inFlight.delete(id));
  inFlight.set(id, request);
  return request;
}

// The booking as last fetched, or null.
export function peekBooking(id) {
  const hit = saved.get(id);
  return hit && Date.now() - hit.at < KEEP_MS ? hit.booking : null;
}

function isFresh(id) {
  const hit = saved.get(id);
  return Boolean(hit && Date.now() - hit.at < FRESH_MS);
}

// Shows the saved booking now (if any), then the server's copy when it arrives, so a
// change made elsewhere still shows. A hover fetch still on its way is shared.
// Returns a cancel function.
export function loadBooking(id, { onBooking, onError, onDone }) {
  let live = true;
  const cached = peekBooking(id);
  if (cached) onBooking(cached, { cached: true });
  // Fetched (by hovering) a moment ago: that copy is current enough.
  const request = !cached || !isFresh(id) || inFlight.has(id) ? fetchBooking(id) : Promise.resolve(cached);
  request
    .then(booking => { if (live) onBooking(booking, { cached: false }); })
    .catch(error => { if (live && !cached) onError?.(error); })
    .finally(() => { if (live) onDone?.(); });
  return () => { live = false; };
}

export function prefetchBooking(id) {
  if (!id || isFresh(id) || inFlight.has(id)) return;
  fetchBooking(id).catch(() => {});
}

// Something changed (a booking was made, edited or acted on): forget saved copies.
export function forgetBookings() { saved.clear(); }

let listening = false;
export function startBookingPrefetch() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  let timer = null;
  const target = event => event.target?.closest?.('[data-booking-id]');
  // A short pause so moving the pointer across the calendar doesn't fetch everything.
  window.addEventListener('pointerover', event => {
    const el = target(event);
    clearTimeout(timer);
    if (el) timer = setTimeout(() => prefetchBooking(el.dataset.bookingId), 90);
  }, { passive: true });
  window.addEventListener('focusin', event => { const el = target(event); if (el) prefetchBooking(el.dataset.bookingId); });
  ['booking-created', 'booking-deposit-cancelled', 'booking-deposit-received'].forEach(name => window.addEventListener(name, forgetBookings));
}
