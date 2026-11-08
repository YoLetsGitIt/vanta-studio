'use client';

// The studio's appointment types ("Full day", 8 h, purple). Loaded once per visit and
// shared; anything that changes them calls refreshAppointmentTypes().
import { useEffect, useState } from 'react';
import { listAppointmentTypes, listArtistRates } from './api';

// Colours a type can have: distinct from each other and readable in light and dark.
export const TYPE_COLORS = [
  { value: '#8b5cf6', name: 'Violet' },
  { value: '#3b82f6', name: 'Blue' },
  { value: '#06b6d4', name: 'Cyan' },
  { value: '#10b981', name: 'Green' },
  { value: '#84cc16', name: 'Lime' },
  { value: '#eab308', name: 'Yellow' },
  { value: '#f97316', name: 'Orange' },
  { value: '#ef4444', name: 'Red' },
  { value: '#ec4899', name: 'Pink' },
  { value: '#64748b', name: 'Slate' },
];

// Bookings without a type.
export const UNTYPED_COLOR = '#9a958d';

const CHANGED = 'vanta:appointment-types-changed';
let saved = null;
let request = null;

function load(force = false) {
  if (!request || force) {
    request = listAppointmentTypes()
      .then(d => { saved = d.types ?? []; return saved; })
      .catch(error => { request = null; throw error; });
  }
  return request;
}

export function refreshAppointmentTypes() {
  return load(true).then(types => { window.dispatchEvent(new Event(CHANGED)); return types; });
}

// { types (all, archived too), active (for pickers), byId, loading, error }
export function useAppointmentTypes() {
  const [types, setTypes] = useState(saved);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const update = () => { if (live) setTypes(saved); };
    load().then(update).catch(e => { if (live) setError(e.message); });
    window.addEventListener(CHANGED, update);
    return () => { live = false; window.removeEventListener(CHANGED, update); };
  }, []);
  const list = types ?? [];
  return {
    types: list,
    active: list.filter(type => !type.archived),
    byId: Object.fromEntries(list.map(type => [type.id, type])),
    loading: types === null && !error,
    error,
  };
}

// "8 h", "1 h 30 min", "45 min"
export function formatTypeLength(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : null, m ? `${m} min` : null].filter(Boolean).join(' ') || '0 min';
}

export function formatMoney(n) {
  return `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

// How a schedule entry is drawn: its appointment type's colour and name, or a neutral
// grey with its source (Studio / Walk-in / Personal…) when it has no type.
// border and dot are hex so callers can add an alpha suffix.
const SOURCE_LABELS = { studio: 'Studio', walkin: 'Walk-in', personal: 'Personal', app: 'App', import: 'Imported', web: 'Personal', manual: 'Personal' };
export function entryStyle(entry, typesById) {
  const type = entry?.appointmentTypeId ? typesById?.[entry.appointmentTypeId] : null;
  const color = type?.color ?? UNTYPED_COLOR;
  return {
    border: color,
    dot: color,
    bg: `color-mix(in srgb, ${color} ${type ? 14 : 9}%, transparent)`,
    tag: type?.name ?? SOURCE_LABELS[String(entry?.source ?? '').toLowerCase()] ?? null,
    tagColor: type ? color : 'var(--text-muted)',
    typed: Boolean(type),
  };
}

// How a type is priced: from one of the assigned artist's rates.
export const PRICE_BASES = [
  { value: 'hourly', label: 'Hourly rate', short: 'Hourly rate', field: 'hourly_rate' },
  { value: 'half_day', label: 'Half-day rate', short: 'Half-day rate', field: 'half_day_rate' },
  { value: 'full_day', label: 'Full-day rate', short: 'Full-day rate', field: 'full_day_rate' },
];
export const priceBasis = value => PRICE_BASES.find(b => b.value === value) ?? null;

// The price of a booking of this type with this artist, or null when the type isn't
// priced by a rate or the artist hasn't set that rate. Hourly uses the booking's length.
export function priceFor(type, rates, minutes) {
  const basis = priceBasis(type?.price_basis);
  const rate = basis ? rates?.[basis.field] : null;
  if (rate == null) return null;
  if (basis.value !== 'hourly') return rate;
  return Math.round(rate * ((minutes || type.duration_minutes) / 60) * 100) / 100;
}

// Every artist's rates at the studio, keyed by artist id. Shared like the types.
const RATES_CHANGED = 'vanta:artist-rates-changed';
let savedRates = null;
let ratesRequest = null;
function loadRates(force = false) {
  if (!ratesRequest || force) {
    ratesRequest = listArtistRates()
      .then(d => { savedRates = Object.fromEntries((d.rates ?? []).map(r => [r.artist_id, r])); return savedRates; })
      .catch(error => { ratesRequest = null; throw error; });
  }
  return ratesRequest;
}
export function refreshArtistRates() {
  return loadRates(true).then(rates => { window.dispatchEvent(new Event(RATES_CHANGED)); return rates; });
}
export function useArtistRates() {
  const [rates, setRates] = useState(savedRates);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const update = () => { if (live) setRates(savedRates); };
    loadRates().then(update).catch(e => { if (live) setError(e.message); });
    window.addEventListener(RATES_CHANGED, update);
    return () => { live = false; window.removeEventListener(RATES_CHANGED, update); };
  }, []);
  return { byArtist: rates ?? {}, list: Object.values(rates ?? {}), loading: rates === null && !error, error };
}
