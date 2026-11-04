'use client';

// Artist page → Settings: this artist's own commission (the studio's share of
// their bookings). Same data as Settings → Payments → Artist commission; blank
// means the studio rate applies.
import { useEffect, useState } from 'react';
import { getCommissionOverrides, setCommissionOverride, deleteCommissionOverride, getMyStudioAccount } from '@/lib/api';

const pct = value => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${Number.isInteger(n) ? n : n.toFixed(1)}%` : '0%';
};
const toInput = value => (value == null ? '' : String(value));
const toRate = text => (String(text).trim() === '' ? null : Number(text));

// [field, label in the editor, short label in the summary]
const KINDS = [
  ['studio_cut_percent', 'Studio & walk-in', 'Studio & walk-in'],
  ['personal_cut_percent', 'Personal, app & imported', 'Personal'],
];

export default function ArtistCommissionCard({ artistId, artistName }) {
  const [defaults, setDefaults] = useState(null); // { studio_cut_percent, personal_cut_percent }
  const [override, setOverride] = useState(null); // this artist's row, or null for studio rates
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null); // { studio_cut_percent, personal_cut_percent } as text
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getMyStudioAccount(), getCommissionOverrides()])
      .then(([account, overrides]) => {
        if (!active) return;
        const st = account.studio ?? {};
        setDefaults({
          studio_cut_percent: st.walkin_cut_percent ?? st.studio_cut_percent ?? 0,
          personal_cut_percent: st.personal_cut_percent ?? st.studio_cut_percent ?? 0,
        });
        setOverride(overrides.find(o => o.artist_id === artistId) ?? null);
        setLoaded(true);
      })
      .catch(e => { if (active) { setError(e.message); setLoaded(true); } });
    return () => { active = false; };
  }, [artistId]);

  async function save(e) {
    e.preventDefault();
    const rates = Object.fromEntries(KINDS.map(([key]) => [key, toRate(editing[key])]));
    const values = Object.values(rates);
    if (values.some(v => v != null && (!Number.isFinite(v) || v < 0 || v > 100))) { setError('Commission must be between 0 and 100%.'); return; }
    setBusy(true); setError('');
    try {
      // Both blank means "use the studio rates", so remove the override.
      const overrides = values.every(v => v == null)
        ? await deleteCommissionOverride(artistId)
        : await setCommissionOverride(artistId, rates);
      setOverride(overrides.find(o => o.artist_id === artistId) ?? null);
      setEditing(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const label = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' };
  const small = { margin: 0, fontSize: '0.7rem', color: 'var(--text-ghost)', lineHeight: 1.4 };

  return (
    <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-faint)', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <span style={label}>Commission</span>
          <p style={{ ...small, marginTop: '0.15rem' }}>Studio’s share of {artistName ? `${artistName.split(' ')[0]}’s` : 'their'} bookings</p>
        </div>
        {loaded && !editing && defaults && (
          <button type="button" onClick={() => { setError(''); setEditing(Object.fromEntries(KINDS.map(([key]) => [key, toInput(override?.[key])]))); }}
            aria-label={`Edit commission for ${artistName || 'this artist'}`}
            style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.65rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            Edit
          </button>
        )}
      </div>

      {!loaded ? <span style={small}>Loading…</span> : !editing ? (
        defaults && (
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {KINDS.map(([key, , name]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.75rem' }}>
                <dt style={{ color: 'var(--text-muted)' }}>{name}</dt>
                <dd style={{ margin: 0, fontWeight: 650, color: override?.[key] != null ? 'var(--text)' : 'var(--text-ghost)', whiteSpace: 'nowrap' }}>
                  {override?.[key] != null ? pct(override[key]) : `${pct(defaults[key])} studio rate`}
                </dd>
              </div>
            ))}
          </dl>
        )
      ) : (
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} aria-label={`Commission for ${artistName || 'this artist'}`}>
          {KINDS.map(([key, name]) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>{name}</span>
              <span style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <input type="number" min="0" max="100" step="0.5" inputMode="decimal"
                  aria-label={`${name} studio share for ${artistName || 'this artist'}`}
                  value={editing[key]} placeholder={`${parseFloat(defaults[key]) || 0}`}
                  onChange={e => setEditing(v => ({ ...v, [key]: e.target.value }))}
                  style={{ width: '100%', minWidth: 0, padding: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text)', fontSize: '0.95rem', fontWeight: 650, fontFamily: 'inherit' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>%</span>
              </span>
            </label>
          ))}
          <p style={small}>Leave blank to use the studio rate.</p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" disabled={busy}
              style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.4rem 0.85rem', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accent-contrast)', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setEditing(null); setError(''); }}
              style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0.4rem 0.5rem', border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
