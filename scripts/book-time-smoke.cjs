// "Book a time": the studio books a request straight in, without the artist.
// Uses the shared dashboard fixtures; booking and stripe status are overridden.
// Serve out/ with clean URLs on STUDIO_TEST_URL first.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const shots = process.env.STUDIO_QA_OUTPUT;
const pending = { id: 'req-1', requester_name: 'Mia Chen', requester_email: 'mia@example.test', requester_phone: '+61400000001', status: 'pending', source: 'studio', body_location: 'Forearm', design_details: 'Fine line swallow', created_at: new Date().toISOString(), artist_id: '00000000-0000-0000-0000-000000000000' };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, withDeposit] of [[390, true], [1280, false]]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await setup(context);
      let booked; let current = { ...pending };
      await context.route(/\/studio\/me\/bookings(\?|$)/, r => r.fulfill({ json: { bookings: [current] } }));
      await context.route(/\/studio\/me\/bookings\/req-1$/, r => r.fulfill({ json: current }));
      await context.route(/\/stripe\/status/, r => r.fulfill({ json: { charges_enabled: false, manual_deposits_ready: true } }));
      await context.route(/\/studio\/me\/booking-management$/, r => r.fulfill({ json: { mode: 'studio' } }));
      await context.route(/\/studio\/me\/bookings\/req-1\/book-time$/, r => {
        booked = r.request().postDataJSON();
        current = { ...current, status: booked.deposit_required ? 'awaiting_payment' : 'confirmed', chosen_time: booked.chosen_time, artist_id: booked.artist_id };
        return r.fulfill({ json: { status: current.status, chosen_time: booked.chosen_time } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/dashboard/appointments?booking=req-1`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Book a time' }).click();
      const dialog = page.getByRole('dialog', { name: 'Book a time' });
      await dialog.waitFor();
      const confirm = dialog.getByRole('button', { name: /Book & / });
      assert(await confirm.isDisabled(), 'An artist is required');
      const artistSelect = dialog.getByLabel('Artist');
      await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] select[aria-label="Artist"] option').length > 1);
      await artistSelect.selectOption({ index: 1 });
      await dialog.getByLabel('Date').fill('2099-03-04');
      await dialog.getByLabel('Start time').fill('13:30');
      await dialog.getByLabel('Duration').selectOption('120');
      await dialog.getByLabel('Quote').fill('400');
      if (withDeposit) {
        await dialog.getByText('Require a deposit to lock it in').click();
        await dialog.getByLabel('Deposit amount').fill('500');
        assert(await dialog.getByRole('button', { name: 'Book & send deposit link' }).isDisabled(), 'Deposit over the quote is blocked');
        await dialog.getByLabel('Deposit amount').fill('100');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (shots) await dialog.screenshot({ path: `${shots}/book-time-${width}.png` });
      await dialog.getByRole('button', { name: withDeposit ? 'Book & send deposit link' : 'Book & confirm' }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(booked.chosen_time, new Date('2099-03-04T13:30:00').toISOString());
      assert.equal(booked.duration_minutes, 120);
      assert.equal(booked.estimated_quote, 400);
      assert.equal(booked.deposit_required, withDeposit);
      assert.equal(booked.deposit_amount, withDeposit ? 100 : null);
      assert(booked.artist_id && booked.artist_id !== pending.artist_id);
      assert.deepEqual(errors, []);
      console.log(`PASS book a time ${withDeposit ? 'with deposit' : 'without deposit'} at ${width}px`);
      await context.close();
    }
    // Artist-confirmed studios don't see "Book a time"; Settings switches it.
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await setup(context);
      let mode = 'artist'; const puts = [];
      await context.route(/\/studio\/me\/bookings(\?|$)/, r => r.fulfill({ json: { bookings: [pending] } }));
      await context.route(/\/studio\/me\/bookings\/req-1$/, r => r.fulfill({ json: pending }));
      await context.route(/\/studio\/me\/booking-management$/, r => {
        if (r.request().method() === 'PUT') { mode = r.request().postDataJSON().mode; puts.push(mode); }
        return r.fulfill({ json: { mode } });
      });
      const page = await context.newPage();
      await page.goto(`${base}/dashboard/appointments?booking=req-1`, { waitUntil: 'networkidle' });
      await page.getByText('Mia Chen').first().waitFor();
      await page.waitForTimeout(500);
      assert.equal(await page.getByRole('button', { name: 'Book a time' }).count(), 0, 'Hidden while artists confirm times');
      await page.goto(`${base}/dashboard/settings?tab=bookings`, { waitUntil: 'networkidle' });
      const card = page.locator('section', { has: page.getByRole('heading', { name: 'Who confirms booking times' }) });
      assert.equal(await card.getByRole('radio', { name: /^Artists/ }).getAttribute('aria-checked'), 'true');
      await card.getByRole('radio', { name: /^The studio/ }).click();
      await card.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
      assert.deepEqual(puts, ['studio']);
      assert.equal(await card.getByRole('radio', { name: /^The studio/ }).getAttribute('aria-checked'), 'true');
      if (shots) await card.screenshot({ path: `${shots}/booking-management.png` });
      await page.goto(`${base}/dashboard/appointments?booking=req-1`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Book a time' }).waitFor();
      console.log('PASS setting controls Book a time');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
