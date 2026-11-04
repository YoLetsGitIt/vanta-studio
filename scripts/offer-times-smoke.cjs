// "Offer times": a request with the client's weekly availability gets up to three
// times offered instead of a "choose a time" link. All services are intercepted.
// Serve out/ with clean URLs on STUDIO_TEST_URL first.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const shots = process.env.STUDIO_QA_OUTPUT;
// Mondays and Wednesdays, 9:30am–5pm.
const windows = [{ day_of_week: 1, start_time: '09:30', end_time: '17:00' }, { day_of_week: 3, start_time: '10:30', end_time: '17:00' }];
const pending = { id: 'req-1', requester_name: 'Minseo Park', requester_email: 'minseo@example.test', status: 'pending', source: 'studio', body_location: 'Arm', created_at: new Date().toISOString(), artist_id: '00000000-0000-0000-0000-000000000000', availability_windows: windows };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, withDeposit] of [[390, true], [1280, false]]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 800, hasTouch: width < 800 });
      await setup(context);
      let sent; let offer = null; let current = { ...pending };
      await context.route(/\/studio\/me\/bookings(\?|$)/, r => r.fulfill({ json: { bookings: [current] } }));
      await context.route(/\/studio\/me\/bookings\/req-1$/, r => r.fulfill({ json: current }));
      await context.route(/\/stripe\/status/, r => r.fulfill({ json: { charges_enabled: false, manual_deposits_ready: true } }));
      await context.route(/\/studio\/me\/booking-management$/, r => r.fulfill({ json: { mode: 'studio' } }));
      await context.route(/\/studio\/me\/bookings\/req-1\/offered-times$/, r => r.fulfill({ json: { offer } }));
      // The artist works Mon and Wed 9–6, has one booking coming up, and is busy at 2pm.
      await context.route(/\/artists\/[^/]+\/work-schedule$/, r => r.fulfill({ json: { schedule: [1, 3].map(d => ({ day_of_week: d, start_time: '09:00:00', end_time: '18:00:00' })) } }));
      const soon = new Date(Date.now() + 3 * 86400000); soon.setHours(11, 0, 0, 0);
      let chosenArtist = '';
      await context.route(/\/studio\/me\/schedule\?.*start=/, r => r.fulfill({ json: { entries: [{ bookingId: 'other', artistId: chosenArtist, chosenTime: soon.toISOString(), durationMins: 120, status: 'confirmed' }] } }));
      const checks = [];
      await context.route(/\/studio\/me\/bookings\/req-1\/offer-times\/check/, r => {
        const times = new URL(r.request().url()).searchParams.getAll('time');
        checks.push(times);
        return r.fulfill({ json: { times: times.map(t => new Date(t).getHours() === 14 ? { time: t, available: false, message: 'The artist is already booked then.' } : { time: t, available: true }) } });
      });
      await context.route(/\/studio\/me\/bookings\/req-1\/offer-times$/, r => {
        sent = r.request().postDataJSON();
        offer = { artist_id: sent.artist_id, artist_name: 'Sam Anderson', duration_minutes: sent.duration_minutes, deposit_amount: sent.deposit_amount, times: [...sent.times].sort(),
          email_to: 'minseo@example.test', ...(withDeposit ? { email_error: 'The to address is on the suppression list' } : { email_sent_at: new Date().toISOString(), email_status: 'delivered' }) };
        current = { ...current, status: 'awaiting_payment' }; // waiting on the client, like a sent link
        return r.fulfill({ json: { offer } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/dashboard/appointments?booking=req-1`, { waitUntil: 'networkidle' });

      // With availability, "Offer times" replaces "Send Link".
      const offerBtn = page.getByRole('button', { name: 'Offer times', exact: true });
      await offerBtn.waitFor();
      assert.equal(await page.locator('.studio-bdp-actions').getByRole('button', { name: /^Send Link$/i }).count(), 0, 'No selection link for availability requests');
      await offerBtn.click();
      const dialog = page.getByRole('dialog', { name: 'Offer times' });
      await dialog.waitFor();
      await dialog.getByRole('region', { name: "Client's weekly availability" }).getByText('Monday').waitFor();
      // The first option is prefilled with their next available day.
      const firstDate = await dialog.getByLabel('Option 1 date').inputValue();
      assert.ok([1, 3].includes(new Date(`${firstDate}T00:00:00`).getDay()), 'Prefilled on a day they are free');
      assert.equal(await dialog.getByLabel('Option 1 start time').inputValue(), new Date(`${firstDate}T00:00:00`).getDay() === 1 ? '09:30' : '10:30');
      const send = dialog.getByRole('button', { name: /^Send / });
      assert(await send.isDisabled(), 'An artist is required');
      await dialog.getByRole('status').filter({ hasText: 'Choose an artist to send these times.' }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] select[aria-label="Artist"] option').length > 1);
      chosenArtist = await dialog.getByLabel('Artist').locator('option').nth(1).getAttribute('value');
      await dialog.getByLabel('Artist').selectOption({ index: 1 });
      await dialog.getByLabel('Duration').selectOption('120');

      // The chosen artist's hours and bookings sit beside the client's availability.
      const artistPanel = dialog.getByRole('region', { name: "Artist's availability" });
      await artistPanel.getByText('Monday: 9am – 6pm, both free').waitFor({ state: 'attached' });
      assert.equal(await artistPanel.getByText(/both free/).count(), 2, 'Mon and Wed are free for both');
      assert.equal(await artistPanel.getByText(/^Booked .*11am – 1pm$/).count(), 1, 'Their booking is listed');
      // The week calendar shows the options and lets you tap a free spot to add one.
      const week = dialog.getByRole('region', { name: 'Week view' });
      await week.waitFor();
      const firstDay = (new Date(`${firstDate}T00:00:00`).getDay() + 6) % 7; // Mon = 0
      await week.locator('div[aria-hidden="true"]').nth(firstDay).click({ position: { x: 8, y: 4 * 2 * 14 + 4 } }); // 1pm on a 9am grid
      assert.equal(await dialog.getByLabel('Option 2 date').inputValue(), firstDate, 'Tapped day becomes option 2');
      assert.equal(await dialog.getByLabel('Option 2 start time').inputValue(), '13:00', 'Tapped time becomes option 2');
      if (shots) await week.screenshot({ path: `${shots}/offer-week-${width}.png` });
      await dialog.getByRole('button', { name: 'Remove option 2' }).click();
      // Each option is checked against the artist's bookings as it's picked.
      await dialog.getByText('✓ Artist is free').waitFor();
      const firstTime = await dialog.getByLabel('Option 1 start time').inputValue();
      await dialog.getByLabel('Option 1 start time').fill('14:00');
      await dialog.getByText('The artist is already booked then.').waitFor();
      assert(await send.isDisabled(), 'A taken time blocks sending');
      await dialog.getByRole('status').filter({ hasText: 'The artist isn’t free at one of these times.' }).waitFor();
      await dialog.getByLabel('Option 1 start time').fill(firstTime);
      await dialog.getByText('✓ Artist is free').waitFor();
      assert.ok(checks.length >= 2, 'Times are checked live');

      // Up to three options; a time outside their availability is flagged, a duplicate blocks sending.
      await dialog.getByRole('button', { name: '+ Add another time' }).click();
      await dialog.getByRole('button', { name: '+ Add another time' }).click();
      assert.equal(await dialog.getByRole('button', { name: '+ Add another time' }).count(), 0, 'Three at most');
      await dialog.getByLabel('Option 3 date').fill('2099-03-07'); // a Saturday
      await dialog.getByLabel('Option 3 start time').fill('12:00');
      await dialog.getByText('Outside their availability and the artist’s hours.').waitFor();
      await dialog.getByLabel('Option 2 date').fill(firstDate);
      await dialog.getByLabel('Option 2 start time').fill(await dialog.getByLabel('Option 1 start time').inputValue());
      await dialog.getByText('Same as another option.').waitFor();
      assert(await send.isDisabled(), 'Duplicates block sending');
      await dialog.getByRole('status').filter({ hasText: 'Two options are the same time.' }).waitFor();
      await dialog.getByRole('button', { name: 'Remove option 2' }).click();
      assert.equal(await dialog.getByLabel('Option 3 date').count(), 0);

      await dialog.getByLabel('Quote').fill('400');
      if (withDeposit) {
        await dialog.getByText('Require a deposit to lock it in').click();
        await dialog.getByLabel('Deposit amount').fill('80');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No sideways scroll');
      if (shots) await dialog.screenshot({ path: `${shots}/offer-times-${width}.png` });
      await dialog.getByRole('button', { name: 'Send 2 times' }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(sent.times.length, 2);
      assert.equal(sent.times[1], new Date('2099-03-07T12:00:00').toISOString());
      assert.equal(sent.duration_minutes, 120);
      assert.equal(sent.estimated_quote, 400);
      assert.equal(sent.deposit_required, withDeposit);
      assert.equal(sent.deposit_amount, withDeposit ? 80 : null);

      // The panel shows the offered times while the client chooses.
      const offered = page.getByRole('list', { name: 'Offered times' });
      await offered.waitFor();
      assert.equal(await offered.getByRole('listitem').count(), 2);
      await page.getByText(/Times offered · waiting for Minseo to choose/).waitFor();
      await page.getByText(withDeposit ? '2 hrs · Sam Anderson · $80.00 deposit to confirm' : '2 hrs · Sam Anderson', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Edit times', exact: true }).waitFor();
      // The studio can see whether the email went out.
      if (withDeposit) {
        await page.getByText('Times saved, but the email didn’t send: The to address is on the suppression list').waitFor();
        await page.getByRole('alert').filter({ hasText: 'Use Edit times to send it again' }).waitFor();
      }
      else await page.getByText(/^Emailed to minseo@example\.test · .* · Delivered$/).waitFor();
      if (shots) await page.screenshot({ path: `${shots}/offer-times-panel-${width}.png` });
      // Reopened later in Awaiting payment: still shows the offer and can be edited, no "Resend link".
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('list', { name: 'Offered times' }).waitFor();
      await page.getByRole('button', { name: 'Edit times', exact: true }).waitFor();
      assert.equal(await page.locator('.studio-bdp-actions').getByRole('button', { name: /link/i }).count(), 0, 'No resend link for an offer');
      assert.deepEqual(errors, []);
      // A request that was already sent a "choose a time" link offers times too, not "Resend Link".
      offer = null; current = { ...pending, status: 'awaiting_payment' };
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Offer times', exact: true }).waitFor();
      assert.equal(await page.locator('.studio-bdp-actions').getByRole('button', { name: /link/i }).count(), 0, 'No resend link once availability is known');
      console.log(`PASS offer times ${withDeposit ? 'with deposit' : 'without deposit'} at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
