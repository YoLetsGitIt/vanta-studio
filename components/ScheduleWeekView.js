'use client';

import { useEffect, useMemo, useState } from 'react';
import { getStudioArtists, getStudioScheduleRange, getStations } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { getBookingStyle } from '@/lib/bookingType';
import { hasArtist } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { calendarDayAfter, localDateKey, weekStartFor, weekSchedule } from '@/lib/scheduleWeek.mjs';
import styles from './ScheduleWeekView.module.css';

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
  const today = localDateKey(new Date());

  if (loading) return <p className={styles.message} role="status">{t('loading')}</p>;
  if (error) return <div className={styles.message} role="alert"><p>{error}</p><button type="button" className={styles.retry} onClick={() => { invalidatePrefix('schedule:'); setRetry(value => value + 1); }}>{t('sched_retry')}</button></div>;

  return (
    <div className={styles.view}>
      <div className={styles.summary}>
        <span role="status">{t(count === 1 ? 'sched_week_one_booking' : 'sched_week_bookings', { count })}</span>
        <label className={styles.filter}>
          <span>{t(lens === 'artist' ? 'bdp_artist' : 'bdp_station')}</span>
          <select aria-label={t('sched_week_filter')} value={activeFilter} onChange={event => setFilter(event.target.value)}>
            <option value="all">{t(lens === 'artist' ? 'sched_all_artists' : 'sched_all_stations')}</option>
            {[...options.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className={`studio-calendar-scroll ${styles.scroll}`} tabIndex={0} role="region" aria-label={t('sched_week_schedule')}>
        <div className={styles.days}>
          {days.map(day => (
            <section key={day.key} className={`${styles.day} ${day.key === today ? styles.today : ''}`} aria-label={day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}>
              <button type="button" className={styles.dayHeading} onClick={() => onDayClick(day.date)} aria-current={day.key === today ? 'date' : undefined}>
                <span className={styles.dayName}>{day.date.toLocaleDateString(locale, { weekday: 'short' })}</span>
                <span className={styles.date}>{day.date.getDate()} <span>{day.date.toLocaleDateString(locale, { month: 'short' })}</span></span>
                <span className={styles.dayCount}>{day.bookings.length}</span>
              </button>
              <div className={styles.bookings}>
                {day.bookings.length === 0 && <p className={styles.empty}>{t('sched_no_bookings')}</p>}
                {day.bookings.map(booking => {
                  const { entry } = booking;
                  const source = getBookingStyle(entry.source);
                  const statusKey = { awaiting_payment: 'status_awaiting_payment', requires_confirmation: 'status_needs_confirmation', completed: 'status_completed' }[entry.status];
                  const pending = entry.status === 'awaiting_payment' || entry.status === 'requires_confirmation';
                  const artist = entry.artistName || t('sched_unassigned'), station = entry.stationName || t('sched_unassigned');
                  return (
                    <button key={entry.bookingId} type="button" data-booking-id={entry.bookingId} className={`${styles.booking} ${pending ? styles.pending : ''} ${selectedBookingId === entry.bookingId ? styles.selected : ''}`} style={{ '--booking-color': source.border }} onClick={() => onOpenDetail(entry)}>
                      <span className={styles.time}>{time(booking.displayStart)} – {time(booking.displayEnd)}</span>
                      <span className={styles.client}>{entry.clientName}</span>
                      <span className={styles.resource}><span>{t(lens === 'artist' ? 'bdp_artist' : 'bdp_station')}</span>{lens === 'artist' ? artist : station}</span>
                      <span className={styles.resource}><span>{t(lens === 'artist' ? 'bdp_station' : 'bdp_artist')}</span>{lens === 'artist' ? station : artist}</span>
                      <span className={styles.tags}>
                        <span className={styles.source}>{source.tag}</span>
                        {statusKey && <span className={pending ? styles.pendingTag : styles.status}>{t(statusKey)}</span>}
                      </span>
                      {booking.continuesFrom && <span className={styles.continuation}>{t('sched_continued')}</span>}
                      {booking.continuesInto && <span className={styles.continuation}>{t('sched_continues_tomorrow')}</span>}
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
