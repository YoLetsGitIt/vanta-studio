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
  { key: 'end_datetime',      label: 'End date & time', hint: 'used to calculate duration when no duration column exists' },
  { key: 'end_date',          label: 'End date' },
  { key: 'end_time',          label: 'End time' },
  { key: 'timezone',          label: 'Timezone', hint: 'IANA name, for example Australia/Melbourne' },
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
      starttime: 'datetime', startdate: 'date', date: 'date', time: 'time',
      endtime: 'end_datetime', enddate: 'end_date', timezone: 'timezone',
      calendar: 'artist_name', type: 'design_details',
      duration: 'duration_minutes', price: 'price',
      canceled: 'status', cancelled: 'status',
    },
  },
  jotform: {
    label: 'Jotform',
    dayFirst: true,
    headers: {
      fullname: 'name', name: 'name', firstname: 'first_name', lastname: 'last_name',
      email: 'email', emailaddress: 'email', phone: 'phone', phonenumber: 'phone',
      dateofbirth: 'dob', notes: 'notes', additionalcomments: 'notes',
      appointment: 'datetime', appointmentdate: 'date', appointmenttime: 'time',
      artist: 'artist_name', artistname: 'artist_name',
      duration: 'duration_minutes', service: 'design_details',
      appointmentstatus: 'status', timezone: 'timezone',
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
  { test: h => h === 'timezone', appointments: 'timezone' },
  { test: h => h.includes('enddate') && h.includes('time'), appointments: 'end_datetime' },
  { test: h => h.includes('enddate'), appointments: 'end_date' },
  { test: h => h.includes('endtime'), appointments: 'end_time' },
  { test: h => h.includes('datetime') || h.includes('startat') || h.includes('starttime') || h === 'start', appointments: 'datetime' },
  { test: h => h.includes('duration') || h.includes('minutes'),     appointments: 'duration_minutes' },
  { test: h => h.includes('date') && !h.includes('birth') && !h.includes('end'), appointments: 'date' },
  { test: h => h.includes('time') && !h.includes('end'),            appointments: 'time' },
  { test: h => h.includes('price') || h === 'total' || h === 'cost', appointments: 'price' },
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

  const translate = kind === 'appointments'
    ? { name: 'client_name', first_name: 'client_first_name', last_name: 'client_last_name', email: 'client_email', phone: 'client_phone' }
    : { client_name: 'name', client_first_name: 'first_name', client_last_name: 'last_name', client_email: 'email', client_phone: 'phone' };
  // Reserve exact preset matches first, regardless of column order.
  for (const header of headers) {
    const key = preset.headers[norm(header)];
    const field = translate[key] ?? key;
    if (validKeys.has(field) && !mapping[field]) mapping[field] = header;
  }
  for (const header of headers) {
    const n = norm(header);
    // Export metadata and payment fields are not booking dates, status or prices.
    if (/submission|created|updated|datescheduled|lastappointment|dayssince|payment|amountpaid|deposit/.test(n)) continue;
    if (Object.values(mapping).includes(header)) continue;
    const rule = HEURISTICS.find(r => r.test(n) && r[kind]);
    const field = rule?.[kind];
    if (field && validKeys.has(field) && !mapping[field]) mapping[field] = header;
  }
  return mapping;
}

// suggestKind guesses whether a CSV is a client list or appointment history.
export function suggestKind(headers) {
  const n = headers.map(norm).filter(h => !/submission|created|updated|datescheduled|birth/.test(h));
  const apptSignals = ['startat', 'starttime', 'appointmenttime', 'duration', 'service', 'status', 'staff', 'teammember', 'calendar'];
  const hasDate = n.some(h => (h.includes('date') && !h.includes('birth')) || h.includes('time'));
  const hasApptSignal = n.some(h => apptSignals.some(s => h.includes(s)));
  return hasDate && hasApptSignal ? 'appointments' : 'clients';
}

export function suggestPreset(headers) {
  const n = headers.map(norm);
  if (n.includes('submissionid') || n.includes('submissiondate')) return 'jotform';
  if (n.includes('calendar') && (n.includes('starttime') || n.includes('appointmentid'))) return 'acuity';
  return 'generic';
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
  const cleaned = String(raw).trim().replace(/^(?:AUD|USD|NZD|GBP|EUR)\s*/i, '').replace(/^[$£€]\s*/, '');
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned.replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

// Validate calendar dates instead of allowing Date to roll 31 February into March.
function validDate(y, m, d) {
  const value = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && y <= 9999 && value.getUTCFullYear() === y && value.getUTCMonth() === m - 1 && value.getUTCDate() === d;
}

function parseDateParts(raw, dayFirst) {
  const t = (raw ?? '').trim();
  let match = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y, m, d;
  if (match) [, y, m, d] = match.map(Number);
  else {
    match = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
    if (match) {
      const a = +match[1], b = +match[2];
      y = +match[3];
      if (y < 100) y += 2000;
      d = dayFirst ? a : b;
      m = dayFirst ? b : a;
      if (m > 12 && d <= 12) [m, d] = [d, m];
    } else {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      match = t.match(/^(\d{1,2})[ -]([a-z]+)[, -]+(\d{4})$/i);
      if (match) { d = +match[1]; m = months.indexOf(match[2].slice(0, 3).toLowerCase()) + 1; y = +match[3]; }
      else {
        match = t.match(/^([a-z]+) (\d{1,2}),? (\d{4})$/i);
        if (!match) return null;
        m = months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1; d = +match[2]; y = +match[3];
      }
    }
  }
  return validDate(y, m, d) ? { y, m, d } : null;
}

function parseClock(raw) {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2})(?:\.\d+)?)?\s*(am|pm)?$/i);
  if (!match) return null;
  let h = +match[1];
  const m = +(match[2] || 0), s = +(match[3] || 0), meridiem = match[4]?.toLowerCase();
  if (m > 59 || s > 59 || h > 23 || (meridiem && (h < 1 || h > 12))) return null;
  if (meridiem) h = h % 12 + (meridiem === 'pm' ? 12 : 0);
  return { h, m, s };
}

const zoneFormatters = new Map();
function zoneParts(time, timeZone) {
  if (!zoneFormatters.has(timeZone)) {
    zoneFormatters.set(timeZone, new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }));
  }
  const parts = Object.fromEntries(zoneFormatters.get(timeZone).formatToParts(new Date(time)).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

// Resolve studio wall time without using the importing computer's timezone.
// Reject nonexistent and ambiguous DST times; an explicit UTC offset resolves ambiguity.
export function parseDateTime({ datetime = '', date = '', time = '', timezone = '' }, dayFirst, defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  let dateRaw = date.trim(), timeRaw = time.trim();
  const combined = datetime.trim();
  if (combined) {
    const match = combined.match(/^(.+?)[T\s]+(\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:am|pm)?(?:Z|[+-]\d{2}:?\d{2})?)$/i);
    if (match) { dateRaw = match[1]; timeRaw = timeRaw || match[2]; }
    else if (parseClock(combined)) timeRaw = timeRaw || combined;
    else if (parseDateParts(combined, dayFirst)) dateRaw = combined;
    else return null;
  }
  const parts = parseDateParts(dateRaw, dayFirst);
  if (!parts || !timeRaw) return null;
  const offset = timeRaw.match(/(Z|[+-]\d{2}:?\d{2})$/i)?.[1];
  const clock = parseClock(offset ? timeRaw.slice(0, -offset.length).trim() : timeRaw);
  if (!clock) return null;
  const wall = Date.UTC(parts.y, parts.m - 1, parts.d, clock.h, clock.m, clock.s);
  if (offset) {
    let minutes = 0;
    if (offset.toUpperCase() !== 'Z') {
      const digits = offset.slice(1).replace(':', '');
      const hours = +digits.slice(0, 2), mins = +digits.slice(2);
      if (hours > 14 || mins > 59 || (hours === 14 && mins)) return null;
      minutes = (hours * 60 + mins) * (offset[0] === '+' ? 1 : -1);
    }
    return new Date(wall - minutes * 60000).toISOString();
  }
  const zone = timezone.trim() || defaultTimezone;
  try {
    const offsets = new Set([-36, -12, 0, 12, 36].map(hours => {
      const at = wall + hours * 3600000;
      return zoneParts(at, zone) - at;
    }));
    const matches = [...offsets].map(value => wall - value).filter(at => zoneParts(at, zone) === wall);
    return matches.length === 1 ? new Date(matches[0]).toISOString() : null;
  } catch { return null; }
}

export function parseDOB(raw, dayFirst) {
  const parts = parseDateParts(raw, dayFirst);
  if (!parts) return '';
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
}

// normalizeStatus maps a vendor status string onto the backend's four
// accepted values. Unrecognized values fall back by appointment time.
export function normalizeStatus(raw, chosenTimeISO, now = Date.now()) {
  const t = (raw ?? '').trim().toLowerCase().replace(/[_-]/g, ' ');
  if (/^(no show|noshow)$/.test(t)) return 'no_show';
  if (/^(cancelled|canceled|declined|void|refunded|yes|true|1)$/.test(t)) return 'cancelled';
  if (/^(completed|complete|finished|done|closed|arrived|checked in)$/.test(t)) return 'completed';
  if (/^(confirmed|upcoming|booked|accepted|scheduled|pending)$/.test(t)) return 'confirmed';
  if (t && !['no', 'false', '0', 'paid', 'unpaid', 'not cancelled', 'not canceled'].includes(t)) return null;
  return chosenTimeISO && new Date(chosenTimeISO).getTime() > Number(now) ? 'confirmed' : 'completed';
}

export function parseDurationMinutes(raw) {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t) return null;
  let minutes;
  const hours = t.match(/^(\d+)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/);
  const clock = t.match(/^(\d+):(\d{2})$/);
  if (hours) minutes = +hours[1] * 60 + +(hours[2] || 0);
  else if (clock && +clock[2] < 60) minutes = +clock[1] * 60 + +clock[2];
  else if (/^\d+(?:\s*m(?:in(?:ute)?s?)?)?$/.test(t)) minutes = parseInt(t, 10);
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
}
