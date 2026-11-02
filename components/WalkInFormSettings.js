'use client';

// Settings → Bookings: the walk-in link / QR code and which extra fields it asks for.
// Name, date of birth, email, phone and the artist are always asked; consent forms
// are always included. Changes save straight away.
import { useEffect, useState } from 'react';
import DownloadableQR from '@/components/DownloadableQR';
import { getMyWalkInFormConfig, updateMyWalkInFormConfig } from '@/lib/api';

const FIELDS = [
  { key: 'body_location', label: 'Placement' },
  { key: 'design_details', label: 'Design description' },
  { key: 'size', label: 'Size' },
  { key: 'skin_tone', label: 'Skin tone' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'notes', label: 'Additional notes' },
];

export default function WalkInFormSettings({ styles: s, url }) {
  const [fields, setFields] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyWalkInFormConfig().then(data => setFields(data.fields ?? {})).catch(e => { setFields({}); setError(e.message); });
  }, []);

  async function toggle(key, prop, value) {
    const entry = { ...(fields[key] ?? { enabled: false, required: false }), [prop]: value };
    if (prop === 'enabled' && !value) entry.required = false;
    const next = { ...fields, [key]: entry };
    setFields(next);
    setSaving(true);
    setError('');
    try { setFields((await updateMyWalkInFormConfig(next)).fields ?? next); }
    catch (e) { setError(e.message); setFields(fields); }
    finally { setSaving(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <section style={s.card} aria-labelledby="walkin-form-title">
      <h2 id="walkin-form-title" style={s.sectionTitle}>Walk-in form</h2>
      <p style={s.sectionDesc}>
        For clients who walk in. They scan the QR code or open the link, choose their artist, fill in their details and sign your consent forms, and they’re booked in straight away.
      </p>
      {url && (
        <div className="studio-wrap-row" style={s.walkInCard}>
          <div style={s.walkInLeft}>
            <span style={s.walkInUrl}>{url}</span>
            <button onClick={copy} style={s.copyBtn}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
          <DownloadableQR value={url} filename="walk-in-qr" />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
        <span style={s.label}>Extra fields</span>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem' }}>
          Name, date of birth, email, phone and artist are always asked, and your consent forms are always included.
        </p>
        {fields === null ? <div style={s.loadingDot} /> : FIELDS.map(({ key, label }) => {
          const entry = fields[key] ?? { enabled: false, required: false };
          return (
            <div key={key} style={s.formFieldRow}>
              <span style={{ flex: 1, fontSize: '0.83rem', fontWeight: 500, color: entry.enabled ? 'var(--text)' : 'var(--text-ghost)' }}>{label}</span>
              {entry.enabled && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                  <input type="checkbox" aria-label={`Walk-in ${label} required`} checked={!!entry.required} disabled={saving}
                    onChange={e => toggle(key, 'required', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Required</span>
                </label>
              )}
              <button role="switch" aria-label={`Walk-in ${label} field`} aria-checked={entry.enabled} disabled={saving}
                onClick={() => toggle(key, 'enabled', !entry.enabled)}
                style={{
                  ...s.fieldToggleBtn,
                  background: entry.enabled ? 'var(--accent-tint)' : 'var(--bg-chip)',
                  borderColor: entry.enabled ? 'var(--accent-tint-border)' : 'var(--border)',
                  color: entry.enabled ? 'var(--accent)' : 'var(--text-ghost)',
                }}>
                {entry.enabled ? 'On' : 'Off'}
              </button>
            </div>
          );
        })}
        {error && <p role="alert" style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-danger)' }}>{error}</p>}
      </div>
    </section>
  );
}
