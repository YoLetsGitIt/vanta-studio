'use client';

// "Offer times": for a request that already has the client's weekly availability, the
// studio picks up to three times. The client is emailed a link to choose one; choosing
// books it (or asks for the deposit first, and paying confirms it).
import { useEffect, useState } from 'react';
import { bookingActions } from '@/lib/bookingActions';
import { hasArtist } from '@/lib/format';
import { getStudioArtists } from '@/lib/api';
import { describeAvailability } from '@/lib/availability';
import { showError } from '@/lib/feedback';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';

const pad = n => String(n).padStart(2, '0');
const DURATIONS = [30, 60, 90, 120, 180, 240, 300, 360, 480];
const MAX_TIMES = 3;
const NO_ARTISTS = [];
const toDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const minutes = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

// The next few days (from tomorrow) that fall in the client's availability, at the window's start.
function suggestTimes(windows, count) {
  const out = [];
  if (!Array.isArray(windows) || !windows.length) return out;
  for (let i = 1; i <= 28 && out.length < count; i++) {
    const day = new Date(); day.setDate(day.getDate() + i);
    const w = windows.filter(x => x.day_of_week === day.getDay()).sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    if (w) out.push({ date: toDate(day), time: w.start_time.slice(0, 5) });
  }
  return out;
}

// True when the slot sits inside one of the client's weekly windows.
function withinAvailability(windows, date, time, duration) {
  if (!Array.isArray(windows) || !windows.length || !date || !time) return true;
  const dow = new Date(`${date}T00:00:00`).getDay();
  const start = minutes(time), end = start + duration;
  return windows.some(w => w.day_of_week === dow && minutes(w.start_time) <= start && end <= (w.end_time === '23:59' ? 1440 : minutes(w.end_time)));
}

export default function OfferTimesModal({ booking, offer = null, artists: givenArtists = NO_ARTISTS, depositsReady = false, onClose, onOffered }) {
  const [artists, setArtists] = useState(givenArtists);
  useEffect(() => {
    if (givenArtists.length) { setArtists(givenArtists); return; }
    getStudioArtists('approved').then(d => setArtists(d.artists ?? [])).catch(() => {});
  }, [givenArtists]);
  const windows = booking?.availability_windows ?? [];
  const availability = describeAvailability(windows);
  const bookingArtistId = offer?.artist_id ?? booking?.artist_id ?? booking?.artistId;

  const [artistId, setArtistId] = useState('');
  const [rows, setRows] = useState(() => {
    if (offer?.times?.length) return offer.times.map(t => { const d = new Date(t); return { date: toDate(d), time: toTime(d) }; });
    const suggested = suggestTimes(windows, 1);
    return suggested.length ? suggested : [{ date: '', time: '11:00' }];
  });
  const [duration, setDuration] = useState(60);
  const [quote, setQuote] = useState('');
  const [deposit, setDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const known = hasArtist(bookingArtistId) && artists.some(a => String(a.artistId ?? a.artist_id ?? a.id) === String(bookingArtistId));
    setArtistId(known ? String(bookingArtistId) : '');
  }, [bookingArtistId, artists]);
  useEffect(() => {
    setDuration(offer?.duration_minutes ?? booking?.proposed_duration_minutes ?? booking?.duration_minutes ?? 60);
    const q = offer?.estimated_quote ?? booking?.estimated_quote;
    setQuote(q ? String(q) : '');
    const dep = offer ? offer.deposit_amount : booking?.deposit_amount;
    if (dep) { setDeposit(true); setDepositAmount(String(dep)); }
  }, [booking, offer]);

  const setRow = (i, patch) => setRows(list => list.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  function addRow() {
    setRows(list => {
      if (list.length >= MAX_TIMES) return list;
      const taken = new Set(list.map(r => r.date));
      const next = suggestTimes(windows, 10).find(s => !taken.has(s.date));
      return [...list, next ?? { date: '', time: list.at(-1)?.time || '11:00' }];
    });
  }

  const quoteNum = quote ? Number(quote) : null;
  const depositNum = deposit && depositAmount ? Number(depositAmount) : null;
  const depositInvalid = deposit && (!depositNum || depositNum <= 0 || (quoteNum > 0 && depositNum > quoteNum));
  const slots = rows.map(r => (r.date && r.time ? new Date(`${r.date}T${r.time}:00`) : null));
  const keys = slots.map(d => d?.getTime());
  const duplicate = i => keys[i] != null && keys.indexOf(keys[i]) !== i;
  const past = i => slots[i] && slots[i].getTime() <= Date.now();
  const ready = artistId && slots.every(Boolean) && !slots.some((_, i) => duplicate(i) || past(i)) && !depositInvalid;

  async function submit() {
    if (saving || !ready) return;
    setErrorMessage('');
    setSaving(true);
    try {
      const result = await bookingActions.offerTimes(booking.id, {
        artistId, times: slots.map(d => d.toISOString()), durationMinutes: duration,
        estimatedQuote: quoteNum, depositRequired: deposit, depositAmount: depositNum,
      });
      await onOffered?.(booking.id, result);
      onClose();
    } catch (error) {
      setErrorMessage(error?.message || 'Could not send these times. Please try again.');
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  const clientName = booking?.requester_name || 'the client';
  return (
    <Dialog
      title={offer ? 'Change offered times' : 'Offer times'}
      description={`Pick up to three times. ${clientName} gets an email to choose one${deposit ? ', then pays the deposit to confirm' : ', which confirms the booking'}.`}
      onClose={onClose}
      dismissDisabled={saving}
      maxWidth={500}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={!ready} loading={saving} loadingLabel="Sending…" onClick={submit}>
            {rows.length > 1 ? `Send ${rows.length} times` : 'Send time'}
          </Button>
        </>
      )}
    >
      <fieldset disabled={saving} style={{ display: 'grid', gap: 'var(--space-4)', margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        {availability.length > 0 && (
          <section aria-label="Client's weekly availability" style={o.availability}>
            <span style={o.availabilityTitle}>Their availability</span>
            {availability.map(a => (
              <span key={a.day} style={o.availabilityRow}><b style={{ color: 'var(--text)', fontWeight: 600 }}>{a.day}</b> · {a.times}</span>
            ))}
          </section>
        )}
        <Field label="Artist" required>
          <Select value={artistId} onChange={e => setArtistId(e.target.value)} aria-label="Artist">
            <option value="">Choose an artist</option>
            {artists.map(artist => {
              const id = artist.artistId ?? artist.artist_id ?? artist.id;
              return <option key={id} value={id}>{artist.name}</option>;
            })}
          </Select>
        </Field>
        <Field label="Duration">
          <Select value={duration} onChange={e => setDuration(Number(e.target.value))} aria-label="Duration">
            {DURATIONS.map(m => <option key={m} value={m}>{m === 480 ? 'Full day (8 hrs)' : m < 60 ? '30 minutes' : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>)}
          </Select>
        </Field>

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {rows.map((row, i) => {
            const outside = !withinAvailability(windows, row.date, row.time, duration);
            const note = duplicate(i) ? 'Same as another option.' : past(i) ? 'This time has passed.' : outside ? 'Outside their availability.' : null;
            return (
              <div key={i} style={o.option}>
                <div style={o.optionHead}>
                  <span style={o.optionLabel}>Option {i + 1}</span>
                  {rows.length > 1 && (
                    <button type="button" style={o.remove} onClick={() => setRows(list => list.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`}>Remove</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 'var(--space-3)' }}>
                  <Input type="date" value={row.date} onChange={e => setRow(i, { date: e.target.value })} aria-label={`Option ${i + 1} date`} />
                  <Input type="time" step="900" value={row.time} onChange={e => setRow(i, { time: e.target.value })} aria-label={`Option ${i + 1} start time`} />
                </div>
                {note && <span role={duplicate(i) || past(i) ? 'alert' : undefined} style={{ ...o.note, color: duplicate(i) || past(i) ? 'var(--color-danger)' : 'var(--color-warning, #e0a84f)' }}>{note}</span>}
              </div>
            );
          })}
          {rows.length < MAX_TIMES && (
            <Button variant="secondary" size="sm" onClick={addRow} style={{ justifySelf: 'start' }}>+ Add another time</Button>
          )}
        </div>

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
              <Field label="Deposit amount ($)" hint={depositInvalid && quoteNum > 0 && depositNum > quoteNum ? 'The deposit can’t be more than the quote.' : 'After choosing a time the client pays this to confirm.'}>
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

const o = {
  availability: { display: 'grid', gap: 2, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-muted)' },
  availabilityTitle: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 2 },
  availabilityRow: { lineHeight: 1.5 },
  option: { display: 'grid', gap: 6 },
  optionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  optionLabel: { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' },
  remove: { background: 'none', border: 0, padding: '4px 0', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' },
  note: { fontSize: '0.8125rem' },
};
