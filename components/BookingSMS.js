'use client';

import { useEffect, useState } from 'react';
import { getBookingSMS, updateBookingSMS } from '@/lib/api';
import { Fact, Switch } from '@/components/ui/DetailParts';

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
  const hint = { margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.85rem 0 0.15rem', borderTop: '1px solid var(--border)' }}>
    <Fact label="SMS reminder" control>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
        {status && <span style={{ ...pill, fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: 20, whiteSpace: 'nowrap' }}>{SHORT[status] || status}</span>}
        {data && !data.opted_out && (
          <Switch aria-label="I have the client’s permission to send one SMS reminder for this appointment." checked={data.opt_in} disabled={saving} onChange={toggle} />
        )}
      </span>
    </Fact>
    {error && <p role="alert" style={{ ...hint, color: 'var(--color-danger)' }}>{error}</p>}
    {!data && !error && <p role="status" style={hint}>Loading reminder…</p>}
    {data && <>
      {status !== 'not_opted_in' && <p role="status" style={{ ...hint, color: 'var(--text-dim)' }}>{labels[status] || status}</p>}
      {data.delivery.error_code && <p style={hint}>Reference: {data.delivery.error_code}</p>}
      {data.opted_out
        ? <p style={hint}>The client has opted out of Vanta SMS reminders. Their preference cannot be overridden here.</p>
        : <p style={hint}>Turn on to confirm the client gave permission for one SMS reminder for this appointment.</p>}
    </>}
  </div>;
}
