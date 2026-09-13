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
    const quieter = page.getByRole('checkbox', { name: 'Only offer quieter days', exact: true });
    const quieterMonths = page.getByRole('checkbox', { name: 'Only offer quieter months', exact: true });
    const gaps = page.getByRole('checkbox', { name: 'Keep appointments together', exact: true });
    await quieter.waitFor();
    assert.equal(await quieter.isChecked(), false);
    assert.equal(await gaps.isChecked(), false);
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Smart scheduling', exact: true }) });
    const week = page.getByRole('table', { name: 'Example studio date availability', exact: true });
    const day = page.getByRole('table', { name: 'Example studio time availability', exact: true });
    for (const next of ['quieter_months', 'quieter_days_only', 'quieter_days', 'quieter_months_gaps', 'quieter_days_gaps', 'combined', 'minimize_gaps', 'all']) {
      const wantsMonths = ['quieter_months', 'quieter_months_gaps', 'quieter_days', 'combined'].includes(next);
      const wantsQuieter = ['quieter_days_only', 'quieter_days_gaps', 'quieter_days', 'combined'].includes(next);
      const wantsGaps = ['minimize_gaps', 'quieter_months_gaps', 'quieter_days_gaps', 'combined'].includes(next);
      await quieterMonths.setChecked(wantsMonths);
      await quieter.setChecked(wantsQuieter);
      await gaps.setChecked(wantsGaps);
      await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '1 Month' }).click();
      assert.equal(await page.getByRole('group', { name: 'Example client month options' }).getByRole('button').count(), wantsMonths ? 2 : 3);
      await page.getByRole('group', { name: 'Example client month options' }).getByRole('button', { name: /October/ }).click();
      assert.equal(await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '1 Month' }).getAttribute('aria-current'), 'step');
      await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '2 Date' }).click();
      assert.equal(await page.getByRole('group', { name: 'Example client date options' }).getByRole('button').count(), wantsQuieter ? 2 : 5);
      await page.getByRole('group', { name: 'Example client date options' }).getByRole('button').first().click();
      assert.equal(await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '2 Date' }).getAttribute('aria-current'), 'step');
      await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '3 Time' }).click();
      assert.equal(await day.getByRole('img', { name: /: suggested/ }).count(), wantsGaps ? 3 : 0);
      assert.equal(await page.getByRole('group', { name: 'Example client time options' }).getByRole('button').count(), wantsGaps ? 3 : 5);
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/studio/me/profile')),
        section.getByRole('button', { name: /Save/ }).click(),
      ]);
      assert.equal(updates.at(-1).scheduling_mode, next);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await quieterMonths.isChecked(), wantsMonths);
      assert.equal(await quieter.isChecked(), wantsQuieter);
      assert.equal(await gaps.isChecked(), wantsGaps);
    }
    // Each toggle highlights its affected tab without changing the selected tab.
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion });
      for (const [index, control] of [quieterMonths, quieter, gaps].entries()) {
        const navigation = page.getByRole('navigation', { name: 'Example booking steps' });
        const unchangedTab = navigation.getByRole('button').nth((index + 1) % 3);
        await unchangedTab.click();
        await control.focus();
        await page.keyboard.press('Space');
        const tab = page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button').nth(index);
        assert.equal(await tab.getAttribute('aria-current'), null);
        assert.equal(await unchangedTab.getAttribute('aria-current'), 'step');
        assert.match(await tab.getAttribute('class'), /tabHighlight/);
        const animation = await tab.evaluate(el => getComputedStyle(el).animationName);
        if (reducedMotion === 'reduce') {
          assert.equal(animation, 'none');
          assert.equal(await tab.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
        } else assert.notEqual(animation, 'none');
        assert.equal(await control.evaluate(el => document.activeElement === el), true);
      }
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await quieterMonths.check(); await quieter.check(); await gaps.check();
    assert.equal(updates.length, 8);
    await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '1 Month' }).click();
    const months = page.getByRole('group', { name: 'Example client month options' });
    await months.getByRole('button', { name: /November/ }).click();
    assert.equal(await months.getByRole('button', { name: /September/ }).count(), 0);
    await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '2 Date' }).click();
    await page.getByRole('group', { name: 'Example client date options' }).getByRole('button', { name: 'Thu, 5 Nov' }).click();
    await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: '3 Time' }).click();
    await page.getByRole('button', { name: 'Show all times', exact: true }).click();
    assert.equal(await page.getByRole('group', { name: 'Example client time options' }).getByRole('button').count(), 5);
    await page.getByRole('group', { name: 'Example client time options' }).getByRole('button', { name: '9am', exact: true }).click();
    await page.getByText(/Selected:.*9am/).waitFor();
    const tabs = page.getByRole('navigation', { name: 'Example booking steps' });
    await tabs.getByRole('button', { name: '1 Month' }).click();
    await tabs.getByRole('button', { name: '3 Time' }).click();
    assert.equal(await page.getByRole('group', { name: 'Example client time options' }).getByRole('button', { name: '9am', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('details').filter({ hasText: 'How dates are chosen' }).getAttribute('open'), null);
    await page.getByText('How dates are chosen', { exact: true }).click();
    await page.getByText(/We compare booked hours/).waitFor();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
      for (const width of [1280, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        assert.ok((await section.boundingBox()).width >= 280, 'Settings card must retain a usable mobile width');
        await page.getByRole('group', { name: 'Scheduling preferences', exact: true }).screenshot({ animations: 'disabled', path: `/private/tmp/vanta-controls-${theme}-${width}.png` });
        for (const [index, label] of ['Month', 'Date', 'Time'].entries()) {
          await page.getByRole('navigation', { name: 'Example booking steps' }).getByRole('button', { name: `${index + 1} ${label}` }).click();
          if (index > 0) {
            const table = index === 1 ? week : day;
            assert.equal(await table.evaluate(element => element.scrollWidth > element.clientWidth), false);
            const square = await table.getByRole('img').first().boundingBox();
            assert.ok(square.width >= 20 && Math.abs(square.width - square.height) < 1, 'Availability cells must remain readable squares');
          }
          const region = page.getByRole('region', { name: 'Interactive booking example', exact: true });
          await region.scrollIntoViewIfNeeded();
          await region.screenshot({ animations: 'disabled', path: `/private/tmp/vanta-demo-${label}-${theme}-${width}.png` });
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('Studio settings: eight combinations, save/reload, interactive diagrams, keyboard, mobile and themes passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
