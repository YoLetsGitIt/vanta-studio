// Build the studio (out/) and serve it on 3029 first. All backend calls are mocked.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const shots = process.env.VANTA_SCREENSHOT_DIR;
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.test', role: 'authenticated', aud: 'authenticated', user_metadata: {} };
const auth = { access_token: 't', refresh_token: 'r', expires_at: 2000000000, expires_in: 3600, token_type: 'bearer', user };
const studio = { id: 'test-studio', name: 'Ink Studio', timezone: 'Australia/Melbourne', subscription_status: 'active' };
const artistId = '11111111-1111-4111-8111-111111111111';
const chosen = new Date(Date.now() + 5 * 86400000).toISOString();

async function mock(browser, width, state) {
  const c = await browser.newContext({ viewport: { width, height: 1000 } });
  await c.addInitScript(session => {
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify(session));
    localStorage.setItem(`vanta-studio-tour:${session.user.id}`, 'complete');
  }, auth);
  const writes = [];
  await c.route('**/*', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (url.origin === new URL(base).origin) return route.continue();
    const body = (() => { try { return req.postDataJSON(); } catch { return null; } })();
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS') writes.push({ method: req.method(), path, body });
    if (path === '/studio/me/deposit-methods' && req.method() === 'PUT') {
      if (body.bank_bsb && body.bank_bsb.replace(/\D/g, '').length !== 6) return route.fulfill({ status: 400, json: { error: 'BSB must be 6 digits' } });
      state.methods = { ...body, bank_bsb: body.bank_bsb ? body.bank_bsb.replace(/\D/g, '').replace(/^(\d{3})(\d{3})$/, '$1-$2') : '' };
      return route.fulfill({ json: state.methods });
    }
    if (path === '/studio/me/deposit-methods') return route.fulfill({ json: state.methods });
    if (path === '/studio/me/stripe/status') return route.fulfill({ json: { connected: true, charges_enabled: true, details_submitted: true, payouts_enabled: true, card_enabled: true } });
    if (path.endsWith('/deposit-received')) { state.booking = { ...state.booking, status: 'confirmed', deposit_paid_at: new Date().toISOString(), deposit_confirmed_at: new Date().toISOString() }; return route.fulfill({ json: { status: 'confirmed', deposit_paid: true } }); }
    if (path.endsWith('/sms')) return route.fulfill({ json: { opt_in: false, opted_out: false, delivery: { status: 'not_sent' } } });
    if (path === `/studio/me/bookings/${state.booking.id}`) return route.fulfill({ json: state.booking });
    if (path === '/studio/me/bookings') return route.fulfill({ json: { bookings: [state.booking], next_cursor: null } });
    if (path === '/studio/me') return route.fulfill({ json: { status: 'approved', studio_id: studio.id, studio } });
    if (path === '/auth/v1/user') return route.fulfill({ json: user });
    if (path.endsWith('/artists')) return route.fulfill({ json: { artists: [{ artistId, artist_id: artistId, name: 'Jo', status: 'approved' }] } });
    if (path.endsWith('/clients')) return route.fulfill({ json: { clients: [] } });
    if (path.endsWith('/stations')) return route.fulfill({ json: { stations: [] } });
    if (req.method() !== 'GET') return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });
  const page = await c.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  return { c, page, writes, errors };
}

(async () => {
  const browser = await chromium.launch();
  try {
    const state = { methods: { payid: 'bookings@ink.example', payid_name: 'Ink Studio', bank_account_name: '', bank_bsb: '', bank_account_number: '', payid_enabled: true, bank_enabled: false, card_enabled: true }, booking: { id: 'b1' } };
    const { c, page, errors } = await mock(browser, 1100, state);
    await page.goto(`${base}/dashboard/settings?tab=payments`, { waitUntil: 'networkidle' });
    const section = page.locator('section[aria-labelledby="deposit-options-title"]');
    try { await section.waitFor({ timeout: 12000 }); } catch (e) {
      await page.screenshot({ path: `${shots}/settings-debug.png` });
      console.log('URL', page.url(), '| TEXT', (await page.innerText('body')).slice(0, 400).replace(/\n/g, ' / '), '| ERR', errors.join(';'));
      throw e;
    }
    await section.getByText('Clients pay deposits through Vanta.').waitFor();
    await section.getByText('Vanta booking fee, paid by the client').waitFor();
    await section.getByRole('note').waitFor();
    const text = await section.innerText();
    for (const banned of ['card fee', 'processing', 'surcharge']) assert.ok(!text.toLowerCase().includes(banned), `settings still says "${banned}"`);
    await section.screenshot({ path: `${shots}/settings-vanta.png` });
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS settings: through Vanta, own details kept but not shown');
    await c.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
