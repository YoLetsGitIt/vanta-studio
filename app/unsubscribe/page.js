'use client';

import { useEffect, useState } from 'react';
import { getMarketingUnsubscribe, confirmMarketingUnsubscribe } from '@/lib/api';

export default function UnsubscribePage() {
  const [token, setToken] = useState('');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('t');
    if (!value) { setError('This unsubscribe link is incomplete.'); return; }
    setToken(value);
    let active = true;
    getMarketingUnsubscribe(value)
      .then(data => { if (active) setInfo(data); })
      .catch(() => { if (active) setError('This unsubscribe link is not valid.'); });
    return () => { active = false; };
  }, []);

  // Never unsubscribe on page load: link scanners open every URL in an email.
  async function unsubscribe() {
    setSaving(true); setError('');
    try { setInfo(await confirmMarketingUnsubscribe(token)); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <main style={{ maxWidth: 520, margin: '10vh auto', padding: 24, color: 'var(--text)', lineHeight: 1.7 }}>
      <h1>{info?.studio_name || 'Email preferences'}</h1>
      {error && <p role="alert">{error}</p>}
      {!info && !error && <p role="status">Loading…</p>}
      {info && (info.subscribed ? <>
        <p>Stop marketing emails from {info.studio_name}{info.email ? ` to ${info.email}` : ''}? Booking confirmations and reminders for appointments you have made are not affected.</p>
        <button onClick={unsubscribe} disabled={saving} style={{ padding: '12px 18px', cursor: 'pointer', borderRadius: 8 }}>
          {saving ? 'Saving…' : 'Unsubscribe'}
        </button>
      </> : <p role="status">You won’t receive marketing emails from {info.studio_name}. Your bookings are unchanged.</p>)}
    </main>
  );
}
