 'use client';
import { useEffect, useState } from 'react';
import StudioVisit from '@/components/StudioVisit';
import StudioAuth from '@/components/StudioAuth';

export default function HomePage() {
  const [auth, setAuth] = useState(false);
  useEffect(() => {
    // Preserve existing signup links and Stripe success/cancellation callbacks.
    const params = new URLSearchParams(window.location.search);
    setAuth(params.has('signup') || params.has('signin'));
  }, []);
  return auth ? <StudioAuth /> : <StudioVisit />;
}
