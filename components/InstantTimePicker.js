'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDay, formatLength, formatMoney, formatTime, todayIn, zoneNote } from '@/lib/booking-instant.mjs';
import { depositCharge, money } from '@/lib/booking-fee.mjs';
import { addMonths, lastMonth, loadMonth, monthGrid, monthLabel, monthOf, prefetchMonth, timesPlace, weekOf } from '@/lib/open-times.mjs';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Instant booking on the studio's booking form: pick one of the studio's appointment
// types, then a day on the month calendar, then one of the artist's open times that
// week. info is GET /artists/{id}/instant-booking.
export default function InstantTimePicker({ backend, artistId, info, typeId, onType, start, onStart }) {
  const zone = info.timezone;
  const today = useMemo(() => todayIn(zone), [zone]);
  const viewerZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
  const place = timesPlace(info);
  const startDay = start ? todayIn(zone, new Date(start)) : '';
  // Always opens on the month to pick a day; a time already chosen shows on its day.
  const [view, setView] = useState('month');
  const [month, setMonth] = useState(monthOf(startDay || today));
  const [day, setDay] = useState(startDay);
  const [weekStart, setWeekStart] = useState(weekOf(startDay || today)[0]);
  // Open times by type and month: { 'type|YYYY-MM': { date: [slots] } }.
  const [times, setTimes] = useState({});
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  // This month's times for every appointment start loading straight away, so the
  // calendar is ready once one is picked.
  useEffect(() => {
    for (const t of info.types) prefetchMonth({ backend, artistId, place, typeId: t.id, month: monthOf(today), today });
  }, [backend, artistId, place, info.types, today]);

  const week = useMemo(() => weekOf(weekStart), [weekStart]);
  const months = useMemo(() => (view === 'month' ? [month] : [...new Set(week.map(monthOf))]), [view, month, week]);
  const missing = months.filter(m => !times[`${typeId}|${m}`]);

  useEffect(() => {
    if (!typeId) return;
    let live = true;
    const args = { backend, artistId, place, typeId, today };
    setError('');
    Promise.all(months.map(m => loadMonth({ ...args, month: m }).then(data => [m, data])))
      .then(loaded => {
        if (!live) return;
        setTimes(prev => {
          const next = { ...prev };
          for (const [m, data] of loaded) next[`${typeId}|${m}`] = data;
          return next;
        });
        // The month after is fetched ahead, so moving on doesn't wait.
        const after = addMonths(months[months.length - 1], 1);
        if (after <= lastMonth(today)) prefetchMonth({ ...args, month: after });
      })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [backend, artistId, place, typeId, today, months, reload]);

  const slotsOn = date => times[`${typeId}|${monthOf(date)}`]?.[date] || [];
  const loaded = date => Boolean(times[`${typeId}|${monthOf(date)}`]);

  // In the week view, keep a day with times picked: the chosen one, else the week's first.
  useEffect(() => {
    if (view !== 'week' || missing.length) return;
    if (week.includes(day) && slotsOn(day).length) return;
    const first = week.find(d => slotsOn(d).length) || '';
    if (first !== day) setDay(first);
  });

  function openDay(date) {
    setDay(date);
    setWeekStart(weekOf(date)[0]);
    setView('week');
  }

  const note = zoneNote(zone, viewerZone);
  const loading = missing.length > 0 && !error;
  const thisMonth = monthOf(today);
  const finalMonth = lastMonth(today);
  const monthOpen = !loading && monthGrid(month).flat().some(d => d && d >= today && slotsOn(d).length);
  const daySlots = day ? slotsOn(day) : [];
  const shiftWeek = n => setWeekStart(w => weekOf(plusDays(w, 7 * n))[0]);

  const status = error ? (
    <p role="alert" style={st.error}>{error} <button type="button" style={st.link} onClick={() => setReload(n => n + 1)}>Try again</button></p>
  ) : loading ? (
    <p style={{ ...st.hint, display: 'flex', alignItems: 'center', gap: 8 }} aria-live="polite">
      <span className="bk-spinner" aria-hidden="true" style={st.spinner} /> Finding open times…
    </p>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div role="radiogroup" aria-label="Appointment" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {info.types.map(t => {
          const on = t.id === typeId;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} style={{ ...st.option, ...(on ? st.on : {}) }}
              onClick={() => { if (!on) { onType(t.id); onStart(''); setView('month'); setMonth(thisMonth); setDay(''); } }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={st.name}>{t.name}</span>
                <span style={st.meta}>{formatLength(t.duration_minutes)}</span>
              </span>
              {Number(t.deposit) > 0
                ? <span style={{ ...st.meta, marginTop: 0, flexShrink: 0, textAlign: 'right' }}>{money(depositCharge(t.deposit, { fee_absorbed: info?.fee_absorbed }).total)} to book<span style={{ display: 'block', fontSize: '0.72rem' }}>{info?.fee_absorbed ? 'deposit, no booking fee' : `${formatMoney(t.deposit)} deposit + ${money(depositCharge(t.deposit).fee)} Vanta booking fee`}</span></span>
                : <span style={{ ...st.meta, marginTop: 0, flexShrink: 0, textAlign: 'right' }}>Free<span style={{ display: 'block', fontSize: '0.72rem' }}>no deposit</span></span>}
            </button>
          );
        })}
      </div>

      {typeId && view === 'month' && (
        <section aria-label="Pick a day" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <span style={st.label}>Pick a day</span>
          <div style={st.calHead}>
            <span style={st.calTitle} aria-live="polite">{monthLabel(month)}</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" aria-label="Previous month" disabled={month <= thisMonth} style={{ ...st.pager, ...(month <= thisMonth ? st.off : {}) }}
                onClick={() => setMonth(m => addMonths(m, -1))}><Chevron left /></button>
              <button type="button" aria-label="Next month" disabled={month >= finalMonth} style={{ ...st.pager, ...(month >= finalMonth ? st.off : {}) }}
                onClick={() => setMonth(m => addMonths(m, 1))}><Chevron /></button>
            </span>
          </div>
          <div>
            <div style={st.weekdays} aria-hidden="true">{WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}</div>
            <div role="grid" aria-busy={loading} style={st.monthGrid}>
              {monthGrid(month).flat().map((date, i) => {
                if (!date) return <span key={`blank-${i}`} />;
                const count = !loading && date >= today ? slotsOn(date).length : 0;
                const chosen = date === startDay;
                return (
                  <button key={date} type="button" disabled={!count} onClick={() => openDay(date)}
                    aria-label={`${formatDay(date)}${count ? `, ${count} ${count === 1 ? 'time' : 'times'}` : ', no times'}`}
                    className={loading ? 'bk-cal-loading' : undefined}
                    style={{ ...st.calDay, ...(count ? st.calDayOpen : st.calDayOff), ...(chosen ? st.on : {}) }}>
                    <span style={{ fontWeight: count ? 650 : 500, textDecoration: date === today ? 'underline' : 'none', textUnderlineOffset: 3 }}>{Number(date.slice(8))}</span>
                    {count > 0 && <span aria-hidden="true" style={st.calDot} />}
                  </button>
                );
              })}
            </div>
          </div>
          {status || (!monthOpen ? (
            <p style={st.hint}>
              No open times in {monthLabel(month).split(' ')[0]}.{' '}
              {month < finalMonth && <button type="button" style={st.link} onClick={() => setMonth(m => addMonths(m, 1))}>See {monthLabel(addMonths(month, 1)).split(' ')[0]}</button>}
            </p>
          ) : <p style={st.hint}>Days with a dot have open times.</p>)}
        </section>
      )}

      {typeId && view === 'week' && (
        <section aria-label="Pick a time" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={st.calHead}>
            <button type="button" onClick={() => { setMonth(monthOf(day || weekStart)); setView('month'); }} style={st.backLink}>
              <Chevron left /> {monthLabel(monthOf(day || weekStart))}
            </button>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" aria-label="Previous week" disabled={weekStart <= weekOf(today)[0]} style={{ ...st.pager, ...(weekStart <= weekOf(today)[0] ? st.off : {}) }}
                onClick={() => shiftWeek(-1)}><Chevron left /></button>
              <button type="button" aria-label="Next week" disabled={monthOf(weekStart) > finalMonth} style={{ ...st.pager, ...(monthOf(weekStart) > finalMonth ? st.off : {}) }}
                onClick={() => shiftWeek(1)}><Chevron /></button>
            </span>
          </div>
          <div role="radiogroup" aria-label="Day" aria-busy={loading} style={st.weekRow}>
            {week.map(date => {
              const open = loaded(date) && date >= today && slotsOn(date).length > 0;
              const on = date === day;
              const [weekday, num] = formatDay(date).split(' ');
              return (
                <button key={date} type="button" role="radio" aria-checked={on} disabled={!open}
                  aria-label={`${formatDay(date)}${open ? '' : ', no times'}`}
                  className={loading ? 'bk-cal-loading' : undefined}
                  style={{ ...st.day, ...(on ? st.on : {}), ...(!open ? st.dayOff : {}) }} onClick={() => setDay(date)}>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{weekday}</span>
                  <span style={{ fontSize: 15, fontWeight: 650 }}>{num}</span>
                </button>
              );
            })}
          </div>
          {status || (!daySlots.length ? (
            <p style={st.hint}>No open times this week. <button type="button" style={st.link} onClick={() => shiftWeek(1)}>Next week</button></p>
          ) : (
            <>
              <span style={st.label}>{formatDay(day)}</span>
              <div role="radiogroup" aria-label="Start time" style={st.slotGrid}>
                {daySlots.map(slot => {
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
          ))}
        </section>
      )}
    </div>
  );
}

function plusDays(date, offset) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
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
  spinner: { width: 12, height: 12, flex: 'none', borderRadius: '50%', border: '2px solid currentColor', borderRightColor: 'transparent' },
  pager: { width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid rgba(var(--ink-rgb), 0.12)', background: 'none', color: 'inherit', cursor: 'pointer' },
  calHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  calTitle: { fontSize: '0.95rem', fontWeight: 650, color: 'var(--text-dim, #ddd)' },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 30, padding: '0 8px 0 4px', marginLeft: -4, borderRadius: 8, border: 'none', background: 'none', boxShadow: 'none', color: 'var(--text-dim, #ddd)', font: 'inherit', fontSize: '0.95rem', fontWeight: 650, cursor: 'pointer' },
  weekdays: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 },
  monthGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  calDay: { aspectRatio: '1 / 1', minHeight: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 0, borderRadius: 10, border: '1px solid transparent', fontFamily: 'inherit', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums', transition: 'background-color 150ms ease, color 150ms ease' },
  calDayOpen: { background: 'rgba(var(--ink-rgb), 0.07)', border: '1px solid rgba(var(--ink-rgb), 0.12)', color: 'var(--text-dim, #ddd)', cursor: 'pointer' },
  calDayOff: { background: 'none', boxShadow: 'none', color: 'rgba(var(--ink-rgb), 0.3)', cursor: 'default' },
  calDot: { width: 4, height: 4, borderRadius: '50%', background: 'currentColor' },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 },
  day: { minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0.5rem 0', borderRadius: 10, background: 'rgba(var(--ink-rgb), 0.05)', border: '1px solid rgba(var(--ink-rgb), 0.1)', color: 'var(--text-dim, #ddd)', fontFamily: 'inherit', cursor: 'pointer' },
  dayOff: { opacity: 0.35, background: 'none', boxShadow: 'none', cursor: 'default' },
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: '0.4rem' },
  slot: { padding: '0.6rem 0', borderRadius: 8, background: 'rgba(var(--ink-rgb), 0.05)', border: '1px solid rgba(var(--ink-rgb), 0.1)', color: 'var(--text-dim, #ddd)', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' },
  error: { fontSize: '0.78rem', color: 'var(--color-danger)', margin: 0 },
  link: { background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' },
};
