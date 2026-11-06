'use client';

import { useEffect, useState } from 'react';
import { setClientMarketingChannels } from '@/lib/api';
import { showError } from '@/lib/feedback';
import { Fact, Pill, Switch } from '@/components/ui/DetailParts';

/**
 * Marketing by email and by SMS, each with its own switch. Used by the client and booking
 * panels. `clientKey` is the directory client id; `marketing` is
 * { optIn, smsOptIn, unsubscribed, smsOptedOut } or null when unknown. `onChange` gets
 * { optIn, smsOptIn }.
 * Once a client has opted out themselves (an email unsubscribe, or an SMS STOP), the
 * studio can't turn that channel back on: only the client can.
 */
export default function MarketingConsent({ email, phone, clientKey, marketing, onChange }) {
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState({ optIn: !!marketing?.optIn, smsOptIn: !!marketing?.smsOptIn });
  useEffect(() => { setState({ optIn: !!marketing?.optIn, smsOptIn: !!marketing?.smsOptIn }); }, [marketing?.optIn, marketing?.smsOptIn, clientKey]);
  if (!marketing || (!email && !phone) || !clientKey) return null;

  async function set(change) {
    const previous = state;
    const next = { ...state, ...change };
    setState(next);
    setSaving(true);
    try {
      await setClientMarketingChannels(clientKey, next);
      onChange?.(next);
    } catch (err) {
      setState(previous);
      showError(err);
    } finally { setSaving(false); }
  }

  const optedOut = <span title="The client opted out. Only they can opt back in."><Pill>Opted out</Pill></span>;
  return <>
    {email && (
      <Fact label="Email marketing" control>
        {marketing.unsubscribed ? optedOut : (
          <Switch aria-label="Client has agreed to marketing emails" checked={state.optIn} disabled={saving} onChange={value => set({ optIn: value })} />
        )}
      </Fact>
    )}
    {phone && (
      <Fact label="SMS marketing" control>
        {marketing.smsOptedOut ? optedOut : (
          <Switch aria-label="Client has agreed to marketing texts" checked={state.smsOptIn} disabled={saving} onChange={value => set({ smsOptIn: value })} />
        )}
      </Fact>
    )}
  </>;
}
