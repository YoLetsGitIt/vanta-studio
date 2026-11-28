'use client';

import { getSupabase } from '@/lib/supabase';

// Guides a studio sees once, ever: the dashboard tour ('tour') and the Artists page guide
// ('artist-guide'). Remembered on the account (Supabase user metadata, studio_<name>_seen),
// so signing in on another browser or phone, a private window or a cleared browser doesn't
// bring them back, and in this browser too (vanta-studio-<name>:<user id>, which is also
// where they were remembered before).
const metaKey = name => `studio_${name.replace(/-/g, '_')}_seen`;
const localKey = (name, user) => `vanta-studio-${name}:${user.id}`;

export function guideSeen(user, name) {
  if (!user?.id) return true;
  if (user.user_metadata?.[metaKey(name)]) return true;
  try { return localStorage.getItem(localKey(name, user)) === 'complete'; } catch { return false; }
}

// Call as soon as the guide shows (not only when it's finished): closing it part way
// still counts as having seen it. Also copies a browser-only record onto the account.
export function markGuideSeen(user, name) {
  if (!user?.id) return;
  try { localStorage.setItem(localKey(name, user), 'complete'); } catch { /* private mode */ }
  if (user.user_metadata?.[metaKey(name)]) return;
  getSupabase().auth.updateUser({ data: { [metaKey(name)]: new Date().toISOString() } }).catch(() => {});
}
