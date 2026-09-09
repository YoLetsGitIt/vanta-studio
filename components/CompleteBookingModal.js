'use client';
import { useState, useEffect, useId } from 'react';
import { useLanguage } from '@/lib/i18n';
import Dialog from '@/components/ui/Dialog';
import Button, { IconButton } from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card / POS' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function CompleteBookingModal({ outcome = 'completed', initialPrice, depositAmount, onConfirm, onCancel, saving }) {
  const { t } = useLanguage();
  const id = useId();
  const [finalPrice, setFinalPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  const [splits, setSplits] = useState([{ method: '', amount: '' }]);
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState('');
  // While there's a single payment method and its amount hasn't been hand-edited,
  // keep it mirroring Final Price so the user never has to type the number twice.
  const [amountAutoLinked, setAmountAutoLinked] = useState(true);

  const isNoShow = outcome === 'no_show';

  function updateSplit(idx, field, value) {
    setSplits(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const next = { ...s, [field]: value };
      if (field === 'method' && prev.length === 1 && amountAutoLinked) {
        next.amount = finalPrice;
      }
      return next;
    }));
    if (field === 'amount') setAmountAutoLinked(false);
  }

  // Single payment method: keep its amount synced to Final Price as it changes,
  // as long as the user hasn't manually overridden the amount.
  useEffect(() => {
    setSplits(prev => (prev.length === 1 && prev[0].method && amountAutoLinked)
      ? [{ ...prev[0], amount: finalPrice }]
      : prev);
  }, [finalPrice, amountAutoLinked]);

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
    if (saving) return;
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
    <Dialog
      title={isNoShow ? t('noshow_title') : t('complete_title')}
      description={isNoShow ? t('noshow_desc') : t('complete_desc')}
      onClose={onCancel}
      dismissDisabled={saving}
      maxWidth={440}
      footer={isNoShow ? (
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>Go back</Button>
          <Button variant="danger" onClick={handleSubmit} loading={saving} loadingLabel={t('saving')}>
            Record no-show
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>{t('cancel')}</Button>
          <Button onClick={handleSubmit} loading={saving} loadingLabel={t('saving')}>{t('confirm')}</Button>
        </>
      )}
    >
      {!isNoShow && depositAmount != null && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
          background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Deposit</span>
          <span style={{ fontWeight: 700 }}>${Number(depositAmount).toFixed(2)}</span>
        </div>
      )}

      {!isNoShow && (
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Field label={t('complete_final_price')}>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={finalPrice}
                onChange={e => setFinalPrice(e.target.value)}
              />
            </Field>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: '0 0 var(--space-4)', minWidth: 0 }}>
            <legend style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              {t('complete_payment_method')} <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
            </legend>
            {splits.map((split, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                <Select
                  aria-label={`${t('complete_payment_method')} ${idx + 1}`}
                  aria-required="true"
                  aria-describedby={error ? `${id}-error` : undefined}
                  value={split.method}
                  onChange={e => updateSplit(idx, 'method', e.target.value)}
                  style={{ flex: 2, minWidth: 0 }}
                >
                  <option value="">Select…</option>
                  {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                </Select>
                <Input
                  aria-label={`Payment amount ${idx + 1}`}
                  aria-describedby={error ? `${id}-error` : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={split.amount}
                  onChange={e => updateSplit(idx, 'amount', e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                {splits.length > 1 && (
                  <IconButton variant="ghost" onClick={() => removeSplit(idx)} aria-label={`Remove payment ${idx + 1}`}>
                    <span aria-hidden="true">×</span>
                  </IconButton>
                )}
              </div>
            ))}

            {showBalance && (
              <p role="status" style={{ fontSize: '0.875rem', margin: 'var(--space-2) 0', color: balanced ? 'var(--text-muted)' : 'var(--color-danger)' }}>
                {balanced
                  ? `✓ Splits total $${splitsTotal.toFixed(2)}`
                  : `Splits total $${splitsTotal.toFixed(2)} of $${total.toFixed(2)}`}
              </p>
            )}
            <Button variant="secondary" fullWidth onClick={addSplit} style={{ marginTop: 'var(--space-2)' }}>
              {t('complete_add_payment')}
            </Button>
          </fieldset>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 44, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={followUp}
              onChange={e => setFollowUp(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
            />
            <span>{t('complete_followup')}</span>
          </label>
        </fieldset>
      )}
      {error && <p id={`${id}-error`} role="alert" style={{ margin: 'var(--space-3) 0 0', fontSize: '0.875rem', color: 'var(--color-danger)' }}>{error}</p>}
    </Dialog>
  );
}
