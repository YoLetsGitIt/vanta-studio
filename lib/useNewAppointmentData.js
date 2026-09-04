'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStations, getStripeStatus, getStudioArtists, getStudioClients, getStudioHours } from './api';

export function useNewAppointmentData(open) {
  const [data, setData] = useState({ artists: [], stations: [], hours: [], clients: [], stripeConnected: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getStudioArtists('approved'), getStations(), getStudioHours(), getStudioClients(), getStripeStatus().catch(() => null)])
      .then(([artistData, stationData, hoursData, clientData, stripeData]) => {
        if (cancelled) return;
        setData({
          artists: artistData.artists ?? [],
          stations: (stationData.stations ?? []).filter(station => station.is_active !== false),
          hours: hoursData.hours ?? [],
          clients: clientData.clients ?? [],
          stripeConnected: !!(stripeData?.connected && stripeData?.charges_enabled),
        });
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError?.message || 'Appointment details could not be loaded.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, reloadKey]);

  return { ...data, loading, error, retry };
}
