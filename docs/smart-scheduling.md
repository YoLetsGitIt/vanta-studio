# Smart scheduling: implementation and decisions

Implemented 9 September 2026 across `vanta-studio`, `vanta-backend` and `vanta-website`.

## What studios and clients get

Open **Settings → Bookings → Smart scheduling** and choose:

| Setting | Client experience |
| --- | --- |
| Show all availability | Every valid start time, in chronological order. |
| Fill quieter days | Up to three suggested dates in the displayed month, followed by a calendar with every available date. Each date initially shows up to three suggested start times. |
| Minimise gaps | Up to three start times closest to existing commitments. On completely empty working days, every valid start time is shown. |

For either recommendation mode, **Show all times** expands the selected date to every valid slot; **Show suggested times** restores the recommendations. Changing dates, artists or months clears the previous time selection. Times and confirmation details use the studio timezone, including when the client is overseas.

## Decisions and reasons

1. **Implement the three modes discussed.** This does not introduce Acuity's separate “Look busy” percentage-hiding feature. The modes here help clients choose among real openings.
2. **One studio-wide preference, defaulting to `all`.** Existing studios retain chronological availability until they save a different choice. The model, migration and startup schema setup share the same default. Invalid values are rejected by the profile API and database constraint.
3. **Apply the preference to client selection links.** This extends the existing `/booking/{token}` journey. It does not change staff calendar ordering, the public intake form, or the separate rescheduling page. Existing selection links pick up the preference when availability is loaded again.
4. **Recommendations remain optional.** Ranking does not remove valid slots from the API or create artificial unavailability. Staff can still use their existing workflow. Existing confirmation and deposit behaviour remains in place.
5. **Compare dates within the displayed month.** One request loads up to 31 days; the database and Google Calendar are read for that range rather than making one external-calendar request per date. Navigating months loads a new range. This is a recommendation window, not a new booking-horizon restriction.
6. **Measure quieter days per selected artist.** Utilisation is occupied Vanta booking time divided by the artist's scheduled working time for that day. It is not appointment count or whole-studio utilisation. Work outside that day's hours is clipped, and overlapping records are merged to avoid double counting.
7. **Retain existing blocking statuses.** Confirmed, requires-confirmation and awaiting-payment bookings count as occupied time. Hold-release/payment-expiry policy is unchanged; the ranking does not independently release unpaid bookings.
8. **Keep external calendar commitments separate from booked utilisation.** They block times and influence gap suggestions, but do not count as Vanta-booked hours. A day with no valid artist-and-station slot cannot be recommended.
9. **Gap ranking uses the nearest commitment boundary.** A slot ending at the next commitment's start, or starting at the previous commitment's end, has a gap score of zero. Otherwise, its smallest gap to a commitment determines its rank. Overlapping commitments are merged. This favours close fits; it is not a global optimisation of the entire week's schedule.
10. **Use three suggestions and stable ties.** Quieter dates sort by utilisation, then earlier date. Suggested times sort by gap, then earlier time. Suggested times are displayed chronologically within the chosen subset. Quieter-day mode uses gap ranking within each suggested or manually selected date. On an empty day, quieter-day mode suggests the first three slots; minimise-gaps mode shows them all.
11. **Keep the existing 30-minute start grid and appointment duration.** No new buffer, pricing, appointment-template or artist-matching rules were added. Configurable cleanup buffers would need to become a shared availability rule before ranking can account for them. Current work schedules provide one opening interval per weekday; split and overnight schedules remain outside this change.
12. **Use studio-local calendar boundaries and explicit timestamps.** Month ranges use local midnight and calendar-day arithmetic, which accommodates daylight-saving days. Each slot includes `starts_at` with its timezone offset; the browser submits that instant, not a browser-local reinterpretation of `HH:MM`. Past starts and nonexistent spring-forward wall times are excluded. The start grid offers one occurrence of an ambiguous fall-back wall time.
13. **Preserve resource checks and improve overlap reads.** Artist working days, artist booking eligibility/end dates, station closures/end dates, overlapping bookings and connected-calendar busy periods constrain availability. Range reads include bookings that began before the range but overlap it. Studios without stations retain the previous artist-only behaviour.
14. **Treat failed checks as errors.** Database or connected-calendar failures produce a retryable availability error, rather than an empty-looking schedule that could be mistaken for free time. Google Free/Busy responses with missing calendars or calendar-level errors are rejected. Availability requests have a 15-second deadline. As before, external checks depend on the calendar service being configured on the backend.
15. **Keep private calendar details off the public response.** The API exposes valid slots and recommendations, not utilisation figures, busy event spans or station IDs. The old public `debug=1` details are no longer returned.
16. **Prevent stale request results from replacing newer ones.** The client aborts obsolete requests, keys results by artist and month, clears old slots during loading, and offers a retry on errors. Responses are marked `no-store`. Slot reservation still uses the existing submission endpoint and conflict checks; this work does not make that endpoint's writes atomic.
17. **Extend the existing stack.** No new production dependency, AI model, scheduling vendor or additional credential is required. The original single-day API still returns `slots: ["HH:MM", ...]`, with additional metadata. The updated website requires the backend's new range response, so release the backend first.
18. **Keep changes reviewable.** The implementation pass stayed local and preserved existing source edits; production builds regenerate local export artifacts. The subsequent deployment was explicitly requested by the user.
19. **Embed timezone data for production.** The Alpine container does not ship a system timezone database, so the Go binary includes `time/tzdata`. An `X-Vanta-Scheduling-Version: 1` response header identifies the deployed availability implementation without requiring a real booking link.

## API and files

`GET /booking/{token}/slots?date=2026-09-01&artist_id=UUID&days=30`

Returns `mode`, `timezone`, `recommended_dates` and `days`. Each day contains `date`, `slots`, `slot_details` (`time`, `starts_at`) and `recommended_slots`. Omitting `days` retains the single-day top-level fields. The range limit is 1–31 days.

Main files:

- `vanta-backend/internal/handlers/smart_scheduling.go`: deterministic availability/ranking helpers.
- `vanta-backend/internal/handlers/booking_availability.go`: batched availability endpoint.
- `vanta-backend/internal/models/scheduling.go`: accepted mode values.
- `vanta-backend/migrations/20260909_add_scheduling_mode.sql`: additive database migration; the repository's existing startup schema mechanism also ensures this column.
- `vanta-studio/app/dashboard/settings/page.js` and `lib/api.js`: preference editing and persistence request.
- `vanta-website/app/booking/[token]/BookingSelectionClient.js`: client recommendations and timezone-aware selection.

## Validation and rollout

Automated Go tests cover mode-independent availability, recommendation validity, gap ranking, empty days, unavailable stations, invalid/oversized duration, booked-hours utilisation, overlapping records, short working days, calendar-only commitments, tie ordering, the recommendation limit, timezone offsets, daylight-saving gaps and past slots. Calendar service tests cover empty, busy, missing and failed calendars.

Browser smoke tests use intercepted API fixtures; they do not contact live booking or payment services. They exercise all three modes on mobile, expanding/collapsing suggestions, month navigation, failure/retry, overseas time display and the submitted timestamp. A separate studio test exercises the default and all three preference saves/reloads against a mocked profile API. These tests do not establish live database or Google/Stripe integration correctness.

Commands:

```sh
# In vanta-backend
GOCACHE=/private/tmp/vanta-go-cache go test ./...

# In each frontend
npm run build

# Serve each out/ directory locally, then run its browser test:
VANTA_PLAYWRIGHT_PATH=/path/to/playwright node scripts/smart-scheduling-smoke.cjs
# Website defaults to localhost:3018; studio defaults to localhost:3019.
```

Roll out the additive database migration and backend before the studio and booking website. The startup schema path should be checked in deployment logs, or apply the migration explicitly through the normal database process. Enable a recommendation mode on a pilot studio and verify its real working hours, station closures, Google connection and client submission before enabling it more widely. Default `all` makes adoption opt-in.

Implementation-time integration limits: the initial checks did not run a live database migration or production provider round trip. See the deployment record for subsequent release verification. Existing selection-time transaction/race handling, payment holds, rescheduling, configurable buffers and calendar synchronisation lifecycle were not redesigned here.
