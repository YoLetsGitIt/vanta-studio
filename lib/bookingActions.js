import {
  acceptBookingWithStation,
  cancelBooking,
  confirmBooking,
  createFollowUpBooking,
  recordOutcome,
  reassignArtist,
  rejectBooking,
  rescheduleBooking,
  sendSelectionLink,
} from './api';
import { invalidatePrefix } from './cache';

function requireId(bookingId) {
  if (!bookingId) throw new Error('A booking is required for this action.');
}

async function mutate(bookingId, request) {
  requireId(bookingId);
  const result = await request();
  invalidatePrefix('bookings:');
  invalidatePrefix('schedule:');
  invalidatePrefix('dashboard:');
  return result;
}

export const bookingActions = Object.freeze({
  accept(bookingId, stationId) {
    if (!stationId) throw new Error('Select a station before accepting this booking.');
    return mutate(bookingId, () => acceptBookingWithStation(bookingId, stationId));
  },

  confirm(bookingId) {
    return mutate(bookingId, () => confirmBooking(bookingId));
  },

  reject(bookingId, reason = '') {
    return mutate(bookingId, () => rejectBooking(bookingId, reason.trim()));
  },

  cancel(bookingId, reason = '') {
    return mutate(bookingId, () => cancelBooking(bookingId, reason.trim()));
  },

  noShow(bookingId) {
    return mutate(bookingId, () => recordOutcome(bookingId, 'no_show'));
  },

  async complete(bookingId, { finalPrice, paymentSplits = [], createFollowUp = false } = {}) {
    return mutate(bookingId, async () => {
      const result = await recordOutcome(bookingId, 'completed', finalPrice, paymentSplits);
      if (createFollowUp) await createFollowUpBooking(bookingId);
      return result;
    });
  },

  reassign(bookingId, artistId, resend = true) {
    if (!artistId) throw new Error('Select an artist before reassigning this booking.');
    return mutate(bookingId, () => reassignArtist(bookingId, artistId, resend));
  },

  reschedule(bookingId, { newTime, message, durationMinutes }) {
    if (!newTime || !message?.trim()) throw new Error('Choose a time and include a message for the client.');
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('End time must be after start time.');
    return mutate(bookingId, () => rescheduleBooking(bookingId, newTime, message.trim(), durationMinutes));
  },

  sendSelectionLink(bookingId, options = {}) {
    const {
      expiresHours = 168,
      depositRequired = false,
      depositAmount = null,
      durationMinutes = null,
      estimatedQuote = null,
      artistId = null,
    } = options;
    return mutate(bookingId, () => sendSelectionLink(
      bookingId,
      expiresHours,
      depositRequired,
      depositAmount,
      durationMinutes,
      estimatedQuote,
      artistId,
    ));
  },
});
