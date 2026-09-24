'use client';

import { useEffect, useState } from 'react';
import { getBookingSMS, updateBookingSMS } from '@/lib/api';

const labels = {
  not_opted_in: 'Client has not opted in', unavailable: 'SMS delivery awaiting activation',
  disabled: 'SMS reminders turned off for this studio', invalid_phone: 'A valid mobile number is needed',
  not_confirmed: 'Waiting for a confirmed appointment', too_late: 'Reminder window has passed',
  short_notice: 'Booked less than 24 hours ahead — SMS skipped', scheduled: 'Scheduled for 24 hours before the appointment',
  submitting: 'Submitting reminder', accepted: 'Accepted for delivery', queued: 'Queued for delivery',
  sending: 'Sending', sent: 'Sent — delivery not yet confirmed', delivered: 'Delivered',
  retry: 'Temporarily delayed — will retry', failed: 'SMS failed', undelivered: 'SMS could not be delivered',
  unknown: 'Delivery uncertain — needs review; no automatic resend', suppressed: 'Client has stopped SMS reminders',
};

const TONES = {
  delivered: 'success',
  scheduled: 'info', submitting: 'info', accepted: 'info', queued: 'info', sending: 'info', sent: 'info',
  retry: 'warning', unknown: 'warning', short_notice: 'warning', too_late: 'warning', unavailable: 'warning', disabled: 'warning', not_confirmed: 'warning', invalid_phone: 'warning',
  failed: 'danger', undelivered: 'danger', suppressed: 'danger',
};
const SHORT = {
  not_opted_in: 'Not opted in', delivered: 'Delivered', scheduled: 'Scheduled', sent: 'Sent', failed: 'Failed', suppressed: 'Opted out',
  undelivered: 'Undelivered', retry: 'Retrying', unknown: 'Needs review', short_notice: 'Skipped', too_late: 'Too late', disabled: 'Off', unavailable: 'Not active', not_confirmed: 'Waiting', invalid_phone: 'Bad number',
};

export default function BookingSMS({ bookingId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    getBookingSMS(bookingId).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [bookingId]);
  async function toggle() {
    const previous = data;
    setData({ ...data, opt_in: !data.opt_in });
    setSaving(true); setError('');
    try { setData(await updateBookingSMS(bookingId, !previous.opt_in)); }
    catch (err) { setData(previous); setError(err.message); }
    finally { setSaving(false); }
  }
  const status = data?.delivery?.status;
  const tone = TONES[status];
  const pill = tone
    ? { background: `var(--color-${tone}-surface)`, color: `var(--color-${tone})`, border: `1px solid var(--color-${tone}-border)` }
    : { background: 'var(--bg-chip)', color: 'var(--text-dim)', border: '1px solid var(--border-strong)' };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.85rem 0 0.15rem', borderTop: '1px solid var(--border)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>SMS reminder</span>
      {status && <span style={{ ...pill, fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: 20, whiteSpace: 'nowrap' }}>{SHORT[status] || status}</span>}
    </div>
    {error && <p role="alert" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-danger)' }}>{error}</p>}
    {!data && !error && <p role="status" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading reminder…</p>}
    {data && <>
      {status !== 'not_opted_in' && <p role="status" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-dim)', lineHeight: 1.45 }}>{labels[status] || status}</p>}
      {data.delivery.error_code && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Reference: {data.delivery.error_code}</p>}
      {data.opted_out ? <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-dim)' }}>The client has opted out of Vanta SMS reminders. Their preference cannot be overridden here.</p> :
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.45, fontSize: '0.9rem', color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={data.opt_in} disabled={saving} onChange={toggle} style={{ accentColor: 'var(--accent)', marginTop: 3, width: 16, height: 16 }} />
          <span>I have the client’s permission to send one SMS reminder for this appointment.</span>
        </label>}
    </>}
  </div>;
}
