# Studio setup checklist

Home includes a six-step checklist for studio details/timezone, hours/stations,
artists, bookings/consent, payments and importing. Each step opens its existing
setup screen. Import data remains visible when the checklist is collapsed.
The Account tab in Settings includes Setup checklist and Import data shortcuts.
They are hidden on the Studio, Bookings and Payments tabs.

The owner explicitly marks a step reviewed after checking its settings. Existing
defaults, opening a screen or importing a single file do not mark a step complete.
Payments and importing can be marked Not needed, and skips/reviews can be undone.
The progress count includes both reviewed and skipped steps.

Progress and collapse preferences are stored per studio on the server, shared
across browsers/devices. No local-storage checklist state is used. A failed save
keeps the previous confirmed state and displays an error; failed loads offer a
retry and keep the Import data shortcut available.

## Backend and rollout

- `GET /studio/me/onboarding` returns `{ steps: {}, collapsed: false }` initially.
- `PATCH /studio/me/onboarding` accepts one `{ step, status }` update or one
  `{ collapsed }` preference update. Statuses are `pending`, `complete` and
  `skipped` (payments/import only).
- Both endpoints require the authenticated, approved studio account. The server
  derives the studio ID; the client cannot choose another studio.
- Updates merge one JSON key atomically to preserve independent concurrent reviews.
- Deploy the backend before the frontend. Startup `EnsureSchema` adds the two
  columns idempotently; SQL is also provided in
  `vanta-backend/migrations/20261028_studio_onboarding.sql`.

The checklist is guidance. Marking a review does not change booking settings,
approve artists, import records, connect Stripe or start a subscription.

## Validation

`scripts/studio-setup-checklist-smoke.cjs` exercises the production export at
390px and 1440px using intercepted services: all action destinations, progress,
skip/undo, refresh/fresh-context restoration, collapse persistence, read/save
failures, Account-only shortcuts, direct Account tab navigation and Import navigation.

Backend `TestStudioOnboardingPersistenceAndIsolation` and
`TestStudioOnboardingAccessAndValidation` use disposable loopback PostgreSQL.
They check persistence, concurrent updates, studio isolation, authorization and
invalid changes. Set `BOOKING_TEST_DATABASE_URL` to run them.
