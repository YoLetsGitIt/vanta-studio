// Artists → Invite artists: the studio code (copy, copy message, get a new code), invite by email, cancel.
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
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
      let state = { code: 'K7P-M3Q', link_url: 'https://www.vanta.tattoo/j/k7pm3q', pending: [] };
      const writes = [];
      await context.route(/\/studio\/me\/artist-invites/, route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === 'POST' && url.pathname.endsWith('/link/reset')) {
          writes.push('reset'); state = { ...state, code: 'X2Q-9RT', link_url: 'https://www.vanta.tattoo/j/x2q9rt' };
        } else if (req.method() === 'POST') {
          const body = req.postDataJSON(); writes.push(body);
          state = { ...state, pending: [{ id: `inv-${writes.length}`, code: `pers${writes.length}code`, kind: 'personal', email: body.email, created_at: '2026-11-05T01:00:00Z', sent_via: 'email' }, ...state.pending] };
          return route.fulfill({ status: 201, json: state });
        } else if (req.method() === 'DELETE') {
          const id = url.pathname.split('/').pop(); writes.push({ cancel: id });
          state = { ...state, pending: state.pending.filter(p => p.id !== id) };
        }
        return route.fulfill({ json: state });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', d => d.accept());
      await page.goto(`${base}/dashboard/artists`, { waitUntil: 'networkidle' });
      const skip = page.getByRole('button', { name: 'Skip artist setup' });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      await page.getByRole('button', { name: 'Invite artists' }).click();
      const dialog = page.getByRole('dialog', { name: 'Invite artists' });
      const code = dialog.getByLabel('Studio code');
      await code.getByText('K7P-M3Q', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Copy code', exact: true }).click();
      await dialog.getByRole('button', { name: 'Copied' }).waitFor();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'K7P-M3Q');
      await dialog.getByRole('button', { name: 'Copy message', exact: true }).click();
      assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Join a studio code[\s\S]*K7P-M3Q|K7P-M3Q/);

      assert.equal(await dialog.getByText(/mobile/i).count(), 0, 'No phone invites');
      for (const email of ['dani@example.com', 'sam@example.com']) {
        await dialog.getByLabel('Artist email').fill(email);
        await dialog.getByRole('button', { name: 'Send' }).click();
        await dialog.getByText(`Invite sent to ${email}.`).waitFor();
        assert.deepEqual(writes.at(-1), { email });
      }
      await dialog.getByText('Waiting to join (2)').waitFor();

      await dialog.getByRole('button', { name: 'Cancel' }).first().click();
      await dialog.getByText('Waiting to join (1)').waitFor();

      await dialog.getByRole('button', { name: 'Get a new code' }).click();
      await dialog.getByText('New studio code created. The old code no longer works.').waitFor();
      await code.getByText('X2Q-9RT', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
      assert.deepEqual(errors, []);
      console.log(`PASS artist invites at ${width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
