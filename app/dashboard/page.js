'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRoot() {
  const router = useRouter();
  useEffect(() => {
    const hasTour = new URLSearchParams(window.location.search).get('tour') === '1';
    router.replace(hasTour ? '/dashboard/home?tour=1' : '/dashboard/home');
  }, [router]);
  return null;
}
