'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { sendMarketingTest } from '@/lib/api';
import { showError, showFeedback } from '@/lib/feedback';

/** Emails one copy of the message to the signed-in user so they can check it in a real inbox. */
export default function TestSendButton({ message, available, ready, disabled, ...props }) {
  const [busy, setBusy] = useState(false);
  const blocked = !available ? 'Sending isn’t switched on yet.' : !ready ? 'Set up your sender first.' : undefined;

  async function send() {
    setBusy(true);
    try {
      const res = await sendMarketingTest(message);
      showFeedback(`Test sent to ${res.to}. It can take a minute to arrive.`, 'success');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  return (
    <Button variant="secondary" {...props} title={blocked} loading={busy} loadingLabel="Sending test…" disabled={disabled || Boolean(blocked)} onClick={send}>
      Send test to me
    </Button>
  );
}
