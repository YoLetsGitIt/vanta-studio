import { getSupabase } from './supabase';

const BACKEND = 'https://inkspire-backend-xa2a.onrender.com';

async function authHeaders() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function getArtistProfile(artistId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND}/artists/${artistId}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch artist profile');
  return res.json();
}

export async function listBookings(status = '') {
  const headers = await authHeaders();
  const params = new URLSearchParams({ role: 'artist' });
  if (status) params.set('status', status);
  const res = await fetch(`${BACKEND}/bookings?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
}

export async function getBooking(id) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND}/bookings/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch booking');
  return res.json();
}

export async function proposeBooking(id, body) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND}/bookings/${id}/propose`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to propose booking');
  return res.json();
}

export async function acceptBooking(id) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND}/bookings/${id}/accept`, { method: 'POST', headers });
  if (!res.ok) throw new Error('Failed to accept booking');
  return res.json();
}

export async function rejectBooking(id, reason = '') {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND}/bookings/${id}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to reject booking');
  return res.json();
}

export async function recordOutcome(id, outcome) {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  const res = await fetch(`${BACKEND}/bookings/${id}/outcome`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ outcome }),
  });
  if (!res.ok) throw new Error('Failed to record outcome');
  return res.json();
}

export async function getArtistAnalytics(artistId, weeks = 12) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ weeks: String(weeks), window: 'trailing_7d' });
  const res = await fetch(`${BACKEND}/artists/${artistId}/analytics?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}
