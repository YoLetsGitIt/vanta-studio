'use client';

// Week calendar for "Offer times": the client's weekly availability (shaded), the
// artist's working hours (outlined), the artist's bookings (solid) and the times being
// offered (numbered). Tap an empty spot to offer that time. With a mouse, drag an
// option to another time or day.
import { useRef, useState } from 'react';
import { formatTime } from '@/lib/availability';

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

export default function OfferWeekView({ weekStart, onWeekChange, clientWindows = [], artistHours = [], bookings = [], options = [], duration = 60, onPick, onMove, canPick = true }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });

  // Hours shown: everything anyone is available, at least 9am–6pm, within 7am–10pm.
  const spans = [...clientWindows, ...artistHours].map(w => [minutesOf(w.start_time), endOf(w.end_time)]);
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
    if (at.getTime() <= now || mins + duration > end) return;
    onPick(toDate(day), toHHMM(mins));
  }

  return (
    <section aria-label="Week view" style={w.wrap}>
      <div style={w.head}>
        <button type="button" style={w.nav} onClick={() => shift(-1)} disabled={thisWeek} aria-label="Previous week">‹</button>
        <span style={w.label}>{label}</span>
        <button type="button" style={w.nav} onClick={() => shift(1)} aria-label="Next week">›</button>
      </div>

      <div style={w.grid}>
        <div style={{ ...w.timeCol, paddingTop: 30 }}>
          {hours.map(m => <span key={m} style={{ ...w.hourLabel, top: 30 + y(m) - 6 }}>{formatTime(toHHMM(m))}</span>)}
        </div>
        {days.map((day, dayIndex) => {
          const dow = day.getDay(), date = toDate(day);
          const isPast = new Date(`${date}T23:59:59`).getTime() < now;
          const client = clientWindows.filter(x => x.day_of_week === dow);
          const artist = artistHours.filter(x => x.day_of_week === dow);
          const booked = bookings.filter(b => toDate(new Date(b.chosenTime)) === date);
          // While dragging, the dragged option is drawn where it would land.
          const offered = options.map((o, i) => ({ ...o, n: i + 1, i }))
            .filter(o => (drag && drag.index === o.i ? drag.day === dayIndex : o.date === date && o.time))
            .map(o => (drag && drag.index === o.i ? { ...o, time: toHHMM(drag.mins), dragging: true } : o));
          return (
            <div key={date} style={w.dayCol}>
              <span style={{ ...w.dayHead, color: isPast ? 'var(--text-ghost)' : 'var(--text)' }}>
                {DAY_SHORT[dow]}<b style={w.dayNum}>{day.getDate()}</b>
              </span>
              {/* Tapping is a shortcut; the date and time fields below do the same. */}
              <div
                aria-hidden="true"
                ref={el => { bodies.current[dayIndex] = el; }}
                onClick={event => pick(day, event)}
                style={{ ...w.body, height, cursor: canPick && !isPast ? 'pointer' : 'default', opacity: isPast ? 0.45 : 1 }}
              >
                {hours.slice(1, -1).map(m => <span key={m} style={{ ...w.line, top: y(m) }} />)}
                {client.map((c, i) => (
                  <span key={`c${i}`} title={`Client free ${formatTime(c.start_time)} – ${formatTime(c.end_time)}`}
                    style={{ ...w.client, top: y(minutesOf(c.start_time)), height: y(endOf(c.end_time)) - y(minutesOf(c.start_time)) }} />
                ))}
                {artist.map((a, i) => (
                  <span key={`a${i}`} title={`Artist works ${formatTime(a.start_time)} – ${formatTime(a.end_time)}`}
                    style={{ ...w.artist, top: y(minutesOf(a.start_time)), height: y(endOf(a.end_time)) - y(minutesOf(a.start_time)) }} />
                ))}
                {booked.map(b => {
                  const s = new Date(b.chosenTime), sm = s.getHours() * 60 + s.getMinutes();
                  return (
                    <span key={b.bookingId} title={`Booked ${formatTime(toHHMM(sm))}`}
                      style={{ ...w.booked, top: y(sm), height: Math.max(SLOT_H, y(sm + (b.durationMins ?? 60)) - y(sm)) }}>Booked</span>
                  );
                })}
                {offered.map(o => {
                  const sm = minutesOf(o.time);
                  return (
                    <span key={`o${o.n}`} title={onMove ? `Option ${o.n}: ${formatTime(o.time)} · drag to move` : `Option ${o.n}: ${formatTime(o.time)}`}
                      onPointerDown={event => startDrag(event, o.i, sm)}
                      onClick={event => event.stopPropagation()}
                      style={{ ...w.option, top: y(sm), height: Math.max(SLOT_H, y(sm + duration) - y(sm)), cursor: onMove ? (o.dragging ? 'grabbing' : 'grab') : 'default', ...(o.dragging ? w.dragging : {}) }}>
                      {o.n}{o.dragging && <small style={w.dragTime}>{formatTime(o.time)}</small>}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={w.legend} aria-hidden="true">
        <span style={w.key}><i style={{ ...w.swatch, ...w.client, position: 'static' }} />Client free</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.artist, position: 'static' }} />Artist’s hours</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.booked, position: 'static' }} />Booked</span>
        <span style={w.key}><i style={{ ...w.swatch, ...w.option, position: 'static' }} />Your options</span>
      </div>
      <p style={w.hint}>
        {canPick ? 'Tap a free spot to add it as an option.' : 'Remove an option to pick another time here.'}
        {onMove && <span className="offer-week-drag-hint"> Drag an option to move it.</span>}
      </p>
    </section>
  );
}

const w = {
  wrap: { display: 'grid', gap: 8, padding: '10px 10px 12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nav: { width: 36, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-chip)', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'inherit' },
  label: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' },
  grid: { display: 'grid', gridTemplateColumns: '38px repeat(7, minmax(0, 1fr))', gap: 3 },
  timeCol: { position: 'relative' },
  hourLabel: { position: 'absolute', right: 2, fontSize: '0.6rem', color: 'var(--text-ghost)', whiteSpace: 'nowrap' },
  dayCol: { display: 'grid', gridTemplateRows: '30px auto', minWidth: 0 },
  dayHead: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.65rem', fontWeight: 600, lineHeight: 1.1 },
  dayNum: { fontSize: '0.8rem' },
  body: { position: 'relative', borderRadius: 6, background: 'rgba(255,255,255,0.025)', overflow: 'hidden' },
  line: { position: 'absolute', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.05)' },
  client: { position: 'absolute', left: 0, right: 0, background: 'rgba(134, 203, 163, 0.22)' },
  artist: { position: 'absolute', left: 1, right: 1, border: '1.5px dashed rgba(255,255,255,0.45)', borderRadius: 4, boxSizing: 'border-box' },
  booked: { position: 'absolute', left: 2, right: 2, borderRadius: 4, background: 'rgba(130,130,130,0.75)', color: '#fff', fontSize: '0.55rem', fontWeight: 600, overflow: 'hidden', padding: '1px 2px', boxSizing: 'border-box' },
  option: { position: 'absolute', left: 2, right: 2, borderRadius: 4, background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.7rem', fontWeight: 800, display: 'grid', placeItems: 'center', boxSizing: 'border-box' },
  dragging: { opacity: 0.85, boxShadow: '0 4px 14px rgba(0,0,0,0.45)', zIndex: 2, gridTemplateRows: 'auto auto', alignContent: 'center' },
  dragTime: { fontSize: '0.55rem', fontWeight: 700 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.7rem', color: 'var(--text-muted)' },
  key: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  swatch: { display: 'inline-block', width: 12, height: 10, borderRadius: 2 },
  hint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-ghost)' },
};
