'use client';

// Settings → Bookings: who confirms the time of a studio booking.
import { useState } from 'react';
import { saveBookingManagement, useBookingManagement } from '@/lib/bookingManagement';

const OPTIONS = [
  { value: 'artist', title: 'Artists', text: 'When a client picks a time from your link, it waits for the artist (or the studio) to confirm it.' },
  { value: 'studio', title: 'The studio', text: 'The studio books times itself with “Book a time”, and times clients pick from your link are booked straight in. Artists don’t need to accept.' },
];

export default function BookingManagementSettings({ styles: s }) {
  const mode = useBookingManagement();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function choose(value) {
    if (value === mode || saving) return;
    setSaving(true); setError(''); setSaved(false);
    try { await saveBookingManagement(value); setSaved(true); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <section style={s.card} aria-labelledby="booking-management-title">
      <h2 id="booking-management-title" style={s.sectionTitle}>Who confirms booking times</h2>
      <p style={s.sectionDesc}>Choose whether artists take part in confirming studio bookings, or the studio handles everything.</p>
      {mode === null ? <div style={s.loadingDot} /> : (
        <div role="radiogroup" aria-labelledby="booking-management-title" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {OPTIONS.map(o => {
            const on = mode === o.value;
            return (
              <button key={o.value} type="button" role="radio" aria-checked={on} disabled={saving} onClick={() => choose(o.value)}
                style={{
                  display: 'flex', gap: '0.75rem', alignItems: 'flex-start', textAlign: 'left', width: '100%', minHeight: 44,
                  padding: '0.8rem 0.9rem', borderRadius: 10, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                  background: on ? 'var(--accent-tint)' : 'var(--bg-base)',
                  border: `1px solid ${on ? 'var(--accent-tint-border)' : 'var(--border)'}`,
                }}>
                <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? 'var(--accent)' : 'var(--text-ghost)'}`, boxShadow: on ? 'inset 0 0 0 3px var(--bg-card)' : 'none', background: on ? 'var(--accent)' : 'transparent' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>{o.title}</span>
                  <span style={{ fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{o.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {saved && !error && <p role="status" style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saved.</p>}
      {error && <p role="alert" style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-danger)' }}>{error}</p>}
    </section>
  );
}
