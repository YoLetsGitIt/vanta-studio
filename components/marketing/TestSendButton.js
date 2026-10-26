'use client';

import { useLanguage } from '@/lib/i18n';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { sendMarketingTest } from '@/lib/api';
import { showError, showFeedback } from '@/lib/feedback';

/** Emails one copy of the message to the signed-in user so they can check it in a real inbox. */
export default function TestSendButton({ message, available, ready, disabled, ...props }) {
  const { t: mt } = useLanguage();
  const [busy, setBusy] = useState(false);
  const blocked = !available ? mt('Sending isn’t switched on yet.') : !ready ? mt('Set up your sender first.') : undefined;

  async function send() {
    setBusy(true);
    try {
      const res = await sendMarketingTest(message);
      showFeedback(mt('Test sent to {email}. It can take a minute to arrive.', { email: res.to }), 'success');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  return (
    <Button variant="secondary" {...props} title={blocked} loading={busy} loadingLabel={mt("Sending test…")} disabled={disabled || Boolean(blocked)} onClick={send}> {mt("Send test to me")} </Button>
  );
}
