'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStudioArtists, getStudioScheduleRange, getStations } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { entryStyle, useAppointmentTypes } from '@/lib/appointmentTypes';
import { hasArtist } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { calendarDayAfter, capDayLanes, layoutDayLanes, localDateKey, weekHourRange, weekStartFor, weekSchedule } from '@/lib/scheduleWeek.mjs';
import styles from './ScheduleWeekView.module.css';

// Where the schedule's filter goes: the header next to "Today", or on a rotated phone the
// one-row toolbar.
const PHONE_LANDSCAPE = '(max-width: 1100px) and (max-height: 550px) and (orientation: landscape) and (any-pointer: coarse)';
export function useScheduleFilterSlot() {
  const [slot, setSlot] = useState(null);
  useEffect(() => {
    const query = window.matchMedia(PHONE_LANDSCAPE);
    const update = () => setSlot(document.querySelector(query.matches ? '.studio-calendar-toolbar-slot' : '.studio-schedule-filter-slot'));
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return slot;
}

const LOCALES = { en: 'en-AU', 'zh-Hans': 'zh-CN', ko: 'ko-KR' };
const resourceId = (entry, lens) => (lens === 'artist' ? (hasArtist(entry.artistId) ? entry.artistId : null) : entry.stationId) || '__unassigned__';

export default function ScheduleWeekView({ date, lens, refreshKey, selectedBookingId, onOpenDetail, onDayClick }) {
  const { byId: typesById } = useAppointmentTypes();
  const { t, lang } = useLanguage();
  const locale = LOCALES[lang] ?? 'en-AU';
  const start = weekStartFor(date), startKey = localDateKey(start);
  const [entries, setEntries] = useState([]);
  const [resources, setResources] = useState([]);
  const [artists, setArtists] = useState([]); // for each booking's artist photo
  const [openMore, setOpenMore] = useState(null); // the "+N" list that's open: `${dayKey}|${start}`
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [retry, setRetry] = useState(0);
  const [focusedSlot, setFocusedSlot] = useState(null);
  const scrollRef = useRef(null);
  const toolbarSlot = useScheduleFilterSlot();

  useEffect(() => { setFilter('all'); }, [lens]);
  useEffect(() => { setOpenMore(null); }, [startKey, lens, filter]);

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
      lens === 'artist' ? null : (getCached('artists:approved') ?? getStudioArtists('approved').then(data => data.artists ?? []).catch(() => [])),
    ]).then(([data, list, artistList]) => {
      if (cancelled) return;
      const bookings = data.entries ?? [];
      setCached(scheduleKey, bookings); setCached(resourceKey, list);
      if (artistList?.length) setCached('artists:approved', artistList);
      setEntries(bookings); setResources(list); setArtists(lens === 'artist' ? list : artistList ?? []); setLoading(false);
    }).catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [startKey, lens, refreshKey, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const allDays = useMemo(() => weekSchedule(entries, date), [entries, startKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const artistById = new Map(artists.map(artist => [String(artist.artistId ?? artist.artist_id ?? artist.id), artist]));
  const options = new Map(resources.map(resource => [lens === 'artist' ? resource.artistId ?? resource.id : resource.id, resource.name]));
  for (const day of allDays) for (const { entry } of day.bookings) {
    const id = resourceId(entry, lens);
    if (!options.has(id)) options.set(id, id === '__unassigned__' ? t('sched_unassigned') : (lens === 'artist' ? entry.artistName : entry.stationName) || t('sched_unassigned'));
  }
  const activeFilter = filter === 'all' || options.has(filter) ? filter : 'all';
  const days = allDays.map(day => ({ ...day, bookings: day.bookings.filter(({ entry }) => activeFilter === 'all' || resourceId(entry, lens) === activeFilter) }));
  const time = value => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(value);
  const hourLabel = hour => new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(new Date(2000, 0, 1, hour));
  const today = localDateKey(new Date());
  const { startHour, endHour } = weekHourRange();
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const span = (endHour - startHour) * 60;
  // Percent of the column from the top of the visible range.
  const offset = (day, at) => ((at.getTime() - day.date.getTime()) / 60000 - startHour * 60) / span * 100;
  const now = new Date();
  // Open scrolled to the working day (or the week's earliest start, if earlier), not midnight.
  const firstStart = Math.min(8, ...days.flatMap(day => day.bookings.filter(b => !b.continuesFrom).map(b => b.displayStart.getHours())));
  const scrollHour = Math.max(startHour, firstStart - 1);

  useEffect(() => {
    const scroller = scrollRef.current, column = scroller?.querySelector('section > div');
    if (!scroller || !column) return;
    // A little short of the hour line, so its label isn't cut off under the headings.
    scroller.scrollTop = Math.max(0, (scrollHour - startHour) * (column.offsetHeight / (endHour - startHour)) - 12);
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
    <select className="studio-schedule-filter-select" aria-label={t('sched_week_filter')} value={activeFilter} onChange={event => setFilter(event.target.value)}>
      <option value="all">{t(lens === 'artist' ? 'sched_all_artists' : 'sched_all_stations')}</option>
      {[...options.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
  );

  return (
    <div className={styles.view}>
      {toolbarSlot && createPortal(filterSelect, toolbarSlot)}
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
              <button type="button" className={styles.dayHeading} onClick={() => onDayClick(day.date)} aria-current={day.key === today ? 'date' : undefined} title="Open in Day view, one column per artist">
                <span className={styles.dayName}>{day.date.toLocaleDateString(locale, { weekday: 'short' })}</span>
                <span className={styles.date}>{day.date.getDate()} <span>{day.date.toLocaleDateString(locale, { month: 'short' })}</span></span>
                <span className={styles.dayCount} data-empty={day.bookings.length === 0 || undefined}>{day.bookings.length}</span>
              </button>
              <div className={styles.column}>
                {Array.from({ length: span / 30 }, (_, index) => {
                  const minutes = startHour * 60 + index * 30;
                  const at = new Date(day.date); at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
                  const label = `${t('new_appointment')} · ${day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} · ${time(at)}`;
                  // Where a booking covers this half hour, only the strip beside it adds one.
                  const slotEnd = at.getTime() + 30 * 60000;
                  const covered = day.bookings.some(b => b.displayStart.getTime() < slotEnd && b.displayEnd.getTime() > at.getTime());
                  return <button key={minutes} type="button" className={`${styles.addSlot} ${covered ? styles.addSlotBeside : ''}`}
                    data-booking-slot={`${day.key}-${minutes}`} aria-label={label}
                    style={{ top: `${index * 30 / span * 100}%`, height: `${30 / span * 100}%` }}
                    tabIndex={minutes === (focusedSlot?.day === day.key ? focusedSlot.minutes : Math.max(startHour, 9) * 60) ? 0 : -1}
                    onFocus={() => setFocusedSlot({ day: day.key, minutes })}
                    onKeyDown={event => moveSlotFocus(event, dayIndex, minutes)}
                    onClick={() => addBooking(day, minutes)}>
                    <span aria-hidden="true">{covered ? '＋' : `＋ ${time(at)}`}</span>
                  </button>;
                })}
                {hours.map(hour => <div key={hour} className={styles.hourLine} style={{ top: `${(hour - startHour) / hours.length * 100}%` }} />)}
                {day.key === today && now >= day.date && <div className={styles.nowLine} style={{ top: `${offset(day, now)}%` }} aria-hidden="true" />}
                {(() => {
                  const { shown, overflow } = capDayLanes(layoutDayLanes(day.bookings));
                  // A busy day shows every booking the same way (photo and name), so the
                  // ones with room don't look like a different kind of booking.
                  const dense = overflow.length > 0 || shown.some(b => b.lanes >= 3);
                  return <>
                {overflow.map(chip => {
                  const key = `${day.key}|${chip.displayStart.getTime()}`;
                  const minutes = (chip.displayEnd - chip.displayStart) / 60000;
                  const names = chip.bookings.map(b => b.entry.clientName).join(', ');
                  return (
                    <MoreChip
                      key={key} chip={chip} open={openMore === key}
                      onToggle={() => setOpenMore(current => (current === key ? null : key))}
                      onClose={() => setOpenMore(null)}
                      style={{ top: `${offset(day, chip.displayStart)}%`, height: `min(${minutes / span * 100}%, 46px)`, left: `calc((100% - var(--add-strip)) * ${chip.lane / chip.lanes} + 2px)`, width: `calc((100% - var(--add-strip)) / ${chip.lanes} - 4px)` }}
                      alignEnd={dayIndex >= 5} short={minutes < 45}
                      label={`${chip.bookings.length} more bookings, ${time(chip.displayStart)} – ${time(chip.displayEnd)}: ${names}. Show all bookings at this time`}
                      artistById={artistById} time={time}
                      onOpen={entry => { setOpenMore(null); onOpenDetail(entry); }}
                      onOpenDay={() => { setOpenMore(null); onDayClick(day.date); }}
                      dayName={day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
                    />
                  );
                })}
                {shown.map(booking => {
                  const { entry } = booking;
                  const source = entryStyle(entry, typesById);
                  const statusKey = { awaiting_payment: 'status_awaiting_payment', requires_confirmation: 'status_needs_confirmation', completed: 'status_completed' }[entry.status];
                  const pending = entry.status === 'awaiting_payment' || entry.status === 'requires_confirmation';
                  const artist = entry.artistName || t('sched_unassigned'), station = entry.stationName || t('sched_unassigned');
                  const minutes = (booking.displayEnd - booking.displayStart) / 60000;
                  const top = offset(day, booking.displayStart), height = minutes / span * 100;
                  const label = [`${time(booking.displayStart)} – ${time(booking.displayEnd)}`, entry.clientName, source.typed && source.tag, lens === 'artist' ? artist : station, statusKey && t(statusKey), booking.continuesFrom && t('sched_continued'), booking.continuesInto && t('sched_continues_tomorrow')].filter(Boolean).join(', ');
                  return (
                    <button
                      key={entry.bookingId} type="button" data-booking-id={entry.bookingId} aria-label={label} title={label}
                      className={`${styles.booking} ${pending ? styles.pending : ''} ${selectedBookingId === entry.bookingId ? styles.selected : ''} ${minutes < 45 ? styles.short : minutes < 75 ? styles.compact : ''} ${booking.lanes >= 3 ? styles.narrow : ''} ${dense ? styles.dense : ''}`}
                      style={{ '--booking-color': source.border, top: `${top}%`, height: `${height}%`, left: `calc((100% - var(--add-strip)) * ${booking.lane / booking.lanes} + 2px)`, width: `calc((100% - var(--add-strip)) / ${booking.lanes} - 4px)` }}
                      onClick={() => onOpenDetail(entry)}
                    >
                      <span className={styles.head}>
                        <ArtistAvatar artist={artistById.get(String(entry.artistId))} name={entry.artistName} />
                        <span className={styles.client}>{entry.clientName}</span>
                      </span>
                      <span className={styles.time}>{time(booking.displayStart)} – {time(booking.displayEnd)}</span>
                      {source.typed && <span className={styles.typeName}>{source.tag}</span>}
                      <span className={styles.resource}>{lens === 'artist' ? artist : station}</span>
                      {statusKey && <span className={pending ? styles.pendingTag : styles.status}>{t(statusKey)}</span>}
                    </button>
                  );
                })}
                  </>;
                })()}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// The booking's artist: their photo, or their first initial. Always shown, so a booking
// too narrow for its text still says whose it is.
function ArtistAvatar({ artist, name }) {
  const image = artist?.profileImage ?? artist?.profile_image;
  const initial = (artist?.name || name || '?').trim().charAt(0).toUpperCase();
  return image
    ? <img src={image} alt="" className={styles.avatar} loading="lazy" />
    : <span aria-hidden="true" className={styles.avatar}>{initial}</span>;
}

// "+N": bookings that don't fit side by side. Shows the artists' photos; opens a list
// of every booking at that time (the ones showing too), with a link to the day (Day view has a column per artist).
function MoreChip({ chip, open, onToggle, onClose, style, alignEnd, short, label, artistById, time, onOpen, onOpenDay, dayName }) {
  const chipRef = useRef(null), listRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    listRef.current?.focus(); // Tab goes through its bookings; Escape closes it
    const away = event => { if (!chipRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) onClose(); };
    const key = event => { if (event.key === 'Escape') { onClose(); chipRef.current?.focus(); } };
    // Scrolling over the list never scrolls the calendar behind it: only the bookings
    // list scrolls (and stops at its ends, see overscroll-behavior in the CSS).
    const list = listRef.current;
    const wheel = event => { if (!list?.querySelector('ul')?.contains(event.target)) event.preventDefault(); };
    list?.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { list?.removeEventListener('wheel', wheel); document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // The list shows everything at that time, the bookings showing beside the chip too.
  const list = chip.all ?? chip.bookings;
  const listEnd = new Date(Math.max(...list.map(b => b.displayEnd.getTime())));
  // Each artist once, so two bookings with the same artist don't repeat their photo.
  const faces = [...new Map(chip.bookings.map(b => [String(b.entry.artistId ?? b.entry.artistName ?? b.entry.bookingId), b])).values()].slice(0, 3);
  return (
    <>
      <button ref={chipRef} type="button" className={`${styles.more} ${short ? styles.moreShort : ''}`} style={style}
        aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog" onClick={onToggle}>
        <span className={styles.moreCount}>+{chip.bookings.length}</span>
        <span className={styles.faces} aria-hidden="true">
          {faces.map(b => <ArtistAvatar key={b.entry.bookingId} artist={artistById.get(String(b.entry.artistId))} name={b.entry.artistName} />)}
        </span>
      </button>
      {open && (
        <div ref={listRef} tabIndex={-1} role="dialog" aria-label={`All ${list.length} bookings at this time`} className={`${styles.moreList} ${alignEnd ? styles.moreListEnd : ''}`}
          style={{ top: style.top, ...(alignEnd ? { right: `calc(var(--add-strip) + (100% - var(--add-strip)) * ${(chip.lanes - chip.lane) / chip.lanes} + 4px)` } : {}) }}>
          <p className={styles.moreTitle}>{list.length} bookings · {time(list[0].displayStart)} – {time(listEnd)}</p>
          <ul>
            {list.map(b => (
              <li key={b.entry.bookingId}>
                <button type="button" onClick={() => onOpen(b.entry)}>
                  <ArtistAvatar artist={artistById.get(String(b.entry.artistId))} name={b.entry.artistName} />
                  <span className={styles.moreText}>
                    <span className={styles.moreClient}>{b.entry.clientName}</span>
                    <span className={styles.moreMeta}>{time(b.displayStart)} – {time(b.displayEnd)}{b.entry.artistName ? ` · ${b.entry.artistName}` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.moreDay} onClick={onOpenDay}>Open {dayName} →</button>
        </div>
      )}
    </>
  );
}
