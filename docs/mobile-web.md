# Mobile web

Studio uses the same routes and data flows on desktop and mobile. At viewport widths up to 760px, the sidebar is replaced by a compact header and bottom navigation for Dashboard, Schedule, Bookings, Clients and More. More contains Artists, Analytics, Financial and Settings.

The schedule initially opens in Day view on phones; a user-selected Month view remains available. Wide calendars scroll within their own region, with weekday headings and dates moving together. Booking and client details fill the mobile viewport. Forms, report controls, client cards and studio opening hours adapt to narrow screens. Safe-area padding and dynamic viewport heights accommodate mobile browser chrome.

Shared responsive rules live in `app/mobile.css`, using explicit component classes to override existing inline layout styles at mobile widths. Desktop layout stays in the existing components.

## Verification

Run `npm run build`, then serve the static export:

```sh
python3 -m http.server 3019 --bind 127.0.0.1 --directory out
```

With Playwright available:

```sh
STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/mobile-smoke.cjs
```

`STUDIO_TEST_URL` can override the local server URL. The script mocks remote requests; it does not access customer accounts or write to production. It checks nine dashboard routes at 320, 390, 760 and 1280px, all settings tabs, booking/client detail bounds, the More menu, and appointment form/submit accessibility in short viewports. Screenshots are saved under `/private/tmp/studio-mobile-*.png`.

Verified with Chromium mobile/touch emulation and a production build. Physical iPhone/Android testing, including real software-keyboard behavior, remains a device QA step. No PWA installation, service worker or native app is introduced.
