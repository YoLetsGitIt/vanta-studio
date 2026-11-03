'use client';

// Settings → Booking requests: who confirms the time of a studio booking.
// Each option shows how a booking moves from request to booked, so the
// difference is visible before choosing (choosing saves straight away).
import { useState } from 'react';
import { saveBookingManagement, useBookingManagement } from '@/lib/bookingManagement';
import styles from './BookingManagementSettings.module.css';

// Who acts on a booking request, in order (mirrors the backend). Artist mode:
// the studio sends times, the client picks, the artist confirms. Studio mode:
// the booking is confirmed as soon as the client picks.
const OPTIONS = [
  {
    value: 'artist',
    title: 'Artists confirm',
    summary: 'The artist confirms each time the client picks. Good when artists manage their own diaries.',
    steps: [
      { who: 'Client', does: 'Requests' },
      { who: 'Studio', does: 'Sends times' },
      { who: 'Client', does: 'Picks a time' },
      { who: 'Artist', does: 'Confirms', key: true },
      { who: 'Client', does: 'Booked', done: true },
    ],
  },
  {
    value: 'studio',
    title: 'The studio confirms',
    summary: 'Booked as soon as the client picks a time. Artists don’t need to accept. Good when the studio runs the diary.',
    steps: [
      { who: 'Client', does: 'Requests' },
      { who: 'Studio', does: 'Sends times', key: true },
      { who: 'Client', does: 'Picks a time' },
      { who: 'Client', does: 'Booked', done: true },
    ],
    note: 'Already agreed a time with the client? Use “Book a time” to book it straight in.',
  },
];

function Flow({ steps, label }) {
  return (
    <ol className={styles.flow} aria-label={label} style={{ '--steps': steps.length }}>
      {steps.map((step, index) => (
        <li key={index} className={styles.step} data-key={step.key || undefined} data-done={step.done || undefined}>
          <span className={styles.who}>{step.done ? '✓ ' : ''}{step.who}</span>
          <span className={styles.does}>{step.does}</span>
        </li>
      ))}
    </ol>
  );
}

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
      <p style={s.sectionDesc}>
        When a client sends a booking request, the studio sends them times and the client picks one. Choose whether the artist then confirms that time, or it’s booked straight away.
      </p>
      {mode === null ? <div style={s.loadingDot} /> : (
        <div role="radiogroup" aria-labelledby="booking-management-title" className={styles.options}>
          {OPTIONS.map(o => {
            const on = mode === o.value;
            return (
              <div key={o.value} className={styles.option} data-on={on || undefined}>
                <button type="button" role="radio" aria-checked={on} aria-describedby={`booking-flow-${o.value}`} disabled={saving} onClick={() => choose(o.value)} className={styles.choice}>
                  <span aria-hidden="true" className={styles.radio} />
                  <span className={styles.choiceText}>
                    <span className={styles.title}>{o.title}{on && <span className={styles.current}>Current</span>}</span>
                    <span className={styles.summary}>{o.summary}</span>
                  </span>
                </button>
                <div id={`booking-flow-${o.value}`} className={styles.flowWrap}>
                                    <Flow steps={o.steps} label={`How a booking works when ${o.title.toLowerCase()}`} />
                  {o.note && <p className={styles.note}>{o.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {saved && !error && <p role="status" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Saved.</p>}
      {error && <p role="alert" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-danger)' }}>{error}</p>}
    </section>
  );
}
