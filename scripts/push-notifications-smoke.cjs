// New-booking notifications in Settings → Account. Headless browsers can't reach a real
// push service, so pushManager.subscribe and the permission prompt are faked.
// Serve out/ with clean URLs on STUDIO_TEST_URL first; other services are mocked.
const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const shots = process.env.STUDIO_QA_OUTPUT;

async function withPushMocks(context, calls) {
  await context.route('**/studio/push-config', r => r.fulfill({ json: { enabled: true, public_key: 'BEX8xv_WXWT3gG5bXvxugmeJxLBDFn7N_zeaZc3lmXPTDSBR6Rbi3LvJ74Xiz42xNLaIU01d0HWqph2eHgW3Dqk' } }));
  await context.route(/\/studio\/me\/push-subscriptions/, r => { calls.push({ method: r.request().method(), path: new URL(r.request().url()).pathname, body: r.request().postDataJSON() }); return r.fulfill({ json: { ok: true } }); });
}

(async () => {
  const browser = await chromium.launch();
  try {
    // Android / desktop Chrome: turn on, send a test, turn off.
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
      await setup(context);
      const calls = [];
      await withPushMocks(context, calls);
      await context.grantPermissions(['notifications'], { origin: base });
      await context.addInitScript(() => {
        let current = null;
        const fake = { endpoint: 'https://push.example.test/device-1', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p256', auth: 'auth' } }; }, unsubscribe: async () => { current = null; return true; } };
        // Headless Chromium reports notifications as denied; behave like a user who allows them.
        let permission = 'default';
        Object.defineProperty(Notification, 'permission', { get: () => permission });
        Notification.requestPermission = async () => (permission = 'granted');
        PushManager.prototype.subscribe = async function () { current = fake; return fake; };
        PushManager.prototype.getSubscription = async function () { return current; };
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/dashboard/settings?tab=account`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('link[rel="manifest"]').getAttribute('href'), '/manifest.webmanifest');
      assert.equal((await (await page.request.get(`${base}/manifest.webmanifest`)).json()).display, 'standalone');
      await page.waitForFunction(() => navigator.serviceWorker.getRegistration('/').then(r => !!r));
      const card = page.locator('section', { has: page.getByRole('heading', { name: 'New booking notifications' }) });
      await card.getByRole('button', { name: 'Turn on notifications' }).click();
      await card.getByText('✓ On for this device').waitFor();
      const saved = calls.find(c => c.method === 'POST' && c.path.endsWith('/push-subscriptions'));
      assert.deepEqual(saved.body, { endpoint: 'https://push.example.test/device-1', keys: { p256dh: 'p256', auth: 'auth' } });
      if (shots) await card.screenshot({ path: `${shots}/push-on.png` });
      await card.getByRole('button', { name: 'Send a test' }).click();
      await card.getByRole('status').filter({ hasText: 'Test sent' }).waitFor();
      assert(calls.some(c => c.path.endsWith('/push-subscriptions/test')));
      await card.getByRole('button', { name: 'Turn off' }).click();
      await card.getByRole('button', { name: 'Turn on notifications' }).waitFor();
      assert(calls.some(c => c.method === 'DELETE'));
      assert.deepEqual(errors, []);
      console.log('PASS turn on, test and turn off notifications');
      await context.close();
    }
    // iPhone in Safari (not on the Home Screen): explain how to add it first.
    {
      const context = await browser.newContext({ ...devices['iPhone 13'] });
      await setup(context);
      await withPushMocks(context, []);
      const page = await context.newPage();
      await page.goto(`${base}/dashboard/settings?tab=account`, { waitUntil: 'networkidle' });
      const card = page.locator('section', { has: page.getByRole('heading', { name: 'New booking notifications' }) });
      await card.getByText('Add to Home Screen', { exact: false }).waitFor();
      assert.equal(await card.getByRole('button', { name: 'Turn on notifications' }).count(), 0);
      if (shots) await card.screenshot({ path: `${shots}/push-ios.png` });
      console.log('PASS iPhone Safari shows Add to Home Screen steps');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
