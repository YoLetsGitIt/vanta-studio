'use client';

import { useEffect, useState } from 'react';
import { setClientMarketingConsent } from '@/lib/api';
import { showError } from '@/lib/feedback';
import { Fact, Switch } from '@/components/ui/DetailParts';

/**
 * One row: "Marketing" for email and SMS with an on/off switch. Used by both the client and booking panels.
 * `clientKey` is the directory client id; `marketing` is { optIn, unsubscribed } or null when unknown.
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

  const channels = email && phone ? 'Email & SMS' : email ? 'Email' : 'SMS';
  const status = marketing.unsubscribed
    ? 'Email unsubscribed'
    : marketing.optIn && !marketing.smsOptIn && phone ? 'Email only'
    : marketing.smsOptIn && !marketing.optIn && email ? 'SMS only' : channels;
  return (
    <Fact label="Marketing" control>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{status}</span>
        <Switch
          aria-label="Client has agreed to marketing by email and SMS"
          title="Enable only with the client’s permission for marketing by email and SMS. Existing unsubscribes are respected."
          checked={checked}
          disabled={saving || (marketing.unsubscribed && !checked)}
          onChange={toggle}
        />
      </span>
    </Fact>
  );
}
