'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ContactEmailPrompt from './ContactEmailPrompt';

// One post-authentication hook covers email, Apple and Google account creation,
// including callbacks, booking links and accounts restored on another device.
export default function ContactEmailSignupGate() {
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!/^\/(signup|signin|auth|bookings|booking|consent)(\/|\.html$|$)/.test(pathname || '')) { setSession(null); return; }
    let active = true, subscription;
    import('../lib/supabase').then(({ getSupabase }) => {
      if (!active) return;
      const client = getSupabase();
      client.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
      subscription = client.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); }).data.subscription;
    });
    return () => { active = false; subscription?.unsubscribe(); };
  }, [pathname]);
  return <ContactEmailPrompt session={session} backend={process.env.NEXT_PUBLIC_BACKEND_URL} />;
}
