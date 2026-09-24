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
    setSaving(true); setError('');
    try { setData(await updateBookingSMS(bookingId, !data.opt_in)); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
    <strong>SMS reminder</strong>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading reminder…</p>}
    {data && <>
      <p role="status">{labels[data.delivery.status] || data.delivery.status}</p>
      {data.delivery.error_code && <p>Reference: {data.delivery.error_code}</p>}
      {data.opted_out ? <p>The client has opted out of Vanta SMS reminders. Their preference cannot be overridden here.</p> :
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.5 }}>
          <input type="checkbox" checked={data.opt_in} disabled={saving} onChange={toggle} style={{ accentColor: 'var(--accent)' }} />
          I have the client’s permission to send one SMS reminder for this appointment.
        </label>}
    </>}
  </div>;
}
