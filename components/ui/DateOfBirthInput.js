'use client';

import { useEffect, useState } from 'react';
import styles from './DateOfBirthInput.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "YYYY-MM-DD" → { day, month, year } as strings ('' when unknown).
function parts(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return m ? { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) } : { day: '', month: '', year: '' };
}

function daysIn(month, year) {
  if (!month) return 31;
  // Unknown year: allow 29 Feb until a year is picked.
  return new Date(Number(year) || 2000, Number(month), 0).getDate();
}

/**
 * Date of birth as three dropdowns (day, month, year). Native date pickers make
 * people page back through decades, and iOS hides the day behind the month/year
 * wheel; separate dropdowns each open one simple wheel.
 * value/onChange use "YYYY-MM-DD"; onChange gets '' until all three are chosen.
 */
export default function DateOfBirthInput({ value, onChange, style, id, required = true, disabled }) {
  const [draft, setDraft] = useState(() => parts(value));

  // Follow outside changes (prefill, reset) without wiping a half-entered date.
  useEffect(() => {
    const next = parts(value);
    if (value || draft.day && draft.month && draft.year) setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function update(patch) {
    const next = { ...draft, ...patch };
    const max = daysIn(next.month, next.year);
    if (next.day && Number(next.day) > max) next.day = String(max);
    setDraft(next);
    const complete = next.day && next.month && next.year;
    onChange(complete ? `${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}` : '');
  }

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 111 }, (_, i) => String(thisYear - i));
  const days = Array.from({ length: daysIn(draft.month, draft.year) }, (_, i) => String(i + 1));
  const control = { ...style, minHeight: 44 };

  return (
    <div className={styles.dob} role="group" aria-label="Date of birth" style={{ fontSize: style?.fontSize }}>
      <select id={id} className={styles.part} style={control} aria-label="Day of birth" autoComplete="bday-day" required={required} disabled={disabled}
        value={draft.day} data-empty={!draft.day || undefined} onChange={e => update({ day: e.target.value })}>
        <option value="" disabled>Day</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className={styles.part} style={control} aria-label="Month of birth" autoComplete="bday-month" required={required} disabled={disabled}
        value={draft.month} data-empty={!draft.month || undefined} onChange={e => update({ month: e.target.value })}>
        <option value="" disabled>Month</option>
        {MONTHS.map((name, i) => <option key={name} value={String(i + 1)}>{name}</option>)}
      </select>
      <select className={styles.part} style={control} aria-label="Year of birth" autoComplete="bday-year" required={required} disabled={disabled}
        value={draft.year} data-empty={!draft.year || undefined} onChange={e => update({ year: e.target.value })}>
        <option value="" disabled>Year</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
