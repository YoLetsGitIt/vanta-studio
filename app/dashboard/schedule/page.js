'use client';

import { useState, useEffect } from 'react';
import { getStudioArtists, getStudioSchedule, getStudioScheduleRange, getStudioBooking, acceptBookingWithStation, createManualBooking, createFollowUpBooking, rejectBooking, recordOutcome } from '@/lib/api';
import BookingDetailPanel from '@/components/BookingDetailPanel';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import RejectBookingModal from '@/components/RejectBookingModal';
import { initials, toISODate } from '@/lib/format';

const HOUR_PX   = 64;
const DAY_START = 8;
const DAY_END   = 20;
const HOURS     = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
const GRID_H    = (DAY_END - DAY_START) * HOUR_PX;

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// All block colours are source-based — no per-artist palette.
const SOURCE_STYLE = {
  studio:   { bg: 'rgba(245,158,58,0.12)',  border: '#f59e3a', tag: 'Studio',   tagColor: '#f59e3a', dot: '#f59e3a' },
  personal: { bg: 'rgba(167,139,250,0.12)', border: '#a78bfa', tag: 'Personal', tagColor: '#a78bfa', dot: '#a78bfa' },
};
function srcStyle(source) {
  return (source === 'walkin' || source === 'web') ? SOURCE_STYLE.studio : SOURCE_STYLE.personal;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const toISO = toISODate; // local alias; the many call sites below read cleaner as toISO
function getMonday(d) {
  const r = new Date(d);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function getMonthStart(d) { const r = new Date(d.getFullYear(), d.getMonth(), 1); r.setHours(0, 0, 0, 0); return r; }
function minutesFromMidnight(iso) { const d = new Date(iso); return d.getHours()*60 + d.getMinutes(); }
function isSameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }

const MONTH_CHIP_LIMIT = 3;

function fmtDuration(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(iso) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2,'0')}${suffix}`;
}

// ── Shared booking-action state for Week/Day views ───────────────────────────

function useBookingActions(afterChange) {
  const [selectedEntry,  setSelectedEntry]  = useState(null);
  const [detailBooking,  setDetailBooking]  = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [noShowTarget,   setNoShowTarget]   = useState(null);
  const [rejectTarget,   setRejectTarget]   = useState(null);

  function openDetail(entry) {
    setSelectedEntry(entry);
    setDetailBooking(null);
    setDetailLoading(true);
    getStudioBooking(entry.bookingId)
      .then(setDetailBooking)
      .catch(() => {}) // fall back to schedule entry data
      .finally(() => setDetailLoading(false));
  }

  function closeDetail() {
    setSelectedEntry(null);
    setDetailBooking(null);
  }

  async function run(action, clearTarget) {
    setActionLoading(true);
    try {
      await action();
      clearTarget();
      closeDetail();
      afterChange();
    } catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  function handleAction(action, stationId) {
    if (!selectedEntry) return;
    if (action === 'complete') {
      const price = detailBooking?.final_price ?? detailBooking?.estimated_quote ?? selectedEntry?.estimatedQuote;
      setCompleteTarget({ id: selectedEntry.bookingId, price });
      return;
    }
    if (action === 'no_show') { setNoShowTarget(selectedEntry.bookingId); return; }
    if (action === 'reject')  { setRejectTarget(selectedEntry.bookingId); return; }
    if (action === 'accept')  run(() => acceptBookingWithStation(selectedEntry.bookingId, stationId), () => {});
  }

  const confirmComplete = (finalPrice, paymentMethod, wantsFollowUp) =>
    run(async () => {
      await recordOutcome(completeTarget.id, 'completed', finalPrice, paymentMethod);
      if (wantsFollowUp) await createFollowUpBooking(completeTarget.id);
    }, () => setCompleteTarget(null));
  const confirmNoShow = () =>
    run(() => recordOutcome(noShowTarget, 'no_show'), () => setNoShowTarget(null));
  const confirmReject = (reason) =>
    run(() => rejectBooking(rejectTarget, reason), () => setRejectTarget(null));

  return {
    selectedEntry, detailBooking, detailLoading, actionLoading,
    completeTarget, noShowTarget, rejectTarget,
    openDetail, closeDetail, handleAction,
    confirmComplete, confirmNoShow, confirmReject,
    setCompleteTarget, setNoShowTarget, setRejectTarget,
  };
}

function BookingOverlays({ actions: a }) {
  return (
    <>
      {a.selectedEntry && (
        <BookingDetailPanel
          entry={a.selectedEntry}
          booking={a.detailBooking}
          loading={a.detailLoading}
          actionLoading={a.actionLoading}
          onClose={a.closeDetail}
          onAccept={(stationId) => a.handleAction('accept', stationId)}
          onReject={() => a.handleAction('reject')}
          onComplete={() => a.handleAction('complete')}
          onNoShow={() => a.handleAction('no_show')}
        />
      )}
      {a.completeTarget && (
        <CompleteBookingModal
          outcome="completed"
          initialPrice={a.completeTarget.price}
          saving={a.actionLoading}
          onConfirm={a.confirmComplete}
          onCancel={() => a.setCompleteTarget(null)}
        />
      )}
      {a.noShowTarget && (
        <CompleteBookingModal
          outcome="no_show"
          saving={a.actionLoading}
          onConfirm={a.confirmNoShow}
          onCancel={() => a.setNoShowTarget(null)}
        />
      )}
      {a.rejectTarget && (
        <RejectBookingModal
          saving={a.actionLoading}
          onConfirm={a.confirmReject}
          onCancel={() => a.setRejectTarget(null)}
        />
      )}
    </>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function MonthView({ monthStart, onDayClick }) {
  const monthEnd  = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const gridStart = getMonday(monthStart);
  const gridEnd   = addDays(getMonday(monthEnd), 6);
  const numDays   = Math.round((gridEnd - gridStart) / 86400000) + 1;
  const monthDays = Array.from({ length: numDays }, (_, i) => addDays(gridStart, i));
  const curMonth  = monthStart.getMonth();

  const [artists,    setArtists]    = useState([]);
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const actions = useBookingActions(() => {
    invalidatePrefix('schedule:');
    setRefreshKey(k => k + 1);
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const start = toISO(gridStart);
      const end   = toISO(gridEnd);
      const ak = 'artists:approved';
      const sk = `schedule:month:${start}`;
      const ca = getCached(ak), cs = getCached(sk);
      if (ca && cs) {
        if (!cancelled) { setArtists(ca); setEntries(cs); setLoading(false); }
        return;
      }
      if (!cancelled) { setLoading(true); setError(''); }
      try {
        const [ad, sd] = await Promise.all([
          ca ? { artists: ca } : getStudioArtists('approved'),
          cs ? { entries: cs } : getStudioScheduleRange(start, end),
        ]);
        const a = ad.artists ?? [], e = sd.entries ?? [];
        setCached(ak, a); setCached(sk, e);
        if (!cancelled) { setArtists(a); setEntries(e); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [toISO(monthStart), refreshKey]); // eslint-disable-line

  const byDate = {};
  for (const e of entries) {
    const d = e.date ?? toISO(new Date(e.chosenTime));
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  }

  const today = toISO(new Date());


  if (loading) return <p style={s.msg}>Loading…</p>;
  if (error)   return <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={s.monthWeekdays}>
        {DAY_NAMES.map(d => <div key={d} style={s.monthWeekday}>{d}</div>)}
      </div>
      <div style={s.calWrap}>
        <div style={{ ...s.monthGrid, gridTemplateRows: `repeat(${numDays / 7}, minmax(94px, 1fr))` }}>
          {monthDays.map((day, i) => {
            const iso      = toISO(day);
            const isToday  = iso === today;
            const outside  = day.getMonth() !== curMonth;
            const dayEnts  = [...(byDate[iso] ?? [])].sort((a,b) => new Date(a.chosenTime) - new Date(b.chosenTime));
            const visible  = dayEnts.slice(0, MONTH_CHIP_LIMIT);
            const more     = dayEnts.length - visible.length;

            return (
              <div
                key={i}
                style={{ ...s.monthCell, ...(isToday ? s.monthCellToday : {}), ...(outside ? s.monthCellOutside : {}), cursor: 'pointer' }}
                onClick={() => onDayClick(day)}
              >
                <div style={s.monthCellHead}>
                  <span style={{ ...s.monthDayNum, ...(isToday ? s.dayNumToday : {}) }}>{day.getDate()}</span>
                  {dayEnts.length > 0 && (
                    <span style={s.weekDayCount}>{dayEnts.length}</span>
                  )}
                </div>

                {/* Booking chips */}
                <div style={s.monthChipList}>
                  {visible.map(b => {
                    const ss = srcStyle(b.source);
                    return (
                      <div key={b.bookingId} style={{ ...s.chip, cursor: 'pointer', background: ss.bg }} onClick={e => { e.stopPropagation(); actions.openDetail(b); }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: ss.dot, flexShrink: 0 }} />
                        <span style={s.chipTime}>{fmtTime(b.chosenTime)}</span>
                        <span style={s.chipClient}>{b.clientName.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                  {more > 0 && (
                    <button style={s.moreBtn} onClick={e => { e.stopPropagation(); onDayClick(day); }}>
                      +{more} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={s.legend}>
        <div style={s.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: SOURCE_STYLE.studio.dot, flexShrink: 0 }} />
          <span style={{ ...s.legendName, color: SOURCE_STYLE.studio.tagColor }}>Studio</span>
        </div>
        <div style={s.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: SOURCE_STYLE.personal.dot, flexShrink: 0 }} />
          <span style={{ ...s.legendName, color: SOURCE_STYLE.personal.tagColor }}>Personal</span>
        </div>
      </div>
    </div>

    <BookingOverlays actions={actions} />
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ date }) {
  const [artists,        setArtists]        = useState([]);
  const [entries,        setEntries]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [showAll,        setShowAll]        = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [refreshKey,     setRefreshKey]     = useState(0);
  const actions = useBookingActions(() => {
    invalidatePrefix('schedule:');
    setRefreshKey(k => k + 1);
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const dateStr = toISO(date);
      const ak = 'artists:approved';
      const sk = `schedule:${dateStr}`;
      const ca = getCached(ak), cs = getCached(sk);
      if (ca && cs) {
        if (!cancelled) { setArtists(ca); setEntries(cs); setLoading(false); }
        return;
      }
      if (!cancelled) { setLoading(true); setError(''); }
      try {
        const [ad, sd] = await Promise.all([
          ca ? { artists: ca } : getStudioArtists('approved'),
          cs ? { entries: cs } : getStudioSchedule(dateStr),
        ]);
        const a = ad.artists ?? [], e = sd.entries ?? [];
        setCached(ak, a); setCached(sk, e);
        if (!cancelled) { setArtists(a); setEntries(e); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [date, refreshKey]);

  // Clear panel when date changes
  useEffect(() => { actions.closeDetail(); }, [date]); // eslint-disable-line

  const byArtist = {};
  for (const e of entries) {
    if (!e.artistId) continue;
    if (!byArtist[e.artistId]) byArtist[e.artistId] = [];
    byArtist[e.artistId].push(e);
  }

  const sorted = [...artists].sort((a, b) => a.name.localeCompare(b.name));
  const workingIds = new Set(Object.keys(byArtist));
  const working = sorted.filter(a => workingIds.has(a.artistId));
  const cols = showAll ? sorted : working;
  const hiddenCount = sorted.length - working.length;

  if (loading) return <p style={s.msg}>Loading…</p>;
  if (error)   return <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>;
  if (!sorted.length) return <p style={s.msg}>No approved artists yet.</p>;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Working-today toggle */}
      <div style={s.dayFilter}>
        {!showAll ? (
          <>
            <span style={s.dayFilterLabel}>
              {working.length} artist{working.length !== 1 ? 's' : ''} working today
            </span>
            {hiddenCount > 0 && (
              <button onClick={() => setShowAll(true)} style={s.dayFilterBtn}>
                Show all {sorted.length}
              </button>
            )}
          </>
        ) : (
          <>
            <span style={s.dayFilterLabel}>All artists</span>
            <button onClick={() => setShowAll(false)} style={s.dayFilterBtn}>
              Working today only
            </button>
          </>
        )}
        <button onClick={() => setShowNewBooking(true)} style={s.newBookingBtn}>+ New booking</button>
      </div>

      {cols.length === 0 ? (
        <p style={s.msg}>No artists working today.</p>
      ) : (
      <div style={s.calWrap}>
      <div style={{ ...s.grid, gridTemplateColumns: `52px repeat(${cols.length}, minmax(160px, 1fr))` }}>
        <div style={s.cornerCell} />

        {cols.map(artist => (
          <div key={artist.id} style={s.artistHeader}>
            {artist.profileImage
              ? <img src={artist.profileImage} alt={artist.name} style={s.artistAvatar} />
              : <div style={{ ...s.artistAvatar, ...s.artistAvatarFallback }}>{initials(artist.name)}</div>
            }
            <span style={s.artistName}>{artist.name}</span>
          </div>
        ))}

        <div style={{ ...s.gutterCol, height: GRID_H }}>
          {HOURS.map(h => (
            <div key={h} style={{ ...s.hourLabel, top: (h - DAY_START) * HOUR_PX }}>
              {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h-12}pm`}
            </div>
          ))}
        </div>

        {cols.map(artist => {
          const bookings = byArtist[artist.artistId] ?? [];
          return (
            <div key={artist.id} style={{ ...s.dayCol, height: GRID_H }}>
              {HOURS.map(h => <div key={h} style={{ ...s.gridLine, top: (h - DAY_START) * HOUR_PX }} />)}
              {bookings.map(b => {
                const startMin = minutesFromMidnight(b.chosenTime);
                const durMin   = b.durationMins ?? 60;
                const top      = (startMin - DAY_START * 60) * (HOUR_PX / 60);
                const height   = Math.max(durMin * (HOUR_PX / 60), 24);
                if (top < 0 || top > GRID_H) return null;
                const isSelected = actions.selectedEntry?.bookingId === b.bookingId;
                const ss = srcStyle(b.source);
                return (
                  <div
                    key={b.bookingId}
                    onClick={() => actions.openDetail(b)}
                    style={{ ...s.block, top, height, left: 4, right: 4, width: undefined, borderLeftColor: ss.border, background: ss.bg, cursor: 'pointer', ...(isSelected ? s.blockSelected : {}) }}
                  >
                    <span style={s.blockClient}>{b.clientName}</span>
                    {height >= 28 && ss.tag && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: ss.tagColor, lineHeight: 1, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss.tag}</span>
                    )}
                    {height >= 44 && b.sessionType && <span style={s.blockMeta}>{b.sessionType}</span>}
                    {height >= 56 && durMin && <span style={s.blockMeta}>{fmtDuration(durMin)}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
      )}
    </div>

    {/* Booking detail panel + outcome modals */}
    <BookingOverlays actions={actions} />
    {showNewBooking && (
      <ManualBookingModal
        artists={artists}
        defaultDate={toISO(date)}
        onClose={() => setShowNewBooking(false)}
        onCreated={() => {
          setShowNewBooking(false);
          invalidatePrefix('schedule:');
          setRefreshKey(k => k + 1);
        }}
      />
    )}
    </div>
  );
}

// ── Manual booking modal ──────────────────────────────────────────────────────

function ManualBookingModal({ artists, defaultDate, onClose, onCreated }) {
  const [artistId,  setArtistId]  = useState(artists[0]?.artistId ?? '');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [date,      setDate]      = useState(defaultDate ?? '');
  const [time,      setTime]      = useState('10:00');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!artistId || !name || !date || !time) {
      setError('Artist, client name, date, and time are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const chosenTime = new Date(`${date}T${time}:00`).toISOString();
      await createManualBooking({ artist_id: artistId, requester_name: name, requester_email: email, requester_phone: phone, chosen_time: chosenTime, notes });
      onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const inp = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: '0.82rem', padding: '0.45rem 0.65rem', width: '100%', boxSizing: 'border-box', outline: 'none' };
  const lbl = { fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 500, display: 'block', marginBottom: 4 };

  return (
    <div style={s.modalOverlay}>
      <div style={s.modal}>
        <div style={s.panelHeader}>
          <span style={s.panelTitle}>New booking</span>
          <button onClick={onClose} style={s.panelClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.1rem', overflowY: 'auto', flex: 1 }}>
          <div>
            <label style={lbl}>Artist *</label>
            <select value={artistId} onChange={e => setArtistId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {artists.map(a => <option key={a.artistId} value={a.artistId}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Client name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={lbl}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Time *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" style={inp} />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="optional" style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Design details, placement, etc." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          {error && <p style={{ ...s.stationError, textAlign: 'left' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
            <button type="button" onClick={onClose} style={{ ...s.actionBtn, flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...s.actionBtn, ...s.actionBtnPrimary, flex: 2 }}>{saving ? 'Creating…' : 'Create booking'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Station utilization view ──────────────────────────────────────────────────

const STATUS_COLORS_SU = {
  confirmed:        '#4cc98a',
  awaiting_payment: '#fb923c',
  completed:        '#6fa3e8',
};

function StationView({ date }) {
  const dateStr = toISO(date);
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    const key = `schedule:${dateStr}`;
    const cached = getCached(key);
    if (cached) { setEntries(cached); setLoading(false); }
    getStudioSchedule(dateStr)
      .then(d => { const e = d.entries ?? []; setCached(key, e); setEntries(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateStr]);

  // Separate assigned (have stationName) from unassigned
  const assigned   = entries.filter(e => e.stationName);
  const unassigned = entries.filter(e => !e.stationName);

  // Unique stations, preserving encounter order
  const stations = [...new Map(assigned.map(e => [e.stationId, e.stationName])).entries()]
    .map(([id, name]) => ({ id, name }));

  if (loading) return <p style={{ padding: '2rem', fontSize: '0.875rem', color: 'var(--text-faint)' }}>Loading…</p>;
  if (!entries.length) return <p style={{ padding: '2rem', fontSize: '0.875rem', color: 'var(--text-faint)' }}>No bookings on this day.</p>;

  const hourToY = (h) => (h - DAY_START) * HOUR_PX;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 2rem 2rem' }}>
      {stations.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', minWidth: stations.length * 160 + 48 }}>
            {/* Time axis */}
            <div style={{ width: 44, flexShrink: 0, position: 'relative', height: GRID_H + HOUR_PX }}>
              {HOURS.map(h => (
                <div key={h} style={{ position: 'absolute', top: hourToY(h), fontSize: '0.65rem', color: 'var(--text-ghost)', lineHeight: 1 }}>
                  {h % 12 || 12}{h < 12 ? 'am' : 'pm'}
                </div>
              ))}
            </div>
            {/* Station columns */}
            {stations.map(st => {
              const col = assigned.filter(e => e.stationId === st.id);
              return (
                <div key={st.id} style={{ flex: 1, minWidth: 140, position: 'relative', borderLeft: '1px solid var(--border-faint)' }}>
                  <div style={{ padding: '0 0 0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
                    {st.name}
                  </div>
                  <div style={{ position: 'relative', height: GRID_H }}>
                    {/* Hour grid lines */}
                    {HOURS.map(h => (
                      <div key={h} style={{ position: 'absolute', top: hourToY(h), left: 0, right: 0, borderTop: '1px solid var(--border-faint)', opacity: 0.5 }} />
                    ))}
                    {col.map(e => {
                      const startMin = minutesFromMidnight(e.chosenTime);
                      const topPx    = ((startMin - DAY_START * 60) / 60) * HOUR_PX;
                      const durMins  = e.durationMins ?? 60;
                      const heightPx = Math.max((durMins / 60) * HOUR_PX, 24);
                      const statusColor = STATUS_COLORS_SU[e.status] ?? 'var(--text-ghost)';
                      const ss = srcStyle(e.source);
                      return (
                        <div key={e.bookingId} style={{
                          position: 'absolute', top: topPx, left: 6, right: 6, height: heightPx,
                          background: ss.bg, border: `1px solid ${ss.border}55`,
                          borderLeft: `3px solid ${ss.border}`, borderRadius: 5,
                          padding: '0.2rem 0.4rem', overflow: 'hidden',
                        }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: ss.tagColor ?? statusColor, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {e.clientName}
                          </div>
                          {durMins >= 45 && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-ghost)', marginTop: 2 }}>
                              {fmtTime(e.chosenTime)} · {fmtDuration(durMins)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unassigned.length > 0 && (
        <div style={{ marginTop: stations.length > 0 ? '1.5rem' : 0 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
            No station assigned ({unassigned.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {unassigned.map(e => (
              <div key={e.bookingId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', borderRadius: 7 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{e.clientName}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fmtTime(e.chosenTime)}{e.durationMins ? ` · ${fmtDuration(e.durationMins)}` : ''}</span>
                {e.artistName && <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>{e.artistName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [view,       setView]       = useState('month'); // 'month' | 'day' | 'station'
  const [monthStart, setMonthStart] = useState(() => getMonthStart(new Date()));
  const [dayDate,    setDayDate]    = useState(() => new Date());

  const today          = new Date();
  const isCurrentMonth = isSameMonth(monthStart, today);

  function goToDayView(day) {
    setDayDate(day);
    setView('day');
  }

  const monthLabel = monthStart.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const dayLabel = dayDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Schedule</h1>
          {/* View toggle */}
          <div style={s.viewToggle}>
            <button
              onClick={() => setView('month')}
              style={{ ...s.toggleBtn, ...(view === 'month' ? s.toggleActive : {}) }}
            >
              Month
            </button>
            <button
              onClick={() => setView('day')}
              style={{ ...s.toggleBtn, ...(view === 'day' ? s.toggleActive : {}) }}
            >
              Day
            </button>
            <button
              onClick={() => setView('station')}
              style={{ ...s.toggleBtn, ...(view === 'station' ? s.toggleActive : {}) }}
            >
              Station
            </button>
          </div>
        </div>

        <div style={s.nav}>
          {view === 'month' ? (
            <>
              <button onClick={() => setMonthStart(d => getMonthStart(new Date(d.getFullYear(), d.getMonth() - 1, 1)))} style={s.navBtn}>←</button>
              <span style={s.navLabel}>{monthLabel}</span>
              <button onClick={() => setMonthStart(d => getMonthStart(new Date(d.getFullYear(), d.getMonth() + 1, 1)))} style={s.navBtn}>→</button>
              {!isCurrentMonth && (
                <button onClick={() => setMonthStart(getMonthStart(today))} style={s.todayBtn}>Today</button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setDayDate(d => addDays(d, -1))} style={s.navBtn}>←</button>
              <span style={s.navLabel}>{dayLabel}</span>
              <button onClick={() => setDayDate(d => addDays(d, 1))}  style={s.navBtn}>→</button>
              {toISO(dayDate) !== toISO(today) && (
                <button onClick={() => setDayDate(today)} style={s.todayBtn}>Today</button>
              )}
            </>
          )}
        </div>
      </div>

      {view === 'month'   && <MonthView monthStart={monthStart} onDayClick={goToDayView} />}
      {view === 'day'     && <DayView  date={dayDate} />}
      {view === 'station' && <StationView date={dayDate} />}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    padding: '1.5rem 2rem 1rem',
    borderBottom: '1px solid var(--border-faint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '1rem' },
  title: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', margin: 0 },
  viewToggle: {
    display: 'flex',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-faint)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    padding: '0.3rem 0.75rem',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  toggleActive: {
    background: 'var(--bg-chip)',
    color: 'var(--text)',
  },
  nav: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navBtn: {
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    color: 'var(--text-dim)',
    fontSize: '0.9rem',
    padding: '0.35rem 0.65rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  navLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text)',
    minWidth: 200,
    textAlign: 'center',
  },
  todayBtn: {
    background: 'var(--accent-tint)',
    border: '1px solid var(--accent-tint-border)',
    borderRadius: 7,
    color: 'var(--accent)',
    fontSize: '0.78rem',
    fontWeight: 600,
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    marginLeft: '0.25rem',
  },
  msg: { padding: '2rem', fontSize: '0.875rem', color: 'var(--text-faint)' },

  // Day filter bar
  dayFilter: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.6rem 2rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  dayFilterLabel: { fontSize: '0.78rem', color: 'var(--text-faint)' },
  dayFilterBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text-muted)',
    fontSize: '0.75rem', fontWeight: 500, padding: '0.2rem 0.65rem', cursor: 'pointer',
  },

  calWrap: { flex: 1, overflow: 'auto' },

  // ── Month view ─────────────────────────────────────────────────────────────
  monthWeekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    minWidth: 700,
    borderBottom: '1px solid var(--border-faint)',
  },
  monthWeekday: {
    padding: '0.5rem 0.6rem',
    fontSize: '0.68rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--text-ghost)',
    borderRight: '1px solid var(--border-faint)',
  },
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    minWidth: 700,
  },
  monthCell: {
    borderRight: '1px solid var(--border-faint)',
    borderBottom: '1px solid var(--border-faint)',
    display: 'flex', flexDirection: 'column',
    padding: '0.35rem 0.4rem 0.45rem',
    overflow: 'hidden',
  },
  monthCellToday: { background: 'var(--bg-row-active)' },
  monthCellOutside: { opacity: 0.4 },
  monthCellHead: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    marginBottom: '0.3rem',
  },
  monthDayNum: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1 },
  monthChipList: {
    display: 'flex', flexDirection: 'column', gap: '0.18rem',
    overflow: 'hidden',
  },

  // ── Calendar chips ─────────────────────────────────────────────────────────
  weekDayCount: {
    marginLeft: 'auto',
    fontSize: '0.68rem', fontWeight: 600,
    color: 'var(--text-ghost)',
    background: 'var(--bg-chip)',
    borderRadius: 20, padding: '0.05rem 0.4rem',
  },
  chip: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.2rem 0.35rem', borderRadius: 4,
    background: 'var(--bg-card)', overflow: 'hidden',
  },
  chipTime: {
    fontSize: '0.68rem', fontWeight: 600,
    color: 'var(--text-muted)', flexShrink: 0,
  },
  chipClient: {
    fontSize: '0.72rem', fontWeight: 500,
    color: 'var(--text-dim)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  moreBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 500,
    cursor: 'pointer', padding: '0.1rem 0.35rem', textAlign: 'left',
  },
  legend: {
    display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem',
    padding: '0.75rem 1.5rem',
    borderTop: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  legendName: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 },

  // ── Shared label styles ────────────────────────────────────────────────────
  dayNumToday: { color: 'var(--accent)' },

  // ── Day view grid ──────────────────────────────────────────────────────────
  grid: { display: 'grid', minWidth: 'max-content' },
  cornerCell: { height: 52, borderBottom: '1px solid var(--border-faint)' },

  // Day view artist headers
  artistHeader: {
    height: 52,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0 0.75rem',
    borderBottom: '1px solid var(--border-faint)',
    borderLeft: '1px solid var(--border-faint)',
  },
  artistAvatar: {
    width: 26, height: 26, borderRadius: '50%',
    objectFit: 'cover', flexShrink: 0,
    border: '1.5px solid transparent',
  },
  artistAvatarFallback: {
    background: 'var(--bg-chip)',
    color: 'var(--text-muted)',
    fontSize: '0.65rem', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  artistName: {
    fontSize: '0.78rem', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  gutterCol: { position: 'relative', borderRight: '1px solid var(--border-faint)' },
  hourLabel: {
    position: 'absolute', right: 8,
    fontSize: '0.63rem', color: 'var(--text-ghost)',
    transform: 'translateY(-50%)', whiteSpace: 'nowrap', userSelect: 'none',
  },

  dayCol: {
    position: 'relative',
    borderLeft: '1px solid var(--border-faint)',
    background: 'var(--bg-card)',
  },
  gridLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    background: 'var(--border-faint)', pointerEvents: 'none',
  },

  block: {
    position: 'absolute',
    borderRadius: 5,
    borderLeft: '3px solid',
    background: 'var(--bg-chip)',
    padding: '3px 6px',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 1,
    boxSizing: 'border-box',
  },
  blockSelected: {
    background: 'var(--bg-row-active)',
    boxShadow: '0 0 0 1.5px var(--border-strong)',
  },
  blockClient: {
    fontSize: '0.72rem', fontWeight: 700,
    color: 'var(--text-dim)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.2,
  },
  blockSub: {
    fontSize: '0.65rem', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.2,
  },
  blockMeta: {
    fontSize: '0.62rem', color: 'var(--text-secondary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.2,
  },

  // ── ManualBookingModal shared styles ──────────────────────────────────────
  panelHeader: {
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    padding: '1.1rem 1.1rem 0.9rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  panelClose: {
    background: 'none', border: 'none', color: 'var(--text-faint)',
    fontSize: '0.85rem', cursor: 'pointer', padding: '0.1rem 0.3rem',
    flexShrink: 0, lineHeight: 1,
  },
  actionBtn: {
    padding: '0.55rem 0', borderRadius: 8, border: 'none',
    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
    width: '100%',
  },
  actionBtnPrimary: {
    background: 'var(--accent-tint)',
    color: 'var(--accent)',
    border: '1px solid var(--accent-tint-border)',
  },
  stationError: {
    fontSize: '0.75rem',
    color: '#e86f6f',
    margin: 0,
    width: '100%',
  },

  // ── Walk-in panel ──────────────────────────────────────────────────────────
  wip: {
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
    background: 'rgba(245,158,58,0.04)',
  },
  wipHeader: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    width: '100%', padding: '0.6rem 2rem',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  wipTitle: {
    fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  wipCount: {
    fontSize: '0.68rem', fontWeight: 700,
    background: 'rgba(245,158,58,0.2)',
    color: '#f59e3a',
    borderRadius: 20, padding: '0.05rem 0.5rem',
  },
  wipList: {
    display: 'flex', flexDirection: 'column', gap: 0,
    maxHeight: 280, overflowY: 'auto',
    padding: '0 0 0.5rem',
  },
  wipCard: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
    padding: '0.6rem 2rem',
    borderTop: '1px solid var(--border-faint)',
  },
  wipCardMain: {
    display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0,
  },
  wipName: {
    fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dim)',
  },
  wipTag: {
    fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-faint)',
    textTransform: 'capitalize',
  },
  wipContact: {
    fontSize: '0.72rem', color: 'var(--text-secondary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  wipNotes: {
    fontSize: '0.7rem', color: 'var(--text-ghost)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: 400,
  },
  wipAssignBtn: {
    background: 'var(--accent-tint)',
    border: '1px solid var(--accent-tint-border)',
    borderRadius: 6, color: 'var(--accent)',
    fontSize: '0.72rem', fontWeight: 600,
    padding: '0.3rem 0.75rem', cursor: 'pointer', flexShrink: 0,
  },
  wipPicker: {
    display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', flexShrink: 0,
  },
  wipPickerBtn: {
    background: 'rgba(76,201,138,0.1)',
    border: '1px solid rgba(76,201,138,0.25)',
    borderRadius: 6, color: '#4cc98a',
    fontSize: '0.72rem', fontWeight: 600,
    padding: '0.25rem 0.65rem', cursor: 'pointer',
  },
  wipCancelBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-ghost)', fontSize: '0.7rem',
    cursor: 'pointer', padding: '0.25rem 0',
  },

  newBookingBtn: {
    marginLeft: 'auto',
    background: 'var(--accent-tint)',
    border: '1px solid var(--accent-tint-border)',
    borderRadius: 7,
    color: 'var(--accent)',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.3rem 0.75rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  modalOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-modal)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    width: 380,
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  },
};
