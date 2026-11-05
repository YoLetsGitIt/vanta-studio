'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStations, getStripeStatus, getStudioArtists, getStudioClients, getStudioHours } from './api';
import { canCollectDeposits, hasStripeCharges } from './deposits';

// What the New Appointment panel needs. It's fetched in the background when the dashboard
// loads and kept for the session, so the panel opens straight away; each open refreshes
// it quietly. The client list (used for search) never holds up the form.
const EMPTY = { artists: [], stations: [], hours: [], clients: [], stripeConnected: false, stripeCharges: false };
let saved = null;          // last good setup data
let savedClients = null;   // last client list
let setupRequest = null;
let clientsRequest = null;

function loadSetup() {
  if (!setupRequest) {
    setupRequest = Promise.all([getStudioArtists('approved'), getStations(), getStudioHours(), getStripeStatus().catch(() => null)])
      .then(([artistData, stationData, hoursData, stripeData]) => {
        saved = {
          artists: artistData.artists ?? [],
          stations: (stationData.stations ?? []).filter(station => station.is_active !== false),
          hours: hoursData.hours ?? [],
          stripeConnected: canCollectDeposits(stripeData),
          stripeCharges: hasStripeCharges(stripeData),
        };
        return saved;
      })
      .finally(() => { setupRequest = null; });
  }
  return setupRequest;
}

function loadClients() {
  if (!clientsRequest) {
    clientsRequest = getStudioClients()
      .then(data => { savedClients = data.clients ?? []; return savedClients; })
      .finally(() => { clientsRequest = null; });
  }
  return clientsRequest;
}

export function useNewAppointmentData(open) {
  const [data, setData] = useState(() => ({ ...EMPTY, ...saved, clients: savedClients ?? [] }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  // Warm up once the dashboard is idle, before anyone opens the panel.
  useEffect(() => {
    if (saved) return;
    const start = () => { loadSetup().catch(() => {}); loadClients().catch(() => {}); };
    const id = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(start, { timeout: 3000 }) : window.setTimeout(start, 1500);
    return () => (typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    // Show what we have now; only show loading the very first time.
    if (saved) setData(current => ({ ...current, ...saved }));
    else setLoading(true);
    if (savedClients) setData(current => ({ ...current, clients: savedClients }));

    loadSetup()
      .then(next => { if (!cancelled) setData(current => ({ ...current, ...next })); })
      .catch(loadError => { if (!cancelled && !saved) setError(loadError?.message || 'Appointment details could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    loadClients()
      .then(clients => { if (!cancelled) setData(current => ({ ...current, clients })); })
      .catch(() => {}); // search just shows fewer matches
    return () => { cancelled = true; };
  }, [open, reloadKey]);

  return { ...data, loading, error, retry };
}
