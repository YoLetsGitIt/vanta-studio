'use client';

import { useEffect } from 'react';

export default function DashboardRoot() {
  useEffect(() => {
    const hasTour = new URLSearchParams(window.location.search).get('tour') === '1';
    window.location.replace(hasTour ? '/dashboard/schedule?tour=1' : '/dashboard/schedule');
  }, []);
  return null;
}
