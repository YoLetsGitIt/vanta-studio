'use client';

import { SCHEDULE_GO_TO_DATE, SCHEDULE_SHOWN_DATE } from '@/components/SidebarCalendar';

import { useState, useEffect, useRef } from 'react';
import { getStudioArtists, getStudioSchedule, getStudioScheduleRange, createManualBooking, getStations, getStripeStatus } from '@/lib/api';
import { loadBooking } from '@/lib/bookingCache';
import { entryStyle, useAppointmentTypes, UNTYPED_COLOR } from '@/lib/appointmentTypes';
import BookingDetailPanel from '@/components/BookingDetailPanel';
import ScheduleWeekView, { useScheduleFilterSlot } from '@/components/ScheduleWeekView';
import { createPortal } from 'react-dom';
import weekStyles from '@/components/ScheduleWeekView.module.css';
import ScheduleScrollFrame, { ScheduleControls } from '@/components/ScheduleScrollFrame';
import { weekRangeLabel, localDateKey } from '@/lib/scheduleWeek.mjs';

// A day's bookings from a week or month the schedule already loaded, so switching to
// day view doesn't fetch again. Null when no loaded range covers the day.
function dayFromLoadedRange(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`);
  const covers = (start, days) => { const from = new Date(`${start}T00:00:00`); const to = new Date(from); to.setDate(to.getDate() + days); return day >= from && day < to; };
  const ranges = [
    ...cachedWithPrefix('schedule:week:').filter(([key]) => covers(key.slice('schedule:week:'.length), 7)),
    ...cachedWithPrefix('schedule:month:').filter(([key]) => covers(key.slice('schedule:month:'.length), 35)),
  ];
  if (!ranges.length) return null;
  return ranges[0][1].filter(e => e.chosenTime && localDateKey(new Date(e.chosenTime)) === dateStr);
}
import { getCached, setCached, invalidatePrefix, cachedWithPrefix } from '@/lib/cache';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import RejectBookingModal from '@/components/RejectBookingModal';
import { initials, toISODate, hasArtist } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { showError } from '@/lib/feedback';
import { bookingActions } from '@/lib/bookingActions';
import { canCollectDeposits } from '@/lib/deposits';

const HOUR_PX   = 64;
const DAY_START = 8;
const DAY_END   = 20;
const HOURS     = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

// Short landscape phones get a tighter hour so more of the working day fits on screen.
function useHourPx() {
  const [px, setPx] = useState(HOUR_PX);
  useEffect(() => {
    const mq = window.matchMedia('(max-height: 550px) and (orientation: landscape) and (any-pointer: coarse)');
    const update = () => setPx(mq.matches ? 48 : HOUR_PX);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return px;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// All block colours are type-based — no per-artist palette.

// ── helpers ──────────────────────────────────────────────────────────────────

const toISO = toISODate; // local alias; the many call sites below read cleaner as toISO
function ChevronIcon({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={dir === 'left' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const [completeTarget,   setCompleteTarget]   = useState(null);
  const [noShowTarget,     setNoShowTarget]     = useState(null);
  const [rejectTarget,     setRejectTarget]     = useState(null);
  const [cancelTarget,     setCancelTarget]     = useState(null);
  const [sendLinkTarget,   setSendLinkTarget]   = useState(null);
  const [sendLinkHours,    setSendLinkHours]    = useState(168);
  const [sendLinkDuration, setSendLinkDuration] = useState(60);
  const [sendLinkDeposit,  setSendLinkDeposit]  = useState(false);
  const [sendLinkAmount,   setSendLinkAmount]   = useState('');
  const [sendLinkQuote,    setSendLinkQuote]    = useState('');
  const [sendLinkArtistId, setSendLinkArtistId] = useState('');
  const [sendLinkSaving,   setSendLinkSaving]   = useState(false);
  const [reassignTarget,   setReassignTarget]   = useState(null);
  const [reassignArtistId, setReassignArtistId] = useState('');
  const [reassignResend,   setReassignResend]   = useState(true);
  const [reassignSaving,   setReassignSaving]   = useState(false);
  const [studioArtists,    setStudioArtists]    = useState([]);
  const [stripeConnected,  setStripeConnected]  = useState(false);

  useEffect(() => {
    getStripeStatus().then(s => setStripeConnected(canCollectDeposits(s))).catch(() => {});
  }, []);

  // A booking opened before (or just hovered) shows at once, then refreshes.
  const cancelDetailLoad = useRef(() => {});
  function openDetail(entry) {
    cancelDetailLoad.current();
    setSelectedEntry(entry);
    setDetailBooking(null);
    setDetailLoading(true);
    cancelDetailLoad.current = loadBooking(entry.bookingId, {
      onBooking: (booking, { cached }) => { setDetailBooking(booking); if (cached) setDetailLoading(false); },
      onDone: () => setDetailLoading(false), // on failure, fall back to schedule entry data
    });
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
    } catch (e) { showError(e); }
    finally { setActionLoading(false); }
  }

  function handleAction(action, stationId) {
    if (!selectedEntry) return;
    if (action === 'complete') {
      const price = detailBooking?.final_price ?? detailBooking?.estimated_quote ?? selectedEntry?.estimatedQuote;
      setCompleteTarget({
        id: selectedEntry.bookingId,
        price,
        depositAmount: detailBooking?.deposit_amount ?? null,
      });
      return;
    }
    if (action === 'no_show') { setNoShowTarget(selectedEntry.bookingId); return; }
    if (action === 'reject')  { setRejectTarget(selectedEntry.bookingId); return; }
    if (action === 'cancel')  { setCancelTarget(selectedEntry.bookingId); return; }
    if (action === 'send_link') {
      setSendLinkTarget(selectedEntry.bookingId);
      setSendLinkHours(168); setSendLinkDuration(60);
      setSendLinkDeposit(false); setSendLinkAmount(''); setSendLinkQuote('');
      setSendLinkArtistId('');
      if (studioArtists.length === 0) {
        getStudioArtists('approved').then(d => setStudioArtists(d.artists ?? [])).catch(() => {});
      }
      return;
    }
    if (action === 'confirm') { run(() => bookingActions.confirm(selectedEntry.bookingId), () => {}); return; }
    if (action === 'reassign') {
      setReassignTarget(selectedEntry.bookingId);
      setReassignArtistId(''); setReassignResend(true);
      if (studioArtists.length === 0) {
        getStudioArtists('approved').then(d => setStudioArtists(d.artists ?? [])).catch(() => {});
      }
      return;
    }
    if (action === 'accept')  run(() => bookingActions.accept(selectedEntry.bookingId, stationId), () => {});
  }

  const confirmComplete = (finalPrice, paymentSplits, wantsFollowUp) =>
    run(async () => {
      await bookingActions.complete(completeTarget.id, { finalPrice, paymentSplits, createFollowUp: wantsFollowUp });
    }, () => setCompleteTarget(null));
  const confirmNoShow = () =>
    run(() => bookingActions.noShow(noShowTarget), () => setNoShowTarget(null));
  const confirmReject = (reason) =>
    run(() => bookingActions.reject(rejectTarget, reason), () => setRejectTarget(null));
  const confirmCancel = (reason) =>
    run(() => bookingActions.cancel(cancelTarget, reason), () => setCancelTarget(null));

  async function confirmSendLink() {
    setSendLinkSaving(true);
    try {
      const amount   = sendLinkDeposit && sendLinkAmount ? parseFloat(sendLinkAmount) : null;
      const duration = sendLinkDuration ? Number(sendLinkDuration) : null;
      const quote    = sendLinkQuote ? parseFloat(sendLinkQuote) : null;
      await bookingActions.sendSelectionLink(sendLinkTarget, { expiresHours: sendLinkHours, depositRequired: sendLinkDeposit, depositAmount: amount, durationMinutes: duration, estimatedQuote: quote, artistId: sendLinkArtistId || null });
      setSendLinkTarget(null);
      closeDetail();
      afterChange();
    } catch (e) { showError(e); }
    finally { setSendLinkSaving(false); }
  }

  async function confirmReassign() {
    if (!reassignArtistId) return;
    setReassignSaving(true);
    try {
      await bookingActions.reassign(reassignTarget, reassignArtistId, reassignResend);
      setReassignTarget(null);
      closeDetail();
      afterChange();
    } catch (e) { showError(e); }
    finally { setReassignSaving(false); }
  }

  return {
    selectedEntry, detailBooking, detailLoading, actionLoading,
    completeTarget, noShowTarget, rejectTarget,
    cancelTarget, sendLinkTarget, sendLinkHours, sendLinkDuration, sendLinkDeposit, sendLinkAmount, sendLinkQuote, sendLinkArtistId, sendLinkSaving,
    reassignTarget, reassignArtistId, reassignResend, reassignSaving, studioArtists, stripeConnected,
    openDetail, closeDetail, handleAction, afterChange,
    confirmComplete, confirmNoShow, confirmReject, confirmCancel, confirmSendLink, confirmReassign,
    setCompleteTarget, setNoShowTarget, setRejectTarget,
    setCancelTarget, setSendLinkTarget, setSendLinkHours, setSendLinkDuration, setSendLinkDeposit, setSendLinkAmount, setSendLinkQuote, setSendLinkArtistId,
    setReassignTarget, setReassignArtistId, setReassignResend,
  };
}

function BookingOverlays({ actions: a }) {
  const { t } = useLanguage();
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
          onCancel={() => a.handleAction('cancel')}
          onComplete={() => a.handleAction('complete')}
          onNoShow={() => a.handleAction('no_show')}
          onSendLink={() => a.handleAction('send_link')}
          onConfirm={() => a.handleAction('confirm')}
          onReassign={() => a.handleAction('reassign')}
          bookTimeArtists={a.studioArtists}
          depositsReady={a.stripeConnected}
          onBooked={() => { a.closeDetail(); a.afterChange(); }}
        />
      )}
      {a.completeTarget && (
        <CompleteBookingModal
          outcome="completed"
          initialPrice={a.completeTarget.price}
          depositAmount={a.completeTarget.depositAmount}
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
      {a.cancelTarget && (
        <RejectBookingModal
          title={t('cancel_booking_title')}
          placeholder="Reason for cancellation…"
          confirmLabel={t('cancel_booking_confirm')}
          saving={a.actionLoading}
          onConfirm={a.confirmCancel}
          onCancel={() => a.setCancelTarget(null)}
        />
      )}
      {a.sendLinkTarget && (
        <div className="studio-legacy-overlay" style={overlayStyle} onClick={() => a.setSendLinkTarget(null)}>
          <div className="studio-legacy-modal" style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
              {t('appt_send_link')}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-ghost)' }}>
              {t('appt_send_link_desc')}
            </p>
            {!hasArtist(a.detailBooking?.artist_id) && (
              <>
                <label style={labelStyle}>{t('bdp_artist')}</label>
                <select value={a.sendLinkArtistId} onChange={e => a.setSendLinkArtistId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'auto', marginBottom: '0.75rem' }}>
                  <option value="">{t('appt_select_artist')}</option>
                  {a.studioArtists.map(art => (
                    <option key={art.artistId ?? art.id} value={art.artistId ?? art.id}>{art.name}</option>
                  ))}
                </select>
              </>
            )}
            <label style={labelStyle}>{t('appt_duration')}</label>
            <select value={a.sendLinkDuration} onChange={e => a.setSendLinkDuration(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'auto', marginBottom: '0.75rem' }}>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
              <option value={300}>5 hours</option>
              <option value={360}>6 hours</option>
              <option value={480}>Full day (8 hrs)</option>
            </select>
            <label style={labelStyle}>{t('appt_quote')}</label>
            <input
              type="number" inputMode="numeric" placeholder="e.g. 350" min="0"
              value={a.sendLinkQuote} onChange={e => a.setSendLinkQuote(e.target.value)}
              onKeyDown={e => ['e','E','+','-','.'].includes(e.key) && e.preventDefault()}
              style={{ ...inputStyle, marginBottom: '0.75rem' }}
            />
            <label style={labelStyle}>{t('appt_expires')}</label>
            <select value={a.sendLinkHours} onChange={e => a.setSendLinkHours(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'auto', marginBottom: '0.75rem' }}>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>7 days</option>
              <option value={336}>14 days</option>
            </select>
            {a.stripeConnected ? (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={a.sendLinkDeposit} onChange={e => a.setSendLinkDeposit(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{t('appt_deposit')}</span>
                </label>
                {a.sendLinkDeposit && (
                  <input
                    type="number" inputMode="decimal" placeholder="Deposit amount ($)" min="0"
                    value={a.sendLinkAmount} onChange={e => a.setSendLinkAmount(e.target.value)}
                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                    style={{ ...inputStyle, marginBottom: '0.75rem' }}
                  />
                )}
              </>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', padding: '0.5rem 0.65rem', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                {t('appt_stripe_hint')}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
              <button style={cancelBtnStyle} onClick={() => a.setSendLinkTarget(null)}>{t('cancel')}</button>
              <button
                style={{ ...saveBtnStyle, opacity: (a.sendLinkSaving || (!hasArtist(a.detailBooking?.artist_id) && !a.sendLinkArtistId)) ? 0.5 : 1 }}
                onClick={a.confirmSendLink} disabled={a.sendLinkSaving || (!hasArtist(a.detailBooking?.artist_id) && !a.sendLinkArtistId)}
              >
                {t(a.sendLinkSaving ? 'sending' : 'appt_send_link_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
      {a.reassignTarget && (
        <div className="studio-legacy-overlay" style={overlayStyle} onClick={() => a.setReassignTarget(null)}>
          <div className="studio-legacy-modal" style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
              {t('appt_reassign')}
            </h3>
            <label style={labelStyle}>{t('appt_new_artist')}</label>
            <select value={a.reassignArtistId} onChange={e => a.setReassignArtistId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'auto', marginBottom: '0.75rem' }}>
              <option value="">{t('appt_select_artist')}</option>
              {a.studioArtists.map(ar => (
                <option key={ar.artistId ?? ar.id} value={ar.artistId ?? ar.id}>{ar.name}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={a.reassignResend} onChange={e => a.setReassignResend(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{t('appt_resend_link')}</span>
            </label>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button style={cancelBtnStyle} onClick={() => a.setReassignTarget(null)}>{t('cancel')}</button>
              <button
                style={{ ...saveBtnStyle, opacity: (!a.reassignArtistId || a.reassignSaving) ? 0.5 : 1 }}
                onClick={a.confirmReassign} disabled={!a.reassignArtistId || a.reassignSaving}
              >
                {t(a.reassignSaving ? 'saving' : 'appt_reassign_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalStyle = {
  background: 'var(--bg-panel)', border: '1px solid var(--border)',
  borderRadius: 12, padding: '1.5rem', width: 340,
  display: 'flex', flexDirection: 'column',
};
const labelStyle = {
  fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)',
};
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem',
  borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
};
const cancelBtnStyle = {
  flex: 1, padding: '0.5rem', borderRadius: 7,
  border: '1px solid var(--border-faint)', background: 'transparent',
  color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
};
const saveBtnStyle = {
  flex: 2, padding: '0.5rem', borderRadius: 7,
  border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)',
  color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
};

// ── Week view ─────────────────────────────────────────────────────────────────

function MonthView({ monthStart, onDayClick }) {
  const { byId: typesById } = useAppointmentTypes();
  const { t } = useLanguage();
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
    function handler() { setRefreshKey(k => k + 1); }
    window.addEventListener('booking-created', handler);
    return () => window.removeEventListener('booking-created', handler);
  }, []);

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


  if (loading) return <p style={s.msg}>{t('loading')}</p>;
  if (error)   return <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="studio-calendar-scroll" style={s.calWrap}>
      <div style={s.monthWeekdays}>
        {DAY_NAMES.map(d => <div key={d} style={s.monthWeekday}>{d}</div>)}
      </div>
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
                    const ss = entryStyle(b, typesById);
                    const unconfirmed = b.status === 'requires_confirmation' || b.status === 'awaiting_payment';
                    return (
                      <div key={b.bookingId} data-booking-id={b.bookingId} style={{ ...s.chip, cursor: 'pointer', background: unconfirmed ? 'rgba(255,255,255,0.04)' : ss.bg, border: unconfirmed ? '1px dashed rgba(255,255,255,0.18)' : undefined }} onClick={e => { e.stopPropagation(); actions.openDetail(b); }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: unconfirmed ? 'rgba(255,255,255,0.2)' : ss.dot, flexShrink: 0 }} />
                        <span style={{ ...s.chipTime, color: unconfirmed ? 'rgba(255,255,255,0.3)' : undefined }}>{fmtTime(b.chosenTime)}</span>
                        <span style={{ ...s.chipClient, color: unconfirmed ? 'rgba(255,255,255,0.3)' : undefined }}>{b.clientName.split(' ')[0]}</span>
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

      <MonthTypeLegend />
    </div>

    <BookingOverlays actions={actions} />
    </div>
  );
}

// ── Full week schedule ────────────────────────────────────────────────────────

function WeekView({ date, lens, onDayClick }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => { invalidatePrefix('schedule:'); setRefreshKey(value => value + 1); };
  const actions = useBookingActions(refresh);
  useEffect(() => {
    window.addEventListener('booking-created', refresh);
    return () => window.removeEventListener('booking-created', refresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { actions.closeDetail(); }, [toISO(date), lens]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <ScheduleWeekView date={date} lens={lens} refreshKey={refreshKey} selectedBookingId={actions.selectedEntry?.bookingId} onOpenDetail={actions.openDetail} onDayClick={onDayClick} />
      <BookingOverlays actions={actions} />
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ date, showAll, setShowAll }) {
  const { byId: typesById } = useAppointmentTypes();
  const { t } = useLanguage();
  const hourPx = useHourPx();
  const gridH  = (DAY_END - DAY_START) * hourPx;
  const filterSlot = useScheduleFilterSlot();
  const [artists,        setArtists]        = useState([]);
  const [entries,        setEntries]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [refreshKey,     setRefreshKey]     = useState(0);
  const actions = useBookingActions(() => {
    invalidatePrefix('schedule:');
    setRefreshKey(k => k + 1);
  });

  useEffect(() => {
    function handler() { setRefreshKey(k => k + 1); }
    window.addEventListener('booking-created', handler);
    return () => window.removeEventListener('booking-created', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const dateStr = toISO(date);
      const ak = 'artists:approved';
      const sk = `schedule:${dateStr}`;
      const ca = getCached(ak), cs = getCached(sk) ?? dayFromLoadedRange(dateStr);
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
  // With nobody booked yet, show everyone so there's somewhere to add a booking.
  const cols = showAll || !working.length ? sorted : working;
  function addBooking(artistId, minutes) {
    window.dispatchEvent(new CustomEvent('vanta:open-new-appointment', {
      detail: { bookingType: 'studio', slot: { date: toISO(date), time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, artistId } },
    }));
  }
  const slotTime = minutes => { const at = new Date(date); at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }); };

  if (loading) return <p style={s.msg}>{t('loading')}</p>;
  if (error)   return <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>;
  if (!sorted.length) return <p style={s.msg}>{t('sched_no_artists_yet')}</p>;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {filterSlot && createPortal(
        <select className="studio-schedule-filter-select" aria-label="Artists shown" value={showAll || !working.length ? 'all' : 'working'} onChange={e => setShowAll(e.target.value === 'all')}>
          {working.length > 0 && <option value="working">{t('sched_working_today_only')} ({working.length})</option>}
          <option value="all">{t('sched_all_artists')} ({sorted.length})</option>
        </select>,
        filterSlot,
      )}

      {cols.length === 0 ? (
        <p style={s.msg}>{t('sched_no_artists_working')}</p>
      ) : (
      <div className="studio-calendar-scroll" style={s.calWrap}>
      <div style={{ ...s.grid, gridTemplateColumns: `52px repeat(${cols.length}, minmax(160px, 1fr))` }}>
        <div className="studio-calendar-column-heading" style={s.cornerCell} />

        {cols.map(artist => (
          <div key={artist.id} className="studio-calendar-column-heading" style={s.artistHeader}>
            {artist.profileImage
              ? <img src={artist.profileImage} alt={artist.name} style={s.artistAvatar} />
              : <div style={{ ...s.artistAvatar, ...s.artistAvatarFallback }}>{initials(artist.name)}</div>
            }
            <span style={s.artistName}>{artist.name}</span>
          </div>
        ))}

        <div style={{ ...s.gutterCol, height: gridH }}>
          {HOURS.map(h => (
            <div key={h} style={{ ...s.hourLabel, top: (h - DAY_START) * hourPx }}>
              {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h-12}pm`}
            </div>
          ))}
        </div>

        {cols.map(artist => {
          const bookings = byArtist[artist.artistId] ?? [];
          return (
            <div key={artist.id} style={{ ...s.dayCol, height: gridH }}>
              {Array.from({ length: (DAY_END - DAY_START) * 2 }, (_, i) => {
                const minutes = DAY_START * 60 + i * 30;
                const label = `${t('new_appointment')} · ${artist.name} · ${slotTime(minutes)}`;
                // An artist can't be double-booked, so a booked half hour has nothing to add.
                const covered = bookings.some(b => { const start = minutesFromMidnight(b.chosenTime); return start < minutes + 30 && start + (b.durationMins ?? 60) > minutes; });
                if (covered) return null;
                return (
                  <button key={minutes} type="button" className={weekStyles.addSlot} aria-label={label}
                    style={{ top: i * 30 * (hourPx / 60), height: 30 * (hourPx / 60) }}
                    onClick={() => addBooking(artist.artistId, minutes)}>
                    <span aria-hidden="true">{`＋ ${slotTime(minutes)}`}</span>
                  </button>
                );
              })}
              {HOURS.map(h => <div key={h} style={{ ...s.gridLine, top: (h - DAY_START) * hourPx, pointerEvents: 'none' }} />)}
              {bookings.map(b => {
                const startMin = minutesFromMidnight(b.chosenTime);
                const durMin   = b.durationMins ?? 60;
                const top      = (startMin - DAY_START * 60) * (hourPx / 60);
                const height   = Math.max(durMin * (hourPx / 60), 24);
                if (top < 0 || top > gridH) return null;
                const isSelected = actions.selectedEntry?.bookingId === b.bookingId;
                const ss = entryStyle(b, typesById);
                const unconfirmed = b.status === 'requires_confirmation' || b.status === 'awaiting_payment';
                const blockBorder = unconfirmed ? 'rgba(255,255,255,0.18)' : ss.border;
                const blockBg     = unconfirmed ? 'var(--bg-base)' : ss.bg;
                const nameColor   = unconfirmed ? 'rgba(255,255,255,0.4)'  : 'var(--text-dim)';
                return (
                  <div
                    key={b.bookingId}
                    data-booking-id={b.bookingId}
                    onClick={() => actions.openDetail(b)}
                    style={{
                      ...s.block, top, height, left: 4, right: 4, width: undefined, zIndex: 1,
                      background: blockBg,
                      border: `1px ${unconfirmed ? 'dashed' : 'solid'} ${blockBorder}55`,
                      borderLeft: `3px ${unconfirmed ? 'dashed' : 'solid'} ${blockBorder}`,
                      cursor: 'pointer',
                      ...(isSelected ? s.blockSelected : {}),
                    }}
                  >
                    <span style={{ ...s.blockClient, color: nameColor }}>{b.clientName}</span>
                    {height >= 28 && ss.tag && !unconfirmed && (
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
  const { t } = useLanguage();
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
    <div className="studio-legacy-overlay" style={s.modalOverlay}>
      <div className="studio-legacy-modal" style={s.modal}>
        <div style={s.panelHeader}>
          <span style={s.panelTitle}>{t('sched_new_booking')}</span>
          <button aria-label="Close booking panel" onClick={onClose} style={s.panelClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.1rem', overflowY: 'auto', flex: 1 }}>
          <div>
            <label style={lbl}>{t('bdp_artist')} *</label>
            <select value={artistId} onChange={e => setArtistId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {artists.map(a => <option key={a.artistId} value={a.artistId}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>{t('sched_client_name')} *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={lbl}>{t('sched_date')} *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t('sched_time')} *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={lbl}>{t('sched_email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" style={inp} />
            </div>
            <div>
              <label style={lbl}>{t('sched_phone')}</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="optional" style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>{t('bdp_notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Design details, placement, etc." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          {error && <p style={{ ...s.stationError, textAlign: 'left' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
            <button type="button" onClick={onClose} style={{ ...s.actionBtn, flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{t('cancel')}</button>
            <button type="submit" disabled={saving} style={{ ...s.actionBtn, ...s.actionBtnPrimary, flex: 2 }}>{saving ? t('sched_creating') : t('sched_create_booking')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Station month view ────────────────────────────────────────────────────────

function StationMonthView({ monthStart, onDayClick }) {
  const { t } = useLanguage();
  const monthEnd  = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const gridStart = getMonday(monthStart);
  const gridEnd   = addDays(getMonday(monthEnd), 6);
  const numDays   = Math.round((gridEnd - gridStart) / 86400000) + 1;
  const monthDays = Array.from({ length: numDays }, (_, i) => addDays(gridStart, i));
  const curMonth  = monthStart.getMonth();

  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function handler() { setRefreshKey(k => k + 1); }
    window.addEventListener('booking-created', handler);
    return () => window.removeEventListener('booking-created', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const start = toISO(gridStart);
    const end   = toISO(gridEnd);
    const key   = `schedule:month:${start}`;
    const cached = getCached(key);
    if (cached) { setEntries(cached); setLoading(false); }
    else setLoading(true);
    getStudioScheduleRange(start, end)
      .then(d => { const e = d.entries ?? []; setCached(key, e); if (!cancelled) { setEntries(e); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [toISO(monthStart), refreshKey]); // eslint-disable-line

  // Group entries by date
  const byDate = {};
  for (const e of entries) {
    const d = e.date ?? toISO(new Date(e.chosenTime));
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  }

  // All stations seen this month (for the legend)
  const allStationNames = [...new Set(entries.filter(e => e.stationName).map(e => e.stationName))];

  const today = toISO(new Date());

  if (loading) return <p style={s.msg}>{t('loading')}</p>;
  if (error)   return <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="studio-calendar-scroll" style={s.calWrap}>
      <div style={s.monthWeekdays}>
        {DAY_NAMES.map(d => <div key={d} style={s.monthWeekday}>{d}</div>)}
      </div>
        <div style={{ ...s.monthGrid, gridTemplateRows: `repeat(${numDays / 7}, minmax(94px, 1fr))` }}>
          {monthDays.map((day, i) => {
            const iso     = toISO(day);
            const isToday = iso === today;
            const outside = day.getMonth() !== curMonth;
            const dayEnts = byDate[iso] ?? [];

            const assigned   = dayEnts.filter(e => e.stationId);
            const unassigned = dayEnts.filter(e => !e.stationId);

            // Aggregate by station
            const stationMap = {};
            for (const e of assigned) {
              if (!stationMap[e.stationId]) stationMap[e.stationId] = { name: e.stationName, count: 0, unconfirmedCount: 0 };
              stationMap[e.stationId].count++;
              if (e.status === 'requires_confirmation' || e.status === 'awaiting_payment') stationMap[e.stationId].unconfirmedCount++;
            }
            const usedStations = Object.values(stationMap);
            const visibleStations = usedStations.slice(0, 2);
            const moreStations   = usedStations.length - visibleStations.length;

            return (
              <div
                key={i}
                style={{ ...s.monthCell, ...(isToday ? s.monthCellToday : {}), ...(outside ? s.monthCellOutside : {}), cursor: 'pointer' }}
                onClick={() => onDayClick(day)}
              >
                <div style={s.monthCellHead}>
                  <span style={{ ...s.monthDayNum, ...(isToday ? s.dayNumToday : {}) }}>{day.getDate()}</span>
                  {dayEnts.length > 0 && <span style={s.weekDayCount}>{dayEnts.length}</span>}
                </div>

                <div style={s.monthChipList}>
                  {visibleStations.map(st => {
                    const allUnconfirmed = st.unconfirmedCount === st.count;
                    return (
                      <div key={st.name} style={{ ...s.chip, background: allUnconfirmed ? 'rgba(255,255,255,0.04)' : 'rgba(111,163,232,0.1)', border: allUnconfirmed ? '1px dashed rgba(255,255,255,0.18)' : undefined }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: allUnconfirmed ? 'rgba(255,255,255,0.2)' : '#6fa3e8', flexShrink: 0 }} />
                        <span style={{ ...s.chipClient, color: allUnconfirmed ? 'rgba(255,255,255,0.3)' : undefined }}>{st.name}</span>
                        <span style={{ fontSize: '0.65rem', color: allUnconfirmed ? 'rgba(255,255,255,0.2)' : 'var(--text-ghost)', flexShrink: 0 }}>{st.count}</span>
                      </div>
                    );
                  })}
                  {unassigned.length > 0 && (
                    <div style={{ ...s.chip, background: 'rgba(245,158,58,0.08)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: '#f59e3a', flexShrink: 0 }} />
                      <span style={{ ...s.chipClient, color: 'var(--text-ghost)' }}>{unassigned.length} {t('sched_unassigned').toLowerCase()}</span>
                    </div>
                  )}
                  {moreStations > 0 && (
                    <button style={s.moreBtn}>+{moreStations} stations</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={s.legend}>
        <div style={s.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#6fa3e8', flexShrink: 0 }} />
          <span style={s.legendName}>{t('sched_station_assigned')}</span>
        </div>
        <div style={s.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e3a', flexShrink: 0 }} />
          <span style={s.legendName}>{t('sched_unassigned')}</span>
        </div>
      </div>
    </div>
  );
}

// ── Station day view ──────────────────────────────────────────────────────────

function StationView({ date }) {
  const { byId: typesById } = useAppointmentTypes();
  const { t } = useLanguage();
  const hourPx = useHourPx();
  const gridH  = (DAY_END - DAY_START) * hourPx;
  const dateStr = toISO(date);
  const [entries,     setEntries]     = useState([]);
  const [allStations, setAllStations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshKey,  setRefreshKey]  = useState(0);
  const actions = useBookingActions(() => {
    invalidatePrefix('schedule:');
    setRefreshKey(k => k + 1);
  });

  useEffect(() => {
    function handler() { invalidatePrefix('schedule:'); setRefreshKey(k => k + 1); }
    window.addEventListener('booking-created', handler);
    return () => window.removeEventListener('booking-created', handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    const key = `schedule:${dateStr}`;
    const cached = getCached(key);
    if (cached) { setEntries(cached); }
    Promise.all([
      getStudioSchedule(dateStr).then(d => d.entries ?? []),
      getStations().then(d => (d.stations ?? []).filter(s => s.is_active !== false)),
    ])
      .then(([e, st]) => { setCached(key, e); setEntries(e); setAllStations(st); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateStr, refreshKey]); // eslint-disable-line

  useEffect(() => { actions.closeDetail(); }, [dateStr]); // eslint-disable-line

  const unassigned = entries.filter(e => !e.stationId);
  const byStation  = {};
  for (const e of entries) {
    if (!e.stationId) continue;
    if (!byStation[e.stationId]) byStation[e.stationId] = [];
    byStation[e.stationId].push(e);
  }

  // All stations always visible; append unassigned col if needed
  const cols = [
    ...allStations.map(s => ({ id: s.id, name: s.name })),
    ...(unassigned.length > 0 ? [{ id: '__unassigned__', name: t('sched_unassigned') }] : []),
  ];

  if (loading) return <p style={s.msg}>{t('loading')}</p>;
  if (!cols.length) return <p style={s.msg}>{t('sched_no_stations')}</p>;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="studio-calendar-scroll" style={s.calWrap}>
      <div style={{ ...s.grid, gridTemplateColumns: `52px repeat(${cols.length}, minmax(160px, 1fr))` }}>
        <div className="studio-calendar-column-heading" style={s.cornerCell} />

        {cols.map(col => (
          <div key={col.id} className="studio-calendar-column-heading" style={s.artistHeader}>
            <span style={s.artistName}>{col.name}</span>
          </div>
        ))}

        <div style={{ ...s.gutterCol, height: gridH }}>
          {HOURS.map(h => (
            <div key={h} style={{ ...s.hourLabel, top: (h - DAY_START) * hourPx }}>
              {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h-12}pm`}
            </div>
          ))}
        </div>

        {cols.map(col => {
          const bookings = col.id === '__unassigned__' ? unassigned : (byStation[col.id] ?? []);
          return (
            <div key={col.id} style={{ ...s.dayCol, height: gridH }}>
              {HOURS.map(h => <div key={h} style={{ ...s.gridLine, top: (h - DAY_START) * hourPx }} />)}
              {bookings.map(b => {
                const startMin = minutesFromMidnight(b.chosenTime);
                const durMin   = b.durationMins ?? 60;
                const top      = (startMin - DAY_START * 60) * (hourPx / 60);
                const height   = Math.max(durMin * (hourPx / 60), 24);
                if (top < 0 || top > gridH) return null;
                const isSelected = actions.selectedEntry?.bookingId === b.bookingId;
                const ss = entryStyle(b, typesById);
                const unconfirmed = b.status === 'requires_confirmation' || b.status === 'awaiting_payment';
                const blockBorder = unconfirmed ? 'rgba(255,255,255,0.18)' : ss.border;
                const blockBg     = unconfirmed ? 'rgba(255,255,255,0.04)' : ss.bg;
                const nameColor   = unconfirmed ? 'rgba(255,255,255,0.4)'  : 'var(--text-dim)';
                return (
                  <div
                    key={b.bookingId}
                    data-booking-id={b.bookingId}
                    onClick={() => actions.openDetail(b)}
                    style={{
                      ...s.block, top, height, left: 4, right: 4, width: undefined,
                      background: blockBg,
                      border: `1px ${unconfirmed ? 'dashed' : 'solid'} ${blockBorder}55`,
                      borderLeft: `3px ${unconfirmed ? 'dashed' : 'solid'} ${blockBorder}`,
                      cursor: 'pointer',
                      ...(isSelected ? s.blockSelected : {}),
                    }}
                  >
                    <span style={{ ...s.blockClient, color: nameColor }}>{b.clientName}</span>
                    {height >= 28 && ss.tag && !unconfirmed && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: ss.tagColor, lineHeight: 1, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss.tag}</span>
                    )}
                    {height >= 44 && b.artistName && <span style={s.blockMeta}>{b.artistName}</span>}
                    {height >= 56 && durMin && <span style={s.blockMeta}>{fmtDuration(durMin)}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
    </div>

    <BookingOverlays actions={actions} />
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

const LANG_LOCALE = { en: 'en-AU', 'zh-Hans': 'zh-CN', ko: 'ko-KR' };

export default function SchedulePage() {
  const { t, lang } = useLanguage();
  const locale = LANG_LOCALE[lang] ?? 'en-AU';
  const [view,      setView]      = useState('week');  // 'week' | 'day' (month view hidden for now)
  const [showAll, setShowAll] = useState(false);
  // The schedule always groups by artist. Station views (StationView, StationMonthView) are kept but not shown.
  const lens = 'artist';
  const [monthStart, setMonthStart] = useState(() => getMonthStart(new Date()));
  const [dayDate,    setDayDate]    = useState(() => new Date());

  // The sidebar calendar opens a day here, from another page (?date=) or this one (event).
  useEffect(() => {
    function open(date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return;
      const day = new Date(`${date}T00:00:00`);
      setDayDate(day);
      setMonthStart(getMonthStart(day));
      setView(current => (current === 'month' ? 'day' : current));
    }
    open(new URLSearchParams(window.location.search).get('date'));
    const onGo = event => open(event.detail?.date);
    window.addEventListener(SCHEDULE_GO_TO_DATE, onGo);
    return () => window.removeEventListener(SCHEDULE_GO_TO_DATE, onGo);
  }, []);

  const today          = new Date();

  function goToDayView(day) {
    setDayDate(day);
    setView('day');
  }

  const monthLabel = monthStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const dayLabel   = dayDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  // Header title: the full period, with the year.
  const headerLabel = (() => {
    if (view === 'month') return monthLabel;
    if (view === 'day') return dayDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const start = getMonday(dayDate), end = addDays(start, 6);
    const f = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    return f.formatRange ? f.formatRange(start, end) : `${f.format(start)} – ${f.format(end)}`;
  })();
  const weekLabel = weekRangeLabel(dayDate, locale);
  const period = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day';
  const periodLabel = view === 'month' ? monthLabel : view === 'week' ? weekLabel : dayLabel;

  function changeView(nextView) {
    if (view === 'month' && nextView !== 'month' && !isSameMonth(dayDate, monthStart)) setDayDate(monthStart);
    if (nextView === 'month' && view !== 'month') setMonthStart(getMonthStart(dayDate));
    setView(nextView);
  }
  function navigate(offset) {
    if (view === 'month') setMonthStart(date => getMonthStart(new Date(date.getFullYear(), date.getMonth() + offset, 1)));
    else setDayDate(date => addDays(date, offset * (view === 'week' ? 7 : 1)));
  }
  // Today always means today's Day view, whichever view you're in.
  function goToday() { setDayDate(new Date()); setMonthStart(getMonthStart(new Date())); setView('day'); }
  const showingToday = view === 'day' && toISO(dayDate) === toISO(today);

  // Keep the sidebar calendar on the period shown here.
  useEffect(() => {
    const detail = view === 'month' ? { date: toISO(monthStart), month: true } : { date: toISO(dayDate) };
    window.dispatchEvent(new CustomEvent(SCHEDULE_SHOWN_DATE, { detail }));
  }, [view, monthStart, dayDate]);


  return (
    <ScheduleScrollFrame style={s.page} resetKey={`${view}:${lens}:${toISO(view === 'month' ? monthStart : dayDate)}`}>
      <ScheduleControls>
      <div className="studio-calendar-toolbar" role="toolbar" aria-label="Calendar controls">
        <button type="button" aria-label="Open studio navigation" onClick={() => window.dispatchEvent(new Event('vanta:open-navigation'))}>☰</button>
        <select aria-label="Calendar view" value={`${view}:${lens}${view === 'day' && lens === 'artist' && showAll ? ':all' : ''}`} onChange={event => {
          const [nextView, nextLens, all] = event.target.value.split(':');
          changeView(nextView); setShowAll(all === 'all');
        }}>
          <option value="day:artist">{t('sched_day')} · {t('bdp_artist')}</option>
          <option value="day:artist:all">{t('sched_day')} · {t('sched_all_artists')}</option>
          <option value="week:artist">{t('sched_week')} · {t('bdp_artist')}</option>
        </select>
        {view === 'week' && <div className="studio-calendar-toolbar-slot" />}
        <button type="button" aria-label={`Previous ${period}`} onClick={() => navigate(-1)}>←</button>
        <span className="studio-calendar-toolbar-date" aria-live="polite">{view === 'day' ? dayDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) : periodLabel}</span>
        <button type="button" aria-label={`Next ${period}`} onClick={() => navigate(1)}>→</button>
        <button type="button" onClick={goToday}>{t('today')}</button>
        <button type="button" className="studio-calendar-add" aria-label={t('new_appointment')} title={t('new_appointment')} onClick={() => window.dispatchEvent(new CustomEvent('vanta:open-new-appointment', { detail: { bookingType: 'walkin' } }))}>＋</button>
      </div>
      <div className="studio-feature-header" style={s.header}>
        <h1 className="sr-only">{t('nav_schedule')}</h1>
        <div className="studio-schedule-toggles" style={s.tabs} role="group" aria-label="Calendar view">
          {/* Month view is hidden for now; the sidebar calendar covers the month. */}
          {['week', 'day'].map(v => (
            <button key={v} aria-pressed={view === v} onClick={() => changeView(v)} style={{ ...s.tab, ...(view === v ? s.tabActive : {}) }}>
              {t(`sched_${v}`)}
            </button>
          ))}
        </div>

        <div className="studio-schedule-date-nav" style={s.nav}>
          <div className="studio-schedule-filter-slot" style={{ display: 'contents' }} />
          <button onClick={goToday} disabled={showingToday} style={{ ...s.todayBtn, ...(showingToday ? s.todayBtnOff : {}) }} title={showingToday ? 'Showing today' : 'Go to today'}>{t('today')}</button>
          <button aria-label={`Previous ${period}`} title={`Previous ${period}`} onClick={() => navigate(-1)} style={s.navBtn}><ChevronIcon dir="left" /></button>
          <span className="studio-schedule-date-label" style={s.navLabel} aria-live="polite">{headerLabel}</span>
          <button aria-label={`Next ${period}`} title={`Next ${period}`} onClick={() => navigate(1)} style={s.navBtn}><ChevronIcon dir="right" /></button>
        </div>
      </div>

      </ScheduleControls>
      {view === 'month' && lens === 'artist'  && <MonthView        monthStart={monthStart} onDayClick={goToDayView} />}
      {view === 'week' && <WeekView date={dayDate} lens={lens} onDayClick={goToDayView} />}
      {view === 'day'   && lens === 'artist'  && <DayView          date={dayDate} showAll={showAll} setShowAll={setShowAll} />}
    </ScheduleScrollFrame>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    padding: '0 2rem',
    minHeight: 60,
    borderBottom: '1px solid var(--border-faint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  tabs: { display: 'flex', alignItems: 'stretch', gap: '1.5rem', alignSelf: 'stretch' },
  tab: {
    position: 'relative',
    padding: '0 0.1rem',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1, // sit the underline on the header's bottom border
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabActive: { color: 'var(--text)', fontWeight: 700, borderBottom: '2px solid var(--accent)' },
  nav: { display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 },
  navBtn: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    color: 'var(--text-dim)',
    cursor: 'pointer',
  },
  navLabel: {
    minWidth: 240,
    textAlign: 'center',
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  todayBtn: {
    marginRight: '0.5rem',
    background: 'transparent',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: '0.35rem 0.8rem',
    cursor: 'pointer',
  },
  todayBtnOff: { color: 'var(--text-muted)', borderColor: 'var(--border)', opacity: 1, cursor: 'default' },
  msg: { padding: '2rem', fontSize: '0.875rem', color: 'var(--text-faint)' },

  // Day filter bar
  calWrap: { flex: 1, overflow: 'auto' },

  // ── Month view ─────────────────────────────────────────────────────────────
  monthWeekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    minWidth: 700,
    borderBottom: '1px solid var(--border-faint)',
  },
  monthWeekday: {
    padding: '0.6rem 0.6rem',
    fontSize: '0.8rem', fontWeight: 700,
    letterSpacing: '0.02em',
    color: 'var(--text-dim)',
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
  legendName: { fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 },

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

// Month view key: the studio's appointment types and their colours.
function MonthTypeLegend() {
  const { active } = useAppointmentTypes();
  if (!active.length) return null;
  return (
    <div style={s.legend}>
      {[...active, { id: 'none', name: 'No type', color: UNTYPED_COLOR }].map(type => (
        <div key={type.id} style={s.legendItem}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: type.color, flexShrink: 0 }} />
          <span style={s.legendName}>{type.name}</span>
        </div>
      ))}
    </div>
  );
}
