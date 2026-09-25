// Build and serve out/ locally before running. Remote services are fully mocked.
// STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/mobile-smoke.cjs
const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const client = { id: 'client-1', name: 'Alexandra Montgomery-Williams', email: 'alexandra.montgomery@example.test', phone: '+61412345678', booking_count: 12, last_booking: now.toISOString() };
const artists = Array.from({ length: 3 }, (_, i) => ({ id: `membership-${i}`, artistId: `artist-${i}`, name: ['Sam Anderson', 'Jamie Lee', 'Taylor Smith'][i], email: `artist${i}@example.test`, status: 'approved', acceptingBookings: true }));
const booking = { id: 'booking-1', requester_name: client.name, requester_email: client.email, requester_phone: client.phone, artist_id: 'artist-0', artist_name: artists[0].name, status: 'confirmed', source: 'studio', chosen_time: `${date}T11:00:00`, created_at: now.toISOString(), duration_minutes: 90, estimated_quote: 450, body_location: 'Upper arm', session_type: 'tattoo' };
const entries = artists.map((artist, i) => ({ bookingId: i ? `booking-${i + 1}` : booking.id, artistId: artist.artistId, artistName: artist.name, clientName: client.name, requesterEmail: client.email, source: 'studio', status: 'confirmed', chosenTime: `${date}T${11 + i}:00:00`, endTime: `${date}T${12 + i}:30:00`, durationMins: 90, stationId: `station-${i}`, stationName: `Station ${i + 1}` }));
const stations = artists.map((_, i) => ({ id: `station-${i}`, name: `Station ${i + 1}` }));

async function setup(context) {
  await context.addInitScript(() => {
    const user = { id: '22222222-2222-4222-8222-222222222222', email: 'studio@example.test' };
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: 2000000000, user }));
    localStorage.setItem(`vanta-studio-tour:${user.id}`, 'complete');
    localStorage.setItem(`vanta-studio-artist-guide:${user.id}`, 'complete');
    sessionStorage.setItem('financial_unlocked', '1');
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (route.request().resourceType() === 'script') return route.fulfill({ contentType: 'application/javascript', body: '' });
    const path = url.pathname;
    let json = { hours: [], stations: [], templates: [], fields: {}, connected: false, notes: [], submissions: [], consents: {}, payouts: [], reimbursements: [] };
    if (path === '/studio/me') json = { status: 'approved', studio_id: 'test-studio', studio: { name: 'Northside Tattoo Studio', timezone: 'Australia/Melbourne', subscription_status: 'active', payment_recording_requirement: 'studio_only' } };
    else if (path === '/studio/me/artists') json = { artists: url.searchParams.get('status') === 'approved' ? artists : [] };
    else if (path === '/studio/me/dashboard-attention') json = { bookings: [{ ...booking, id: 'pending-1', status: 'pending' }, { ...booking, id: 'confirmation-1', status: 'requires_confirmation' }], pending_artists: [], pending_reimbursements: [] };
    else if (path === '/studio/me/schedule') json = { entries };
    else if (path === '/studio/me/clients') json = { clients: [client] };
    else if (path === '/studio/me/clients/client-1') json = { client, bookings: [booking] };
    else if (path === '/studio/me/bookings') json = { bookings: [booking] };
    else if (path === '/studio/me/bookings/booking-1') json = booking;
    else if (path.endsWith('/sms')) json = { opt_in: false, opted_out: false, delivery: { status: 'not_opted_in' } };
    else if (path === '/studio/me/stations' || path === '/studio/me/stations/available') json = { stations };
    else if (path === '/studio/me/hours') json = { hours: Array.from({ length: 7 }, (_, day) => ({ day_of_week: day, open_time: '09:00', close_time: '18:00', is_closed: false })) };
    else if (path === '/studio/me/revenue') json = { summary: { gross_sales: 12345, completed_sessions: 12 }, weekly: [{ week_start: date, gross_sales: 12345, session_count: 12 }], by_artist: [{ artist_id: 'artist-0', artist_name: artists[0].name, session_count: 12, gross_sales: 12345 }] };
    await route.fulfill({ json });
  });
}

async function closeAppointment(page) {
  await page.getByRole('button', { name: 'Close new appointment' }).click();
  await page.waitForFunction(() => document.querySelector('.studio-appointment-panel')?.getAttribute('aria-hidden') === 'true' || document.querySelector('dialog[open][role="alertdialog"]'));
  const discard = page.getByRole('button', { name: 'Discard appointment', exact: true });
  if (await discard.isVisible()) await discard.click();
  await page.getByRole('dialog', { name: 'New Appointment', exact: true }).waitFor({ state: 'hidden' });
}

const layoutErrors = [];
async function contained(page, label) {
  const problems = await page.evaluate(() => {
    const main = document.querySelector('.studio-dashboard-main');
    const issues = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('document overflow');
    if (main && main.scrollWidth > main.clientWidth + 1) issues.push(`main overflow ${main.scrollWidth}/${main.clientWidth}`);
    for (const el of document.querySelectorAll('.studio-feature-header, .studio-feature-body, .studio-booking-row, .studio-client-row, .studio-mobile-nav')) {
      const box = el.getBoundingClientRect();
      if (box.width && (box.left < -1 || box.right > innerWidth + 1)) issues.push(`${el.className}: ${box.left}–${box.right}`);
    }
    return issues;
  });
  if (problems.length) { layoutErrors.push({ label, problems }); console.error(label, problems); }
}

(async () => {
  const engine = process.env.STUDIO_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await setup(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    page.setDefaultTimeout(10000);
    for (const { width, height } of [
      { width: 320, height: 844 }, { width: 390, height: 844 },
      { width: 568, height: 320 }, { width: 667, height: 375 },
      { width: 740, height: 360 }, { width: 844, height: 390 }, { width: 932, height: 430 },
      { width: 760, height: 844 }, { width: 1280, height: 844 },
    ]) {
      const mobile = width <= 760 || (width <= 1100 && height <= 550 && width > height);
      await page.setViewportSize({ width, height });
      for (const route of ['home', 'schedule', 'appointments', 'clients', 'artists', 'analytics', 'financial', 'settings', 'import']) {
        await page.goto(`${base}/dashboard/${route}.html`, { waitUntil: 'networkidle' });
        await page.locator('.studio-dashboard-main').waitFor();
        await contained(page, `${route} at ${width}`);
        assert.equal(await page.locator('.studio-mobile-nav').isVisible(), mobile && !(['home', 'schedule'].includes(route) && width > height));
        assert.equal(await page.locator('.studio-dashboard-sidebar').isVisible(), !mobile);
        if (route === 'home' && mobile && width > height) {
          await page.getByRole('button', { name: /Pending bookings/ }).waitFor();
          await page.getByRole('button', { name: /Pending bookings/ }).click();
          assert.equal(await page.getByRole('button', { name: /Pending bookings/ }).getAttribute('aria-expanded'), 'true');
          await contained(page, `expanded attention at ${width}`);
          await page.getByRole('button', { name: /Pending bookings/ }).click();
          const header = await page.locator('.studio-home-header').boundingBox();
          assert.ok(header.height <= 56, `Dashboard header too tall: ${header.height}`);
          const moneyColumns = await page.locator('.studio-home-four-col').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
          assert.equal(moneyColumns, width >= 600 ? 4 : 2, `Money cards at ${width}px`);
          await page.getByRole('button', { name: 'Open studio navigation' }).click();
          await page.getByRole('dialog', { name: 'More', exact: true }).waitFor();
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: 'New Appointment', exact: true }).click();
          await closeAppointment(page);
          await page.screenshot({ path: `/private/tmp/studio-landscape-home-${width}.png` });
        }
        if (route === 'settings') {
          for (const tab of ['studio', 'bookings', 'payments', 'account']) {
            await page.locator(`[data-tour-settings-tab="${tab}"]`).click();
            await contained(page, `settings ${tab} at ${width}`);
          }
        }
        if (route === 'schedule') {
          const focusedCalendar = mobile && width > height;
          const toolbar = page.getByRole('toolbar', { name: 'Calendar controls' });
          if (focusedCalendar) {
            assert.equal(await toolbar.getByLabel('Calendar view').inputValue(), 'day:artist');
            await toolbar.getByRole('button', { name: 'Open studio navigation' }).click();
            const navigation = page.getByRole('dialog', { name: 'More', exact: true });
            for (const name of ['Dashboard', 'Schedule', 'Bookings', 'Clients', 'Settings']) await navigation.getByRole('link', { name, exact: true }).waitFor();
            await page.keyboard.press('Escape');
            await toolbar.getByRole('button', { name: 'New Appointment', exact: true }).click();
            await page.getByRole('dialog', { name: 'New Appointment', exact: true }).waitFor();
            await closeAppointment(page);
            const currentDate = await page.locator('.studio-calendar-toolbar-date').innerText();
            await toolbar.getByRole('button', { name: 'Previous day', exact: true }).click();
            assert.notEqual(await page.locator('.studio-calendar-toolbar-date').innerText(), currentDate);
            await toolbar.getByRole('button', { name: 'Today', exact: true }).click();
            assert.equal(await page.locator('.studio-calendar-toolbar-date').innerText(), currentDate);
            await toolbar.getByLabel('Calendar view').selectOption('day:artist:all');
            await toolbar.getByLabel('Calendar view').selectOption('day:station');
            await page.locator('.studio-calendar-column-heading').filter({ hasText: 'Station 1' }).waitFor();
            await toolbar.getByLabel('Calendar view').selectOption('day:artist');
          } else assert.equal(await page.getByRole('button', { name: 'Day', exact: true }).getAttribute('aria-pressed'), mobile ? 'true' : 'false');
          if (mobile) {
            const calendar = page.locator('.studio-calendar-scroll');
            await calendar.waitFor();
            const bounds = await calendar.boundingBox();
            assert.ok(bounds.height >= 64, `Day calendar has usable height at ${width}x${height}: ${bounds.height}`);
            const main = await page.locator('.studio-dashboard-main').boundingBox();
            assert.ok(bounds.y >= main.y - 1 && bounds.y + bounds.height <= main.y + main.height + 1, 'Calendar stays inside content viewport');
            if (focusedCalendar) {
              const heading = await page.locator('.studio-calendar-column-heading').first().boundingBox();
              assert.ok(bounds.height - heading.height >= height * 0.75, `Time grid occupies at least 75% of landscape height: ${bounds.height - heading.height}/${height}`);
            } else {
              const nav = await page.locator('.studio-mobile-nav').boundingBox();
              assert.ok(bounds.y + bounds.height <= nav.y + 1, 'Calendar stays above bottom navigation');
            }
          }
          if (height < width && mobile) await page.screenshot({ path: `/private/tmp/studio-landscape-schedule-${width}.png` });
          if (focusedCalendar) await toolbar.getByLabel('Calendar view').selectOption('month:artist');
          else await page.getByRole('button', { name: 'Month', exact: true }).click();
          await contained(page, `month at ${width}`);
        }
        if (height < width && mobile && ['appointments', 'clients', 'home'].includes(route)) {
          await page.screenshot({ path: `/private/tmp/studio-landscape-${route}-${width}.png` });
        }
        if (route === 'appointments') {
          await page.locator('.studio-booking-row').first().click();
          await page.locator('.studio-booking-detail').waitFor();
          await page.locator('.studio-booking-detail').getByRole('status').filter({ hasText: /^Loading/ }).waitFor({ state: 'hidden' });
          await page.locator('.studio-booking-detail').waitFor();
          const bounds = await page.locator('.studio-booking-detail').boundingBox();
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          if (mobile) assert.equal(bounds.width, width);
          await page.getByRole('button', { name: 'Close booking details' }).click();
        }
        if (route === 'clients') {
          await page.locator('.studio-client-row').click();
          await page.locator('#client-detail').waitFor();
          const bounds = await page.locator('#client-detail').boundingBox();
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          await page.getByRole('button', { name: 'Close client details' }).click();
        }
        if (width <= 390) await page.screenshot({ path: `/private/tmp/studio-mobile-${route}.png` });
      }
      console.log(`Layout and detail checks passed at ${width}x${height}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'More', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'More', exact: true });
    await menu.waitFor();
    await menu.getByRole('link', { name: 'Artists', exact: true }).click();
    await page.locator('.studio-artists-page h1').waitFor();
    assert.equal(await menu.count(), 0);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.setViewportSize({ width: 844, height: 390 });
    assert.equal(await menu.isVisible(), true, 'Rotation keeps the mobile menu open');
    const menuBounds = await menu.boundingBox();
    assert.ok(menuBounds.y >= 0 && menuBounds.y + menuBounds.height <= 391);
    await page.keyboard.press('Escape');
    assert.equal(await menu.count(), 0);
    await page.locator('.studio-mobile-header').getByRole('button', { name: 'New Appointment', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'New Appointment', exact: true });
    await form.waitFor();
    await page.waitForTimeout(250);
    assert.equal(await form.evaluate(el => el.scrollWidth > el.clientWidth), false);
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 430 }, { width: 760, height: 390 }, { width: 844, height: 390 }, { width: 932, height: 430 }]) {
      await page.setViewportSize(size);
      const bounds = await form.boundingBox();
      assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= size.width + 1 && bounds.y + bounds.height <= size.height + 1);
      assert.equal(await form.evaluate(el => el.scrollWidth > el.clientWidth), false);
      const inputs = form.locator('input:visible');
      if (await inputs.count()) await inputs.first().focus();
      const submit = form.getByRole('button', { name: 'Create Appointment', exact: true });
      await submit.scrollIntoViewIfNeeded();
      const submitBounds = await submit.boundingBox();
      assert.ok(submitBounds.y >= 0 && submitBounds.y + submitBounds.height <= size.height + 1, 'Submit stays reachable in short viewports');
    }
    await closeAppointment(page);
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert.deepEqual(layoutErrors, [], 'Layout containment errors');
    console.log('Mobile navigation, detail panels and appointment form checks passed.');
    await browser.close();
  } catch (error) { await browser.close(); throw error; }
})().catch(error => { console.error(error); process.exit(1); });
