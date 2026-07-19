'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { listStudioBookings, acceptBookingWithStation, rejectBooking, cancelBooking, recordOutcome, createFollowUpBooking, sendSelectionLink, confirmBooking, reassignArtist, getStudioArtists, getStripeStatus } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { statusColors, statusLabel, capitalise } from '@/lib/status';
import { getBookingType } from '@/lib/bookingType';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import RejectBookingModal from '@/components/RejectBookingModal';
import BookingDetailPanel from '@/components/BookingDetailPanel';

const STATUS_FILTERS = [
  { value: 'pending',               label: 'Pending' },
  { value: 'awaiting_payment',      label: 'Awaiting Payment' },
  { value: 'requires_confirmation', label: 'Needs Confirmation' },
  { value: 'confirmed',             label: 'Confirmed' },
  { value: 'completed,cancelled',   label: 'Completed' },
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
  const [sendLinkTarget,   setSendLinkTarget]   = useState(null);
  const [sendLinkHours,    setSendLinkHours]    = useState(168);
  const [sendLinkDuration, setSendLinkDuration] = useState(60);
  const [sendLinkDeposit,  setSendLinkDeposit]  = useState(false);
  const [sendLinkAmount,   setSendLinkAmount]   = useState('');
  const [sendLinkQuote,    setSendLinkQuote]    = useState('');
  const [sendLinkSaving,   setSendLinkSaving]   = useState(false);
  const [reassignTarget, setReassignTarget] = useState(null); // booking id
  const [reassignArtistId, setReassignArtistId] = useState('');
  const [reassignResend, setReassignResend] = useState(true);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [studioArtists, setStudioArtists] = useState([]);
  const [stripeConnected, setStripeConnected] = useState(false);

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

  useEffect(() => {
    getStripeStatus()
      .then(s => setStripeConnected(s?.connected && s?.charges_enabled))
      .catch(() => {});
  }, []);

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

  async function confirmComplete(finalPrice, paymentSplits, wantsFollowUp) {
    setActionLoading(true);
    try {
      await recordOutcome(completeTarget.id, 'completed', finalPrice, paymentSplits);
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

  function handleSendLink(id) {
    setSendLinkTarget(id);
    setSendLinkHours(168);
    setSendLinkDuration(60);
    setSendLinkDeposit(false);
    setSendLinkAmount('');
    setSendLinkQuote('');
  }

  async function confirmSendLink() {
    setSendLinkSaving(true);
    try {
      const amount   = sendLinkDeposit && sendLinkAmount ? parseFloat(sendLinkAmount) : null;
      const duration = sendLinkDuration ? Number(sendLinkDuration) : null;
      const quote    = sendLinkQuote ? parseFloat(sendLinkQuote) : null;
      await sendSelectionLink(sendLinkTarget, sendLinkHours, sendLinkDeposit, amount, duration, quote);
      await load(true);
      setSendLinkTarget(null);
      showToast('Selection link sent to client');
    } catch (e) { alert(e.message); }
    finally { setSendLinkSaving(false); }
  }

  async function handleConfirm(id) {
    setActionLoading(true);
    try {
      await confirmBooking(id);
      await load(true);
      setSelected(null);
      showToast('Booking confirmed');
    } catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  function openReassign(id) {
    setReassignTarget(id);
    setReassignArtistId('');
    setReassignResend(true);
    if (studioArtists.length === 0) {
      getStudioArtists('approved').then(d => setStudioArtists(d.artists ?? [])).catch(() => {});
    }
  }

  async function confirmReassign() {
    if (!reassignArtistId) return;
    setReassignSaving(true);
    try {
      await reassignArtist(reassignTarget, reassignArtistId, reassignResend);
      await load(true);
      setReassignTarget(null);
      showToast(reassignResend ? 'Artist reassigned · new link sent' : 'Artist reassigned');
    } catch (e) { alert(e.message); }
    finally { setReassignSaving(false); }
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

      {sendLinkTarget && (
        <div style={s.modalOverlay} onClick={() => setSendLinkTarget(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Send selection link</h3>
            <p style={s.modalSub}>The client will receive an email with a link to choose their artist and time.</p>
            <label style={s.modalLabel}>Appointment duration</label>
            <select value={sendLinkDuration} onChange={e => setSendLinkDuration(Number(e.target.value))} style={s.modalSelect}>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
              <option value={300}>5 hours</option>
              <option value={360}>6 hours</option>
              <option value={480}>Full day (8 hrs)</option>
            </select>
            <label style={s.modalLabel}>Estimated quote ($)</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 350"
              value={sendLinkQuote}
              onChange={e => setSendLinkQuote(e.target.value)}
              onKeyDown={e => ['e','E','+','-','.'].includes(e.key) && e.preventDefault()}
              style={s.modalInput}
              min="0"
            />
            <label style={s.modalLabel}>Link expires after</label>
            <select value={sendLinkHours} onChange={e => setSendLinkHours(Number(e.target.value))} style={s.modalSelect}>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>7 days</option>
              <option value={336}>14 days</option>
            </select>
            {stripeConnected ? (
              <>
                <label style={s.modalCheckRow}>
                  <input type="checkbox" checked={sendLinkDeposit} onChange={e => setSendLinkDeposit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Require deposit</span>
                </label>
                {sendLinkDeposit && (
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Deposit amount ($)"
                    value={sendLinkAmount}
                    onChange={e => setSendLinkAmount(e.target.value)}
                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                    style={s.modalInput}
                    min="0"
                  />
                )}
              </>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', padding: '0.5rem 0.65rem', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                Connect a Stripe account in Settings to require a deposit.
              </p>
            )}
            <div style={s.modalActions}>
              <button style={s.modalCancel} onClick={() => setSendLinkTarget(null)}>Cancel</button>
              <button style={{ ...s.modalConfirm, opacity: sendLinkSaving ? 0.5 : 1 }} onClick={confirmSendLink} disabled={sendLinkSaving}>
                {sendLinkSaving ? 'Sending…' : 'Send link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reassignTarget && (
        <div style={s.modalOverlay} onClick={() => setReassignTarget(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Reassign artist</h3>
            <label style={s.modalLabel}>New artist</label>
            <select value={reassignArtistId} onChange={e => setReassignArtistId(e.target.value)} style={s.modalSelect}>
              <option value="">Select artist…</option>
              {studioArtists.map(a => (
                <option key={a.artistId ?? a.id} value={a.artistId ?? a.id}>{a.name}</option>
              ))}
            </select>
            <label style={s.modalCheckRow}>
              <input type="checkbox" checked={reassignResend} onChange={e => setReassignResend(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Send new selection link to client</span>
            </label>
            <div style={s.modalActions}>
              <button style={s.modalCancel} onClick={() => setReassignTarget(null)}>Cancel</button>
              <button style={{ ...s.modalConfirm, opacity: (!reassignArtistId || reassignSaving) ? 0.5 : 1 }} onClick={confirmReassign} disabled={!reassignArtistId || reassignSaving}>
                {reassignSaving ? 'Saving…' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
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
          onSendLink={() => handleSendLink(selectedBooking.id)}
          onConfirm={() => handleConfirm(selectedBooking.id)}
          onReassign={() => openReassign(selectedBooking.id)}
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
          <div style={{ ...s.dateBlock, gap: '0.3rem' }}>
            <div style={{ width: 24, height: 9, borderRadius: 3, background: 'var(--bg-chip)' }} />
            <div style={{ width: 28, height: 22, borderRadius: 4, background: 'var(--bg-chip)' }} />
            <div style={{ width: 32, height: 9, borderRadius: 3, background: 'var(--bg-chip)', opacity: 0.6 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ width: w, height: 13, borderRadius: 4, background: 'var(--bg-chip)' }} />
            <div style={{ width: w * 0.6, height: 11, borderRadius: 4, background: 'var(--bg-chip)', opacity: 0.7 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
            <div style={{ width: 72, height: 22, borderRadius: 20, background: 'var(--bg-chip)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingRow({ booking: b, selected, onSelect }) {
  const displayStatus = b.status === 'completed' && b.outcome === 'no_show' ? 'no_show' : b.status;
  const sc = statusColors(displayStatus);
  const dateStr = b.chosen_time || b.proposed_time_primary;
  const d = dateStr ? new Date(dateStr) : null;
  const month = d ? d.toLocaleDateString('en-AU', { month: 'short' }).toUpperCase() : null;
  const day   = d ? d.getDate() : null;
  const time  = d ? d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase() : null;
  const createdAt = b.created_at ? new Date(b.created_at) : null;
  const reqMonth = createdAt ? createdAt.toLocaleDateString('en-AU', { month: 'short' }).toUpperCase() : null;
  const reqDay   = createdAt ? createdAt.getDate() : null;

  const sessionParts = [
    b.session_type ? capitalise(b.session_type.replace(/_/g, ' ')) : null,
    b.body_location || null,
  ].filter(Boolean);

  const bookingType = getBookingType(b.source);
  const price = b.estimated_quote > 0 ? `$${Number(b.estimated_quote).toLocaleString()}` : null;

  return (
    <div
      onClick={onSelect}
      style={{
        ...s.row,
        background: selected ? 'var(--bg-row-active)' : undefined,
        borderColor: selected ? 'var(--border-strong)' : 'var(--border-faint)',
      }}
    >
      {/* Date block */}
      <div style={s.dateBlock}>
        {d ? (
          <>
            <span style={s.dateMonth}>{month}</span>
            <span style={s.dateDay}>{day}</span>
            <span style={s.dateTime}>{time}</span>
          </>
        ) : createdAt ? (
          <>
            <span style={s.dateMonth}>{reqMonth}</span>
            <span style={s.dateDay}>{reqDay}</span>
            <span style={s.dateTime}>requested</span>
          </>
        ) : (
          <>
            <span style={s.dateMonth}>—</span>
            <span style={{ ...s.dateDay, fontSize: '0.72rem', color: 'var(--text-ghost)' }}>TBD</span>
          </>
        )}
      </div>

      {/* Main content */}
      <div style={s.rowMain}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={s.clientName}>{b.requester_name}</span>
          {b.parent_booking_id && <span style={s.followUpTag}>Follow-up</span>}
        </div>
        {sessionParts.length > 0 && (
          <span style={s.rowMeta}>{sessionParts.join(' · ')}</span>
        )}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
          <span style={{ ...s.sourceTag, background: bookingType === 'studio' ? 'rgba(245,158,58,0.1)' : 'rgba(167,139,250,0.1)', color: bookingType === 'studio' ? '#f59e3a' : '#a78bfa', borderColor: bookingType === 'studio' ? 'rgba(245,158,58,0.25)' : 'rgba(167,139,250,0.25)' }}>
            {bookingType === 'studio' ? 'Studio' : 'Personal'}
          </span>
        </div>
      </div>

      {/* Right */}
      <div style={s.rowRight}>
        <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
          {statusLabel(displayStatus)}
        </span>
        {price && <span style={s.priceText}>{price}</span>}
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
    display: 'flex', alignItems: 'center',
    padding: '0.85rem 1rem', borderRadius: 10,
    border: '1px solid var(--border-faint)',
    cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s', gap: '0.85rem',
  },
  dateBlock: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    flexShrink: 0, width: 44,
    borderRight: '1px solid var(--border-faint)', paddingRight: '0.85rem',
  },
  dateMonth: {
    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
    color: 'var(--text-ghost)', lineHeight: 1,
  },
  dateDay: {
    fontSize: '1.45rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1,
  },
  dateTime: {
    fontSize: '0.62rem', color: 'var(--text-ghost)', marginTop: '0.1rem', whiteSpace: 'nowrap',
  },
  rowMain: {
    display: 'flex', flexDirection: 'column', gap: '0.18rem', flex: 1, minWidth: 0,
  },
  clientName: {
    fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)',
  },
  rowMeta: {
    fontSize: '0.76rem', color: 'var(--text-secondary)',
  },
  sourceTag: {
    fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.04em',
    padding: '0.1rem 0.4rem', borderRadius: 4, border: '1px solid transparent',
  },
  followUpTag: {
    fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.04em',
    padding: '0.1rem 0.4rem', borderRadius: 4,
    background: 'rgba(111,163,232,0.12)', color: '#6fa3e8',
  },
  rowRight: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0,
  },
  statusBadge: {
    fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem',
    borderRadius: 20, letterSpacing: '0.02em', whiteSpace: 'nowrap',
  },
  priceText: {
    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)',
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
  modalOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
  },
  modal: {
    background: 'var(--bg-panel)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '1.5rem', width: 340,
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
  },
  modalTitle: {
    fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0,
  },
  modalSub: {
    fontSize: '0.8rem', color: 'var(--text-ghost)', lineHeight: 1.5, margin: 0,
  },
  modalLabel: {
    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--text-ghost)',
  },
  modalSelect: {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
  },
  modalInput: {
    width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
  },
  modalCheckRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
  },
  modalActions: {
    display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem',
  },
  modalCancel: {
    padding: '0.45rem 1rem', borderRadius: 7,
    border: '1px solid var(--border-faint)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
  },
  modalConfirm: {
    padding: '0.45rem 1.1rem', borderRadius: 7,
    border: '1px solid rgba(76,201,138,0.35)', background: 'rgba(76,201,138,0.12)',
    color: '#4cc98a', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
  },
};
