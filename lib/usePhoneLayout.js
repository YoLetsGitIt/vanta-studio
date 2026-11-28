'use client';

import { useEffect, useState } from 'react';

// A phone held upright: pages with their own phone layout (Bookings, Schedule) use it.
export const PHONE_MEDIA = '(max-width: 760px) and (orientation: portrait)';

// True on a phone held upright. Pages that render on the client only can use the right
// layout from the first render; others update after mounting.
export function usePhoneLayout() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_MEDIA).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE_MEDIA);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return phone;
}
