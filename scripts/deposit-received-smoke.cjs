// Booking panel → Mark received: the studio records how a deposit paid outside Stripe arrived
// (PayID, bank transfer or cash; claims from before deposits went Stripe-only).
// All remote requests are intercepted. No live bookings or payments are modified.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup, booking } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 800, hasTouch: width < 800 });
      await setup(context);
      let current = { ...booking, status: 'awaiting_payment', chosen_time: new Date(Date.now() + 864e5).toISOString(), deposit_required: true, deposit_amount: 100, deposit_paid_at: null, deposit_confirmed_at: null };
      let receipt = null;
      const posts = [];
      await context.route('**/studio/me/dashboard-attention', route => route.fulfill({ json: { bookings: current.deposit_paid_at ? [] : [current], pending_artists: [], pending_reimbursements: [] } }));
      await context.route(/\/studio\/me\/bookings\/booking-1$/, route => route.fulfill({ json: current }));
      await context.route(/\/studio\/me\/bookings\/booking-1\/deposit-receipt/, route => route.fulfill({ json: { receipt, client_claim: receipt ? null : { method: 'payid', recorded_at: new Date().toISOString() } } }));
      await context.route(/\/studio\/me\/bookings\/booking-1\/deposit-received/, route => {
        const body = route.request().postDataJSON();
        posts.push(body);
        const now = new Date().toISOString();
        current = { ...current, status: 'confirmed', deposit_paid_at: now, deposit_confirmed_at: now };
        receipt = { method: body.method, recorded_at: now };
        return route.fulfill({ json: { status: 'confirmed', deposit_paid: true, method: body.method } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      // The client said they paid by PayID (a claim from before deposits went Stripe-only):
      // the panel shows it, and the studio records how the money arrived.
      await page.goto(base + '/dashboard/appointments?booking=booking-1', { waitUntil: 'networkidle' });
      await page.getByRole('status').filter({ hasText: /says they’ve paid/ }).filter({ hasText: /PayID/ }).waitFor();

      // Opening and cancelling the dialog records nothing.
      await page.getByRole('button', { name: 'Mark received', exact: true }).click();
      let dialog = page.getByRole('dialog', { name: 'Record deposit payment' });
      await dialog.waitFor();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(posts.length, 0);

      await page.getByRole('button', { name: 'Mark received', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Record deposit payment' });
      for (const name of ['PayID', 'Bank transfer', 'Cash']) await dialog.getByRole('radio', { name }).waitFor();
      await dialog.getByRole('radio', { name: 'Bank transfer' }).click();
      assert.equal(await dialog.getByRole('radio', { name: 'Bank transfer' }).getAttribute('aria-checked'), 'true');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
      await dialog.getByRole('button', { name: /Mark as paid|Mark received/ }).click();
      await page.getByText(/Deposit recorded as paid by bank transfer\.|Paid by bank transfer/).first().waitFor();
      assert.deepEqual(posts, [{ method: 'bank_transfer' }]);

      // The booking details show how it was paid.
      await page.goto(base + '/dashboard/appointments?booking=booking-1', { waitUntil: 'networkidle' });
      await page.getByText(/Paid by bank transfer on /).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS deposit received by bank transfer at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
