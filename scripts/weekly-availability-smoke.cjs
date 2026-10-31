// Build the studio (out/) and serve it locally before running:
//   python3 -m http.server 3029 --directory out
// Every remote request is intercepted; no real accounts or bookings are used.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const studioBase = process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const shots = process.env.VANTA_SCREENSHOT_DIR;
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'client@example.test', role: 'authenticated', aud: 'authenticated', user_metadata: { full_name: 'Local Client' } };
const auth = { access_token: 'local-test-token', refresh_token: 'local-refresh-token', expires_at: 2000000000, expires_in: 3600, token_type: 'bearer', user };
const studio = { id: 'test-studio', name: 'Local Studio', timezone: 'Australia/Melbourne', subscription_status: 'active', artists: [] };
const savedWindows = [
  { day_of_week: 2, start_time: '10:00', end_time: '17:00' },
  { day_of_week: 6, start_time: '09:00', end_time: '12:30' },
];

async function mockContext(browser, width, availability) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.addInitScript(session => {
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify(session));
    localStorage.setItem(`vanta-studio-tour:${session.user.id}`, 'complete');
  }, auth);
  const writes = [];
  let fields = { body_location: { enabled: false, required: false }, design_details: { enabled: false, required: false }, ...(availability ? { availability_windows: availability } : {}) };
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (url.origin === new URL(studioBase).origin) return route.continue();
    if (path.endsWith('/form-config') && req.method() === 'PUT') {
      fields = { ...fields, ...req.postDataJSON().fields };
      writes.push({ path, body: req.postDataJSON() });
      return route.fulfill({ json: { fields } });
    }
    if (req.method() === 'POST' || req.method() === 'PATCH' || req.method() === 'PUT') {
      writes.push({ path, body: req.postDataJSON() });
      return route.fulfill({ json: { id: 'local-booking', status: 'pending' } });
    }
    if (path.endsWith('/public')) return route.fulfill({ json: studio });
    if (path.endsWith('/form-config')) return route.fulfill({ json: { fields } });
    if (path.endsWith('/consent-templates')) return route.fulfill({ json: { templates: [] } });
    if (path === '/users/me') return route.fulfill({ json: { name: 'Local Client', phone: '0400123456', dob: '1990-01-01' } });
    if (path === '/auth/v1/user') return route.fulfill({ json: user });
    if (path === '/studio/me') return route.fulfill({ json: { status: 'approved', studio_id: studio.id, studio } });
    return route.fulfill({ json: {} });
  });
  return { context, writes };
}

async function openForm(page) {
  await page.goto(`${studioBase}/studio-booking.html?s=test-studio`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: studio.name, exact: true }).waitFor({ timeout: 15000 }).catch(async e => { console.log((await page.locator('body').innerText()).slice(0, 400)); throw e; });
  await page.waitForTimeout(500);
  if (!(await page.locator('input[type="date"]').inputValue())) await page.locator('input[type="date"]').fill('1990-01-01');
  const tel = page.locator('input[type="tel"]');
  if (!(await tel.inputValue())) await tel.fill('0400123456');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // Off (and missing from an older backend's config): no availability section.
    {
      const { context, writes } = await mockContext(browser, 390, null);
      const page = await context.newPage();
      await openForm(page);
      assert.equal(await page.getByText('Your availability', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Request booking', exact: true }).click();
      await page.getByRole('heading', { name: "You're on the list!", exact: true }).waitFor();
      assert.deepEqual(writes.find(w => w.path.endsWith('/client-booking')).body.availability_windows, []);
      console.log('PASS availability hidden when the studio has not turned it on');
      await context.close();
    }

    for (const width of [390, 1280]) {
      const { context, writes } = await mockContext(browser, width, { enabled: true, required: true });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await openForm(page);
      await page.getByText('Your availability', { exact: true }).waitFor();

      // Required: blocks submit with a clear message.
      await page.getByRole('button', { name: 'Request booking', exact: true }).click();
      await page.getByText('Please add at least one time you’re available.').waitFor();
      assert.equal(writes.filter(w => w.path.endsWith('/client-booking')).length, 0);

      // Drag down Tuesday 10:00 → 17:00 and Saturday 9:00 → 12:30 (grid starts 8am, 15px per half hour).
      async function drag(day, fromSlot, toSlot) {
        const box = await page.locator(`[data-day="${day}"]`).boundingBox();
        const x = box.x + box.width / 2;
        await page.mouse.move(x, box.y + fromSlot * 15 + 7);
        await page.mouse.down();
        await page.mouse.move(x, box.y + ((fromSlot + toSlot) / 2) * 15 + 7, { steps: 4 });
        await page.mouse.move(x, box.y + toSlot * 15 + 7, { steps: 4 });
        await page.mouse.up();
      }
      await drag('Tuesday', 4, 17);
      await drag('Saturday', 2, 8);
      await page.getByText('10am – 5pm').waitFor();
      await page.getByText('9am – 12:30pm').waitFor();
      // Tapping a block removes it; dragging it back restores it.
      const sat = await page.locator('[data-day="Saturday"]').boundingBox();
      await page.mouse.click(sat.x + sat.width / 2, sat.y + 5 * 15 + 7);
      assert.equal(await page.getByText('9am – 12:30pm').count(), 0);
      await drag('Saturday', 2, 8);
      // A touching range on the same day merges into one.
      await drag('Tuesday', 18, 19);
      await page.getByText('10am – 6pm').waitFor();
      await page.getByRole('button', { name: 'Remove Tuesday 10am – 6pm', exact: true }).click();
      await drag('Tuesday', 4, 17);

      // Nothing overflows the card on a phone.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `page overflows by ${overflow}px at ${width}px`);
      if (shots) await page.getByText('Your availability', { exact: true }).locator('..').screenshot({ path: `${shots}/availability-${width}.png` });

      await page.getByRole('button', { name: 'Request booking', exact: true }).click();
      await page.getByRole('heading', { name: "You're on the list!", exact: true }).waitFor();
      const sent = writes.find(w => w.path.endsWith('/client-booking')).body.availability_windows;
      assert.deepEqual(sent, savedWindows);
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS required weekly availability submits at ${width}px`);
      await context.close();
    }

    // Settings: the toggle and required checkbox save like the other fields.
    {
      const { context, writes } = await mockContext(browser, 1280, { enabled: false, required: false });
      const page = await context.newPage();
      await page.goto(`${studioBase}/dashboard/settings.html?tab=bookings`, { waitUntil: 'networkidle' });
      const toggle = page.getByRole('switch', { name: 'Weekly availability field', exact: true });
      await toggle.waitFor();
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      await toggle.click();
      await page.getByRole('checkbox', { name: 'Weekly availability required', exact: true }).check();
      await page.waitForTimeout(300);
      const last = writes.filter(w => w.path === '/studio/me/form-config').pop().body.fields.availability_windows;
      assert.deepEqual(last, { enabled: true, required: true });
      await page.getByText('Your availability *', { exact: true }).waitFor();
      console.log('PASS settings toggle + required save and show in the preview');
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
