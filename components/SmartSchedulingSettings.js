'use client';

import { useState } from 'react';
import Dialog from './ui/Dialog';
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

function SelectionMark({ selected }) {
  return <span className={styles.selectionMark} aria-hidden="true">{selected ? '✓' : ''}</span>;
}

export default function SmartSchedulingSettings({ mode, onChange, disabled = false }) {
  const quieterMonths = ['quieter_days', 'combined', 'quieter_months', 'quieter_months_gaps'].includes(mode);
  const quieter = ['quieter_days', 'combined', 'quieter_days_only', 'quieter_days_gaps'].includes(mode);
  const gaps = ['minimize_gaps', 'combined', 'quieter_months_gaps', 'quieter_days_gaps'].includes(mode);
  const [step, setStep] = useState(null);
  const [chosenTime, setChosenTime] = useState(null);
  const titles = ['Only offer quieter months', 'Only offer quieter days', 'Keep appointments together'];
  function closeExample() { setStep(null); }
  const [monthChoice, setMonthChoice] = useState('2026-10');
  const [dateChoice, setDateChoice] = useState('');
  const [expandedTimes, setExpandedTimes] = useState('');
  const minimumMonth = Math.min(...MONTHS.map(month => month.utilization));
  const offeredMonths = quieterMonths ? MONTHS.filter(month => month.utilization <= minimumMonth + .15).slice(0, 2) : MONTHS;
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
  function update(index, checked) {
    const flags = [quieterMonths, quieter, gaps];
    flags[index] = checked;
    const modes = ['all', 'quieter_months', 'quieter_days_only', 'quieter_days', 'minimize_gaps', 'quieter_months_gaps', 'quieter_days_gaps', 'combined'];
    onChange(modes[(flags[0] ? 1 : 0) + (flags[1] ? 2 : 0) + (flags[2] ? 4 : 0)]);
    setChosenTime(null);
  }

  const explanation = step === 0
    ? quieterMonths ? 'September already has plenty of bookings. Offer October and November.' : 'Every month with an opening is available to choose.'
    : step === 1 ? quieter ? 'Only these quieter days are offered.' : 'Every day with an opening is available to choose.'
    : gaps ? `There’s already a booking at ${HOURS[day.booked[0]]}. Suggest nearby times to keep appointments together.` : 'Every available start time on this date is shown.';

  return <div className={styles.root}>
    <fieldset className={styles.options} disabled={disabled}>
      <legend className={styles.srOnly}>Scheduling preferences</legend>
      {[
        { title: 'Only offer quieter months', description: 'Hide busier months from online booking.', checked: quieterMonths },
        { title: 'Only offer quieter days', description: 'Hide busier days within each available month.', checked: quieter },
        { title: 'Keep appointments together', description: 'Suggest times beside existing appointments.', checked: gaps },
      ].map((option, index) => <div key={option.title} className={`${styles.option} ${option.checked ? styles.selected : ''}`}><label className={styles.optionLabel}>
        <input type="checkbox" aria-label={option.title} checked={option.checked} onChange={event => update(index, event.target.checked)} aria-describedby={`scheduling-description-${index}`} />
        <span className={styles.optionCopy}><strong>{option.title}</strong><span id={`scheduling-description-${index}`}>{option.description}</span></span>
      </label><button type="button" className={styles.exampleLink} aria-label={`See example: ${option.title}`} aria-haspopup="dialog" onClick={() => { setStep(index); setChosenTime(null); setExpandedTimes(''); }}>See example</button></div>)}
    </fieldset>

    {step !== null && <Dialog title={titles[step]} description="See how it works · sample schedule" onClose={closeExample} maxWidth={760} className={styles.exampleModal}
      footer={<button type="button" className={styles.choice} onClick={closeExample}>Done</button>}>
      <button type="button" className={styles.closeExample} aria-label="Close example" onClick={closeExample}>×</button>
      <div className={styles.stageHeader}><h4 className={styles.stageTitle}>{step === 0 ? 'Choose a month' : step === 1 ? `Choose a date in ${month.name}` : `Choose a time on ${formatDate(day.key)}`}</h4></div>
      {step === 1 && <p className={styles.contextNote}>{quieterMonths ? `${month.name} is offered because quieter months is also on.` : 'Quieter months is off, so all months with openings remain available.'}</p>}
      <div className={styles.comparison}>
        <div className={styles.before}>
          <h5>Studio availability</h5>
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
          <h5>Client choices</h5>
          <div>
            {step === 0 && <div className={styles.choiceRow} role="group" aria-label="Example client month options">
              {offeredMonths.map(item => <button type="button" key={item.key} className={`${styles.choice} ${month.key === item.key ? styles.activeChoice : ''}`} aria-pressed={month.key === item.key} onClick={() => { setMonthChoice(item.key); setDateChoice(''); setChosenTime(null); }}><SelectionMark selected={month.key === item.key} /><span>{item.name}</span></button>)}
            </div>}
            {step === 1 && <div className={styles.dateChoices} role="group" aria-label="Example client date options">
              {offeredDates.map(item => <button type="button" key={item.key} aria-label={formatDate(item.key)} className={`${styles.choice} ${styles.dateButton} ${day.key === item.key ? styles.activeChoice : ''}`} aria-pressed={day.key === item.key} onClick={() => { setDateChoice(item.key); setChosenTime(null); }}><SelectionMark selected={day.key === item.key} /><span>{new Date(`${item.key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short' })}</span><strong>{Number(item.key.slice(-2))}</strong></button>)}
            </div>}
            {step === 2 && <div className={`${styles.choiceRow} ${styles.timeChoices}`} role="group" aria-label="Example client time options">
              {shownTimes.map(index => <button type="button" key={index} aria-pressed={chosenTime === index} className={`${styles.choice} ${chosenTime === index ? styles.activeChoice : ''}`} onClick={() => setChosenTime(index)}><SelectionMark selected={chosenTime === index} /><span>{HOURS[index]}</span></button>)}
            </div>}
          </div>
          {step === 2 && gaps && availableTimes.length > recommendedTimes.length && <button type="button" className={styles.expandButton} aria-expanded={expanded} onClick={() => { setExpandedTimes(expanded ? '' : previewKey); setChosenTime(null); }}>{expanded ? 'Show suggested times' : 'Show all times'}</button>}
          <p className={styles.explanation} role="status">{explanation}</p>
          {step === 2 && chosenTime !== null && <p className={styles.selection} role="status"><span aria-hidden="true">✓ </span>Selected: {formatDate(day.key)} at {HOURS[chosenTime]}</p>}
        </div>
      </div>
    <details className={styles.rules}>
      <summary>How it’s calculated</summary>
      <p>We compare booked hours with the artist’s remaining working hours over the next 90 days, accounting for leave.</p>
      {step === 0 && <p>Only offer quieter months: choose up to two months within 15 percentage points of the least-booked eligible month. Other months are hidden.</p>}
      {step === 1 && <p>Only offer quieter days: choose up to six dates per available month within 15 percentage points of its quietest eligible date. Other days are hidden. Turn both filters on to apply them together.</p>}
      {step === 2 && <p>Keep appointments together: suggest up to three starts nearest existing bookings or calendar commitments. Earlier starts break ties. Days without commitments show every available time.</p>}
      <p>This example uses one-hour appointments and hourly starts. Real bookings use the appointment’s duration and a 30-minute start grid. Month totals include dates outside the five sample dates.</p>
    </details>
    </Dialog>}
  </div>;
}
