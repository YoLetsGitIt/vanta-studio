// The dashboard tour shows once, ever: the first sign-in shows it and records it on the
// account at once (Supabase user metadata, lib/guides), so another browser, a private window
// or a cleared one doesn't show it again, and closing it part way still counts. A record
// only in this browser (from before) is copied onto the account. ?tour=1 still replays it.
// No real services: the fixtures answer everything.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3036';
const USER = '22222222-2222-4222-8222-222222222222';

async function open({ metadata, local, query = '' }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setup(context);
  // A different person from the fixtures' returning studio.
  await context.addInitScript(([metadata, local, id]) => {
    if (window !== window.top) return;
    const user = { id, email: 'studio@example.test', user_metadata: metadata };
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: 2000000000, user }));
    if (local) localStorage.setItem(`vanta-studio-tour:${id}`, 'complete'); else localStorage.removeItem(`vanta-studio-tour:${id}`);
  }, [metadata, local, USER]);
  const saved = [];
  await context.route('**/auth/v1/user', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      saved.push(body.data);
      return route.fulfill({ json: { id: USER, email: 'studio@example.test', user_metadata: { ...metadata, ...body.data } } });
    }
    return route.fallback();
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/dashboard/schedule${query}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const shown = await page.getByRole('dialog', { name: 'Dashboard tour' }).isVisible();
  await context.close();
  assert.deepEqual(errors, []);
  return { shown, saved };
}

let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE });
  try {
    const first = await open({ metadata: {}, local: false });
    assert.equal(first.shown, true, 'A brand new studio sees the tour');
    assert.ok(first.saved.some(data => data?.studio_tour_seen), 'Showing it records it on the account straight away');

    const elsewhere = await open({ metadata: { studio_tour_seen: '2026-11-28T00:00:00Z' }, local: false });
    assert.equal(elsewhere.shown, false, 'Seen on the account: not again in another browser');
    assert.equal(elsewhere.saved.length, 0, 'Nothing more to save');

    const before = await open({ metadata: {}, local: true });
    assert.equal(before.shown, false, 'Seen in this browser before: not again');
    assert.ok(before.saved.some(data => data?.studio_tour_seen), 'And it is copied onto the account');

    const replay = await open({ metadata: { studio_tour_seen: '2026-11-28T00:00:00Z' }, local: true, query: '?tour=1' });
    assert.equal(replay.shown, true, '?tour=1 still replays it');
    console.log('PASS the tour shows once ever (account record, browser record copied, replay link)');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
