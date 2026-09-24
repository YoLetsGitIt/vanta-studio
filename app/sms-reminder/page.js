'use client';

import { useEffect, useState } from 'react';
import { getSMSReminder, unsubscribeSMS } from '@/lib/api';

export default function SMSReminderPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token) { setError('This reminder link is incomplete.'); return; }
    let active = true;
    getSMSReminder(token).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  async function stopSMS() {
    setSaving(true); setError('');
    try {
      await unsubscribeSMS(data.appointment.unsubscribe_token);
      setData(value => ({ ...value, appointment: { ...value.appointment, opted_out: true } }));
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  const appointment = data?.appointment;
  return <main style={{ maxWidth: 520, margin: '10vh auto', padding: 24, color: 'var(--text)', lineHeight: 1.7 }}>
    <h1>{appointment?.studio_name || 'Appointment reminder'}</h1>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading your appointment…</p>}
    {appointment && <>
      <p>{appointment.status === 'cancelled' ? 'This appointment has been cancelled.' : 'Your appointment'}</p>
      {appointment.chosen_time && <p><strong>{new Date(appointment.chosen_time).toLocaleString('en-AU', {
        timeZone: appointment.timezone, dateStyle: 'full', timeStyle: 'short',
      })}</strong><br />{appointment.timezone}</p>}
      {appointment.address && <p>{appointment.address}</p>}
      {appointment.status === 'confirmed' && <p style={{ display: 'flex', gap: 20 }}>
        {data.reschedule_url && <a href={data.reschedule_url} referrerPolicy="no-referrer">Reschedule</a>}
        {data.cancel_url && <a href={data.cancel_url} referrerPolicy="no-referrer">Cancel appointment</a>}
      </p>}
      <hr style={{ margin: '28px 0', border: 0, borderTop: '1px solid var(--border)' }} />
      <h2 style={{ fontSize: 18 }}>SMS preferences</h2>
      {appointment.opted_out ? <p role="status">You’ve stopped SMS reminders from all studios using Vanta. Your booking is unchanged.</p> : <>
        <p>Stop future SMS reminders to this mobile number from all studios using Vanta. This will not cancel your appointment.</p>
        <button onClick={stopSMS} disabled={saving} style={{ padding: '12px 18px', cursor: 'pointer', borderRadius: 8 }}>{saving ? 'Saving…' : 'Stop SMS reminders'}</button>
      </>}
    </>}
  </main>;
}
