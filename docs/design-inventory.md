# Studio design-system source inventory

Run `node scripts/audit-design-system.mjs` to refresh. Counts flag review candidates, not defects: chart colours, image geometry and deliberate dense data layouts can be appropriate. This scans all app and component JS/CSS, including the development-only gallery.

| File | Inline styles | Colour literals | Shared UI/token references | Explicit labels/states |
| --- | ---: | ---: | ---: | ---: |
| `app/dashboard/analytics/page.js` | 0 | 0 | 0 | 0 |
| `app/dashboard/appointments/page.js` | 78 | 11 | 62 | 4 |
| `app/dashboard/artists/page.js` | 161 | 34 | 147 | 9 |
| `app/dashboard/clients/page.js` | 104 | 20 | 89 | 9 |
| `app/dashboard/financial/page.js` | 155 | 37 | 129 | 15 |
| `app/dashboard/home/page.js` | 123 | 22 | 123 | 3 |
| `app/dashboard/import/page.js` | 90 | 8 | 38 | 9 |
| `app/dashboard/layout.js` | 42 | 5 | 38 | 3 |
| `app/dashboard/page.js` | 0 | 0 | 0 | 0 |
| `app/dashboard/revenue/page.js` | 42 | 13 | 38 | 5 |
| `app/dashboard/schedule/page.js` | 192 | 37 | 105 | 9 |
| `app/dashboard/settings/page.js` | 406 | 128 | 227 | 29 |
| `app/design-system/page.js` | 0 | 0 | 0 | 0 |
| `app/design-system/preview.js` | 9 | 0 | 6 | 4 |
| `app/globals.css` | 0 | 93 | 105 | 0 |
| `app/layout.js` | 0 | 0 | 0 | 0 |
| `app/page.js` | 16 | 5 | 25 | 0 |
| `app/studio-booking/layout.js` | 1 | 0 | 0 | 0 |
| `app/studio-booking/page.js` | 104 | 55 | 39 | 15 |
| `components/BookingDetailPanel.js` | 133 | 32 | 119 | 5 |
| `components/CompleteBookingModal.js` | 16 | 0 | 27 | 5 |
| `components/DashboardQuickActions.js` | 36 | 0 | 34 | 2 |
| `components/FeedbackHost.js` | 5 | 1 | 11 | 1 |
| `components/NewAppointmentPanel.js` | 130 | 10 | 81 | 29 |
| `components/RejectBookingModal.js` | 0 | 0 | 3 | 0 |
| `components/SendSelectionLinkModal.js` | 4 | 0 | 9 | 0 |
| `components/SignUpFlow.js` | 118 | 87 | 30 | 3 |
| `components/ui/Button.js` | 0 | 0 | 0 | 0 |
| `components/ui/Dialog.js` | 2 | 0 | 0 | 2 |
| `components/ui/Dialog.module.css` | 0 | 2 | 22 | 0 |
| `components/ui/Field.js` | 0 | 0 | 0 | 3 |
| `components/ui/StatePanel.js` | 0 | 0 | 0 | 0 |
