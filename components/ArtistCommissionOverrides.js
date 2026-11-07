'use client';

// Settings → Payments: artists with their own commission. Each artist can have a
// different studio share for studio/walk-in bookings, personal bookings, or both;
// anything left blank uses the studio rate.
import { useEffect, useState } from 'react';
import { getStudioArtists, getCommissionOverrides, setCommissionOverride, deleteCommissionOverride } from '@/lib/api';

const pct = value => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${Number.isInteger(n) ? n : n.toFixed(1)}%` : '0%';
};
const toInput = value => (value == null ? '' : String(value));
const toRate = text => (text.trim() === '' ? null : Number(text));

export default function ArtistCommissionOverrides({ styles: s, defaults }) {
  const [artists, setArtists] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [editing, setEditing] = useState(null); // { artistId, studio, personal, isNew }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getStudioArtists('approved'), getCommissionOverrides()])
      .then(([a, o]) => { setArtists(a.artists ?? []); setOverrides(o); })
      .catch(e => { setArtists([]); setError(e.message); });
  }, []);

  const artistKey = a => a.artistId ?? a.id;
  const nameOf = id => overrides.find(o => o.artist_id === id)?.artist_name || artists?.find(a => artistKey(a) === id)?.name || 'Artist';
  const available = (artists ?? []).filter(a => !overrides.some(o => o.artist_id === artistKey(a)));

  async function save(e) {
    e.preventDefault();
    const studio = toRate(editing.studio), personal = toRate(editing.personal);
    if ([studio, personal].some(v => v != null && (!Number.isFinite(v) || v < 0 || v > 100))) { setError('Commission must be between 0 and 100%.'); return; }
    if (studio == null && personal == null) { setError('Enter at least one rate, or remove the artist.'); return; }
    setBusy(true); setError('');
    try {
      setOverrides(await setCommissionOverride(editing.artistId, { studio_cut_percent: studio, personal_cut_percent: personal }));
      setEditing(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(artistId) {
    setBusy(true); setError('');
    try { setOverrides(await deleteCommissionOverride(artistId)); if (editing?.artistId === artistId) setEditing(null); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const rateLine = (value, fallback) => (value == null ? <span style={o.muted}>Studio rate ({pct(fallback)})</span> : <strong style={o.rate}>{pct(value)}</strong>);

  const editor = (
    <form onSubmit={save} style={o.editor} aria-label={`Commission for ${nameOf(editing?.artistId)}`}>
      {editing?.isNew && (
        <label style={o.field}>
          <span style={s.label}>Artist</span>
          <select style={s.input} value={editing.artistId} onChange={e => setEditing(v => ({ ...v, artistId: e.target.value }))} required>
            <option value="" disabled>Choose an artist</option>
            {available.map(a => <option key={artistKey(a)} value={artistKey(a)}>{a.name}</option>)}
          </select>
        </label>
      )}
      <div style={o.inputs}>
        {[['studio', 'Studio & walk-in', defaults.studio], ['personal', 'Personal & app', defaults.personal]].map(([key, label, fallback]) => (
          <label key={key} style={o.field}>
            <span style={s.label}>{label}</span>
            <span style={o.percentWrap}>
              <input
                style={o.percentInput} type="number" min="0" max="100" step="0.5" inputMode="decimal"
                aria-label={`${label} studio share for this artist`}
                value={editing?.[key] ?? ''} placeholder={`${parseFloat(fallback) || 0}`}
                onChange={e => setEditing(v => ({ ...v, [key]: e.target.value }))}
              />
              <span style={o.percentSign}>%</span>
            </span>
            <span style={o.hint}>Blank uses the studio rate</span>
          </label>
        ))}
      </div>
      <div style={o.actions}>
        <button type="submit" style={{ ...s.saveBtn, marginTop: 0 }} disabled={busy || !editing?.artistId}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" style={o.textBtn} onClick={() => { setEditing(null); setError(''); }} disabled={busy}>Cancel</button>
      </div>
    </form>
  );

  return (
    <section style={s.card} aria-labelledby="artist-commission-title">
      <div style={s.settingsSectionHeader}>
        <h2 id="artist-commission-title" style={s.sectionTitle}>Artist commission</h2>
        <p style={s.sectionDesc}>Give an artist their own studio share. Everyone else uses the studio rates.</p>
      </div>

      {artists === null ? <div style={s.loadingDot} /> : (
        <div style={o.list}>
          {overrides.length === 0 && !editing && <p style={o.empty}>Every artist uses the studio rates.</p>}
          {overrides.map(row => (
            editing?.artistId === row.artist_id && !editing.isNew ? <div key={row.artist_id} style={o.row}><strong style={o.name}>{nameOf(row.artist_id)}</strong>{editor}</div> : (
              <div key={row.artist_id} style={o.row}>
                <div style={o.rowMain}>
                  <strong style={o.name}>{nameOf(row.artist_id)}</strong>
                  <span style={o.rates}>
                    <span>Studio & walk-in {rateLine(row.studio_cut_percent, defaults.studio)}</span>
                    <span>Personal {rateLine(row.personal_cut_percent, defaults.personal)}</span>
                  </span>
                </div>
                <div style={o.rowActions}>
                  <button type="button" style={o.smallBtn} disabled={busy} onClick={() => { setError(''); setEditing({ artistId: row.artist_id, studio: toInput(row.studio_cut_percent), personal: toInput(row.personal_cut_percent) }); }} aria-label={`Edit commission for ${nameOf(row.artist_id)}`}>Edit</button>
                  <button type="button" style={{ ...o.smallBtn, color: 'var(--color-danger)' }} disabled={busy} onClick={() => remove(row.artist_id)} aria-label={`Use studio rates for ${nameOf(row.artist_id)}`}>Remove</button>
                </div>
              </div>
            )
          ))}
          {editing?.isNew && <div style={o.row}>{editor}</div>}
        </div>
      )}

      {error && <p role="alert" style={s.errorText}>{error}</p>}
      {artists !== null && !editing && (
        available.length > 0
          ? <button type="button" style={o.addBtn} onClick={() => { setError(''); setEditing({ artistId: '', studio: '', personal: '', isNew: true }); }}>+ Add artist rate</button>
          : artists.length === 0 && <p style={o.empty}>Add artists to your studio to give them their own rate.</p>
      )}
    </section>
  );
}

const o = {
  list: { display: 'flex', flexDirection: 'column' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem 1rem', padding: '0.9rem 0', borderTop: '1px solid var(--border-faint)' },
  rowMain: { display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 },
  name: { fontSize: '0.95rem', fontWeight: 650, color: 'var(--text)' },
  rates: { display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1.25rem', fontSize: '0.9rem', color: 'var(--text-dim)' },
  rate: { color: 'var(--text)', fontWeight: 650 },
  muted: { color: 'var(--text-secondary)' },
  rowActions: { display: 'flex', gap: '0.5rem', flexShrink: 0 },
  smallBtn: { minHeight: 36, padding: '0 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-chip)', color: 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { alignSelf: 'flex-start', marginTop: 'auto', minHeight: 40, padding: '0 1rem', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  empty: { margin: 0, padding: '0.9rem 0', borderTop: '1px solid var(--border-faint)', fontSize: '0.9rem', color: 'var(--text-secondary)' },
  editor: { flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  inputs: { display: 'flex', flexWrap: 'wrap', gap: '0.9rem 1.25rem' },
  field: { flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  percentWrap: { display: 'flex', alignItems: 'center', height: 44, maxWidth: 140, padding: '0 0.7rem', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8 },
  percentInput: { width: '100%', minWidth: 0, padding: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text)', fontSize: '1rem', fontWeight: 650, fontFamily: 'inherit' },
  percentSign: { color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 },
  hint: { fontSize: '0.8rem', color: 'var(--text-secondary)' },
  actions: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  textBtn: { minHeight: 40, padding: '0 0.5rem', border: 0, background: 'none', color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
