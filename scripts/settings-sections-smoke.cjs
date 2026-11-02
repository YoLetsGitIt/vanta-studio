// Settings sections: desktop tabs, the phone list with Back, and old ?tab=bookings links.
// Uses the shared dashboard fixtures. Serve out/ with clean URLs on STUDIO_TEST_URL first.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const expected = {
  studio: ['Profile', 'Hours', 'Stations'],
  requests: ['Who confirms booking times', 'Booking form'],
  walkins: ['Walk-in form'],
  consent: [],
  messages: ['Emails'],
  payments: ['Deposit payment options'],
  account: ['New booking notifications'],
};

(async () => {
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setup(desktop);
    const page = await desktop.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const [tab, heads] of Object.entries(expected)) {
      await page.goto(`${base}/dashboard/settings?tab=${tab}`, { waitUntil: 'networkidle' });
      const found = await page.locator('section h2').allInnerTexts();
      for (const h of heads) assert(found.some(f => f.toLowerCase() === h.toLowerCase()), `${tab}: missing "${h}" in ${found}`);
    }
    // Stations moved to Studio; walk-ins and consent are no longer on Booking requests.
    await page.goto(`${base}/dashboard/settings?tab=requests`, { waitUntil: 'networkidle' });
    const requests = (await page.locator('section h2').allInnerTexts()).map(h => h.toLowerCase());
    assert(!requests.includes('stations') && !requests.includes('walk-in form') && !requests.includes('emails'));
    // Old links still land on the right place.
    await page.goto(`${base}/dashboard/settings?tab=bookings`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(), 'Booking requests');
    await page.getByRole('tab', { name: 'Walk-ins' }).click();
    await page.waitForURL(/tab=walkins/);
    assert.deepEqual(errors, []);
    console.log('PASS desktop settings tabs and legacy links');
    await desktop.close();

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await setup(phone);
    const p = await phone.newPage();
    await p.goto(`${base}/dashboard/settings`, { waitUntil: 'networkidle' });
    const list = p.getByRole('navigation', { name: 'Settings sections' });
    await list.waitFor();
    assert.equal(await list.getByRole('button').count(), 7);
    assert.equal(await p.locator('.studio-settings-page section').count(), 0, 'Only the list shows until a section is chosen');
    await list.getByRole('button', { name: /^Client messages/ }).click();
    await p.getByRole('heading', { name: 'Client messages', level: 1 }).waitFor();
    assert(/tab=messages/.test(p.url()));
    await p.getByRole('button', { name: /Settings$/ }).click();
    await list.waitFor();
    assert(!/tab=/.test(p.url()));
    await p.goForward(); await p.getByRole('heading', { name: 'Client messages', level: 1 }).waitFor();
    console.log('PASS phone settings list, sections and Back');
    await phone.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
