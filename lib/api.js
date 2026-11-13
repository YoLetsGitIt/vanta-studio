import { getSupabase } from './supabase';
import { invalidate } from './cache';

function BACKEND() { return process.env.NEXT_PUBLIC_BACKEND_URL; }

async function smsRequest(path, body, authenticated = true) {
  const headers = authenticated ? await authHeaders() : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BACKEND()}${path}`, {
    method: body === undefined ? 'GET' : authenticated ? 'PATCH' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load SMS reminders');
  return data;
}

export const getSMSSettings = () => smsRequest('/studio/me/sms-settings');
export const updateSMSSettings = enabled => smsRequest('/studio/me/sms-settings', { enabled });
export const getBookingSMS = id => smsRequest(`/studio/me/bookings/${id}/sms`);
export const updateBookingSMS = (id, optIn) => smsRequest(`/studio/me/bookings/${id}/sms`, { opt_in: optIn });
export const getSMSReminder = token => smsRequest(`/sms/reminder/${encodeURIComponent(token)}`, undefined, false);
export const unsubscribeSMS = token => smsRequest(`/sms/unsubscribe/${encodeURIComponent(token)}`, {}, false);

export async function authHeaders() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function getArtistProfile(artistId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/artists/${artistId}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch artist profile');
  return res.json();
}

export async function listBookings(status = '', cursor = '') {
  const headers = await authHeaders();
  const params = new URLSearchParams({ role: 'artist' });
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`${BACKEND()}/bookings?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
}

export async function listStudioBookings(status = '', cursor = '', sortDir = 'desc', outcome = '', summaryOnly = false) {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (status)  params.set('status', status);
  if (cursor)  params.set('cursor', cursor);
  if (sortDir) params.set('sort_dir', sortDir);
  if (outcome) params.set('outcome', outcome);
  if (summaryOnly) params.set('summary', 'true');
  const query = params.toString();
  const res = await fetch(`${BACKEND()}/studio/me/bookings${query ? '?' + query : ''}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
}

export async function getDashboardAttention() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/dashboard-attention`, { headers });
  if (!res.ok) throw new Error('Failed to fetch dashboard attention');
  return res.json();
}

export async function getBooking(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/bookings/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch booking');
  return res.json();
}

// Studio-scoped single booking — returns the full booking the studio owns
// (the app /bookings/{id} endpoint 403s for studio accounts). Same shape as
// listStudioBookings, so the schedule detail panel matches the bookings panel.
export async function getStudioBooking(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch booking');
  return res.json();
}

export async function proposeBooking(id, body) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/bookings/${id}/propose`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to propose booking');
  return res.json();
}

export async function acceptBooking(id) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/bookings/${id}/accept`, { method: 'POST', headers });
  if (!res.ok) throw new Error('Failed to accept booking');
  return res.json();
}

export async function cancelBooking(id, reason) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to cancel booking');
  return data;
}

export async function rejectBooking(id, reason = '') {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to reject booking');
  return data;
}

export async function cancelBookingDeposit(id) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/cancel-deposit`, {
    method: 'POST', headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not cancel deposit');
  return data;
}

// What the studio cancelling would do to the client's deposit: { deposit: 'none'|'refund',
// refund_amount, deposit_amount, paid_through_vanta }.
export async function getCancelPreview(id) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/cancel-preview`, { headers: await authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not check the deposit');
  return data;
}

// The studio sent back a deposit Vanta couldn't refund (paid to the studio's own PayID).
export async function markRefundSent(id) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/refund-sent`, { method: 'POST', headers: await authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not record the refund');
  return data;
}

// The studio can't give the client a new time: closes their request (they keep their free move).
export async function dismissRescheduleRequest(id) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/reschedule-request/dismiss`, { method: 'POST', headers: await authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not close the request');
  return data;
}

// method: 'payid' | 'bank_transfer' | 'cash'
export async function markDepositReceived(id, method) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/deposit-received`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(method ? { method } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not record the deposit');
  return data;
}

// How a manually recorded deposit was paid, or null.
export async function getDepositReceipt(id) {
  return (await getDepositStatus(id)).receipt;
}

// { receipt, client_claim }: how the studio recorded the deposit, and what the client said.
export async function getDepositStatus(id) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/deposit-receipt`, { headers: await authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load the deposit');
  return { receipt: data.receipt ?? null, client_claim: data.client_claim ?? null };
}

// PayID / bank transfer details shown to clients when a deposit is due.
export async function getDepositMethods() {
  const res = await fetch(`${BACKEND()}/studio/me/deposit-methods`, { headers: await authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load deposit payment options');
  return data;
}

export async function updateDepositMethods(methods) {
  const res = await fetch(`${BACKEND()}/studio/me/deposit-methods`, {
    method: 'PUT', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(methods),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save deposit payment options');
  return data;
}

export async function recordOutcome(id, outcome, finalPrice, paymentSplits) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const payload = { outcome };
  if (finalPrice !== undefined && finalPrice !== null) payload.final_price = parseFloat(finalPrice);
  if (paymentSplits && paymentSplits.length > 0) payload.payment_splits = paymentSplits;
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/outcome`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to record outcome');
  }
  return res.json();
}

export async function createFollowUpBooking(bookingId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/follow-up`, { method: 'POST', headers });
  if (!res.ok) throw new Error('Failed to create follow-up');
  return res.json();
}

export async function getArtistAnalytics(artistId, weeks = 12) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ weeks: String(weeks), window: 'trailing_7d' });
  const res = await fetch(`${BACKEND()}/artists/${artistId}/analytics?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

// from/to (YYYY-MM-DD) also returns date overrides (days off, changed hours) in that range.
export async function getArtistWorkSchedule(artistId, from = '', to = '') {
  const range = from && to ? `?${new URLSearchParams({ from, to })}` : '';
  const res = await fetch(`${BACKEND()}/artists/${artistId}/work-schedule${range}`);
  if (!res.ok) throw new Error('Failed to fetch work schedule');
  return res.json(); // { schedule: [...], overrides: [...] }
}

export async function updateArtistWorkSchedule(artistId, days) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/artists/${artistId}/work-schedule`, {
    method: 'PUT', headers, body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new Error('Failed to update schedule');
  return res.json();
}

// ── Studio registration (no auth) ────────────────────────────────────────────

export async function checkStudioSignupEmail(email) {
  const res = await fetch(`${BACKEND()}/studio/signup/email-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not check this email right now');
  return data;
}

export async function completeStudioSignup(sessionId) {
  const res = await fetch(`${BACKEND()}/studio/signup/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not finish creating your studio');
  return data;
}

export async function registerStudio({ email, password, studioName, address, latitude, longitude, studioId }) {
  const body = { email, password, studio_name: studioName, address };
  if (studioId) body.studio_id = studioId;
  if (latitude != null) body.latitude = latitude;
  if (longitude != null) body.longitude = longitude;

  const res = await fetch(`${BACKEND()}/studio/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Registration failed');
  return data;
}

export async function searchStudios(query) {
  const res = await fetch(`${BACKEND()}/studio/signup/studios?query=${encodeURIComponent(query)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not search studios right now. Please try again.');
  const data = await res.json();
  return data.studios ?? [];
}

export async function getMyStudioAccount() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me`, { headers });
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export async function getStudioOnboarding() {
  const res = await fetch(`${BACKEND()}/studio/me/onboarding`, { headers: await authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load setup progress. Please try again.');
  return res.json();
}

export async function updateStudioOnboarding(change) {
  const res = await fetch(`${BACKEND()}/studio/me/onboarding`, {
    method: 'PATCH',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(change),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save setup progress. Please try again.');
  return data;
}

// ── Billing ───────────────────────────────────────────────────────────────────

// Creates a Stripe-hosted subscription Checkout session for the signed-in studio.
// BillingInactiveBlock uses this for a new or expired subscription setup, then redirects
// the browser to checkout_url. Existing subscriptions with a payment failure use
// openBillingPortal() instead, so their card can be updated without creating another
// Checkout subscription flow. Neither action unlocks the dashboard directly: Stripe's
// webhook updates subscription_status, and the next getMyStudioAccount() response
// determines whether access is restored.
export async function startBillingCheckout() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/billing/checkout`, { method: 'POST', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to start billing setup');
  return data; // { checkout_url }
}

export async function getBillingDetails() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/billing`, { headers });
  if (!res.ok) throw new Error('Failed to load billing details');
  return res.json();
}

export async function cancelBillingSubscription(reason) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/billing/cancel`, {
    method: 'POST', headers, body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to cancel subscription');
  return data;
}

// Undoes a scheduled cancellation (cancel_at_period_end) on the studio's existing
// subscription in place — used by the "Add billing" action when the studio is only
// "Canceling" (still active, not yet lapsed), so it doesn't get sent through Checkout
// again and re-offered a trial it's already had. No checkout_url: this never leaves
// the app, unlike startBillingCheckout.
export async function reactivateBillingSubscription() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/billing/reactivate`, { method: 'POST', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to reactivate subscription');
  return data;
}

export async function openBillingPortal() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/billing/portal`, { method: 'POST', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to open billing portal');
  return data; // { portal_url }
}

// ── Studio artist management ─────────────────────────────────────────────────

export async function getStudioArtists(status = '') {
  const headers = await authHeaders();
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${BACKEND()}/studio/me/artists${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch studio artists');
  return res.json();
}

export async function approveStudioArtist(id) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/artists/${id}/approve`, { method: 'POST', headers });
  if (!res.ok) throw new Error('Failed to approve artist');
  return res.json();
}

export async function getStudioArtistStats(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/artists/${id}/stats`, { headers });
  if (!res.ok) throw new Error('Failed to fetch artist stats');
  return res.json();
}

export async function rejectStudioArtist(id, reason = '') {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/artists/${id}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to reject artist');
  return res.json();
}

export async function setArtistAcceptingBookings(id, accepting) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/artists/${id}/accepting-bookings`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepting }),
  });
  if (!res.ok) throw new Error('Failed to update artist');
  return res.json();
}

export async function setArtistLastDay(id, lastDay) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/artists/${id}/last-day`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ last_day: lastDay ?? null }),
  });
  if (!res.ok) throw new Error('Failed to update artist');
  return res.json();
}

export async function getStudioSchedule(date = '') {
  const headers = await authHeaders();
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${BACKEND()}/studio/me/schedule${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch schedule');
  return res.json();
}

export async function getStudioScheduleRange(start, end) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${BACKEND()}/studio/me/schedule?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch schedule');
  return res.json();
}

// ── Walk-in (public booking) ─────────────────────────────────────────────────

// Upload a new studio logo (PNG/JPG/WebP, ≤2 MB): sign → PUT to storage → save. Returns the public URL.
export async function uploadStudioLogo(file) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const signRes = await fetch(`${BACKEND()}/studio/me/logo/sign`, { method: 'POST', headers, body: JSON.stringify({ mime_type: file.type, byte_size: file.size }) });
  const sign = await signRes.json().catch(() => ({}));
  if (!signRes.ok) throw new Error(sign.error ?? 'Could not start the logo upload');
  const put = await fetch(sign.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok) throw new Error('The logo upload failed. Please try again.');
  const saveRes = await fetch(`${BACKEND()}/studio/me/logo`, { method: 'PUT', headers, body: JSON.stringify({ path: sign.path }) });
  const saved = await saveRes.json().catch(() => ({}));
  if (!saveRes.ok) throw new Error(saved.error ?? 'Could not save the logo');
  return saved.logo_url;
}

export async function removeStudioLogo() {
  const res = await fetch(`${BACKEND()}/studio/me/logo`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok) throw new Error('Could not remove the logo');
}

export async function getStudioPublic(studioId) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/public`);
  if (!res.ok) throw new Error('Studio not found');
  return res.json();
}

// Walk-in form: books the client in straight away with the artist they chose.
export async function createWalkInBooking(studioId, body) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/walk-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not book you in');
  return data;
}

export async function getWalkInFormConfigPublic(studioId) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/walkin-form-config`);
  if (!res.ok) throw new Error('Failed to load walk-in form');
  return res.json();
}

export async function getMyWalkInFormConfig() {
  const res = await fetch(`${BACKEND()}/studio/me/walkin-form-config`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load walk-in form');
  return res.json();
}

export async function updateMyWalkInFormConfig(fields) {
  const res = await fetch(`${BACKEND()}/studio/me/walkin-form-config`, {
    method: 'PUT', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to save walk-in form');
  return data;
}

// Weekly opening hours: [{ day_of_week, open_time, close_time, is_closed }].
export async function getStudioHoursPublic(studioId) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/hours`);
  if (!res.ok) throw new Error('Failed to load opening hours');
  return res.json();
}

// A client's private "send your availability" page: ?b=<booking>&t=<client token>. No auth.
export async function getAvailabilityRequest(bookingId, token) {
  const res = await fetch(`${BACKEND()}/bookings/${encodeURIComponent(bookingId)}/availability-request?t=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'This link isn’t valid');
  return data;
}

export async function submitAvailability(bookingId, token, body) {
  const res = await fetch(`${BACKEND()}/bookings/${encodeURIComponent(bookingId)}/availability-request?t=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send your availability');
  return data;
}

// The studio's form colours, shared by the booking, walk-in and consent forms:
// { bg_color, accent_color } (null = each form's default look).
export async function updateFormStyle(style) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/form-style`, { method: 'PUT', headers, body: JSON.stringify(style) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not save the form colours');
  return data;
}

// The studio asks a client for their weekly availability (with the quote and length).
export async function requestAvailability(bookingId, { estimatedQuote, durationMinutes } = {}) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const body = {};
  if (estimatedQuote != null) body.estimated_quote = estimatedQuote;
  if (durationMinutes != null) body.duration_minutes = durationMinutes;
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/request-availability`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not email the client');
  return data;
}

// Guest booking from the studio link: no account, no auth header.
export async function createGuestStudioBooking(studioId, body) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/studio-booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Failed to submit booking'), { status: res.status });
  return data;
}

export async function createWalkIn(studioId, body) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studios/${studioId}/client-booking`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Failed to submit booking'), { status: res.status });
  return data;
}

export async function updateStudioProfile(name, address, widgetBgColor, widgetAccentColor, walkinCutPercent, personalCutPercent, aftercareInstructions, timezone, latitude, longitude, paymentRecordingRequirement, rescheduleWindowHours, widgetConsentTemplateId, sendReminder7d, sendReminder24h, payArtistOnForfeitedDeposits, schedulingMode, piercingAftercareInstructions, sendReminder3d, forfeitedDepositArtistPercent, depositRefundable) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const body = { name, address };
  if (latitude != null) body.latitude = latitude;
  if (longitude != null) body.longitude = longitude;
  if (widgetBgColor !== undefined) body.widget_bg_color = widgetBgColor;
  if (widgetAccentColor !== undefined) body.widget_accent_color = widgetAccentColor;
  if (walkinCutPercent !== undefined) body.walkin_cut_percent = walkinCutPercent;
  if (personalCutPercent !== undefined) body.personal_cut_percent = personalCutPercent;
  if (piercingAftercareInstructions !== undefined) body.piercing_aftercare_instructions = piercingAftercareInstructions;
  if (aftercareInstructions !== undefined) body.aftercare_instructions = aftercareInstructions;
  if (timezone !== undefined) body.timezone = timezone;
  if (paymentRecordingRequirement !== undefined) body.payment_recording_requirement = paymentRecordingRequirement;
  if (rescheduleWindowHours !== undefined) body.reschedule_window_hours = rescheduleWindowHours;
  if (widgetConsentTemplateId !== undefined) body.widget_consent_template_id = widgetConsentTemplateId ?? '';
  if (sendReminder7d !== undefined) body.send_reminder_7d = sendReminder7d;
  if (sendReminder24h !== undefined) body.send_reminder_24h = sendReminder24h;
  if (sendReminder3d !== undefined) body.send_reminder_3d = sendReminder3d;
  if (payArtistOnForfeitedDeposits !== undefined) body.pay_artist_on_forfeited_deposits = payArtistOnForfeitedDeposits;
  // A number 0–100, or null for the artist's usual commission share.
  if (forfeitedDepositArtistPercent !== undefined) body.forfeited_deposit_artist_percent = forfeitedDepositArtistPercent;
  if (schedulingMode !== undefined) body.scheduling_mode = schedulingMode;
  // Cancellation policy: refund the deposit when the client cancels at least
  // reschedule_window_hours before.
  if (depositRefundable !== undefined) body.deposit_refundable = depositRefundable;
  const res = await fetch(`${BACKEND()}/studio/me/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to update profile');
  return data;
}

export async function getStudioBookingPayment(bookingId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/payment`, { headers });
  if (!res.ok) throw new Error('Failed to fetch payment data');
  return res.json();
}

// What the client paid for a completed booking, as the studio records it.
// splits: [{ method: 'cash' | 'card' | 'bank_transfer', amount }]
export async function recordStudioBookingPayment(bookingId, splits) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/payment`, {
    method: 'PATCH', headers, body: JSON.stringify({ payment_splits: splits }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Couldn’t record the payment');
  return data;
}

export async function walkinUploadSign(studioId, files) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/walkin-upload-sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to get upload URLs');
  return data.uploads;
}

// Presigned upload URLs for consent/waiver signature PNGs → private consent-signatures bucket.
export async function signatureUploadSign(studioId, files) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/signature-upload-sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to get signature upload URLs');
  return data.uploads;
}

// ── Consent templates ────────────────────────────────────────────────────────

// Download a signed consent form as a PDF (the studio's copy).
export async function downloadConsentPdf(submissionId, filename = 'consent-form.pdf') {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/consent-submissions/${submissionId}/pdf`, { headers });
  if (!res.ok) throw new Error('Could not download the consent form');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function getStudioConsentTemplates(studioId, all = false) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/consent-templates${all ? '?all=1' : ''}`);
  if (!res.ok) throw new Error('Failed to load consent templates');
  return res.json(); // { templates: [...] }
}

export async function listConsentTemplates() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/consent-templates`, { headers });
  if (!res.ok) throw new Error('Failed to list templates');
  return res.json();
}

export async function createConsentTemplate(body) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/consent-templates`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to create template');
  invalidate('consent:templates');
  return data;
}

export async function updateConsentTemplate(id, updates) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/consent-templates/${id}`, {
    method: 'PATCH', headers, body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to update template');
  invalidate('consent:templates');
  return data;
}

export async function deleteConsentTemplate(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/consent-templates/${id}`, {
    method: 'DELETE', headers,
  });
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete template');
  invalidate('consent:templates');
}

// limit: only the newest N forms, plus `total` (how many there are in all).
export async function getBookingConsentSubmissions(bookingId, limit) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/consent-submissions${limit ? `?limit=${limit}` : ''}`, { headers });
  if (!res.ok) throw new Error('Failed to load consent submissions');
  return res.json();
}

// ── Studio hours ─────────────────────────────────────────────────────────────

export async function getStudioHours() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/hours`, { headers });
  if (!res.ok) throw new Error('Failed to fetch studio hours');
  return res.json();
}

export async function updateStudioHours(hours) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/hours`, {
    method: 'PUT', headers, body: JSON.stringify({ hours }),
  });
  if (!res.ok) throw new Error('Failed to update studio hours');
  return res.json();
}

// ── Stations ─────────────────────────────────────────────────────────────────

export async function getStations() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/stations`, { headers });
  if (!res.ok) throw new Error('Failed to fetch stations');
  return res.json();
}

export async function addStation() {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/stations`, { method: 'POST', headers });
  if (!res.ok) throw new Error('Failed to add station');
  return res.json();
}

export async function renameStation(id, name) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/stations/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ name }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Couldn’t rename the station');
  invalidate('stations:all');
  return data;
}

export async function removeStation(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/stations/${id}`, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to remove station');
  return data;
}

export async function setStationLastDay(id, lastDay) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/stations/${id}/last-day`, {
    method: 'PUT', headers, body: JSON.stringify({ last_day: lastDay ?? null }),
  });
  if (!res.ok) throw new Error('Failed to set station last day');
  return res.json();
}

export async function setStationUnavailability(id, date, reason = '') {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/stations/${id}/unavailability`, {
    method: 'POST', headers, body: JSON.stringify({ date, reason }),
  });
  if (!res.ok) throw new Error('Failed to set unavailability');
  return res.json();
}

export async function clearStationUnavailability(id, date) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/stations/${id}/unavailability/${date}`, {
    method: 'DELETE', headers,
  });
  if (!res.ok) throw new Error('Failed to clear unavailability');
  return res.json();
}

export async function getAvailableStations(date, excludeBookingId = '', startTime = '', durationMins = 0) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ date });
  if (excludeBookingId) params.set('exclude_booking', excludeBookingId);
  if (startTime) params.set('start_time', startTime);
  if (durationMins > 0) params.set('duration_mins', String(durationMins));
  const res = await fetch(`${BACKEND()}/studio/me/stations/available?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch available stations');
  return res.json();
}

export async function acceptBookingWithStation(bookingId, stationId) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/accept`, {
    method: 'POST', headers, body: JSON.stringify({ station_id: stationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to accept booking');
  return data;
}

// body: { artist_id, requester_name, chosen_time (ISO8601), requester_email?, requester_phone?,
//         session_type?, body_location?, design_details?, notes?, estimated_quote?, duration_minutes?, station_id? }
export async function createManualBooking(body) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to create booking');
  return data;
}

export async function getWalkIns() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/bookings/walkins`, { headers });
  if (!res.ok) throw new Error('Failed to fetch walk-ins');
  return res.json();
}

export async function assignArtist(bookingId, artistId, chosenTime) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/assign-artist`, {
    // Without a time ("Artists confirm" studios) the artist sends the client times.
    method: 'POST', headers, body: JSON.stringify(chosenTime ? { artist_id: artistId, chosen_time: chosenTime } : { artist_id: artistId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to assign artist');
  return data;
}

// ── Data import ───────────────────────────────────────────────────────────────

// payload: { clients?: [...], appointments?: [...] } — max 500 rows per call.
export async function importStudioData(payload) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Import failed');
  return data; // { clients: {imported, linked, skipped}, appointments: {...}, errors: [...] }
}

export async function getStudioClients(search = '') {
  const headers = await authHeaders();
  const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
  const res = await fetch(`${BACKEND()}/studio/me/clients${query}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch clients');
  return res.json(); // { clients: [...] }
}

// bookingsLimit: only the N most recent bookings, plus `bookings_total`.
export async function getStudioClient(id, { bookingsLimit } = {}) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/clients/${id}${bookingsLimit ? `?bookings_limit=${bookingsLimit}` : ''}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch client details');
  return res.json(); // { client, bookings, bookings_total? }
}

export async function ensureStudioClient(name, email, phone) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/clients/ensure`, {
    method: 'POST', headers, body: JSON.stringify({ name, email, phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to ensure client');
  return data; // { client: { id, ... } }
}

// Correct a client's name, email, phone and date of birth. Clients with a Vanta account
// keep their account name and email (the server refuses changes to those).
export async function updateStudioClientContact(id, { name, email, phone, dob }) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/clients/${id}/contact`, {
    method: 'PATCH', headers, body: JSON.stringify({ name, email, phone, dob }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.error ?? 'Could not update the client'); err.status = res.status; throw err; }
  return data;
}

export async function patchStudioClient(id, fields) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/clients/${id}`, {
    method: 'PATCH', headers, body: JSON.stringify(fields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to update client');
  return data;
}

// ── Consent ───────────────────────────────────────────────────────────────────

export async function getClientConsents(emails) {
  const headers = await authHeaders();
  const param = emails.join(',');
  const res = await fetch(`${BACKEND()}/studio/me/clients/consents?emails=${encodeURIComponent(param)}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch consents');
  return res.json(); // { consents: { email: { ... } }, current_version: "1" }
}

export async function recordConsentInStudio(email) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/clients/consent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Failed to record consent');
  return res.json();
}

// ── Revenue ───────────────────────────────────────────────────────────────────

export async function getStudioRevenueStats(startDate, endDate) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const res = await fetch(`${BACKEND()}/studio/me/revenue?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch revenue stats');
  return res.json();
}

export async function getPayoutSummaries() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/payouts`, { headers });
  if (!res.ok) throw new Error('Failed to fetch payout summaries');
  return res.json(); // { payouts: [...] }
}

export async function createPayout(artistId, amount, note, paymentMethod) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/payouts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ artist_id: artistId, amount, note: note || undefined, payment_method: paymentMethod || undefined }),
  });
  if (!res.ok) throw new Error('Failed to record payout');
  return res.json();
}

export async function getReimbursements() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/reimbursements`, { headers });
  if (!res.ok) throw new Error('Failed to fetch reimbursements');
  return res.json(); // { reimbursements: [...] }
}

export async function createStudioReimbursement(artistId, amount, description) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/reimbursements`, {
    method: 'POST', headers, body: JSON.stringify({ artist_id: artistId, amount, description }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to record reimbursement');
  return data;
}

export async function reviewReimbursement(id, action) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/reimbursements/${id}/review`, {
    method: 'POST', headers, body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to review reimbursement');
  return data;
}

export async function getArtistPayoutHistory(artistId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/artists/${artistId}/payouts`, { headers });
  if (!res.ok) throw new Error('Failed to fetch payout history');
  return res.json(); // { payouts: [...] }
}

export async function deletePayout(payoutId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/payouts/${payoutId}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error('Failed to delete payout');
  return res.json();
}

export async function getArtistEarningsBreakdown(artistId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/artists/${artistId}/earnings`, { headers });
  if (!res.ok) throw new Error('Failed to fetch earnings breakdown');
  return res.json(); // { entries: [...] }
}

export async function getNotes(entityType, entityId) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
  const res = await fetch(`${BACKEND()}/studio/me/notes?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json(); // { notes: [...] }
}

export async function addNote(entityType, entityId, content) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ entity_type: entityType, entity_id: entityId, content }),
  });
  if (!res.ok) throw new Error('Failed to add note');
  return res.json(); // { note: {...} }
}

export async function deleteNote(noteId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/notes/${noteId}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error('Failed to delete note');
  return res.json();
}

export async function sendSelectionLink(bookingId, expiresHours = 168, depositRequired = false, depositAmount = null, durationMinutes = null, estimatedQuote = null, artistId = null) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const body = { expires_hours: expiresHours, deposit_required: depositRequired };
  if (depositAmount != null) body.deposit_amount = depositAmount;
  if (durationMinutes != null) body.duration_minutes = durationMinutes;
  if (estimatedQuote != null) body.estimated_quote = estimatedQuote;
  if (artistId) body.artist_id = artistId;
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/send-selection-link`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to send link');
  return data; // { link, token }
}

// Studio books a request straight into a time (no artist acceptance).
export async function bookRequestTime(bookingId, body) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/book-time`, {
    method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not book this time');
  return data;
}

// Offer a client up to three times; they pick one from an email link.
export async function offerBookingTimes(bookingId, body) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/offer-times`, {
    method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send these times');
  return data.offer ?? null;
}

// Whether the artist is free at each time being picked (up to three); nothing is saved.
// Returns [{ time, available, message? }] in the order given.
export async function checkOfferTimes(bookingId, { artistId, durationMinutes, times }) {
  const q = new URLSearchParams({ artist_id: artistId, duration: String(durationMinutes) });
  times.forEach(t => q.append('time', t));
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/offer-times/check?${q}`, { headers: await authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not check these times');
  return data.times ?? [];
}

export async function getOfferedTimes(bookingId) {
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/offered-times`, { headers: await authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not load the offered times');
  return data.offer ?? null;
}

export async function confirmBooking(bookingId) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/confirm`, { method: 'POST', headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to confirm booking');
  return data;
}

export async function reassignArtist(bookingId, artistId, resend = false) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/reassign-artist`, {
    method: 'POST', headers, body: JSON.stringify({ artist_id: artistId, resend }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to reassign artist');
  return data;
}

// Edit a booked appointment: any of chosen_time, duration_minutes, artist_id,
// station_id ("" removes it), plus notify_client + message to email a moved time.
export async function editBooking(bookingId, body) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Couldn’t save the booking');
  return data;
}

// limit: only the newest N forms, plus `total` (how many there are in all).
export async function getClientConsentSubmissions(email, limit) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/clients/consent-submissions?email=${encodeURIComponent(email)}${limit ? `&limit=${limit}` : ''}`, { headers });
  if (!res.ok) throw new Error('Failed to load client consent submissions');
  return res.json(); // { submissions: [...] }
}

export async function getBatchClientConsentSubmissions(emails) {
  const headers = await authHeaders();
  const param = emails.map(e => encodeURIComponent(e)).join(',');
  const res = await fetch(`${BACKEND()}/studio/me/clients/consent-submissions?emails=${param}`, { headers });
  if (!res.ok) throw new Error('Failed to load client consent submissions');
  return res.json(); // { submissions: [...] } each has client_email
}

export async function generateConsentLink(email, templateId, dob) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const payload = { email };
  if (templateId) payload.template_id = templateId;
  if (dob) payload.dob = dob;
  const res = await fetch(`${BACKEND()}/studio/me/clients/consent-link`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to generate consent link');
  return data; // { token, expires_at }
}

// ── Stripe Connect (studio accounts) ──────────────────────────────────────────

export async function getStripeStatus() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/stripe/status`, { headers });
  if (!res.ok) throw new Error('Failed to fetch Stripe status');
  return res.json(); // { connected, charges_enabled, details_submitted, payouts_enabled, manual_deposits_ready }
}

export async function startStripeOnboarding(returnTo) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/stripe/onboard`, {
    method: 'POST', headers, body: JSON.stringify({ return_to: returnTo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to start Stripe onboarding');
  return data; // { onboarding_url }
}

export async function disconnectStripe() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/stripe`, { method: 'DELETE', headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to disconnect Stripe');
  }
}

export async function getFormConfig() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/form-config`, { headers });
  if (!res.ok) throw new Error('Failed to load form config');
  return res.json();
}

export async function updateFormConfig(fields) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/form-config`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to save form config');
  }
  return res.json();
}

export async function getFormConfigPublic(studioId) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/form-config`);
  if (!res.ok) throw new Error('Failed to load form config');
  return res.json();
}

// ── Email marketing ──────────────────────────────────────────────────────────

async function marketingRequest(method, path, body, authenticated = true) {
  const headers = authenticated ? await authHeaders() : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BACKEND()}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not complete that request');
  return data;
}

export const getMarketing = () => marketingRequest('GET', '/studio/me/marketing');
// Short booking link: vanta.tattoo/b/<slug> (consent form: /c/<slug>).
export const getBookingLink = () => marketingRequest('GET', '/studio/me/booking-link');
export const updateBookingLink = slug => marketingRequest('PUT', '/studio/me/booking-link', { slug });
// Whether another studio already uses this link name: { slug, available, message? }.
export const checkBookingLink = slug => marketingRequest('GET', `/studio/me/booking-link/check?slug=${encodeURIComponent(slug)}`);
export const saveMarketingSettings = settings => marketingRequest('PUT', '/studio/me/marketing/settings', settings);
export const saveMarketingAutomation = (type, automation) => marketingRequest('PUT', `/studio/me/marketing/automations/${type}`, automation);
export const getMarketingCandidates = trigger => marketingRequest('GET', `/studio/me/marketing/candidates?trigger=${encodeURIComponent(trigger)}`);
export const triggerMarketingNow = (bookingId, triggerType) => marketingRequest('POST', '/studio/me/marketing/trigger', { booking_id: bookingId, trigger_type: triggerType });
export const getMarketingAudience = (kind, days) => marketingRequest('GET', `/studio/me/marketing/audience?kind=${encodeURIComponent(kind)}${days ? `&days=${days}` : ''}`);
export const listMarketingCampaigns = () => marketingRequest('GET', '/studio/me/marketing/campaigns');
export const createMarketingCampaign = campaign => marketingRequest('POST', '/studio/me/marketing/campaigns', campaign);
export const previewMarketingEmail = (subject, body, clientName, clientId) => marketingRequest('POST', '/studio/me/marketing/preview', { subject, body, ...(clientName ? { client_name: clientName } : {}), ...(clientId ? { client_id: clientId } : {}) });
// Shrinks a photo to a JPEG at most 1200px wide, flattened onto white. Email
// apps show it at 496px, so this keeps messages light without looking soft.
async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error('That file isn’t a photo we can read. Try a JPG or PNG.');
  const scale = Math.min(1, 1200 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Couldn’t prepare that photo.')), 'image/jpeg', 0.85));
}

// Uploads a photo for a marketing email and returns its public URL. GIFs are
// uploaded as they are so animation is kept.
export async function uploadMarketingPhoto(file) {
  const blob = file.type === 'image/gif' ? file : await shrinkPhoto(file);
  const sign = await marketingRequest('POST', '/studio/me/marketing/images/sign', { mime_type: blob.type, byte_size: blob.size });
  const put = await fetch(sign.upload_url, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
  if (!put.ok) throw new Error('The photo upload failed. Please try again.');
  return sign.url;
}
// Sends one copy to the signed-in user's own address; pass { template_id } or { subject, body }.
export const sendMarketingTest = message => marketingRequest('POST', '/studio/me/marketing/test', message);
export const getMarketingCampaignRecipients = id => marketingRequest('GET', `/studio/me/marketing/campaigns/${id}/recipients`);
export const listMarketingAudiences = () => marketingRequest('GET', '/studio/me/marketing/saved-audiences');
export const saveMarketingAudience = (name, filters) => marketingRequest('POST', '/studio/me/marketing/saved-audiences', { name, filters });
export const deleteMarketingAudience = id => marketingRequest('DELETE', `/studio/me/marketing/saved-audiences/${id}`);
export const getMarketingDomain = () => marketingRequest('GET', '/studio/me/marketing/domain');
export const addMarketingDomain = domain => marketingRequest('POST', '/studio/me/marketing/domain', { domain });
export const verifyMarketingDomain = () => marketingRequest('POST', '/studio/me/marketing/domain/verify', {});
export const removeMarketingDomain = () => marketingRequest('DELETE', '/studio/me/marketing/domain');
export const setClientMarketingConsent = (clientId, optIn) => marketingRequest('PATCH', `/studio/me/clients/${clientId}/marketing`, { opt_in: optIn, sms_opt_in: optIn });
// Email and SMS marketing set independently: { optIn, smsOptIn }.
export const setClientMarketingChannels = (clientId, { optIn, smsOptIn }) => marketingRequest('PATCH', `/studio/me/clients/${clientId}/marketing`, { opt_in: optIn, sms_opt_in: smsOptIn });
export const getMarketingUnsubscribe = token => marketingRequest('GET', `/marketing/unsubscribe/${encodeURIComponent(token)}`, undefined, false);
export const confirmMarketingUnsubscribe = token => marketingRequest('POST', `/marketing/unsubscribe/${encodeURIComponent(token)}`, {}, false);

export const listMarketingTemplates = () => marketingRequest('GET', '/studio/me/marketing/templates');
export const saveMarketingTemplate = template => marketingRequest(template.id ? 'PUT' : 'POST', `/studio/me/marketing/templates${template.id ? `/${template.id}` : ''}`, template);
export const deleteMarketingTemplate = id => marketingRequest('DELETE', `/studio/me/marketing/templates/${id}`);
export const listMarketingRecipients = (kind, days) => marketingRequest('GET', `/studio/me/marketing/recipients?kind=${encodeURIComponent(kind)}${days ? `&days=${Number(days)}` : ''}`);
export const sendClientMarketingTemplate = (id, templateId) => marketingRequest('POST', `/studio/me/clients/${id}/marketing/send`, { template_id: templateId });
export const getMarketingMailboxes = () => marketingRequest('GET', '/studio/me/marketing/mailboxes');
export const connectMarketingMailbox = provider => marketingRequest('POST', `/studio/me/marketing/mailboxes/${encodeURIComponent(provider)}`, {});
export const disconnectMarketingMailbox = provider => marketingRequest('DELETE', `/studio/me/marketing/mailboxes/${encodeURIComponent(provider)}`);

// Artist commission overrides. A null percent uses the studio's rate.
async function commissionRequest(path, method = 'GET', body) {
  const headers = { ...(await authHeaders()), ...(body ? { 'Content-Type': 'application/json' } : {}) };
  const res = await fetch(`${BACKEND()}/studio/me/commission-overrides${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not update artist commission');
  return data.overrides ?? [];
}
export const getCommissionOverrides = () => commissionRequest('');
export const setCommissionOverride = (artistId, rates) => commissionRequest(`/${artistId}`, 'PUT', rates);
export const deleteCommissionOverride = artistId => commissionRequest(`/${artistId}`, 'DELETE');

// Artist invites: a shared join link (vanta.tattoo/j/<code>) plus email/phone invites.
export const getArtistInvites = () => marketingRequest('GET', '/studio/me/artist-invites');
export const resetArtistInviteLink = () => marketingRequest('POST', '/studio/me/artist-invites/link/reset');
export const inviteArtist = email => marketingRequest('POST', '/studio/me/artist-invites', { email });
export const cancelArtistInvite = id => marketingRequest('DELETE', `/studio/me/artist-invites/${encodeURIComponent(id)}`);

// Studios artists typed in that look like this studio ("Add them?").
export const getDuplicateStudios = () => marketingRequest('GET', '/studio/me/duplicate-studios');
export const acceptDuplicateStudio = id => marketingRequest('POST', `/studio/me/duplicate-studios/${encodeURIComponent(id)}/accept`);
export const dismissDuplicateStudio = id => marketingRequest('POST', `/studio/me/duplicate-studios/${encodeURIComponent(id)}/dismiss`);
export const getDuplicateClients = () => marketingRequest('GET', '/studio/me/duplicate-clients');
export const mergeDuplicateClients = (keepId, mergeId) => marketingRequest('POST', '/studio/me/duplicate-clients/merge', { keep_id: keepId, merge_id: mergeId });
export const dismissDuplicateClients = (aId, bId) => marketingRequest('POST', '/studio/me/duplicate-clients/dismiss', { a_id: aId, b_id: bId });

// ── Appointment types (the studio's booking presets) ─────────────────────────
async function appointmentTypeRequest(path, method = 'GET', body) {
  const headers = { ...(await authHeaders()), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
  const res = await fetch(`${BACKEND()}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Appointment types could not be saved');
  return data;
}
export const listAppointmentTypes = () => appointmentTypeRequest('/studio/me/appointment-types');
export const createAppointmentType = body => appointmentTypeRequest('/studio/me/appointment-types', 'POST', body);
export const updateAppointmentType = (id, body) => appointmentTypeRequest(`/studio/me/appointment-types/${id}`, 'PATCH', body);
export const deleteAppointmentType = id => appointmentTypeRequest(`/studio/me/appointment-types/${id}`, 'DELETE');
// reprice: also set the quote from the artist's rate for the type (open bookings only).
// The response's estimated_quote is the new quote, or null when it wasn't changed.
export const setBookingQuote = (bookingId, price) =>
  appointmentTypeRequest(`/studio/me/bookings/${bookingId}/quote`, 'PUT', { estimated_quote: price });

export const setBookingAppointmentType = (bookingId, typeId, { reprice = false } = {}) =>
  appointmentTypeRequest(`/studio/me/bookings/${bookingId}/appointment-type`, 'PUT', { appointment_type_id: typeId ?? null, reprice });

// ── Artist rates (hourly, half day, full day; null = not set) ────────────────
export const listArtistRates = () => appointmentTypeRequest('/studio/me/artist-rates');
export const setArtistRates = (artistId, rates) => appointmentTypeRequest(`/studio/me/artist-rates/${artistId}`, 'PUT', rates);
