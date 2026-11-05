// Artists → "Dani lists Tattoora as their studio": Add artist, and Not us.
// Serve out/ with clean URLs first. All services are intercepted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 800, hasTouch: width < 800 });
      await setup(context);
      let duplicates = [
        { studio_id: 'dup-1', name: 'Tattoora', address: '211, Oxford St, Darlinghurst', registered: false, artist_count: 1, artists: ['Dani'] },
        { studio_id: 'dup-2', name: 'Tattoora Studio', address: '', registered: false, artist_count: 3, artists: ['Ana', 'Ben', 'Cy'] },
      ];
      const calls = [];
      await context.route(/\/studio\/me\/duplicate-studios/, route => {
        const path = new URL(route.request().url()).pathname;
        const m = path.match(/duplicate-studios\/([^/]+)\/(accept|dismiss)$/);
        if (m) { calls.push(`${m[2]} ${m[1]}`); duplicates = duplicates.filter(d => d.studio_id !== m[1]); }
        return route.fulfill({ json: { duplicates } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/dashboard/artists`, { waitUntil: 'networkidle' });
      const skip = page.getByRole('button', { name: 'Skip artist setup' });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      const first = page.getByRole('region', { name: 'Possible duplicate: Tattoora', exact: true });
      await first.getByText('Dani lists “Tattoora” as their studio').waitFor();
      await page.getByText('Ana, Ben and 1 more list “Tattoora Studio” as their studio').waitFor();
      await first.getByRole('button', { name: 'Add artist' }).click();
      await first.waitFor({ state: 'detached' });
      await page.getByRole('region', { name: 'Possible duplicate: Tattoora Studio', exact: true }).getByRole('button', { name: 'Not us' }).click();
      await page.getByRole('region', { name: /Possible duplicate/ }).first().waitFor({ state: 'detached' });
      assert.deepEqual(calls, ['accept dup-1', 'dismiss dup-2']);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
      assert.deepEqual(errors, []);
      console.log(`PASS duplicate studio banner at ${width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
