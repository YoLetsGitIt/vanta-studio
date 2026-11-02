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
    if (path === '/studio/me/stripe/status') return route.fulfill({ json: { connected: false, charges_enabled: false, manual_deposits_ready: !!state.methods.payid } });
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
    // Settings: save PayID + bank, bad BSB shows an error.
    {
      const state = { methods: { payid: '', payid_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '' }, booking: { id: 'b1' } };
      const { c, page, writes, errors } = await mock(browser, 1280, state);
      await page.goto(`${base}/dashboard/settings.html?tab=payments`, { waitUntil: 'networkidle' });
      const section = page.locator('section[aria-labelledby="deposit-options-title"]');
      await section.waitFor();
      await section.getByText('No deposit payment options yet').waitFor();
      await section.getByLabel('PayID', { exact: true }).fill('bookings@ink.example');
      await section.getByLabel('Account name').fill('Ink Pty Ltd');
      await section.getByLabel('BSB').fill('06200');
      await section.getByLabel('Account number').fill('12345678');
      await section.getByRole('button', { name: 'Save payment options' }).click();
      await section.getByRole('alert').filter({ hasText: 'BSB must be 6 digits' }).waitFor();
      await section.getByLabel('BSB').fill('062000');
      await section.getByRole('button', { name: 'Save payment options' }).click();
      await section.getByRole('button', { name: 'Saved' }).waitFor();
      assert.equal(await section.getByLabel('BSB').inputValue(), '062-000');
      await section.getByText('Clients can pay by PayID or bank transfer.').waitFor();
      const put = writes.filter(w => w.path === '/studio/me/deposit-methods').pop().body;
      assert.equal(put.payid, 'bookings@ink.example');
      if (shots) await section.screenshot({ path: `${shots}/settings.png` });
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log('PASS settings: PayID + bank save, BSB validation shown');
      await c.close();
    }
    // Booking panel: mark a PayID deposit received.
    for (const width of [390, 1280]) {
      const state = {
        methods: { payid: 'bookings@ink.example' },
        booking: { id: 'b1', status: 'awaiting_payment', requester_name: 'Sam Client', requester_email: 'sam@example.test', artist_id: artistId, chosen_time: chosen, deposit_required: true, deposit_amount: 150, source: 'studio', created_at: new Date().toISOString() },
      };
      const { c, page, writes, errors } = await mock(browser, width, state);
      await page.goto(`${base}/dashboard/appointments.html?booking=b1`, { waitUntil: 'networkidle' });
      const btn = page.getByRole('button', { name: 'Mark deposit received' });
      await btn.waitFor();
      await btn.click();
      await page.getByRole('button', { name: 'Mark received' }).click();
      await page.getByText('Deposit marked as received.').waitFor();
      assert.ok(writes.some(w => w.path === '/studio/me/bookings/b1/deposit-received'));
      await page.getByRole('button', { name: 'Mark deposit received' }).waitFor({ state: 'detached' });
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS mark deposit received at ${width}px`);
      await c.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
