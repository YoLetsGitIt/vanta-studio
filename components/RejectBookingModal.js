'use client';
import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';

const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
};

const modal = {
  background: 'var(--bg-modal)', border: '1px solid var(--border)',
  borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 400,
};

const labelStyle = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-secondary)', letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: '0.4rem',
};

export default function RejectBookingModal({
  onConfirm, onCancel, saving,
  title = 'Reject Booking',
  placeholder = 'e.g. Not available on the requested date, design outside my style…',
  confirmLabel = 'Reject Booking',
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!reason.trim()) { setError('Please provide a reason.'); return; }
    setError('');
    onConfirm(reason.trim());
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={modal}>
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </h2>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>{t('reason')} <span style={{ color: '#e86f6f' }}>*</span></label>
          <textarea
            rows={4}
            placeholder={placeholder}
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
              borderRadius: 8, padding: '0.65rem 0.85rem',
              fontSize: '0.9rem', color: 'var(--text)', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.5,
            }}
          />
        </div>

        {error && (
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#e86f6f' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              flex: 1, padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            {t('back')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 2, padding: '0.7rem', borderRadius: 8, border: 'none',
              background: saving ? 'var(--bg-chip)' : 'rgba(232,111,111,0.85)',
              color: saving ? 'var(--text-ghost)' : '#fff',
              cursor: saving ? 'default' : 'pointer',
              fontSize: '0.9rem', fontWeight: 700,
            }}
          >
            {saving ? t('saving') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
