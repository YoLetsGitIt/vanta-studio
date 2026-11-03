'use client';

// Settings → Booking requests: who confirms the time of a studio booking.
// Each option shows how a booking moves from request to booked, so the
// difference is visible before choosing (choosing saves straight away).
import { useState } from 'react';
import { saveBookingManagement, useBookingManagement } from '@/lib/bookingManagement';
import styles from './BookingManagementSettings.module.css';

// What happens to a booking request in each mode. Either way the client has
// the last word: they confirm by picking one of the offered times (and paying
// any deposit). "Book a time" (studio mode only) skips the client step.
const OPTIONS = [
  {
    value: 'artist',
    title: 'Artists confirm',
    summary: 'Artists choose which times to offer. Good when artists manage their own diaries.',
    steps: [
      { who: 'Client', text: 'Sends a booking request from your booking link or website.' },
      { who: 'Artist', text: 'Reviews the request in the Vanta app and sends the client some times.', key: true },
      { who: 'Client', text: 'Confirms by picking a time from the email, and pays any deposit.' },
      { who: 'Booked', text: 'The booking is confirmed and on the artist’s schedule.', done: true },
    ],
  },
  {
    value: 'studio',
    title: 'The studio confirms',
    summary: 'The front desk offers times. Artists don’t need to accept. Good when the studio runs the diary.',
    steps: [
      { who: 'Client', text: 'Sends a booking request from your booking link or website.' },
      { who: 'Studio', text: 'Offers the client some times from Bookings.', key: true },
      { who: 'Client', text: 'Confirms by picking a time from the email, and pays any deposit.' },
      { who: 'Booked', text: 'The booking is confirmed and on the artist’s schedule.', done: true },
    ],
    note: 'Already agreed a time with the client? Use “Book a time” to book it straight in without the client confirming.',
  },
];

function Flow({ steps, label }) {
  return (
    <ol className={styles.flow} aria-label={label}>
      {steps.map((step, index) => (
        <li key={index} className={styles.step} data-key={step.key || undefined} data-done={step.done || undefined}>
          <span className={styles.marker} aria-hidden="true">{step.done ? '✓' : index + 1}</span>
          <span className={styles.who}>{step.who}</span>
          <span className={styles.text}>{step.text}</span>
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
        When a client sends a booking request, someone offers them times and the client confirms one. Choose whether the artist or the studio offers the times. Requests always arrive in Bookings and on your Dashboard either way.
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
                  <p className={styles.flowHeading}>How a booking works</p>
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
