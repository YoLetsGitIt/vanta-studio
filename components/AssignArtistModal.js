'use client';

// "Artists confirm" studios: give a new request to an artist. The artist is told to send
// the client times, a quote and the session length from the Vanta app; the client then
// picks a time and pays the deposit to book it.
import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { assignArtist, getStudioArtists } from '@/lib/api';

const NO_ARTISTS = [];

export default function AssignArtistModal({ booking, artists: givenArtists = NO_ARTISTS, onClose, onAssigned }) {
  const [artists, setArtists] = useState(givenArtists);
  const [artistId, setArtistId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (givenArtists.length) { setArtists(givenArtists); return; }
    getStudioArtists('approved').then(d => setArtists(d.artists ?? [])).catch(() => {});
  }, [givenArtists]);

  // Artists taking bookings; the rest are shown but can't be picked.
  const keyOf = a => String(a.artistId ?? a.artist_id ?? a.id);
  const client = booking?.requester_name?.split(' ')[0] || 'the client';
  const chosen = artists.find(a => keyOf(a) === artistId);

  async function assign() {
    if (!artistId) { setError('Choose an artist.'); return; }
    setSaving(true); setError('');
    try {
      await assignArtist(booking.id, artistId);
      await onAssigned?.(chosen?.name ?? 'The artist');
      onClose();
    } catch (e) { setError(e.message); setSaving(false); }
  }

  return (
    <Dialog title="Assign an artist" maxWidth={460} onClose={onClose}
      description={`They’ll get a notification to send ${client} times, a quote and the session length from the Vanta app.`}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={assign} loading={saving} loadingLabel="Assigning…" disabled={!artistId}>Assign</Button>
      </>}>
      <div role="radiogroup" aria-label="Artist" style={s.list}>
        {artists.length === 0 && <p style={s.empty}>No artists at your studio yet.</p>}
        {artists.map(a => {
          const key = keyOf(a);
          const off = a.acceptingBookings === false;
          const on = artistId === key;
          return (
            <button key={key} type="button" role="radio" aria-checked={on} disabled={off || saving}
              onClick={() => setArtistId(key)} style={{ ...s.row, ...(on ? s.rowOn : {}), ...(off ? s.rowOff : {}) }}>
              {a.profileImage
                ? <img src={a.profileImage} alt="" style={s.avatar} />
                : <span aria-hidden="true" style={s.avatar}>{(a.name || '?').trim().charAt(0).toUpperCase()}</span>}
              <span style={s.name}>{a.name}</span>
              {off && <span style={s.note}>Not taking bookings</span>}
              <span aria-hidden="true" style={{ ...s.radio, ...(on ? s.radioOn : {}) }} />
            </button>
          );
        })}
      </div>
      {error && <p role="alert" style={s.error}>{error}</p>}
    </Dialog>
  );
}

const s = {
  list: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  row: { display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', minHeight: 48, padding: '0.5rem 0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text)', font: 'inherit', textAlign: 'left', cursor: 'pointer' },
  rowOn: { borderColor: 'var(--accent)', background: 'var(--accent-tint)' },
  rowOff: { opacity: 0.5, cursor: 'not-allowed' },
  avatar: { width: 30, height: 30, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-chip)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)' },
  name: { flex: 1, minWidth: 0, fontSize: '0.95rem', fontWeight: 600 },
  note: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  radio: { width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--text-ghost)', flexShrink: 0 },
  radioOn: { borderColor: 'var(--accent)', background: 'var(--accent)', boxShadow: 'inset 0 0 0 3px var(--bg-card)' },
  empty: { margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' },
  error: { margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--color-danger)' },
};
