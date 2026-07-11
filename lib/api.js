import { getSupabase } from './supabase';

const _BACKEND = 'https://inkspire-backend-xa2a.onrender.com';
function BACKEND() { return _BACKEND; }

async function authHeaders() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function demoLogin() {
  const res = await fetch(`${BACKEND()}/auth/demo`, { method: 'POST' });
  if (!res.ok) throw new Error('Demo unavailable');
  return res.json();
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

export async function listStudioBookings(status = '', cursor = '', sortDir = 'desc') {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  if (sortDir) params.set('sort_dir', sortDir);
  const query = params.toString();
  const res = await fetch(`${BACKEND()}/studio/me/bookings${query ? '?' + query : ''}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
}

export async function getBooking(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/bookings/${id}`, { headers });
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
  const res = await fetch(`${BACKEND()}/bookings/${id}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to reject booking');
  return res.json();
}

export async function recordOutcome(id, outcome, finalPrice, paymentMethod) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const payload = { outcome };
  if (finalPrice !== undefined && finalPrice !== null) payload.final_price = parseFloat(finalPrice);
  if (paymentMethod) payload.payment_method = paymentMethod;
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${id}/outcome`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to record outcome');
  return res.json();
}

export async function getArtistAnalytics(artistId, weeks = 12) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ weeks: String(weeks), window: 'trailing_7d' });
  const res = await fetch(`${BACKEND()}/artists/${artistId}/analytics?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function getArtistWorkSchedule(artistId) {
  const res = await fetch(`${BACKEND()}/artists/${artistId}/work-schedule`);
  if (!res.ok) throw new Error('Failed to fetch work schedule');
  return res.json(); // { schedule: [...], overrides: [...] }
}

// ── Studio registration (no auth) ────────────────────────────────────────────

export async function registerStudio({ email, password, studioId, studioName, address, latitude, longitude }) {
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
  const res = await fetch(`${BACKEND()}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, type: 'studio', filters: {}, page: 1, limit: 20 }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.studios ?? data.results ?? [];
}

export async function getMyStudioAccount() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me`, { headers });
  if (!res.ok) throw new Error('Not found');
  return res.json();
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

export async function getStudioPublic(studioId) {
  const res = await fetch(`${BACKEND()}/studios/${studioId}/public`);
  if (!res.ok) throw new Error('Studio not found');
  return res.json();
}

export async function createWalkIn(studioId, body) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studios/${studioId}/walkin`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to submit booking');
  return data;
}

export async function updateStudioProfile(name, address, consentForm, widgetBgColor, widgetAccentColor, studioCutPercent) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const body = { name, address };
  if (consentForm !== undefined) body.consent_form = consentForm;
  if (widgetBgColor !== undefined) body.widget_bg_color = widgetBgColor;
  if (widgetAccentColor !== undefined) body.widget_accent_color = widgetAccentColor;
  if (studioCutPercent !== undefined) body.studio_cut_percent = studioCutPercent;
  const res = await fetch(`${BACKEND()}/studio/me/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to update profile');
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

export async function removeStation(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/stations/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error('Failed to remove station');
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

export async function getAvailableStations(date, excludeBookingId = '') {
  const headers = await authHeaders();
  const params = new URLSearchParams({ date });
  if (excludeBookingId) params.set('exclude_booking', excludeBookingId);
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
    method: 'POST', headers, body: JSON.stringify({ artist_id: artistId, chosen_time: chosenTime }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to assign artist');
  return data;
}

// ── Admin studio management ───────────────────────────────────────────────────

export async function adminListStudioAccounts(status = '') {
  const headers = await authHeaders();
  const params = status ? `?status=${status}` : '';
  const res = await fetch(`${BACKEND()}/admin/studio-accounts${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch studio accounts');
  return res.json();
}

export async function adminApproveStudio(id) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/admin/studio-accounts/${id}/approve`, { method: 'POST', headers });
  if (!res.ok) throw new Error('Failed to approve');
  return res.json();
}

export async function adminRejectStudio(id, reason = '') {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/admin/studio-accounts/${id}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to reject');
  return res.json();
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

export async function createPayout(artistId, amount, note) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/payouts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ artist_id: artistId, amount, note: note || undefined }),
  });
  if (!res.ok) throw new Error('Failed to record payout');
  return res.json();
}

export async function getArtistPayoutHistory(artistId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND()}/studio/me/artists/${artistId}/payouts`, { headers });
  if (!res.ok) throw new Error('Failed to fetch payout history');
  return res.json(); // { payouts: [...] }
}

export async function saveBookingNote(bookingId, note) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND()}/studio/me/bookings/${bookingId}/note`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error('Failed to save note');
  return res.json();
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
