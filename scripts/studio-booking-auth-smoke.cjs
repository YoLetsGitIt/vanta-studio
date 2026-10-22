// Only local HTML is loaded. Identity, profile and booking endpoints are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3056';
const output = process.env.STUDIO_REVIEW_OUTPUT || '/private/tmp/vanta-studio-booking-auth-review';
const storageKey = 'sb-aznxvdnpvbcofaqxgmtu-auth-token';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'client@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: 'Jamie Client', dob: '1990-01-01', phone: '+61400123456' } };
const session = { access_token: 'local-access-token', refresh_token: 'local-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };
const studio = { id: 'test-studio', name: 'Test Tattoo Studio', artists: [] };

async function open(browser, { width = 390, signedIn = false, confirmation = false, profileFailure = false, profileMissing = false, path = '/studio-booking', suffix = '' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  if (signedIn) await context.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), { storageKey, session });
  const calls = { bookings: [], profiles: [], signups: [], providers: [], profileReads: 0 };
  const errors = [];
  let hasProfile = !profileMissing;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === new URL(base).origin) return route.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/public')) return route.fulfill({ json: studio, headers });
    if (url.pathname.endsWith('/form-config')) return route.fulfill({ json: { fields: {} }, headers });
    if (url.pathname.endsWith('/consent-templates')) return route.fulfill({ json: { templates: [] }, headers });
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session, headers });
    if (url.pathname === '/auth/v1/signup') {
      calls.signups.push({ body: request.postDataJSON(), redirectTo: url.searchParams.get('redirect_to') });
      return route.fulfill({ json: confirmation ? user : session, headers });
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user, headers });
    if (url.pathname === '/auth/users/me') {
      assert.equal(request.headers().authorization, 'Bearer local-access-token');
      if (request.method() === 'POST') { calls.profiles.push(request.postDataJSON()); hasProfile = true; }
      else calls.profileReads++;
      if (profileFailure && calls.profileReads === 1) return route.fulfill({ status: 503, json: { error: 'Account temporarily unavailable' }, headers });
      return route.fulfill({ status: hasProfile ? 200 : 404, json: hasProfile ? { name: 'Jamie Client', phone: '+61400123456' } : {}, headers });
    }
    if (url.pathname.endsWith('/client-booking')) {
      assert.equal(request.headers().authorization, 'Bearer local-access-token');
      calls.bookings.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: { id: 'test-booking' }, headers });
    }
    if (url.pathname === '/auth/v1/authorize') {
      calls.providers.push({ provider: url.searchParams.get('provider'), redirectTo: url.searchParams.get('redirect_to') });
      if (url.searchParams.get('provider') === 'apple') return route.fulfill({ status: 400, json: { error: 'Provider unavailable' }, headers });
      return route.fulfill({ headers, contentType: 'text/html', body: '<h1>Mock Google sign-in</h1>' });
    }
    throw new Error(`Unexpected external call: ${request.method()} ${url.pathname}`);
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}${path}?s=${studio.id}${suffix}`, { waitUntil: 'networkidle' });
  return { context, page, calls, errors };
}

async function signIn(page) {
  await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await page.getByPlaceholder('Email', { exact: true }).fill(user.email);
  await page.getByPlaceholder('Password', { exact: true }).fill('example-password');
  await page.getByRole('button', { name: 'Sign in & continue' }).click();
  await page.getByRole('button', { name: 'Request booking', exact: true }).waitFor();
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const results = [];
  try {
    for (const width of [320, 390, 1280]) {
      const { context, page, calls, errors } = await open(browser, { width });
      await page.getByRole('heading', { name: 'Create an account' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Request booking', exact: true }).count(), 0, 'Anonymous visitors cannot use the booking form');
      assert.equal(calls.bookings.length, 0);
      assert(await page.getByText('before requesting a booking.', { exact: false }).isVisible());
      assert.equal(await page.getByRole('button', { name: 'Continue with Apple' }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Continue with Google' }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/signup-${width}.png`, fullPage: true });
      await signIn(page);
      assert.equal(await page.getByPlaceholder('First', { exact: true }).inputValue(), 'Jamie');
      assert.equal(await page.getByPlaceholder('Last', { exact: true }).inputValue(), 'Client');
      assert.equal(await page.getByPlaceholder('you@example.com').inputValue(), user.email);
      assert(await page.getByPlaceholder('you@example.com').evaluate(input => input.readOnly));
      assert.equal(await page.locator('input[type="date"]').inputValue(), '1990-01-01');
      assert.equal(await page.locator('input[type="tel"]').inputValue(), '400123456');
      await page.getByRole('button', { name: 'Forearm', exact: true }).click();
      await page.locator('textarea').first().fill('Botanical forearm piece');
      await page.getByRole('button', { name: 'Request booking', exact: true }).click();
      await page.getByRole('heading', { name: "You're on the list!" }).waitFor();
      assert.equal(calls.bookings.length, 1);
      assert.equal(calls.bookings[0].email, user.email);
      assert.equal(calls.bookings[0].name, 'Jamie Client');
      assert.equal(calls.bookings[0].sms_reminder_opt_in, false, 'Booking does not silently opt in to messages');
      assert.deepEqual(errors, []);
      results.push(`Anonymous gate, login, profile prefill and authenticated booking: ${width}px`);
      await context.close();
    }
    {
      const { context, page, calls, errors } = await open(browser, { profileMissing: true });
      await page.getByPlaceholder('Full name').fill('Jamie Client');
      await page.locator('input[type="date"]').fill('1990-01-01');
      await page.getByPlaceholder('Phone number').fill('+61400123456');
      await page.getByPlaceholder('Email', { exact: true }).fill(user.email);
      await page.getByPlaceholder('Password').fill('example-password');
      await page.getByRole('button', { name: 'Create account & continue' }).click();
      await page.getByRole('alert').filter({ hasText: 'You must agree' }).waitFor();
      assert.equal(calls.signups.length, 0);
      await page.getByRole('checkbox', { name: /I agree/ }).check();
      await page.getByRole('button', { name: 'Create account & continue' }).click();
      await page.getByRole('button', { name: 'Request booking', exact: true }).waitFor();
      assert.equal(calls.signups.length, 1);
      assert.equal(calls.signups[0].redirectTo, `${base}/studio-booking?s=${studio.id}`);
      assert.equal(calls.signups[0].body.data.dob, '1990-01-01');
      assert(calls.profiles.length >= 1, 'New accounts receive a Vanta profile');
      assert.equal(calls.bookings.length, 0, 'Account creation does not submit a booking');
      assert.deepEqual(errors, []);
      results.push('New account: terms, profile creation and return to the same studio');
      await context.close();
    }
    {
      const { context, page, calls } = await open(browser, { confirmation: true });
      await page.getByPlaceholder('Full name').fill('Jamie Client');
      await page.locator('input[type="date"]').fill('1990-01-01');
      await page.getByPlaceholder('Phone number').fill('+61400123456');
      await page.getByPlaceholder('Email', { exact: true }).fill(user.email);
      await page.getByPlaceholder('Password').fill('example-password');
      await page.getByRole('checkbox', { name: /I agree/ }).check();
      await page.getByRole('button', { name: 'Create account & continue' }).click();
      await page.getByText('Check your email to confirm your account, then return to this page to continue.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Request booking', exact: true }).count(), 0);
      assert.equal(calls.bookings.length, 0);
      results.push('Email confirmation required: booking stays locked');
      await context.close();
    }
    {
      const { context, page, calls } = await open(browser, { signedIn: true, profileFailure: true });
      await page.getByRole('alert').filter({ hasText: 'Account temporarily unavailable' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Request booking', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('button', { name: 'Request booking', exact: true }).waitFor();
      assert.equal(calls.bookings.length, 0);
      await page.getByPlaceholder('First', { exact: true }).fill('Edited Jamie');
      await page.evaluate(storageKey => {
        localStorage.removeItem(storageKey);
        const channel = new BroadcastChannel(storageKey);
        channel.postMessage({ event: 'SIGNED_OUT', session: null });
        channel.close();
      }, storageKey);
      await page.getByRole('heading', { name: 'Create an account' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Request booking', exact: true }).count(), 0);
      await signIn(page);
      assert.equal(await page.getByPlaceholder('First', { exact: true }).inputValue(), 'Edited Jamie', 'Same-account reauthentication preserves form edits');
      results.push('Returning session, profile retry, sign-out and reauthentication');
      await context.close();
    }
    for (const path of ['/studio-booking', '/studio-booking.html']) {
      const { context, page, calls } = await open(browser, { path });
      await page.getByRole('button', { name: 'Continue with Apple' }).click();
      await page.getByRole('alert').filter({ hasText: 'Apple sign-in is temporarily unavailable' }).waitFor();
      assert.equal(calls.providers[0].redirectTo, `${base}/studio-booking?s=${studio.id}`);
      await page.getByRole('button', { name: 'Continue with Google' }).click();
      await page.getByRole('heading', { name: 'Mock Google sign-in' }).waitFor();
      assert(calls.providers.every(call => call.redirectTo === `${base}/studio-booking?s=${studio.id}`));
      results.push(`Provider fallback and studio return URL: ${path}`);
      await context.close();
    }
    {
      const { context, page } = await open(browser, { suffix: '&error=access_denied&error_description=Cancelled' });
      await page.getByRole('alert').filter({ hasText: 'Sign-in was not completed' }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('s'), studio.id);
      assert.equal(new URL(page.url()).searchParams.has('error'), false);
      results.push('Cancelled social sign-in keeps the studio link');
      await context.close();
    }
    console.log(results.map(result => `PASS ${result}`).join('\n'));
    fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
