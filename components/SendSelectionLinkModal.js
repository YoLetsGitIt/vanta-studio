'use client';

import { useEffect, useState } from 'react';
import { bookingActions } from '@/lib/bookingActions';
import { hasArtist } from '@/lib/format';
import { showError } from '@/lib/feedback';

export default function SendSelectionLinkModal({ booking, artists = [], stripeConnected = false, onClose, onSent }) {
  const [hours, setHours] = useState(168);
  const [duration, setDuration] = useState(60);
  const [quote, setQuote] = useState('');
  const [artistId, setArtistId] = useState('');
  const [deposit, setDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const needsArtist = !hasArtist(booking?.artist_id);

  useEffect(() => {
    setDuration(booking?.proposed_duration_minutes ?? 60);
    setQuote(booking?.estimated_quote ? String(booking.estimated_quote) : '');
    setArtistId(hasArtist(booking?.artist_id) ? booking.artist_id : '');
  }, [booking]);

  async function submit() {
    if (!booking?.id || (needsArtist && !artistId)) return;
    setSaving(true);
    try {
      await bookingActions.sendSelectionLink(booking.id, {
        expiresHours: hours,
        depositRequired: deposit,
        depositAmount: deposit && depositAmount ? Number(depositAmount) : null,
        durationMinutes: duration,
        estimatedQuote: quote ? Number(quote) : null,
        artistId: artistId || null,
      });
      await onSent?.(booking.id);
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="selection-link-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="selection-link-modal">
        <h3>{booking?.status === 'awaiting_payment' ? 'Resend selection link' : 'Send selection link'}</h3>
        <p>Choose the appointment details included in the client&apos;s secure selection link.</p>
        {needsArtist && <Field label="Artist"><select value={artistId} onChange={e => setArtistId(e.target.value)}><option value="">Select an artist</option>{artists.map(a => <option key={a.artistId ?? a.id} value={a.artistId ?? a.id}>{a.name}</option>)}</select></Field>}
        <Field label="Duration"><select value={duration} onChange={e => setDuration(Number(e.target.value))}>{[60,90,120,180,240,300,360,480].map(m => <option key={m} value={m}>{m === 480 ? 'Full day (8 hrs)' : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>)}</select></Field>
        <Field label="Quote"><input type="number" min="0" value={quote} onChange={e => setQuote(e.target.value)} placeholder="e.g. 350" /></Field>
        <Field label="Link expires"><select value={hours} onChange={e => setHours(Number(e.target.value))}><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option><option value={168}>7 days</option><option value={336}>14 days</option></select></Field>
        {stripeConnected && <><label className="selection-link-check"><input type="checkbox" checked={deposit} onChange={e => setDeposit(e.target.checked)} /> Require a deposit</label>{deposit && <input type="number" min="0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Deposit amount ($)" />}</>}
        <div className="selection-link-actions"><button onClick={onClose}>Cancel</button><button className="primary" disabled={saving || (needsArtist && !artistId)} onClick={submit}>{saving ? 'Sending…' : 'Send link'}</button></div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="selection-link-field"><span>{label}</span>{children}</label>;
}
