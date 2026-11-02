'use client';

// Week grid like the mobile app's availability picker: drag down a day column to
// add a time range, tap a range to remove it. Ranges on the same day merge when
// they touch. Value is [{ day_of_week, start_time, end_time }] (0 = Sunday).
import { useRef, useState } from 'react';
import { WEEK_DAYS, formatTime, describeAvailability } from '@/lib/availability';

const START_HOUR = 8;
const END_HOUR = 21;
const SLOT_MIN = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN;
const SLOT_H = 15;
const GRID_H = TOTAL_SLOTS * SLOT_H;
const DRAG_THRESHOLD = 6;

const slotToTime = slot => {
  const mins = START_HOUR * 60 + slot * SLOT_MIN;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};
const timeToSlot = time => {
  const [h, m] = time.split(':').map(Number);
  return Math.round(((h - START_HOUR) * 60 + m) / SLOT_MIN);
};

export default function WeeklyAvailabilityGrid({ value, onChange, accent = 'rgba(255,255,255,0.85)' }) {
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
          {WEEK_DAYS.map(d => <span key={d.dow} style={g.dayHead}>{d.short}</span>)}
        </div>
        <div style={{ display: 'flex', height: GRID_H }}>
          {/* Hour labels */}
          <div style={{ ...g.timeCol, position: 'relative', height: GRID_H }} aria-hidden="true">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <span key={i} style={{ ...g.hourLabel, top: i * 2 * SLOT_H - 5 }}>{formatTime(slotToTime(i * 2))}</span>
            ))}
          </div>
          {WEEK_DAYS.map(({ dow, long }) => {
            const live = drag && drag.dow === dow && drag.moved && !drag.onBlock
              ? [Math.min(drag.start, drag.current), Math.max(drag.start, drag.current) + 1]
              : null;
            return (
              <div
                key={dow}
                role="presentation"
                data-day={long}
                style={g.col}
                onPointerDown={e => onPointerDown(e, dow)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
              >
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <span key={i} style={{ ...g.hourLine, top: i * 2 * SLOT_H }} />
                ))}
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
      <p style={g.hint}>Drag down a day to add the hours that suit you. Tap a block to remove it.</p>

      {summary.length > 0 && (
        <ul aria-label="Your selected times" style={g.list}>
          {sorted.map(w => {
            const day = WEEK_DAYS.find(d => d.dow === w.day_of_week)?.long;
            const label = `${day} ${formatTime(w.start_time)} – ${formatTime(w.end_time)}`;
            return (
              <li key={`${w.day_of_week}-${w.start_time}`} style={g.item}>
                <span><span style={{ fontWeight: 600, color: '#fff' }}>{day}</span> · {formatTime(w.start_time)} – {formatTime(w.end_time)}</span>
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
    background: 'rgba(255,255,255,0.06)', borderLeft: '1px solid rgba(255,255,255,0.05)',
    touchAction: 'none',
  },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' },
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 4, pointerEvents: 'none' },
  hint: { fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' },
  remove: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', width: 36, height: 36, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
};
