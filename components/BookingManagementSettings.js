'use client';

// Settings → Booking requests: who confirms the time of a studio booking.
// Each option shows how a booking moves from request to booked, so the
// difference is visible before choosing (choosing saves straight away).
import { useState } from 'react';
import { saveBookingManagement, useBookingManagement } from '@/lib/bookingManagement';
import styles from './BookingManagementSettings.module.css';

// How a booking request becomes a booking, for each mode. It depends on whether the
// booking form requires weekly availability: if it does, clients include it with
// their request; if not, they send it after the studio or artist replies.
const SENDS_TIMES = 'Sends times, a quote and the session length';
const PAYS = 'Picks a time and pays the deposit';
function flowFor(mode, availabilityRequired) {
  const request = { who: 'Client', does: availabilityRequired ? 'Sends a request with their weekly availability' : 'Sends a request' };
  const availability = { who: 'Client', does: 'Sends their availability' };
  if (mode === 'artist') {
    // A client who picks an artist skips assigning, and gives their availability up front.
    return [
      request,
      { who: 'Studio', does: 'Assigns an artist', skip: 'Skipped if the client picks an artist' },
      ...(availabilityRequired ? [] : [{ ...availability, skip: 'Skipped if the client picks an artist (it comes with their request)' }]),
      { who: 'Artist', does: SENDS_TIMES, key: true },
      { who: 'Client', does: PAYS },
      { who: 'Booked', does: 'Confirmed once the deposit is paid', done: true },
    ];
  }
  return [
    request,
    ...(availabilityRequired
      ? [{ who: 'Studio', does: SENDS_TIMES, key: true }]
      : [{ who: 'Studio', does: 'Sends a quote and the session length' }, availability, { who: 'Studio', does: 'Sends times', key: true }]),
    { who: 'Client', does: PAYS },
    { who: 'Booked', does: 'The artist is told once it’s booked', done: true },
  ];
}

const OPTIONS = [
  {
    value: 'artist',
    title: 'Artists confirm',
    summary: 'The studio assigns an artist, who sends the client times, a quote and the session length. Good when artists manage their own diaries.',
  },
  {
    value: 'studio',
    title: 'The studio confirms',
    summary: 'The studio sends the times, quote and session length. Artists don’t need to accept. Good when the studio runs the diary.',
    note: 'Already agreed a time with the client? Use “Book a time” to book it straight in.',
  },
];

function Flow({ steps, label }) {
  return (
    <ol className={styles.flow} aria-label={label}>
      {steps.map((step, index) => (
        <li key={index} className={styles.step} data-key={step.key || undefined} data-done={step.done || undefined} data-skip={step.skip ? true : undefined}>
          <span aria-hidden="true" className={styles.marker}>{step.done ? '✓' : index + 1}</span>
          <span className={styles.who}>{step.who}</span>
          <span className={styles.does}>
            {step.does}
            {step.skip && <span className={styles.skip}>{step.skip}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function BookingManagementSettings({ styles: s, availabilityRequired = false }) {
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
        Choose who replies to a booking request with times, a quote and the session length. Either way, it’s booked once the client picks a time and pays the deposit.
      </p>
      <p className={styles.formNote}>
        {availabilityRequired
          ? 'Your booking form asks for weekly availability, so clients include it with their request.'
          : 'Your booking form doesn’t require weekly availability, so clients send it after you reply.'}
        {' '}You can change this in Booking form.
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
                  <Flow steps={flowFor(o.value, availabilityRequired)} label={`How a booking works when ${o.title.toLowerCase()}`} />
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
