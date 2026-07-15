'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { listStudioBookings, acceptBookingWithStation, rejectBooking, cancelBooking, recordOutcome, createFollowUpBooking } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { statusColors, statusLabel, capitalise } from '@/lib/status';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import RejectBookingModal from '@/components/RejectBookingModal';
import BookingDetailPanel from '@/components/BookingDetailPanel';

const STATUS_FILTERS = [
  { value: 'pending',          label: 'Pending' },
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'confirmed',        label: 'Confirmed' },
  { value: 'completed',        label: 'Completed' },
  { value: 'cancelled',        label: 'Cancelled' },
];

const DEFAULT_FILTER = 'pending';

export default function AppointmentsPage() {
  const [activeFilter, setActiveFilter] = useState(DEFAULT_FILTER);
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [noShowTarget, setNoShowTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const combinedStatus = activeFilter;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function selectFilter(value) {
    setActiveFilter(value);
    setSelected(null);
  }

  function toggleSort() {
    setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    setSelected(null);
  }

  const load = useCallback(async (bust = false) => {
    if (bust) invalidatePrefix('bookings:');
    const key = `bookings:${combinedStatus}:${sortDir}`;
    const cached = getCached(key);
    if (cached) {
      setBookings(cached.bookings);
      setNextCursor(cached.next ?? '');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setNextCursor('');
    try {
      const data = await listStudioBookings(combinedStatus, '', sortDir);
      const b = data.bookings ?? [];
      const next = data.next_cursor ?? '';
      setCached(key, { bookings: b, next });
      setBookings(b);
      setNextCursor(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [combinedStatus, sortDir]);

  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await listStudioBookings(combinedStatus, nextCursor, sortDir);
      const more = data.bookings ?? [];
      const next = data.next_cursor ?? '';
      setBookings(prev => [...prev, ...more]);
      setNextCursor(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleAccept(id, stationId) {
    setActionLoading(true);
    try { await acceptBookingWithStation(id, stationId); await load(true); setSelected(null); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  function handleReject(id) { setRejectTarget(id); }

  async function confirmReject(reason) {
    setActionLoading(true);
    try { await rejectBooking(rejectTarget, reason); await load(true); setSelected(null); setRejectTarget(null); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  function handleComplete(id, price) { setCompleteTarget({ id, price }); }
  function handleNoShow(id) { setNoShowTarget(id); }
  function handleCancel(id) { setCancelTarget(id); }

  async function confirmComplete(finalPrice, paymentMethod, wantsFollowUp) {
    setActionLoading(true);
    try {
      await recordOutcome(completeTarget.id, 'completed', finalPrice, paymentMethod);
      if (wantsFollowUp) await createFollowUpBooking(completeTarget.id);
      await load(true);
      setSelected(null);
      setCompleteTarget(null);
      showToast(wantsFollowUp ? 'Booking completed · follow-up session created' : 'Booking marked as complete');
    }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  async function confirmNoShow() {
    setActionLoading(true);
    try {
      await recordOutcome(noShowTarget, 'no_show');
      await load(true);
      setSelected(null);
      setNoShowTarget(null);
      showToast('Booking marked as no show');
    }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  async function confirmCancel(reason) {
    setActionLoading(true);
    try { await cancelBooking(cancelTarget, reason); await load(true); setSelected(null); setCancelTarget(null); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.trim().toLowerCase();
    return bookings.filter(b =>
      b.requester_name?.toLowerCase().includes(q) ||
      b.requester_email?.toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const selectedBooking = selected ? bookings.find(b => b.id === selected) : null;

  return (
    <div style={s.page}>
      {toast && (
        <div style={s.toast}>
          <span style={s.toastCheck}>✓</span>
          {toast}
        </div>
      )}

      {completeTarget && (
        <CompleteBookingModal
          outcome="completed"
          initialPrice={completeTarget.price}
          saving={actionLoading}
          onConfirm={confirmComplete}
          onCancel={() => setCompleteTarget(null)}
        />
      )}
      {noShowTarget && (
        <CompleteBookingModal
          outcome="no_show"
          saving={actionLoading}
          onConfirm={confirmNoShow}
          onCancel={() => setNoShowTarget(null)}
        />
      )}
      {rejectTarget && (
        <RejectBookingModal
          saving={actionLoading}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      {cancelTarget && (
        <RejectBookingModal
          title="Cancel booking"
          placeholder="Reason for cancellation…"
          confirmLabel="Cancel booking"
          saving={actionLoading}
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}

      <div style={s.header}>
        <h1 style={s.title}>Bookings</h1>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={s.searchInput}
        />
        <div style={s.filterRow}>
          <div style={s.filters}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectFilter(f.value)}
                style={{ ...s.filterBtn, ...(activeFilter === f.value ? s.filterActive : {}) }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={toggleSort} style={s.sortBtn}>
            {sortDir === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>
      </div>

      <div style={s.body}>
        {loading && <SkeletonList />}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
        {!loading && !error && filteredBookings.length === 0 && (
          <p style={s.msg}>{search ? 'No results for that search.' : 'No appointments found.'}</p>
        )}
        {!loading && filteredBookings.map(b => (
          <BookingRow
            key={b.id}
            booking={b}
            selected={selected === b.id}
            onSelect={() => setSelected(prev => prev === b.id ? null : b.id)}
          />
        ))}
        {nextCursor && !loading && (
          <button onClick={loadMore} disabled={loadingMore} style={s.loadMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          allBookings={bookings}
          onClose={() => setSelected(null)}
          onAccept={(stationId) => handleAccept(selectedBooking.id, stationId)}
          onReject={() => handleReject(selectedBooking.id)}
          onCancel={() => handleCancel(selectedBooking.id)}
          onComplete={() => handleComplete(selectedBooking.id, selectedBooking.estimated_quote ?? selectedBooking.final_price)}
          onNoShow={() => handleNoShow(selectedBooking.id)}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

function SkeletonList() {
  const widths = [120, 160, 100, 140, 110];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {widths.map((w, i) => (
        <div key={i} className="skeleton" style={{ ...s.row, cursor: 'default', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ width: w, height: 13, borderRadius: 4, background: 'var(--bg-chip)' }} />
            <div style={{ width: w * 0.6, height: 11, borderRadius: 4, background: 'var(--bg-chip)', opacity: 0.7 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
            <div style={{ width: 64, height: 20, borderRadius: 20, background: 'var(--bg-chip)' }} />
            <div style={{ width: 76, height: 11, borderRadius: 4, background: 'var(--bg-chip)', opacity: 0.7 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingRow({ booking: b, selected, onSelect }) {
  // No-shows are stored as status='completed' + outcome='no_show'; badge them distinctly.
  const displayStatus = b.status === 'completed' && b.outcome === 'no_show' ? 'no_show' : b.status;
  const sc = statusColors(displayStatus);
  const dateStr = b.chosen_time || b.proposed_time_primary;
  const date = dateStr
    ? new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const sessionParts = [
    b.session_type ? capitalise(b.session_type.replace(/_/g, ' ')) : null,
    b.body_location || null,
  ].filter(Boolean);
  const SOURCE_LABELS = { walkin: 'Walk-in', personal: 'Manual', app: 'App', import: 'Imported' };
  const sourceLabel = SOURCE_LABELS[b.source] ?? null;

  return (
    <div
      onClick={onSelect}
      style={{
        ...s.row,
        background: selected ? 'var(--bg-row-active)' : undefined,
        borderColor: selected ? 'var(--border-strong)' : 'var(--border-faint)',
      }}
    >
      <div style={s.rowLeft}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={s.clientName}>{b.requester_name}</span>
          {sourceLabel && <span style={s.sourceTag}>{sourceLabel}</span>}
          {b.parent_booking_id && <span style={s.followUpTag}>Follow-up</span>}
        </div>
        {sessionParts.length > 0 && <span style={s.rowMeta}>{sessionParts.join(' · ')}</span>}
        {b.status === 'pending' && b.created_at && (
          <span style={s.rowMeta}>Requested {new Date(b.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
        )}
      </div>
      <div style={s.rowRight}>
        <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
          {statusLabel(displayStatus)}
        </span>
        {date
          ? <span style={s.dateText}>{date}</span>
          : <span style={{ ...s.dateText, opacity: 0.35 }}>No date</span>
        }
      </div>
    </div>
  );
}

const s = {
  page: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', position: 'relative',
  },
  header: {
    padding: '1.75rem 2rem 1.25rem',
    borderBottom: '1px solid var(--border-faint)',
    display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em',
  },
  searchInput: {
    width: '100%', boxSizing: 'border-box',
    padding: '0.5rem 0.85rem', borderRadius: 8,
    border: '1px solid var(--border-faint)',
    background: 'var(--bg-input)', color: 'var(--text)',
    fontSize: '0.875rem', outline: 'none',
  },
  filterRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
  },
  filters: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
  },
  sortBtn: {
    padding: '0.3rem 0.75rem', borderRadius: 20,
    border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-muted)',
    fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  filterBtn: {
    padding: '0.3rem 0.85rem', borderRadius: 20,
    border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-muted)',
    fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
  },
  filterActive: {
    background: 'var(--accent-active-tint)', borderColor: 'var(--accent-active-border)', color: 'var(--accent)',
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '1rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  msg: {
    fontSize: '0.875rem', color: 'var(--text-faint)', padding: '1rem 0',
  },
  loadMore: {
    alignSelf: 'center', marginTop: '0.5rem', marginBottom: '1rem',
    padding: '0.5rem 1.5rem', borderRadius: 20,
    border: '1px solid var(--border-strong)',
    background: 'transparent', color: 'var(--text-muted)',
    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.9rem 1.1rem', borderRadius: 10,
    border: '1px solid var(--border-faint)',
    cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s', gap: '1rem',
  },
  rowLeft: {
    display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0,
  },
  clientName: {
    fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)',
  },
  rowMeta: {
    fontSize: '0.78rem', color: 'var(--text-secondary)',
  },
  sourceTag: {
    fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.04em',
    padding: '0.1rem 0.4rem', borderRadius: 4,
    background: 'var(--bg-chip)', color: 'var(--text-ghost)',
  },
  followUpTag: {
    fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.04em',
    padding: '0.1rem 0.4rem', borderRadius: 4,
    background: 'rgba(111,163,232,0.12)', color: '#6fa3e8',
  },
  rowRight: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0,
  },
  statusBadge: {
    fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem',
    borderRadius: 20, letterSpacing: '0.02em',
  },
  dateText: {
    fontSize: '0.75rem', color: 'var(--text-faint)',
  },
  toast: {
    position: 'absolute', bottom: '1.5rem', left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e2630', border: '1px solid rgba(76,201,138,0.3)',
    borderRadius: 10, padding: '0.6rem 1.1rem',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)',
    zIndex: 50, whiteSpace: 'nowrap',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  toastCheck: {
    color: '#4cc98a', fontWeight: 700, fontSize: '0.9rem',
  },
};
