'use client';

import { useEffect, useState } from 'react';
import { setClientMarketingConsent } from '@/lib/api';
import { showError } from '@/lib/feedback';
import { Fact, Pill, Switch } from '@/components/ui/DetailParts';

/**
 * One row: marketing by email and SMS, on or off. Used by the client and booking panels.
 * `clientKey` is the directory client id; `marketing` is
 * { optIn, smsOptIn, unsubscribed, smsOptedOut } or null when unknown.
 * Once a client has opted out themselves (email unsubscribe or an SMS STOP), the studio
 * can't turn marketing back on: only the client can.
 */
export default function MarketingConsent({ email, phone, clientKey, marketing, onChange }) {
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState((marketing?.optIn || marketing?.smsOptIn) ?? false);
  useEffect(() => { setChecked((marketing?.optIn || marketing?.smsOptIn) ?? false); }, [marketing?.optIn, marketing?.smsOptIn, clientKey]);
  if (!marketing || (!email && !phone) || !clientKey) return null;

  async function toggle(next) {
    setChecked(next);
    setSaving(true);
    try {
      await setClientMarketingConsent(clientKey, next);
      onChange?.(next);
    } catch (err) {
      setChecked(!next);
      showError(err);
    } finally { setSaving(false); }
  }

  const optedOut = marketing.unsubscribed || marketing.smsOptedOut;
  return (
    <Fact label="Marketing" control>
      {optedOut ? (
        <span title="The client opted out. Only they can opt back in."><Pill>Opted out</Pill></span>
      ) : (
        <Switch
          aria-label="Client has agreed to marketing by email and SMS"
          checked={checked}
          disabled={saving}
          onChange={toggle}
        />
      )}
    </Fact>
  );
}
