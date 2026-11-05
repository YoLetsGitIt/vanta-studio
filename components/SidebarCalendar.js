'use client';

// Small month calendar in the sidebar. Each day is shaded by how busy it is: hours booked
// against the hours the studio's artists work that day (weekly hours, days off and changed
// hours). Today has a dot. Clicking a day opens it in the schedule; the schedule reports the day it shows, so both stay in step.
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getStudioScheduleRange, getStudioArtists, getMyStudioAccount, getArtistWorkSchedule } from '@/lib/api';
import styles from './SidebarCalendar.module.css';

export const SCHEDULE_GO_TO_DATE = 'vanta:schedule-go-to-date';
export const SCHEDULE_SHOWN_DATE = 'vanta:schedule-shown-date';

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const minutes = t => { const [h, m] = String(t ?? '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const span = (start, end) => Math.max(0, (String(end).startsWith('23:59') ? 1440 : minutes(end)) - minutes(start));
const INACTIVE = ['cancelled', 'rejected', 'declined', 'timed_out', 'no_show'];

// Artists and their weekly hours change rarely: load them once per page load.
let teamPromise = null;
function loadTeam() {
  if (!teamPromise) {
    teamPromise = Promise.all([getStudioArtists('approved'), getMyStudioAccount()])
      .then(([a, account]) => ({ ids: [...new Set((a.artists ?? []).map(x => x.artistId).filter(Boolean))], studioId: account.studio_id ?? account.studio?.id ?? null }))
      .catch(error => { teamPromise = null; throw error; });
  }
  return teamPromise;
}

// Minutes each artist can work on each date in [from, to], summed across artists.
async function loadCapacity(from, to, dates) {
  const { ids, studioId } = await loadTeam();
  const here = row => !studioId || !row.studio_id || row.studio_id === studioId;
  const schedules = await Promise.all(ids.map(id => getArtistWorkSchedule(id, from, to).catch(() => null)));
  const capacity = {};
  for (const data of schedules) {
    if (!data) continue;
    const weekly = {};
    for (const r of (data.schedule ?? []).filter(here)) weekly[r.day_of_week] = (weekly[r.day_of_week] ?? 0) + span(r.start_time, r.end_time);
    const overrides = {};
    for (const o of (data.overrides ?? []).filter(here)) overrides[String(o.date).slice(0, 10)] = o.is_blocked ? 0 : span(o.start_time, o.end_time);
    for (const d of dates) {
      const key = iso(d);
      const mins = key in overrides ? overrides[key] : (weekly[d.getDay()] ?? 0);
      if (mins) capacity[key] = (capacity[key] ?? 0) + mins;
    }
  }
  return capacity;
}

// 0 = free, 1–4 = up to a quarter, half, three quarters, and more booked.
const levelFor = ratio => (ratio <= 0 ? 0 : ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4);

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
  const [busy, setBusy] = useState({}); // date → { count, booked, capacity }

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
    const bookings = getStudioScheduleRange(rangeStart, rangeEnd).then(data => {
      const byDay = {};
      for (const e of data.entries ?? []) {
        if (!e.chosenTime || INACTIVE.includes(e.status)) continue;
        const key = iso(new Date(e.chosenTime));
        const day = byDay[key] ?? (byDay[key] = { count: 0, booked: 0 });
        day.count += 1;
        day.booked += e.durationMins ?? 60;
      }
      return byDay;
    });
    Promise.all([bookings, loadCapacity(rangeStart, rangeEnd, days).catch(() => ({}))])
      .then(([byDay, capacity]) => {
        if (!live) return;
        const next = {};
        for (const key of new Set([...Object.keys(byDay), ...Object.keys(capacity)])) {
          next[key] = { count: byDay[key]?.count ?? 0, booked: byDay[key]?.booked ?? 0, capacity: capacity[key] ?? 0 };
        }
        setBusy(next);
      })
      .catch(() => { if (live) setBusy({}); });
    return () => { live = false; };
  }, [rangeStart, rangeEnd, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
          const info = busy[date];
          const ratio = info?.capacity ? info.booked / info.capacity : 0;
          const level = info?.capacity ? levelFor(ratio) : 0;
          if (level) classes.push(styles[`busy${level}`]);
          const summary = !info?.count ? 'Nothing booked'
            : [`${info.count} booking${info.count === 1 ? '' : 's'}`, info.capacity ? `${Math.round(Math.min(ratio, 1) * 100)}% booked` : 'no artist hours set'].join(' · ');
          const dayName = day.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
          return (
            <button
              key={date}
              type="button"
              className={classes.join(' ')}
              onClick={() => pick(day)}
              aria-current={date === today ? 'date' : undefined}
              title={`${dayName}: ${summary}`}
              aria-label={`${day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}, ${summary}`}
            >
              {day.getDate()}
              {date === today && <span className={styles.dot} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
