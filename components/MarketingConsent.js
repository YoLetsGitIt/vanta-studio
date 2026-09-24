'use client';

import { useEffect, useState } from 'react';
import { setClientMarketingConsent } from '@/lib/api';
import { showError } from '@/lib/feedback';
import { Fact, Switch } from '@/components/ui/DetailParts';

/**
 * One row: "Marketing emails" with an on/off switch. Used by both the client and booking panels.
 * `clientKey` is the directory client id; `marketing` is { optIn, unsubscribed } or null when unknown.
 */
export default function MarketingConsent({ email, clientKey, marketing, onChange }) {
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(marketing?.optIn ?? false);
  useEffect(() => { setChecked(marketing?.optIn ?? false); }, [marketing?.optIn, clientKey]);
  if (!marketing || !email || !clientKey) return null;

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

  if (marketing.unsubscribed) {
    return <Fact label="Marketing emails" control><span style={{ color: 'var(--text-muted)' }}>Unsubscribed</span></Fact>;
  }
  return (
    <Fact label="Marketing emails" control>
      <Switch
        aria-label="Client has agreed to receive marketing emails"
        title="Turn on only if they agreed to hear from you. Every email has an unsubscribe link."
        checked={checked}
        disabled={saving}
        onChange={toggle}
      />
    </Fact>
  );
}
