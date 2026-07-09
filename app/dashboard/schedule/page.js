'use client';

import { useState, useEffect } from 'react';
import { getStudioArtists, getStudioSchedule, getStudioScheduleRange, getBooking, acceptBookingWithStation, assignArtist, createManualBooking, getWalkIns, getAvailableStations, rejectBooking, recordOutcome } from '@/lib/api';
import { getCached, setCached, invalidate } from '@/lib/cache';

const HOUR_PX   = 64;
const DAY_START = 8;
const DAY_END   = 20;
const HOURS     = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
const GRID_H    = (DAY_END - DAY_START) * HOUR_PX;

const PALETTE = [
  '#6fa3e8', '#4cc98a', '#f59e3a', '#a78bfa',
  '#f472b6', '#34d399', '#fb923c', '#e86f6f',
];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── helpers ──────────────────────────────────────────────────────────────────

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMonday(d) {
  const r = new Date(d);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function minutesFromMidnight(iso) { const d = new Date(iso); return d.getHours()*60 + d.getMinutes(); }
function isSameWeek(a, b) { return toISO(getMonday(a)) === toISO(getMonday(b)); }

// Greedy column layout for overlapping blocks within one column
function layoutBlocks(entries) {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a,b) => new Date(a.chosenTime) - new Date(b.chosenTime));
  const colEnds = [];
  const assignments = sorted.map(entry => {
    const start = minutesFromMidnight(entry.chosenTime);
    const end   = start + (entry.durationMins ?? 60);
    let col = colEnds.findIndex(e => e <= start);
    if (col === -1) { col = colEnds.length; colEnds.push(end); } else colEnds[col] = end;
    return { entry, col };
  });
  const numCols = colEnds.length;
  return assignments.map(({ entry, col }) => ({ entry, leftFrac: col/numCols, widthFrac: 1/numCols }));
}

const WEEK_CHIP_LIMIT = 5;

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

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({ weekStart, onDayClick }) {
  const weekEnd  = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [artists,       setArtists]       = useState([]);
  const [entries,       setEntries]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const start = toISO(weekStart);
      const end   = toISO(weekEnd);
      const ak = 'artists:approved';
      const sk = `schedule:week:${start}`;
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
  }, [weekStart]); // eslint-disable-line

  function openDetail(entry) {
    setSelectedEntry(entry);
    setDetailBooking(null);
    setDetailLoading(true);
    getBooking(entry.bookingId)
      .then(data => setDetailBooking(data))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }

  async function handleAction(action, stationId) {
    if (!selectedEntry) return;
    setActionLoading(true);
    try {
      if (action === 'complete') await recordOutcome(selectedEntry.bookingId, 'completed');
      else if (action === 'accept') await acceptBookingWithStation(selectedEntry.bookingId, stationId);
      else if (action === 'assign') await assignArtist(selectedEntry.bookingId, stationId);
      else if (action === 'reject') {
        const reason = prompt('Reason for rejection (optional):') ?? '';
        await rejectBooking(selectedEntry.bookingId, reason);
      }
      setSelectedEntry(null);
      setDetailBooking(null);
      invalidate(`schedule:week:${toISO(weekStart)}`);
    } catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  const artistColor = {};
  artists.forEach((a, i) => { artistColor[a.artistId] = PALETTE[i % PALETTE.length]; });

  const byDate = {};
  for (const e of entries) {
    const d = e.date ?? toISO(new Date(e.chosenTime));
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  }

  const today = toISO(new Date());

  // Artist legend — shown below the grid
  const workingArtists = artists.filter(a =>
    Object.values(byDate).some(day => day.some(e => e.artistId === a.artistId))
  );

  if (loading) return <p style={s.msg}>Loading…</p>;
  if (error)   return <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={s.calWrap}>
        <div style={s.weekGrid}>
          {weekDays.map((day, i) => {
            const iso      = toISO(day);
            const isToday  = iso === today;
            const dayEnts  = [...(byDate[iso] ?? [])].sort((a,b) => new Date(a.chosenTime) - new Date(b.chosenTime));
            const visible  = dayEnts.slice(0, WEEK_CHIP_LIMIT);
            const more     = dayEnts.length - visible.length;

            return (
              <div key={i} style={{ ...s.weekDayCol, ...(isToday ? s.weekDayColToday : {}), cursor: 'pointer' }} onClick={() => onDayClick(day)}>
                {/* Day header — click to open day view */}
                <div style={s.weekDayHeader} onClick={e => { e.stopPropagation(); onDayClick(day); }}>
                  <span style={s.dayName}>{DAY_NAMES[i]}</span>
                  <span style={{ ...s.dayNum, ...(isToday ? s.dayNumToday : {}) }}>{day.getDate()}</span>
                  {dayEnts.length > 0 && (
                    <span style={s.weekDayCount}>{dayEnts.length}</span>
                  )}
                </div>

                {/* Booking chips */}
                <div style={s.chipList}>
                  {visible.map(b => {
                    const color = artistColor[b.artistId] ?? '#8b9dc3';
                    return (
                      <div key={b.bookingId} style={{ ...s.chip, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); openDetail(b); }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
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
                  {dayEnts.length === 0 && (
                    <span style={s.emptyDay}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Artist colour legend */}
      {workingArtists.length > 0 && (
        <div style={s.legend}>
          {workingArtists.map((a, i) => (
            <div key={a.artistId} style={s.legendItem}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: artistColor[a.artistId], flexShrink: 0 }} />
              <span style={s.legendName}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    {selectedEntry && (
      <BookingDetailPanel
        entry={selectedEntry}
        booking={detailBooking}
        loading={detailLoading}
        actionLoading={actionLoading}
        onClose={() => { setSelectedEntry(null); setDetailBooking(null); }}
        onAction={handleAction}
      />
    )}
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ date }) {
  const [artists,       setArtists]       = useState([]);
  const [entries,       setEntries]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [showAll,       setShowAll]       = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);

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
  }, [date]);

  // Clear panel when date changes
  useEffect(() => { setSelectedEntry(null); setDetailBooking(null); }, [date]);


  function openDetail(entry) {
    setSelectedEntry(entry);
    setDetailBooking(null);
    setDetailLoading(true);
    getBooking(entry.bookingId)
      .then(data => setDetailBooking(data))
      .catch(() => {}) // fall back to schedule entry data
      .finally(() => setDetailLoading(false));
  }

  async function handleAction(action, stationId) {
    if (!selectedEntry) return;
    setActionLoading(true);
    try {
      if (action === 'complete') await recordOutcome(selectedEntry.bookingId, 'completed');
      else if (action === 'accept') await acceptBookingWithStation(selectedEntry.bookingId, stationId);
      else if (action === 'assign') await assignArtist(selectedEntry.bookingId, stationId);
      else if (action === 'reject') {
        const reason = prompt('Reason for rejection (optional):') ?? '';
        await rejectBooking(selectedEntry.bookingId, reason);
      }
      setSelectedEntry(null);
      setDetailBooking(null);
      invalidate(`schedule:${toISO(date)}`);
    } catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  const artistColor = {};
  artists.forEach((a, i) => { artistColor[a.artistId] = PALETTE[i % PALETTE.length]; });

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

        {cols.map(artist => {
          const color    = artistColor[artist.artistId] ?? '#8b9dc3';
          const initials = artist.name ? artist.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';
          return (
            <div key={artist.id} style={s.artistHeader}>
              {artist.profileImage
                ? <img src={artist.profileImage} alt={artist.name} style={s.artistAvatar} />
                : <div style={{ ...s.artistAvatar, ...s.artistAvatarFallback, borderColor: color }}>{initials}</div>
              }
              <span style={{ ...s.artistName, color }}>{artist.name}</span>
            </div>
          );
        })}

        <div style={{ ...s.gutterCol, height: GRID_H }}>
          {HOURS.map(h => (
            <div key={h} style={{ ...s.hourLabel, top: (h - DAY_START) * HOUR_PX }}>
              {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h-12}pm`}
            </div>
          ))}
        </div>

        {cols.map(artist => {
          const color    = artistColor[artist.artistId] ?? '#8b9dc3';
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
                const isSelected = selectedEntry?.bookingId === b.bookingId;
                return (
                  <div
                    key={b.bookingId}
                    onClick={() => openDetail(b)}
                    style={{ ...s.block, top, height, left: 4, right: 4, width: undefined, borderLeftColor: color, cursor: 'pointer', ...(isSelected ? s.blockSelected : {}) }}
                  >
                    <span style={s.blockClient}>{b.clientName}</span>
                    {height >= 36 && b.sessionType && <span style={s.blockMeta}>{b.sessionType}</span>}
                    {height >= 52 && durMin && <span style={s.blockMeta}>{fmtDuration(durMin)}</span>}
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

    {/* Booking detail panel */}
    {selectedEntry && (
      <BookingDetailPanel
        entry={selectedEntry}
        booking={detailBooking}
        loading={detailLoading}
        actionLoading={actionLoading}
        onClose={() => { setSelectedEntry(null); setDetailBooking(null); }}
        onAction={handleAction}
      />
    )}
    {showNewBooking && (
      <ManualBookingModal
        artists={artists}
        defaultDate={toISO(date)}
        onClose={() => setShowNewBooking(false)}
        onCreated={() => {
          setShowNewBooking(false);
          invalidate(`schedule:${toISO(date)}`);
          setLoading(true);
        }}
      />
    )}
    </div>
  );
}

// ── Booking detail panel ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    confirmed:         { label: 'Confirmed',         bg: 'rgba(76,201,138,0.15)',  color: '#4cc98a' },
    accepted:          { label: 'Accepted',           bg: 'rgba(76,201,138,0.15)',  color: '#4cc98a' },
    completed:         { label: 'Completed',          bg: 'rgba(111,163,232,0.15)', color: '#6fa3e8' },
    awaiting_deposit:  { label: 'Awaiting Deposit',   bg: 'rgba(245,158,58,0.15)',  color: '#f59e3a' },
    pending:           { label: 'Pending',            bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' },
    rejected:          { label: 'Rejected',           bg: 'rgba(232,111,111,0.15)', color: '#e86f6f' },
  };
  const { label, bg, color } = map[status] ?? { label: status, bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' };
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 600, borderRadius: 20, padding: '0.2rem 0.6rem', background: bg, color }}>
      {label}
    </span>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      <span style={s.detailValue}>{value}</span>
    </div>
  );
}

function BookingDetailPanel({ entry, booking, loading, actionLoading, onClose, onAction }) {
  const [stationStep, setStationStep] = useState(false);
  const [availableStations, setAvailableStations] = useState([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationError, setStationError] = useState('');

  async function handleAcceptClick() {
    setStationsLoading(true);
    setStationError('');
    try {
      const dateStr = (entry.chosenTime ?? booking?.chosen_time ?? '').split('T')[0];
      const data = await getAvailableStations(dateStr, entry.bookingId);
      const stations = data.stations ?? [];
      if (stations.length === 0) {
        setStationError('No stations available on this date. Free up a station in Settings.');
        return;
      }
      setAvailableStations(stations);
      setStationStep(true);
    } catch {
      setStationError('Failed to load stations.');
    } finally {
      setStationsLoading(false);
    }
  }

  function handleStationPick(stationId) {
    setStationStep(false);
    onAction('accept', stationId);
  }

  const b = booking ?? entry;
  const clientName    = b.clientName    ?? b.requester_name  ?? '—';
  const sessionType   = b.sessionType   ?? b.session_type    ?? '—';
  const status        = b.status        ?? entry.status      ?? '—';
  const time          = entry.chosenTime ?? b.chosenTime ?? b.chosen_time;
  const durMins       = entry.durationMins ?? b.durationMins ?? b.proposed_duration_minutes;
  const quote         = b.estimatedQuote ?? b.estimated_quote;
  const email         = b.requesterEmail ?? b.email;
  const phone         = b.phone;
  const placement     = b.placement;
  const designDetails = b.designDetails ?? b.design_details;
  const notes         = b.notes;
  const depositPaid   = b.depositPaid   ?? b.deposit_paid;

  const timeStr = time ? `${fmtTime(time)}${durMins ? ` · ${fmtDuration(durMins)}` : ''}` : null;

  const canAccept   = ['pending', 'awaiting_deposit'].includes(status);
  const canComplete = ['confirmed', 'accepted'].includes(status);
  const canReject   = !['completed', 'rejected'].includes(status);

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.panelHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
          <span style={s.panelTitle}>{clientName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusBadge status={status} />
            {depositPaid && (
              <span style={{ fontSize: '0.68rem', color: '#4cc98a', fontWeight: 500 }}>Deposit paid</span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={s.panelClose}>✕</button>
      </div>

      {/* Body */}
      <div style={s.panelBody}>
        {loading && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>Loading…</p>}

        <div style={s.detailSection}>
          <DetailRow label="Artist"       value={entry.artistName} />
          <DetailRow label="Time"         value={timeStr} />
          <DetailRow label="Session type" value={sessionType} />
          <DetailRow label="Placement"    value={placement} />
        </div>

        {(designDetails || notes) && (
          <div style={s.detailSection}>
            {designDetails && (
              <div style={s.detailBlock}>
                <span style={s.detailLabel}>Design details</span>
                <span style={{ ...s.detailValue, whiteSpace: 'pre-wrap', marginTop: 2 }}>{designDetails}</span>
              </div>
            )}
            {notes && (
              <div style={s.detailBlock}>
                <span style={s.detailLabel}>Notes</span>
                <span style={{ ...s.detailValue, whiteSpace: 'pre-wrap', marginTop: 2 }}>{notes}</span>
              </div>
            )}
          </div>
        )}

        <div style={s.detailSection}>
          {quote != null && (
            <DetailRow label="Quote" value={`$${Number(quote).toLocaleString()}`} />
          )}
          <DetailRow label="Email" value={email} />
          <DetailRow label="Phone" value={phone} />
        </div>

        {/* Station picker */}
        {stationStep && (
          <div style={s.stationPicker}>
            <p style={s.stationPickerLabel}>Assign a station</p>
            <div style={s.stationBtns}>
              {availableStations.map(st => (
                <button
                  key={st.id}
                  onClick={() => handleStationPick(st.id)}
                  disabled={actionLoading}
                  style={s.stationPickerBtn}
                >
                  {st.name}
                </button>
              ))}
            </div>
            <button onClick={() => setStationStep(false)} style={s.stationCancelBtn}>Cancel</button>
          </div>
        )}

        {/* Actions */}
        {!stationStep && (canAccept || canComplete || canReject) && (
          <div style={s.panelActions}>
            {canAccept && (
              <button
                onClick={handleAcceptClick}
                disabled={actionLoading || stationsLoading}
                style={{ ...s.actionBtn, ...s.actionBtnPrimary }}
              >
                {stationsLoading ? 'Loading…' : 'Accept'}
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => onAction('complete')}
                disabled={actionLoading}
                style={{ ...s.actionBtn, ...s.actionBtnPrimary }}
              >
                Mark complete
              </button>
            )}
            {canReject && (
              <button
                onClick={() => onAction('reject')}
                disabled={actionLoading}
                style={{ ...s.actionBtn, ...s.actionBtnDanger }}
              >
                Reject
              </button>
            )}
            {stationError && <p style={s.stationError}>{stationError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending walk-in panel ─────────────────────────────────────────────────────

function PendingWalkIns({ onAssigned }) {
  const [items,     setItems]     = useState([]);
  const [artists,   setArtists]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [pick,      setPick]      = useState(null); // { bookingId, artistId, date, time }
  const [error,     setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    const cached = getCached('artists:approved');
    Promise.all([
      getWalkIns(),
      cached ? Promise.resolve({ artists: cached }) : getStudioArtists('approved'),
    ]).then(([walkins, artistData]) => {
      if (cancelled) return;
      const a = artistData.artists ?? [];
      setCached('artists:approved', a);
      setArtists(a);
      setItems(walkins.walkins ?? []);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleAssign() {
    if (!pick?.artistId || !pick?.date || !pick?.time) return;
    setAssigning(pick.bookingId);
    setError('');
    try {
      const chosenTime = new Date(`${pick.date}T${pick.time}:00`).toISOString();
      await assignArtist(pick.bookingId, pick.artistId, chosenTime);
      setItems(prev => prev.filter(w => w.id !== pick.bookingId));
      setPick(null);
      if (onAssigned) onAssigned();
    } catch (e) {
      setError(e.message);
    } finally {
      setAssigning(null);
    }
  }

  if (loading || items.length === 0) return null;

  const wipInp = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: '#fff',
    fontSize: '0.75rem', padding: '0.3rem 0.5rem',
    outline: 'none',
  };

  return (
    <div style={s.wip}>
      <button style={s.wipHeader} onClick={() => setOpen(o => !o)}>
        <span style={s.wipTitle}>Walk-in requests</span>
        <span style={s.wipCount}>{items.length}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={s.wipList}>
          {items.map(w => {
            const isPickingThis = pick?.bookingId === w.id;
            return (
              <div key={w.id} style={{ ...s.wipCard, ...(isPickingThis ? { flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' } : {}) }}>
                <div style={s.wipCardMain}>
                  <span style={s.wipName}>{w.requester_name}</span>
                  {w.session_type && <span style={s.wipTag}>{w.session_type.replace('_', ' ')}</span>}
                  {(w.requester_email || w.requester_phone) && (
                    <span style={s.wipContact}>{w.requester_email || w.requester_phone}</span>
                  )}
                  {w.additional_notes && (
                    <span style={s.wipNotes}>{w.additional_notes}</span>
                  )}
                </div>

                {isPickingThis ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Artist selection */}
                    <div style={s.wipPicker}>
                      {artists.map(a => (
                        <button
                          key={a.artistId}
                          onClick={() => setPick(prev => ({ ...prev, artistId: a.artistId }))}
                          style={{ ...s.wipPickerBtn, ...(pick.artistId === a.artistId ? { background: 'rgba(76,201,138,0.25)', border: '1px solid rgba(76,201,138,0.5)' } : {}) }}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                    {/* Date + time */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="date"
                        value={pick.date}
                        onChange={e => setPick(prev => ({ ...prev, date: e.target.value }))}
                        style={{ ...wipInp, flex: 1 }}
                      />
                      <input
                        type="time"
                        value={pick.time}
                        onChange={e => setPick(prev => ({ ...prev, time: e.target.value }))}
                        style={{ ...wipInp, width: 90 }}
                      />
                    </div>
                    {/* Confirm / Cancel */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={handleAssign}
                        disabled={!pick.artistId || !pick.date || !pick.time || assigning === w.id}
                        style={{ ...s.wipPickerBtn, opacity: (!pick.artistId || !pick.date || !pick.time) ? 0.4 : 1 }}
                      >
                        {assigning === w.id ? 'Assigning…' : 'Confirm'}
                      </button>
                      <button onClick={() => setPick(null)} style={s.wipCancelBtn}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={!!assigning}
                    onClick={() => setPick({ bookingId: w.id, artistId: '', date: '', time: '10:00' })}
                    style={s.wipAssignBtn}
                  >
                    Assign artist
                  </button>
                )}
              </div>
            );
          })}
          {error && <p style={{ ...s.stationError, padding: '0 0.5rem 0.5rem' }}>{error}</p>}
        </div>
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

  const inp = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', fontSize: '0.82rem', padding: '0.45rem 0.65rem', width: '100%', boxSizing: 'border-box', outline: 'none' };
  const lbl = { fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, display: 'block', marginBottom: 4 };

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
            <button type="button" onClick={onClose} style={{ ...s.actionBtn, flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...s.actionBtn, ...s.actionBtnPrimary, flex: 2 }}>{saving ? 'Creating…' : 'Create booking'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [view,      setView]      = useState('week'); // 'week' | 'day'
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [dayDate,   setDayDate]   = useState(() => new Date());
  const [wipKey,    setWipKey]    = useState(0);

  const today        = new Date();
  const isCurrentWk  = isSameWeek(weekStart, today);
  const weekEnd      = addDays(weekStart, 6);

  function goToDayView(day) {
    setDayDate(day);
    setView('day');
  }

  const weekLabel = (() => {
    const o = { day: 'numeric', month: 'short' };
    return `${weekStart.toLocaleDateString('en-AU', o)} – ${weekEnd.toLocaleDateString('en-AU', o)}`;
  })();

  const dayLabel = dayDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Schedule</h1>
          {/* View toggle */}
          <div style={s.viewToggle}>
            <button
              onClick={() => setView('week')}
              style={{ ...s.toggleBtn, ...(view === 'week' ? s.toggleActive : {}) }}
            >
              Week
            </button>
            <button
              onClick={() => setView('day')}
              style={{ ...s.toggleBtn, ...(view === 'day' ? s.toggleActive : {}) }}
            >
              Day
            </button>
          </div>
        </div>

        <div style={s.nav}>
          {view === 'week' ? (
            <>
              <button onClick={() => setWeekStart(d => addDays(d, -7))} style={s.navBtn}>←</button>
              <span style={s.navLabel}>{weekLabel}</span>
              <button onClick={() => setWeekStart(d => addDays(d, 7))}  style={s.navBtn}>→</button>
              {!isCurrentWk && (
                <button onClick={() => setWeekStart(getMonday(today))} style={s.todayBtn}>Today</button>
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

      <PendingWalkIns key={wipKey} onAssigned={() => setWipKey(k => k + 1)} />

      {view === 'week'
        ? <WeekView weekStart={weekStart} onDayClick={goToDayView} />
        : <DayView  date={dayDate} />
      }
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    padding: '1.5rem 2rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '1rem' },
  title: { fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em', margin: 0 },
  viewToggle: {
    display: 'flex',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    padding: '0.3rem 0.75rem',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  toggleActive: {
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
  },
  nav: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9rem',
    padding: '0.35rem 0.65rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  navLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#ffffff',
    minWidth: 200,
    textAlign: 'center',
  },
  todayBtn: {
    background: 'rgba(245,236,217,0.08)',
    border: '1px solid rgba(245,236,217,0.2)',
    borderRadius: 7,
    color: '#f5ecd9',
    fontSize: '0.78rem',
    fontWeight: 600,
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    marginLeft: '0.25rem',
  },
  msg: { padding: '2rem', fontSize: '0.875rem', color: 'rgba(255,255,255,0.35)' },

  // Day filter bar
  dayFilter: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.6rem 2rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  dayFilterLabel: { fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' },
  dayFilterBtn: {
    background: 'none', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: 'rgba(255,255,255,0.5)',
    fontSize: '0.75rem', fontWeight: 500, padding: '0.2rem 0.65rem', cursor: 'pointer',
  },

  calWrap: { flex: 1, overflow: 'auto' },

  // ── Week view ──────────────────────────────────────────────────────────────
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
    minWidth: 700,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  weekDayCol: {
    borderRight: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', flexDirection: 'column',
    minHeight: 220,
  },
  weekDayColToday: { background: 'rgba(255,255,255,0.015)' },
  weekDayHeader: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.65rem 0.75rem 0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
  },
  weekDayCount: {
    marginLeft: 'auto',
    fontSize: '0.68rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: '0.05rem 0.4rem',
  },
  chipList: {
    display: 'flex', flexDirection: 'column', gap: '0.2rem',
    padding: '0.5rem 0.6rem', flex: 1,
  },
  chip: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.2rem 0.35rem', borderRadius: 4,
    background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
  },
  chipTime: {
    fontSize: '0.68rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.4)', flexShrink: 0,
  },
  chipClient: {
    fontSize: '0.72rem', fontWeight: 500,
    color: 'rgba(255,255,255,0.75)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  moreBtn: {
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem', fontWeight: 500,
    cursor: 'pointer', padding: '0.1rem 0.35rem', textAlign: 'left',
  },
  emptyDay: {
    fontSize: '0.72rem', color: 'rgba(255,255,255,0.12)', paddingLeft: '0.35rem',
  },
  legend: {
    display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem',
    padding: '0.75rem 1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  legendName: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 },

  // ── Shared label styles ────────────────────────────────────────────────────
  dayName: {
    fontSize: '0.65rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  dayNum: { fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', lineHeight: 1 },
  dayNumToday: { color: '#f5ecd9' },

  // ── Day view grid ──────────────────────────────────────────────────────────
  grid: { display: 'grid', minWidth: 'max-content' },
  cornerCell: { height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)' },

  // Day view artist headers
  artistHeader: {
    height: 52,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
  },
  artistAvatar: {
    width: 26, height: 26, borderRadius: '50%',
    objectFit: 'cover', flexShrink: 0,
    border: '1.5px solid transparent',
  },
  artistAvatarFallback: {
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.65rem', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  artistName: {
    fontSize: '0.78rem', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  gutterCol: { position: 'relative', borderRight: '1px solid rgba(255,255,255,0.06)' },
  hourLabel: {
    position: 'absolute', right: 8,
    fontSize: '0.63rem', color: 'rgba(255,255,255,0.22)',
    transform: 'translateY(-50%)', whiteSpace: 'nowrap', userSelect: 'none',
  },

  dayCol: {
    position: 'relative',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(255,255,255,0.005)',
  },
  gridLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
  },

  block: {
    position: 'absolute',
    borderRadius: 5,
    borderLeft: '3px solid',
    background: 'rgba(255,255,255,0.065)',
    padding: '3px 6px',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 1,
    boxSizing: 'border-box',
  },
  blockSelected: {
    background: 'rgba(255,255,255,0.12)',
    boxShadow: '0 0 0 1.5px rgba(255,255,255,0.18)',
  },
  blockClient: {
    fontSize: '0.72rem', fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.2,
  },
  blockSub: {
    fontSize: '0.65rem', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.2,
  },
  blockMeta: {
    fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.2,
  },

  // ── Detail panel ──────────────────────────────────────────────────────────
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 300,
    background: '#1a1a1a',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column',
    zIndex: 10,
    boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
  },
  panelHeader: {
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    padding: '1.1rem 1.1rem 0.9rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: '0.95rem', fontWeight: 700, color: '#ffffff',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  panelClose: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
    fontSize: '0.85rem', cursor: 'pointer', padding: '0.1rem 0.3rem',
    flexShrink: 0, lineHeight: 1,
  },
  panelBody: {
    flex: 1, overflowY: 'auto',
    padding: '0.75rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  detailSection: {
    display: 'flex', flexDirection: 'column', gap: '0.45rem',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' },
  detailBlock: { display: 'flex', flexDirection: 'column' },
  detailLabel: { fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500, flexShrink: 0 },
  detailValue: { fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500, textAlign: 'right' },
  panelActions: {
    display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.25rem',
  },
  actionBtn: {
    padding: '0.55rem 0', borderRadius: 8, border: 'none',
    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
    width: '100%',
  },
  actionBtnPrimary: {
    background: 'rgba(245,236,217,0.1)',
    color: '#f5ecd9',
    border: '1px solid rgba(245,236,217,0.2)',
  },
  actionBtnDanger: {
    background: 'rgba(232,111,111,0.1)',
    color: '#e86f6f',
    border: '1px solid rgba(232,111,111,0.2)',
  },
  stationPicker: {
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  stationPickerLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
  },
  stationBtns: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  stationPickerBtn: {
    background: 'rgba(245,236,217,0.08)',
    border: '1px solid rgba(245,236,217,0.2)',
    borderRadius: 6,
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#f5ecd9',
    cursor: 'pointer',
  },
  stationCancelBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: 'none',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    padding: 0,
  },
  stationError: {
    fontSize: '0.75rem',
    color: '#e86f6f',
    margin: 0,
    width: '100%',
  },

  // ── Walk-in panel ──────────────────────────────────────────────────────────
  wip: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
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
    color: 'rgba(255,255,255,0.5)',
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
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  wipCardMain: {
    display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0,
  },
  wipName: {
    fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
  },
  wipTag: {
    fontSize: '0.68rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)',
    textTransform: 'capitalize',
  },
  wipContact: {
    fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  wipNotes: {
    fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: 400,
  },
  wipAssignBtn: {
    background: 'rgba(245,236,217,0.07)',
    border: '1px solid rgba(245,236,217,0.15)',
    borderRadius: 6, color: '#f5ecd9',
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
    color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem',
    cursor: 'pointer', padding: '0.25rem 0',
  },

  newBookingBtn: {
    marginLeft: 'auto',
    background: 'rgba(245,236,217,0.08)',
    border: '1px solid rgba(245,236,217,0.2)',
    borderRadius: 7,
    color: '#f5ecd9',
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
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
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
