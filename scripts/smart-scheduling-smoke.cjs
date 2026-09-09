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
    const select = page.getByLabel('Scheduling preference', { exact: true });
    await select.waitFor();
    assert.equal(await select.inputValue(), 'all');
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Smart scheduling', exact: true }) });
    for (const next of ['quieter_days', 'minimize_gaps', 'all']) {
      await select.selectOption(next);
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/studio/me/profile')),
        section.getByRole('button', { name: /Save/ }).click(),
      ]);
      assert.equal(updates.at(-1).scheduling_mode, next);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await select.inputValue(), next);
    }
    await page.screenshot({ path: '/private/tmp/vanta-smart-scheduling-settings.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Studio settings: default, all three mode saves and reloads passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
