import { useState, useEffect } from 'react';
import { getAvailableStations } from './api';

// Shared hook: fetches available stations whenever date/startTime/durationMins changes.
// startTime: full ISO timestamp (optional) — enables time-slot overlap checking on the backend.
// durationMins: duration of the new booking in minutes (optional, used with startTime).
// excludeBookingId: exclude an existing booking so it doesn't block its own station.
// fallback: stations to show if the fetch fails (pass allStations from the caller).
export function useStationAvailability({
  date,
  startTime = '',
  durationMins = 0,
  excludeBookingId = '',
  fallback = [],
}) {
  const [stations, setStations] = useState(null); // null = not yet fetched
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!date) { setStations(null); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    getAvailableStations(date, excludeBookingId, startTime, durationMins)
      .then(data => { if (!cancelled) setStations(data.stations ?? []); })
      .catch(err => {
        if (!cancelled) {
          setStations(fallback);
          setError(err?.message || 'Station availability could not be checked.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, startTime, durationMins, excludeBookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { stations, loading, error };
}
