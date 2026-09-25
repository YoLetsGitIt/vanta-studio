'use client';

import { useRef, useState } from 'react';
import { uploadStudioLogo, removeStudioLogo } from '@/lib/api';
import { showError } from '@/lib/feedback';

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Upload / replace / remove the studio logo shown on booking and consent forms. */
export default function StudioLogoUpload({ logoUrl, studioName, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) { setError('Use a PNG, JPG or WebP image.'); return; }
    if (file.size > MAX_BYTES) { setError('The image must be 2 MB or smaller.'); return; }
    setError(''); setBusy(true);
    try {
      onChange(await uploadStudioLogo(file));
    } catch (err) {
      showError(err);
    } finally { setBusy(false); }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await removeStudioLogo();
      onChange('');
    } catch (err) {
      showError(err);
    } finally { setBusy(false); }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.preview} aria-hidden={!logoUrl}>
        {logoUrl
          ? <img src={logoUrl} alt={`${studioName || 'Studio'} logo`} style={styles.img} />
          : <span style={styles.placeholder}>No logo</span>}
      </div>
      <div style={styles.actions}>
        <input ref={inputRef} type="file" accept={TYPES.join(',')} onChange={handleFile} style={{ display: 'none' }} aria-label="Upload studio logo" />
        <div style={styles.buttons}>
          <button type="button" style={styles.primary} disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Working…' : logoUrl ? 'Replace logo' : 'Upload logo'}
          </button>
          {logoUrl && <button type="button" style={styles.secondary} disabled={busy} onClick={handleRemove}>Remove</button>}
        </div>
        <p style={styles.hint}>PNG, JPG or WebP, up to 2 MB. A logo with a transparent background works best.</p>
        {error && <p role="alert" style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1rem' },
  preview: { width: 120, height: 120, flexShrink: 0, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-input)', display: 'grid', placeItems: 'center', overflow: 'hidden' },
  img: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  placeholder: { fontSize: '0.8rem', color: 'var(--text-ghost)' },
  actions: { display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0, flex: 1 },
  buttons: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  primary: { background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 9, padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-contrast)', cursor: 'pointer' },
  secondary: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 9, padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' },
  hint: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 },
  error: { margin: 0, fontSize: '0.8rem', color: 'var(--color-danger)' },
};
