'use client';

// "Offer times": for a request that already has the client's weekly availability, the
// studio picks up to three times. The client is emailed a link to choose one; choosing
// books it (or asks for the deposit first, and paying confirms it).
import { useEffect, useState } from 'react';
import { bookingActions } from '@/lib/bookingActions';
import { hasArtist } from '@/lib/format';
import { getStudioArtists, checkOfferTimes, getArtistWorkSchedule, getStudioScheduleRange } from '@/lib/api';
import { describeAvailability, formatTime } from '@/lib/availability';
import { showError } from '@/lib/feedback';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';
import OfferWeekView, { mondayOf } from '@/components/OfferWeekView';
import { TypeChips, lengthLabel, useTypePricing, withLength } from '@/components/TypePricing';

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
  // Week shown in the calendar: the week of the first option, or this week.
  const [weekStart, setWeekStart] = useState(() => mondayOf(rows[0]?.date ? new Date(`${rows[0].date}T00:00:00`) : new Date()));
  const [duration, setDuration] = useState(60);
  const [quote, setQuote] = useState('');
  const [deposit, setDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const known = hasArtist(bookingArtistId) && artists.some(a => String(a.artistId ?? a.artist_id ?? a.id) === String(bookingArtistId));
    // The request's artist, or the only artist at the studio.
    const only = artists.length === 1 ? String(artists[0].artistId ?? artists[0].artist_id ?? artists[0].id) : '';
    setArtistId(current => current || (known ? String(bookingArtistId) : only));
  }, [bookingArtistId, artists]);
  useEffect(() => {
    setDuration(offer?.duration_minutes ?? booking?.proposed_duration_minutes ?? booking?.duration_minutes ?? 60);
    const q = offer?.estimated_quote ?? booking?.estimated_quote;
    setQuote(q ? String(q) : '');
    const dep = offer ? offer.deposit_amount : booking?.deposit_amount;
    if (dep) { setDeposit(true); setDepositAmount(String(dep)); }
  }, [booking, offer]);

  // The chosen artist's weekly hours at this studio and their bookings over the next
  // four weeks, shown beside the client's availability. null = loading.
  const [artistHours, setArtistHours] = useState(null);
  const [artistBookings, setArtistBookings] = useState(null);
  useEffect(() => {
    if (!artistId) { setArtistHours(null); setArtistBookings(null); return undefined; }
    let active = true;
    setArtistBookings(null);
    const studioId = booking?.studio_id;
    getArtistWorkSchedule(artistId)
      .then(d => {
        if (!active) return;
        const rows = (d.schedule ?? []).filter(r => !studioId || !r.studio_id || r.studio_id === studioId);
        setArtistHours(rows.map(r => ({ day_of_week: r.day_of_week, start_time: String(r.start_time).slice(0, 5), end_time: String(r.end_time).slice(0, 5) })));
      })
      .catch(() => { if (active) setArtistHours([]); });
    const to = new Date(weekStart); to.setDate(to.getDate() + 6);
    getStudioScheduleRange(toDate(weekStart), toDate(to))
      .then(d => {
        if (!active) return;
        setArtistBookings((d.entries ?? [])
          .filter(e => String(e.artistId) === String(artistId) && e.chosenTime && e.bookingId !== booking?.id && e.status !== 'cancelled')
          .sort((a, b) => new Date(a.chosenTime) - new Date(b.chosenTime)));
      })
      .catch(() => { if (active) setArtistBookings([]); });
    return () => { active = false; };
  }, [artistId, booking?.id, booking?.studio_id, weekStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const artistHoursList = describeAvailability(artistHours ?? []);
  const clientDays = new Set(windows.map(w => w.day_of_week));
  const bothFree = new Set((artistHours ?? []).filter(h => clientDays.has(h.day_of_week)).map(h => h.day_of_week));
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const setRow = (i, patch) => {
    setRows(list => list.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    // Show the week of a date typed into an option.
    if (patch.date) setWeekStart(mondayOf(new Date(`${patch.date}T00:00:00`)));
  };
  function addRow() {
    setRows(list => {
      if (list.length >= MAX_TIMES) return list;
      const taken = new Set(list.map(r => r.date));
      const next = suggestTimes(windows, 10).find(s => !taken.has(s.date));
      return [...list, next ?? { date: '', time: list.at(-1)?.time || '11:00' }];
    });
  }

  // Tapping the calendar fills the first option without a date, or adds one (up to three).
  function pickFromWeek(date, time) {
    setRows(list => {
      const empty = list.findIndex(r => !r.date);
      if (empty >= 0) return list.map((r, j) => (j === empty ? { date, time } : r));
      return list.length < MAX_TIMES ? [...list, { date, time }] : list;
    });
  }

  const pricing = useTypePricing({ booking, artistId, duration, setDuration, setQuote, setDeposit, setDepositAmount, depositsReady });
  const quoteNum = quote ? Number(quote) : null;
  const depositNum = deposit && depositAmount ? Number(depositAmount) : null;
  const depositInvalid = deposit && (!depositNum || depositNum <= 0 || (quoteNum > 0 && depositNum > quoteNum));
  const slots = rows.map(r => (r.date && r.time ? new Date(`${r.date}T${r.time}:00`) : null));
  const keys = slots.map(d => d?.getTime());
  const duplicate = i => keys[i] != null && keys.indexOf(keys[i]) !== i;
  const past = i => slots[i] && slots[i].getTime() <= Date.now();

  // Live check: is the artist free at each time? Same rule the server applies on send.
  // artistFree maps a slot's timestamp to { state: 'checking' | 'free' | 'taken', message }.
  const [artistFree, setArtistFree] = useState({});
  const checkable = slots.map((d, i) => (d && !past(i) && !duplicate(i) ? d : null));
  const checkKey = `${artistId}|${duration}|${checkable.map(d => d?.getTime() ?? '').join(',')}`;
  useEffect(() => {
    const times = checkable.filter(Boolean);
    if (!artistId || !times.length || !booking?.id) { setArtistFree({}); return undefined; }
    setArtistFree(prev => Object.fromEntries(times.map(d => [d.getTime(), prev[d.getTime()]?.state ? { ...prev[d.getTime()], state: 'checking' } : { state: 'checking' }])));
    let active = true;
    const timer = setTimeout(() => {
      checkOfferTimes(booking.id, { artistId, durationMinutes: duration, times: times.map(d => d.toISOString()) })
        .then(results => {
          if (!active) return;
          setArtistFree(Object.fromEntries(times.map((d, i) => [d.getTime(), results[i]?.available === false
            ? { state: 'taken', message: results[i].message || 'The artist isn’t free then.' }
            : { state: 'free' }])));
        })
        // If the check fails, the server still checks when sending.
        .catch(() => { if (active) setArtistFree({}); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [checkKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const taken = i => artistFree[keys[i]]?.state === 'taken';
  // Say what's stopping the send instead of leaving the button greyed out unexplained.
  const blocker = !artistId ? 'Choose an artist to send these times.'
    : !slots.every(Boolean) ? 'Add a date and start time for each option.'
    : slots.some((_, i) => duplicate(i)) ? 'Two options are the same time.'
    : slots.some((_, i) => past(i)) ? 'One of the times has already passed.'
    : slots.some((_, i) => taken(i)) ? 'The artist isn’t free at one of these times. Change it before sending.'
    : depositInvalid ? (quoteNum > 0 && depositNum > quoteNum ? 'The deposit can’t be more than the quote.' : 'Enter the deposit amount.')
    : '';
  const ready = !blocker;

  async function submit() {
    if (saving || !ready) return;
    setErrorMessage('');
    setSaving(true);
    try {
      const result = await bookingActions.offerTimes(booking.id, {
        artistId, times: slots.map(d => d.toISOString()), durationMinutes: duration,
        estimatedQuote: quoteNum, depositRequired: deposit, depositAmount: depositNum,
      });
      await pricing.saveType(booking.id);
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
  const artistName = artists.find(a => String(a.artistId ?? a.artist_id ?? a.id) === String(artistId))?.name;
  return (
    <Dialog
      title={offer ? 'Change offered times' : 'Offer times'}
      description={`Pick up to three times. ${clientName} gets an email to choose one${deposit ? ', then pays the deposit to confirm' : ', which confirms the booking'}.`}
      onClose={onClose}
      dismissDisabled={saving}
      maxWidth={680}
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
        <Field label="Artist" required>
          <Select value={artistId} onChange={e => setArtistId(e.target.value)} aria-label="Artist">
            <option value="">Choose an artist</option>
            {artists.map(artist => {
              const id = artist.artistId ?? artist.artist_id ?? artist.id;
              return <option key={id} value={id}>{artist.name}</option>;
            })}
          </Select>
        </Field>
        <TypeChips pricing={pricing} />
        {artistId ? (
          <OfferWeekView
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            clientWindows={windows}
            artistHours={artistHours ?? []}
            bookings={artistBookings ?? []}
            options={rows}
            duration={duration}
            onPick={pickFromWeek}
            onMove={(i, date, time) => setRow(i, { date, time })}
            canPick={rows.some(r => !r.date) || rows.length < MAX_TIMES}
          />
        ) : (
          <p style={o.choose}>Choose an artist to see their availability and {clientName === 'the client' ? 'the client’s' : `${clientName.split(' ')[0]}’s`} side by side.</p>
        )}
        {/* The same information as text, for screen readers. */}
        <div className="sr-only">
          {availability.length > 0 && (
            <section aria-label="Client's weekly availability">
              {availability.map(a => <p key={a.day}>{a.day}: {a.times}</p>)}
            </section>
          )}
          {artistId && (
            <section aria-label="Artist's availability">
              {artistHoursList.map(a => <p key={a.day}>{a.day}: {a.times}{bothFree.has(DAY_NAMES.indexOf(a.day)) ? ', both free' : ''}</p>)}
              {(artistBookings ?? []).map(e => {
                const start = new Date(e.chosenTime), end = new Date(start.getTime() + (e.durationMins ?? 60) * 60000);
                return <p key={e.bookingId}>Booked {start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}, {formatTime(toTime(start))} – {formatTime(toTime(end))}</p>;
              })}
            </section>
          )}
        </div>
        <Field label="Duration">
          <Select value={duration} onChange={e => setDuration(Number(e.target.value))} aria-label="Duration">
            {withLength(DURATIONS, duration).map(m => <option key={m} value={m}>{lengthLabel(m)}</option>)}
          </Select>
        </Field>

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {rows.map((row, i) => {
            const outside = !withinAvailability(windows, row.date, row.time, duration);
            const live = artistFree[keys[i]];
            const offHours = artistHours?.length > 0 && !withinAvailability(artistHours, row.date, row.time, duration);
            const note = duplicate(i) ? 'Same as another option.' : past(i) ? 'This time has passed.' : live?.state === 'taken' ? live.message
              : outside && offHours ? 'Outside their availability and the artist’s hours.' : outside ? 'Outside their availability.' : offHours ? 'Outside the artist’s hours.' : null;
            const danger = duplicate(i) || past(i) || live?.state === 'taken';
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
                {note && <span role={danger ? 'alert' : undefined} style={{ ...o.note, color: danger ? 'var(--color-danger)' : 'var(--color-warning, #e0a84f)' }}>{note}</span>}
                {!note && live?.state === 'free' && <span style={{ ...o.note, color: 'var(--color-success)' }}>✓ Artist is free</span>}
                {!note && live?.state === 'checking' && <span style={{ ...o.note, color: 'var(--text-muted)' }}>Checking the artist’s schedule…</span>}
              </div>
            );
          })}
          {rows.length < MAX_TIMES && (
            <Button variant="secondary" size="sm" onClick={addRow} style={{ justifySelf: 'start' }}>+ Add another time</Button>
          )}
        </div>

        <Field label="Quote" hint={pricing.hint || 'Shown to the client as an estimate.'}>
          <Input type="number" inputMode="decimal" min="0" step="0.01" value={quote} onChange={e => { setQuote(e.target.value); pricing.quoteTyped(); }} placeholder="e.g. 350" aria-label="Quote" />
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
      {blocker && <p role="status" style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-warning, #e0a84f)', fontSize: '0.875rem' }}>{blocker}</p>}
      {errorMessage && <p role="alert" style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-danger)', fontSize: '0.875rem' }}>{errorMessage}</p>}
    </Dialog>
  );
}

const o = {
  choose: { margin: 0, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-input)', border: '1px dashed var(--border)', fontSize: '0.875rem', color: 'var(--text-muted)' },
  availability: { display: 'grid', gap: 2, alignContent: 'start', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-muted)' },
  availabilityTitle: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 2 },
  availabilityRow: { lineHeight: 1.5 },
  option: { display: 'grid', gap: 6 },
  optionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  optionLabel: { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' },
  remove: { background: 'none', border: 0, padding: '4px 0', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' },
  note: { fontSize: '0.8125rem' },
};
