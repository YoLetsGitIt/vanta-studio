'use client';

// Settings → Account: turn on new-booking notifications for this phone or computer.
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported, sendTestPush } from '@/lib/push';

export default function PushNotificationSettings() {
  const [state, setState] = useState('loading'); // loading | ios-install | unsupported | denied | off | on
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    if (isIOS() && !isStandalone()) return setState('ios-install');
    if (!pushSupported()) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    setState((await currentSubscription()) && Notification.permission === 'granted' ? 'on' : 'off');
  }

  useEffect(() => { refresh().catch(() => setState('off')); }, []);

  async function run(action, done) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); if (done) setMessage(done); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); refresh().catch(() => {}); }
  }

  return (
    <section style={card} aria-labelledby="push-title">
      <h2 id="push-title" style={title}>New booking notifications</h2>
      <p style={desc}>Get a notification on this device whenever a booking request or walk-in comes in. Turn it on for each phone or computer you use.</p>

      {state === 'loading' && <p style={desc}>Checking this device…</p>}

      {state === 'ios-install' && (
        <div style={steps}>
          <p style={{ ...desc, color: 'var(--text)' }}>On iPhone, notifications need Vanta Studio on your Home Screen first:</p>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', ...descText }}>
            <li>In Safari, tap the <strong>Share</strong> button.</li>
            <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
            <li>Open <strong>Vanta Studio</strong> from your Home Screen, sign in, and come back here to turn notifications on.</li>
          </ol>
          <p style={{ ...desc, fontSize: '0.82rem' }}>Needs iOS 16.4 or later.</p>
        </div>
      )}

      {state === 'unsupported' && <p style={desc}>This browser can’t show notifications. Try Chrome on Android or a computer, or Vanta Studio added to your iPhone’s Home Screen.</p>}

      {state === 'denied' && <p style={desc}>Notifications are blocked for Vanta Studio on this device. Allow them in your browser or phone settings, then reload this page.</p>}

      {state === 'off' && <Button onClick={() => run(enablePush, 'Notifications are on for this device.')} loading={busy} loadingLabel="Turning on…">Turn on notifications</Button>}

      {state === 'on' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-success, #4caf7a)', fontWeight: 600 }}>✓ On for this device</span>
          <Button variant="secondary" size="sm" onClick={() => run(sendTestPush, 'Test sent. It should arrive in a few seconds.')} disabled={busy}>Send a test</Button>
          <Button variant="ghost" size="sm" onClick={() => run(disablePush, 'Notifications are off for this device.')} disabled={busy}>Turn off</Button>
        </div>
      )}

      {message && <p role="status" style={{ ...desc, color: 'var(--text)' }}>{message}</p>}
      {error && <p role="alert" style={{ ...desc, color: 'var(--color-danger)' }}>{error}</p>}
    </section>
  );
}

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.5rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', gridColumn: '1 / -1' };
const title = { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' };
const descText = { fontSize: '0.95rem', lineHeight: 1.55, color: 'var(--text-dim)', maxWidth: '72ch' };
const desc = { margin: 0, ...descText };
const steps = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
