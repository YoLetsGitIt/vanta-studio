'use client';

// "Studio confirms", for a request without weekly availability: the studio sends the
// client a quote and session length, and the client is emailed a link to send their
// availability. Once it arrives the studio offers times.
import { useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';
import { requestAvailability } from '@/lib/api';
import { hasArtist } from '@/lib/format';
import { TypeChips, lengthLabel, useTypePricing, withLength } from '@/components/TypePricing';

const DURATIONS = [30, 60, 90, 120, 180, 240, 300, 360, 480];

export default function SendQuoteModal({ booking, onClose, onSent }) {
  const startLength = booking?.proposed_duration_minutes ?? booking?.duration_minutes ?? 120;
  const [quote, setQuote] = useState(booking?.estimated_quote ? String(booking.estimated_quote) : '');
  const [duration, setDuration] = useState(startLength || 120);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const first = booking?.requester_name?.split(' ')[0] || 'The client';
  // Priced from the requested artist's rate, when the client picked one.
  const artistId = hasArtist(booking?.artist_id) ? String(booking.artist_id) : '';
  const pricing = useTypePricing({ booking, artistId, duration, setDuration, setQuote });

  async function send(e) {
    e?.preventDefault();
    const amount = Number(quote);
    if (!(amount > 0)) { setError('Enter the quote.'); return; }
    setSaving(true); setError('');
    try {
      await requestAvailability(booking.id, { estimatedQuote: amount, durationMinutes: Number(duration) });
      await pricing.saveType(booking.id);
      await onSent?.();
      onClose();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <Dialog title="Send a quote" maxWidth={460} onClose={onClose}
      description={`${first} will get the quote and session length by email, with a link to send the days and times that suit them. You’ll offer times once it arrives.`}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={send} loading={saving} loadingLabel="Sending…">Send quote</Button>
      </>}>
      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <TypeChips pricing={pricing} />
        <Field label="Quote" required hint={pricing.hint || undefined}>
          <Input inputMode="decimal" value={quote} onChange={e => { setQuote(e.target.value); setError(''); pricing.quoteTyped(); }} placeholder="$0" autoFocus />
        </Field>
        <Field label="Session length" required>
          <Select value={duration} onChange={e => setDuration(Number(e.target.value))}>
            {withLength(DURATIONS, duration).map(m => <option key={m} value={m}>{lengthLabel(m)}</option>)}
          </Select>
        </Field>
        {error && <p role="alert" className="studio-field-error">{error}</p>}
      </form>
    </Dialog>
  );
}
