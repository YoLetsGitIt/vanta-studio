'use client';

// "Book a time": the studio books a request straight into a time, with no artist
// acceptance. With a deposit the client is emailed the deposit link and paying it
// locks the booking in; without one it's confirmed straight away.
import { useEffect, useState } from 'react';
import { bookingActions } from '@/lib/bookingActions';
import { hasArtist } from '@/lib/format';
import { getStudioArtists } from '@/lib/api';
import { showError } from '@/lib/feedback';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';

const pad = n => String(n).padStart(2, '0');
const DURATIONS = [30, 60, 90, 120, 180, 240, 300, 360, 480];
const NO_ARTISTS = []; // stable default so the artist fetch runs once

export default function BookTimeModal({ booking, artists: givenArtists = NO_ARTISTS, depositsReady = false, onClose, onBooked }) {
  const [artists, setArtists] = useState(givenArtists);
  useEffect(() => {
    if (givenArtists.length) { setArtists(givenArtists); return; }
    getStudioArtists('approved').then(d => setArtists(d.artists ?? [])).catch(() => {});
  }, [givenArtists]);
  const bookingArtistId = booking?.artist_id ?? booking?.artistId;
  const tomorrow = new Date(Date.now() + 86400000);
  const [artistId, setArtistId] = useState('');
  const [date, setDate] = useState(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
  const [time, setTime] = useState('11:00');
  const [duration, setDuration] = useState(60);
  const [quote, setQuote] = useState('');
  const [deposit, setDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const known = hasArtist(bookingArtistId) && artists.some(a => String(a.artistId ?? a.artist_id ?? a.id) === String(bookingArtistId));
    setArtistId(known ? String(bookingArtistId) : '');
    setDuration(booking?.proposed_duration_minutes ?? booking?.duration_minutes ?? 60);
    setQuote(booking?.estimated_quote ? String(booking.estimated_quote) : '');
    if (booking?.deposit_amount) { setDeposit(true); setDepositAmount(String(booking.deposit_amount)); }
  }, [booking, bookingArtistId, artists]);

  const quoteNum = quote ? Number(quote) : null;
  const depositNum = deposit && depositAmount ? Number(depositAmount) : null;
  const depositInvalid = deposit && (!depositNum || depositNum <= 0 || (quoteNum > 0 && depositNum > quoteNum));
  const ready = artistId && date && time && !depositInvalid;

  async function submit() {
    if (saving || !ready) return;
    setErrorMessage('');
    setSaving(true);
    try {
      const result = await bookingActions.bookTime(booking.id, {
        artistId, chosenTime: new Date(`${date}T${time}:00`).toISOString(), durationMinutes: duration,
        estimatedQuote: quoteNum, depositRequired: deposit, depositAmount: depositNum,
      });
      await onBooked?.(booking.id, result);
      onClose();
    } catch (error) {
      setErrorMessage(error?.message || 'Could not book this time. Please try again.');
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      title="Book a time"
      description="Book this client straight in. The artist doesn’t need to accept."
      onClose={onClose}
      dismissDisabled={saving}
      maxWidth={460}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={!ready} loading={saving} loadingLabel="Booking…" onClick={submit}>{deposit ? 'Book & send deposit link' : 'Book & confirm'}</Button>
        </>
      )}
    >
      <fieldset disabled={saving} style={{ display: 'grid', gap: 'var(--space-4)', margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        <Field label="Artist" required>
          <Select value={artistId} onChange={e => setArtistId(e.target.value)} aria-label="Artist">
            <option value="">Choose an artist</option>
            {artists.map(artist => {
              const id = artist.artistId ?? artist.artist_id ?? artist.id;
              return <option key={id} value={id}>{artist.name}</option>;
            })}
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-3)' }}>
          <Field label="Date" required>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
          </Field>
          <Field label="Start time" required>
            <Input type="time" step="900" value={time} onChange={e => setTime(e.target.value)} aria-label="Start time" />
          </Field>
        </div>
        <Field label="Duration">
          <Select value={duration} onChange={e => setDuration(Number(e.target.value))} aria-label="Duration">
            {DURATIONS.map(m => <option key={m} value={m}>{m === 480 ? 'Full day (8 hrs)' : m < 60 ? '30 minutes' : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>)}
          </Select>
        </Field>
        <Field label="Quote" hint="Shown to the client as an estimate.">
          <Input type="number" inputMode="decimal" min="0" step="0.01" value={quote} onChange={e => setQuote(e.target.value)} placeholder="e.g. 350" aria-label="Quote" />
        </Field>
        {depositsReady ? (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 44, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={deposit} onChange={e => setDeposit(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
              Require a deposit to lock it in
            </label>
            {deposit && (
              <Field label="Deposit amount ($)" hint={depositInvalid && quoteNum > 0 && depositNum > quoteNum ? 'The deposit can’t be more than the quote.' : 'The client is emailed a link to pay. Paying confirms the booking.'}>
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" aria-label="Deposit amount" />
              </Field>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-ghost)' }}>To ask for a deposit, add Stripe, PayID or bank transfer in Settings → Payments.</p>
        )}
      </fieldset>
      {errorMessage && <p role="alert" style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-danger)', fontSize: '0.875rem' }}>{errorMessage}</p>}
    </Dialog>
  );
}
