'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStations, getClientConsents, getNotes, addNote, deleteNote, getBookingConsentSubmissions, getStudioClients, generateConsentLink, getStudioBookingPayment, listConsentTemplates, downloadConsentPdf } from '@/lib/api';
import { useStationAvailability } from '@/lib/useStationAvailability';
import { statusColors, statusLabel, capitalise as cap } from '@/lib/status';
import { formatDob as fmtDob, hasArtist } from '@/lib/format';
import { getCached, setCached } from '@/lib/cache';
import { useLanguage } from '@/lib/i18n';
import { showError } from '@/lib/feedback';
import { getBookingSourceLabel } from '@/lib/bookingType';
import Button, { IconButton } from '@/components/ui/Button';
import BookingSMS from '@/components/BookingSMS';
import MarketingConsent from '@/components/MarketingConsent';
import { Pill, Section, Fact, SkeletonBar, DetailSkeleton, detailStyles } from '@/components/ui/DetailParts';

const PAYMENT_LABELS = { cash: 'Cash', card: 'Card / POS', bank_transfer: 'Bank Transfer' };

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

// Age in whole years from a YYYY-MM-DD date of birth.
function ageFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob + 'T00:00:00');
  if (isNaN(birth)) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
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
}) {
  const router = useRouter();
  const { t } = useLanguage();

  // ── Station picker state ───────────────────────────────────────────────────
  const [stationStep,  setStationStep]  = useState(false);
  const [stationError, setStationError] = useState('');

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

  // ── Consent submissions (new template system) ──────────────────────────────
  const [consentSubmissions,  setConsentSubmissions]  = useState([]);
  const [submissionsLoading,  setSubmissionsLoading]  = useState(false);
  const [submissionsExpanded, setSubmissionsExpanded] = useState(false);

  // ── Normalise fields from booking (priority) with entry as fallback ────────
  const b           = booking ?? entry ?? {};
  const bookingId   = booking?.id     ?? entry?.bookingId;
  const clientName  = booking?.requester_name    ?? entry?.clientName    ?? '—';
  const email       = booking?.requester_email   ?? entry?.requesterEmail ?? null;
  const phone       = booking?.requester_phone   ?? entry?.phone          ?? null;
  const dob         = booking?.dob               ?? null;
  const artistId    = booking?.artist_id          ?? entry?.artistId   ?? null;
  const artistName  = booking?.artist_name        ?? entry?.artistName ?? null;
  const sessionType = booking?.session_type      ?? entry?.sessionType    ?? null;
  const placement   = booking?.body_location     ?? entry?.placement      ?? null;
  const sizeRaw     = booking?.size              ?? entry?.size           ?? null;
  const sizeUnit    = booking?.size_unit         ?? null;
  // Old entries store combined "10cm"; new entries store numeric size + separate size_unit.
  const size        = sizeRaw && sizeUnit && /^[\d.]+$/.test(sizeRaw) ? `${sizeRaw} ${sizeUnit}` : sizeRaw;
  const color       = booking?.color             ?? null;
  const design      = booking?.design_details    ?? entry?.designDetails  ?? null;
  const notes       = booking?.additional_notes  ?? entry?.notes          ?? null;
  const refImages   = booking?.reference_images  ?? [];
  const quote       = booking?.estimated_quote   ?? entry?.estimatedQuote ?? null;
  const duration    = booking?.proposed_duration_minutes ?? entry?.durationMins ?? null;
  const chosenTime  = booking?.chosen_time       ?? entry?.chosenTime     ?? null;
  const proposedTime = booking?.proposed_time_primary    ?? null;
  const status      = booking?.status            ?? entry?.status         ?? null;
  const depositRequired   = booking?.deposit_required    ?? false;
  const depositAmount     = booking?.deposit_amount      ?? null;
  const depositPaidAt     = booking?.deposit_paid_at     ?? null;
  const depositConfirmedAt = booking?.deposit_confirmed_at ?? null;
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
    listConsentTemplates().then(d => setConsentTemplates(d.templates ?? [])).catch(() => {});
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

  const clientAge         = ageFromDob(dob);
  const designPreferences = parseStyles(clientProfile?.design_preferences);
  const allergies         = clientProfile?.allergies || null;
  const painTolerance     = clientProfile?.pain_tolerance || null;

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
  useEffect(() => {
    setConsentSubmissions([]);
    if (!bookingId) return;
    setSubmissionsLoading(true);
    getBookingConsentSubmissions(bookingId)
      .then(d => setConsentSubmissions(d.submissions ?? []))
      .catch(() => {})
      .finally(() => setSubmissionsLoading(false));
  }, [bookingId]);

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
  const clientHistory = (allBookings ?? []).filter(
    bk => bk.requester_email === email && bk.id !== bookingId
  );

  // ── Duration / time string ─────────────────────────────────────────────────
  const durationLabel = duration
    ? `${Math.round((duration / 60) * 10) / 10} hrs`
    : null;

  // While the full booking is fetching, show only the header + a loading state —
  // keep the detail sections hidden rather than rendering them from partial data.
  if (loading) {
    return (
      <aside className="studio-booking-detail" aria-label={`${clientName} booking details`} aria-busy="true" style={p.panel}>
        <div style={p.header}>
          <div style={p.headerText}>
            <span style={p.title}>{clientName}</span>
            <div style={p.headerPills}><SkeletonBar w={86} h={24} /><SkeletonBar w={64} h={24} /></div>
          </div>
          <IconButton onClick={onClose} aria-label="Close booking details">✕</IconButton>
        </div>
        <div style={p.body}><DetailSkeleton label={t('loading')} hero cards={3} /></div>
      </aside>
    );
  }

  const heroTime = chosenTime ?? proposedTime ?? null;
  const heroCaption = chosenTime ? 'Appointment' : proposedTime ? 'Proposed time' : 'Time to be arranged';
  const heroMeta = [durationLabel, hasArtist(artistId) ? artistName : t('bdp_artist_unspecified'), stationName].filter(Boolean).join(' · ');
  const showMoney = status === 'confirmed' || quote != null || depositRequired || depositPaid;
  const depositTone = depositConfirmedAt ? 'success' : depositPaid ? 'warning' : 'danger';
  const hasTimeline = createdAt || (status === 'awaiting_payment' && (updatedAt || selectionTokenExpiresAt)) || (holdExpiresAt && canConfirm);

  return (
    <aside className="studio-booking-detail" aria-label={`${clientName} booking details`} style={p.panel}>
      <div style={p.header}>
        <div style={p.headerText}>
          <span style={p.title}>{clientName}</span>
          <div style={p.headerPills}>
            {status && <Pill colors={sc}>{statusLabel(displayStatus)}</Pill>}
            {source && <Pill>{getBookingSourceLabel(source)}</Pill>}
            {clientAge != null && clientAge < 18 && <Pill tone="warning">{t('bdp_minor')}</Pill>}
          </div>
        </div>
        <IconButton onClick={onClose} aria-label="Close booking details">✕</IconButton>
      </div>

      <div style={p.body}>
        {/* ── When / who summary ── */}
        <div style={{ ...p.hero, background: sc.bg, borderColor: sc.border }}>
          <span style={{ ...p.heroCaption, color: sc.text }}>{heroCaption}</span>
          <span style={p.heroTime}>{heroTime ? fmtDate(heroTime) : '—'}</span>
          {heroMeta && <span style={p.heroMeta}>{heroMeta}</span>}
          {cancelReason && <span style={p.heroNote}>{t('bdp_cancelled_reason')}: {cancelReason}</span>}
        </div>

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
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {new Date(outcomeAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {showCompleted && finalPrice != null && <Fact label={t('bdp_final_price')} strong>${finalPrice}</Fact>}
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

        {/* ── Tattoo ── */}
        {(sessionType || placement || size || color || design || notes || refImages.length > 0) && (
          <Section title="Tattoo">
            {sessionType && <Fact label={t('bdp_session')}>{cap(sessionType.replace(/_/g, ' '))}</Fact>}
            {placement   && <Fact label={t('bdp_placement')}>{placement}</Fact>}
            {size        && <Fact label={t('bdp_size')}>{size}</Fact>}
            {color       && <Fact label={t('bdp_style')}>{color}</Fact>}
            {design      && <Fact label={t('bdp_design')} block>{design}</Fact>}
            {notes       && <Fact label={t('bdp_notes')} block>{notes}</Fact>}
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

        {/* ── Payment ── */}
        {showMoney && (
          <Section title="Payment">
            <Fact label={t('bdp_quoted')} strong>{quote != null ? `$${Number(quote).toLocaleString()}` : '—'}</Fact>
            {(status === 'confirmed' || depositRequired || depositPaid) && (
              <div style={p.depositBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={p.factLabel}>{t('bdp_deposit')}</span>
                  {!depositRequired && !depositPaid ? (
                    <Pill>Not required</Pill>
                  ) : (
                    <Pill tone={depositTone}>
                      {depositConfirmedAt ? t('bdp_deposit_confirmed') : depositPaid ? t('bdp_deposit_unconfirmed') : t('bdp_deposit_unpaid')}
                    </Pill>
                  )}
                </div>
                {depositAmount != null && (() => {
                  const feeCents = Math.round(depositAmount * 0.03 * 100) + 50;
                  const total = depositAmount + feeCents / 100;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>${depositAmount.toFixed(2)}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        + ${(feeCents / 100).toFixed(2)} fee = ${total.toFixed(2)} charged to client
                      </span>
                    </div>
                  );
                })()}
                {depositPaidAt && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Paid {new Date(depositPaidAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}
          </Section>
        )}

        {/* ── Client ── */}
        <Section
          title={t('bdp_client_info')}
          aside={(email || (clientName && clientName !== '—')) && (
            <button
              onClick={() => {
                const key = email || clientName;
                onClose?.();
                router.push(`/dashboard/clients?client=${encodeURIComponent(key)}`);
              }}
              style={p.textLink}
            >
              {t('bdp_view_client')}
            </button>
          )}
        >
          {dob && <Fact label="Date of birth">{fmtDob(dob)}{clientAge != null && ` · ${clientAge} yrs`}</Fact>}
          <Fact label="Email">{email || <span style={{ color: 'var(--text-muted)' }}>{t('clients_no_email')}</span>}</Fact>
          <Fact label="Phone">
            {phone ? (
              <button
                onClick={() => { const a = document.createElement('a'); a.href = `sms:${phone}`; a.click(); }}
                style={p.phoneBtn}
              >
                {phone} <span aria-hidden="true">↗</span>
              </button>
            ) : <span style={{ color: 'var(--text-muted)' }}>{t('clients_no_phone')}</span>}
          </Fact>

          {email && (
            <Fact label={t('bdp_consent')} control>
              {consentLoading || submissionsLoading ? (
                <Pill>{t('loading')}</Pill>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Pill tone={consentStatus === 'current' ? 'success' : consentStatus === 'outdated' ? 'warning' : 'danger'}>{consentLabel}</Pill>
                  {(consentStatus === 'none' || consentStatus === 'outdated') && (
                    <button
                      onClick={() => handleSendConsentLink('__inline__')}
                      disabled={linkGeneratingId === '__inline__'}
                      style={{ ...p.smallAction, ...(linkSentId === '__inline__' ? p.smallActionDone : {}) }}
                    >
                      {linkSentId === '__inline__' ? 'Sent ✓' : linkGeneratingId === '__inline__' ? '…' : 'Send link'}
                    </button>
                  )}
                </span>
              )}
            </Fact>
          )}
          {consent && !consentLoading && (
            <span style={p.hint}>
              Signed v{consent.consent_version} on {new Date(consent.agreed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}

          <MarketingConsent
            email={email}
            clientKey={clientProfile?.id}
            marketing={clientProfile && clientProfile.email_marketing_opt_in !== undefined
              ? { optIn: marketingOverride ?? clientProfile.email_marketing_opt_in === true, unsubscribed: clientProfile.email_unsubscribed === true }
              : null}
            onChange={setMarketingOverride}
          />

          {booking?.id && <BookingSMS key={booking.id} bookingId={booking.id} />}

          {allergies && (
            <div style={p.allergy}>
              <span style={p.allergyLabel}>{t('bdp_allergies')}</span>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.45 }}>{allergies}</p>
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

        {/* ── Timeline ── */}
        {hasTimeline && (
          <Section title="Timeline">
            {createdAt && <Fact label={t('bdp_requested_at')}>{fmtDate(createdAt)}</Fact>}
            {status === 'awaiting_payment' && updatedAt && <Fact label={t('bdp_link_sent')}>{fmtDate(updatedAt)}</Fact>}
            {status === 'awaiting_payment' && selectionTokenExpiresAt && <Fact label={t('bdp_link_expires')}>{fmtDate(selectionTokenExpiresAt)}</Fact>}
            {holdExpiresAt && canConfirm && (
              <div style={p.holdBox}>
                <span style={p.holdLabel}>{t('bdp_client_hold')}</span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{fmtDate(holdExpiresAt)}</span>
              </div>
            )}
          </Section>
        )}

        {/* ── Other bookings ── */}
        {clientHistory.length > 0 && (
          <Section title={`${t('bdp_other_bookings')} (${clientHistory.length})`}>
            {clientHistory.map(bk => {
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
                    <span style={{ fontSize: '0.95rem', color: 'var(--text)', fontWeight: 600 }}>{parts.join(' · ') || '—'}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{date}</span>
                  </div>
                  <Pill colors={bsc}>{statusLabel(bk.status)}</Pill>
                </div>
              );
            })}
          </Section>
        )}

        {/* ── Consent forms (collapsible) ── */}
        {!submissionsLoading && consentSubmissions.length > 0 && (
          <section style={p.section}>
            <button
              style={p.collapseHead}
              aria-expanded={submissionsExpanded}
              onClick={() => setSubmissionsExpanded(x => !x)}
            >
              <h3 style={p.sectionTitle}>{t('bdp_consent_forms')} ({consentSubmissions.length})</h3>
              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>{submissionsExpanded ? '▲' : '▼'}</span>
            </button>
            {submissionsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {consentSubmissions.map(sub => (
                  <div key={sub.id} style={p.subCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{sub.template_name}</span>
                      {sub.is_minor && <Pill tone="warning">{t('bdp_minor')}</Pill>}
                    </div>
                    {sub.signer_name && <Fact label={t('bdp_signed_by')}>{sub.signer_name}</Fact>}
                    {sub.answers && Object.entries(sub.answers).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {Object.entries(sub.answers).map(([k, v]) => v && v !== true && v !== 'true' && k !== '__agreed__' && (
                          <div key={k} style={{ fontSize: '0.875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}: </span>{v}
                          </div>
                        ))}
                      </div>
                    )}
                    {sub.client_signature_url && (
                      <div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.3rem' }}>{t('bdp_client_signature')}</p>
                        <img src={sub.client_signature_url} alt="Client signature" style={p.signature} />
                      </div>
                    )}
                    {sub.guardian_name && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={p.subLabel}>{t('bdp_guardian')}</span>
                        <Fact label={sub.guardian_relationship ?? 'Guardian'}>{sub.guardian_name}</Fact>
                        {sub.guardian_email && <span style={p.hint}>{sub.guardian_email}</span>}
                        {sub.guardian_phone && <span style={p.hint}>{sub.guardian_phone}</span>}
                        {sub.guardian_signature_url && <img src={sub.guardian_signature_url} alt="Guardian signature" style={p.signature} />}
                      </div>
                    )}
                    <span style={p.hint}>
                      {new Date(sub.submitted_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    <div>
                      <Button variant="secondary" size="sm" onClick={() => downloadConsentPdf(sub.id, `consent-${(sub.signer_name || 'form').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`).catch(showError)}>
                        Download PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
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

        {/* ── Studio notes ── */}
        {bookingId && (
          <Section title={t('bdp_studio_notes')}>
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
            {studioNotes !== null && studioNotes.map(n => (
              <div key={n.id} style={p.subCard}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={p.hint}>
                    {new Date(n.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => handleDeleteNote(n.id)} style={{ ...p.textLink, color: 'var(--color-danger)' }}>
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* ── Actions ── */}
      {!stationStep && (canAcceptReject || canComplete || isFutureConfirmed || canSendLink || canConfirm || canReschedule) && (
        <div style={p.actions}>
          {canSendLink && onSendLink && (
            <Btn onClick={onSendLink} disabled={actionLoading} variant="primary">
              {status === 'awaiting_payment' ? t('bdp_resend_link') : t('bdp_send_link')}
            </Btn>
          )}
          {canReject && onReject && (
            <Btn onClick={onReject} disabled={actionLoading} variant="danger">{t('reject')}</Btn>
          )}
          {canConfirm && onConfirm && (
            <Btn onClick={onConfirm} disabled={actionLoading} variant="success">{t('bdp_confirm')}</Btn>
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
            <Btn onClick={onComplete} disabled={actionLoading} variant="success">{t('bdp_mark_complete')}</Btn>
          )}
          {canComplete && onNoShow && (
            <Btn onClick={onNoShow} disabled={actionLoading} variant="danger">{t('bdp_no_show')}</Btn>
          )}
          {canComplete && onCancel && (
            <Btn onClick={onCancel} disabled={actionLoading} variant="danger">{t('cancel')}</Btn>
          )}
        </div>
      )}
    </aside>
  );
}

function Btn({ onClick, disabled, variant, children }) {
  const c = variant === 'success' ? { bg: 'var(--color-success-surface)', border: 'var(--color-success-border)', text: 'var(--color-success)' }
    : variant === 'primary'  ? { bg: 'var(--color-info-surface)', border: 'var(--color-info-border)', text: 'var(--color-info)' }
    : variant === 'neutral'  ? { bg: 'var(--bg-chip)', border: 'var(--border)', text: 'var(--text-muted)' }
    : { bg: 'var(--color-danger-surface)', border: 'var(--color-danger-border)', text: 'var(--color-danger)' };
  return (
    <Button onClick={onClick} disabled={disabled} size="sm" style={{
      flex: 1,
      border: `1px solid ${c.border}`, background: c.bg, color: c.text,
    }}>
      {children}
    </Button>
  );
}

const p = {
  ...detailStyles,
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(420px, 100%)',
    background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', zIndex: 10,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem',
    padding: '1.25rem 1.25rem 1rem',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '0.55rem', minWidth: 0 },
  headerPills: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  title: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', overflowWrap: 'anywhere' },
  body: {
    flex: 1, overflowY: 'auto', padding: '1.1rem 1.25rem 1.5rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  hero: {
    border: '1px solid', borderRadius: 14, padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  heroCaption: { fontSize: '0.85rem', fontWeight: 700 },
  heroTime: { fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  heroMeta: { fontSize: '0.95rem', color: 'var(--text-dim)' },
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
  allergyLabel: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-danger)' },
  holdBox: { background: 'var(--color-info-surface)', border: '1px solid var(--color-info-border)', borderRadius: 10, padding: '0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  holdLabel: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-info)' },
  signature: { maxWidth: '100%', height: 64, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'block' },
  actions: {
    display: 'flex', gap: '0.6rem', flexWrap: 'wrap',
    padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-panel)',
  },
  stationPicker: {
    background: 'var(--color-info-surface)', border: '1px solid var(--color-info-border)',
    borderRadius: 12, padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.7rem',
  },
  stationLabel: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  stationBtn: {
    padding: '0.55rem 0.95rem', borderRadius: 8,
    border: '1px solid var(--border-strong)', background: 'var(--bg-card)',
    color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  },
};
