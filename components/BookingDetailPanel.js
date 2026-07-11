'use client';

import { useState, useEffect } from 'react';
import { getAvailableStations, getClientConsents, recordConsentInStudio, saveBookingNote } from '@/lib/api';

const STATUS_COLORS = {
  pending:                      { bg: 'rgba(245,158,58,0.12)',  text: '#f59e3a', border: 'rgba(245,158,58,0.25)' },
  proposed:                     { bg: 'rgba(111,163,232,0.12)', text: '#6fa3e8', border: 'rgba(111,163,232,0.25)' },
  modified:                     { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  awaiting_deposit:             { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  deposit_pending_confirmation: { bg: 'rgba(250,204,21,0.12)',  text: '#facc15', border: 'rgba(250,204,21,0.25)' },
  confirmed:                    { bg: 'rgba(76,201,138,0.12)',  text: '#4cc98a', border: 'rgba(76,201,138,0.25)' },
  completed:                    { bg: 'rgba(76,201,138,0.1)',   text: '#4cc98a', border: 'rgba(76,201,138,0.2)'  },
  no_show:                      { bg: 'rgba(232,111,111,0.08)', text: '#e86f6f', border: 'rgba(232,111,111,0.15)' },
  rejected:                     { bg: 'rgba(232,111,111,0.1)',  text: '#e86f6f', border: 'rgba(232,111,111,0.2)'  },
  declined:                     { bg: 'rgba(232,111,111,0.07)', text: '#e06060', border: 'rgba(232,111,111,0.15)' },
  cancelled:                    { bg: 'var(--bg-chip)', text: 'var(--text-ghost)', border: 'var(--border-faint)' },
  timed_out:                    { bg: 'var(--bg-chip)', text: 'var(--text-faint)', border: 'var(--border-faint)' },
};

const STATUS_LABELS = {
  pending: 'Pending', proposed: 'Proposed', modified: 'Modified',
  awaiting_deposit: 'Awaiting Deposit', deposit_pending_confirmation: 'Dep. Pending',
  confirmed: 'Confirmed', completed: 'Completed', no_show: 'No Show',
  rejected: 'Rejected', declined: 'Declined', cancelled: 'Cancelled', timed_out: 'Timed Out',
};

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
function fmtDob(dob) {
  if (!dob) return null;
  return new Date(dob + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

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
  // ── Station picker state ───────────────────────────────────────────────────
  const [stationStep,       setStationStep]       = useState(false);
  const [availableStations, setAvailableStations] = useState([]);
  const [stationsLoading,   setStationsLoading]   = useState(false);
  const [stationError,      setStationError]      = useState('');

  // ── Studio notes state ────────────────────────────────────────────────────
  const [noteText,    setNoteText]    = useState('');
  const [noteSaving,  setNoteSaving]  = useState(false);
  const [noteSaved,   setNoteSaved]   = useState(false);

  // ── Consent state ──────────────────────────────────────────────────────────
  const [consent,        setConsent]        = useState(null);
  const [consentVersion, setConsentVersion] = useState('1');
  const [recording,      setRecording]      = useState(false);

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
  const cancelReason      = booking?.cancellation_reason ?? null;
  const source            = booking?.source              ?? null;

  const isCompleted = status === 'completed';
  const isNoShow    = status === 'no_show';

  const today      = new Date().toLocaleDateString('en-CA');
  const chosenDate = chosenTime ? chosenTime.slice(0, 10) : null;
  const isFutureConfirmed = status === 'confirmed' && chosenDate && chosenDate > today;
  const canAcceptReject   = ['pending', 'modified', 'awaiting_deposit'].includes(status);
  const canComplete       = status === 'confirmed' && chosenDate && chosenDate <= today;
  const canReject         = canAcceptReject;

  const sc = STATUS_COLORS[status] ?? { bg: 'var(--bg-chip)', text: 'var(--text-ghost)', border: 'var(--border-faint)' };

  // ── Sync studio note when booking changes ─────────────────────────────────
  useEffect(() => {
    setNoteText(booking?.studio_note ?? '');
    setNoteSaved(false);
  }, [bookingId, booking?.studio_note]);

  async function handleSaveNote() {
    if (!bookingId) return;
    setNoteSaving(true);
    try {
      await saveBookingNote(bookingId, noteText);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch { /* silent */ }
    finally { setNoteSaving(false); }
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

  async function handleRecordConsent() {
    if (!email) return;
    setRecording(true);
    try {
      await recordConsentInStudio(email);
      setConsent({ consent_version: consentVersion, agreed_at: new Date().toISOString(), source: 'in_studio' });
    } catch (e) { alert(e.message); }
    finally { setRecording(false); }
  }

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
        {(isCompleted || isNoShow) && (
          <div style={{
            background: isCompleted ? 'rgba(76,201,138,0.07)' : 'rgba(232,111,111,0.06)',
            border: `1px solid ${isCompleted ? 'rgba(76,201,138,0.2)' : 'rgba(232,111,111,0.15)'}`,
            borderRadius: 10, padding: '0.85rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isCompleted ? '#4cc98a' : '#e86f6f' }}>
                {isCompleted ? '✓ Completed' : '✗ No Show'}
              </span>
              {outcomeAt && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)', marginLeft: 'auto' }}>
                  {new Date(outcomeAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {isCompleted && finalPrice != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>Final price</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>${finalPrice}</span>
              </div>
            )}
            {isCompleted && paymentMethod && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-ghost)' }}>Payment</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{PAYMENT_LABELS[paymentMethod] ?? paymentMethod}</span>
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
                {STATUS_LABELS[status] ?? cap(status)}
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
        <span style={p.sectionLabel}>Client information</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{clientName}</span>
          {email && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{email}</span>}
          {phone && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{phone}</span>}
          {dob   && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{fmtDob(dob)}</span>}
        </div>

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
                const bsc = STATUS_COLORS[bk.status] ?? { text: 'var(--text-ghost)' };
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
                      {STATUS_LABELS[bk.status] ?? cap(bk.status)}
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
            value={noteText}
            onChange={e => { setNoteText(e.target.value); setNoteSaved(false); }}
            placeholder="Internal note — not visible to client…"
            rows={3}
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
              onClick={handleSaveNote}
              disabled={noteSaving}
              style={{
                fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem',
                borderRadius: 5, border: '1px solid var(--border-faint)',
                background: noteSaved ? 'rgba(76,201,138,0.12)' : 'var(--bg-chip)',
                color: noteSaved ? '#4cc98a' : 'var(--text-dim)', cursor: 'pointer',
              }}
            >
              {noteSaved ? 'Saved' : noteSaving ? 'Saving…' : 'Save note'}
            </button>
          </div>
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
