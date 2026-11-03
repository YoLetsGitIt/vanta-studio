// Settings → Client messages → Email sender: one sender for booking emails, reminders and
// marketing. All requests are mocked; nothing is saved live.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 800, hasTouch: width < 800 });
      await setup(context);
      let settings = { from_name: 'Northside Studio', reply_to: 'studio@example.test', sender_provider: 'resend', footer_address: '', domain: '', domain_status: '' };
      const saves = [];
      await context.route('**/studio/me', route => route.fulfill({ json: { status: 'approved', studio_id: 'test-studio', studio: { name: 'Northside Studio', subscription_status: 'active', timezone: 'Australia/Melbourne' } } }));
      await context.route('**/studio/me/marketing', route => route.fulfill({ json: { available: true, ready: true, domain_available: true, settings,
        stats: { consented_clients: 0, sent_this_month: 0, unsubscribed: 0, failed_this_month: 0 },
        sender_error: "Couldn't send from your Gmail: token revoked", sender_error_at: new Date().toISOString() } }));
      await context.route('**/studio/me/marketing/settings', route => {
        const body = route.request().postDataJSON(); saves.push(body); settings = { ...settings, ...body };
        return route.fulfill({ json: { settings, ready: true } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/dashboard/settings?tab=messages', { waitUntil: 'networkidle' });
      const card = page.locator('#email-sender');
      await card.getByRole('heading', { name: 'Email sender', exact: true }).waitFor();
      await card.getByText(/booking confirmations, offered times, reminders, consent links and marketing/).waitFor();
      // A failed mailbox send is explained, with the fallback that kept clients emailed.
      await card.getByRole('alert').filter({ hasText: /token revoked.*Vanta’s address instead/ }).waitFor();
      await card.getByText('Vanta’s shared address, with replies going to studio@example.test', { exact: false }).waitFor();
      // It comes before the reminder switches on the same tab.
      const order = await page.evaluate(() => {
        const sender = document.querySelector('#email-sender');
        const emails = [...document.querySelectorAll('h2')].find(h => h.textContent.trim() === 'Emails');
        return Boolean(sender && emails && (sender.compareDocumentPosition(emails) & Node.DOCUMENT_POSITION_FOLLOWING));
      });
      assert.equal(order, true, 'sender card leads the Client messages tab');
      // Saving uses the shared sender setting.
      await card.getByLabel('Reply-to email').fill('bookings@northside.test');
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByText('Sender settings saved.').waitFor();
      assert.equal(saves.length, 1);
      assert.equal(saves[0].reply_to, 'bookings@northside.test');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
      assert.deepEqual(errors, []);
      console.log(`PASS email sender in settings at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
