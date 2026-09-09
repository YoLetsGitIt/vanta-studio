'use client';

import { useEffect, useState } from 'react';
import { bookingActions } from '@/lib/bookingActions';
import { hasArtist } from '@/lib/format';
import { showError } from '@/lib/feedback';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';

export default function SendSelectionLinkModal({ booking, artists = [], stripeConnected = false, onClose, onSent }) {
  const [hours, setHours] = useState(168);
  const [duration, setDuration] = useState(60);
  const [quote, setQuote] = useState('');
  const [artistId, setArtistId] = useState('');
  const [deposit, setDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const bookingArtistId = booking?.artist_id ?? booking?.artistId;
  const assignedArtistIsAvailable = hasArtist(bookingArtistId) && artists.some(artist =>
    String(artist.artistId ?? artist.artist_id ?? artist.id) === String(bookingArtistId)
  );
  const needsArtist = !assignedArtistIsAvailable;

  useEffect(() => {
    setDuration(booking?.proposed_duration_minutes ?? 60);
    setQuote(booking?.estimated_quote ? String(booking.estimated_quote) : '');
    setArtistId(assignedArtistIsAvailable ? bookingArtistId : '');
  }, [booking, bookingArtistId, assignedArtistIsAvailable]);

  async function submit() {
    if (saving || !booking?.id || (needsArtist && !artistId)) return;
    setErrorMessage('');
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
      setErrorMessage(error?.message || 'Unable to send the selection link. Please try again.');
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      title={booking?.status === 'awaiting_payment' ? 'Resend selection link' : 'Send selection link'}
      description="Choose the appointment details included in the client's secure selection link."
      onClose={onClose}
      dismissDisabled={saving}
      maxWidth={460}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={!artistId} loading={saving} loadingLabel="Sending…" onClick={submit}>Send link</Button>
        </>
      )}
    >
      <fieldset disabled={saving} style={{ display: 'grid', gap: 'var(--space-4)', margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        <Field
          label={needsArtist ? 'Assign artist' : 'Artist'}
          required={needsArtist}
          hint={!needsArtist ? 'Artist is already assigned to this booking.' : undefined}
        >
          <Select value={artistId} onChange={e => setArtistId(e.target.value)} disabled={!needsArtist}>
            <option value="">Unassigned artist</option>
            {artists.map(artist => {
              const id = artist.artistId ?? artist.artist_id ?? artist.id;
              return <option key={id} value={id}>{artist.name}</option>;
            })}
          </Select>
        </Field>
        <Field label="Duration">
          <Select value={duration} onChange={e => setDuration(Number(e.target.value))}>
            {[60, 90, 120, 180, 240, 300, 360, 480].map(minutes => (
              <option key={minutes} value={minutes}>
                {minutes === 480 ? 'Full day (8 hrs)' : `${minutes / 60} hour${minutes === 60 ? '' : 's'}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quote">
          <Input type="number" inputMode="decimal" min="0" step="0.01" value={quote} onChange={e => setQuote(e.target.value)} placeholder="e.g. 350" />
        </Field>
        <Field label="Link expires">
          <Select value={hours} onChange={e => setHours(Number(e.target.value))}>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={72}>72 hours</option>
            <option value={168}>7 days</option>
            <option value={336}>14 days</option>
          </Select>
        </Field>
        {stripeConnected && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 44, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={deposit} onChange={e => setDeposit(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
              Require a deposit
            </label>
            {deposit && (
              <Field label="Deposit amount ($)">
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" />
              </Field>
            )}
          </>
        )}
      </fieldset>
      {errorMessage && <p role="alert" style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-danger)', fontSize: '0.875rem' }}>{errorMessage}</p>}
    </Dialog>
  );
}
