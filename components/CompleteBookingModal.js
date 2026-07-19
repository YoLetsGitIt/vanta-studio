'use client';
import { useState } from 'react';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card / POS' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
};

const modal = {
  background: 'var(--bg-modal)', border: '1px solid var(--border)',
  borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 420,
};

const labelStyle = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-secondary)', letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: '0.4rem',
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
  borderRadius: 8, padding: '0.65rem 0.85rem',
  fontSize: '0.95rem', color: 'var(--text)', outline: 'none',
};

const selectStyle = { ...inputStyle, cursor: 'pointer', colorScheme: 'auto' };

export default function CompleteBookingModal({ outcome = 'completed', initialPrice, onConfirm, onCancel, saving }) {
  const [finalPrice, setFinalPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  const [splits, setSplits] = useState([{ method: '', amount: '' }]);
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState('');

  const isNoShow = outcome === 'no_show';

  function updateSplit(idx, field, value) {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function addSplit() {
    setSplits(prev => [...prev, { method: '', amount: '' }]);
  }

  function removeSplit(idx) {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  }

  const total = parseFloat(finalPrice) || 0;
  const splitsTotal = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const multiSplit = splits.length > 1;
  const showBalance = multiSplit && total > 0;
  const diff = Math.abs(total - splitsTotal);
  const balanced = diff < 0.01;

  function handleSubmit() {
    if (isNoShow) { onConfirm(null, null, false); return; }

    const filled = splits.filter(s => s.method && s.amount !== '');
    if (filled.length === 0) { setError('Please select a payment method.'); return; }
    for (const s of filled) {
      if (isNaN(parseFloat(s.amount)) || parseFloat(s.amount) <= 0) {
        setError('All payment amounts must be greater than 0.'); return;
      }
    }
    if (multiSplit && total > 0 && !balanced) {
      setError(`Split amounts total $${splitsTotal.toFixed(2)} but final price is $${total.toFixed(2)}.`); return;
    }

    setError('');
    onConfirm(
      finalPrice === '' ? null : parseFloat(finalPrice),
      filled.map(s => ({ method: s.method, amount: parseFloat(s.amount) })),
      followUp,
    );
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={modal}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
          {isNoShow ? 'Mark as No Show' : 'Mark as Complete'}
        </h2>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
          {isNoShow
            ? 'The client did not attend this appointment.'
            : 'Record payment details for this session.'}
        </p>

        {!isNoShow && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Final Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={finalPrice}
                onChange={e => setFinalPrice(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>
                Payment Method <span style={{ color: '#e86f6f' }}>*</span>
              </label>
              {splits.map((split, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={split.method}
                    onChange={e => updateSplit(idx, 'method', e.target.value)}
                    style={{ ...selectStyle, flex: 2 }}
                  >
                    <option value="">Select…</option>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={split.amount}
                    onChange={e => updateSplit(idx, 'amount', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {splits.length > 1 && (
                    <button
                      onClick={() => removeSplit(idx)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0 0.25rem', flexShrink: 0,
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {showBalance && (
                <p style={{
                  fontSize: '0.78rem', margin: '0.25rem 0 0',
                  color: balanced ? 'var(--text-muted)' : '#e86f6f',
                }}>
                  {balanced
                    ? `✓ Splits total $${splitsTotal.toFixed(2)}`
                    : `Splits total $${splitsTotal.toFixed(2)} of $${total.toFixed(2)}`}
                </p>
              )}

              <button
                onClick={addSplit}
                style={{
                  marginTop: '0.5rem', background: 'none', border: '1px dashed var(--border-strong)',
                  borderRadius: 8, padding: '0.45rem 0.85rem', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.82rem', width: '100%',
                }}
              >
                + Add payment method
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={followUp}
                onChange={e => setFollowUp(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 14, height: 14, flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Book a follow-up session</span>
            </label>
          </>
        )}

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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 2, padding: '0.7rem', borderRadius: 8, border: 'none',
              background: saving ? 'var(--bg-chip)' : (isNoShow ? 'rgba(232,111,111,0.85)' : '#4ade80'),
              color: saving ? 'var(--text-ghost)' : (isNoShow ? '#fff' : '#000'),
              cursor: saving ? 'default' : 'pointer',
              fontSize: '0.9rem', fontWeight: 700,
            }}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
