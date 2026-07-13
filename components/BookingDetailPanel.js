'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAvailableStations, getClientConsents, recordConsentInStudio, getNotes, addNote, deleteNote, getBookingConsentSubmissions, getStudioClients } from '@/lib/api';
import { statusColors, statusLabel, capitalise as cap } from '@/lib/status';
import { formatDob as fmtDob } from '@/lib/format';
import { getCached, setCached } from '@/lib/cache';

const PAYMENT_LABELS = { cash: 'Cash', card: 'Card / POS', bank_transfer: 'Bank Transfer' };
const CONSENT_STYLE  = {
  current:  { bg: 'rgba(76,201,138,0.12)',  text: '#4cc98a' },
  outdated: { bg: 'rgba(245,158,58,0.12)',  text: '#f59e3a' },
  none:     { bg: 'rgba(232,111,111,0.12)', text: '#e86f6f' },
};

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
}) {
  const router = useRouter();

  // ── Station picker state ───────────────────────────────────────────────────
  const [stationStep,       setStationStep]       = useState(false);
  const [availableStations, setAvailableStations] = useState([]);
  const [stationsLoading,   setStationsLoading]   = useState(false);
  const [stationError,      setStationError]      = useState('');

  // ── Studio notes state (notes table, entity_type='booking') ────────────────
  const [studioNotes, setStudioNotes] = useState(null); // null = loading
  const [noteInput,   setNoteInput]   = useState('');
  const [noteAdding,  setNoteAdding]  = useState(false);

  // ── Consent state ──────────────────────────────────────────────────────────
  const [consent,        setConsent]        = useState(null);
  const [consentVersion, setConsentVersion] = useState('1');
  const [recording,      setRecording]      = useState(false);

  // ── Contact-book profile (allergies / preferences / pain tolerance) ─────────
  const [clientProfile, setClientProfile] = useState(null);

  // ── Consent submissions (new template system) ──────────────────────────────
  const [consentSubmissions, setConsentSubmissions] = useState([]);
  const [submissionsExpanded, setSubmissionsExpanded] = useState(false);

  // ── Normalise fields from booking (priority) with entry as fallback ────────
  const b           = booking ?? entry ?? {};
  const bookingId   = booking?.id     ?? entry?.bookingId;
  const clientName  = booking?.requester_name    ?? entry?.clientName    ?? '—';
  const email       = booking?.requester_email   ?? entry?.requesterEmail ?? null;
  const phone       = booking?.requester_phone   ?? entry?.phone          ?? null;
  const dob         = booking?.dob               ?? null;
  const artistName  = entry?.artistName          ?? null;
  const sessionType = booking?.session_type      ?? entry?.sessionType    ?? null;
  const placement   = booking?.body_location     ?? entry?.placement      ?? null;
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

  // Under the 5-status model a no-show is stored as status='completed' with
  // outcome='no_show', so "completed" visuals must exclude no-shows explicitly.
  const isNoShow      = status === 'completed' && booking?.outcome === 'no_show';
  const isCompleted   = status === 'completed';
  const showCompleted = isCompleted && !isNoShow;

  const today      = new Date().toLocaleDateString('en-CA');
  const chosenDate = chosenTime ? chosenTime.slice(0, 10) : null;
  const isFutureConfirmed = status === 'confirmed' && chosenDate && chosenDate > today;
  const canAcceptReject   = ['pending', 'awaiting_payment'].includes(status);
  const canComplete       = status === 'confirmed' && chosenDate && chosenDate <= today;
  const canReject         = canAcceptReject;

  const displayStatus = isNoShow ? 'no_show' : status;
  const sc = statusColors(displayStatus);

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
    } catch { /* silent */ }
    finally { setNoteAdding(false); }
  }

  async function handleDeleteNote(id) {
    try {
      await deleteNote(id);
      setStudioNotes(prev => (prev ?? []).filter(n => n.id !== id));
    } catch { /* silent */ }
  }

  // ── Consent ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setConsent(null);
    setConsentVersion('1');
    if (!email) return;
    getClientConsents([email])
      .then(data => {
        setConsent((data.consents ?? {})[email] ?? null);
        setConsentVersion(data.current_version ?? '1');
      })
      .catch(() => {});
  }, [email]);

  const consentStatus = !consent ? 'none'
    : consent.consent_version === consentVersion ? 'current' : 'outdated';
  const cs = CONSENT_STYLE[consentStatus];
  const consentLabel = { current: 'Consented', outdated: 'Outdated', none: 'No consent' }[consentStatus];

  // Match this booking's client against the contact book for their saved profile.
  useEffect(() => {
    setClientProfile(null);
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

  const clientAge         = ageFromDob(dob);
  const designPreferences = parseStyles(clientProfile?.design_preferences);
  const allergies         = clientProfile?.allergies || null;
  const painTolerance     = clientProfile?.pain_tolerance || null;

  async function handleRecordConsent() {
    if (!email) return;
    setRecording(true);
    try {
      await recordConsentInStudio(email);
      setConsent({ consent_version: consentVersion, agreed_at: new Date().toISOString(), source: 'in_studio' });
    } catch (e) { alert(e.message); }
    finally { setRecording(false); }
  }

  // ── Load consent submissions ───────────────────────────────────────────────
  useEffect(() => {
    setConsentSubmissions([]);
    if (!bookingId) return;
    getBookingConsentSubmissions(bookingId)
      .then(d => setConsentSubmissions(d.submissions ?? []))
      .catch(() => {});
  }, [bookingId]);

  // ── Station picker ─────────────────────────────────────────────────────────
  async function handleAcceptClick() {
    if (!onAccept) return;
    setStationsLoading(true);
    setStationError('');
    try {
      const dateStr = (chosenTime ?? '').split('T')[0];
      const data = await getAvailableStations(dateStr, bookingId);
      const stations = data.stations ?? [];
      if (stations.length === 0) {
        setStationError('No stations available on this date.');
        return;
      }
      setAvailableStations(stations);
      setStationStep(true);
    } catch { setStationError('Failed to load stations.'); }
    finally { setStationsLoading(false); }
  }

  // ── Client history ─────────────────────────────────────────────────────────
  const clientHistory = (allBookings ?? []).filter(
    bk => bk.requester_email === email && bk.id !== bookingId
  );

  // ── Duration / time string ─────────────────────────────────────────────────
  const durationLabel = duration
    ? `${Math.round((duration / 60) * 10) / 10} hrs`
    : null;

  return (
    <aside style={p.panel}>
      {/* Header */}
      <div style={p.header}>
        <span style={p.title}>{clientName}</span>
        <button onClick={onClose} style={p.closeBtn}>✕</button>
      </div>

      <div style={p.body}>
        {/* ── Outcome card ── */}
        {isCompleted && (
          <div style={{
            background: showCompleted ? 'rgba(76,201,138,0.07)' : 'rgba(232,111,111,0.06)',
            border: `1px solid ${showCompleted ? 'rgba(76,201,138,0.2)' : 'rgba(232,111,111,0.15)'}`,
            borderRadius: 10, padding: '0.85rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: showCompleted ? '#4cc98a' : '#e86f6f' }}>
                {showCompleted ? '✓ Completed' : '✗ No Show'}
              </span>
              {outcomeAt && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)', marginLeft: 'auto' }}>
                  {new Date(outcomeAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {showCompleted && finalPrice != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>Final price</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>${finalPrice}</span>
              </div>
            )}
            {showCompleted && paymentMethod && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>Payment</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{PAYMENT_LABELS[paymentMethod] ?? paymentMethod}</span>
              </div>
            )}
            {showCompleted && aftercareInstructions && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.65rem', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-ghost)', display: 'block', marginBottom: '0.4rem' }}>Aftercare</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{aftercareInstructions}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Booking info ── */}
        {loading && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Loading…</p>}

        {status && (
          <Row label="Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: 20,
                background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                {statusLabel(displayStatus)}
              </span>
              {source && (
                <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: 4,
                  background: 'var(--bg-chip)', color: 'var(--text-ghost)', border: '1px solid var(--border-faint)' }}>
                  {source === 'walkin' ? 'Walk-in' : source === 'personal' ? 'Manual' : source}
                </span>
              )}
            </div>
          </Row>
        )}
        {artistName && <Row label="Artist" value={artistName} />}
        {sessionType && <Row label="Session" value={cap(sessionType.replace(/_/g, ' '))} />}
        {placement   && <Row label="Placement" value={placement} />}
        {color       && <Row label="Style" value={color} />}
        {design      && <Row label="Design" value={design} />}
        {notes       && <Row label="Notes" value={notes} />}

        {refImages.length > 0 && (
          <div>
            <span style={p.label}>Reference photos</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.45rem' }}>
              {refImages.map(img => (
                <a key={img.id} href={img.signed_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', borderRadius: 6, overflow: 'hidden',
                    width: 72, height: 72, flexShrink: 0,
                    border: '1px solid var(--border-faint)' }}>
                  <img src={img.signed_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </a>
              ))}
            </div>
          </div>
        )}

        {quote != null && <Row label="Quoted price" value={`$${Number(quote).toLocaleString()}`} />}
        {durationLabel && <Row label="Duration" value={durationLabel} />}

        {/* Deposit */}
        {depositRequired && (
          <div style={p.depositBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={p.label}>Deposit</span>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 4,
                background: depositConfirmedAt ? 'rgba(76,201,138,0.12)' : depositPaid ? 'rgba(250,204,21,0.12)' : 'rgba(232,111,111,0.1)',
                color: depositConfirmedAt ? '#4cc98a' : depositPaid ? '#facc15' : '#e86f6f',
              }}>
                {depositConfirmedAt ? 'Confirmed' : depositPaid ? 'Paid — unconfirmed' : 'Unpaid'}
              </span>
            </div>
            {depositAmount != null && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>${depositAmount}</span>
            )}
            {depositPaidAt && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>
                Paid {new Date(depositPaidAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        )}

        {proposedTime && <Row label="Proposed" value={fmtDate(proposedTime)} />}
        {chosenTime   && <Row label="Appointment" value={fmtDate(chosenTime)} />}
        {cancelReason && <Row label="Cancelled" value={cancelReason} />}

        {/* ── Client info ── */}
        <div style={p.divider} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={p.sectionLabel}>Client information</span>
          {(email || (clientName && clientName !== '—')) && (
            <button
              onClick={() => {
                const key = email || clientName;
                onClose?.();
                router.push(`/dashboard/clients?client=${encodeURIComponent(key)}`);
              }}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
            >
              View client →
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{clientName}</span>
          {email && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{email}</span>}
          {phone && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{phone}</span>}
          {dob && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {fmtDob(dob)}{clientAge != null && ` · ${clientAge} yrs`}
              {clientAge != null && clientAge < 18 && (
                <span style={{ marginLeft: '0.4rem', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', padding: '0.05rem 0.35rem', borderRadius: 4, background: 'rgba(245,158,58,0.15)', color: '#f59e3a' }}>MINOR</span>
              )}
            </span>
          )}
        </div>

        {/* Contact-book profile — allergies flagged for safety */}
        {(allergies || designPreferences.length > 0 || painTolerance) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allergies && (
              <div style={{ background: 'rgba(232,111,111,0.08)', border: '1px solid rgba(232,111,111,0.2)', borderRadius: 6, padding: '0.45rem 0.6rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#e86f6f' }}>⚠ Allergies</span>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>{allergies}</p>
              </div>
            )}
            {designPreferences.length > 0 && (
              <div>
                <span style={p.label}>Design preferences</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                  {designPreferences.map(s => (
                    <span key={s} style={{ fontSize: '0.7rem', fontWeight: 500, padding: '0.15rem 0.5rem', borderRadius: 20, background: 'var(--bg-chip)', color: 'var(--text-muted)', border: '1px solid var(--border-faint)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {painTolerance && <Row label="Pain tolerance" value={cap(painTolerance)} />}
          </div>
        )}

        {email && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={p.label}>Consent</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
                padding: '0.1rem 0.4rem', borderRadius: 4, background: cs.bg, color: cs.text }}>
                {consentLabel}
              </span>
              {consent && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>
                  v{consent.consent_version} · {new Date(consent.agreed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            {(consentStatus === 'none' || consentStatus === 'outdated') && (
              <button onClick={handleRecordConsent} disabled={recording} style={p.linkBtn}>
                {recording ? 'Recording…' : consentStatus === 'outdated' ? 'Record updated consent →' : 'Record consent →'}
              </button>
            )}
          </div>
        )}

        {clientHistory.length > 0 && (
          <div>
            <span style={{ ...p.label, display: 'block', marginBottom: '0.5rem' }}>
              Other bookings ({clientHistory.length})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
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
                      <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 500 }}>{parts.join(' · ') || '—'}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>{date}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: bsc.text, flexShrink: 0 }}>
                      {statusLabel(bk.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Station picker ── */}
        {stationStep && (
          <div style={p.stationPicker}>
            <p style={p.stationLabel}>Assign a station</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {availableStations.map(st => (
                <button key={st.id} onClick={() => { setStationStep(false); onAccept(st.id); }}
                  disabled={actionLoading} style={p.stationBtn}>
                  {st.name}
                </button>
              ))}
            </div>
            <button onClick={() => setStationStep(false)} style={p.linkBtn}>Cancel</button>
          </div>
        )}
        {stationError && <p style={{ fontSize: '0.78rem', color: '#e86f6f' }}>{stationError}</p>}
      </div>

      {/* ── Studio notes ── */}
      {bookingId && (
        <div style={{ padding: '0.75rem 1rem 0' }}>
          <div style={p.divider} />
          <span style={p.sectionLabel}>Studio notes</span>
          <textarea
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
            placeholder="Internal note — not visible to client…"
            rows={2}
            style={{
              width: '100%', marginTop: '0.4rem', resize: 'vertical',
              background: 'var(--bg-chip)', border: '1px solid var(--border-faint)',
              borderRadius: 6, padding: '0.5rem 0.6rem',
              fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5,
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
            <button
              onClick={handleAddNote}
              disabled={noteAdding || !noteInput.trim()}
              style={{
                fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem',
                borderRadius: 5, border: '1px solid var(--border-faint)',
                background: 'var(--bg-chip)', color: 'var(--text-dim)', cursor: 'pointer',
                opacity: (!noteInput.trim() || noteAdding) ? 0.45 : 1,
              }}
            >
              {noteAdding ? 'Saving…' : 'Add note'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            {studioNotes !== null && studioNotes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', borderRadius: 6, padding: '0.5rem 0.6rem' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-ghost)' }}>
                    {new Date(n.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => handleDeleteNote(n.id)} style={{ fontSize: '0.68rem', color: '#e86f6f', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Consent submissions ── */}
      {consentSubmissions.length > 0 && (
        <div style={{ padding: '0 1rem 0' }}>
          <div style={p.divider} />
          <button
            style={{ ...p.sectionLabel, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}
            onClick={() => setSubmissionsExpanded(x => !x)}
          >
            <span>Consent forms ({consentSubmissions.length})</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-ghost)' }}>{submissionsExpanded ? '▲' : '▼'}</span>
          </button>
          {submissionsExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.65rem' }}>
              {consentSubmissions.map(sub => (
                <div key={sub.id} style={{ background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dim)' }}>{sub.template_name}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-ghost)' }}>
                      {sub.template_type}
                    </span>
                    {sub.is_minor && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(245,158,58,0.12)', color: '#f59e3a' }}>Minor</span>
                    )}
                  </div>

                  {sub.signer_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>Signed by</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{sub.signer_name}</span>
                    </div>
                  )}

                  {/* Field answers */}
                  {sub.answers && Object.entries(sub.answers).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {Object.entries(sub.answers).map(([k, v]) => v && (
                        <div key={k} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--text-ghost)' }}>{k}: </span>{v}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Client signature */}
                  {sub.client_signature_url && (
                    <div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-ghost)', margin: '0 0 0.25rem' }}>Client signature</p>
                      <img
                        src={sub.client_signature_url}
                        alt="Client signature"
                        style={{ maxWidth: '100%', height: 60, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-faint)', display: 'block' }}
                      />
                    </div>
                  )}

                  {/* Guardian info */}
                  {sub.guardian_name && (
                    <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Guardian</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>{sub.guardian_relationship ?? 'Guardian'}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{sub.guardian_name}</span>
                      </div>
                      {sub.guardian_email && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub.guardian_email}</span>}
                      {sub.guardian_phone && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub.guardian_phone}</span>}
                      {sub.guardian_signature_url && (
                        <img
                          src={sub.guardian_signature_url}
                          alt="Guardian signature"
                          style={{ maxWidth: '100%', height: 60, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-faint)', display: 'block', marginTop: '0.25rem' }}
                        />
                      )}
                    </div>
                  )}

                  <span style={{ fontSize: '0.68rem', color: 'var(--text-ghost)' }}>
                    {new Date(sub.submitted_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      {!stationStep && (canAcceptReject || canComplete || isFutureConfirmed) && (
        <div style={p.actions}>
          {canAcceptReject && onAccept && (
            <Btn onClick={handleAcceptClick} disabled={actionLoading || stationsLoading} variant="success">
              {stationsLoading ? 'Loading…' : 'Accept'}
            </Btn>
          )}
          {canAcceptReject && onReject && (
            <Btn onClick={onReject} disabled={actionLoading} variant="danger">Reject</Btn>
          )}
          {isFutureConfirmed && onCancel && (
            <Btn onClick={onCancel} disabled={actionLoading} variant="danger">Cancel</Btn>
          )}
          {canComplete && onComplete && (
            <Btn onClick={onComplete} disabled={actionLoading} variant="success">Mark Complete</Btn>
          )}
          {canComplete && onNoShow && (
            <Btn onClick={onNoShow} disabled={actionLoading} variant="danger">No Show</Btn>
          )}
          {canComplete && onCancel && (
            <Btn onClick={onCancel} disabled={actionLoading} variant="danger">Cancel</Btn>
          )}
        </div>
      )}
    </aside>
  );
}

function Row({ label, value, children }) {
  const content = children ?? value;
  if (!content && content !== 0) return null;
  return (
    <div style={p.row}>
      <span style={p.label}>{label}</span>
      <span style={p.value}>{content}</span>
    </div>
  );
}

function Btn({ onClick, disabled, variant, children }) {
  const c = variant === 'success'
    ? { bg: 'rgba(76,201,138,0.12)', border: 'rgba(76,201,138,0.3)', text: '#4cc98a' }
    : { bg: 'rgba(232,111,111,0.1)', border: 'rgba(232,111,111,0.25)', text: '#e86f6f' };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '0.55rem', borderRadius: 7,
      border: `1px solid ${c.border}`, background: c.bg, color: c.text,
      fontSize: '0.8rem', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

const p = {
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 320,
    background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', zIndex: 10,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.25rem 1.25rem 1rem',
    borderBottom: '1px solid var(--border-faint)', flexShrink: 0,
  },
  title: {
    fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-faint)',
    fontSize: '0.9rem', cursor: 'pointer', padding: '0.25rem', flexShrink: 0,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '1rem 1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  row: {
    display: 'flex', flexDirection: 'column', gap: '0.15rem',
  },
  label: {
    fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-ghost)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  sectionLabel: {
    fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-ghost)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.1rem',
  },
  value: {
    fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5,
  },
  depositBox: {
    background: 'var(--bg-chip)', border: '1px solid var(--border-faint)',
    borderRadius: 8, padding: '0.65rem 0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.2rem',
  },
  divider: {
    borderTop: '1px solid var(--border-faint)', margin: '0.25rem 0',
  },
  actions: {
    display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
    padding: '1rem 1.25rem', borderTop: '1px solid var(--border-faint)', flexShrink: 0,
  },
  linkBtn: {
    background: 'none', border: 'none', padding: 0, marginTop: '0.5rem', display: 'block',
    color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
  },
  stationPicker: {
    background: 'var(--bg-chip)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  stationLabel: {
    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)',
  },
  stationBtn: {
    padding: '0.4rem 0.75rem', borderRadius: 6,
    border: '1px solid var(--border-strong)', background: 'var(--bg-input)',
    color: 'var(--text)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
  },
};
