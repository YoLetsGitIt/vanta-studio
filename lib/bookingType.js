// Canonical booking-source taxonomy. Labels, aliases and financial ownership
// belong here so individual screens never reinterpret `source`.
export const BOOKING_SOURCES = Object.freeze({
  studio: Object.freeze({ key: 'studio', label: 'Studio', financialGroup: 'studio', icon: 'building' }),
  walkin: Object.freeze({ key: 'walkin', label: 'Walk-in', financialGroup: 'studio', icon: 'door' }),
  personal: Object.freeze({ key: 'personal', label: 'Personal', financialGroup: 'personal', icon: 'person' }),
  app: Object.freeze({ key: 'app', label: 'App', financialGroup: 'personal', icon: 'phone' }),
  import: Object.freeze({ key: 'import', label: 'Imported', financialGroup: 'personal', icon: 'upload' }),
});

// Older clients wrote these values. Normalize them without changing old rows.
export const BOOKING_SOURCE_ALIASES = Object.freeze({ web: 'personal', manual: 'personal' });

// One accent per source so the legend, tag chips and calendar dots are
// actually distinguishable — a shared gray here made all five read as one
// color. Dark-mode categorical slots from the design system's validated
// palette (fixed order, not reused for status/other meaning).
export const TYPE_STYLE = {
  studio:   { bg: 'rgba(57,135,229,0.12)',  border: '#3987e5', tagColor: '#3987e5', dot: '#3987e5', tag: 'Studio' },
  walkin:   { bg: 'rgba(217,89,38,0.12)',   border: '#d95926', tagColor: '#d95926', dot: '#d95926', tag: 'Walk-in' },
  personal: { bg: 'rgba(25,158,112,0.12)',  border: '#199e70', tagColor: '#199e70', dot: '#199e70', tag: 'Personal' },
  app:      { bg: 'rgba(201,133,0,0.12)',   border: '#c98500', tagColor: '#c98500', dot: '#c98500', tag: 'App' },
  import:   { bg: 'rgba(213,81,129,0.12)',  border: '#d55181', tagColor: '#d55181', dot: '#d55181', tag: 'Imported' },
};

export function normalizeBookingSource(source) {
  const key = String(source ?? '').trim().toLowerCase();
  const normalized = BOOKING_SOURCE_ALIASES[key] ?? key;
  return BOOKING_SOURCES[normalized] ? normalized : 'personal';
}

export function getBookingSource(source) {
  return BOOKING_SOURCES[normalizeBookingSource(source)];
}

export function getBookingType(source) {
  return normalizeBookingSource(source);
}

export function getBookingSourceLabel(source) {
  return getBookingSource(source).label;
}

export function getBookingFinancialGroup(source) {
  return getBookingSource(source).financialGroup;
}

export function getBookingStyle(source) {
  return TYPE_STYLE[normalizeBookingSource(source)];
}
