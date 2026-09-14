# Smart scheduling: implementation and decisions

Revised 9 September 2026. Settings → Bookings → Smart scheduling.

## Behaviour

Three independent controls support eight combinations:

| Only offer quieter months | Only offer quieter days | Keep appointments together | Stored mode |
| --- | --- | --- | --- |
| Off | Off | Off | `all` |
| On | Off | Off | `quieter_months` |
| Off | On | Off | `quieter_days_only` |
| On | On | Off | `quieter_days` (legacy) |
| Off | Off | On | `minimize_gaps` |
| On | Off | On | `quieter_months_gaps` |
| Off | On | On | `quieter_days_gaps` |
| On | On | On | `combined` (legacy) |

Months-only hides busier months but offers every valid date within eligible months. Days-only preserves all eligible months and selects quieter dates within each. Both applies the filters in order. Either period filter uses a rolling 90-day window and signed date eligibility. With neither on, the existing monthly calendar remains.

**Show all times** expands only the selected date. Existing saved `quieter_days` and `combined` preferences retain both period filters; no studio settings are rewritten.

## Algorithm decisions

1. Keep three controls independent. Preserve the four legacy modes and add four modes for months-only/days-only with or without gap minimisation. Migration `20260912_split_quiet_periods.sql` widens the constraint without rewriting settings; startup schema setup applies the same change.
2. Use a rolling **90 calendar days**, starting today in the studio timezone. Quiet-period filtering compares this whole window, so navigating cannot reveal a busier month. Other modes keep the existing month calendar.
3. Measure workload **per selected artist**, using booked minutes divided by future working capacity. This avoids treating one long appointment as equivalent to one short appointment. Monthly ratios use total minutes, not an unweighted average of daily percentages.
4. Count confirmed, requires-confirmation and awaiting-payment sessions using the existing blocking policy. Merge overlapping intervals and clip them to working hours. Only future portions of today's hours contribute.
5. Weekly working hours and date overrides determine capacity. Leave and calendar-only busy time reduce capacity; mirrored Vanta calendar events are not deducted twice. External commitments still block slots and affect gap ranking, but do not count as Vanta bookings. Station restrictions constrain which slots can be offered; utilisation measures artist workload, not station occupancy.
6. A candidate month must contain at least one valid appointment slot. Fully booked scheduled dates still contribute to its workload, preventing a busy month with one empty day from looking empty.
7. When quieter months is on, select at most **two months** within **15 percentage points** of the least-booked eligible month. Rank by utilisation, then earlier month. Example: 20% and 30% qualify together; 75% does not.
8. When quieter days is on, within each available month select at most **six dates** within **15 percentage points** of that month's least-booked eligible date. Rank by utilisation, then earlier date. These are maximums, not quotas: never pad the choices with busier periods. The boundary is inclusive.
9. Display the surviving months and dates chronologically. If nothing has a valid slot, show an empty state and a contact-studio message; do not fall back to excluded dates.
10. Minimise gaps retains the existing nearest-commitment-boundary score. Starting immediately after or ending immediately before a commitment scores zero. Select up to three starts, breaking ties by earlier start, then display chronologically. This favours close fits; it does not optimise the whole week's schedule.
11. Keep the real appointment duration and 30-minute start grid. No new buffers, prices or artist-matching rules. Weekly schedules still represent one working interval per weekday; split and overnight intervals are outside this change.
12. Use studio-local dates and explicit offset timestamps. Daylight-saving transitions use calendar-day arithmetic; nonexistent local start times and past starts are excluded. An ambiguous fall-back wall time has one offered occurrence.

## Stable selection and enforcement

13. Return one signed **15-minute offer** covering the eligible dates, so switching between offered months does not recalculate or move the choices. This is date eligibility, not a slot reservation.
14. Bind the HMAC-SHA256 offer to booking ID, artist, scheduling mode, appointment duration, eligible dates, expiry and a hash of the selection token. Sign with the existing server-only `SUPABASE_JWT_SECRET`, with a scheduling-specific domain prefix. No new credential or dependency. Missing signing configuration fails closed.
15. The selection endpoint requires a valid offer when quieter filtering is on, so posting a hidden date directly cannot bypass it. Changed mode, duration or selection token invalidates the offer. Already-issued offers remain valid for their short lifetime even if workload rankings change.
16. Recheck the selected slot against current hours, date overrides, artist eligibility/end date, bookings, connected-calendar commitments and station availability at submission. Expired eligibility or a lost slot returns HTTP 409; the website reloads choices and asks the client to choose again.
17. Existing selection writes and conflict checks remain non-atomic. This revision does not promise a reservation during the 15-minute offer or eliminate simultaneous-submission races. Payment, hold release and confirmation behaviour are unchanged.
18. Batch database and calendar reads for the window. Availability checks have a 15-second deadline and fail with a retryable error when dependencies cannot be checked. They do not interpret failed calendar reads as free time.
19. Abort obsolete browser requests, key responses by artist/range and clear stale slots during refresh. Filtered month switching uses the same response; other modes fetch by month. Responses use `Cache-Control: no-store`.
20. Keep workload percentages, busy-event details and station IDs out of the client API. The studio preview uses synthetic data, never a client's real calendar. The deployment header is `X-Vanta-Scheduling-Version: 4`.

## “See how it works” display decisions

Revised 12 September 2026 following feedback that the explanations were hard to follow.

21. Show **Only offer quieter months**, **Only offer quieter days**, and **Keep appointments together**, each with a short explanation. All three can be selected independently.
22. Use one interactive demo with Month → Date → Time navigation. Only clicking a Month, Date or Time tab changes the displayed step. Choosing a sample month or date updates its selection without navigating. Show **Before · studio availability** beside **What your client sees**, stacking these on smaller screens.
23. Represent month workload with filled square grids and “Mostly booked” / “More room” labels. Busy September is absent from client choices when quieter filtering is on. Retain square tables for date and time availability, with × for bookings and stars for suggested times.
24. Explain the immediate result in one sentence. Keep percentages, limits, capacity calculations and illustration assumptions under the collapsed **How dates are chosen** disclosure.
25. Each preference change restarts a 1.1-second highlight on its corresponding Month, Date or Time tab without changing the active tab. Keyboard focus stays on the checkbox. Reduced-motion users receive a temporary static outline. Choice updates remain immediate, and excluded options are removed. The highlight applies to turning settings both on and off.
26. Client time buttons let the user complete a sample selection, clearly marked as a demo. Show all times expands only that date. The demo never submits a real booking or implicitly saves preferences.
27. Retain synthetic monthly totals and sample dates, hourly starts and one-hour appointments. Live booking still uses its existing 30-minute grid and real duration. Month totals include dates outside the sample. Keep visible keyboard focus on the tab or checkbox the user activated, and test readable mobile squares in both themes.

## API

`GET /booking/{token}/slots?date=2026-09-01&artist_id=UUID&days=30&view=periods`

Returns `mode`, `timezone`, `filtered_periods`, `months`, `days`, `offer`, `offer_expires_at`, and an empty legacy `recommended_dates` array. Each day has `date`, `slots`, `slot_details` (`time`, `starts_at`) and `recommended_slots`.

When quieter filtering is enabled, `view=periods` returns the entire filtered 90-day snapshot. Otherwise the requested 1–31-day range is used. Legacy requests without `view=periods` receive only eligible dates intersecting their range. Single-day top-level slot fields are preserved and cannot disclose an excluded date.

`POST /booking/{token}/select` accepts `artist_id`, `chosen_time` and `offer` (required for quieter modes). HTTP 409 triggers fresh availability; offers cannot authorise an otherwise invalid slot.

Main implementation: backend `booking_availability.go`, `smart_scheduling.go`, `quiet_periods.go`, `booking_selection.go`; studio `components/SmartSchedulingSettings.js` and its CSS module; website `app/booking/[token]/BookingSelectionClient.js`.

## Verification and rollout

Go tests cover weighted workload, fully booked dates, empty capacity, inclusive thresholds, caps, stable ties, past hours, calendar leave, mirrored bookings, signed-offer tampering/expiry/bindings, all four modes, valid gap suggestions, station exclusion and daylight saving. Run `GOCACHE=/private/tmp/vanta-go-cache go test ./...` in the backend.

Build each frontend with `npm run build`. Serve their `out/` directories locally (website 3018, studio 3019), then run `VANTA_PLAYWRIGHT_PATH=/path/to/playwright node scripts/smart-scheduling-smoke.cjs` in each repository. Tests intercept account/booking/payment requests with synthetic fixtures. They cover preference save/reload, independent toggles, interactive month/date/time previews, keyboard use, mobile square dimensions, both themes, hidden dates/months, stable month switching, expiry/reselection, empty states and timezone-correct submission. These checks do not establish production database, Google or Stripe integration correctness.

Apply or verify the widened database constraint and release backend first, booking website second and studio controls last. Verify the backend version header with an invalid synthetic token and match each public deployment marker to its source commit. Publish the studio preview only once client filtering support is live. See the workspace deployment record for the actual release state.

## View polish — 13 September 2026

- Setting cards label Months, Days and Times, with visible On/Off states and responsive stacking. A summary describes the resulting client choices.
- The demo labels its synthetic data, separates studio availability from client options, shows filtering/suggestion status, and reports offered-versus-available counts.
- A context footer and selected studio month/date styling connect the three views. Sample selections survive tab navigation; only changing their inputs clears them.
- Tab highlights use a temporary outline pulse, visually distinct from the active-tab indicator. Stable tab elements preserve focus when the pulse ends, and repeated changes restart the animation. Reduced motion retains a static temporary outline.
- Tabs change only when pressed. Settings and sample choices never navigate. All three settings and eight backend combinations are unchanged.
- Technical rules remain collapsed, with mobile square grids and light/dark theme checks retained.

## Simplification after visual feedback

Removed the settings summary, On/Off pills, category labels, tab numbers/dots, filter badges, option counts, repeated panel instructions and context footer. Controls now use simple checkbox rows with one-line descriptions. The demo retains only plain tabs, a studio/client comparison, square availability diagrams and one short explanation. Removed the extra choice-entry animation and panel tint; affected tabs still pulse without navigating. All eight combinations, selected client options, manual navigation, reduced-motion feedback and collapsed rules remain.

## Setting-specific examples — 14 September 2026

The permanent demo, tabs and tab-highlight animation have been replaced by a **See example** action beneath each independent setting. Activating a checkbox never opens an explanation. Each action opens only the relevant months, days or times example, reflecting current preferences without saving or toggling them.

The shared native Dialog handles background isolation, Escape, keyboard focus containment and return to the trigger. Examples have an explicit close button and Done action. The scheduling-specific dialog becomes a bottom sheet on phones; its content scrolls within the visible viewport. This styling does not affect other dialogs.

Square studio-availability diagrams and interactive client choices are retained. The day example explains whether quieter months is also enabled. Relevant technical rules are collapsed under **How it’s calculated**. All examples use synthetic data and never book a real appointment. The section remains at the bottom of Bookings settings with its existing Save action.
