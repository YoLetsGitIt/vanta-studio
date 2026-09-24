'use client';

import { useEffect, useState } from 'react';
import { getSMSSettings, updateSMSSettings } from '@/lib/api';

export default function SMSSettings({ styles: s }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    getSMSSettings().then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  async function toggle() {
    setSaving(true); setError('');
    try { setData(await updateSMSSettings(!data.enabled)); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return (
    <section style={{ ...s.card, gridColumn: '1 / -1' }}>
      <h2 style={s.sectionTitle}>SMS reminders</h2>
      <p style={s.sectionDesc}>One included SMS reminder per appointment, sent 24 hours ahead to clients who opt in.</p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading SMS settings…</p>}
      {data && <>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)', fontSize: 14 }}>
          <input type="checkbox" role="switch" checked={data.enabled} disabled={saving} onChange={toggle} style={{ accentColor: 'var(--accent)' }} />
          Send a 24-hour SMS reminder
        </label>
        {!data.available
          ? <p role="status" style={s.sectionDesc}>Awaiting activation — your preference is saved, and email reminders continue as usual.</p>
          : <p style={{ ...s.sectionDesc, marginTop: 16 }}>This month: {data.sent_this_month} sent, {data.failed_this_month} failed</p>}
      </>}
    </section>
  );
}
