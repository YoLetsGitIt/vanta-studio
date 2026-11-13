'use client';

// A booking panel that can open over any dashboard page, e.g. from the sidebar's
// "Needs action" list. Open it with:
//   window.dispatchEvent(new CustomEvent(OPEN_BOOKING_EVENT, { detail: { id, summary } }))
// After a change it tells the page and the sidebar to reload.
import { useEffect, useState } from 'react';
import BookingDetailPanel from '@/components/BookingDetailPanel';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import RejectBookingModal from '@/components/RejectBookingModal';
import SendSelectionLinkModal from '@/components/SendSelectionLinkModal';
import { getStudioArtists, getStripeStatus, getCancelPreview } from '@/lib/api';
import { fetchBooking, forgetBookings, loadBooking, startBookingPrefetch } from '@/lib/bookingCache';
import { bookingActions } from '@/lib/bookingActions';
import { canCollectDeposits } from '@/lib/deposits';
import { showError, showFeedback } from '@/lib/feedback';
import { useLanguage } from '@/lib/i18n';

export const OPEN_BOOKING_EVENT = 'vanta:open-booking';
export const ATTENTION_CHANGED_EVENT = 'vanta:attention-changed';

export function openBookingPanel(id, summary = null) {
  window.dispatchEvent(new CustomEvent(OPEN_BOOKING_EVENT, { detail: { id, summary } }));
}

export default function GlobalBookingPanel() {
  const { t } = useLanguage();
  const [booking, setBooking] = useState(null); // summary first, then the full booking
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [artists, setArtists] = useState([]);
  const [depositsReady, setDepositsReady] = useState(false);
  const [modal, setModal] = useState(null); // 'complete' | 'noShow' | 'reject' | 'cancel' | 'sendLink'
  // What cancelling does to the client's deposit, shown in the cancel dialog.
  const [cancelNotice, setCancelNotice] = useState(null);
  useEffect(() => {
    if (modal !== 'cancel' || !booking?.id) { setCancelNotice(null); return; }
    let live = true;
    getCancelPreview(booking.id).then(p => {
      if (!live || p.deposit !== 'refund') return;
      const amount = `$${Number(p.refund_amount).toFixed(2).replace(/\.00$/, '')}`;
      setCancelNotice(p.paid_through_vanta
        ? `The client will be refunded everything they paid (${amount}, including the Vanta booking fee) automatically.`
        : `The client paid their ${amount} deposit to you directly, so you’ll need to send it back. It will be listed under Refunds to send.`);
    }).catch(() => {});
    return () => { live = false; };
  }, [modal, booking?.id]);

  useEffect(() => {
    startBookingPrefetch();
    let cancel = () => {};
    function open(event) {
      const { id, summary } = event.detail ?? {};
      if (!id) return;
      cancel();
      setModal(null);
      setBooking(summary ? { ...summary, id } : { id });
      setLoading(true);
      cancel = loadBooking(id, {
        onBooking: (full, { cached }) => { setBooking(full); if (cached) setLoading(false); },
        onError: showError,
        onDone: () => setLoading(false),
      });
    }
    window.addEventListener(OPEN_BOOKING_EVENT, open);
    getStudioArtists('approved').then(d => setArtists(d.artists ?? [])).catch(() => {});
    getStripeStatus().then(s => setDepositsReady(canCollectDeposits(s))).catch(() => {});
    return () => { cancel(); window.removeEventListener(OPEN_BOOKING_EVENT, open); };
  }, []);

  // Deposit buttons inside the panel report changes with these events.
  useEffect(() => {
    const changed = () => refresh(false);
    window.addEventListener('booking-deposit-cancelled', changed);
    window.addEventListener('booking-deposit-received', changed);
    return () => {
      window.removeEventListener('booking-deposit-cancelled', changed);
      window.removeEventListener('booking-deposit-received', changed);
    };
  });

  function notifyChanged() {
    window.dispatchEvent(new Event('booking-created')); // schedule and list views reload on this
    window.dispatchEvent(new Event(ATTENTION_CHANGED_EVENT));
  }

  async function refresh(close) {
    forgetBookings();
    notifyChanged();
    if (close) { setBooking(null); return; }
    if (booking?.id) fetchBooking(booking.id).then(setBooking).catch(() => {});
  }

  async function act(action, message, close = true) {
    setSaving(true);
    try {
      await action();
      setModal(null);
      if (message) showFeedback(message, 'success');
      await refresh(close);
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  }

  if (!booking) return null;
  const id = booking.id;
  const full = loading ? null : booking;

  return (
    <div className="studio-global-panel" style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0 }} className="studio-global-panel-inner">
        <BookingDetailPanel
          booking={full}
          entry={{
            bookingId: id,
            clientName: booking.requester_name,
            artistId: booking.artist_id,
            artistName: booking.artist_name,
            sessionType: booking.session_type,
            placement: booking.body_location,
            chosenTime: booking.chosen_time,
            estimatedQuote: booking.estimated_quote,
            status: booking.status,
          }}
          loading={loading}
          actionLoading={saving}
          onClose={() => setBooking(null)}
          onAccept={full ? stationId => act(() => bookingActions.accept(id, stationId), 'Booking accepted') : undefined}
          onConfirm={full ? () => act(() => bookingActions.confirm(id), 'Booking confirmed') : undefined}
          onReject={full ? () => setModal('reject') : undefined}
          onCancel={full ? () => setModal('cancel') : undefined}
          onComplete={full ? () => setModal('complete') : undefined}
          onNoShow={full ? () => setModal('noShow') : undefined}
          onSendLink={full ? () => setModal('sendLink') : undefined}
          bookTimeArtists={artists}
          depositsReady={depositsReady}
          onBooked={() => refresh(true)}
        />
      </div>

      <div style={{ pointerEvents: 'auto' }}>
        {modal === 'complete' && (
          <CompleteBookingModal
            outcome="completed"
            initialPrice={booking.estimated_quote ?? booking.final_price}
            depositAmount={booking.deposit_amount ?? null}
            saving={saving}
            onConfirm={(finalPrice, paymentSplits, createFollowUp) => act(() => bookingActions.complete(id, { finalPrice, paymentSplits, createFollowUp }), createFollowUp ? 'Booking completed · follow-up session created' : 'Booking marked as complete')}
            onCancel={() => setModal(null)}
          />
        )}
        {modal === 'noShow' && (
          <CompleteBookingModal outcome="no_show" saving={saving} onConfirm={() => act(() => bookingActions.noShow(id), 'Booking marked as no show')} onCancel={() => setModal(null)} />
        )}
        {modal === 'reject' && (
          <RejectBookingModal saving={saving} onConfirm={reason => act(() => bookingActions.reject(id, reason), 'Booking rejected')} onCancel={() => setModal(null)} />
        )}
        {modal === 'cancel' && (
          <RejectBookingModal
            title={t('cancel_booking_title')}
            placeholder="Reason for cancellation…"
            confirmLabel={t('cancel_booking_confirm')}
            notice={cancelNotice}
            saving={saving}
            onConfirm={reason => act(() => bookingActions.cancel(id, reason), 'Booking cancelled')}
            onCancel={() => setModal(null)}
          />
        )}
        {modal === 'sendLink' && full && (
          <SendSelectionLinkModal booking={full} artists={artists} stripeConnected={depositsReady} onClose={() => setModal(null)} onSent={() => { setModal(null); refresh(false); }} />
        )}
      </div>
    </div>
  );
}
