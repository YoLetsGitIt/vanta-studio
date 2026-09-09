'use client';

import { useState } from 'react';
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

  return <div className={styles.root}>
    <p className={styles.description}>Choose which booking periods clients can access, then how times are suggested within those periods. Use either option or both.</p>
    <fieldset className={styles.options} disabled={disabled}>
      <legend className={styles.srOnly}>Scheduling preferences</legend>
      <label className={`${styles.option} ${quieter ? styles.selected : ''}`}>
        <input type="checkbox" aria-label="Prioritise quieter periods" checked={quieter} onChange={event => update(event.target.checked, gaps)} aria-describedby="quieter-days-description" />
        <span><strong>Prioritise quieter periods</strong><span id="quieter-days-description">Only offer less-booked months and days in the next 90 days. Busier periods are omitted from client options.</span></span>
      </label>
      <label className={`${styles.option} ${gaps ? styles.selected : ''}`}>
        <input type="checkbox" aria-label="Minimise gaps" checked={gaps} onChange={event => update(quieter, event.target.checked)} aria-describedby="minimise-gaps-description" />
        <span><strong>Minimise gaps</strong><span id="minimise-gaps-description">Suggest up to three times closest to bookings and calendar commitments within an available date.</span></span>
      </label>
    </fieldset>
    <p className={styles.summary} role="status">{quieter
      ? gaps ? 'Both on: only quieter months and dates are offered, then nearby start times are suggested.' : 'Only quieter months and dates are offered. All valid times on those dates are shown.'
      : gaps ? 'All available dates remain accessible. Nearby start times are suggested.' : 'Both off: show all available dates and times.'}</p>

    <div className={styles.previewHeader}>
      <div><h3>See how it works</h3><p>Interactive example, not your live schedule. Compare the studio view with the exact options a client sees. Choose a month or date below to explore.</p></div>
      <div className={styles.legend} aria-label="Availability legend">
        <span><Square state="booked" label="Legend" /> Booked</span>
        <span><Square state="available" label="Legend" /> Available</span>
        <span><Square state="suggested" label="Legend" /> Suggested time</span>
      </div>
    </div>

    <div className={styles.steps}>
      <section className={styles.example} aria-label="Month filtering example">
        <h4 className={styles.stageTitle}><span>1</span> Choose a month</h4>
        <p className={styles.viewLabel}>Studio view · illustrative month totals</p>
        <div className={styles.monthOverview}>
          {MONTHS.map(item => {
            const offered = offeredMonths.includes(item);
            return <div key={item.key} className={`${styles.monthTile} ${!offered ? styles.excluded : ''}`}>
              <strong>{item.name}</strong><b>{Math.round(item.utilization * 100)}%</b><span>booked</span><small>{offered ? 'Offered' : 'Not offered'}</small>
            </div>;
          })}
        </div>
        <p className={styles.explanation}>{quieter ? 'October is least booked at 20%. November at 30% is within 15 percentage points, so both qualify. September at 75% is not offered.' : 'With quieter-period filtering off, all three months remain accessible.'}</p>
        <div className={styles.clientView}>
          <p className={styles.viewLabel}>Client sees · available months</p>
          <div className={styles.choiceRow} role="group" aria-label="Example client month options">
            {offeredMonths.map(item => <button type="button" key={item.key} className={`${styles.monthButton} ${month.key === item.key ? styles.activeChoice : ''}`} aria-pressed={month.key === item.key} onClick={() => { setMonthChoice(item.key); setDateChoice(''); }}>{item.name}</button>)}
          </div>
          {quieter && <p className={styles.note}>No September option, disabled card or navigation into it.</p>}
        </div>
      </section>

      <section className={styles.example} aria-label="Date filtering example">
        <h4 className={styles.stageTitle}><span>2</span> Choose a date in {month.name}</h4>
        <p className={styles.viewLabel}>Studio view · five sample dates, six working hours each</p>
        <table className={styles.table} aria-label="Example studio date availability">
          <thead><tr><th scope="col">Date</th>{HOURS.map(hour => <th scope="col" key={hour}>{hour}</th>)}<th scope="col">Client</th></tr></thead>
          <tbody>{dates.map(item => <tr key={item.key}>
            <th scope="row">{formatDate(item.key)}<small>{Math.round(item.utilization * 100)}% booked</small></th>
            {HOURS.map((hour, index) => <td key={hour}><Square label={`${formatDate(item.key)} ${hour}`} state={item.booked.includes(index) ? 'booked' : 'available'} /></td>)}
            <td className={styles.eligibility}>{offeredDates.includes(item) ? 'Offered' : 'Not offered'}</td>
          </tr>)}</tbody>
        </table>
        <p className={styles.explanation}>{quieter ? 'The quietest sample dates are 17% booked. Dates above 32% do not qualify, even if some times are free.' : 'All five sample dates have openings and remain accessible.'}</p>
        <div className={styles.clientView}>
          <p className={styles.viewLabel}>Client sees · available dates</p>
          <div className={styles.dateChoices} role="group" aria-label="Example client date options">
            {offeredDates.map(item => <button type="button" key={item.key} aria-label={formatDate(item.key)} aria-pressed={day.key === item.key} className={`${styles.dateButton} ${day.key === item.key ? styles.activeChoice : ''}`} onClick={() => setDateChoice(item.key)}>
              <span>{new Date(`${item.key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short' })}</span><strong>{Number(item.key.slice(-2))}</strong>
            </button>)}
          </div>
          {quieter && <p className={styles.note}>Excluded dates disappear entirely. There is no “Show all dates” control.</p>}
        </div>
      </section>

      <section className={styles.example} aria-label="Time suggestions example">
        <h4 className={styles.stageTitle}><span>3</span> Choose a time on {formatDate(day.key)}</h4>
        <p className={styles.viewLabel}>Studio view · one-hour appointments, hourly starts for illustration</p>
        <table className={styles.table} aria-label="Example studio time availability">
          <thead><tr>{HOURS.map(hour => <th scope="col" key={hour}>{hour}</th>)}</tr></thead>
          <tbody><tr>{HOURS.map((hour, index) => <td key={hour}><Square label={hour} state={day.booked.includes(index) ? 'booked' : gaps && recommendedTimes.includes(index) ? 'suggested' : 'available'} /></td>)}</tr></tbody>
        </table>
        <p className={styles.explanation}>{gaps ? 'The closest fits are selected first; earlier starts break ties. Suggested times are then displayed in time order.' : 'Gap minimisation is off, so every valid start time on this date is shown.'}</p>
        <div className={styles.clientView}>
          <p className={styles.viewLabel}>Client sees · {expanded || !gaps ? 'available times' : 'suggested times'}</p>
          <div className={styles.choiceRow} role="group" aria-label="Example client time options">{shownTimes.map(index => <span key={index} className={styles.timeTile}>{HOURS[index]}</span>)}</div>
          {gaps && availableTimes.length > recommendedTimes.length && <button type="button" className={styles.expandButton} aria-expanded={expanded} onClick={() => setExpandedTimes(expanded ? '' : previewKey)}>{expanded ? 'Show suggested times' : 'Show all times'}</button>}
          <p className={styles.note}>{quieter ? '“Show all times” only expands this eligible date. It never reveals excluded dates or months.' : 'Other valid times remain accessible through “Show all times”.'}</p>
        </div>
      </section>
    </div>
    {quieter && <p className={styles.note}>Live rule: next 90 days · up to 2 months · up to 6 dates per month · within 15 percentage points of the least-booked eligible period. Future working hours and leave are accounted for. The example month totals include dates not shown in the sample.</p>}
  </div>;
}
