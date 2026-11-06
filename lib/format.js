// Shared formatting helpers. Kept framework-agnostic (pure functions) so they
// can be used from any component without pulling in React.

// Two-letter uppercase initials from a name, e.g. "Kai Tanaka" → "KT".
// Returns "?" when the name is empty.
export function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// A date-only value (YYYY-MM-DD) formatted for display. Anchored at noon so the
// day never shifts across a timezone boundary.
export function formatDob(dob) {
  if (!dob) return null;
  return new Date(dob + 'T12:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Age in whole years from a date of birth ("1999-09-09" or a full timestamp), or null.
export function ageFromDob(dob) {
  const born = dob ? new Date(`${String(dob).slice(0, 10)}T00:00:00`) : null;
  if (!born || !Number.isFinite(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// Local (not UTC) YYYY-MM-DD for a Date — the calendar day the user sees.
export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The backend's studio-facing booking endpoints serialize an unassigned
// artist_id as this literal zero UUID rather than null (Go's uuid.UUID is a
// non-pointer field there) — so a plain truthiness check on artist_id is
// always true. Use this instead of `!!booking.artist_id`.
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';
export function hasArtist(artistId) {
  if (artistId == null) return false;
  const normalized = String(artistId).trim().toLowerCase();
  return normalized !== '' && normalized !== NIL_UUID && normalized !== 'null' && normalized !== 'undefined';
}
