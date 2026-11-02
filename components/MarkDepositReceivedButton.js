'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { bookingActions } from '@/lib/bookingActions';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';

// For deposits paid outside Stripe (PayID, bank transfer, cash).
export default function MarkDepositReceivedButton({ bookingId, onReceived, disabled = false }) {
  const [saving, setSaving] = useState(false);
  async function mark() {
    if (saving) return;
    const confirmed = await requestConfirmation({
      title: 'Mark deposit as received?',
      message: 'Only do this once the PayID or bank transfer has arrived in your account. If the client is waiting on their deposit, their appointment will be confirmed.',
      confirmLabel: 'Mark received',
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      const result = await bookingActions.markDepositReceived(bookingId);
      onReceived?.(result);
      window.dispatchEvent(new CustomEvent('booking-deposit-received', { detail: { bookingId, status: result?.status } }));
      showFeedback('Deposit marked as received.', 'success');
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  }
  return <Button size="sm" loading={saving} loadingLabel="Saving…" disabled={disabled} onClick={mark}>Mark deposit received</Button>;
}
