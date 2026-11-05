'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStudioArtists, getStudioScheduleRange, getStations } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { getBookingStyle } from '@/lib/bookingType';
import { hasArtist } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { calendarDayAfter, layoutDayLanes, localDateKey, weekHourRange, weekStartFor, weekSchedule } from '@/lib/scheduleWeek.mjs';
import styles from './ScheduleWeekView.module.css';
import { ScheduleControls } from './ScheduleScrollFrame';
import ScheduleLensSwitch from './ScheduleLensSwitch';

// A rotated phone: the schedule's one-row toolbar has a slot for the week filter.
const PHONE_LANDSCAPE = '(max-width: 1100px) and (max-height: 550px) and (orientation: landscape) and (any-pointer: coarse)';
function useToolbarSlot() {
  const [slot, setSlot] = useState(null);
  useEffect(() => {
    const query = window.matchMedia(PHONE_LANDSCAPE);
    const update = () => setSlot(query.matches ? document.querySelector('.studio-calendar-toolbar-slot') : null);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return slot;
}

const LOCALES = { en: 'en-AU', 'zh-Hans': 'zh-CN', ko: 'ko-KR' };
const resourceId = (entry, lens) => (lens === 'artist' ? (hasArtist(entry.artistId) ? entry.artistId : null) : entry.stationId) || '__unassigned__';

export default function ScheduleWeekView({ date, lens, refreshKey, selectedBookingId, onOpenDetail, onDayClick }) {
  const { t, lang } = useLanguage();
  const locale = LOCALES[lang] ?? 'en-AU';
  const start = weekStartFor(date), startKey = localDateKey(start);
  const [entries, setEntries] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [retry, setRetry] = useState(0);
  const [focusedSlot, setFocusedSlot] = useState(null);
  const scrollRef = useRef(null);
  const toolbarSlot = useToolbarSlot();

  useEffect(() => { setFilter('all'); }, [lens]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const scheduleKey = `schedule:week:${startKey}`;
    const resourceKey = lens === 'artist' ? 'artists:approved' : 'schedule:stations';
    const cached = getCached(scheduleKey), cachedResources = getCached(resourceKey);
    // Include the UTC edge days: local Monday morning may be Sunday in UTC.
    Promise.all([
      cached ? { entries: cached } : getStudioScheduleRange(localDateKey(calendarDayAfter(start, -1)), localDateKey(calendarDayAfter(start, 7))),
      cachedResources ? cachedResources : (lens === 'artist' ? getStudioArtists('approved').then(data => data.artists ?? []) : getStations().then(data => (data.stations ?? []).filter(station => station.is_active !== false))),
    ]).then(([data, list]) => {
      if (cancelled) return;
      const bookings = data.entries ?? [];
      setCached(scheduleKey, bookings); setCached(resourceKey, list);
      setEntries(bookings); setResources(list); setLoading(false);
    }).catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [startKey, lens, refreshKey, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const allDays = useMemo(() => weekSchedule(entries, date), [entries, startKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = new Map(resources.map(resource => [lens === 'artist' ? resource.artistId ?? resource.id : resource.id, resource.name]));
  for (const day of allDays) for (const { entry } of day.bookings) {
    const id = resourceId(entry, lens);
    if (!options.has(id)) options.set(id, id === '__unassigned__' ? t('sched_unassigned') : (lens === 'artist' ? entry.artistName : entry.stationName) || t('sched_unassigned'));
  }
  const activeFilter = filter === 'all' || options.has(filter) ? filter : 'all';
  const days = allDays.map(day => ({ ...day, bookings: day.bookings.filter(({ entry }) => activeFilter === 'all' || resourceId(entry, lens) === activeFilter) }));
  const count = new Set(days.flatMap(day => day.bookings.map(({ entry }) => entry.bookingId))).size;
  const time = value => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(value);
  const hourLabel = hour => new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(new Date(2000, 0, 1, hour));
  const today = localDateKey(new Date());
  const { startHour, endHour } = weekHourRange(days);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const span = (endHour - startHour) * 60;
  // Percent of the column from the top of the visible range.
  const offset = (day, at) => ((at.getTime() - day.date.getTime()) / 60000 - startHour * 60) / span * 100;
  const now = new Date();
  // Open on the working day (or the week's earliest start, if earlier), not midnight.
  const firstStart = Math.min(8, ...days.flatMap(day => day.bookings.filter(b => !b.continuesFrom).map(b => b.displayStart.getHours())));
  const scrollHour = Math.max(startHour, firstStart - 1);

  useEffect(() => {
    const scroller = scrollRef.current, column = scroller?.querySelector('section > div');
    if (!scroller || !column) return;
    scroller.scrollTop = (scrollHour - startHour) * (column.offsetHeight / (endHour - startHour));
  }, [loading, startKey, lens, scrollHour, startHour, endHour]);

  function addBooking(day, minutes) {
    const selectedResource = resources.find(resource => (lens === 'artist' ? resource.artistId ?? resource.id : resource.id) === activeFilter);
    window.dispatchEvent(new CustomEvent('vanta:open-new-appointment', {
      detail: {
        bookingType: 'studio',
        slot: {
          date: day.key,
          time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
          ...(selectedResource ? { [lens === 'artist' ? 'artistId' : 'stationId']: activeFilter } : {}),
        },
      },
    }));
  }

  function moveSlotFocus(event, dayIndex, minutes) {
    let nextDay = dayIndex, nextMinutes = minutes;
    if (event.key === 'ArrowDown') nextMinutes += 30;
    else if (event.key === 'ArrowUp') nextMinutes -= 30;
    else if (event.key === 'ArrowRight') nextDay += 1;
    else if (event.key === 'ArrowLeft') nextDay -= 1;
    else if (event.key === 'Home') nextMinutes = startHour * 60;
    else if (event.key === 'End') nextMinutes = endHour * 60 - 30;
    else return;
    event.preventDefault();
    nextDay = Math.max(0, Math.min(6, nextDay));
    nextMinutes = Math.max(startHour * 60, Math.min(endHour * 60 - 30, nextMinutes));
    scrollRef.current?.querySelector(`[data-booking-slot="${days[nextDay].key}-${nextMinutes}"]`)?.focus();
  }

  if (loading) return <p className={styles.message} role="status">{t('loading')}</p>;
  if (error) return <div className={styles.message} role="alert"><p>{error}</p><button type="button" className={styles.retry} onClick={() => { invalidatePrefix('schedule:'); setRetry(value => value + 1); }}>{t('sched_retry')}</button></div>;

  const filterSelect = (
    <select aria-label={t('sched_week_filter')} value={activeFilter} onChange={event => setFilter(event.target.value)}>
      <option value="all">{t(lens === 'artist' ? 'sched_all_artists' : 'sched_all_stations')}</option>
      {[...options.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
  );

  return (
    <div className={styles.view}>
      {toolbarSlot ? createPortal(filterSelect, toolbarSlot) : (
        <ScheduleControls>
          <div className={styles.summary}>
            <div><span role="status">{t(count === 1 ? 'sched_week_one_booking' : 'sched_week_bookings', { count })}</span><p className={styles.addHint}>{t('sched_week_add_hint')}</p></div>
            <div className={styles.summaryRight}>
              <ScheduleLensSwitch />
              <label className={styles.filter}>
                <span>{t(lens === 'artist' ? 'bdp_artist' : 'bdp_station')}</span>
                {filterSelect}
              </label>
            </div>
          </div>
        </ScheduleControls>
      )}
      <div ref={scrollRef} className={`studio-calendar-scroll ${styles.scroll}`} tabIndex={0} role="region" aria-label={t('sched_week_schedule')}>
        <div className={styles.days} style={{ '--hours': hours.length }}>
          <div className={styles.gutter} aria-hidden="true">
            <div className={styles.corner} />
            <div className={styles.gutterHours}>
              {hours.map(hour => <span key={hour} className={styles.hourLabel} style={{ top: `${(hour - startHour) / hours.length * 100}%` }}>{hour === startHour ? '' : hourLabel(hour)}</span>)}
            </div>
          </div>
          {days.map((day, dayIndex) => (
            <section key={day.key} className={`${styles.day} ${day.key === today ? styles.today : ''}`} aria-label={day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}>
              <button type="button" className={styles.dayHeading} onClick={() => onDayClick(day.date)} aria-current={day.key === today ? 'date' : undefined}>
                <span className={styles.dayName}>{day.date.toLocaleDateString(locale, { weekday: 'short' })}</span>
                <span className={styles.date}>{day.date.getDate()} <span>{day.date.toLocaleDateString(locale, { month: 'short' })}</span></span>
                <span className={styles.dayCount} data-empty={day.bookings.length === 0 || undefined}>{day.bookings.length}</span>
              </button>
              <div className={styles.column}>
                {Array.from({ length: span / 30 }, (_, index) => {
                  const minutes = startHour * 60 + index * 30;
                  const at = new Date(day.date); at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
                  const label = `${t('new_appointment')} · ${day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} · ${time(at)}`;
                  return <button key={minutes} type="button" className={styles.addSlot}
                    data-booking-slot={`${day.key}-${minutes}`} aria-label={label} title={label}
                    style={{ top: `${index * 30 / span * 100}%`, height: `${30 / span * 100}%` }}
                    tabIndex={minutes === (focusedSlot?.day === day.key ? focusedSlot.minutes : Math.max(startHour, 9) * 60) ? 0 : -1}
                    onFocus={() => setFocusedSlot({ day: day.key, minutes })}
                    onKeyDown={event => moveSlotFocus(event, dayIndex, minutes)}
                    onClick={() => addBooking(day, minutes)}>
                    <span aria-hidden="true">＋ {time(at)}</span>
                  </button>;
                })}
                {hours.map(hour => <div key={hour} className={styles.hourLine} style={{ top: `${(hour - startHour) / hours.length * 100}%` }} />)}
                {day.key === today && now >= day.date && <div className={styles.nowLine} style={{ top: `${offset(day, now)}%` }} aria-hidden="true" />}
                {layoutDayLanes(day.bookings).map(booking => {
                  const { entry } = booking;
                  const source = getBookingStyle(entry.source);
                  const statusKey = { awaiting_payment: 'status_awaiting_payment', requires_confirmation: 'status_needs_confirmation', completed: 'status_completed' }[entry.status];
                  const pending = entry.status === 'awaiting_payment' || entry.status === 'requires_confirmation';
                  const artist = entry.artistName || t('sched_unassigned'), station = entry.stationName || t('sched_unassigned');
                  const minutes = (booking.displayEnd - booking.displayStart) / 60000;
                  const top = offset(day, booking.displayStart), height = minutes / span * 100;
                  const label = [`${time(booking.displayStart)} – ${time(booking.displayEnd)}`, entry.clientName, lens === 'artist' ? artist : station, statusKey && t(statusKey), booking.continuesFrom && t('sched_continued'), booking.continuesInto && t('sched_continues_tomorrow')].filter(Boolean).join(', ');
                  return (
                    <button
                      key={entry.bookingId} type="button" data-booking-id={entry.bookingId} aria-label={label} title={label}
                      className={`${styles.booking} ${pending ? styles.pending : ''} ${selectedBookingId === entry.bookingId ? styles.selected : ''} ${minutes < 45 ? styles.short : minutes < 75 ? styles.compact : ''} ${booking.lanes >= 3 ? styles.narrow : ''}`}
                      style={{ '--booking-color': source.border, top: `${top}%`, height: `${height}%`, left: `calc(${booking.lane / booking.lanes * 100}% + 2px)`, width: `calc(${100 / booking.lanes}% - 4px)` }}
                      onClick={() => onOpenDetail(entry)}
                    >
                      <span className={styles.client}>{entry.clientName}</span>
                      <span className={styles.time}>{time(booking.displayStart)} – {time(booking.displayEnd)}</span>
                      <span className={styles.resource}>{lens === 'artist' ? artist : station}</span>
                      {statusKey && <span className={pending ? styles.pendingTag : styles.status}>{t(statusKey)}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
