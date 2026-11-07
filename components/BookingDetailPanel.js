'use client';

import CancelDepositButton from '@/components/CancelDepositButton';
import MarkDepositReceivedButton, { depositMethodLabel } from '@/components/MarkDepositReceivedButton';
import BookTimeModal from '@/components/BookTimeModal';
import OfferTimesModal from '@/components/OfferTimesModal';
import { useBookingManagement } from '@/lib/bookingManagement';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setBookingAppointmentType, getStations, getStudioArtists, getClientConsents, getNotes, addNote, deleteNote, getBookingConsentSubmissions, getClientConsentSubmissions, getStudioClients, getStudioClient, generateConsentLink, getStudioBookingPayment, getDepositReceipt, getDepositStatus, getOfferedTimes, listConsentTemplates } from '@/lib/api';
import { useStationAvailability } from '@/lib/useStationAvailability';
import { statusColors, statusLabel, capitalise as cap } from '@/lib/status';
import { formatDob as fmtDob, hasArtist, ageFromDob } from '@/lib/format';
import { getCached, setCached } from '@/lib/cache';
import { useLanguage } from '@/lib/i18n';
import { showError, showFeedback } from '@/lib/feedback';
import { normalizeBookingSource } from '@/lib/bookingType';
import { useAppointmentTypes, formatTypeLength } from '@/lib/appointmentTypes';
import { forgetBookings } from '@/lib/bookingCache';
import Button, { IconButton } from '@/components/ui/Button';
import BookingSMS from '@/components/BookingSMS';
import MarketingConsent from '@/components/MarketingConsent';
import { Pill, Section, Fact, SkeletonBar, DetailSkeleton, PanelBackdrop, detailStyles } from '@/components/ui/DetailParts';
import ConsentSubmissionCard from '@/components/ConsentSubmissionCard';
import { describeAvailability } from '@/lib/availability';
import panelLayout from '@/components/ui/DetailPanelLayout.module.css';

const PAYMENT_LABELS = { cash: 'Cash', card: 'Card / POS', bank_transfer: 'Bank Transfer' };

// What the email provider says happened to the offer email.
const OFFER_EMAIL_STATUS = {
  queued: { label: 'Sending' },
  scheduled: { label: 'Sending' },
  sent: { label: 'Sent, not yet delivered' },
  delivered: { label: 'Delivered' },
  opened: { label: 'Opened' },
  clicked: { label: 'Opened' },
  delivery_delayed: { label: 'Delivery delayed', problem: true },
  bounced: { label: 'Bounced: check the email address', problem: true },
  complained: { label: 'Marked as spam by the client', problem: true },
  suppressed: { label: 'Not delivered: this address previously bounced or reported spam', problem: true },
  failed: { label: 'Failed to send', problem: true },
};

// "Today", "Tomorrow", "In 3 days", "Yesterday", "5 days ago" (calendar days).
function relativeDay(date) {
  const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(date) - day(new Date())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 60) return `In ${diff} days`;
  if (diff < -1 && diff > -60) return `${-diff} days ago`;
  return null;
}

// The studio's artists (any status, so past artists still show), fetched once per visit
// for their profile photos.
let studioArtistsRequest = null;
function loadStudioArtists() {
  if (!studioArtistsRequest) {
    studioArtistsRequest = getStudioArtists().then(d => d.artists ?? []).catch(() => { studioArtistsRequest = null; return []; });
  }
  return studioArtistsRequest;
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

// "28 Oct, 2:23 pm", with the year only when it isn't this year.
function shortWhen(date) {
  const thisYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) });
  return `${day}, ${date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
}

function parseStyles(raw) {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BookingDetailPanel({
  booking,      // full API booking object (snake_case) — may be null while loading
  entry,        // optional: schedule grid entry (camelCase) for immediate display while booking loads
  allBookings,  // optional: all loaded bookings for client history section
  loading,      // optional: booking is still fetching
  actionLoading,
  onClose,
  onAccept,     // optional fn(stationId)
  onReject,     // optional fn()
  onCancel,     // optional fn()
  onComplete,   // optional fn()
  onNoShow,     // optional fn()
  onSendLink,   // optional fn() — for pending bookings
  onConfirm,    // optional fn() — for requires_confirmation bookings
  onReassign,   // optional fn() — for requires_confirmation bookings
  onReschedule, // optional fn() — edit booking time
  bookTimeArtists, // optional: studio artists — shows "Book a time" on requests
  depositsReady = false, // the studio can collect deposits (Stripe, PayID or bank)
  onBooked,     // optional fn(bookingId) — after "Book a time"
}) {
  const router = useRouter();
  const { t } = useLanguage();

  // ── Station picker state ───────────────────────────────────────────────────
  const [stationStep,  setStationStep]  = useState(false);
  const [stationError, setStationError] = useState('');
  const [bookTimeOpen, setBookTimeOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offer, setOffer] = useState(null); // { booking, data } — times the studio offered the client
  const bookingManagement = useBookingManagement();

  // ── Payment recording status ───────────────────────────────────────────────
  const [paymentSplits, setPaymentSplits] = useState(null); // null = not loaded

  // ── Studio notes state (notes table, entity_type='booking') ────────────────
  const [studioNotes, setStudioNotes] = useState(null); // null = loading
  const [noteInput,   setNoteInput]   = useState('');
  const [noteAdding,  setNoteAdding]  = useState(false);

  // ── Consent state ──────────────────────────────────────────────────────────
  const [consent,              setConsent]              = useState(null);
  const [consentVersion,       setConsentVersion]       = useState('1');
  const [consentLoading,       setConsentLoading]       = useState(false);
  const [linkGeneratingId,     setLinkGeneratingId]     = useState(null);
  const [linkSentId,           setLinkSentId]           = useState(null);
  const [consentTemplates,     setConsentTemplates]     = useState([]);

  // ── Contact-book profile (allergies / preferences / pain tolerance) ─────────
  const [clientProfile, setClientProfile] = useState(null);
  const [marketingOverride, setMarketingOverride] = useState(null);
  const [stationName,   setStationName]   = useState(null);
  const [studioArtists, setStudioArtists] = useState(null);
  // The studio's appointment type for this booking (its colour on the schedule).
  const { active: activeTypes, byId: typesById } = useAppointmentTypes();
  const [typeOverride, setTypeOverride] = useState(null); // { booking, id }
  const [typeSaving, setTypeSaving] = useState(false);
  const [artistPhotoFailed, setArtistPhotoFailed] = useState(false);

  // ── Consent submissions (new template system) ──────────────────────────────
  const [consentSubmissions,  setConsentSubmissions]  = useState([]);
  const [showOlderForms, setShowOlderForms] = useState(false);
  const [submissionsLoading,  setSubmissionsLoading]  = useState(false);

  // ── Normalise fields from booking (priority) with entry as fallback ────────
  const [cancelledDepositId, setCancelledDepositId] = useState(null);
  const depositCancelled = cancelledDepositId === (booking?.id ?? entry?.bookingId);
  // Set after "Mark deposit received" so the panel updates before the next refresh.
  const [receivedDeposit, setReceivedDeposit] = useState(null);
  const depositReceived = receivedDeposit?.id === (booking?.id ?? entry?.bookingId) ? receivedDeposit : null;
  const b           = booking ?? entry ?? {};
  const bookingId   = booking?.id     ?? entry?.bookingId;
  const clientName  = booking?.requester_name    ?? entry?.clientName    ?? '—';
  const email       = booking?.requester_email   ?? entry?.requesterEmail ?? null;
  const phone       = booking?.requester_phone   ?? entry?.phone          ?? null;
  const dob         = booking?.dob               ?? null;
  const artistId    = booking?.artist_id          ?? entry?.artistId   ?? null;
  const artistName  = booking?.artist_name        ?? entry?.artistName ?? null;
  const appointmentTypeId = typeOverride && typeOverride.booking === bookingId
    ? typeOverride.id
    : booking?.appointment_type_id ?? entry?.appointmentTypeId ?? null;
  // Artist photo: from the artists the page already has, otherwise the studio's list.
  const artistPhoto = artistId
    ? [...(bookTimeArtists ?? []), ...(studioArtists ?? [])].find(a => a.artistId === artistId || a.id === artistId)?.profileImage ?? null
    : null;
  useEffect(() => {
    if (!artistId || studioArtists || (bookTimeArtists ?? []).some(a => (a.artistId === artistId || a.id === artistId) && a.profileImage)) return;
    let live = true;
    loadStudioArtists().then(list => { if (live) setStudioArtists(list); });
    return () => { live = false; };
  }, [artistId, studioArtists, bookTimeArtists]);
  useEffect(() => { setArtistPhotoFailed(false); }, [artistPhoto]);
  const sessionType = booking?.session_type      ?? entry?.sessionType    ?? null;
  const placement   = booking?.body_location     ?? entry?.placement      ?? null;
  const sizeRaw     = booking?.size              ?? entry?.size           ?? null;
  const sizeUnit    = booking?.size_unit         ?? null;
  // Old entries store combined "10cm"; new entries store numeric size + separate size_unit.
  const size        = sizeRaw && sizeUnit && /^[\d.]+$/.test(sizeRaw) ? `${sizeRaw} ${sizeUnit}` : sizeRaw;
  const color       = booking?.color             ?? null;
  const design      = booking?.design_details    ?? entry?.designDetails  ?? null;
  const notes       = booking?.additional_notes  ?? entry?.notes          ?? null;
  const availability = describeAvailability(booking?.availability_windows);
  const earliestDate = booking?.earliest_date
    ? new Date(`${String(booking.earliest_date).slice(0, 10)}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const refImages   = booking?.reference_images  ?? [];
  const quote       = booking?.estimated_quote   ?? entry?.estimatedQuote ?? null;
  const duration    = booking?.proposed_duration_minutes ?? entry?.durationMins ?? null;
  const chosenTime  = booking?.chosen_time       ?? entry?.chosenTime     ?? null;
  const proposedTime = booking?.proposed_time_primary    ?? null;
  const rawStatus   = booking?.status ?? entry?.status ?? null;
  const status      = (depositCancelled && rawStatus === 'awaiting_payment') || (depositReceived?.status === 'confirmed') ? 'confirmed' : rawStatus;
  const depositRequired   = !depositCancelled && (booking?.deposit_required ?? false);
  const depositAmount     = depositCancelled ? null : booking?.deposit_amount ?? null;
  const depositPaidAt     = booking?.deposit_paid_at     ?? depositReceived?.at ?? null;
  const depositConfirmedAt = booking?.deposit_confirmed_at ?? depositReceived?.at ?? null;
  const depositPaid       = !!depositPaidAt || !!(entry?.depositPaid);
  const finalPrice        = booking?.final_price         ?? null;
  const paymentMethod     = booking?.payment_method      ?? null;
  const outcomeAt         = booking?.outcome_recorded_at ?? null;
  const aftercareInstructions = booking?.aftercare_instructions ?? null;
  const cancelReason      = booking?.cancellation_reason ?? null;
  const source            = booking?.source              ?? null;
  const stationId         = booking?.station_id          ?? entry?.stationId   ?? null;
  const createdAt              = booking?.created_at                   ?? entry?.createdAt ?? null;
  const updatedAt              = booking?.updated_at                   ?? null;
  const holdExpiresAt          = booking?.hold_expires_at              ?? null;
  const selectionTokenExpiresAt = booking?.selection_token_expires_at  ?? null;

  // Under the 5-status model a no-show is stored as status='completed' with
  // outcome='no_show', so "completed" visuals must exclude no-shows explicitly.
  const isNoShow      = status === 'completed' && booking?.outcome === 'no_show';
  const isCompleted   = status === 'completed';
  const showCompleted = isCompleted && !isNoShow;

  const today      = new Date().toLocaleDateString('en-CA');
  const chosenDate = chosenTime ? chosenTime.slice(0, 10) : null;
  const isFutureConfirmed = status === 'confirmed' && chosenDate && chosenDate > today;
  const canAccept         = false; // Accept removed for pending/awaiting_payment — use Send Link flow
  const canComplete       = status === 'confirmed' && chosenDate && chosenDate <= today;
  const canReject         = status === 'pending' || status === 'awaiting_payment';
  const canSendLink       = status === 'pending' || status === 'awaiting_payment';
  const canAcceptReject   = canAccept || canReject; // kept for layout gate
  const canConfirm        = status === 'requires_confirmation';
  const canReschedule     = status === 'confirmed' && chosenDate && chosenDate > today;
  // When the studio confirms booking times (Settings → Booking requests), it can book any open
  // request straight into a time, without the artist.
  const canBookTime       = bookingManagement === 'studio' && Boolean(bookTimeArtists) && ['pending', 'awaiting_payment', 'requires_confirmation'].includes(status) && !booking?.deposit_paid_at && !booking?.deposit_confirmed_at;

  // When the client gave weekly availability, the studio offers up to three times instead of
  // sending a "choose a time" link.
  const hasAvailabilityWindows = Array.isArray(booking?.availability_windows) && booking.availability_windows.length > 0;
  // A deep link can render before either the summary or full booking has loaded.
  // Two missing IDs must not count as a match for an offer or receipt.
  const currentOffer      = bookingId && offer?.booking === bookingId ? offer.data : null;
  // Also replaces an unanswered "choose a time" link (awaiting payment, no time yet).
  const canOfferTimes     = bookingManagement === 'studio' && Boolean(bookTimeArtists) && hasAvailabilityWindows
    && (status === 'pending' || (status === 'awaiting_payment' && !chosenTime));

  const displayStatus = isNoShow ? 'no_show' : status;
  const sc = statusColors(displayStatus);

  // ── Station availability (pre-fetched so the picker is instant on Accept) ──
  const apptTime = chosenTime ?? proposedTime ?? '';
  const apptDate = apptTime ? apptTime.slice(0, 10) : '';
  const { stations: availableStations, loading: stationsLoading } = useStationAvailability({
    date: apptDate,
    startTime: apptTime,
    durationMins: duration ?? 60,
    excludeBookingId: bookingId ?? '',
  });

  // ── Load payment split recordings for completed bookings ─────────────────
  useEffect(() => {
    if (!bookingId || !isCompleted) { setPaymentSplits(null); return; }
    getStudioBookingPayment(bookingId)
      .then(d => setPaymentSplits(d.splits ?? []))
      .catch(() => setPaymentSplits([]));
  }, [bookingId, isCompleted]);

  // ── Times the studio offered, while the client chooses ─────────────────────
  useEffect(() => {
    // Offered times wait in Awaiting payment until the client picks one.
    const waiting = status === 'pending' || (status === 'awaiting_payment' && !chosenTime);
    if (!bookingId || !waiting || bookingManagement !== 'studio') { setOffer(null); return; }
    let live = true;
    getOfferedTimes(bookingId)
      .then(data => { if (live) setOffer({ booking: bookingId, data }); })
      .catch(() => { if (live) setOffer(null); });
    return () => { live = false; };
  }, [bookingId, status, chosenTime, bookingManagement]);

  // ── How a manually recorded deposit was paid (PayID, bank transfer, cash) ──
  const [depositReceipt, setDepositReceipt] = useState(null);
  useEffect(() => {
    if (!bookingId || !depositPaidAt) { setDepositReceipt(null); return; }
    if (depositReceived?.method) { setDepositReceipt({ booking: bookingId, method: depositReceived.method }); return; }
    let live = true;
    getDepositReceipt(bookingId)
      .then(r => { if (live) setDepositReceipt({ booking: bookingId, method: r?.method ?? null }); })
      .catch(() => { if (live) setDepositReceipt(null); });
    return () => { live = false; };
  }, [bookingId, depositPaidAt, depositReceived?.method]);
  const depositPaidVia = bookingId && depositReceipt?.booking === bookingId ? depositMethodLabel(depositReceipt.method) : null;
  // Paid with no PayID / bank / cash record means it went through Stripe, which adds a card fee.
  const paidByStripe = Boolean(depositPaidAt && depositReceipt?.booking === bookingId && !depositReceipt.method);

  // The client says they paid by PayID / bank transfer: the studio checks it arrived.
  const [depositClaim, setDepositClaim] = useState(null);
  useEffect(() => {
    if (!bookingId || !depositRequired || depositConfirmedAt) { setDepositClaim(null); return; }
    let live = true;
    getDepositStatus(bookingId)
      .then(d => { if (live) setDepositClaim(d.client_claim ? { booking: bookingId, ...d.client_claim } : null); })
      .catch(() => { if (live) setDepositClaim(null); });
    return () => { live = false; };
  }, [bookingId, depositRequired, depositConfirmedAt]);
  const clientSaysPaid = depositClaim?.booking === bookingId && !depositConfirmedAt ? depositClaim : null;

  // ── Load studio notes for this booking ─────────────────────────────────────
  useEffect(() => {
    if (!bookingId) { setStudioNotes([]); return; }
    setStudioNotes(null);
    getNotes('booking', bookingId)
      .then(d => setStudioNotes(d.notes ?? []))
      .catch(() => setStudioNotes([]));
  }, [bookingId]);

  async function handleAddNote() {
    if (!noteInput.trim() || !bookingId) return;
    setNoteAdding(true);
    try {
      const d = await addNote('booking', bookingId, noteInput.trim());
      setStudioNotes(prev => [d.note, ...(prev ?? [])]);
      setNoteInput('');
    } catch (error) { showError(error); }
    finally { setNoteAdding(false); }
  }

  async function handleDeleteNote(id) {
    try {
      await deleteNote(id);
      setStudioNotes(prev => (prev ?? []).filter(n => n.id !== id));
    } catch (error) { showError(error); }
  }

  // ── Load consent templates (once) ─────────────────────────────────────────
  useEffect(() => {
    const cached = getCached('consent:templates');
    if (cached) { setConsentTemplates(cached); return; }
    listConsentTemplates().then(d => { const list = d.templates ?? []; setCached('consent:templates', list); setConsentTemplates(list); }).catch(() => {});
  }, []);

  // ── Consent ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setConsent(null);
    setConsentVersion('1');
    if (!email) return;
    setConsentLoading(true);
    getClientConsents([email])
      .then(data => {
        setConsent((data.consents ?? {})[email] ?? null);
        setConsentVersion(data.current_version ?? '1');
      })
      .catch(() => {})
      .finally(() => setConsentLoading(false));
  }, [email]);

  const consentStatus = !consent ? 'none'
    : consent.consent_version === consentVersion ? 'current' : 'outdated';
  const consentLabel = { current: t('clients_consented'), outdated: t('clients_outdated'), none: t('clients_no_consent') }[consentStatus];

  // Match this booking's client against the contact book for their saved profile.
  useEffect(() => {
    setClientProfile(null);
    setMarketingOverride(null);
    if (!email && !phone) return;
    const emailKey = email ? email.toLowerCase() : null;
    const phoneKey = phone ? phone.replace(/[^0-9+]/g, '') : null;
    const apply = (clients) => {
      const match = (clients ?? []).find(c =>
        (emailKey && c.email && c.email.toLowerCase() === emailKey) ||
        (phoneKey && c.phone && c.phone.replace(/[^0-9+]/g, '') === phoneKey)
      );
      setClientProfile(match ?? null);
    };
    const cached = getCached('clients:contacts');
    if (cached) { apply(cached); return; }
    getStudioClients()
      .then(d => { const c = d.clients ?? []; setCached('clients:contacts', c); apply(c); })
      .catch(() => {});
  }, [email, phone]);

  // ── Resolve assigned station name from its id ──────────────────────────────
  useEffect(() => {
    setStationName(entry?.stationName ?? null);
    if (!stationId) return;
    if (entry?.stationName) return;
    const apply = (stations) => {
      const st = (stations ?? []).find(s => s.id === stationId);
      if (st) setStationName(st.name);
    };
    const cached = getCached('stations:all');
    if (cached) { apply(cached); return; }
    getStations()
      .then(d => { const s = d.stations ?? []; setCached('stations:all', s); apply(s); })
      .catch(() => {});
  }, [stationId, entry?.stationName]);

  // Date of birth from the booking, or else from the client's saved profile.
  const clientDob         = dob || clientProfile?.dob || null;
  const clientAge         = ageFromDob(clientDob ? String(clientDob).slice(0, 10) : null);
  const designPreferences = parseStyles(clientProfile?.design_preferences);
  const allergies         = clientProfile?.allergies || null;
  const painTolerance     = clientProfile?.pain_tolerance || null;

  async function changeAppointmentType(typeId) {
    if (!bookingId) return;
    const previous = appointmentTypeId;
    setTypeOverride({ booking: bookingId, id: typeId });
    setTypeSaving(true);
    try {
      await setBookingAppointmentType(bookingId, typeId);
      forgetBookings();
      window.dispatchEvent(new Event('booking-created')); // the schedule recolours
    } catch (error) {
      setTypeOverride({ booking: bookingId, id: previous });
      showError(error);
    } finally { setTypeSaving(false); }
  }

  async function handleSendConsentLink(templateId) {
    if (!email) return;
    setLinkGeneratingId(templateId);
    try {
      // '__inline__' is the sentinel for the compact booking-panel send button;
      // resolve to the first template if one exists, otherwise send without.
      const actualId = templateId === '__inline__'
        ? (consentTemplates[0]?.id || undefined)
        : (templateId || undefined);
      await generateConsentLink(email, actualId);
      setLinkSentId(templateId);
      setTimeout(() => setLinkSentId(null), 3000);
    } catch (e) { showError(e); }
    finally { setLinkGeneratingId(null); }
  }

  // ── Load consent submissions ───────────────────────────────────────────────
  // Forms signed for this booking; if none, the forms this client signed with the studio.
  // Only the newest is loaded at first; the rest when "Show earlier forms" is pressed.
  // (A backend without `limit` sends every form and no total: then nothing more to load.)
  const [consentMore, setConsentMore] = useState(null); // { total, source, complete, loading }
  useEffect(() => {
    let live = true;
    setConsentSubmissions([]);
    setConsentMore(null);
    setShowOlderForms(false);
    if (!bookingId) return;
    setSubmissionsLoading(true);
    const page = d => ({ subs: d.submissions ?? [], total: d.total ?? (d.submissions ?? []).length, complete: d.total == null });
    // Both at once rather than one after the other.
    const clientForms = email ? getClientConsentSubmissions(email, 1).then(page).catch(() => null) : Promise.resolve(null);
    getBookingConsentSubmissions(bookingId, 1)
      .then(async d => {
        let found = { ...page(d), source: 'booking' };
        if (!found.subs.length) found = { ...((await clientForms) ?? { subs: [], total: 0, complete: true }), source: 'client' };
        if (!live) return;
        setConsentSubmissions(found.subs);
        setConsentMore({ total: found.total, source: found.source, complete: found.complete || found.subs.length >= found.total, loading: false });
      })
      .catch(() => {})
      .finally(() => { if (live) setSubmissionsLoading(false); });
    return () => { live = false; };
  }, [bookingId, email]);

  async function toggleOlderForms() {
    if (showOlderForms || consentMore?.complete) { setShowOlderForms(v => !v); return; }
    setConsentMore(m => ({ ...m, loading: true }));
    try {
      const d = consentMore.source === 'booking' ? await getBookingConsentSubmissions(bookingId) : await getClientConsentSubmissions(email);
      setConsentSubmissions(d.submissions ?? []);
      setConsentMore(m => ({ ...m, complete: true, loading: false }));
      setShowOlderForms(true);
    } catch (error) {
      setConsentMore(m => ({ ...m, loading: false }));
      showError(error);
    }
  }

  // ── Station picker ─────────────────────────────────────────────────────────
  function handleAcceptClick() {
    if (!onAccept) return;
    if (!apptDate) { setStationError('This booking has no requested time to accept.'); return; }
    if (stationsLoading) return;
    if (!availableStations || availableStations.length === 0) {
      setStationError('No stations available at that time.');
      return;
    }
    setStationError('');
    setStationStep(true);
  }

  // ── Client history ─────────────────────────────────────────────────────────
  // The client's own booking list from the contact book, wherever the panel is opened;
  // else whatever bookings the page has loaded.
  // Only the most recent few are loaded at first (one extra, as this booking is usually
  // among them); "Show all" loads the rest.
  const HISTORY_SHOWN = 5;
  const [historyLoaded, setHistoryLoaded] = useState(null); // { key, bookings, total, complete }
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyLoadingAll, setHistoryLoadingAll] = useState(false);
  useEffect(() => { setShowAllHistory(false); }, [bookingId]);
  useEffect(() => {
    const key = clientProfile?.id;
    if (!key) return;
    let live = true;
    getStudioClient(key, { bookingsLimit: HISTORY_SHOWN + 1 })
      .then(d => {
        if (!live) return;
        const list = d.bookings ?? [];
        const total = d.bookings_total ?? list.length;
        setHistoryLoaded({ key, bookings: list, total, complete: list.length >= total });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [clientProfile?.id]);
  const historyFromProfile = historyLoaded && historyLoaded.key === clientProfile?.id ? historyLoaded : null;
  const clientHistory = (historyFromProfile ? historyFromProfile.bookings : (allBookings ?? []).filter(bk => bk.requester_email === email))
    .filter(bk => bk.id !== bookingId)
    .sort((a, b) => new Date(b.chosen_time || b.proposed_time_primary || b.created_at || 0) - new Date(a.chosen_time || a.proposed_time_primary || a.created_at || 0));
  // How many other bookings there are in all, counting ones not loaded yet. This booking
  // is the client's own, so it's in the total unless the full list shows otherwise.
  const historyTotal = historyFromProfile && !historyFromProfile.complete
    ? Math.max(clientHistory.length, historyFromProfile.total - 1)
    : clientHistory.length;

  async function toggleAllHistory() {
    if (showAllHistory || !historyFromProfile || historyFromProfile.complete) { setShowAllHistory(v => !v); return; }
    setHistoryLoadingAll(true);
    try {
      const d = await getStudioClient(historyFromProfile.key);
      const list = d.bookings ?? [];
      setHistoryLoaded({ key: historyFromProfile.key, bookings: list, total: list.length, complete: true });
      setShowAllHistory(true);
    } catch (error) { showError(error); }
    finally { setHistoryLoadingAll(false); }
  }


  // While the full booking is fetching, show only the header + a loading state —
  // keep the detail sections hidden rather than rendering them from partial data.
  if (loading) {
    return (
      <>
      <PanelBackdrop onClose={onClose} />
      <aside className={`studio-booking-detail ${panelLayout.panel}`} aria-label={`${clientName} booking details`} aria-busy="true" style={p.panel}>
        <div style={p.header}>
          <div style={p.headerText}>
            <span style={p.title}>{clientName}</span>
            <div style={p.contact}><SkeletonBar w={210} h={13} /></div>
            <div style={p.headerPills}><SkeletonBar w={92} h={26} round /><SkeletonBar w={120} h={26} round /></div>
          </div>
          <IconButton onClick={onClose} aria-label="Close booking details">✕</IconButton>
        </div>
        <BookingSkeleton label={t('loading')} />
      </aside>
      </>
    );
  }

  const offeredTimes = !chosenTime && currentOffer?.times?.length ? currentOffer.times : null;
  const heroTime = chosenTime ?? (offeredTimes ? null : proposedTime) ?? null;
  const heroCaption = chosenTime ? 'Appointment' : offeredTimes ? `Times offered · waiting for ${clientName !== '—' ? clientName.split(' ')[0] : 'the client'} to choose` : proposedTime ? 'Proposed time' : 'Time to be arranged';
  const offerDuration = offeredTimes && currentOffer?.duration_minutes
    ? (currentOffer.duration_minutes < 60 ? `${currentOffer.duration_minutes} min` : `${currentOffer.duration_minutes / 60} hr${currentOffer.duration_minutes === 60 ? '' : 's'}`) : null;
  const heroMeta = offeredTimes
    ? [offerDuration, currentOffer?.artist_name, currentOffer?.deposit_amount ? `$${Number(currentOffer.deposit_amount).toFixed(2)} deposit to confirm` : null].filter(Boolean).join(' · ')
    : null;
  const depositTone = depositConfirmedAt ? 'success' : depositPaid ? 'warning' : 'danger';
  // What happened to this booking, oldest first, from the dates the booking keeps.
  // A booking is confirmed when its deposit is confirmed, or without a deposit when the
  // client picks a time. That pick isn't recorded, so then "Confirmed" has no date.
  // MarketingConsent shows only when the client's marketing choices have loaded.
  const hasMarketing = Boolean(clientProfile && clientProfile.email_marketing_opt_in !== undefined && email && clientProfile.id);
  const firstName = clientName !== '—' ? clientName.split(' ')[0] : 'Client';
  const ended = ['cancelled', 'rejected', 'declined', 'timed_out'].includes(rawStatus);
  const timeline = [
    createdAt && { at: createdAt, label: t('bdp_requested_at'), first: true },
    currentOffer?.email_sent_at && { at: currentOffer.email_sent_at, label: 'Times offered' },
    status === 'awaiting_payment' && updatedAt && { at: updatedAt, label: t('bdp_link_sent') },
    clientSaysPaid?.recorded_at && { at: clientSaysPaid.recorded_at, label: `${firstName} says they paid the deposit` },
    depositPaidAt && { at: depositPaidAt, label: `Deposit paid${depositPaidVia ? ` by ${depositPaidVia}` : ''}` },
    depositConfirmedAt && { at: depositConfirmedAt, label: 'Booking confirmed' },
    chosenTime && !ended && { at: chosenTime, label: 'Appointment' },
    booking?.artist_outcome_recorded_at && { at: booking.artist_outcome_recorded_at, label: 'Artist recorded the session' },
    outcomeAt && { at: outcomeAt, label: isNoShow ? 'Marked as no show' : 'Marked complete' },
    ended && updatedAt && { at: updatedAt, label: statusLabel(rawStatus) },
  ].filter(item => item && Number.isFinite(new Date(item.at).getTime()))
    .sort((a, b) => (a.first ? -1 : b.first ? 1 : new Date(a.at) - new Date(b.at)));
  const wasConfirmed = ['confirmed', 'completed'].includes(rawStatus) || (ended && Boolean(depositConfirmedAt));
  if (wasConfirmed && !depositConfirmedAt) {
    // Undated: goes just before the appointment, or at the end.
    const at = timeline.findIndex(item => item.label === 'Appointment');
    timeline.splice(at < 0 ? timeline.length : at, 0, { at: null, label: 'Booking confirmed' });
  }
  const now = Date.now();
  const hasTimeline = timeline.length > 0 || (status === 'awaiting_payment' && selectionTokenExpiresAt) || (holdExpiresAt && canConfirm);

  return (
    <>
    <PanelBackdrop onClose={onClose} />
    <aside className={`studio-booking-detail ${panelLayout.panel}`} aria-label={`${clientName} booking details`} style={p.panel}>
      <div className="studio-bdp-header" style={p.header}>
        <div className="studio-bdp-headtext" style={p.headerText}>
          <span style={p.title}>{clientName}</span>
          {(email || phone || clientAge != null) && (
            <div style={p.contact}>
              {email && (
                <button type="button" style={p.contactLink} title="Copy email"
                  onClick={() => navigator.clipboard.writeText(email).then(() => showFeedback('Email copied.', 'success')).catch(showError)}>
                  {email}
                </button>
              )}
              {email && phone && <span aria-hidden="true" style={{ color: 'var(--text-ghost)' }}>·</span>}
              {phone && <a href={`sms:${phone}`} style={p.contactLink} title="Send a text">{phone}</a>}
              {clientAge != null && (email || phone) && <span aria-hidden="true" style={{ color: 'var(--text-ghost)' }}>·</span>}
              {clientAge != null && <span style={{ ...p.contactLink, cursor: 'default' }}>{fmtDob(String(clientDob).slice(0, 10))} ({clientAge} yrs)</span>}
              {(email || (clientName && clientName !== '—')) && (
                <button type="button" style={{ ...p.textLink, marginLeft: '0.35rem' }} onClick={() => {
                  const key = email || clientName;
                  onClose?.();
                  router.push(`/dashboard/clients?client=${encodeURIComponent(key)}`);
                }}>{t('bdp_view_client')}</button>
              )}
            </div>
          )}
          <div style={p.headerPills}>
            {status && <Pill colors={sc}>{statusLabel(displayStatus)}</Pill>}
            {bookingId && booking && (activeTypes.length > 0 || appointmentTypeId) && (() => {
              // The studio's appointment type, in its schedule colour; change it here.
              const current = appointmentTypeId ? typesById[appointmentTypeId] : null;
              const options = current?.archived ? [current, ...activeTypes] : activeTypes;
              return (
                <label className="studio-type-chip" style={{ ...p.typeTag, ...p.typeChip, ...(current ? { borderColor: current.color, background: `color-mix(in srgb, ${current.color} 12%, var(--bg-card))`, color: 'var(--text)' } : {}) }}>
                  <span aria-hidden="true" style={{ ...p.typeDot, background: current?.color ?? 'transparent', border: current ? 'none' : '1.5px dashed var(--text-muted)' }} />
                  <span>{typeSaving ? 'Saving…' : current?.name ?? 'Add type'}</span>
                  <span aria-hidden="true" style={{ fontSize: '0.7rem', opacity: 0.7 }}>▾</span>
                  <select aria-label="Appointment type" value={appointmentTypeId ?? ''} disabled={typeSaving} onChange={e => changeAppointmentType(e.target.value || null)} style={p.typeSelect}>
                    <option value="">No type</option>
                    {options.map(type => <option key={type.id} value={type.id}>{type.name} ({formatTypeLength(type.duration_minutes)}){type.archived ? ' (removed)' : ''}</option>)}
                  </select>
                </label>
              );
            })()}
            {source && (
              // Studio, walk-in or personal: decides how the money is counted.
              <span style={{ ...p.typeTag, color: 'var(--text-muted)' }} title="Booking source">
                {{ studio: 'Studio booking', walkin: 'Walk-in', personal: 'Personal booking', app: 'Booked in the app', import: 'Imported booking' }[normalizeBookingSource(source)]}
              </span>
            )}
            {clientAge != null && clientAge < 18 && <Pill tone="warning">{t('bdp_minor')}</Pill>}
          </div>
        </div>
        <IconButton onClick={onClose} aria-label="Close booking details">✕</IconButton>
      </div>

      <div className={`studio-bdp-body ${panelLayout.body}`} style={p.body}>
        {/* ── When / who summary ── */}
        <div className="studio-bdp-hero" style={p.hero}>
          {heroCaption !== 'Appointment' && <span style={p.heroCaption}>{heroCaption}</span>}
          {offeredTimes ? (
            <ol aria-label="Offered times" style={{ margin: '0.25rem 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
              {offeredTimes.map((time, i) => (
                <li key={time} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '1.1rem' }}>{i + 1}</span>{fmtDate(time)}
                </li>
              ))}
            </ol>
          ) : heroTime ? (() => {
            const start = new Date(heroTime);
            const end = duration ? new Date(start.getTime() + duration * 60000) : null;
            const clock = d => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
            return (
              <div style={p.heroWhen}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                  <span style={p.heroDate}>
                    {start.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: start.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}
                    {!ended && <span style={p.heroRelative}>{relativeDay(start)}</span>}
                  </span>
                  <span style={p.heroTime}>{clock(start)}{end ? ` – ${clock(end)}` : ''}</span>
                </div>
              </div>
            );
          })() : (
            <span style={p.heroTime}>—</span>
          )}
          {offeredTimes && (currentOffer?.email_error ? (
            <span role="alert" style={p.heroNote}>
              The email to {currentOffer.email_to || 'the client'} didn’t send: {currentOffer.email_error}. Use Edit times to send it again.
            </span>
          ) : currentOffer?.email_sent_at ? (() => {
            const delivery = OFFER_EMAIL_STATUS[currentOffer.email_status];
            const sentAt = new Date(currentOffer.email_sent_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
            return delivery?.problem ? (
              <span role="alert" style={p.heroNote}>Emailed to {currentOffer.email_to} · {sentAt} — {delivery.label}</span>
            ) : (
              <span style={p.hint}>Emailed to {currentOffer.email_to} · {sentAt}{delivery ? ` · ${delivery.label}` : ''}</span>
            );
          })() : null)}
          {offeredTimes ? (heroMeta && <span style={p.heroMeta}>{heroMeta}</span>) : (
            <div style={p.heroPeople}>
              {hasArtist(artistId) ? (
                <span style={p.heroArtist}>
                  {artistPhoto && !artistPhotoFailed
                    ? <img src={artistPhoto} alt="" style={{ ...p.heroArtistAvatar, objectFit: 'cover', padding: 0 }} onError={() => setArtistPhotoFailed(true)} />
                    : <span aria-hidden="true" style={p.heroArtistAvatar}>{(artistName || '?').trim().charAt(0).toUpperCase()}</span>}
                  {artistName}
                </span>
              ) : (
                <span style={{ ...p.heroArtist, color: 'var(--text-muted)', fontWeight: 500 }}>{t('bdp_artist_unspecified')}</span>
              )}
              {stationName && <span style={p.heroStation}>{stationName}</span>}
            </div>
          )}
          {cancelReason && <span style={p.heroNote}>{t('bdp_cancelled_reason')}: {cancelReason}</span>}
        </div>

        {/* ── Payment and consent ── */}
        {(() => {
          const money = n => `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
          const priceLabel = showCompleted && finalPrice != null ? t('bdp_final_price') : t('bdp_quoted');
          const priceValue = showCompleted && finalPrice != null ? money(finalPrice) : quote != null ? money(quote) : null;
          const hasDeposit = depositRequired || depositPaid;
          const depositPill = depositConfirmedAt ? { tone: 'success', text: t('bdp_deposit_confirmed') }
            : depositPaid ? { tone: 'warning', text: t('bdp_deposit_unconfirmed') }
            : clientSaysPaid ? { tone: 'warning', text: 'Check payment' }
            : { tone: 'danger', text: t('bdp_deposit_unpaid') };
          const showConsent = Boolean(email) || consentSubmissions.length > 0;
          const consentTone = consentStatus === 'current' ? 'success' : consentStatus === 'outdated' ? 'warning' : 'danger';
          return (
            <div className={panelLayout.glance} style={{ ...p.glance, '--tiles': showConsent ? 2 : 1 }}>
              <section style={p.summaryCard} aria-labelledby="bdp-payment-title">
                <h3 id="bdp-payment-title" style={p.sectionTitle}>Payment</h3>
                <div style={p.summaryRow}>
                  <span style={p.factLabel}>{priceLabel}</span>
                  <span style={priceValue ? { ...p.factValue, ...p.factStrong } : p.summaryMuted}>{priceValue ?? 'Not set'}</span>
                </div>
                {/* Deposit on one line like the price: amount and status on the right. */}
                <div style={p.summaryRow}>
                  <span style={p.factLabel}>{t('bdp_deposit')}</span>
                  {hasDeposit ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                      {depositAmount != null && <span style={{ ...p.factValue, fontWeight: 700 }}>{money(depositAmount)}</span>}
                      <Pill tone={depositPill.tone}>{depositPill.text}</Pill>
                    </span>
                  ) : <span style={p.summaryMuted}>Not required</span>}
                </div>
                {hasDeposit && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(depositPaidAt || depositConfirmedAt) && (() => {
                      // Only card payments through Stripe carry a fee.
                      const fee = paidByStripe && depositAmount != null ? (Math.round(depositAmount * 0.03 * 100) + 50) / 100 : 0;
                      const when = depositPaidAt || depositConfirmedAt;
                      return (
                        <span style={{ ...p.hint, textAlign: 'right' }}>
                          {[
                            `Paid${depositPaidVia ? ` by ${depositPaidVia}` : paidByStripe ? ' by card' : ''}`,
                            new Date(when).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
                            fee ? `client charged ${money(depositAmount + fee)} incl. ${money(fee)} card fee` : null,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      );
                    })()}
                    {clientSaysPaid && (
                      <p role="status" style={{ margin: 0, padding: '0.6rem 0.75rem', borderRadius: 10, background: 'var(--color-warning-surface, rgba(224,168,79,0.12))', border: '1px solid var(--color-warning-border, rgba(224,168,79,0.4))', color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.45 }}>
                        {clientName !== '—' ? clientName.split(' ')[0] : 'The client'} says they paid by {clientSaysPaid.method === 'payid' ? 'PayID' : 'bank transfer'} on{' '}
                        {new Date(clientSaysPaid.recorded_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Check it’s arrived, then mark it received.
                      </p>
                    )}
                    {depositRequired && !depositPaid && !depositConfirmedAt && ['confirmed', 'awaiting_payment', 'requires_confirmation', 'deposit_expired'].includes(status) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <MarkDepositReceivedButton bookingId={bookingId} clientName={clientName !== '—' ? clientName : undefined} disabled={actionLoading}
                          onReceived={result => setReceivedDeposit({ id: bookingId, at: new Date().toISOString(), status: result?.status, method: result?.method })} />
                        {chosenTime && status !== 'deposit_expired' && (
                          <CancelDepositButton bookingId={bookingId} onCancelled={() => setCancelledDepositId(bookingId)} disabled={actionLoading} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {showConsent && (
                <section style={p.summaryCard} aria-labelledby="bdp-consent-title">
                  <div style={p.summaryRow}>
                    <h3 id="bdp-consent-title" style={p.sectionTitle}>{t('bdp_consent')}</h3>
                    {consentLoading || submissionsLoading ? <Pill>{t('loading')}</Pill> : <Pill tone={consentTone}>{consentLabel}</Pill>}
                  </div>
                  {(() => {
                    // Status in words when something's missing, then one row per signed
                    // form (newest first; each opens the full form), then what to do next.
                    const sorted = [...consentSubmissions].sort((x, y) => new Date(y.submitted_at || 0) - new Date(x.submitted_at || 0));
                    const shown = showOlderForms ? sorted : sorted.slice(0, 1);
                    const earlier = Math.max(0, (consentMore?.total ?? sorted.length) - 1);
                    const loading = consentLoading || submissionsLoading;
                    const needsForm = email && !loading && (consentStatus === 'none' || consentStatus === 'outdated');
                    return <>
                      {needsForm && (
                        <p style={{ ...p.hint, margin: 0, lineHeight: 1.45 }}>
                          {consentStatus === 'outdated' ? `${firstName} signed an older version of your form. Send the current one before the session.` : `${firstName} hasn’t signed a consent form yet.`}
                        </p>
                      )}
                      {!submissionsLoading && sorted.length > 0
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>{shown.map(sub => <ConsentSubmissionCard key={sub.id} sub={sub} templates={consentTemplates} compact />)}</div>
                        : consent && !consentLoading && (
                          <span style={p.hint}>Signed {new Date(consent.agreed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                      {(needsForm || earlier > 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                          {earlier > 0 ? (
                            <button type="button" onClick={toggleOlderForms} disabled={consentMore?.loading} style={p.textLink} aria-expanded={showOlderForms}>
                              {consentMore?.loading ? 'Loading…' : showOlderForms ? 'Hide earlier forms' : `Show ${earlier} earlier form${earlier === 1 ? '' : 's'}`}
                            </button>
                          ) : <span />}
                          {needsForm && (
                            <Button variant="secondary" size="sm" onClick={() => handleSendConsentLink('__inline__')}
                              loading={linkGeneratingId === '__inline__'} loadingLabel="Sending…" disabled={linkSentId === '__inline__'}>
                              {linkSentId === '__inline__' ? 'Link sent ✓' : 'Send consent link'}
                            </Button>
                          )}
                        </div>
                      )}
                    </>;
                  })()}
                </section>
              )}
            </div>
          );
        })()}

        {/* Two columns when there's room: the booking on the left, its history on the right. */}
        <div className={`studio-bdp-cards ${panelLayout.split}`}>
        <div className={panelLayout.column}>
        {/* ── Outcome (completed / no-show) ── */}
        {isCompleted && (
          <div style={{
            background: showCompleted ? 'var(--color-success-surface)' : 'var(--color-danger-surface)',
            border: `1px solid ${showCompleted ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
            borderRadius: 12, padding: '1rem 1.1rem',
            display: 'flex', flexDirection: 'column', gap: '0.6rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: showCompleted ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {showCompleted ? t('bdp_completed') : t('bdp_no_show_label')}
              </span>
              {outcomeAt && (
                <span style={{ ...p.hint, marginLeft: 'auto' }}>
                  {new Date(outcomeAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {showCompleted && paymentMethod && <Fact label={t('bdp_payment')}>{PAYMENT_LABELS[paymentMethod] ?? paymentMethod}</Fact>}
            {showCompleted && paymentSplits !== null && (() => {
              const artistSplits = paymentSplits.filter(s => s.recorded_by === 'artist');
              const studioSplits = paymentSplits.filter(s => s.recorded_by === 'studio');
              const artistTotal  = artistSplits.reduce((n, s) => n + (s.amount ?? 0), 0);
              const studioTotal  = studioSplits.reduce((n, s) => n + (s.amount ?? 0), 0);
              return (
                <div style={p.outcomeSub}>
                  <span style={p.subLabel}>{t('bdp_payment_recordings')}</span>
                  {[
                    { label: t('bdp_artist'), splits: artistSplits, total: artistTotal },
                    { label: t('nav_studios'), splits: studioSplits, total: studioTotal },
                  ].map(({ label, splits, total }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={p.factLabel}>{label}</span>
                      {splits.length > 0 ? (
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-success)', fontWeight: 700, textAlign: 'right' }}>
                          ✓ ${total.toFixed(2)}
                          {splits.length > 1
                            ? ` (${splits.map(s => PAYMENT_LABELS[s.method] ?? s.method).join(', ')})`
                            : ` · ${PAYMENT_LABELS[splits[0].method] ?? splits[0].method}`}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('bdp_not_recorded')}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
            {showCompleted && aftercareInstructions && (
              <div style={p.outcomeSub}>
                <span style={p.subLabel}>{t('bdp_aftercare')}</span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{aftercareInstructions}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Client health and preferences ── */}
        {(allergies || designPreferences.length > 0 || painTolerance) && (
        <Section title="Client">
          {allergies && (
            <div style={p.allergy}>
              <span style={p.allergyLabel}>{t('bdp_allergies')}</span>
              <p style={{ ...p.bodyText, marginTop: '0.2rem' }}>{allergies}</p>
            </div>
          )}
          {designPreferences.length > 0 && (
            <div>
              <span style={p.factLabel}>{t('clients_design_prefs')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                {designPreferences.map(st => <Pill key={st} tone="info">{st}</Pill>)}
              </div>
            </div>
          )}
          {painTolerance && <Fact label={t('clients_pain')}>{cap(painTolerance)}</Fact>}
        </Section>
        )}

        {/* ── Tattoo ── */}
        {(sessionType || placement || size || color || design || refImages.length > 0) && (
          <Section title={booking?.session_type === 'piercing' ? 'Piercing' : 'Tattoo'}>
            {sessionType && <Fact label={t('bdp_session')}>{cap(sessionType.replace(/_/g, ' '))}</Fact>}
            {placement   && <Fact label={t('bdp_placement')}>{placement}</Fact>}
            {size        && <Fact label={t('bdp_size')}>{size}</Fact>}
            {color       && <Fact label={t('bdp_style')}>{color.replace(/^Color\b/, 'Colour')}</Fact>}
            {design      && <Fact label={t('bdp_design')} block>{design}</Fact>}
            {earliestDate && <Fact label="Earliest date">{earliestDate}</Fact>}
            {availability.length > 0 && (
              <Fact label="Weekly availability" block>
                {availability.map(a => <span key={a.day} style={{ display: 'block' }}><span style={{ fontWeight: 600 }}>{a.day}</span> · {a.times}</span>)}
              </Fact>
            )}
            {refImages.length > 0 && (
              <div>
                <span style={p.factLabel}>{t('bdp_ref_photos')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {refImages.map(img => (
                    <a key={img.id} href={img.signed_url} target="_blank" rel="noopener noreferrer" style={p.thumb}>
                      <img src={img.signed_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Station picker ── */}
        {stationStep && (
          <div style={p.stationPicker}>
            <p style={p.stationLabel}>{t('bdp_assign_station')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {availableStations.map(st => (
                <button key={st.id} onClick={() => { setStationStep(false); onAccept(st.id); }}
                  disabled={actionLoading} style={p.stationBtn}>
                  {st.name}
                </button>
              ))}
            </div>
            <button onClick={() => setStationStep(false)} style={p.textLink}>
              {t('cancel')}
            </button>
          </div>
        )}
        {stationError && <p style={{ fontSize: '0.9rem', color: 'var(--color-danger)', margin: 0 }}>{stationError}</p>}

        {/* ── Marketing ── */}
        {(booking?.id || hasMarketing) && (
          <Section title="Marketing">
            <MarketingConsent
              email={email}
              clientKey={clientProfile?.id}
              marketing={clientProfile && clientProfile.email_marketing_opt_in !== undefined
                ? { optIn: marketingOverride?.optIn ?? clientProfile.email_marketing_opt_in === true, smsOptIn: marketingOverride?.smsOptIn ?? clientProfile.sms_marketing_opt_in === true, unsubscribed: clientProfile.email_unsubscribed === true }
                : null}
              onChange={setMarketingOverride}
            />

            {booking?.id && <BookingSMS key={booking.id} bookingId={booking.id} divider={hasMarketing} />}
          </Section>
        )}

        {/* ── Notes: the booking's own notes, the studio's notes, and a box to add one ── */}
        {(bookingId || notes) && (
          <Section title={t('bdp_notes')}>
            {notes && (
              <div style={p.subCard}>
                <p style={p.bodyText}>{notes}</p>
                <span style={p.hint}>On the booking{createdAt ? ` · ${new Date(createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
              </div>
            )}
            {studioNotes !== null && studioNotes.map(n => (
              <div key={n.id} style={p.subCard}>
                <p style={p.bodyText}>{n.content}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={p.hint}>
                    Studio note · {new Date(n.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => handleDeleteNote(n.id)} style={{ ...p.textLink, color: 'var(--color-danger)' }}>
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
            {bookingId && <>
              <textarea
                aria-label={t('clients_add_note')}
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
                placeholder={t('bdp_note_placeholder')}
                rows={3}
                style={p.noteInput}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button size="sm" variant="secondary" onClick={handleAddNote} disabled={noteAdding || !noteInput.trim()}>
                  {noteAdding ? t('saving') : t('clients_add_note_btn')}
                </Button>
              </div>
            </>}
          </Section>
        )}
        </div>
        <div className={panelLayout.column}>
        {/* ── Timeline ── */}
        {hasTimeline && (
          <Section title="Timeline">
            {/* The latest thing that happened is marked; what's still to come is hollow. On
                opening, the steps draw in from the top (studio-tl-* in globals.css). */}
            {(() => {
              const isFuture = item => item.at != null && new Date(item.at).getTime() > now;
              const latest = timeline.reduce((last, item, i) => (isFuture(item) ? last : i), -1);
              return (
                <ol style={p.timeline}>
                  {timeline.map((item, i) => {
                    const future = isFuture(item);
                    const when = item.at ? new Date(item.at) : null;
                    const soon = future && when ? relativeDay(when) : null;
                    return (
                      <li key={`${item.label}-${i}`} className="studio-tl-item" style={{ ...p.timelineItem, paddingBottom: i < timeline.length - 1 ? '0.95rem' : 0, '--tl-delay': `${180 + Math.min(i, 6) * 70}ms` }}>
                        <span aria-hidden="true" className="studio-tl-dot" style={{ ...p.timelineDot, ...(future ? p.timelineDotFuture : i === latest ? p.timelineDotLatest : {}) }} />
                        {i < timeline.length - 1 && <span aria-hidden="true" className="studio-tl-line" style={{ ...p.timelineLine, ...(isFuture(timeline[i + 1]) ? p.timelineLineFuture : {}) }} />}
                        <span style={{ ...p.timelineLabel, color: future ? 'var(--text-dim)' : 'var(--text)', fontWeight: i === latest ? 700 : 600 }}>
                          {item.label}
                          {soon && <span style={p.heroRelative}>{soon}</span>}
                        </span>
                        {when && <span style={p.timelineDate}>{shortWhen(when)}</span>}
                      </li>
                    );
                  })}
                </ol>
              );
            })()}
            {status === 'awaiting_payment' && selectionTokenExpiresAt && <Fact label={t('bdp_link_expires')}>{fmtDate(selectionTokenExpiresAt)}</Fact>}
            {holdExpiresAt && canConfirm && (
              <div style={p.holdBox}>
                <span style={p.holdLabel}>{t('bdp_client_hold')}</span>
                <span style={p.factValue}>{fmtDate(holdExpiresAt)}</span>
              </div>
            )}
          </Section>
        )}

        {/* ── Other bookings ── */}
        {clientHistory.length > 0 && (
          <Section title={`${t('bdp_other_bookings')} (${historyTotal})`}>
            {(showAllHistory ? clientHistory : clientHistory.slice(0, HISTORY_SHOWN)).map(bk => {
              const bsc = statusColors(bk.status);
              const ds = bk.chosen_time || bk.proposed_time_primary;
              const date = ds ? new Date(ds).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
              const parts = [
                bk.session_type ? cap(bk.session_type.replace(/_/g, ' ')) : null,
                bk.body_location || null,
              ].filter(Boolean);
              return (
                <div key={bk.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
                    <span style={p.itemTitle}>{parts.join(' · ') || 'Appointment'}</span>
                    <span style={p.hint}>{date}</span>
                  </div>
                  <Pill colors={bsc}>{statusLabel(bk.status)}</Pill>
                </div>
              );
            })}
            {historyTotal > HISTORY_SHOWN && (
              <button type="button" onClick={toggleAllHistory} disabled={historyLoadingAll} style={{ ...p.textLink, alignSelf: 'flex-start' }} aria-expanded={showAllHistory}>
                {historyLoadingAll ? 'Loading…' : showAllHistory ? 'Show fewer' : `Show all ${historyTotal}`}
              </button>
            )}
          </Section>
        )}

        </div>
        </div>
      </div>

      {/* ── Actions ── */}
      {offerOpen && booking && (
        <OfferTimesModal booking={booking} offer={currentOffer} artists={bookTimeArtists} depositsReady={depositsReady} onClose={() => setOfferOpen(false)}
          onOffered={async (id, data) => {
            setOffer({ booking: id, data });
            if (data?.email_error) showFeedback(`Times saved, but the email didn’t send: ${data.email_error}`, 'error');
            else showFeedback(`Times sent to ${clientName !== '—' ? clientName : 'the client'}`, 'success');
            await onBooked?.(id);
          }} />
      )}
      {bookTimeOpen && booking && (
        <BookTimeModal booking={booking} artists={bookTimeArtists} depositsReady={depositsReady} onClose={() => setBookTimeOpen(false)}
          onBooked={async id => { showFeedback('Booked in', 'success'); await onBooked?.(id); }} />
      )}
      {!stationStep && (canAcceptReject || canComplete || isFutureConfirmed || canSendLink || canConfirm || canReschedule || canBookTime) && (
        <div className="studio-bdp-actions" style={p.actions}>
          {canBookTime && (
            <Btn onClick={() => setBookTimeOpen(true)} disabled={actionLoading} variant={canSendLink || canOfferTimes ? 'neutral' : 'primary'}>Book a time</Btn>
          )}
          {canOfferTimes && (
            <Btn onClick={() => setOfferOpen(true)} disabled={actionLoading} variant="primary">{currentOffer ? 'Edit times' : 'Offer times'}</Btn>
          )}
          {canSendLink && onSendLink && !canOfferTimes && (
            <Btn onClick={onSendLink} disabled={actionLoading} variant="primary">
              {status === 'awaiting_payment' ? t('bdp_resend_link') : t('bdp_send_link')}
            </Btn>
          )}
          {canReject && onReject && (
            <Btn onClick={onReject} disabled={actionLoading} variant="danger">{t('reject')}</Btn>
          )}
          {canConfirm && onConfirm && (
            <Btn onClick={onConfirm} disabled={actionLoading} variant="success" icon={CHECK_ICON}>{t('bdp_confirm')}</Btn>
          )}
          {canConfirm && onReassign && (
            <Btn onClick={onReassign} disabled={actionLoading} variant="neutral">{t('reassign')}</Btn>
          )}
          {isFutureConfirmed && onCancel && (
            <Btn onClick={onCancel} disabled={actionLoading} variant="danger">{t('cancel')}</Btn>
          )}
          {canReschedule && onReschedule && (
            <Btn onClick={onReschedule} disabled={actionLoading} variant="neutral">{t('reschedule')}</Btn>
          )}
          {canComplete && onComplete && (
            <Btn onClick={onComplete} disabled={actionLoading} variant="success" icon={CHECK_ICON}>{t('bdp_mark_complete')}</Btn>
          )}
          {canComplete && onNoShow && (
            <Btn onClick={onNoShow} disabled={actionLoading} variant="neutral">{t('bdp_no_show')}</Btn>
          )}
          {canComplete && onCancel && (
            <Btn onClick={onCancel} disabled={actionLoading} variant="danger">{t('cancel')}</Btn>
          )}
        </div>
      )}
    </aside>
    </>
  );
}

// Loading placeholder in the shape of the loaded panel (appointment, payment and consent,
// then the booking and its timeline side by side), so nothing jumps when it arrives.
function BookingSkeleton({ label }) {
  const B = SkeletonBar;
  const card = (title, rows) => (
    <div style={{ ...p.summaryCard, gap: '0.85rem' }}>
      <B w={title} h={16} />
      {rows.map((w, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><B w="30%" h={12} /><B w={w} h={12} /></div>)}
    </div>
  );
  return (
    <div className={`studio-bdp-body ${panelLayout.body}`} style={p.body} role="status" aria-busy="true" aria-label={label}>
      <div style={p.hero}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}><B w={170} h={16} /><B w={64} h={18} round /></div>
        <B w={130} h={30} />
        <div style={p.heroPeople}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}><B w={28} h={28} round /><B w={120} h={14} /></div>
          <B w={70} h={12} />
        </div>
      </div>
      <div className={panelLayout.glance} style={{ ...p.glance, '--tiles': 2 }}>
        {card(80, ['22%', '34%'])}
        {card(80, ['60%'])}
      </div>
      <div className={panelLayout.split}>
        <div className={panelLayout.column}>
          {card(110, ['40%', '28%', '48%'])}
          {card(70, ['55%', '35%'])}
        </div>
        <div className={panelLayout.column}>
          <div style={{ ...p.summaryCard, gap: '0.95rem' }}>
            <B w={90} h={16} />
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <B w={10} h={10} round /><B w={`${[38, 30, 44, 34][i]}%`} h={13} /><span style={{ flex: 1 }} /><B w={80} h={11} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

const CHECK_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

// Action bar order by importance: the main step (complete, confirm, offer times) is
// filled and sits on the right; other steps are outlined beside it; destructive ones
// (cancel, reject) are quiet red text on the far left, away from the main step.
function Btn({ onClick, disabled, variant, icon, children }) {
  const main = variant === 'success' || variant === 'primary';
  const danger = variant === 'danger';
  return (
    <Button onClick={onClick} disabled={disabled} variant={main ? 'primary' : danger ? 'ghost' : 'secondary'}
      className={`studio-bdp-action${main ? ' studio-bdp-action--main' : danger ? ' studio-bdp-action--danger' : ''}`}>
      {icon}{children}
    </Button>
  );
}

const p = {
  ...detailStyles,
  panel: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(960px, 100%)',
    background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', zIndex: 10,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '0.55rem', minWidth: 0 },
  headerPills: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  title: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', overflowWrap: 'anywhere' },
  body: {
    flex: 1, overflowY: 'auto', padding: '1rem 1.25rem 1.25rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  hero: {
    display: 'flex', flexDirection: 'column', gap: '0.55rem',
    padding: '1rem 1.1rem', borderRadius: 14,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  heroWhen: { display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: 0 },
  heroDate: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.2rem 0.5rem', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-dim)' },
  heroPeople: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.65rem', borderTop: '1px solid var(--border-faint, var(--border))' },
  heroArtist: { display: 'inline-flex', alignItems: 'center', gap: '0.55rem', fontSize: '1.02rem', fontWeight: 650, color: 'var(--text)', minWidth: 0 },
  heroArtistAvatar: { width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, background: 'var(--color-info-surface)', border: '1px solid var(--color-info-border)', color: 'var(--color-info)' },
  heroStation: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  heroRelative: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-info)', background: 'var(--color-info-surface)', padding: '0.05rem 0.45rem', borderRadius: 99 },
  typeTag: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', padding: '0.2rem 0.6rem', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-card)', whiteSpace: 'nowrap' },
  typeDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box' },
  typeChip: { position: 'relative', cursor: 'pointer', color: 'var(--text-dim)' },
  // The real select covers the chip, so it opens the native picker.
  typeSelect: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', fontSize: 16 },
  heroCaption: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  heroTime: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 },
  heroMeta: { fontSize: '0.9rem', color: 'var(--text-dim)' },
  contact: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '-0.25rem', minWidth: 0 },
  contactLink: { background: 'none', border: 'none', padding: 0, color: 'var(--text-dim)', fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none', overflowWrap: 'anywhere', textAlign: 'left' },
  glance: { display: 'grid', gap: '0.5rem', alignItems: 'stretch' },
  summaryCard: { display: 'flex', flexDirection: 'column', gap: '0.7rem', minWidth: 0, padding: '1rem 1.1rem', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)' },
  summaryRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', minHeight: 26 },
  summaryMuted: { fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' },
  summaryDivider: { borderTop: '1px solid var(--border)' },
  heroNote: { marginTop: '0.4rem', fontSize: '0.9rem', color: 'var(--color-danger)', fontWeight: 600 },
  collapseHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  outcomeSub: { borderTop: '1px solid var(--border)', paddingTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  thumb: { display: 'block', borderRadius: 8, overflow: 'hidden', width: 84, height: 84, flexShrink: 0, border: '1px solid var(--border)' },
  depositBox: {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '0.8rem 0.9rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  phoneBtn: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-info)', fontSize: '0.95rem', fontWeight: 600, fontFamily: 'inherit' },
  allergy: { background: 'var(--color-danger-surface)', border: '1px solid var(--color-danger-border)', borderRadius: 10, padding: '0.7rem 0.85rem' },
  allergyLabel: { fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)' },
  timeline: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  timelineItem: { position: 'relative', paddingLeft: '1.5rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: '1rem', rowGap: '0.1rem' },
  timelineDot: { position: 'absolute', left: 0, top: '0.32rem', width: 10, height: 10, borderRadius: '50%', background: 'var(--text-muted)', boxSizing: 'border-box' },
  timelineDotLatest: { background: 'var(--text)', boxShadow: '0 0 0 3px var(--bg-card), 0 0 0 4.5px var(--border-strong)' },
  timelineDotFuture: { background: 'var(--bg-card)', border: '1.5px solid var(--text-muted)' },
  timelineLine: { position: 'absolute', left: 4.5, top: 'calc(0.32rem + 14px)', bottom: 'calc(-0.32rem + 4px)', width: 1, background: 'var(--border-strong)' },
  timelineLineFuture: { background: 'none', borderLeft: '1px dashed var(--border-strong)' },
  timelineLabel: { fontSize: '0.9rem', lineHeight: 1.35, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 },
  timelineDate: { fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  holdBox: { background: 'var(--color-info-surface)', border: '1px solid var(--color-info-border)', borderRadius: 10, padding: '0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  holdLabel: { fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-info)' },
  actions: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap',
    padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-panel)',
  },
  stationPicker: {
    background: 'var(--color-info-surface)', border: '1px solid var(--color-info-border)',
    borderRadius: 12, padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.7rem',
  },
  stationLabel: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  stationBtn: {
    padding: '0.55rem 0.95rem', borderRadius: 8,
    border: '1px solid var(--border-strong)', background: 'var(--bg-card)',
    color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  },
};
