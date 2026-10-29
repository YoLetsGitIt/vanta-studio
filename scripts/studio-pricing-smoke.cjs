// Production export with isolated services. Does not create a subscription.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3036';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROMIUM_EXECUTABLE ? { executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE } : {}) });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await setup(context);
      let billing = {};
      await context.route('**/studio/me/billing', route => route.fulfill({ json: billing }));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/dashboard/settings?tab=account`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Billing', exact: true }).waitFor();
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Billing', exact: true }) });
      await section.getByText(/\$30\/mo AUD covers up to 6 artists, then \$5\/artist beyond that\./).waitFor();
      // Estimates are returned by the API; UI must not clamp larger studios to
      // the base fee, or replace Stripe's actual next-invoice amount.
      billing = { base_tier_cents: 3000, base_tier_seats: 6, per_extra_seat_cents: 500, seat_count: 8, estimated_monthly_cents: 4000 };
      await page.reload({ waitUntil: 'networkidle' });
      await section.getByText('$40', { exact: true }).waitFor();
      billing = { ...billing, current_period_end: '2027-01-01T00:00:00Z', next_amount_due_cents: 4500 };
      await page.reload({ waitUntil: 'networkidle' });
      await section.getByText('$45', { exact: true }).waitFor();
      await section.getByText(/\$30\/mo AUD covers up to 6 artists/).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: base-rate fallback, 8-artist estimate, actual Stripe invoice amount and responsive billing layout.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
