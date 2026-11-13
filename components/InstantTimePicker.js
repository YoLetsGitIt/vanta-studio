'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, formatDay, formatLength, formatMoney, formatTime, todayIn, zoneNote } from '@/lib/booking-instant.mjs';
import { depositCharge, money } from '@/lib/booking-fee.mjs';

const DAYS_PER_PAGE = 14;

// Instant booking on the studio's booking form: pick one of the studio's appointment
// types, then one of the chosen artist's open times. info is GET /artists/{id}/instant-booking.
export default function InstantTimePicker({ backend, artistId, info, typeId, onType, start, onStart }) {
  const zone = info.timezone;
  const today = useMemo(() => todayIn(zone), [zone]);
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState('');
  const [reload, setReload] = useState(0);
  const viewerZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';

  useEffect(() => {
    if (!typeId) return;
    const controller = new AbortController();
    setDays(null);
    setError('');
    fetch(`${backend}/artists/${artistId}/open-times?type_id=${typeId}&date=${from}&days=${DAYS_PER_PAGE}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Times could not be loaded. Please try again.');
        const list = data.days || [];
        setDays(list);
        setDay(current => (list.some(d => d.date === current && d.slots.length) ? current : list.find(d => d.slots.length)?.date || ''));
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [backend, artistId, typeId, from, reload]);

  const selectedDay = days?.find(d => d.date === day);
  const anyOpen = days?.some(d => d.slots.length);
  const note = zoneNote(zone, viewerZone);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div role="radiogroup" aria-label="Appointment" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {info.types.map(t => {
          const on = t.id === typeId;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} style={{ ...st.option, ...(on ? st.on : {}) }}
              onClick={() => { if (!on) { onType(t.id); onStart(''); setFrom(today); } }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={st.name}>{t.name}</span>
                <span style={st.meta}>{formatLength(t.duration_minutes)}</span>
              </span>
              <span style={{ ...st.meta, marginTop: 0, flexShrink: 0 }}>{money(depositCharge(t.deposit).total)} to book<span style={{ display: 'block', fontSize: '0.72rem', textAlign: 'right' }}>{formatMoney(t.deposit)} deposit + {money(depositCharge(t.deposit).fee)} Vanta booking fee</span></span>
            </button>
          );
        })}
      </div>

      {typeId && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={st.label}>Day</span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button type="button" aria-label="Earlier days" disabled={from <= today} style={{ ...st.pager, ...(from <= today ? st.off : {}) }}
                onClick={() => setFrom(f => { const back = addDays(f, -DAYS_PER_PAGE); return back < today ? today : back; })}><Chevron left /></button>
              <button type="button" aria-label="Later days" style={st.pager} onClick={() => setFrom(f => addDays(f, DAYS_PER_PAGE))}><Chevron /></button>
            </span>
          </div>
          {error ? (
            <p role="alert" style={st.error}>{error} <button type="button" style={st.link} onClick={() => setReload(n => n + 1)}>Try again</button></p>
          ) : !days ? (
            <p style={st.hint} aria-live="polite">Loading times…</p>
          ) : !anyOpen ? (
            <p style={st.hint}>No open times in these two weeks. <button type="button" style={st.link} onClick={() => setFrom(f => addDays(f, DAYS_PER_PAGE))}>See the next two weeks</button></p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Day" style={st.dayRow}>
                {days.map(d => {
                  const open = d.slots.length > 0;
                  const on = d.date === day;
                  const [weekday, ...rest] = formatDay(d.date).split(' ');
                  return (
                    <button key={d.date} type="button" role="radio" aria-checked={on} disabled={!open} aria-label={`${formatDay(d.date)}${open ? '' : ', no times'}`}
                      style={{ ...st.day, ...(on ? st.on : {}), ...(!open ? st.off : {}) }} onClick={() => setDay(d.date)}>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{weekday}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{rest.join(' ')}</span>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <>
                  <span style={st.label}>Time</span>
                  <div role="radiogroup" aria-label="Start time" style={st.slotGrid}>
                    {selectedDay.slots.map(slot => {
                      const on = slot === start;
                      return (
                        <button key={slot} type="button" role="radio" aria-checked={on} style={{ ...st.slot, ...(on ? st.on : {}) }} onClick={() => onStart(slot)}>
                          {formatTime(slot, zone)}
                        </button>
                      );
                    })}
                  </div>
                  {note && <p style={st.hint}>{note}</p>}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Chevron({ left = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: left ? 'scaleX(-1)' : undefined }}>
      <path d="M5 2.5 9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const st = {
  option: { display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', textAlign: 'left', padding: '0.75rem 0.9rem', borderRadius: 10, background: 'rgba(var(--ink-rgb), 0.05)', border: '1px solid rgba(var(--ink-rgb), 0.1)', color: 'var(--text-dim, #ddd)', fontFamily: 'inherit', cursor: 'pointer', transition: 'background-color 150ms ease, border-color 150ms ease' },
  on: { background: 'var(--cf-accent-soft)', border: '1px solid var(--cf-accent)', boxShadow: 'inset 0 0 0 1px var(--cf-accent)', color: 'var(--cf-accent)' },
  off: { opacity: 0.3, cursor: 'not-allowed' },
  name: { display: 'block', fontSize: '0.9rem', fontWeight: 600 },
  meta: { display: 'block', fontSize: '0.75rem', opacity: 0.75, marginTop: 2 },
  label: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  hint: { fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 },
  pager: { width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid rgba(var(--ink-rgb), 0.12)', background: 'none', color: 'inherit', cursor: 'pointer' },
  dayRow: { display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: 4, overscrollBehaviorX: 'contain' },
  day: { flex: '0 0 auto', width: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0.5rem 0', borderRadius: 10, background: 'rgba(var(--ink-rgb), 0.05)', border: '1px solid rgba(var(--ink-rgb), 0.1)', color: 'var(--text-dim, #ddd)', fontFamily: 'inherit', cursor: 'pointer' },
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: '0.4rem' },
  slot: { padding: '0.6rem 0', borderRadius: 8, background: 'rgba(var(--ink-rgb), 0.05)', border: '1px solid rgba(var(--ink-rgb), 0.1)', color: 'var(--text-dim, #ddd)', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' },
  error: { fontSize: '0.78rem', color: 'var(--color-danger)', margin: 0 },
  link: { background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' },
};
