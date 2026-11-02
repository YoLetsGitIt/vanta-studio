'use client';
import { useEffect, useState } from 'react';
import StudioAuth from '@/components/StudioAuth';
import StatePanel from '@/components/ui/StatePanel';

export default function HomePage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Preserve existing signup links and Stripe success/cancellation callbacks.
    const params = new URLSearchParams(window.location.search);
    const destination = params.has('signup') ? '/signup' : params.has('signin') ? '/signin' : null;
    if (destination) {
      window.location.replace(`${destination}${window.location.search}${window.location.hash}`);
      return;
    }
    setReady(true);
  }, []);
  return ready ? <StudioAuth /> : <StatePanel title="Opening Vanta…" busy />;
}
