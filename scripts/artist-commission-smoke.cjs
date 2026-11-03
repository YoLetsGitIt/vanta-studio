// Settings → Payments → Artist commission: add, edit and remove an artist's own rate.
// Serve out/ with clean URLs first. All services are intercepted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 800, hasTouch: width < 800 });
      await setup(context);
      let overrides = [{ artist_id: 'artist-1', artist_name: 'Jamie Lee', studio_cut_percent: 25, personal_cut_percent: null }];
      const writes = [];
      await context.route(/\/studio\/me\/commission-overrides/, route => {
        const req = route.request(), id = new URL(req.url()).pathname.split('/').pop();
        if (req.method() === 'PUT') {
          const body = req.postDataJSON(); writes.push({ method: 'PUT', id, body });
          overrides = [...overrides.filter(o => o.artist_id !== id), { artist_id: id, artist_name: id === 'artist-0' ? 'Sam Anderson' : 'Jamie Lee', ...body }];
        } else if (req.method() === 'DELETE') { writes.push({ method: 'DELETE', id }); overrides = overrides.filter(o => o.artist_id !== id); }
        return route.fulfill({ json: { overrides } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/dashboard/settings?tab=payments`, { waitUntil: 'networkidle' });
      const card = page.getByRole('region', { name: 'Artist commission' });
      await card.getByText('Jamie Lee').waitFor();
      assert.match(await card.innerText(), /Studio & walk-in 25%/);
      assert.match(await card.innerText(), /Personal Studio rate/);

      // Add Sam with only a personal rate.
      await card.getByRole('button', { name: '+ Add artist rate' }).click();
      await card.getByRole('combobox').selectOption('artist-0');
      await card.getByLabel('Personal, app & imported studio share for this artist').fill('15');
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await card.getByText('Sam Anderson').waitFor();
      assert.deepEqual(writes.at(-1), { method: 'PUT', id: 'artist-0', body: { studio_cut_percent: null, personal_cut_percent: 15 } });

      // Edit Jamie; out-of-range values are caught before saving.
      await card.getByRole('button', { name: 'Edit commission for Jamie Lee' }).click();
      const studioRate = card.getByLabel('Studio & walk-in studio share for this artist');
      assert.equal(await studioRate.inputValue(), '25');
      await studioRate.fill('120');
      const before = writes.length;
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      assert.equal(await studioRate.evaluate(el => el.validity.valid), false, 'Over 100% is invalid');
      assert.equal(writes.length, before, 'Invalid rate is not saved');
      await studioRate.fill('30');
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await card.getByText('30%').waitFor();
      assert.deepEqual(writes.at(-1).body, { studio_cut_percent: 30, personal_cut_percent: null });

      // Remove puts the artist back on studio rates.
      await card.getByRole('button', { name: 'Use studio rates for Jamie Lee' }).click();
      await card.getByText('Jamie Lee').waitFor({ state: 'detached' });
      assert.deepEqual(writes.at(-1), { method: 'DELETE', id: 'artist-1' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
      assert.deepEqual(errors, []);
      console.log(`PASS artist commission at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
