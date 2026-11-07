'use client';

// Settings → Payments: artists with their own commission. Each artist can have a
// different studio share for studio/walk-in bookings, personal bookings, or both;
// anything left blank uses the studio rate. Shown as a small table; a row is edited
// in place, in the same columns.
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { getStudioArtists, getCommissionOverrides, setCommissionOverride, deleteCommissionOverride } from '@/lib/api';
import { showFeedback } from '@/lib/feedback';

const num = value => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};
const pct = value => {
  const n = num(value);
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
};
const toInput = value => (value == null ? '' : String(value));
const toRate = text => (text.trim() === '' ? null : Number(text));

const COLUMNS = [
  { key: 'studio', field: 'studio_cut_percent', label: 'Studio & walk-in' },
  { key: 'personal', field: 'personal_cut_percent', label: 'Personal & app' },
];

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
  const fallback = key => (key === 'studio' ? defaults.studio : defaults.personal);

  async function save(e) {
    e.preventDefault();
    const studio = toRate(editing.studio), personal = toRate(editing.personal);
    if ([studio, personal].some(v => v != null && (!Number.isFinite(v) || v < 0 || v > 100))) { setError('Commission must be between 0 and 100%.'); return; }
    if (studio == null && personal == null) { setError('Enter at least one rate, or cancel to keep the studio rates.'); return; }
    setBusy(true); setError('');
    try {
      setOverrides(await setCommissionOverride(editing.artistId, { studio_cut_percent: studio, personal_cut_percent: personal }));
      showFeedback(`${nameOf(editing.artistId)}’s commission saved`, 'success');
      setEditing(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(artistId) {
    setBusy(true); setError('');
    try {
      setOverrides(await deleteCommissionOverride(artistId));
      showFeedback(`${nameOf(artistId)} now uses the studio rates`, 'success');
      if (editing?.artistId === artistId) setEditing(null);
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function cancel() { setEditing(null); setError(''); }

  // One rate: the studio's share, and what the artist keeps.
  const rateCell = (value, key) => {
    const own = value != null;
    const studio = own ? value : fallback(key);
    return (
      <div style={o.cell}>
        <span style={own ? o.value : o.valueMuted}>{pct(studio)}</span>
        <span style={o.sub}>{own ? `Artist keeps ${pct(100 - num(studio))}` : 'Studio rate'}</span>
      </div>
    );
  };

  const editRow = (
    <form key="editor" onSubmit={save} className="studio-commission-row" style={{ ...o.row, ...o.rowEditing }} aria-label={`Commission for ${editing?.isNew ? 'a new artist' : nameOf(editing?.artistId)}`}>
      <div style={o.cell}>
        {editing?.isNew ? (
          <select aria-label="Artist" style={{ ...s.input, maxWidth: 240 }} value={editing.artistId} onChange={e => setEditing(v => ({ ...v, artistId: e.target.value }))} required autoFocus>
            <option value="" disabled>Choose an artist</option>
            {available.map(a => <option key={artistKey(a)} value={artistKey(a)}>{a.name}</option>)}
          </select>
        ) : <Artist name={nameOf(editing?.artistId)} />}
      </div>
      {COLUMNS.map(({ key, label }) => {
        const typed = editing?.[key] ?? '';
        const studio = typed.trim() === '' ? null : num(typed);
        return (
          <div key={key} style={o.cell}>
            <span className="studio-commission-mobile-label" style={o.mobileLabel}>{label}</span>
            <span style={o.percentWrap}>
              <input
                className="studio-commission-input"
                style={o.percentInput} type="number" min="0" max="100" step="0.5" inputMode="decimal"
                aria-label={`${label}: studio share for this artist`}
                value={typed} placeholder="—"
                onChange={e => setEditing(v => ({ ...v, [key]: e.target.value }))}
                onKeyDown={e => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault(); if (e.key === 'Escape') cancel(); }}
              />
              <span style={o.percentSign}>%</span>
            </span>
            <span style={o.sub}>{studio == null ? `Blank uses the studio rate (${pct(fallback(key))})` : `Artist keeps ${pct(100 - studio)}`}</span>
          </div>
        );
      })}
      <div style={{ ...o.cell, ...o.actions }}>
        <Button size="sm" type="submit" loading={busy} loadingLabel="Saving…" disabled={!editing?.artistId}>Save</Button>
        <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );

  const showTable = overrides.length > 0 || editing;

  return (
    <section style={s.card} aria-labelledby="artist-commission-title">
      <div style={o.head}>
        <div style={s.settingsSectionHeader}>
          <h2 id="artist-commission-title" style={s.sectionTitle}>Artist commission</h2>
          <p style={s.sectionDesc}>
            Give an artist their own studio share. Everyone else uses the studio rates: {pct(defaults.studio)} on studio and walk-in bookings, {pct(defaults.personal)} on personal and app bookings.
          </p>
        </div>
        {artists !== null && !editing && available.length > 0 && overrides.length > 0 && (
          <Button size="sm" variant="secondary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => { setError(''); setEditing({ artistId: '', studio: '', personal: '', isNew: true }); }}>Add artist</Button>
        )}
      </div>

      {artists === null ? <div style={s.loadingDot} /> : !showTable ? (
        <div style={o.empty}>
          <p style={o.emptyTitle}>Every artist uses the studio rates</p>
          {artists.length === 0
            ? <p style={o.emptyText}>Add artists to your studio to give them their own rate.</p>
            : <>
                <p style={o.emptyText}>Set a different share for an artist, for example a resident on a lower rate.</p>
                <Button size="sm" variant="secondary" onClick={() => { setError(''); setEditing({ artistId: '', studio: '', personal: '', isNew: true }); }}>Add artist</Button>
              </>}
        </div>
      ) : (
        <div role="table" aria-label="Artists with their own commission" style={o.table}>
          <div role="row" className="studio-commission-row studio-commission-headrow" style={{ ...o.row, ...o.headRow }}>
            <span role="columnheader" style={o.th}>Artist</span>
            {COLUMNS.map(c => <span key={c.key} role="columnheader" style={o.th}>{c.label} <span style={o.thSub}>studio share</span></span>)}
            <span role="columnheader" style={o.th}><span style={s.visuallyHidden}>Actions</span></span>
          </div>
          {overrides.map(row => (
            editing?.artistId === row.artist_id && !editing.isNew ? editRow : (
              <div key={row.artist_id} role="row" className="studio-commission-row" style={o.row}>
                <div role="cell" style={o.cell}><Artist name={nameOf(row.artist_id)} /></div>
                {COLUMNS.map(c => (
                  <div key={c.key} role="cell">
                    <span className="studio-commission-mobile-label" style={o.mobileLabel}>{c.label}</span>
                    {rateCell(row[c.field], c.key)}
                  </div>
                ))}
                <div role="cell" style={{ ...o.cell, ...o.actions }}>
                  <Button size="sm" variant="ghost" disabled={busy || !!editing} aria-label={`Edit commission for ${nameOf(row.artist_id)}`}
                    onClick={() => { setError(''); setEditing({ artistId: row.artist_id, studio: toInput(row.studio_cut_percent), personal: toInput(row.personal_cut_percent) }); }}>Edit</Button>
                  <Button size="sm" variant="ghost" className="studio-danger-ghost" disabled={busy || !!editing} aria-label={`Use studio rates for ${nameOf(row.artist_id)}`}
                    onClick={() => remove(row.artist_id)}>Remove</Button>
                </div>
              </div>
            )
          ))}
          {editing?.isNew && editRow}
        </div>
      )}

      {error && <p role="alert" style={{ ...s.errorText, margin: 0 }}>{error}</p>}
    </section>
  );
}

function Artist({ name }) {
  return (
    <span style={o.artist}>
      <span aria-hidden="true" style={o.avatar}>{(name || '?').trim().charAt(0).toUpperCase()}</span>
      <span style={o.name}>{name}</span>
    </span>
  );
}

const o = {
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' },
  table: { display: 'flex', flexDirection: 'column', borderRadius: 12, border: '1px solid var(--border-faint)', overflow: 'hidden' },
  row: { display: 'grid', gridTemplateColumns: 'minmax(160px, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) auto', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', borderTop: '1px solid var(--border-faint)', background: 'var(--bg-base)' },
  rowEditing: { alignItems: 'start', background: 'var(--bg-card)' },
  headRow: { borderTop: 'none', padding: '0.6rem 1rem', background: 'transparent' },
  th: { fontSize: '0.75rem', fontWeight: 650, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' },
  thSub: { textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--text-ghost)' },
  cell: { display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 },
  artist: { display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 },
  avatar: { width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' },
  name: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  value: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  valueMuted: { fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
  sub: { fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  mobileLabel: { display: 'none', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.15rem' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' },
  percentWrap: { display: 'flex', alignItems: 'center', height: 38, maxWidth: 120, padding: '0 0.65rem', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8 },
  percentInput: { width: '100%', minWidth: 0, padding: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text)', fontSize: '1rem', fontWeight: 650, fontFamily: 'inherit' },
  percentSign: { color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem', padding: '1.1rem 1.2rem', borderRadius: 12, border: '1px dashed var(--border)' },
  emptyTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' },
  emptyText: { margin: '0 0 0.5rem', fontSize: '0.88rem', color: 'var(--text-muted)' },
};
