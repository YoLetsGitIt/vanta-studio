'use client';

// Consent form field: the client takes or chooses a photo of their ID.
// value is a File (before upload) or ''. Only the studio can see the photo.
import { useEffect, useId, useRef, useState } from 'react';

export default function PhotoIdField({ label, required, value, onChange, labelStyle, accent = 'var(--accent)' }) {
  const inputRef = useRef(null);
  const id = useId();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!(value instanceof Blob)) { setPreview(''); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function choose(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) { setError('Please choose a photo.'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('That photo is too large. Please choose a smaller one.'); return; }
    setError('');
    onChange(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <span id={`${id}-label`} style={labelStyle}>
        {label || 'Photo ID'}{required && <span style={{ color: 'var(--color-danger, var(--color-danger))', marginLeft: 2 }}>*</span>}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, rgba(var(--ink-rgb), 0.55))', lineHeight: 1.5 }}>
        A clear photo of your driver’s licence, passport or other photo ID. Only the studio can see it.
      </span>
      <input ref={inputRef} type="file" accept="image/*" onChange={choose} aria-labelledby={`${id}-label`} style={{ display: 'none' }} />
      {preview ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <img src={preview} alt="Your photo ID" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(var(--ink-rgb), 0.15)' }} />
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button type="button" onClick={() => inputRef.current?.click()} style={linkBtn}>Replace</button>
            <button type="button" onClick={() => onChange('')} style={linkBtn}>Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          style={{ minHeight: 48, padding: '0.6rem 1rem', borderRadius: 10, border: `1px dashed ${accent}`, background: 'rgba(var(--ink-rgb), 0.04)', color: accent, fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Take or choose a photo of your ID
        </button>
      )}
      {error && <span role="alert" style={{ fontSize: '0.78rem', color: 'var(--color-danger, var(--color-danger))' }}>{error}</span>}
    </div>
  );
}

const linkBtn = { minHeight: 44, padding: '0 0.4rem', background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' };
