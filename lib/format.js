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

// Local (not UTC) YYYY-MM-DD for a Date — the calendar day the user sees.
export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
