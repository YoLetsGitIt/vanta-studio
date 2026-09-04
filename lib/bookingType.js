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

const SOURCE_CHROME = { bg: '#191919', border: 'rgba(255,255,255,0.11)', tagColor: '#aaa6a0', dot: '#77746f' };
export const TYPE_STYLE = {
  studio:   { ...SOURCE_CHROME, tag: 'Studio' },
  walkin:   { ...SOURCE_CHROME, tag: 'Walk-in' },
  personal: { ...SOURCE_CHROME, tag: 'Personal' },
  app:      { ...SOURCE_CHROME, tag: 'App' },
  import:   { ...SOURCE_CHROME, tag: 'Imported' },
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
