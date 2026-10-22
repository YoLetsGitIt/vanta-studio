import { getSupabase } from './supabase';

export async function ensureClientProfile(session, name = '') {
  if (!session?.access_token) throw new Error('Please sign in to continue.');
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/users/me`;
  const headers = { Authorization: `Bearer ${session.access_token}` };
  let response = await fetch(url, { headers, cache: 'no-store' });
  if (response.status === 404) {
    const metadata = session.user?.user_metadata ?? {};
    response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || metadata.full_name || metadata.name || 'User', accountType: 'user', termsAcceptedVersion: '1.0' }),
    });
  }
  const profile = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(profile.error || 'Could not load your account. Please try again.');
  return profile;
}

export function subscribeClientSession(onSession, onError) {
  const client = getSupabase();
  let active = true;
  let changed = false;
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    changed = true;
    if (active) onSession(session ?? null);
  });
  client.auth.getSession().then(({ data, error }) => {
    if (!active || changed) return;
    if (error) onError(error);
    else onSession(data.session ?? null);
  }).catch(error => { if (active) onError(error); });
  return () => { active = false; data.subscription.unsubscribe(); };
}
