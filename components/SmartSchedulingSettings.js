'use client';

import styles from './SmartSchedulingSettings.module.css';

const HOURS = ['9am', '10am', '11am', '12pm', '1pm', '2pm'];
const WEEK = [
  { name: 'Mon', booked: [1, 2, 3, 4] },
  { name: 'Tue', booked: [2] },
  { name: 'Wed', booked: [0, 1, 2] },
  { name: 'Thu', booked: [3] },
  { name: 'Fri', booked: [0, 1, 2, 3, 4] },
];
// This simplified example uses one-hour appointments and hourly start times.
const QUIET_DAYS = [...WEEK].sort((a, b) => a.booked.length - b.booked.length).slice(0, 3).map(day => day.name);
const TUESDAY = WEEK[1];
const GAP_TIMES = HOURS.map((_, index) => index)
  .filter(index => !TUESDAY.booked.includes(index))
  .sort((a, b) => Math.abs(a - 2) - Math.abs(b - 2) || a - b).slice(0, 3);

function Square({ state, label }) {
  return <span className={`${styles.square} ${styles[state] || ''}`} role="img" aria-label={`${label}: ${state}`}>
    <span aria-hidden="true">{state === 'booked' ? '×' : state === 'suggested' ? '★' : ''}</span>
  </span>;
}

export default function SmartSchedulingSettings({ mode, onChange, disabled = false }) {
  const quieter = mode === 'quieter_days' || mode === 'combined';
  const gaps = mode === 'minimize_gaps' || mode === 'combined';
  function update(nextQuieter, nextGaps) {
    onChange(nextQuieter && nextGaps ? 'combined' : nextQuieter ? 'quieter_days' : nextGaps ? 'minimize_gaps' : 'all');
  }
  const summary = quieter && gaps
    ? 'Both on: suggest quieter days first, then times that fit around existing bookings.'
    : quieter ? 'Suggest quieter days. Show all available times on the chosen day.'
    : gaps ? 'Suggest times closest to existing bookings, on any available day.'
    : 'Both off: show all available dates and times.';

  return <div className={styles.root}>
    <p className={styles.description}>Use either option or both together. Clients can always see all available dates and times.</p>
    <fieldset className={styles.options} disabled={disabled}>
      <legend className={styles.srOnly}>Scheduling preferences</legend>
      <label className={`${styles.option} ${quieter ? styles.selected : ''}`}>
        <input type="checkbox" aria-label="Fill quieter days" checked={quieter} onChange={event => update(event.target.checked, gaps)} aria-describedby="quieter-days-description" />
        <span><strong>Fill quieter days</strong><span id="quieter-days-description">Suggest the three available dates with the lowest proportion of the artist’s working hours booked.</span></span>
      </label>
      <label className={`${styles.option} ${gaps ? styles.selected : ''}`}>
        <input type="checkbox" aria-label="Minimise gaps" checked={gaps} onChange={event => update(quieter, event.target.checked)} aria-describedby="minimise-gaps-description" />
        <span><strong>Minimise gaps</strong><span id="minimise-gaps-description">Suggest up to three times closest to existing bookings and calendar commitments.</span></span>
      </label>
    </fieldset>
    <p className={styles.summary} role="status">{summary}</p>

    <div className={styles.previewHeader}>
      <div><h3>See how it works</h3><p>Example only · one-hour appointments, hourly starts. Change the options above to update the diagrams.</p></div>
      <div className={styles.legend} aria-label="Availability legend">
        <span><Square state="booked" label="Legend" /> Booked</span>
        <span><Square state="available" label="Legend" /> Available</span>
        <span><Square state="suggested" label="Legend" /> Suggested</span>
      </div>
    </div>

    <div className={styles.examples}>
      <figure className={styles.example}>
        <figcaption><strong>1. Which days come first?</strong><span>Same six working hours each day.</span></figcaption>
        <table className={styles.table} aria-label="Example week availability">
          <thead><tr><th scope="col">Day</th>{HOURS.map(hour => <th scope="col" key={hour}>{hour}</th>)}</tr></thead>
          <tbody>{WEEK.map(day => {
            const suggested = quieter && QUIET_DAYS.includes(day.name);
            return <tr key={day.name} className={suggested ? styles.suggestedDay : ''}>
              <th scope="row"><span>{day.name}{suggested && <span aria-label="suggested day"> ★</span>}</span><small>{day.booked.length}/6 booked</small></th>
              {HOURS.map((hour, index) => <td key={hour}><Square label={`${day.name} ${hour}`} state={day.booked.includes(index) ? 'booked' : 'available'} /></td>)}
            </tr>;
          })}</tbody>
        </table>
        <p className={styles.explanation}>{quieter
          ? 'Tue and Thu are suggested first (1/6 hours booked), then Wed (3/6). Mon and Fri remain available in the calendar.'
          : 'No days are prioritised. Clients choose from all available dates.'}</p>
        <div className={styles.result}><span>Suggested dates</span><strong>{quieter ? 'Tue → Thu → Wed' : 'No preference'}</strong></div>
      </figure>

      <figure className={styles.example}>
        <figcaption><strong>2. Which times come first?</strong><span>Tuesday · one booking from 11am to 12pm.</span></figcaption>
        <table className={styles.table} aria-label="Example Tuesday availability">
          <thead><tr><th scope="col">Times</th>{HOURS.map(hour => <th scope="col" key={hour}>{hour}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">All</th>{HOURS.map((hour, index) => <td key={hour}><Square label={`All ${hour}`} state={TUESDAY.booked.includes(index) ? 'booked' : 'available'} /></td>)}</tr>
            <tr><th scope="row">First<br />shown</th>{HOURS.map((hour, index) => <td key={hour}><Square label={`First shown ${hour}`} state={TUESDAY.booked.includes(index) ? 'booked' : gaps && GAP_TIMES.includes(index) ? 'suggested' : 'available'} /></td>)}</tr>
          </tbody>
        </table>
        <p className={styles.explanation}>{gaps
          ? '10am ends at the booking and 12pm starts after it. 9am is the next closest option; earlier times win ties. The three suggestions appear in time order.'
          : 'All five available start times are shown. Turn on Minimise gaps to suggest the closest fits.'}</p>
        <div className={styles.result}><span>Client sees</span><strong>{gaps ? '9am · 10am · 12pm' : '9am · 10am · 12pm · 1pm · 2pm'}</strong></div>
        <p className={styles.note}>{gaps ? '1pm and 2pm are still bookable under “Show all times”. Empty days show every available time.' : 'Booked times are never offered.'}</p>
      </figure>
    </div>
  </div>;
}
