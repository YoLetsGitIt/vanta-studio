'use client';

// Who confirms booking times for this studio: 'artist' (default) or 'studio'.
// Fetched once per page load and shared; saving in Settings updates every listener.
import { useEffect, useState } from 'react';
import { authHeaders } from '@/lib/api';

const EVENT = 'vanta:booking-management';
let cached = null;

export async function loadBookingManagement() {
  if (!cached) {
    cached = fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/studio/me/booking-management`, { headers: await authHeaders() })
      .then(r => (r.ok ? r.json() : { mode: 'artist' }))
      .then(d => (d.mode === 'studio' ? 'studio' : 'artist'))
      .catch(() => { cached = null; return 'artist'; });
  }
  return cached;
}

export async function saveBookingManagement(mode) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/studio/me/booking-management`, {
    method: 'PUT', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not save this setting');
  cached = Promise.resolve(data.mode);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: data.mode }));
  return data.mode;
}

export function useBookingManagement() {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    let live = true;
    loadBookingManagement().then(m => { if (live) setMode(m); });
    const onChange = e => setMode(e.detail);
    window.addEventListener(EVENT, onChange);
    return () => { live = false; window.removeEventListener(EVENT, onChange); };
  }, []);
  return mode;
}
