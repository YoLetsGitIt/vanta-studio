// Production UI with intercepted services. Never creates accounts, payments or bookings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const output = process.env.STUDIO_QA_OUTPUT || path.resolve(__dirname, '../../artifacts/studio-setup-checklist-2026-10-28');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROMIUM_EXECUTABLE ? { executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE } : {}) });
  const results = [];
  try {
    for (const width of [390, 1440]) {
      let state = { steps: {}, collapsed: false }, failRead = true, failWrite = false;
      const writes = [], errors = [];
      async function newContext() {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
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
      const checklist = () => page.getByRole('region', { name: 'Studio setup checklist' });
      const progress = async count => {
        await page.getByRole('status').filter({ hasText: `${count} of 6 steps reviewed` }).waitFor();
        await page.waitForFunction(() => document.getElementById('studio-setup')?.getAttribute('aria-busy') === 'false');
      };
      const checkbox = title => page.getByRole('checkbox', { name: `Mark ${title} as reviewed`, exact: true });
      const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}px document overflow`);

      await home();
      await checklist().getByRole('alert').waitFor();
      assert.equal(await checklist().getByRole('link', { name: 'Import data' }).getAttribute('href'), '/dashboard/import');
      await checklist().getByRole('button', { name: 'Try again' }).click();
      await progress(0);
      assert.equal(await checklist().getByRole('checkbox').count(), 6);
      assert.equal(writes.length, 0, 'Opening the checklist does not mark defaults as reviewed');
      await fits();
      await page.screenshot({ path: path.join(output, `checklist-${width}.png`), fullPage: true });

      // Each action must open its actual existing screen without raw static-export data.
      for (const [name, destination] of [
        ['Review studio', '/dashboard/settings?tab=studio'], ['Set hours and stations', '/dashboard/settings?tab=studio'],
        ['Add artists', '/dashboard/artists?onboarding=1'], ['Set up bookings', '/dashboard/settings?tab=bookings'],
        ['Set up payments', '/dashboard/settings?tab=payments'], ['Open importer', '/dashboard/import'],
      ]) {
        await checklist().getByRole('link', { name }).click();
        await page.waitForURL(`${base}${destination}`);
        await page.locator('.studio-dashboard-main h1').waitFor();
        assert.ok(!(await page.locator('body').innerText()).startsWith('1:'), 'Action must open an HTML document');
        await home(); await progress(0);
      }

      await checkbox('Studio details and timezone').click(); await progress(1);
      failWrite = true;
      await checkbox('Hours and stations').click();
      await checklist().getByRole('alert').waitFor();
      assert.equal(await checkbox('Hours and stations').isChecked(), false, 'Failed save must not appear completed');
      await checkbox('Hours and stations').click(); await progress(2);
      const payments = () => checklist().getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: 'Mark Payments as reviewed', exact: true }) });
      await payments().getByRole('button', { name: 'Not needed', exact: true }).click(); await progress(3);
      await payments().getByText('Skipped', { exact: true }).waitFor();
      await payments().getByRole('button', { name: 'Undo skip', exact: true }).click(); await progress(2);
      await payments().getByRole('button', { name: 'Not needed', exact: true }).click(); await progress(3);
      await checkbox('Your artists').click(); await progress(4);
      await checkbox('Bookings and consent').click(); await progress(5);
      await checkbox('Clients and upcoming appointments').click(); await progress(6);
      await page.reload({ waitUntil: 'networkidle' }); await progress(6);
      await checklist().getByRole('button', { name: 'Hide checklist' }).click();
      await checklist().getByRole('button', { name: 'Show checklist' }).waitFor();
      assert.equal(await checklist().getByRole('checkbox').count(), 0);
      await checklist().getByRole('link', { name: 'Import data' }).waitFor();
      await fits();
      await page.screenshot({ path: path.join(output, `checklist-collapsed-${width}.png`), fullPage: true });
      await context.close();

      // A fresh browser context has no local checklist state; the account response restores it.
      ({ context, page } = await newContext());
      await home(); await progress(6);
      await checklist().getByRole('button', { name: 'Show checklist' }).click();
      await checkbox('Studio details and timezone').click(); await progress(5);
      assert.equal(await checkbox('Clients and upcoming appointments').isChecked(), true);
      await page.goto(`${base}/dashboard/settings`, { waitUntil: 'networkidle' });
      const shortcuts = page.getByRole('complementary', { name: 'Studio setup shortcuts' });
      for (const tab of ['Studio', 'Bookings', 'Payments', 'Account']) {
        await page.locator('.studio-settings-tabs').getByRole('button', { name: tab, exact: true }).click();
        if (tab === 'Account') {
          await shortcuts.waitFor();
          assert.equal(await shortcuts.getByRole('link', { name: 'Import data', exact: true }).getAttribute('href'), '/dashboard/import');
        } else {
          await shortcuts.waitFor({ state: 'detached' });
        }
        await fits();
      }
      await page.goto(`${base}/dashboard/settings?tab=account`, { waitUntil: 'networkidle' });
      await shortcuts.waitFor();
      assert.equal(await shortcuts.getByRole('link', { name: 'Setup checklist', exact: true }).getAttribute('href'), '/dashboard/home#studio-setup');
      await page.screenshot({ path: path.join(output, `settings-shortcuts-${width}.png`), fullPage: true });
      await shortcuts.getByRole('link', { name: 'Setup checklist' }).click();
      await page.waitForURL(`${base}/dashboard/home#studio-setup`); await progress(5);
      await checklist().getByRole('link', { name: 'Import data' }).click();
      await page.waitForURL(`${base}/dashboard/import`);
      await page.locator('.studio-dashboard-main h1').waitFor();
      await fits();
      assert.deepEqual(errors, []);
      results.push({ width, passed: true, savedUpdates: writes.length, checks: ['read retry', 'all six action destinations', 'no inferred completion', 'failed save recovery', 'optional skip and undo', 'progress and collapse persistence', 'fresh context restoration', 'reopen completed step', 'settings shortcuts restricted to Account tab', 'direct Account tab navigation', 'import navigation', 'no overflow or runtime errors'] });
      console.log(`PASS ${width}px: checklist, saved progress, retries, skip/undo, navigation and Settings shortcuts.`);
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
