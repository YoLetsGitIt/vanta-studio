// Artists → Invite artists: copy the link, invite by email, cancel.
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
      let state = { link_url: 'https://www.vanta.tattoo/j/abcdefghjk', pending: [] };
      const writes = [];
      await context.route(/\/studio\/me\/artist-invites/, route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === 'POST' && url.pathname.endsWith('/link/reset')) {
          writes.push('reset'); state = { ...state, link_url: 'https://www.vanta.tattoo/j/newlink234' };
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
      const linkInput = dialog.getByLabel('Invite link');
      await page.waitForFunction(() => document.querySelector('input[aria-label="Invite link"]')?.value.startsWith('https://'));
      assert.equal(await linkInput.inputValue(), 'https://www.vanta.tattoo/j/abcdefghjk');
      await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
      await dialog.getByRole('button', { name: 'Copied' }).waitFor();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://www.vanta.tattoo/j/abcdefghjk');

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

      await dialog.getByRole('button', { name: 'Reset link' }).click();
      await dialog.getByText('New invite link created. The old link no longer works.').waitFor();
      assert.equal(await linkInput.inputValue(), 'https://www.vanta.tattoo/j/newlink234');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
      await page.screenshot({ path: `/private/tmp/claude-501/-Users-matthewkwon-Documents-vanta/dfaf52eb-4ed3-4d2e-959d-1887c9e8d497/scratchpad/invite-dialog-${width}.png` });
      assert.deepEqual(errors, []);
      console.log(`PASS artist invites at ${width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
