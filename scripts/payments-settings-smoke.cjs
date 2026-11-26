// Settings → Payments: deposits through Stripe only (card or PayTo). Build the studio
// (out/) and serve it on 3029 first. All backend calls are mocked.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3029';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, connected] of [[1280, true], [1280, false], [390, true]]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await setup(context);
      const puts = [];
      // A PayID saved before deposits went Stripe-only: never shown.
      await context.route(/\/studio\/me\/deposit-methods/, route => {
        if (route.request().method() === 'PUT') {
          puts.push(route.request().postDataJSON());
          return route.fulfill({ json: { payid: 'old@ink.example', booking_fee_payer: puts.at(-1).booking_fee_payer } });
        }
        return route.fulfill({ json: { payid: 'old@ink.example', payid_enabled: true, bank_bsb: '062-000', bank_enabled: true, card_enabled: true, booking_fee_payer: 'client' } });
      });
      await context.route(/\/studio\/me\/stripe\/status/, route => route.fulfill({ json: connected
        ? { connected: true, charges_enabled: true, details_submitted: true, payouts_enabled: true }
        : { connected: false, charges_enabled: false } }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      await page.goto(`${base}/dashboard/settings?tab=payments`, { waitUntil: 'networkidle' });
      const section = page.locator('section[aria-labelledby="deposit-options-title"]');
      await section.waitFor();

      // How clients pay: card or PayTo, explained. No PayID or bank fields.
      await section.getByText('How clients can pay', { exact: true }).waitFor();
      await section.getByText('Card', { exact: true }).waitFor();
      await section.getByText(/approve the payment in the banking app/).waitFor();
      assert.equal(await section.getByLabel('BSB').count(), 0);
      assert.equal(await section.getByRole('textbox', { name: /PayID/ }).count(), 0);
      assert.equal((await section.innerText()).includes('old@ink.example'), false, 'saved PayID not shown');

      if (!connected) {
        await section.getByText('Connect Stripe to take deposits', { exact: true }).waitFor();
        await section.getByRole('button', { name: 'Connect Stripe' }).waitFor();
        console.log(`PASS not connected: prompt to connect Stripe at ${width}px`);
      } else {
        await section.getByText('Stripe connected', { exact: true }).waitFor();
        // The fee example: any deposit, both ways round.
        await section.locator('#fee-example-deposit').fill('250');
        const text = async () => (await section.innerText()).replace(/\s+/g, ' ');
        assert.match(await text(), /Client pays \$258\.00/);
        await section.getByRole('radio', { name: /The studio/ }).click();
        assert.match(await text(), /Client pays \$250\.00/);
        assert.match(await text(), /You receive in Stripe \$242\.00/);
        await section.getByRole('button', { name: 'Save', exact: true }).click();
        await section.getByRole('button', { name: 'Save', exact: true }).waitFor({ state: 'detached' });
        assert.deepEqual(puts, [{ booking_fee_payer: 'business', fee_payer_only: true }]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
        console.log(`PASS connected: card + PayTo shown, fee example, fee payer saved at ${width}px`);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
