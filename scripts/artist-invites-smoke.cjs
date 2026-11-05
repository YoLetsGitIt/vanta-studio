// Artists → Invite artists: copy the link, invite by email and by phone, cancel.
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
          const phone = body.phone ? '+61412345678' : null;
          state = { ...state, pending: [{ id: `inv-${writes.length}`, code: `pers${writes.length}code`, kind: 'personal', email: body.email || null, phone, created_at: '2026-11-05T01:00:00Z', sent_via: phone ? null : 'email', send_error: phone ? 'text messages are off; copy the link and send it yourself' : null }, ...state.pending] };
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

      await dialog.getByLabel('Artist email or mobile number').fill('dani@example.com');
      await dialog.getByRole('button', { name: 'Send' }).click();
      await dialog.getByText('Invite sent to dani@example.com.').waitFor();
      assert.deepEqual(writes.at(-1), { email: 'dani@example.com', phone: '' });

      await dialog.getByLabel('Artist email or mobile number').fill('0412 345 678');
      await dialog.getByRole('button', { name: 'Send' }).click();
      await dialog.getByText(/Invite saved\. text messages are off/).waitFor();
      assert.deepEqual(writes.at(-1), { email: '', phone: '0412 345 678' });
      await dialog.getByText('Waiting to join (2)').waitFor();
      await dialog.getByText('Not sent: copy the link and send it yourself').waitFor();

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
