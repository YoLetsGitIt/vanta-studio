'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { listStudioBookings, getStudioArtists, getStripeStatus } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { statusColors, statusLabel, capitalise } from '@/lib/status';
import { getBookingStyle } from '@/lib/bookingType';
import { hasArtist } from '@/lib/format';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import RejectBookingModal from '@/components/RejectBookingModal';
import BookingDetailPanel from '@/components/BookingDetailPanel';
import { useLanguage } from '@/lib/i18n';
import SendSelectionLinkModal from '@/components/SendSelectionLinkModal';
import { showError } from '@/lib/feedback';
import { bookingActions } from '@/lib/bookingActions';

const STATUS_FILTERS = [
  { value: 'pending',                              tKey: 'status_pending' },
  { value: 'awaiting_payment',                     tKey: 'status_awaiting_payment' },
  { value: 'requires_confirmation',                tKey: 'status_needs_confirmation' },
  { value: 'confirmed',                            tKey: 'status_confirmed' },
  { value: 'completed,cancelled,deposit_expired',  tKey: 'status_completed' },
];

const COMPLETED_TAB = 'completed,cancelled,deposit_expired';

const CONFIRMED_SUB_FILTERS = [
  { value: 'all',            label: 'All' },
  { value: 'record_payment', label: 'Record payment' },
];

const CONFIRMED_TAB = 'confirmed';

const COMPLETED_SUB_FILTERS = [
  { value: 'all',             label: 'All',             status: COMPLETED_TAB,      outcome: '' },
  { value: 'completed',       label: 'Completed',       status: 'completed',        outcome: 'completed' },
  { value: 'no_show',         label: 'No Show',         status: 'completed',        outcome: 'no_show' },
  { value: 'deposit_expired', label: 'Deposit Expired', status: 'deposit_expired',  outcome: '' },
  { value: 'cancelled',       label: 'Cancelled',       status: 'cancelled',        outcome: '' },
];

const DEFAULT_FILTER = 'pending';

export default function AppointmentsPage() {
  return <Suspense><AppointmentsInner /></Suspense>;
}

function AppointmentsInner() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialFilter = STATUS_FILTERS.some(f => f.value === searchParams.get('status'))
    ? searchParams.get('status')
    : DEFAULT_FILTER;
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [completedSubFilter, setCompletedSubFilter] = useState('all');
  const [confirmedSubFilter, setConfirmedSubFilter] = useState('all');
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
  const [reassignTarget, setReassignTarget] = useState(null); // booking id
  const [reassignArtistId, setReassignArtistId] = useState('');
  const [reassignResend, setReassignResend] = useState(true);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // booking object
  const [rescheduleDate,  setRescheduleDate]  = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd,   setRescheduleEnd]   = useState('');
  const [rescheduleMsg,   setRescheduleMsg]   = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [studioArtists, setStudioArtists] = useState([]);
  const [stripeConnected, setStripeConnected] = useState(false);

  const activeSub = activeFilter === COMPLETED_TAB
    ? (COMPLETED_SUB_FILTERS.find(f => f.value === completedSubFilter) ?? COMPLETED_SUB_FILTERS[0])
    : null;
  const effectiveStatus  = activeSub ? activeSub.status  : activeFilter;
  const effectiveOutcome = activeSub ? activeSub.outcome  : '';

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function selectFilter(value) {
    setActiveFilter(value);
    setCompletedSubFilter('all');
    setConfirmedSubFilter('all');
    setSelected(null);
  }

  function toggleSort() {
    setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    setSelected(null);
  }

  const load = useCallback(async (bust = false) => {
    if (bust) invalidatePrefix('bookings:');
    const key = `bookings:${effectiveStatus}:${effectiveOutcome}:${sortDir}`;
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
      const data = await listStudioBookings(effectiveStatus, '', sortDir, effectiveOutcome);
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
  }, [effectiveStatus, effectiveOutcome, sortDir]);

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
      const data = await listStudioBookings(effectiveStatus, nextCursor, sortDir, effectiveOutcome);
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
    try { await bookingActions.accept(id, stationId); await load(true); setSelected(null); }
    catch (e) { showError(e); }
    finally { setActionLoading(false); }
  }

  function handleReject(id) { setRejectTarget(id); }

  async function confirmReject(reason) {
    setActionLoading(true);
    try { await bookingActions.reject(rejectTarget, reason); await load(true); setSelected(null); setRejectTarget(null); }
    catch (e) { showError(e); }
    finally { setActionLoading(false); }
  }

  function handleComplete(id, price, depositAmount) { setCompleteTarget({ id, price, depositAmount }); }
  function handleNoShow(id) { setNoShowTarget(id); }
  function handleCancel(id) { setCancelTarget(id); }

  async function confirmComplete(finalPrice, paymentSplits, wantsFollowUp) {
    setActionLoading(true);
    try {
      await bookingActions.complete(completeTarget.id, { finalPrice, paymentSplits, createFollowUp: wantsFollowUp });
      await load(true);
      setSelected(null);
      setCompleteTarget(null);
      showToast(wantsFollowUp ? 'Booking completed · follow-up session created' : 'Booking marked as complete');
    }
    catch (e) { showError(e); }
    finally { setActionLoading(false); }
  }

  async function confirmNoShow() {
    setActionLoading(true);
    try {
      await bookingActions.noShow(noShowTarget);
      await load(true);
      setSelected(null);
      setNoShowTarget(null);
      showToast('Booking marked as no show');
    }
    catch (e) { showError(e); }
    finally { setActionLoading(false); }
  }

  async function confirmCancel(reason) {
    setActionLoading(true);
    try { await bookingActions.cancel(cancelTarget, reason); await load(true); setSelected(null); setCancelTarget(null); }
    catch (e) { showError(e); }
    finally { setActionLoading(false); }
  }

  function handleSendLink(id) {
    setSendLinkTarget(id);
    if (studioArtists.length === 0) {
      getStudioArtists('approved').then(d => setStudioArtists(d.artists ?? [])).catch(() => {});
    }
  }

  async function handleConfirm(id) {
    setActionLoading(true);
    try {
      await bookingActions.confirm(id);
      await load(true);
      setSelected(null);
      showToast('Booking confirmed');
    } catch (e) { showError(e); }
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
      await bookingActions.reassign(reassignTarget, reassignArtistId, reassignResend);
      await load(true);
      setReassignTarget(null);
      showToast(reassignResend ? 'Artist reassigned · new link sent' : 'Artist reassigned');
    } catch (e) { showError(e); }
    finally { setReassignSaving(false); }
  }

  function openReschedule(booking) {
    const currentTime = booking?.chosen_time ?? booking?.proposed_time_primary ?? null;
    const chosenDate = currentTime ? currentTime.slice(0, 10) : null;
    const today = new Date().toLocaleDateString('en-CA');
    if (chosenDate && chosenDate <= today) return;
    const dt = currentTime ? new Date(currentTime) : new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const startHHMM = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const durationMins = booking?.duration_minutes ?? 60;
    const endDt = new Date(dt.getTime() + durationMins * 60000);
    const endHHMM = `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`;
    setRescheduleDate(dateStr);
    setRescheduleStart(startHHMM);
    setRescheduleEnd(endHHMM);
    setRescheduleMsg('');
    setRescheduleTarget(booking);
  }

  async function confirmReschedule() {
    if (!rescheduleStart || !rescheduleEnd || !rescheduleMsg.trim()) return;
    const [sh, sm] = rescheduleStart.split(':').map(Number);
    const [eh, em] = rescheduleEnd.split(':').map(Number);
    const durationMins = (eh * 60 + em) - (sh * 60 + sm);
    if (durationMins <= 0) { showError('End time must be after start time.'); return; }
    const newTime = new Date(`${rescheduleDate}T${rescheduleStart}:00`).toISOString();
    setRescheduleSaving(true);
    try {
      await bookingActions.reschedule(rescheduleTarget.id, { newTime, message: rescheduleMsg, durationMinutes: durationMins });
      await load(true);
      setRescheduleTarget(null);
      showToast('Booking rescheduled · client emailed');
    } catch (e) { showError(e); }
    finally { setRescheduleSaving(false); }
  }

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (activeFilter === CONFIRMED_TAB && confirmedSubFilter === 'record_payment') {
      const now = new Date();
      list = list.filter(b => b.chosen_time && new Date(b.chosen_time) < now);
    }
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(b =>
      b.requester_name?.toLowerCase().includes(q) ||
      b.requester_email?.toLowerCase().includes(q)
    );
  }, [bookings, search, activeFilter, confirmedSubFilter]);

  const selectedBooking = selected ? bookings.find(b => b.id === selected) : null;
  const sendLinkBooking = sendLinkTarget ? bookings.find(b => b.id === sendLinkTarget) : null;

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
          depositAmount={completeTarget.depositAmount}
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
          title={t('cancel_booking_title')}
          placeholder="Reason for cancellation…"
          confirmLabel={t('cancel_booking_confirm')}
          saving={actionLoading}
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}

      {sendLinkTarget && (
        <SendSelectionLinkModal booking={sendLinkBooking} artists={studioArtists} stripeConnected={stripeConnected} onClose={() => setSendLinkTarget(null)} onSent={() => load(true)} />
      )}

      {reassignTarget && (
        <div style={s.modalOverlay} onClick={() => setReassignTarget(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>{t('appt_reassign')}</h3>
            <label style={s.modalLabel}>{t('appt_new_artist')}</label>
            <select value={reassignArtistId} onChange={e => setReassignArtistId(e.target.value)} style={s.modalSelect}>
              <option value="">{t('appt_select_artist')}</option>
              {studioArtists.map(a => (
                <option key={a.artistId ?? a.id} value={a.artistId ?? a.id}>{a.name}</option>
              ))}
            </select>
            <label style={s.modalCheckRow}>
              <input type="checkbox" checked={reassignResend} onChange={e => setReassignResend(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{t('appt_resend_link')}</span>
            </label>
            <div style={s.modalActions}>
              <button style={s.modalCancel} onClick={() => setReassignTarget(null)}>{t('cancel')}</button>
              <button style={{ ...s.modalConfirm, opacity: (!reassignArtistId || reassignSaving) ? 0.5 : 1 }} onClick={confirmReassign} disabled={!reassignArtistId || reassignSaving}>
                {t(reassignSaving ? 'saving' : 'appt_reassign_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={s.header}>
        <h1 style={s.title}>{t('nav_bookings')}</h1>
        <input
          type="search"
          placeholder={t('appt_search')}
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
                {f.label ?? t(f.tKey)}
              </button>
            ))}
          </div>
          <button onClick={toggleSort} style={s.sortBtn}>
            {t(sortDir === 'desc' ? 'sort_newest' : 'sort_oldest')}
          </button>
        </div>
      </div>

      {activeFilter === CONFIRMED_TAB && (
        <div style={s.subFilterRow}>
          {CONFIRMED_SUB_FILTERS.map(f => (
            <button
              key={f.value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setConfirmedSubFilter(f.value); setSelected(null); }}
              style={{ ...s.subFilterBtn, ...(confirmedSubFilter === f.value ? s.subFilterActive : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeFilter === COMPLETED_TAB && (
        <div style={s.subFilterRow}>
          {COMPLETED_SUB_FILTERS.map(f => (
            <button
              key={f.value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setCompletedSubFilter(f.value); setSelected(null); }}
              style={{ ...s.subFilterBtn, ...(completedSubFilter === f.value ? s.subFilterActive : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div style={s.body}>
        {loading && <SkeletonList />}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
        {!loading && !error && filteredBookings.length === 0 && (
          <p style={s.msg}>{t(search ? 'appt_no_results' : 'appt_none')}</p>
        )}
        {!loading && filteredBookings.map(b => (
          <BookingRow
            key={b.id}
            booking={b}
            selected={selected === b.id}
            onSelect={() => setSelected(prev => prev === b.id ? null : b.id)}
            labelOverride={b.status === 'confirmed' && b.chosen_time && new Date(b.chosen_time) < new Date() ? 'Record payment' : undefined}
          />
        ))}
        {nextCursor && !loading && (
          <button onClick={loadMore} disabled={loadingMore} style={s.loadMore}>
            {t(loadingMore ? 'loading' : 'load_more')}
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
          onComplete={() => handleComplete(selectedBooking.id, selectedBooking.estimated_quote ?? selectedBooking.final_price, selectedBooking.deposit_amount ?? null)}
          onNoShow={() => handleNoShow(selectedBooking.id)}
          onSendLink={() => handleSendLink(selectedBooking.id)}
          onConfirm={() => handleConfirm(selectedBooking.id)}
          onReassign={() => openReassign(selectedBooking.id)}
          onReschedule={() => openReschedule(selectedBooking)}
          actionLoading={actionLoading}
        />
      )}

      {/* ── Reschedule modal ── */}
      {rescheduleTarget && (
        <div style={s.modalOverlay} onClick={e => e.target === e.currentTarget && setRescheduleTarget(null)}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>{t('reschedule_booking')}</h3>
            <p style={s.modalSub}>
              {rescheduleTarget.requester_name} · {rescheduleTarget.session_type}
            </p>

            <div style={s.modalField}>
              <label style={s.modalLabel}>{t('sched_date')}</label>
              <input
                type="date"
                value={rescheduleDate}
                disabled
                style={{ ...s.modalInput, colorScheme: 'auto', opacity: 0.55, cursor: 'not-allowed' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={s.modalLabel}>{t('nap_start_time')}</label>
                <input
                  type="time"
                  value={rescheduleStart}
                  onChange={e => setRescheduleStart(e.target.value)}
                  style={{ ...s.modalInput, colorScheme: 'auto' }}
                />
              </div>
              <div>
                <label style={s.modalLabel}>{t('reschedule_end_time')}</label>
                <input
                  type="time"
                  value={rescheduleEnd}
                  onChange={e => setRescheduleEnd(e.target.value)}
                  style={{ ...s.modalInput, colorScheme: 'auto' }}
                />
              </div>
            </div>

            <div style={s.modalField}>
              <label style={s.modalLabel}>{t('reschedule_message')} <span style={{ color: '#e86f6f' }}>*</span></label>
              <p style={s.modalHint}>{t('reschedule_message_hint')}</p>
              <textarea
                value={rescheduleMsg}
                onChange={e => setRescheduleMsg(e.target.value)}
                placeholder="e.g. We need to move your appointment due to an artist scheduling conflict. Apologies for the inconvenience!"
                rows={4}
                style={{ ...s.modalInput, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                style={s.modalCancelBtn}
                onClick={() => setRescheduleTarget(null)}
                disabled={rescheduleSaving}
              >
                {t('cancel')}
              </button>
              <button
                style={{ ...s.modalSaveBtn, opacity: (!rescheduleStart || !rescheduleEnd || !rescheduleMsg.trim() || rescheduleSaving) ? 0.5 : 1 }}
                onClick={confirmReschedule}
                disabled={!rescheduleStart || !rescheduleEnd || !rescheduleMsg.trim() || rescheduleSaving}
              >
                {t(rescheduleSaving ? 'saving' : 'reschedule_confirm')}
              </button>
            </div>
          </div>
        </div>
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

function BookingRow({ booking: b, selected, onSelect, labelOverride }) {
  const { t } = useLanguage();
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
    hasArtist(b.artist_id) ? b.artist_name : t('bdp_artist_unspecified'),
  ].filter(Boolean);

  const bookingStyle = getBookingStyle(b.source);
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
            <span style={s.dateTime}>{t('appt_requested')}</span>
          </>
        ) : (
          <>
            <span style={s.dateMonth}>—</span>
            <span style={{ ...s.dateDay, fontSize: '0.72rem', color: 'var(--text-ghost)' }}>{t('tbd')}</span>
          </>
        )}
      </div>

      {/* Main content */}
      <div style={s.rowMain}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={s.clientName}>{b.requester_name}</span>
          {b.parent_booking_id && <span style={s.followUpTag}>{t('appt_followup')}</span>}
        </div>
        {sessionParts.length > 0 && (
          <span style={s.rowMeta}>{sessionParts.join(' · ')}</span>
        )}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
          <span style={{ ...s.sourceTag, background: bookingStyle.bg, color: bookingStyle.tagColor, borderColor: bookingStyle.border }}>
            {bookingStyle.tag}
          </span>
        </div>
      </div>

      {/* Right */}
      <div style={s.rowRight}>
        <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
          {labelOverride ?? statusLabel(displayStatus)}
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
    background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', color: 'var(--accent)',
  },
  subFilterRow: {
    display: 'flex', gap: '0.35rem', flexWrap: 'wrap',
    padding: '0.6rem 2rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  subFilterBtn: {
    padding: '0.2rem 0.7rem', borderRadius: 20,
    border: '1px solid var(--border-faint)',
    background: 'transparent', color: 'var(--text-ghost)',
    fontSize: '0.73rem', fontWeight: 500, cursor: 'pointer',
  },
  subFilterActive: {
    background: 'var(--bg-chip)', border: '1px solid var(--border)', color: 'var(--text-muted)',
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
  modalField: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  modalHint: { fontSize: '0.75rem', color: 'var(--text-ghost)', margin: 0, lineHeight: 1.4 },
  modalCancelBtn: {
    flex: 1, padding: '0.5rem', borderRadius: 7,
    border: '1px solid var(--border-faint)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
  },
  modalSaveBtn: {
    flex: 2, padding: '0.5rem', borderRadius: 7,
    border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)',
    color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
  },
};
