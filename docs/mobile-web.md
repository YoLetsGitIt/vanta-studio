# Mobile web

Studio uses the same routes and data flows on desktop and mobile. At viewport widths up to 760px, or on landscape touch devices up to 1100px wide and 550px high, the sidebar is replaced by a compact header and bottom navigation for Dashboard, Schedule, Bookings, Clients and More. More contains Artists, Analytics, Financial and Settings.

The schedule initially opens in Day view on phones; a user-selected Month view remains available. Wide calendars scroll within their own region, with weekday headings and dates moving together. Booking and client details fill the mobile viewport. Forms, report controls, client cards and studio opening hours adapt to narrow screens. Safe-area padding and dynamic viewport heights accommodate mobile browser chrome.

Shared responsive rules live in `app/mobile.css`, using explicit component classes to override existing inline layout styles at mobile widths. Desktop layout stays in the existing components. `lib/responsive.js` mirrors the CSS breakpoint for navigation and the initial schedule view. Landscape phones use shorter navigation bars and a single-row schedule toolbar; safe-area padding protects content near a notch.

## Verification

Run `npm run build`, then serve the static export:

```sh
python3 -m http.server 3019 --bind 127.0.0.1 --directory out
```

With Playwright available:

```sh
STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/mobile-smoke.cjs
```

`STUDIO_TEST_URL` can override the local server URL. The script mocks remote requests; it does not access customer accounts or write to production. It checks nine dashboard routes at portrait/desktop widths of 320, 390, 760 and 1280px and landscape sizes of 568×320, 667×375, 844×390 and 932×430. Coverage includes all settings tabs, usable calendar height, booking/client detail bounds, rotating with the More menu open, and appointment form/submit accessibility in short viewports. Screenshots are saved under `/private/tmp/studio-mobile-*.png`.

Verified with Chromium mobile/touch emulation and a production build. Physical iPhone/Android testing, including real software-keyboard behavior, remains a device QA step. No PWA installation, service worker or native app is introduced.

Landscape refinement: from 740px wide, mobile navigation shares the top row with the brand and New Appointment action, reclaiming the former bottom bar height. Smaller landscape phones retain bottom navigation. Search fields sit beside page titles, filters share a row with sorting, wider booking/client cards keep status beside details, and dashboard summary cards use two columns. Tap targets remain at least 44px. The smoke suite also checks the 740×360 transition and calendar space beneath the combined toolbar.

The landscape Schedule page uses a dedicated 48px toolbar instead of the global navigation and segmented view bars. It provides studio navigation, a calendar view selector (including all artists), previous/next, Today and New Appointment. Artist/station headings are 28px; the redundant working-artist summary is hidden only in landscape. Tests require the time grid (excluding column headings) to occupy at least 75% of the viewport height and exercise every toolbar action. The Dashboard also replaces global navigation with a compact header: studio menu, date, client lookup, reimbursement and New Appointment. On narrower landscape phones, quick actions use accessible icon buttons. Attention groups use two columns and expand to full width when opened. Other pages retain the landscape navigation described above. Dashboard tests use populated attention data and verify expansion, navigation, appointment creation and a maximum 56px header.

Second pass: on landscape phones the Dashboard money cards sit in one row of four (two columns below 600px wide), the two "In the studio today" panels share a row, and section spacing is tighter. The landscape day/station schedule uses 48px hours instead of 64px so about six working hours fit on a 375px-tall screen. In portrait, the Dashboard quick actions share a row, money cards form a 2×2 grid, and the Schedule drops its redundant page title and trims header padding so the calendar gets roughly 60px more height. The smoke suite asserts the money-card column count.
