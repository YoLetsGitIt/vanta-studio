// Run against the local static preview. All remote services are mocked.
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3034';
const screenshots = process.env.STUDIO_SCREENSHOT_DIR || '../artifacts/schedule-week-2026-10-26';
const artists = ['Sam Anderson', 'Jamie Lee', 'Taylor Smith'];
const entry = (id, at, changes = {}) => ({ bookingId: id, artistId: 'artist-0', artistName: artists[0], stationId: 'station-0', stationName: 'Station 1', clientName: id, chosenTime: at, durationMins: 60, source: 'studio', status: 'confirmed', ...changes });
const monday = Array.from({ length: 6 }, (_, i) => entry(`Monday client ${i + 1}`, `2026-10-26T${i < 3 ? '10' : '14'}:00:00+11:00`, { artistId: `artist-${i % 3}`, artistName: artists[i % 3], stationId: `station-${i % 3}`, stationName: `Station ${i % 3 + 1}`, source: ['studio', 'personal', 'walkin', 'app', 'import', 'studio'][i], status: i === 1 ? 'awaiting_payment' : i === 2 ? 'requires_confirmation' : 'confirmed' }));
let entries = [
  ...monday,
  entry('Early Tuesday', '2026-10-27T06:30:00+11:00'),
  entry('Late Tuesday', '2026-10-27T22:00:00+11:00'),
  entry('Overnight Wednesday', '2026-10-28T23:00:00+11:00', { durationMins: 180 }),
  entry('Sunday client', '2026-11-01T13:00:00+11:00'),
  entry('Previous Sunday carry', '2026-10-25T23:00:00+11:00', { durationMins: 180 }),
  entry('Unassigned client', '2026-10-30T12:00:00+11:00', { artistId: null, artistName: null, stationId: null, stationName: null }),
  entry('Former artist client', '2026-10-31T12:00:00+11:00', { artistId: 'former', artistName: 'Former Artist' }),
  entry('Next week client', '2026-11-02T11:00:00+11:00'),
];

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROMIUM_EXECUTABLE ? { executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  mkdirSync(screenshots, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Australia/Melbourne' });
    await setup(context);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-10-26T12:00:00+11:00'));
    page.on('pageerror', error => errors.push(error.message));
    let fail = false;
    const ranges = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin && url.pathname === '/studio/me/schedule') {
        ranges.push(Object.fromEntries(url.searchParams));
        return route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: 'Unavailable' } : { entries } });
      }
      if (url.origin !== new URL(base).origin && /^\/studio\/me\/bookings\/[^/]+$/.test(url.pathname)) {
        const booking = entries.find(item => item.bookingId === decodeURIComponent(url.pathname.split('/').at(-1))) || entries[0];
        return route.fulfill({ json: { id: booking.bookingId, requester_name: booking.clientName, requester_email: 'client@example.test', artist_id: booking.artistId, artist_name: booking.artistName, chosen_time: booking.chosenTime, proposed_duration_minutes: booking.durationMins, status: booking.status, source: booking.source, session_type: 'tattoo' } });
      }
      return route.fallback();
    });
    const week = page.getByRole('region', { name: 'Weekly schedule' });
    const filter = page.getByRole('combobox', { name: 'Filter weekly schedule' });
    const card = id => week.locator(`[data-booking-id="${id}"]`);
    await page.goto(`${base}/dashboard/schedule.html`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await week.waitFor();
    assert.equal(await week.locator('section').count(), 7);
    assert.equal(await week.locator('[data-booking-id]').count(), 14, 'All appointments and the overnight continuation must render');
    assert.equal(await card('Monday client 6').count(), 1, 'Week must not use the month chip limit');
    assert.equal(await card('Early Tuesday').count(), 1);
    assert.equal(await card('Late Tuesday').count(), 1);
    assert.equal(await card('Overnight Wednesday').count(), 2);
    assert.equal(await card('Next week client').count(), 0);
    assert.deepEqual(ranges.at(-1), { start: '2026-10-25', end: '2026-11-02' });
    await page.getByText('13 appointments', { exact: true }).waitFor();
    await filter.selectOption('artist-1');
    assert.equal(await week.locator('[data-booking-id]').count(), 2);
    await filter.selectOption('__unassigned__');
    assert.equal(await card('Unassigned client').count(), 1);
    await filter.selectOption('all');
    await page.getByRole('button', { name: 'Station', exact: true }).click();
    await filter.selectOption('station-2');
    await card('Monday client 3').waitFor();
    assert.equal(await week.locator('[data-booking-id]').count(), 2);
    await filter.selectOption('all');
    await card('Monday client 1').click();
    await page.getByRole('complementary', { name: 'Monday client 1 booking details' }).waitFor();
    await page.getByRole('button', { name: 'Close booking details' }).click();
    await page.getByRole('button', { name: 'Next week', exact: true }).click();
    await card('Next week client').waitFor();
    assert.equal(await week.locator('[data-booking-id]').count(), 1);
    await page.getByRole('button', { name: 'Previous week', exact: true }).click();
    await card('Monday client 6').waitFor();
    await page.getByRole('button', { name: 'Artist', exact: true }).click();
    await filter.waitFor();
    entries.push(entry('Fresh booking', '2026-10-30T16:00:00+11:00'));
    await page.evaluate(() => window.dispatchEvent(new Event('booking-created')));
    await card('Fresh booking').waitFor();
    fail = true;
    await page.evaluate(() => window.dispatchEvent(new Event('booking-created')));
    await page.getByRole('alert').getByText('Failed to fetch schedule').waitFor();
    fail = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await card('Fresh booking').waitFor();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
      await page.screenshot({ path: `${screenshots}/week-${theme}-1440.png` });
    }
    await week.locator('section').first().getByRole('button').first().click();
    assert.equal(await page.getByRole('button', { name: 'Day', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await week.waitFor();
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const bounds = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, width: innerWidth, main: document.querySelector('.studio-dashboard-main')?.scrollWidth, mainWidth: document.querySelector('.studio-dashboard-main')?.clientWidth }));
      assert.ok(bounds.document <= bounds.width + 1, `Document overflow at ${width}: ${JSON.stringify(bounds)}`);
      if (bounds.main) assert.ok(bounds.main <= bounds.mainWidth + 1, `Main overflow at ${width}`);
      await week.evaluate(element => { element.scrollLeft = element.scrollWidth; });
      assert.equal(await page.evaluate(() => scrollX), 0);
      await week.evaluate(element => { element.scrollLeft = 0; });
      if (width === 390) await page.screenshot({ path: `${screenshots}/week-light-390.png` });
    }
    const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, timezoneId: 'Australia/Melbourne' });
    await setup(phone);
    const landscape = await phone.newPage();
    await landscape.clock.setFixedTime(new Date('2026-10-26T12:00:00+11:00'));
    await landscape.goto(`${base}/dashboard/schedule.html`, { waitUntil: 'networkidle' });
    await landscape.getByRole('combobox', { name: 'Calendar view', exact: true }).selectOption('week:station');
    await landscape.getByRole('region', { name: 'Weekly schedule' }).waitFor();
    await landscape.getByRole('button', { name: 'Next week', exact: true }).click();
    await landscape.getByRole('button', { name: 'Previous week', exact: true }).click();
    await landscape.screenshot({ path: `${screenshots}/week-landscape-844.png` });
    assert.deepEqual(errors, []);
    console.log('Week view passed: full schedules, overnight/after-hours bookings, both lenses, filters, details, navigation, refresh/retry, themes and mobile layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
