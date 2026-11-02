import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCSV } from '../lib/csv.js';
import { suggestMapping, suggestKind, suggestPreset, parseDateTime, parseDOB, parseDurationMinutes, normalizeStatus } from '../lib/importPresets.js';
import { prepareImport, importReportCSV } from '../lib/prepareImport.js';

const now = Date.parse('2026-10-28T00:00:00Z');
function fixture(name, kind) {
  const { headers, rows } = parseCSV(readFileSync(new URL(`./fixtures/import/${name}.csv`, import.meta.url), 'utf8'));
  const preset = suggestPreset(headers);
  const mapping = suggestMapping(headers, kind, preset);
  return { headers, rows, mapping, kind, dayFirst: preset !== 'acuity', timezone: 'Australia/Melbourne', now, artistMap: { 'Sam Anderson': 'sam-id' } };
}

test('Acuity quotes use Price even when Amount Paid is earlier; end times supply duration', () => {
  const data = fixture('acuity-appointments', 'appointments');
  assert.equal(suggestKind(data.headers), 'appointments');
  assert.equal(data.mapping.price, 'Price');
  const rows = prepareImport(data);
  assert.equal(rows[0].payload.chosen_time, '2030-10-29T23:00:00.000Z');
  assert.equal(rows[0].payload.duration_minutes, 90);
  assert.equal(rows[0].payload.price, 450);
  assert.equal(rows[0].payload.artist_id, 'sam-id');
  assert.equal(rows[1].excludedReason, 'Appointment is cancelled');
  assert.equal(rows[2].excludedReason, 'Past appointment');
  assert.equal(rows[3].excludedReason, 'Duplicate in this file');
  assert.match(rows[4].errors.join(), /date\/time/);
  assert.equal(prepareImport({ ...data, upcomingOnly: false }).filter(row => !row.errors.length && !row.excludedReason).length, 3);
});

test('Jotform metadata never becomes appointment date or payment status', () => {
  const data = fixture('jotform-appointments', 'appointments');
  assert.equal(data.mapping.date, 'Appointment Date');
  assert.equal(data.mapping.time, 'Appointment Time');
  assert.equal(data.mapping.status, 'Appointment Status');
  const rows = prepareImport(data);
  assert.equal(rows[0].payload.chosen_time, '2030-10-29T23:00:00.000Z');
  assert.equal(rows[0].payload.status, 'confirmed');
  assert.equal(rows[1].payload.artist_id, '');
  assert.equal(suggestKind(['Submission Date', 'Submission ID', 'Name', 'Payment Status']), 'clients');
  const mapping = suggestMapping(['Submission Date', 'Date Scheduled', 'Full Name', 'Payment Status'], 'appointments', 'jotform');
  assert.equal(mapping.date, undefined);
  assert.equal(mapping.status, undefined);
});

test('both client sources preserve phone-only clients and flag duplicates within a file', () => {
  const acuity = prepareImport(fixture('acuity-clients', 'clients'));
  assert.equal(acuity[0].payload.phone, '+61412345678');
  assert.equal(acuity[1].payload.email, '');
  assert.deepEqual(acuity[1].errors, []);
  assert.equal(acuity[2].excludedReason, 'Duplicate in this file');
  const jotform = prepareImport(fixture('jotform-clients', 'clients'));
  assert.equal(jotform[0].payload.dob, '1990-06-05');
});

test('operator can map custom Jotform question headings without editing the export', () => {
  const prepared = prepareImport({ rows: [{ 'Your full name?': 'Alex', 'Best email?': 'alex@example.test', 'When?': '30/10/2030 10:00 AM' }],
    mapping: { client_name: 'Your full name?', client_email: 'Best email?', datetime: 'When?' }, kind: 'appointments',
    dayFirst: true, timezone: 'Australia/Melbourne', now });
  assert.deepEqual(prepared[0].errors, []);
  assert.equal(prepared[0].payload.chosen_time, '2030-10-29T23:00:00.000Z');
});

test('wall times use the selected timezone across summer, winter and half-hour offsets', () => {
  assert.equal(parseDateTime({ date: '2030-10-30', time: '10:00' }, true, 'Australia/Melbourne'), '2030-10-29T23:00:00.000Z');
  assert.equal(parseDateTime({ date: '2030-06-30', time: '10:00' }, true, 'Australia/Melbourne'), '2030-06-30T00:00:00.000Z');
  assert.equal(parseDateTime({ date: '2030-10-30', time: '10:00', timezone: 'Australia/Adelaide' }, true, 'UTC'), '2030-10-29T23:30:00.000Z');
  assert.equal(parseDateTime({ datetime: '2030-10-30T10:00:00+11:00' }, true, 'America/New_York'), '2030-10-29T23:00:00.000Z');
  assert.equal(parseDateTime({ datetime: '2030-10-30T10:00:00Z' }, true, 'Australia/Melbourne'), '2030-10-30T10:00:00.000Z');
});

test('invalid, missing, ambiguous and nonexistent times cannot silently move appointments', () => {
  for (const [date, time] of [['31/02/2030', '10:00'], ['30/10/2030', ''], ['30/10/2030', '25:00'], ['30/10/2030', '13pm'], ['04/10/2026', '02:30'], ['05/04/2026', '02:30']]) {
    assert.equal(parseDateTime({ date, time }, true, 'Australia/Melbourne'), null, `${date} ${time}`);
  }
  assert.equal(parseDateTime({ date: '2030-10-30', time: '10:00' }, true, 'unknown/zone'), null);
  assert.equal(parseDOB('31/02/2000', true), '');
  assert.equal(parseDOB('29/02/2000', true), '2000-02-29');
});

test('separate Acuity start/end dates and times and overnight bookings calculate duration', () => {
  const headers = ['Name', 'Email', 'Start Date', 'Start Time', 'End Date', 'End Time'];
  const rows = prepareImport({ rows: [{ Name: 'Alex', Email: 'alex@example.test', 'Start Date': '10/30/2030', 'Start Time': '11:00pm', 'End Date': '10/31/2030', 'End Time': '1:00am' }], mapping: suggestMapping(headers, 'appointments', 'acuity'), kind: 'appointments', timezone: 'Australia/Melbourne', dayFirst: false, now });
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[0].payload.duration_minutes, 120);
});

test('unknown status is reviewed; paid does not mean completed and not cancelled stays active', () => {
  const future = '2030-10-30T00:00:00Z';
  assert.equal(normalizeStatus('unpaid', future, now), 'confirmed');
  assert.equal(normalizeStatus('not cancelled', future, now), 'confirmed');
  assert.equal(normalizeStatus('Paid', future, now), 'confirmed');
  assert.equal(normalizeStatus('something unknown', future, now), null);
  assert.equal(normalizeStatus('true', future, now), 'cancelled');
  assert.equal(parseDurationMinutes('1h 30m'), 90);
  assert.equal(parseDurationMinutes('1:30'), 90);
  assert.equal(parseDurationMinutes('0'), null);
  assert.equal(parseDurationMinutes('60 rubbish'), null);
});

test('malformed CSV, repeated headers, shifted cells and unclosed quotes fail before import', () => {
  for (const text of ['Name,Name\nAlex,Alex', 'Name,\nAlex,test', 'Name,Notes\nAlex,"Unclosed', 'Name,Email\nAlex,a@example.test,extra', 'Name,Notes\nAlex,Text"oops']) assert.throws(() => parseCSV(text));
  const data = parseCSV('\uFEFFName,Notes\r\nAlex,"One, two\nAnd ""quotes"""\r\n');
  assert.equal(data.rows[0].Notes, 'One, two\nAnd "quotes"');
});

test('problem downloads contain all source columns and spreadsheet-safe cells', () => {
  const csv = importReportCSV([{ line: 2, errors: ['Missing time'], source: { Name: '=1+1', Notes: 'Hello, "Alex"\nNew line' } }], ['Name', 'Notes']);
  assert.match(csv, /Missing time/);
  assert.match(csv, /'=1\+1/);
  assert.match(csv, /Hello, ""Alex""/);
  assert.equal(parseCSV(csv).rows.length, 1);
});
