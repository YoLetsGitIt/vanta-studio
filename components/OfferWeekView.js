'use client';

// Week calendar for "Offer times": the artist's hours at this studio on each date
// (grey), the client's weekly availability (light green), when both are free (green),
// when the artist is busy (bookings here solid, elsewhere and Google Calendar hatched)
// and the times being offered (numbered). Tap a free spot to offer that time, tap an
// option to remove it. With a mouse, drag an option to another time or day.
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/availability';
import { overlapSpans } from '@/lib/artist-days.mjs';

const SLOT_MIN = 30;
const SLOT_H = 14; // px per half hour
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = n => String(n).padStart(2, '0');
const toDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minutesOf = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const endOf = hhmm => (hhmm === '23:59' ? 1440 : minutesOf(hhmm));
const toHHMM = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

export function mondayOf(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export default function OfferWeekView({ weekStart, onWeekChange, clientWindows = [], artistHours = [], artistHoursFor, busy = [], options = [], duration = 60, onPick, onMove, onRemove, canPick = true, findShared, artistName = 'The artist', clientName = 'the client' }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  // The artist's hours on each date shown (day offs and other studios applied when the
  // caller knows them; otherwise the weekly hours).
  const artistDays = days.map(d => (artistHoursFor ? artistHoursFor(toDate(d)) : artistHours.filter(x => x.day_of_week === d.getDay())));
  const knowsArtist = artistHours.length > 0 || artistDays.some(h => h.length > 0);

  // Hours shown: everything anyone is available, at least 9am–6pm, within 7am–10pm.
  const spans = [...clientWindows, ...artistHours, ...artistDays.flat()].map(w => [minutesOf(w.start_time), endOf(w.end_time)]);
  const start = Math.max(7 * 60, Math.floor(Math.min(9 * 60, ...spans.map(s => s[0])) / 60) * 60);
  const end = Math.min(22 * 60, Math.ceil(Math.max(18 * 60, ...spans.map(s => s[1])) / 60) * 60);
  const height = ((end - start) / SLOT_MIN) * SLOT_H;
  const y = mins => ((Math.min(Math.max(mins, start), end) - start) / SLOT_MIN) * SLOT_H;
  const hours = []; for (let m = start; m <= end; m += 60) hours.push(m);

  const now = Date.now();
  const last = new Date(weekStart); last.setDate(last.getDate() + 6);
  const label = `${weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
  const shift = n => { const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); onWeekChange(d); };
  const thisWeek = mondayOf(new Date()).getTime() === weekStart.getTime();
  const today = toDate(new Date());
  // Busy spans that touch each day, in minutes from that day's midnight.
  const busyByDay = days.map(d => {
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const base = dayStart.getTime(), next = base + 86400000;
    return busy.filter(b => new Date(b.start).getTime() < next && new Date(b.end).getTime() > base)
      .map(b => ({ ...b, sm: Math.max(0, (new Date(b.start).getTime() - base) / 60000), em: Math.min(1440, (new Date(b.end).getTime() - base) / 60000) }));
  });
  const isBusy = (dayIndex, mins) => busyByDay[dayIndex].some(b => b.sm < mins + duration && b.em > mins);

  // A short note when a tap can't add a time (busy, past, too late in the day).
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // No time this week when both are free: offer to jump to the next week that has one.
  const sharedThisWeek = days.some((d, i) => new Date(`${toDate(d)}T23:59:59`).getTime() >= now
    && overlapSpans(artistDays[i], clientWindows.filter(w => w.day_of_week === d.getDay())).some(span => span.end - span.start >= duration));
  const nextShared = !sharedThisWeek && findShared ? findShared(new Date(last.getTime() + 86400000)) : null;
  const knowsBoth = clientWindows.length > 0 && knowsArtist;

  // Mouse dragging of options. drag = { index, grabSlots, day, mins } while dragging.
  const bodies = useRef([]);
  const [drag, setDrag] = useState(null);
  const justDragged = useRef(false);

  // Where an option would land for the pointer position: the day column under (or
  // nearest) the pointer, snapped to half hours, kept inside the grid and not in the past.
  function dropAt(clientX, clientY, grabSlots) {
    const rects = bodies.current.map(el => el?.getBoundingClientRect());
    let dayIndex = rects.findIndex(r => r && clientX >= r.left && clientX <= r.right);
    if (dayIndex < 0) {
      dayIndex = rects.reduce((best, r, i) => (r && (best < 0 || Math.abs(clientX - (r.left + r.right) / 2) < Math.abs(clientX - (rects[best].left + rects[best].right) / 2)) ? i : best), -1);
    }
    const rect = rects[dayIndex];
    if (!rect) return null;
    let mins = start + (Math.round((clientY - rect.top) / SLOT_H) - grabSlots) * SLOT_MIN;
    mins = Math.min(Math.max(mins, start), end - duration);
    const date = toDate(days[dayIndex]);
    if (new Date(`${date}T${toHHMM(mins)}:00`).getTime() <= now) return null;
    return { day: dayIndex, mins };
  }

  function startDrag(event, index, mins) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !onMove) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const grabSlots = Math.floor((event.clientY - rect.top) / SLOT_H);
    const origin = { x: event.clientX, y: event.clientY };
    let current = null, moved = false;
    const move = e => {
      if (!moved && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < 4) return;
      moved = true;
      current = dropAt(e.clientX, e.clientY, grabSlots);
      setDrag(current ? { index, ...current } : { index, day: -1, mins });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      if (moved) {
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 0);
        if (current) onMove(index, toDate(days[current.day]), toHHMM(current.mins));
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function pick(day, event) {
    if (justDragged.current) return;
    if (!canPick || !onPick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mins = start + Math.floor(((event.clientY - rect.top) / SLOT_H)) * SLOT_MIN;
    const at = new Date(`${toDate(day)}T${toHHMM(mins)}:00`);
    if (at.getTime() <= now) { setNotice('That time has passed.'); return; }
    if (mins + duration > end) { setNotice('There isn’t room for the whole session before the end of the day.'); return; }
    if (isBusy(days.indexOf(day), mins)) { setNotice(`${artistName} is busy then. Pick a free spot.`); return; }
    onPick(toDate(day), toHHMM(mins));
  }

  return (
    <section aria-label="Week view" style={w.wrap}>
      <div style={w.head}>
        <button type="button" className="offer-week-nav" style={{ ...w.nav, opacity: thisWeek ? 0.35 : 1, cursor: thisWeek ? 'default' : 'pointer' }} onClick={() => shift(-1)} disabled={thisWeek} aria-label="Previous week">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span style={w.label}>{label}</span>
        <button type="button" className="offer-week-nav" style={w.nav} onClick={() => shift(1)} aria-label="Next week">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {knowsBoth && !sharedThisWeek && (
        <p style={w.banner} role="status">
          <span>{nextShared || !findShared
            ? `${artistName} and ${clientName} have no free time in common this week.`
            : `${artistName} and ${clientName} have no free time in common in the next six months. You can still offer other times, or ask ${clientName} when else suits.`}</span>
          {nextShared && (
            <button type="button" style={w.bannerButton} onClick={() => onWeekChange(mondayOf(new Date(`${nextShared}T00:00:00`)))}>
              Next shared time: {new Date(`${nextShared}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            </button>
          )}
        </p>
      )}

      <div style={w.grid}>
        <div style={{ ...w.timeCol, paddingTop: 30 }}>
          {hours.map(m => <span key={m} style={{ ...w.hourLabel, top: 30 + y(m) - 6 }}>{formatTime(toHHMM(m))}</span>)}
        </div>
        {days.map((day, dayIndex) => {
          const dow = day.getDay(), date = toDate(day);
          const isPast = new Date(`${date}T23:59:59`).getTime() < now;
          const client = clientWindows.filter(x => x.day_of_week === dow);
          const artist = artistDays[dayIndex];
          const both = overlapSpans(artist, client);
          const off = knowsArtist && artist.length === 0;
          const booked = busyByDay[dayIndex];
          // While dragging, the dragged option is drawn where it would land.
          const offered = options.map((o, i) => ({ ...o, n: i + 1, i }))
            .filter(o => (drag && drag.index === o.i ? drag.day === dayIndex : o.date === date && o.time))
            .map(o => (drag && drag.index === o.i ? { ...o, time: toHHMM(drag.mins), dragging: true } : o));
          return (
            <div key={date} style={w.dayCol}>
              <span style={{ ...w.dayHead, color: isPast || off ? 'var(--text-ghost)' : 'var(--text)' }} title={off ? 'Artist isn’t working here this day' : undefined}>
                {DAY_SHORT[dow]}<b style={{ ...w.dayNum, ...(date === today ? w.today : {}) }}>{day.getDate()}</b>
              </span>
              {/* Tapping is a shortcut; the date and time fields below do the same. */}
              <div
                aria-hidden="true"
                ref={el => { bodies.current[dayIndex] = el; }}
                onClick={event => pick(day, event)}
                style={{ ...w.body, height, cursor: canPick && !isPast ? 'pointer' : 'default', opacity: isPast ? 0.45 : 1 }}
              >
                {hours.slice(1, -1).map(m => <span key={m} style={{ ...w.line, top: y(m) }} />)}
                {artist.map((a, i) => (
                  <span key={`a${i}`} title={`Artist free ${formatTime(a.start_time)} – ${formatTime(a.end_time)}`}
                    style={{ ...w.artist, top: y(minutesOf(a.start_time)), height: y(endOf(a.end_time)) - y(minutesOf(a.start_time)) }} />
                ))}
                {client.map((c, i) => (
                  <span key={`c${i}`} title={`Client free ${formatTime(c.start_time)} – ${formatTime(c.end_time)}`}
                    style={{ ...w.client, top: y(minutesOf(c.start_time)), height: y(endOf(c.end_time)) - y(minutesOf(c.start_time)) }} />
                ))}
                {both.map((b, i) => (
                  <span key={`b${i}`} title={`Both free ${formatTime(toHHMM(b.start))} – ${formatTime(toHHMM(Math.min(b.end, 1439)))}`}
                    style={{ ...w.both, top: y(b.start), height: y(b.end) - y(b.start) }} />
                ))}
                {booked.map(b => {
                  const label = b.here ? 'Booked' : 'Busy';
                  const span = `${formatTime(toHHMM(Math.round(b.sm)))} – ${formatTime(toHHMM(Math.min(1439, Math.round(b.em))))}`;
                  const h = Math.max(SLOT_H, y(b.em) - y(b.sm));
                  return (
                    <span key={`${b.id}-${dayIndex}`} title={`${label} ${span}${b.here ? '' : b.kind === 'calendar' ? ' · their calendar' : ' · another booking'}`}
                      style={{ ...(b.here ? w.booked : w.busy), top: y(b.sm), height: h }}>
                      {label}{h >= SLOT_H * 3 && <small style={w.busyTime}>{span}</small>}
                    </span>
                  );
                })}
                {offered.map(o => {
                  const sm = minutesOf(o.time);
                  return (
                    // Inside the aria-hidden calendar, so out of the tab order: the option
                    // fields below have the same Remove buttons for keyboards and screen readers.
                    <button key={`o${o.n}`} type="button" tabIndex={-1} className="offer-week-option" data-dragging={o.dragging || undefined}
                      title={[`Option ${o.n}: ${formatTime(o.time)}`, onRemove && 'click to remove', onMove && 'drag to move'].filter(Boolean).join(' · ')}
                      onPointerDown={event => startDrag(event, o.i, sm)}
                      onClick={event => {
                        event.stopPropagation();
                        if (!justDragged.current && onRemove) onRemove(o.i);
                      }}
                      style={{ ...w.option, top: y(sm), height: Math.max(SLOT_H, y(sm + duration) - y(sm)), cursor: onMove ? (o.dragging ? 'grabbing' : 'grab') : onRemove ? 'pointer' : 'default', ...(o.dragging ? w.dragging : {}) }}>
                      <span className="offer-week-option-n">{o.n}</span>
                      {onRemove && !o.dragging && <span className="offer-week-option-x" aria-hidden="true">×</span>}
                      {o.dragging && <small style={w.dragTime}>{formatTime(o.time)}</small>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={w.legend} aria-hidden="true">
        <span style={w.key}><i style={{ ...w.swatch, ...w.artist, position: 'static' }} />Artist free</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.client, position: 'static' }} />Client free</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.both, position: 'static' }} />Both free</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.booked, position: 'static' }} />Booked</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.busy, position: 'static' }} />Busy</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.option, position: 'static' }} />Your options</span>
      </div>
      {notice && <p role="status" style={w.notice}>{notice}</p>}
      <p style={w.hint}>
        {canPick ? 'Tap a free spot to add it as an option.' : 'Tap an option to remove it, then pick another time.'}
        {canPick && onRemove && options.some(o => o.date && o.time) && ' Tap an option to remove it.'}
        {onMove && <span className="offer-week-drag-hint"> Drag an option to move it.</span>}
      </p>
    </section>
  );
}

const w = {
  wrap: { display: 'grid', gap: 8, padding: '10px 10px 12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nav: { width: 34, height: 34, display: 'grid', placeItems: 'center', padding: 0, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-chip)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' },
  banner: { margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', padding: '8px 10px', borderRadius: 8, background: 'rgba(var(--ink-rgb), 0.05)', fontSize: '0.78rem', color: 'var(--text-muted)' },
  bannerButton: { border: 0, background: 'none', padding: '4px 0', font: 'inherit', fontWeight: 700, color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' },
  notice: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-warning, #e0a84f)' },
  today: { display: 'inline-grid', placeItems: 'center', minWidth: 22, height: 22, marginTop: 1, borderRadius: 11, background: 'var(--accent)', color: 'var(--accent-contrast)' },
  label: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' },
  grid: { display: 'grid', gridTemplateColumns: '38px repeat(7, minmax(0, 1fr))', gap: 3 },
  timeCol: { position: 'relative' },
  hourLabel: { position: 'absolute', right: 2, fontSize: '0.6rem', color: 'var(--text-ghost)', whiteSpace: 'nowrap' },
  dayCol: { display: 'grid', gridTemplateRows: '30px auto', minWidth: 0 },
  dayHead: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.65rem', fontWeight: 600, lineHeight: 1.1 },
  dayNum: { fontSize: '0.8rem' },
  body: { position: 'relative', borderRadius: 6, background: 'rgba(var(--ink-rgb), 0.025)', overflow: 'hidden' },
  line: { position: 'absolute', left: 0, right: 0, borderTop: '1px solid rgba(var(--ink-rgb), 0.06)' },
  artist: { position: 'absolute', left: 0, right: 0, background: 'rgba(var(--ink-rgb), 0.1)' },
  client: { position: 'absolute', left: 0, right: 0, background: 'rgba(134, 203, 163, 0.2)' },
  both: { position: 'absolute', left: 0, right: 0, background: 'rgba(86, 178, 125, 0.5)' },
  booked: { position: 'absolute', left: 2, right: 2, borderRadius: 4, background: 'rgba(120,120,120,0.85)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, overflow: 'hidden', padding: '2px 4px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', lineHeight: 1.15 },
  busy: { position: 'absolute', left: 2, right: 2, borderRadius: 4, background: 'repeating-linear-gradient(135deg, rgba(var(--ink-rgb), 0.22) 0 4px, rgba(var(--ink-rgb), 0.08) 4px 8px)', border: '1px solid rgba(var(--ink-rgb), 0.25)', color: 'var(--text)', fontSize: '0.6rem', fontWeight: 700, overflow: 'hidden', padding: '2px 4px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', lineHeight: 1.15 },
  busyTime: { fontSize: '0.55rem', fontWeight: 500, opacity: 0.85 },
  option: { position: 'absolute', left: 2, right: 2, borderRadius: 4, border: 0, padding: 0, margin: 0, font: 'inherit', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.7rem', fontWeight: 800, display: 'grid', placeItems: 'center', boxSizing: 'border-box', WebkitTapHighlightColor: 'transparent' },
  dragging: { opacity: 0.85, boxShadow: '0 4px 14px rgba(0,0,0,0.45)', zIndex: 2, gridTemplateRows: 'auto auto', alignContent: 'center' },
  dragTime: { fontSize: '0.55rem', fontWeight: 700 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' },
  key: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  swatch: { display: 'inline-block', width: 12, height: 10, borderRadius: 2 },
  hint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-ghost)' },
};
