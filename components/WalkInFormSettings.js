'use client';

// Settings → Walk-ins: the walk-in link / QR code and which extra fields it asks for.
// Name, date of birth, email, phone and the artist are always asked; consent forms
// are always included. Changes save straight away.
import { useEffect, useState } from 'react';
import DownloadableQR, { downloadQR } from '@/components/DownloadableQR';
import Button from '@/components/ui/Button';
import StickyPreview from '@/components/StickyPreview';
import { getMyWalkInFormConfig, updateMyWalkInFormConfig } from '@/lib/api';
import { WalkInPreview } from '@/components/forms/FormPreviews';

const FIELDS = [
  { key: 'body_location', label: 'Placement' },
  { key: 'design_details', label: 'Design description' },
  { key: 'size', label: 'Size' },
  { key: 'skin_tone', label: 'Skin tone' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'notes', label: 'Additional notes' },
];

export default function WalkInFormSettings({ styles: s, url, studioName, logoUrl, consentTemplates, bg = '#111111', accent = '#d5d0c7' }) {
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
      {/* Settings on the left; the preview on the right stays in view while you scroll. */}
      <div className="studio-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h2 id="walkin-form-title" style={s.sectionTitle}>Walk-in form</h2>
            <p style={{ ...s.sectionDesc, margin: 0 }}>
              Clients who walk in scan the QR code or open the link, pick their artist, fill in their details and sign your consent forms. They’re booked in straight away.
            </p>
          </div>
          {url && (
            <div style={s.linkBlock}>
              <DownloadableQR value={url} id="walkin-qr" filename="walk-in-qr" displaySize={84} hideButton />
              <div style={s.linkMain}>
                <span style={s.linkUrl}>{url.replace(/^https?:\/\//, '')}</span>
                <div style={s.linkActions}>
                  <Button size="sm" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadQR('walkin-qr', 'walk-in-qr')}>Download QR</Button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <span style={s.label}>Form fields</span>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem' }}>
              Name, date of birth, email, phone and artist are always asked, and your consent forms are always included.
            </p>
            {fields === null ? <div style={s.loadingDot} /> : FIELDS.map(({ key, label }) => {
              const entry = fields[key] ?? { enabled: false, required: false };
              return (
                <div key={key} style={s.formFieldRow}>
                  <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: entry.enabled ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</span>
                  {entry.enabled && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                      <input type="checkbox" aria-label={`Walk-in ${label} required`} checked={!!entry.required} disabled={saving}
                        onChange={e => toggle(key, 'required', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Required</span>
                    </label>
                  )}
                  <button type="button" role="switch" aria-label={`Walk-in ${label} field`} aria-checked={entry.enabled} disabled={saving}
                    onClick={() => toggle(key, 'enabled', !entry.enabled)} style={s.switchBtn}>
                    <span aria-hidden="true" style={{ ...s.switchTrack, background: entry.enabled ? 'var(--switch-on)' : 'var(--switch-off)' }}>
                      <span style={{ ...s.switchThumb, transform: entry.enabled ? 'translateX(16px)' : 'none' }} />
                    </span>
                  </button>
                </div>
              );
            })}
            {error && <p role="alert" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-danger)' }}>{error}</p>}
            {fields !== null && !error && <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-ghost)' }}>Changes save straight away. Colours and logo are set in <a href="/dashboard/settings?tab=studio" style={{ color: 'var(--accent)', fontWeight: 600 }}>Studio → Logo and colours</a>.</p>}
          </div>
        </div>
        {/* The studio's form colours (Studio → Logo and colours). */}
        <StickyPreview>
          <WalkInPreview bg={bg} accent={accent} studioName={studioName || 'Your Studio'} logoUrl={logoUrl} fields={fields} consentTemplates={consentTemplates} />
        </StickyPreview>
      </div>
    </section>
  );
}
