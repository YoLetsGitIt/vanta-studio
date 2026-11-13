// Regression: a linked booking can be absent from the current list (filter/page).
// The detail panel must survive its first render with no summary or full record.
// APIs, including writes, are mocked by the shared fixtures. No messages are sent.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3059';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE });
  try {
    for (const width of [390, 1440]) {
      for (const kind of ['pending', 'offered', 'paid']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await setup(context);
        const booking = {
          id: 'delayed-request', requester_name: 'Pending Test', requester_email: 'pending@example.test',
          status: kind === 'paid' ? 'confirmed' : kind === 'offered' ? 'awaiting_payment' : 'pending',
          source: 'studio', created_at: '2026-11-05T00:00:00Z',
          ...(kind === 'paid' ? { chosen_time: '2099-03-04T12:00:00Z', deposit_required: true, deposit_amount: 80, deposit_paid_at: '2026-11-05T00:00:00Z', deposit_confirmed_at: '2026-11-05T00:00:00Z' } : {}),
        };
        let releaseDetails;
        const detailGate = new Promise(resolve => { releaseDetails = resolve; });
        await context.route(/\/studio\/me\/bookings(\?|$)/, r => r.fulfill({ json: { bookings: [] } }));
        await context.route(/\/studio\/me\/bookings\/delayed-request$/, async r => {
          await detailGate;
          await r.fulfill({ json: booking });
        });
        await context.route(/\/studio\/me\/booking-management$/, r => r.fulfill({ json: { mode: 'studio' } }));
        await context.route(/\/studio\/me\/bookings\/delayed-request\/offered-times$/, r => r.fulfill({ json: { offer: kind === 'offered' ? { times: ['2099-03-04T12:00:00Z'], artist_name: 'Sam', duration_minutes: 60 } : null } }));
        await context.route(/\/studio\/me\/bookings\/delayed-request\/deposit-receipt$/, r => r.fulfill({ json: { receipt: { method: 'bank_transfer' } } }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        try {
          await page.goto(`${base}/dashboard/appointments?status=pending&booking=${booking.id}`, { waitUntil: 'domcontentloaded' });
          // Keep the API unresolved until the loading panel is visible. This reliably
          // exercises the missing-ID render instead of relying on network timing.
          await page.locator('.studio-booking-detail[aria-busy="true"]').waitFor({ timeout: 10000 });
          assert.deepEqual(errors, [], 'Loading a booking without summary data must not crash');
          releaseDetails();
          const panel = page.getByRole('complementary', { name: 'Pending Test booking details' });
          await panel.waitFor();
          await page.waitForFunction(() => document.querySelector('.studio-booking-detail')?.getAttribute('aria-busy') !== 'true');
          if (kind === 'offered') await panel.getByRole('list', { name: 'Offered times' }).waitFor();
          if (kind === 'paid') await panel.getByText(/^Paid by bank transfer on/i).waitFor();
          await panel.getByRole('button', { name: 'Close booking details' }).click();
          await panel.waitFor({ state: 'detached' });
          assert.deepEqual(errors, [], 'Loading, rendering and closing must not throw');
          assert.equal(await page.getByText('Application error: a client-side exception', { exact: false }).count(), 0);
          console.log(`PASS missing-summary ${kind}, delayed details, close at ${width}px`);
        } catch (e) {
          console.error('Captured page errors:', errors);
          throw e;
        } finally {
          releaseDetails();
          await context.close();
        }
      }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
