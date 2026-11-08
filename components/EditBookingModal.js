'use client';

// "Edit booking": change a booked appointment's date, time, length, artist and station
// in one save. The server refuses a double-booked artist or a station that's taken.
// When the time moves on an upcoming booking, the studio can email the client.
import { useEffect, useMemo, useState } from 'react';
import { bookingActions } from '@/lib/bookingActions';
import { getStations, getStudioArtists } from '@/lib/api';
import { getCached, setCached } from '@/lib/cache';
import { useStationAvailability } from '@/lib/useStationAvailability';
import { hasArtist } from '@/lib/format';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Field, { Input, Select, Textarea } from '@/components/ui/Field';
import { lengthLabel, withLength } from '@/components/TypePricing';

const pad = n => String(n).padStart(2, '0');
const DURATIONS = [30, 60, 90, 120, 180, 240, 300, 360, 480, 600];
const NO_ARTISTS = [];
const idOf = artist => String(artist.artistId ?? artist.artist_id ?? artist.id);

export default function EditBookingModal({ booking, artists: givenArtists = NO_ARTISTS, onClose, onSaved }) {
  const start = new Date(booking.chosen_time);
  const startDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const startLength = booking.proposed_duration_minutes || 120;
  const startArtist = hasArtist(booking.artist_id) ? String(booking.artist_id) : '';
  const startStation = booking.station_id ? String(booking.station_id) : '';

  const [date, setDate] = useState(startDate);
  const [time, setTime] = useState(startTime);
  const [duration, setDuration] = useState(startLength);
  const [artistId, setArtistId] = useState(startArtist);
  const [stationId, setStationId] = useState(startStation);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [artists, setArtists] = useState(givenArtists);
  useEffect(() => {
    if (givenArtists.length) { setArtists(givenArtists); return; }
    getStudioArtists('approved').then(d => setArtists(d.artists ?? [])).catch(() => {});
  }, [givenArtists]);
  const [stations, setStations] = useState(() => getCached('stations:all') ?? []);
  useEffect(() => {
    getStations().then(d => { const all = d.stations ?? []; setCached('stations:all', all); setStations(all); }).catch(() => {});
  }, []);

  const at = date && time ? new Date(`${date}T${time}:00`) : null;
  const atISO = at && !Number.isNaN(at.getTime()) ? at.toISOString() : '';
  // Which stations are free for the new time and length (this booking doesn't count).
  const { stations: free, loading: checking } = useStationAvailability({ date, startTime: atISO, durationMins: duration, excludeBookingId: booking.id });
  const freeIds = useMemo(() => new Set((free ?? []).map(s => String(s.id))), [free]);
  const stationTaken = Boolean(stationId) && free !== null && !checking && !freeIds.has(stationId);

  const timeMoved = atISO && new Date(atISO).getTime() !== start.getTime();
  const upcoming = at && at > new Date();
  const canEmail = timeMoved && upcoming && Boolean(booking.requester_email);
  const first = (booking.requester_name || 'the client').split(' ')[0];
  const changed = timeMoved || duration !== startLength || artistId !== startArtist || stationId !== startStation;
  const ready = changed && atISO && artistId && !stationTaken;

  async function save() {
    if (!ready || saving) return;
    setSaving(true); setError('');
    const body = {};
    if (timeMoved) body.chosen_time = atISO;
    if (duration !== startLength) body.duration_minutes = duration;
    if (artistId !== startArtist) body.artist_id = artistId;
    if (stationId !== startStation) body.station_id = stationId;
    if (canEmail && notify) { body.notify_client = true; body.message = message.trim(); }
    try {
      await bookingActions.edit(booking.id, body);
      await onSaved?.({ emailed: Boolean(body.notify_client), first });
      onClose();
    } catch (err) {
      const text = err?.message || 'Couldn’t save the booking. Please try again.';
      setError(text.charAt(0).toUpperCase() + text.slice(1).replace(/([^.!?])$/, '$1.'));
      setSaving(false);
    }
  }

  return (
    <Dialog title="Edit booking" maxWidth={460} onClose={onClose} dismissDisabled={saving}
      description={`${booking.requester_name || 'This booking'}. The artist and station can’t be double-booked.`}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={!ready} loading={saving} loadingLabel="Saving…">Save changes</Button>
      </>}>
      <form onSubmit={e => { e.preventDefault(); save(); }}>
        <fieldset disabled={saving} style={{ display: 'grid', gap: 'var(--space-4)', margin: 0, padding: 0, border: 0, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-3)' }}>
            <Field label="Date" required>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Start time" required>
              <Input type="time" step="900" value={time} onChange={e => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Length" required>
            <Select value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {withLength(DURATIONS, duration).map(m => <option key={m} value={m}>{lengthLabel(m)}</option>)}
            </Select>
          </Field>
          <Field label="Artist" required>
            <Select value={artistId} onChange={e => setArtistId(e.target.value)}>
              {!artistId && <option value="">Choose an artist</option>}
              {artistId && !artists.some(a => idOf(a) === artistId) && <option value={artistId}>{booking.artist_name || 'Current artist'}</option>}
              {artists.map(a => <option key={idOf(a)} value={idOf(a)}>{a.name}</option>)}
            </Select>
          </Field>
          {(stations.length > 0 || stationId) && (
            <Field label="Station" error={stationTaken ? 'Taken at this time. Choose another station or time.' : undefined}>
              <Select value={stationId} onChange={e => setStationId(e.target.value)} invalid={stationTaken}>
                <option value="">No station</option>
                {stations.map(s => {
                  const id = String(s.id);
                  const taken = free !== null && !checking && !freeIds.has(id);
                  return <option key={id} value={id} disabled={taken && id !== stationId}>{s.name}{taken ? ' (taken)' : ''}</option>;
                })}
              </Select>
            </Field>
          )}
          {canEmail && (
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                Email {first} the new time
              </label>
              {notify && (
                <Textarea rows={2} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Add a message (optional)" aria-label={`Message to ${first}`} />
              )}
            </div>
          )}
          {error && <p role="alert" className="studio-field-error" style={{ margin: 0 }}>{error}</p>}
        </fieldset>
      </form>
    </Dialog>
  );
}
