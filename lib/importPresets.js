// Column-mapping presets, header heuristics and value parsers for the
// studio data importer. Presets are best-effort maps of known vendor CSV
// headers onto Vanta fields; the generic heuristics backfill anything a
// preset misses, and the user can adjust every mapping in the wizard.

// ── Vanta field definitions ──────────────────────────────────────────────────

export const CLIENT_FIELDS = [
  { key: 'name',       label: 'Full name',   hint: 'or map first + last name' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name',  label: 'Last name' },
  { key: 'email',      label: 'Email' },
  { key: 'phone',      label: 'Phone' },
  { key: 'dob',        label: 'Date of birth' },
  { key: 'notes',      label: 'Notes' },
];

export const APPOINTMENT_FIELDS = [
  { key: 'client_name',       label: 'Client name', hint: 'or map first + last name' },
  { key: 'client_first_name', label: 'Client first name' },
  { key: 'client_last_name',  label: 'Client last name' },
  { key: 'client_email',      label: 'Client email' },
  { key: 'client_phone',      label: 'Client phone' },
  { key: 'artist_name',       label: 'Artist / staff' },
  { key: 'datetime',          label: 'Date & time', hint: 'single column, or map date + time' },
  { key: 'date',              label: 'Date' },
  { key: 'time',              label: 'Time' },
  { key: 'duration_minutes',  label: 'Duration (min)' },
  { key: 'design_details',    label: 'Service / design' },
  { key: 'body_location',     label: 'Body placement' },
  { key: 'price',             label: 'Price' },
  { key: 'status',            label: 'Status' },
  { key: 'notes',             label: 'Notes' },
];

// ── Vendor presets (normalized header → field key) ───────────────────────────

function norm(header) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const PRESETS = {
  generic: { label: 'Generic CSV', dayFirst: true, headers: {} },
  square: {
    label: 'Square Appointments',
    dayFirst: false,
    headers: {
      firstname: 'first_name', lastname: 'last_name',
      customername: 'client_name', emailaddress: 'email', email: 'email',
      customeremail: 'client_email', phonenumber: 'phone', customerphone: 'client_phone',
      birthday: 'dob', memo: 'notes', note: 'notes',
      staffname: 'artist_name', teammember: 'artist_name',
      startat: 'datetime', date: 'date', time: 'time',
      duration: 'duration_minutes', service: 'design_details',
      price: 'price', status: 'status',
    },
  },
  acuity: {
    label: 'Acuity Scheduling',
    dayFirst: false,
    headers: {
      firstname: 'first_name', lastname: 'last_name',
      email: 'email', phone: 'phone', notes: 'notes',
      starttime: 'datetime', date: 'date', time: 'time',
      calendar: 'artist_name', type: 'design_details',
      duration: 'duration_minutes', price: 'price',
      amountpaid: 'price', canceled: 'status', cancelled: 'status',
    },
  },
  fresha: {
    label: 'Fresha',
    dayFirst: true,
    headers: {
      clientname: 'client_name', client: 'client_name',
      firstname: 'first_name', lastname: 'last_name',
      mobilenumber: 'phone', telephone: 'phone', email: 'email',
      dateofbirth: 'dob', note: 'notes',
      teammember: 'artist_name', staff: 'artist_name',
      scheduleddate: 'date', date: 'date', time: 'time',
      duration: 'duration_minutes', service: 'design_details',
      total: 'price', price: 'price', status: 'status',
    },
  },
};

// ── Header heuristics (generic fallback) ─────────────────────────────────────

// Ordered rules: first match wins per header. `clientsOnly`/`appointmentsOnly`
// pick the right variant of ambiguous fields for the selected import kind.
const HEURISTICS = [
  { test: h => h.includes('firstname') || h === 'first',            clients: 'first_name', appointments: 'client_first_name' },
  { test: h => h.includes('lastname') || h.includes('surname') || h === 'last', clients: 'last_name', appointments: 'client_last_name' },
  { test: h => h.includes('email'),                                 clients: 'email', appointments: 'client_email' },
  { test: h => h.includes('phone') || h.includes('mobile') || h.includes('cell'), clients: 'phone', appointments: 'client_phone' },
  { test: h => h.includes('dob') || h.includes('birth'),            clients: 'dob' },
  { test: h => h.includes('staff') || h.includes('artist') || h.includes('teammember') || h.includes('calendar') || h.includes('provider') || h.includes('employee'), appointments: 'artist_name' },
  { test: h => h.includes('startat') || h.includes('starttime') || h.includes('startdate') || h === 'start' || h.includes('appointmenttime'), appointments: 'datetime' },
  { test: h => h.includes('duration') || h.includes('minutes'),     appointments: 'duration_minutes' },
  { test: h => h.includes('date') && !h.includes('birth') && !h.includes('end'), appointments: 'date' },
  { test: h => h.includes('time') && !h.includes('end'),            appointments: 'time' },
  { test: h => h.includes('price') || h.includes('amount') || h.includes('total') || h.includes('cost') || h.includes('sale'), appointments: 'price' },
  { test: h => h.includes('status') || h.includes('cancel'),        appointments: 'status' },
  { test: h => h.includes('service') || h.includes('design') || h.includes('description') || h === 'type', appointments: 'design_details' },
  { test: h => h.includes('placement') || h.includes('bodypart') || h.includes('location') || h.includes('area'), appointments: 'body_location' },
  { test: h => h.includes('note') || h.includes('memo') || h.includes('comment'), clients: 'notes', appointments: 'notes' },
  { test: h => h.includes('name') || h === 'client' || h === 'customer', clients: 'name', appointments: 'client_name' },
];

// suggestMapping returns { fieldKey: header } for a set of CSV headers,
// preset entries first, heuristics filling the gaps.
export function suggestMapping(headers, kind, presetKey = 'generic') {
  const preset = PRESETS[presetKey] ?? PRESETS.generic;
  const fields = kind === 'clients' ? CLIENT_FIELDS : APPOINTMENT_FIELDS;
  const validKeys = new Set(fields.map(f => f.key));
  const mapping = {};

  for (const header of headers) {
    const n = norm(header);
    let field = preset.headers[n];
    // Preset maps use client-kind keys for shared fields; translate.
    if (field && kind === 'appointments') {
      const translate = { name: 'client_name', first_name: 'client_first_name', last_name: 'client_last_name', email: 'client_email', phone: 'client_phone' };
      field = translate[field] ?? field;
    }
    if (!field || !validKeys.has(field)) {
      const rule = HEURISTICS.find(r => r.test(n) && r[kind]);
      field = rule?.[kind];
    }
    if (field && validKeys.has(field) && !mapping[field]) mapping[field] = header;
  }
  return mapping;
}

// suggestKind guesses whether a CSV is a client list or appointment history.
export function suggestKind(headers) {
  const n = headers.map(norm);
  const apptSignals = ['startat', 'starttime', 'appointmenttime', 'duration', 'service', 'status', 'staff', 'teammember', 'calendar'];
  const hasDate = n.some(h => (h.includes('date') && !h.includes('birth')) || h.includes('time'));
  const hasApptSignal = n.some(h => apptSignals.some(s => h.includes(s)));
  return hasDate && hasApptSignal ? 'appointments' : 'clients';
}

// ── Value parsers ─────────────────────────────────────────────────────────────

export function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase();
}

// Mirrors the backend normalizer: digits only, leading '+' kept.
export function normalizePhone(phone) {
  const t = (phone ?? '').trim();
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '+' && i === 0) out += ch;
  }
  return out === '+' ? '' : out;
}

export function parsePrice(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// parseDate returns { y, m, d } or null. Accepts ISO, numeric D/M/Y or M/D/Y
// (per dayFirst), and lets the native Date parser take a shot at month-name
// formats like "Jan 5, 2024".
function parseDateParts(raw, dayFirst) {
  const t = (raw ?? '').trim();
  if (!t) return null;

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };

  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [a, b, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    let day = dayFirst ? a : b;
    let month = dayFirst ? b : a;
    if (month > 12 && day <= 12) [day, month] = [month, day]; // unambiguous swap
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { y, m: month, d: day };
  }

  const native = new Date(t);
  if (!Number.isNaN(native.getTime())) {
    return { y: native.getFullYear(), m: native.getMonth() + 1, d: native.getDate() };
  }
  return null;
}

// parseTime returns minutes since midnight, or null.
function parseTimeMinutes(raw) {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// parseDateTime combines a datetime column (or separate date + time columns)
// into an RFC3339 string in the browser's timezone (studio-local).
// Returns null when unparseable.
export function parseDateTime({ datetime, date, time }, dayFirst) {
  let dateRaw = datetime || date;
  let timeRaw = time;

  if (datetime) {
    // Split a combined value: date part first, remainder is the time.
    const t = datetime.trim();
    const isoMatch = t.match(/^(\d{4}-\d{1,2}-\d{1,2})[T ](.+)$/);
    const genMatch = t.match(/^(\S+)\s+(.+)$/);
    if (isoMatch) { dateRaw = isoMatch[1]; timeRaw = timeRaw || isoMatch[2]; }
    else if (genMatch && parseDateParts(genMatch[1], dayFirst)) { dateRaw = genMatch[1]; timeRaw = timeRaw || genMatch[2]; }
  }

  const parts = parseDateParts(dateRaw, dayFirst);
  if (!parts) return null;
  let minutes = parseTimeMinutes((timeRaw ?? '').replace(/(z|[+-]\d{2}:?\d{2})$/i, '').trim());
  if (minutes == null) {
    // Fall back to native parsing of a combined string for exotic formats.
    if (datetime) {
      const native = new Date(datetime.trim());
      if (!Number.isNaN(native.getTime())) return native.toISOString();
    }
    minutes = 12 * 60; // date-only rows default to midday
  }
  const d = new Date(parts.y, parts.m - 1, parts.d, Math.floor(minutes / 60), minutes % 60);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// parseDOB → 'YYYY-MM-DD' or ''.
export function parseDOB(raw, dayFirst) {
  const parts = parseDateParts(raw, dayFirst);
  if (!parts) return '';
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
}

// normalizeStatus maps a vendor status string onto the backend's four
// accepted values. Unrecognized values fall back by appointment time.
export function normalizeStatus(raw, chosenTimeISO) {
  const t = (raw ?? '').trim().toLowerCase();
  if (t.includes('no show') || t.includes('no-show') || t.includes('noshow')) return 'no_show';
  if (t.includes('cancel') || t.includes('declin') || t.includes('void') || t.includes('refund') || t === 'yes' /* Acuity "Canceled" column */) return 'cancelled';
  if (t.includes('complet') || t.includes('paid') || t.includes('finish') || t.includes('done') || t.includes('closed') || t.includes('arrived') || t.includes('checked')) return 'completed';
  if (t.includes('confirm') || t.includes('upcoming') || t.includes('booked') || t.includes('accept') || t.includes('schedul') || t.includes('pending')) return 'confirmed';
  return chosenTimeISO && new Date(chosenTimeISO) > new Date() ? 'confirmed' : 'completed';
}

export function parseDurationMinutes(raw) {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t) return null;
  const hm = t.match(/^(\d+)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m)?/);
  if (hm) return +hm[1] * 60 + (hm[2] ? +hm[2] : 0);
  const mm = t.match(/^(\d+)/);
  return mm ? +mm[1] : null;
}
