'use client';

// Small month calendar in the sidebar. Days with bookings get a dot; clicking a day
// opens it in the schedule. The schedule reports the day it shows, so both stay in step.
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getStudioScheduleRange } from '@/lib/api';
import styles from './SidebarCalendar.module.css';

export const SCHEDULE_GO_TO_DATE = 'vanta:schedule-go-to-date';
export const SCHEDULE_SHOWN_DATE = 'vanta:schedule-shown-date';

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // back to Monday
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function SidebarCalendar() {
  const router = useRouter();
  const pathname = usePathname();
  const onSchedule = pathname.startsWith('/dashboard/schedule');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(null);
  const [booked, setBooked] = useState(() => new Set());

  useEffect(() => {
    function shown(event) {
      const d = new Date(`${event.detail.date}T00:00:00`);
      setSelected(event.detail.month ? null : event.detail.date);
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    window.addEventListener(SCHEDULE_SHOWN_DATE, shown);
    return () => window.removeEventListener(SCHEDULE_SHOWN_DATE, shown);
  }, []);
  useEffect(() => { if (!onSchedule) setSelected(null); }, [onSchedule]);

  const days = monthDays(month);
  const rangeStart = iso(days[0]);
  const rangeEnd = iso(days[days.length - 1]);
  useEffect(() => {
    let live = true;
    getStudioScheduleRange(rangeStart, rangeEnd)
      .then(data => {
        if (!live) return;
        const next = new Set();
        for (const e of data.entries ?? []) {
          if (e.chosenTime && e.status !== 'cancelled') next.add(iso(new Date(e.chosenTime)));
        }
        setBooked(next);
      })
      .catch(() => { if (live) setBooked(new Set()); });
    return () => { live = false; };
  }, [rangeStart, rangeEnd, pathname]);

  function pick(day) {
    const date = iso(day);
    setSelected(date);
    if (onSchedule) window.dispatchEvent(new CustomEvent(SCHEDULE_GO_TO_DATE, { detail: { date } }));
    else router.push(`/dashboard/schedule?date=${date}`);
  }

  const today = iso(new Date());
  const label = month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const step = offset => setMonth(m => new Date(m.getFullYear(), m.getMonth() + offset, 1));

  return (
    <section className={styles.calendar} aria-label="Calendar">
      <div className={styles.head}>
        <span className={styles.month} aria-live="polite">{label}</span>
        <span className={styles.arrows}>
          <button type="button" onClick={() => step(-1)} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => step(1)} aria-label="Next month">›</button>
        </span>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((d, i) => <span key={i} className={styles.weekday} aria-hidden="true">{d}</span>)}
        {days.map(day => {
          const date = iso(day);
          const classes = [styles.day];
          if (day.getMonth() !== month.getMonth()) classes.push(styles.outside);
          if (date === today) classes.push(styles.today);
          if (date === selected) classes.push(styles.selected);
          return (
            <button
              key={date}
              type="button"
              className={classes.join(' ')}
              onClick={() => pick(day)}
              aria-current={date === today ? 'date' : undefined}
              aria-label={`${day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}${booked.has(date) ? ', has bookings' : ''}`}
            >
              {day.getDate()}
              {booked.has(date) && <span className={styles.dot} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
