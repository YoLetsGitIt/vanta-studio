'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { bookingActions } from '@/lib/bookingActions';
import { showError, showFeedback } from '@/lib/feedback';

export const DEPOSIT_METHODS = [
  { value: 'payid', label: 'PayID', phrase: 'PayID' },
  { value: 'bank_transfer', label: 'Bank transfer', phrase: 'bank transfer' },
  { value: 'cash', label: 'Cash', phrase: 'cash' },
];

// For use mid-sentence: "Paid by bank transfer".
export function depositMethodLabel(value) {
  return DEPOSIT_METHODS.find(m => m.value === value)?.phrase ?? null;
}

// For deposits paid outside Stripe: the studio picks how the money arrived.
export default function MarkDepositReceivedButton({ bookingId, clientName, onReceived, disabled = false, label = 'Mark deposit received', variant = 'primary' }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('');
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    setOpen(false);
    setMethod('');
  }

  async function save() {
    if (!method || saving) return;
    setSaving(true);
    try {
      const result = await bookingActions.markDepositReceived(bookingId, method);
      onReceived?.({ ...result, method });
      window.dispatchEvent(new CustomEvent('booking-deposit-received', { detail: { bookingId, status: result?.status, method } }));
      showFeedback(`Deposit recorded as paid by ${depositMethodLabel(method)}.`, 'success');
      setOpen(false);
      setMethod('');
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Button variant={variant} size="sm" disabled={disabled} onClick={e => { e.stopPropagation(); setOpen(true); }}>{label}</Button>
      {open && (
        <Dialog
          title="Record deposit payment"
          description={`${clientName ? `How did ${clientName} pay?` : 'How did the client pay?'} Record it once the money is in your account. If the appointment is waiting on this deposit, it will be confirmed.`}
          onClose={close}
          dismissDisabled={saving}
          maxWidth={420}
          footer={(
            <>
              <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={!method} loading={saving} loadingLabel="Saving…">Mark as paid</Button>
            </>
          )}
        >
          <div role="radiogroup" aria-label="Payment method" style={m.group}>
            {DEPOSIT_METHODS.map(option => {
              const selected = method === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMethod(option.value)}
                  disabled={saving}
                  style={{ ...m.option, ...(selected ? m.optionOn : null) }}
                >
                  <span aria-hidden="true" style={{ ...m.dot, ...(selected ? m.dotOn : null) }} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </Dialog>
      )}
    </>
  );
}

const m = {
  group: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  option: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minHeight: 48,
    padding: '0.75rem 1rem', borderRadius: 12, border: '1px solid var(--border)',
    background: 'var(--bg-input)', color: 'var(--text)', fontSize: '1rem', fontWeight: 600,
    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
  },
  optionOn: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent)' },
  dot: { width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--text-muted)', flexShrink: 0, boxSizing: 'border-box' },
  dotOn: { borderColor: 'var(--accent)', borderWidth: 5 },
};
