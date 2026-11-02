'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { bookingActions } from '@/lib/bookingActions';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';

export default function CancelDepositButton({ bookingId, onCancelled, disabled = false }) {
  const [saving, setSaving] = useState(false);
  async function cancel() {
    if (saving) return;
    const confirmed = await requestConfirmation({
      title: 'Cancel this deposit?',
      message: 'The client will no longer owe this deposit and the appointment will stay booked. Use this if the deposit is waived or they paid the full session price on arrival. Record any full payment when completing the session.',
      confirmLabel: 'Cancel deposit',
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      await bookingActions.cancelDeposit(bookingId);
      onCancelled?.();
      window.dispatchEvent(new CustomEvent('booking-deposit-cancelled', { detail: { bookingId } }));
      showFeedback('Deposit cancelled. The appointment is still booked.', 'success');
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  }
  return <Button variant="secondary" size="sm" loading={saving} loadingLabel="Cancelling…" disabled={disabled} onClick={cancel}>Cancel deposit</Button>;
}
