'use client';

// The studio's appointment types ("Full day", 8 h, purple). Loaded once per visit and
// shared; anything that changes them calls refreshAppointmentTypes().
import { useEffect, useState } from 'react';
import { listAppointmentTypes } from './api';

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
