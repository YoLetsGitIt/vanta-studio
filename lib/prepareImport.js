import { normalizeEmail, normalizePhone, parsePrice, parseDateTime, parseDOB, normalizeStatus, parseDurationMinutes } from './importPresets.js';

// Shared by the review screen and fixture tests. Preparing rows never writes data.
export function prepareImport({ rows, mapping, kind, dayFirst, timezone, artistMap = {}, upcomingOnly = true, now = Date.now() }) {
  const seen = new Set();
  const get = (row, key) => (mapping[key] ? row[mapping[key]] ?? '' : '').trim();
  return rows.map((row, index) => {
    const errors = [];
    const client = kind === 'clients';
    const prefix = client ? '' : 'client_';
    const name = get(row, client ? 'name' : 'client_name') || [get(row, `${prefix}first_name`), get(row, `${prefix}last_name`)].filter(Boolean).join(' ');
    const email = normalizeEmail(get(row, `${prefix}email`));
    const phone = normalizePhone(get(row, `${prefix}phone`));
    if (!name && (client || (!email && !phone))) errors.push('Missing client name');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push('Invalid email');
    if (client && !email && !phone) errors.push('Email or phone is required');
    let payload;
    let excludedReason = '';
    if (client) {
      const dob = parseDOB(get(row, 'dob'), dayFirst);
      if (get(row, 'dob') && !dob) errors.push('Invalid date of birth');
      payload = { name, email, phone, dob, notes: get(row, 'notes') };
    } else {
      const zone = get(row, 'timezone') || timezone;
      const chosen = parseDateTime({ datetime: get(row, 'datetime'), date: get(row, 'date'), time: get(row, 'time'), timezone: zone }, dayFirst, timezone);
      if (!chosen) errors.push('Invalid or missing date/time or timezone (check daylight saving and date format)');
      const status = normalizeStatus(get(row, 'status'), chosen, now);
      if (!status) errors.push('Unknown appointment status; map a booking status or leave it unmapped');
      let duration = parseDurationMinutes(get(row, 'duration_minutes'));
      if (get(row, 'duration_minutes') && !duration) errors.push('Invalid duration');
      const hasEnd = get(row, 'end_datetime') || get(row, 'end_date') || get(row, 'end_time');
      if (!get(row, 'duration_minutes') && hasEnd && chosen) {
        const startDate = get(row, 'date') || get(row, 'datetime').replace(/[T\s]+\d{1,2}:\d{2}.*$/i, '');
        const end = parseDateTime({ datetime: get(row, 'end_datetime'), date: get(row, 'end_date') || startDate, time: get(row, 'end_time'), timezone: zone }, dayFirst, timezone);
        duration = end ? (Date.parse(end) - Date.parse(chosen)) / 60000 : null;
        if (!Number.isInteger(duration) || duration <= 0) errors.push('End time must be valid and after the start; map the end date for overnight bookings');
      }
      const priceRaw = get(row, 'price');
      const price = parsePrice(priceRaw);
      if (priceRaw && (price === null || price < 0)) errors.push('Invalid price');
      payload = {
        client_name: name, client_email: email, client_phone: phone,
        artist_id: artistMap[get(row, 'artist_name')] || '', chosen_time: chosen || '',
        duration_minutes: duration, design_details: get(row, 'design_details'),
        body_location: get(row, 'body_location'), notes: get(row, 'notes'), price, status,
      };
      if (upcomingOnly && chosen && status) {
        if (Date.parse(chosen) <= Number(now)) excludedReason = 'Past appointment';
        else if (status !== 'confirmed') excludedReason = `Appointment is ${status.replace('_', ' ')}`;
      }
    }
    // Mirror the server's contact/time matching, including email precedence for bookings.
    const contacts = client ? [email && `email:${email}`, phone && `phone:${phone}`].filter(Boolean)
      : [`${payload.chosen_time}:${email ? `email:${email}` : phone ? `phone:${phone}` : `name:${name}`}`];
    if (!errors.length && !excludedReason) {
      if (contacts.some(key => seen.has(key))) excludedReason = 'Duplicate in this file';
      else contacts.forEach(key => seen.add(key));
    }
    return { line: index + 2, errors, excludedReason, payload, source: row };
  });
}

export function importReportCSV(items, headers) {
  const quote = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [['Data row', 'Import result', ...headers], ...items.map(item => [
    item.line - 1, item.reason || item.errors?.join('; ') || item.excludedReason,
    ...headers.map(header => item.source?.[header] ?? ''),
  ])].map(row => row.map(quote).join(',')).join('\r\n');
}
