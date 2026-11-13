'use client';

// Week grid like the mobile app's availability picker: drag down a day column to
// add a time range, tap a range to remove it. Ranges on the same day merge when
// they touch. Value is [{ day_of_week, start_time, end_time }] (0 = Sunday).
// The grid follows the studio's opening hours: it spans the earliest opening to the
// latest closing, closed days can't be picked, and each day stops at its own hours.
import { useRef, useState } from 'react';
import { WEEK_DAYS, formatTime, describeAvailability } from '@/lib/availability';

const SLOT_MIN = 30;
const SLOT_H = 15;
const DRAG_THRESHOLD = 6;
const FALLBACK = { start: 8 * 60, end: 21 * 60 }; // only when the studio has no hours set

const toMinutes = time => {
  const [h, m] = String(time || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

// { [dow]: { open, close } in minutes } for open days; closing at or before opening means midnight.
function openDays(hours) {
  const days = {};
  for (const d of hours ?? []) {
    if (d.is_closed) continue;
    const open = toMinutes(d.open_time);
    let close = toMinutes(d.close_time);
    if (open == null || close == null) continue;
    if (close <= open) close = 24 * 60;
    days[d.day_of_week] = { open, close };
  }
  return days;
}

export default function WeeklyAvailabilityGrid({ value, onChange, hours, accent = 'rgba(var(--ink-rgb), 0.85)' }) {
  const days = openDays(hours);
  const known = Object.keys(days).length > 0;
  const range = known
    ? {
      start: Math.floor(Math.min(...Object.values(days).map(d => d.open)) / SLOT_MIN) * SLOT_MIN,
      end: Math.ceil(Math.max(...Object.values(days).map(d => d.close)) / SLOT_MIN) * SLOT_MIN,
    }
    : FALLBACK;
  const TOTAL_SLOTS = Math.max(1, (range.end - range.start) / SLOT_MIN);
  const GRID_H = TOTAL_SLOTS * SLOT_H;
  const slotToTime = slot => {
    const mins = Math.min(range.start + slot * SLOT_MIN, 24 * 60 - 1); // midnight is stored as 23:59
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };
  const timeToSlot = time => Math.round((toMinutes(time) + (time === '23:59' ? 1 : 0) - range.start) / SLOT_MIN);
  // Slots [lo, hi) a client may pick on this day; null when the studio is closed.
  const openSlots = dow => {
    if (!known) return { lo: 0, hi: TOTAL_SLOTS };
    const d = days[dow];
    if (!d) return null;
    return { lo: Math.max(0, Math.ceil((d.open - range.start) / SLOT_MIN)), hi: Math.min(TOTAL_SLOTS, Math.floor((d.close - range.start) / SLOT_MIN)) };
  };
  const firstHour = Math.ceil(range.start / 60);
  const hourMarks = [];
  for (let h = firstHour; h * 60 < range.end; h++) hourMarks.push(h);

  const [drag, setDrag] = useState(null); // { dow, start, current, moved }
  const dragRef = useRef(null);

  const windowsFor = dow => value.filter(w => w.day_of_week === dow);

  function slotAt(e, el) {
    const rect = el.getBoundingClientRect();
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height - 1);
    return Math.floor((y / rect.height) * TOTAL_SLOTS);
  }

  function blockAt(dow, slot) {
    return windowsFor(dow).find(w => timeToSlot(w.start_time) <= slot && timeToSlot(w.end_time) > slot);
  }

  function addRange(dow, lo, hi) {
    const open = openSlots(dow);
    if (!open) return;
    lo = Math.max(lo, open.lo);
    hi = Math.min(hi, open.hi);
    if (hi <= lo) return;
    // Merge with any range on that day that overlaps or touches [lo, hi).
    let mLo = lo, mHi = hi;
    const keep = [];
    for (const w of value) {
      const s = timeToSlot(w.start_time), e = timeToSlot(w.end_time);
      if (w.day_of_week === dow && s <= hi && e >= lo) { mLo = Math.min(mLo, s); mHi = Math.max(mHi, e); }
      else keep.push(w);
    }
    onChange([...keep, { day_of_week: dow, start_time: slotToTime(mLo), end_time: slotToTime(mHi) }]);
  }

  function remove(target) {
    onChange(value.filter(w => w !== target));
  }

  function onPointerDown(e, dow) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!openSlots(dow)) return; // closed day
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const slot = slotAt(e, e.currentTarget);
    const d = { dow, start: slot, current: slot, startY: e.clientY, moved: false, onBlock: !!blockAt(dow, slot) };
    dragRef.current = d;
    setDrag(d);
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const moved = d.moved || Math.abs(e.clientY - d.startY) >= DRAG_THRESHOLD;
    const next = { ...d, moved, current: slotAt(e, e.currentTarget) };
    dragRef.current = next;
    setDrag(next);
  }

  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const hit = blockAt(d.dow, d.start);
    if (!d.moved) {
      // Tap: remove the range under the finger, or add half an hour.
      if (hit) remove(hit);
      else addRange(d.dow, d.start, d.start + 1);
      return;
    }
    if (d.onBlock) { if (hit) remove(hit); return; } // dragging from a range removes it, like mobile
    addRange(d.dow, Math.min(d.start, d.current), Math.max(d.start, d.current) + 1);
  }

  function onPointerCancel() {
    dragRef.current = null;
    setDrag(null);
  }

  const summary = describeAvailability(value);
  const sorted = [...value].sort((a, b) =>
    WEEK_DAYS.findIndex(d => d.dow === a.day_of_week) - WEEK_DAYS.findIndex(d => d.dow === b.day_of_week)
    || a.start_time.localeCompare(b.start_time));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={g.wrap}>
        {/* Day headers */}
        <div style={g.headRow}>
          <span style={g.timeCol} />
          {WEEK_DAYS.map(d => <span key={d.dow} style={{ ...g.dayHead, ...(openSlots(d.dow) ? null : { opacity: 0.4 }) }}>{d.short}</span>)}
        </div>
        <div style={{ display: 'flex', height: GRID_H }}>
          {/* Hour labels */}
          <div style={{ ...g.timeCol, position: 'relative', height: GRID_H }} aria-hidden="true">
            {hourMarks.map(h => (
              <span key={h} style={{ ...g.hourLabel, top: ((h * 60 - range.start) / SLOT_MIN) * SLOT_H - 5 }}>{formatTime(`${String(h).padStart(2, '0')}:00`)}</span>
            ))}
          </div>
          {WEEK_DAYS.map(({ dow, long }) => {
            const open = openSlots(dow);
            const live = drag && drag.dow === dow && drag.moved && !drag.onBlock
              ? [Math.min(drag.start, drag.current), Math.max(drag.start, drag.current) + 1]
              : null;
            return (
              <div
                key={dow}
                role="presentation"
                data-day={long}
                data-closed={open ? undefined : 'true'}
                aria-label={open ? undefined : `${long}: closed`}
                style={{ ...g.col, ...(open ? null : g.closedCol) }}
                onPointerDown={e => onPointerDown(e, dow)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
              >
                {hourMarks.map(h => (
                  <span key={h} style={{ ...g.hourLine, top: ((h * 60 - range.start) / SLOT_MIN) * SLOT_H }} />
                ))}
                {/* Shade the hours this day is closed. */}
                {open && open.lo > 0 && <span style={{ ...g.shut, top: 0, height: open.lo * SLOT_H }} />}
                {open && open.hi < TOTAL_SLOTS && <span style={{ ...g.shut, top: open.hi * SLOT_H, bottom: 0 }} />}
                {!open && <span style={g.closedLabel}>Closed</span>}
                {windowsFor(dow).map(w => {
                  const s = timeToSlot(w.start_time), e = timeToSlot(w.end_time);
                  return <span key={`${w.start_time}-${w.end_time}`} style={{ ...g.block, background: accent, top: s * SLOT_H + 1, height: (e - s) * SLOT_H - 2 }} />;
                })}
                {live && <span style={{ ...g.block, background: accent, opacity: 0.45, top: live[0] * SLOT_H + 1, height: (live[1] - live[0]) * SLOT_H - 2 }} />}
              </div>
            );
          })}
        </div>
      </div>
      {/* How to drag is explained above the grid by the form. */}
      {known && <p style={g.hint}>Shaded times are outside the studio’s opening hours.</p>}

      {summary.length > 0 && (
        <ul aria-label="Your selected times" style={g.list}>
          {sorted.map(w => {
            const day = WEEK_DAYS.find(d => d.dow === w.day_of_week)?.long;
            const label = `${day} ${formatTime(w.start_time)} – ${formatTime(w.end_time)}`;
            return (
              <li key={`${w.day_of_week}-${w.start_time}`} style={g.item}>
                <span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{day}</span> · {formatTime(w.start_time)} – {formatTime(w.end_time)}</span>
                <button type="button" aria-label={`Remove ${label}`} onClick={() => remove(w)} style={g.remove}>✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const g = {
  wrap: { display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none' },
  headRow: { display: 'flex', paddingBottom: 6 },
  timeCol: { width: 38, flexShrink: 0 },
  dayHead: { flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  hourLabel: { position: 'absolute', right: 5, fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', lineHeight: '10px' },
  col: {
    flex: '1 1 0', minWidth: 0, position: 'relative', cursor: 'crosshair',
    background: 'rgba(var(--ink-rgb), 0.06)', borderLeft: '1px solid rgba(var(--ink-rgb), 0.05)',
    touchAction: 'none',
  },
  closedCol: { cursor: 'not-allowed', background: 'rgba(var(--ink-rgb), 0.02)' },
  closedLabel: { position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', writingMode: 'vertical-rl', margin: '0 auto', pointerEvents: 'none' },
  shut: { position: 'absolute', left: 0, right: 0, background: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.35) 0 4px, rgba(0,0,0,0.15) 4px 8px)', pointerEvents: 'none' },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 1, background: 'rgba(var(--ink-rgb), 0.08)', pointerEvents: 'none' },
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 4, pointerEvents: 'none' },
  hint: { fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' },
  remove: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', width: 36, height: 36, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
};
