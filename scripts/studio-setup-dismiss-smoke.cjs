// Studio setup checklist: Dismiss removes it for good; the Settings shortcut brings it back.
// Serve out/ with clean URLs first. All services are intercepted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const shots = process.env.STUDIO_QA_OUTPUT;

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const state = { steps: { profile: 'complete' }, collapsed: false, dismissed: false };
      const writes = [];
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await setup(context);
      await context.route('**/studio/me/onboarding', route => {
        if (route.request().method() === 'PATCH') { const change = route.request().postDataJSON(); writes.push(change); Object.assign(state, change); }
        return route.fulfill({ json: state });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const checklist = page.locator('#studio-setup');
      await page.goto(`${base}/dashboard/home`, { waitUntil: 'networkidle' });
      await checklist.getByRole('heading', { name: 'Studio setup' }).waitFor();
      if (shots) await page.screenshot({ path: `${shots}/setup-${width}.png` });
      await checklist.getByRole('button', { name: 'Dismiss setup checklist' }).click();
      await checklist.waitFor({ state: 'detached' });
      assert.deepEqual(writes.at(-1), { dismissed: true });
      assert.equal(state.steps.profile, 'complete', 'Progress is kept');
      // Stays gone on the next visit.
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      assert.equal(await checklist.count(), 0, 'Dismissed checklist stays hidden');
      // Settings → Account → Setup checklist reopens it.
      await page.goto(`${base}/dashboard/settings?tab=account`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: /Setup checklist/ }).click();
      await checklist.getByRole('heading', { name: 'Studio setup' }).waitFor();
      assert.deepEqual(writes.at(-1), { dismissed: false });
      assert.equal(new URL(page.url()).searchParams.has('setup'), false, 'Reopen flag is removed from the address');
      assert.deepEqual(errors, []);
      console.log(`PASS dismiss and reopen setup checklist at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
