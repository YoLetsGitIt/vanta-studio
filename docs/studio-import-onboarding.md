# Studio onboarding: Acuity and Jotform

The studio dashboard's **Import data** page accepts client and appointment CSVs.
You can prepare the studio account and artist memberships before receiving exports.
Actual export headings can be adjusted in the mapping screen on onboarding day.

## On the day

1. Sign in to the intended approved studio account. Confirm its timezone in Settings
   and add/approve its artists before importing appointments.
2. Collect the Acuity client CSV and an appointments CSV covering **all future
   appointments**, including bookings beyond the current week. If Jotform contains
   additional contacts or bookings, collect a submissions CSV for each relevant form.
3. Open **Import data** and upload the client file first. Review the detected source
   and select Clients if necessary. Map full name (or first and last names), email,
   phone, and any DOB/notes columns to retain. Phone-only contacts are supported.
4. Preview and import. Import additional client files individually. Matching contacts
   are skipped: this does **not** merge additional Jotform answers into an existing
   client's notes or replace existing contact details. Review which source should
   supply those details first.
5. Upload appointments. Confirm the source, date format, and **studio timezone**.
   Dates such as `03/04/2030` require an explicit DD/MM or MM/DD choice. A row's IANA
   timezone or timestamp's numeric UTC offset takes priority over the default timezone.
6. Leave **Import upcoming, active appointments only** checked. Past, cancelled,
   completed, and no-show bookings are excluded. Jotform submission dates, payment
   status, and amounts paid are not automatically treated as appointment dates,
   booking status, or service prices.
7. Map artist/calendar names to approved studio artists. Only exact names are
   automatically matched; unmatched bookings are clearly shown as **Unassigned**.
8. Review the preview: client, local date/time, artist, duration, status, service and
   price. Check the columns listed as not imported. For Acuity, end date/time can
   supply duration when there is no duration column.
9. Download problem/excluded rows for reconciliation, then import the ready rows.
   Rows with missing times, invalid dates, unknown booking statuses, or ambiguous
   daylight-saving times need correction. No appointment is silently set to midday.
10. Check imported counts, the Clients list and the Schedule against the source
    exports. Resolve unassigned bookings. Switch the studio's public booking links
    at the agreed cutover time and collect any bookings added after the export.

Previewing does not write records. Import runs in batches of 200. If interrupted,
keep the page open and use **Retry remaining batches**. It resumes from the affected
batch; the server skips matching records already saved. A full page reload loses
the progress display, but the original file can be reviewed and imported again.

## Matching and limitations

- Contacts match within a studio by email or normalized phone. Emails are trimmed
  and lowercased; phones retain digits and a leading `+`. Local and international
  formats (`0412…` vs `+61412…`) are not automatically equated.
- Imported bookings match by studio, instant and contact: email takes priority over
  phone, with a name fallback. Names and contact details should remain consistent
  across exports and retries. Changed bookings are not automatically updated.
- This is a CSV migration, not a live Acuity/Jotform synchronization.
- Jotform custom question headings can be mapped manually; not every form is a
  booking form. Export a standard CSV with unique, nonempty column headings.
- Signed consent documents, signatures, attachments, payment transactions, deposits,
  balances and marketing permissions are outside this importer. Prices on upcoming
  appointments become quotes, not recorded payments. Keep the source records for
  anything outside the mapped client/appointment fields.
- This change requires both the Studio frontend and backend to be released. It
  uses the existing import API and contact schema; no new migration is required.

## Verification

Synthetic CSVs are in `scripts/fixtures/import/` (example.test contacts and future
2030 bookings). They are test data and should not be imported into a live studio.

```sh
node --test scripts/import.test.mjs
npm run build
# Serve out/ locally, then run with Playwright available:
STUDIO_TEST_URL=http://127.0.0.1:3028 node scripts/import-smoke.cjs
```

The browser check mocks every external service and checks desktop/mobile layouts,
the exact submitted payloads and a 401-row interrupted import. Optional
`STUDIO_PLAYWRIGHT_PATH` and `STUDIO_CHROMIUM_EXECUTABLE` select installed tooling.

The backend integration test requires an explicitly supplied **isolated loopback**
PostgreSQL URL, creates its own schema, and never loads the application `.env`:

```sh
IMPORT_TEST_DATABASE_URL='postgres://USER@127.0.0.1:PORT/postgres?sslmode=disable' \
  go test ./internal/repository -run 'TestStudioImport|TestNormalizeImport' -v
```
