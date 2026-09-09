// Run after a build, with out/ served locally. All remote API requests are mocked.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3019';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      const user = { id: '22222222-2222-4222-8222-222222222222', email: 'studio@example.test' };
      localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: 2000000000, user }));
      localStorage.setItem(`vanta-studio-tour:${user.id}`, 'complete');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let mode = 'all';
    const updates = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (url.pathname === '/studio/me') return route.fulfill({ json: { status: 'approved', studio_id: 'test-studio', studio: { name: 'Test studio', timezone: 'Australia/Melbourne', scheduling_mode: mode, subscription_status: 'active' } } });
      if (url.pathname === '/studio/me/profile') {
        const body = route.request().postDataJSON();
        updates.push(body);
        mode = body.scheduling_mode;
        return route.fulfill({ json: { status: 'ok' } });
      }
      return route.fulfill({ json: { hours: [], stations: [], templates: [], fields: {}, connected: false } });
    });
    await page.goto(`${base}/dashboard/settings.html?tab=bookings`, { waitUntil: 'networkidle' });
    const quieter = page.getByRole('checkbox', { name: 'Fill quieter days', exact: true });
    const gaps = page.getByRole('checkbox', { name: 'Minimise gaps', exact: true });
    await quieter.waitFor();
    assert.equal(await quieter.isChecked(), false);
    assert.equal(await gaps.isChecked(), false);
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Smart scheduling', exact: true }) });
    const week = page.getByRole('table', { name: 'Example week availability', exact: true });
    const day = page.getByRole('table', { name: 'Example Tuesday availability', exact: true });
    for (const next of ['quieter_days', 'combined', 'minimize_gaps', 'all']) {
      const wantsQuieter = next === 'quieter_days' || next === 'combined';
      const wantsGaps = next === 'minimize_gaps' || next === 'combined';
      await quieter.setChecked(wantsQuieter);
      await gaps.setChecked(wantsGaps);
      assert.equal(await day.getByRole('img', { name: /First shown .*: suggested/ }).count(), wantsGaps ? 3 : 0);
      assert.equal(await week.locator('[aria-label="suggested day"]').count(), wantsQuieter ? 3 : 0);
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/studio/me/profile')),
        section.getByRole('button', { name: /Save/ }).click(),
      ]);
      assert.equal(updates.at(-1).scheduling_mode, next);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await quieter.isChecked(), wantsQuieter);
      assert.equal(await gaps.isChecked(), wantsGaps);
    }
    // Both independent controls work with the keyboard, without saving implicitly.
    await quieter.focus();
    await page.keyboard.press('Space');
    await gaps.focus();
    await page.keyboard.press('Space');
    assert.equal(await quieter.isChecked(), true);
    assert.equal(await gaps.isChecked(), true);
    assert.equal(updates.length, 4);
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
      for (const width of [1280, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        assert.ok((await section.boundingBox()).width >= 280, 'Settings card must retain a usable mobile width');
        for (const table of [week, day]) {
          assert.equal(await table.evaluate(element => element.scrollWidth > element.clientWidth), false);
          const square = await table.getByRole('img').first().boundingBox();
          assert.ok(square.width >= 20 && Math.abs(square.width - square.height) < 1, 'Availability cells must remain readable squares');
        }
        await section.screenshot({ path: `/private/tmp/vanta-smart-scheduling-${theme}-${width}.png` });
      }
    }
    assert.deepEqual(errors, []);
    console.log('Studio settings: four combinations, save/reload, interactive diagrams, keyboard, mobile and themes passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
