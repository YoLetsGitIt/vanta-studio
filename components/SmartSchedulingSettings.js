'use client';

import { useRef, useState } from 'react';
import styles from './SmartSchedulingSettings.module.css';

const HOURS = ['9am', '10am', '11am', '12pm', '1pm', '2pm'];
const MONTHS = [
  { key: '2026-09', name: 'September', utilization: .75, dates: [8, 9, 10, 11, 14] },
  { key: '2026-10', name: 'October', utilization: .20, dates: [6, 7, 8, 9, 12] },
  { key: '2026-11', name: 'November', utilization: .30, dates: [3, 4, 5, 6, 9] },
];
const SAMPLE_BOOKINGS = [[2], [0, 1, 2, 3], [3], [0, 1, 2, 3, 4], [1, 2]];
const formatDate = key => new Date(`${key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

function Square({ state, label }) {
  return <span className={`${styles.square} ${styles[state] || ''}`} role="img" aria-label={`${label}: ${state}`}>
    <span aria-hidden="true">{state === 'booked' ? '×' : state === 'suggested' ? '★' : ''}</span>
  </span>;
}

export default function SmartSchedulingSettings({ mode, onChange, disabled = false }) {
  const quieter = mode === 'quieter_days' || mode === 'combined';
  const gaps = mode === 'minimize_gaps' || mode === 'combined';
  const [step, setStep] = useState(0);
  const [chosenTime, setChosenTime] = useState(null);
  const heading = useRef(null);
  function navigate(next) { setStep(next); setChosenTime(null); requestAnimationFrame(() => heading.current?.focus()); }
  const [monthChoice, setMonthChoice] = useState('2026-10');
  const [dateChoice, setDateChoice] = useState('');
  const [expandedTimes, setExpandedTimes] = useState('');
  const minimumMonth = Math.min(...MONTHS.map(month => month.utilization));
  const offeredMonths = quieter ? MONTHS.filter(month => month.utilization <= minimumMonth + .15).slice(0, 2) : MONTHS;
  const month = offeredMonths.find(item => item.key === monthChoice) || offeredMonths[0];
  const dates = month.dates.map((number, index) => ({ key: `${month.key}-${String(number).padStart(2, '0')}`, booked: SAMPLE_BOOKINGS[index], utilization: SAMPLE_BOOKINGS[index].length / HOURS.length }));
  const minimumDay = Math.min(...dates.map(day => day.utilization));
  const offeredDates = quieter ? dates.filter(day => day.utilization <= minimumDay + .15).slice(0, 6) : dates;
  const day = offeredDates.find(item => item.key === dateChoice) || offeredDates[0];
  const availableTimes = HOURS.map((_, index) => index).filter(index => !day.booked.includes(index));
  const ranked = [...availableTimes].sort((a, b) => Math.min(...day.booked.map(slot => Math.abs(a - slot))) - Math.min(...day.booked.map(slot => Math.abs(b - slot))) || a - b);
  const recommendedTimes = gaps && day.booked.length ? ranked.slice(0, 3).sort((a, b) => a - b) : availableTimes;
  const previewKey = `${mode}:${day.key}`;
  const expanded = expandedTimes === previewKey;
  const shownTimes = expanded ? availableTimes : recommendedTimes;
  function update(nextQuieter, nextGaps) {
    onChange(nextQuieter && nextGaps ? 'combined' : nextQuieter ? 'quieter_days' : nextGaps ? 'minimize_gaps' : 'all');
  }

  const explanation = step === 0
    ? quieter ? 'September already has plenty of bookings. Offer October and November.' : 'Every month with an opening is available to choose.'
    : step === 1 ? quieter ? 'Only these quieter days are offered.' : 'Every day with an opening is available to choose.'
    : gaps ? `There’s already a booking at ${HOURS[day.booked[0]]}. Suggest nearby times to keep appointments together.` : 'Every available start time on this date is shown.';

  return <div className={styles.root}>
    <p className={styles.description}>Use either option or both. Try them in the example below.</p>
    <fieldset className={styles.options} disabled={disabled}>
      <legend className={styles.srOnly}>Scheduling preferences</legend>
      <label className={`${styles.option} ${quieter ? styles.selected : ''}`}>
        <input type="checkbox" aria-label="Only offer quieter dates" checked={quieter} onChange={event => { update(event.target.checked, gaps); setChosenTime(null); }} aria-describedby="quieter-days-description" />
        <span><strong>Only offer quieter dates</strong><span id="quieter-days-description">Hide busier months and days from online booking.</span></span>
      </label>
      <label className={`${styles.option} ${gaps ? styles.selected : ''}`}>
        <input type="checkbox" aria-label="Keep appointments together" checked={gaps} onChange={event => { update(quieter, event.target.checked); setChosenTime(null); }} aria-describedby="minimise-gaps-description" />
        <span><strong>Keep appointments together</strong><span id="minimise-gaps-description">Suggest times beside existing appointments.</span></span>
      </label>
    </fieldset>

    <div className={styles.previewHeader}>
      <h3>See how it works</h3>
      <p>Try booking from this sample schedule. Change the options above to see the difference.</p>
    </div>
    <section className={styles.demo} aria-label="Interactive booking example">
      <nav className={styles.stepNav} aria-label="Example booking steps">
        {['Month', 'Date', 'Time'].map((label, index) => <button key={label} type="button" aria-current={step === index ? 'step' : undefined} onClick={() => navigate(index)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      <h4 ref={heading} tabIndex={-1} className={styles.stageTitle}>{step === 0 ? 'Choose a month' : step === 1 ? `Choose a date in ${month.name}` : `Choose a time on ${formatDate(day.key)}`}</h4>
      <div className={styles.comparison}>
        <div className={styles.before}>
          <h5>Before · studio availability</h5>
          {step === 0 && <div className={styles.monthOverview}>
            {MONTHS.map(item => <div key={item.key} className={styles.monthTile}>
              <strong>{item.name}</strong>
              <div className={styles.miniGrid} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < Math.round(item.utilization * 12) ? styles.filled : ''} />)}</div>
              <small>{item.key === '2026-09' ? 'Mostly booked' : 'More room'}</small>
            </div>)}
          </div>}
          {step === 1 && <table className={`${styles.table} ${styles.dateTable}`} aria-label="Example studio date availability">
            <thead><tr><th scope="col">Date</th>{HOURS.map(hour => <th scope="col" key={hour}>{hour}</th>)}</tr></thead>
            <tbody>{dates.map(item => <tr key={item.key}><th scope="row">{formatDate(item.key)}</th>{HOURS.map((hour, index) => <td key={hour}><Square label={`${formatDate(item.key)} ${hour}`} state={item.booked.includes(index) ? 'booked' : 'available'} /></td>)}</tr>)}</tbody>
          </table>}
          {step === 2 && <table className={styles.table} aria-label="Example studio time availability">
            <thead><tr>{HOURS.map(hour => <th scope="col" key={hour}>{hour}</th>)}</tr></thead>
            <tbody><tr>{HOURS.map((hour, index) => <td key={hour}><Square label={hour} state={day.booked.includes(index) ? 'booked' : gaps && recommendedTimes.includes(index) ? 'suggested' : 'available'} /></td>)}</tr></tbody>
          </table>}
          <p className={styles.legend}>{step === 0 ? 'Filled squares represent bookings.' : '× Booked · Empty square: available'}{step === 2 && gaps ? ' · ★ Suggested' : ''}</p>
        </div>
        <div className={styles.after}>
          <h5>What your client sees</h5>
          <div key={`${step}:${mode}:${month.key}:${day.key}:${expanded}`} className={styles.choices}>
            {step === 0 && <div className={styles.choiceRow} role="group" aria-label="Example client month options">
              {offeredMonths.map(item => <button type="button" key={item.key} className={styles.choice} onClick={() => { setMonthChoice(item.key); setDateChoice(''); navigate(1); }}>{item.name}<span aria-hidden="true"> →</span></button>)}
            </div>}
            {step === 1 && <div className={styles.dateChoices} role="group" aria-label="Example client date options">
              {offeredDates.map(item => <button type="button" key={item.key} aria-label={formatDate(item.key)} className={`${styles.choice} ${styles.dateButton}`} onClick={() => { setDateChoice(item.key); navigate(2); }}><span>{new Date(`${item.key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short' })}</span><strong>{Number(item.key.slice(-2))}</strong></button>)}
            </div>}
            {step === 2 && <div className={styles.choiceRow} role="group" aria-label="Example client time options">
              {shownTimes.map(index => <button type="button" key={index} aria-pressed={chosenTime === index} className={`${styles.choice} ${chosenTime === index ? styles.activeChoice : ''}`} onClick={() => setChosenTime(index)}>{HOURS[index]}</button>)}
            </div>}
          </div>
          {step === 2 && gaps && availableTimes.length > recommendedTimes.length && <button type="button" className={styles.expandButton} aria-expanded={expanded} onClick={() => { setExpandedTimes(expanded ? '' : previewKey); setChosenTime(null); }}>{expanded ? 'Show suggested times' : 'Show all times'}</button>}
          <p className={styles.explanation} role="status">{explanation}</p>
          {step === 2 && chosenTime !== null && <p className={styles.selection} role="status">Selected: {formatDate(day.key)} at {HOURS[chosenTime]}. This is just a demo.</p>}
          {step === 2 && gaps && <p className={styles.note}>“Show all times” reveals more times on this date only.</p>}
        </div>
      </div>
      <p className={styles.demoNote}>Sample schedule · no real appointment is made</p>
    </section>
    <details className={styles.rules}>
      <summary>How dates are chosen</summary>
      <p>We compare booked hours with the artist’s remaining working hours over the next 90 days, accounting for leave.</p>
      <p>Only offer quieter dates: choose up to two months within 15 percentage points of the least-booked eligible month, then up to six dates per month within 15 points of its quietest eligible date. Busier periods are hidden.</p>
      <p>Keep appointments together: suggest up to three starts nearest existing bookings or calendar commitments. Earlier starts break ties. Days without commitments show every available time.</p>
      <p>This example uses one-hour appointments and hourly starts. Real bookings use the appointment’s duration and a 30-minute start grid. Month totals include dates outside the five sample dates.</p>
    </details>
  </div>;
}
