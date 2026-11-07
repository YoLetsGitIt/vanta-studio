'use client';

// Settings → Walk-ins, laid out like the consent form builder: the walk-in link and QR
// code in their own card, then the form builder (fields on the left, a preview on the
// right that follows the scroll, and Save form at the bottom).
// Name, date of birth, email, phone and the artist are always asked; consent forms are
// always included.
import { useEffect, useState } from 'react';
import DownloadableQR, { downloadQR } from '@/components/DownloadableQR';
import Button from '@/components/ui/Button';
import StickyPreview from '@/components/StickyPreview';
import { getMyWalkInFormConfig, updateMyWalkInFormConfig } from '@/lib/api';
import { showFeedback } from '@/lib/feedback';
import { WalkInPreview } from '@/components/forms/FormPreviews';

const FIELDS = [
  { key: 'body_location', label: 'Placement' },
  { key: 'design_details', label: 'Design description' },
  { key: 'size', label: 'Size' },
  { key: 'skin_tone', label: 'Skin tone' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'notes', label: 'Additional notes' },
];

const entryOf = (fields, key) => fields?.[key] ?? { enabled: false, required: false };
const sameFields = (a, b) => FIELDS.every(({ key }) => {
  const x = entryOf(a, key), y = entryOf(b, key);
  return !!x.enabled === !!y.enabled && !!x.required === !!y.required;
});

export default function WalkInFormSettings({ styles: s, url, studioName, logoUrl, consentTemplates, bg = '#111111', accent = '#d5d0c7' }) {
  const [saved, setSaved] = useState(null);   // what's saved
  const [fields, setFields] = useState(null); // what's being edited
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyWalkInFormConfig()
      .then(data => { setSaved(data.fields ?? {}); setFields(data.fields ?? {}); })
      .catch(e => { setSaved({}); setFields({}); setError(e.message); });
  }, []);

  const dirty = fields && saved && !sameFields(fields, saved);
  const onCount = fields ? FIELDS.filter(({ key }) => entryOf(fields, key).enabled).length : 0;

  function set(key, prop, value) {
    setFields(current => {
      const entry = { ...entryOf(current, key), [prop]: value };
      if (prop === 'enabled' && !value) entry.required = false;
      return { ...current, [key]: entry };
    });
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const next = (await updateMyWalkInFormConfig(fields)).fields ?? fields;
      setSaved(next); setFields(next);
      showFeedback('Walk-in form saved', 'success');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      {url && (
        <section className="settings-span-12" style={s.card} aria-labelledby="walkin-link-title">
          <h2 id="walkin-link-title" style={s.sectionTitle}>Walk-in link</h2>
          <p style={s.sectionDesc}>Print the QR code or share the link. Clients who walk in pick their artist, fill in their details and sign your consent forms, and they’re booked in straight away.</p>
          <div style={s.linkBlock}>
            <DownloadableQR value={url} id="walkin-qr" filename="walk-in-qr" displaySize={84} hideButton />
            <div style={s.linkMain}>
              <span style={s.linkUrl}>{url.replace(/^https?:\/\//, '')}</span>
              <div style={s.linkActions}>
                <Button size="sm" onClick={() => navigator.clipboard.writeText(url).then(() => showFeedback('Walk-in link copied', 'success')).catch(() => {})}>Copy link</Button>
                <Button size="sm" variant="secondary" onClick={() => downloadQR('walkin-qr', 'walk-in-qr')}>Download QR</Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="settings-span-12 studio-consent-editor" style={s.card} aria-label="Walk-in form editor">
        <p style={{ ...s.sectionDesc, margin: 0 }}>Clients fill this in when they walk in. The preview shows what they see.</p>
        <div className="studio-feature-grid studio-consent-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left — editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-ghost)', margin: 0, lineHeight: 1.5 }}>
              Name, date of birth, email, phone and artist are always asked, and your consent forms are always included. Colours and logo are set in{' '}
              <a href="/dashboard/settings?tab=studio" style={{ color: 'var(--accent)', fontWeight: 600 }}>Studio → Logo and colours</a>.
            </p>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div className="studio-consent-field-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Extra fields ({onCount} on)</span>
              </div>
              {fields === null ? <div style={s.loadingDot} /> : FIELDS.map(({ key, label }) => {
                const entry = entryOf(fields, key);
                return (
                  <div key={key} style={s.formFieldRow}>
                    <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: entry.enabled ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</span>
                    {entry.enabled && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input type="checkbox" aria-label={`Walk-in ${label} required`} checked={!!entry.required} disabled={saving}
                          onChange={e => set(key, 'required', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Required</span>
                      </label>
                    )}
                    <button type="button" role="switch" aria-label={`Walk-in ${label} field`} aria-checked={entry.enabled} disabled={saving}
                      onClick={() => set(key, 'enabled', !entry.enabled)} style={s.switchBtn}>
                      <span aria-hidden="true" style={{ ...s.switchTrack, background: entry.enabled ? 'var(--switch-on)' : 'var(--switch-off)' }}>
                        <span style={{ ...s.switchThumb, transform: entry.enabled ? 'translateX(16px)' : 'none' }} />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — preview, in the studio's form colours */}
          <StickyPreview>
            <WalkInPreview bg={bg} accent={accent} studioName={studioName || 'Your Studio'} logoUrl={logoUrl} fields={fields} consentTemplates={consentTemplates} />
          </StickyPreview>
        </div>

        {error && <p role="alert" style={{ fontSize: '0.8rem', color: 'var(--color-danger)', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <span role="status" style={{ marginRight: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {fields === null ? '' : dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          {dirty && <button type="button" style={{ ...s.cancelBtn, flex: "none" }} disabled={saving} onClick={() => setFields(saved)}>Discard</button>}
          <button type="button" style={s.saveBtn} onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save form'}
          </button>
        </div>
      </section>
    </>
  );
}
