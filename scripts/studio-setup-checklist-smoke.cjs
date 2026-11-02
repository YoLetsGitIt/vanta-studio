// Production UI with intercepted services. Never creates accounts, payments or bookings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const output = process.env.STUDIO_QA_OUTPUT || path.resolve(__dirname, '../../artifacts/studio-setup-simplify-2026-10-30');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROMIUM_EXECUTABLE ? { executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE } : {}) });
  const results = [];
  try {
    for (const width of [320, 390, 1440]) {
      let state = { steps: {}, collapsed: false }, failRead = true, failWrite = false;
      const writes = [], errors = [];
      async function newContext() {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 760, isMobile: width < 760 });
        await setup(context);
        await context.route('**/studio/me/onboarding', async route => {
          if (route.request().method() === 'PATCH') {
            if (failWrite) { failWrite = false; return route.fulfill({ status: 503, json: { error: 'Could not save setup progress. Please try again.' } }); }
            const change = route.request().postDataJSON(); writes.push(change);
            if (change.step) state.steps[change.step] = change.status;
            else state.collapsed = change.collapsed;
          } else if (failRead) { failRead = false; return route.fulfill({ status: 503, json: { error: 'Unavailable' } }); }
          return route.fulfill({ json: state });
        });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        return { context, page };
      }
      let { context, page } = await newContext();
      const home = () => page.goto(`${base}/dashboard/home`, { waitUntil: 'networkidle' });
      const checklist = () => page.getByRole('region', { name: 'Studio setup', exact: true });
      const progress = async count => {
        await page.getByRole('status').filter({ hasText: `${count} of 6 done` }).waitFor();
        await page.waitForFunction(() => document.getElementById('studio-setup')?.getAttribute('aria-busy') === 'false');
      };
      const completion = title => page.getByRole('button', { name: `Complete ${title}`, exact: true });
      const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}px document overflow`);

      await home();
      await checklist().getByRole('alert').waitFor();
      assert.equal(await checklist().getByRole('link', { name: 'Import data', exact: true }).count(), 0);
      await checklist().getByRole('button', { name: 'Try again' }).click();
      await progress(0);
      assert.equal(await checklist().getByRole('button', { name: /^Complete / }).count(), 6);
      assert.equal(writes.length, 0, 'Opening the checklist does not mark defaults as complete');
      await fits();
      assert.equal(await checklist().getByText('Name, address and timezone.', { exact: true }).count(), 0);
      for (const theme of ['dark', 'light']) {
        await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
        await checklist().screenshot({ path: path.join(output, `checklist-${width}-${theme}.png`), animations: 'disabled' });
      }
      await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
      const tapSize = await completion('Studio details').boundingBox();
      assert.ok(tapSize.width >= 44 && tapSize.height >= 44, 'Checkbox keeps a 44px tap target');

      // Each action must open its actual existing screen without raw static-export data.
      for (const [name, destination] of [
        ['Review studio', '/dashboard/settings?tab=studio'], ['Set hours and stations', '/dashboard/settings?tab=studio'],
        ['Add artists', '/dashboard/artists?onboarding=1'], ['Set up bookings', '/dashboard/settings?tab=requests'],
        ['Set up payments', '/dashboard/settings?tab=payments'], ['Open importer', '/dashboard/import'],
      ]) {
        await checklist().getByRole('link', { name }).click();
        await page.waitForURL(`${base}${destination}`);
        await page.locator('.studio-dashboard-main h1').waitFor();
        assert.ok(!(await page.locator('body').innerText()).startsWith('1:'), 'Action must open an HTML document');
        await home(); await progress(0);
      }

      await completion('Studio details').focus();
      await page.keyboard.press('Enter'); await progress(1);
      assert.equal(await completion('Studio details').getAttribute('aria-pressed'), 'true');
      assert.equal(await completion('Studio details').innerText(), '');
      assert.equal(await completion('Studio details').locator('svg').count(), 1);
      await page.keyboard.press('Space'); await progress(0);
      assert.equal(await completion('Studio details').innerText(), '');
      assert.equal(await completion('Studio details').locator('svg').count(), 0, 'Pending step has an empty checkbox');
      await completion('Studio details').click(); await progress(1);
      failWrite = true;
      await completion('Hours & stations').click();
      await checklist().getByRole('alert').waitFor();
      assert.equal(await completion('Hours & stations').getAttribute('aria-pressed'), 'false', 'Failed save must not appear completed');
      await completion('Hours & stations').click(); await progress(2);
      assert.equal(await checklist().getByRole('button', { name: 'Not needed', exact: true }).count(), 0);
      assert.equal(await checklist().getByRole('button', { name: 'Undo skip', exact: true }).count(), 0);
      await completion('Payments').click(); await progress(3);
      await completion('Payments').click(); await progress(2);
      await completion('Payments').click(); await progress(3);
      await completion('Artists').click(); await progress(4);
      await completion('Bookings & consent').click(); await progress(5);
      await completion('Import clients').click(); await progress(6);
      await page.reload({ waitUntil: 'networkidle' }); await progress(6);
      await checklist().getByRole('button', { name: 'Hide checklist' }).click();
      await checklist().getByRole('button', { name: 'Show checklist' }).waitFor();
      assert.equal(await checklist().getByRole('button', { name: /^Complete / }).count(), 0);
      assert.equal(await checklist().getByRole('link', { name: 'Import data', exact: true }).count(), 0);
      await fits();
      await page.screenshot({ path: path.join(output, `checklist-collapsed-${width}.png`), fullPage: true });
      await context.close();

      // A fresh browser context has no local checklist state; the account response restores it.
      ({ context, page } = await newContext());
      await home(); await progress(6);
      await checklist().getByRole('button', { name: 'Show checklist' }).click();
      await completion('Studio details').click(); await progress(5);
      assert.equal(await completion('Import clients').getAttribute('aria-pressed'), 'true');
      await page.goto(`${base}/dashboard/settings`, { waitUntil: 'networkidle' });
      const shortcuts = page.getByRole('complementary', { name: 'Studio setup shortcuts' });
      for (const tab of ['studio', 'requests', 'payments', 'account']) {
        await page.goto(`${base}/dashboard/settings?tab=${tab}`, { waitUntil: 'networkidle' });
        if (tab === 'account') {
          await shortcuts.waitFor();
          assert.equal(await shortcuts.getByRole('link', { name: 'Import data', exact: true }).getAttribute('href'), '/dashboard/import');
        } else {
          await shortcuts.waitFor({ state: 'detached' });
        }
        await fits();
      }
      await page.goto(`${base}/dashboard/settings?tab=account`, { waitUntil: 'networkidle' });
      await shortcuts.waitFor();
      assert.equal(await shortcuts.getByRole('link', { name: 'Setup checklist', exact: true }).getAttribute('href'), '/dashboard/home?setup=1#studio-setup');
      await page.screenshot({ path: path.join(output, `settings-shortcuts-${width}.png`), fullPage: true });
      await shortcuts.getByRole('link', { name: 'Setup checklist' }).click();
      await page.waitForURL(`${base}/dashboard/home#studio-setup`); await progress(5);
      await checklist().getByRole('link', { name: 'Open importer' }).click();
      await page.waitForURL(`${base}/dashboard/import`);
      await page.locator('.studio-dashboard-main h1').waitFor();
      await fits();
      assert.deepEqual(errors, []);
      results.push({ width, passed: true, savedUpdates: writes.length, checks: ['Compact checklist with no duplicate descriptions or Complete labels', '44px touch target', 'dark and light themes', 'Small checkbox and saved checkmark', 'keyboard complete and undo', 'read retry', 'all six action destinations', 'no inferred completion', 'failed save recovery', 'optional completion and undo; skip actions removed', 'progress and collapse persistence', 'fresh context restoration', 'reopen completed step', 'settings shortcuts restricted to Account tab', 'direct Account tab navigation', 'import navigation', 'no overflow or runtime errors'] });
      console.log(`PASS ${width}px: checklist, saved progress, retries, completion/undo, navigation and Settings shortcuts.`);
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
