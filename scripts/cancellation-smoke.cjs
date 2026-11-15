// Cancellations and reschedules in the studio: the cancellation policy in Settings,
// "New time requested" and "Refunds to send" in Needs action, their actions in the
// booking panel, and what the studio's cancel does to the client's deposit.
// Build and serve out/ first. APIs, including writes, are mocked. No messages are sent.
// STUDIO_PLAYWRIGHT_PATH=/path/to/playwright STUDIO_TEST_URL=http://127.0.0.1:3059 node scripts/cancellation-smoke.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup, booking } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3059';
const shots = process.env.STUDIO_SHOTS_DIR;

const later = new Date(Date.now() + 20 * 86400e3).toISOString();
const asked = { ...booking, id: 'asked-1', requester_name: 'Riley Chen', chosen_time: later, deposit_required: true, deposit_amount: 100, deposit_paid_at: later, deposit_confirmed_at: later,
  reschedule_request: { booking_id: 'asked-1', requester_name: 'Riley Chen', message: 'Could we do the Saturday after?', chosen_time: later, created_at: new Date().toISOString() } };
// Asked for a particular time: the studio can approve it.
const wanted = new Date(Date.now() + 23 * 86400e3);
wanted.setHours(13, 0, 0, 0);
const preferred = { ...asked, id: 'pref-1', requester_name: 'Alex Moore',
  reschedule_request: { booking_id: 'pref-1', requester_name: 'Alex Moore', message: '', preferred_time: wanted.toISOString(), chosen_time: later, created_at: new Date().toISOString() } };
const owed = { ...booking, id: 'owed-1', requester_name: 'Jordan Blake', status: 'cancelled', cancelled_by: 'user', cancellation_reason: 'client_requested', chosen_time: later,
  deposit_required: true, deposit_amount: 80, deposit_paid_at: later, deposit_refund_required: true, deposit_refund_amount: 80 };

async function routes(context, calls) {
  await context.route(/\/studio\/me\/dashboard-attention$/, r => r.fulfill({ json: {
    bookings: [], pending_artists: [], pending_reimbursements: [],
    reschedule_requests: [{ booking_id: 'asked-1', requester_name: 'Riley Chen', artist_name: 'Sam Anderson', message: 'Could we do the Saturday after?', chosen_time: later, created_at: new Date().toISOString() }],
    refunds_owed: [{ booking_id: 'owed-1', requester_name: 'Jordan Blake', amount: 80, cancelled_by: 'user', cancelled_at: new Date().toISOString(), chosen_time: later }],
  } }));
  await context.route(/\/studio\/me\/bookings\/asked-1$/, r => r.fulfill({ json: asked }));
  await context.route(/\/studio\/me\/bookings\/owed-1$/, r => r.fulfill({ json: owed }));
  await context.route(/\/studio\/me\/bookings\/pref-1$/, r => r.fulfill({ json: preferred }));
  await context.route(/\/reschedule-request\/approve$/, r => { calls.push('approve'); return r.fulfill({ json: { status: 'confirmed' } }); });
  await context.route(/\/reschedule-request\/offer$/, r => { calls.push(['offer', JSON.parse(r.request().postData() || '{}')]); return r.fulfill({ json: { status: 'offered' } }); });
  await context.route(/\/studio\/me\/bookings\/asked-1\/cancel-preview$/, r => r.fulfill({ json: { deposit: 'refund', refund_amount: 103.5, deposit_amount: 100, paid_through_vanta: true } }));
  for (const [re, name] of [[/\/reschedule-request\/dismiss$/, 'dismiss'], [/\/refund-sent$/, 'refund-sent']]) {
    await context.route(re, r => { calls.push(name); return r.fulfill({ json: { ok: true } }); });
  }
  await context.route(/\/studio\/me\/profile$/, r => { calls.push(['profile', JSON.parse(r.request().postData() || '{}')]); return r.fulfill({ json: { status: 'ok' } }); });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE });
  let failed = false;
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await setup(context);
      const calls = [];
      await routes(context, calls);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push((e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
      try {
        // ── Booking panel: client asked for a new time ──
        await page.goto(`${base}/dashboard/appointments?booking=asked-1`, { waitUntil: 'domcontentloaded' });
        const panel = page.getByRole('complementary', { name: 'Riley Chen booking details' });
        await panel.getByText('Riley asked for a new time').waitFor({ timeout: 15000 });
        await panel.getByText('“Could we do the Saturday after?”').waitFor();
        if (shots) await page.screenshot({ path: `${shots}/panel-request-${width}.png` });
        await panel.getByRole('button', { name: 'Can’t move it' }).click();
        await page.waitForFunction(() => true);
        await new Promise(r => setTimeout(r, 400));
        assert.ok(calls.includes('dismiss'), 'Can’t move it closes the request');

        // Offer the client a time to choose.
        await page.goto(`${base}/dashboard/appointments?booking=asked-1`, { waitUntil: 'domcontentloaded' });
        await panel.getByText('Riley asked for a new time').waitFor({ timeout: 15000 });
        await panel.getByRole('button', { name: 'Offer times' }).click();
        const day = new Date(Date.now() + 25 * 86400e3);
        const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        await panel.getByLabel('Time 1 date').fill(ymd);
        await panel.getByLabel('Time 1', { exact: true }).fill('11:30');
        if (shots) await page.screenshot({ path: `${shots}/panel-offer-${width}.png` });
        await panel.getByRole('button', { name: 'Send times' }).click();
        await new Promise(r => setTimeout(r, 400));
        const offer = calls.find(c => Array.isArray(c) && c[0] === 'offer');
        assert.ok(offer && offer[1].times.length === 1, 'Sends the offered time');
        assert.equal(new Date(offer[1].times[0]).getTime(), new Date(`${ymd}T11:30:00`).getTime(), 'Offered time in the studio’s local time');

        // A particular time asked for: approve it.
        await page.goto(`${base}/dashboard/appointments?booking=pref-1`, { waitUntil: 'domcontentloaded' });
        const prefPanel = page.getByRole('complementary', { name: 'Alex Moore booking details' });
        await prefPanel.getByRole('button', { name: /^Approve/ }).waitFor({ timeout: 15000 });
        if (shots) await page.screenshot({ path: `${shots}/panel-approve-${width}.png` });
        await prefPanel.getByRole('button', { name: /^Approve/ }).click();
        await new Promise(r => setTimeout(r, 400));
        assert.ok(calls.includes('approve'), 'Approve moves it to the asked-for time');

        // ── Booking panel: refund to send ──
        await page.goto(`${base}/dashboard/appointments?booking=owed-1`, { waitUntil: 'domcontentloaded' });
        const owedPanel = page.getByRole('complementary', { name: 'Jordan Blake booking details' });
        await owedPanel.getByText('Send Jordan their $80 deposit').waitFor({ timeout: 15000 });
        if (shots) await page.screenshot({ path: `${shots}/panel-refund-${width}.png` });
        await owedPanel.getByRole('button', { name: 'Mark refund sent' }).click();
        await new Promise(r => setTimeout(r, 400));
        assert.ok(calls.includes('refund-sent'), 'Mark refund sent records it');

        if (width === 1440) {
          // ── Needs action lists both ──
          await page.goto(`${base}/dashboard/schedule`, { waitUntil: 'domcontentloaded' });
          const needs = page.locator('section[aria-labelledby="needs-action-title"]').first();
          await needs.getByRole('button', { name: /New time requested/ }).click();
          await needs.getByText('“Could we do the Saturday after?”').waitFor();
          await needs.getByRole('button', { name: /Refunds to send/ }).click();
          await needs.getByText(/\$80\.00 deposit/).waitFor();
          if (shots) await page.screenshot({ path: `${shots}/needs-action.png` });

          // ── The studio's cancel says the client is refunded in full ──
          await needs.getByRole('button', { name: /Riley Chen/ }).click();
          const global = page.getByRole('complementary', { name: 'Riley Chen booking details' });
          await global.getByRole('button', { name: 'Cancel', exact: true }).first().click();
          const dialog = page.getByRole('dialog', { name: 'Cancel booking' });
          await dialog.getByText(/refunded everything they paid \(\$103\.50, including the Vanta booking fee\)/).waitFor({ timeout: 10000 });
          if (shots) await page.screenshot({ path: `${shots}/cancel-dialog.png` });

          // ── Settings: cancellation policy ──
          await page.goto(`${base}/dashboard/settings?tab=payments`, { waitUntil: 'domcontentloaded' });
          // One setting: when a client can cancel and still get their deposit back.
          const refund = page.getByLabel('Deposit refund');
          await refund.waitFor({ timeout: 15000 });
          await refund.selectOption('72');
          await page.getByText('Clients who cancel at least 3 days before their appointment get their deposit back.', { exact: false }).waitFor();
          await page.getByLabel('Reschedule notice').selectOption('168');
          if (shots) await page.locator('#deposit-refund').scrollIntoViewIfNeeded().then(() => page.screenshot({ path: `${shots}/settings.png` }));
          await page.locator('form:has(#deposit-refund) button[type="submit"]').click();
          await new Promise(r => setTimeout(r, 500));
          let saved = calls.filter(c => Array.isArray(c) && c[0] === 'profile').pop();
          assert.ok(saved, 'Settings saved');
          assert.equal(saved[1].deposit_refundable, true);
          assert.equal(saved[1].reschedule_window_hours, 72);
          assert.equal(saved[1].reschedule_notice_hours, 168);
          // Never: the deposit is kept, the notice stays as it was.
          await refund.selectOption('never');
          await page.getByText('You keep the deposit whenever the client cancels.', { exact: false }).waitFor();
          await page.locator('form:has(#deposit-refund) button[type="submit"]').click();
          await new Promise(r => setTimeout(r, 500));
          saved = calls.filter(c => Array.isArray(c) && c[0] === 'profile').pop();
          assert.equal(saved[1].deposit_refundable, false);
        }
        assert.deepEqual(errors, [], 'No page errors');
        console.log(`PASS cancellations at ${width}px`);
      } catch (e) {
        failed = true;
        console.error(`FAIL at ${width}px:`, e.message, errors);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
