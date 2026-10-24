// Isolated browser checks: every external request is mocked, including OAuth.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');

const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';
const routePath = process.env.STUDIO_CONSENT_PATH || '/consent';
const output = process.env.STUDIO_TEST_OUTPUT || '../artifacts/consent-social-2026-10-22';
const studioId = 'local-studio';
const errors = [], unexpected = [], results = [];
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'client@example.test', user_metadata: { full_name: 'Local Client' } };
const session = { access_token: 'local-test-token', refresh_token: 'local-refresh-token', expires_at: 2000000000, user };

async function open(browser, { width = 390, signedIn = false, newProfile = false, metadata = user.user_metadata, profile = { name: 'Local Client' }, suffix = '' } = {}) {
  const mockUser = { ...user, user_metadata: { ...metadata } };
  const mockSession = { ...session, user: mockUser };
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 1000, hasTouch: width < 1000, locale: 'en-AU' });
  const calls = { authorizations: [], profiles: [], consents: [], updates: [], logouts: 0 };
  let profileExists = !newProfile;
  if (signedIn) await context.addInitScript(value => {
    if (!sessionStorage.getItem('test-session-seeded')) {
      localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify(value));
      sessionStorage.setItem('test-session-seeded', 'true');
    }
  }, mockSession);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === new URL(base).origin && request.method() === 'GET') return route.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/public')) return route.fulfill({ json: { name: 'Vanta Studio' }, headers });
    if (url.pathname.endsWith('/consent-templates')) return route.fulfill({ json: { templates: [] }, headers });
    if (url.pathname === '/auth/v1/logout') {
      calls.logouts++;
      assert.equal(url.searchParams.get('scope'), 'local');
      return route.fulfill({ status: 204, headers });
    }
    if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') calls.updates.push(request.postDataJSON());
      return route.fulfill({ json: mockUser, headers });
    }
    if (url.pathname === `/studios/${studioId}/consent`) {
      assert.equal(request.headers().authorization, 'Bearer local-test-token');
      calls.consents.push(request.postDataJSON());
      return route.fulfill({ json: { ok: true }, headers });
    }
    if (url.pathname === '/auth/users/me') {
      if (request.method() === 'POST') {
        calls.profiles.push(request.postDataJSON());
        profileExists = true;
      }
      return route.fulfill({ status: profileExists ? 200 : 404, json: profileExists ? profile : {}, headers });
    }
    if (url.pathname === '/auth/v1/authorize') {
      calls.authorizations.push({ provider: url.searchParams.get('provider'), redirectTo: url.searchParams.get('redirect_to'), document: request.resourceType() === 'document' });
      if (request.resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: '<h1>Mock provider sign-in</h1>', headers });
      return route.fulfill({ status: url.searchParams.get('provider') === 'apple' ? 400 : 200, json: {}, headers });
    }
    unexpected.push({ method: request.method(), path: url.pathname });
    return route.fulfill({ status: 400, json: { error: 'External request blocked by local test' }, headers });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}${routePath}?s=${studioId}${suffix}`, { waitUntil: 'networkidle' });
  await page.getByRole(signedIn ? 'button' : 'heading', { name: signedIn ? 'Submit consent' : 'Create an account', exact: true }).waitFor();
  return { context, page, calls };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    for (const width of [320, 390, 1280]) {
      const { context, page } = await open(browser, { width });
      const apple = page.getByRole('button', { name: 'Continue with Apple', exact: true });
      const google = page.getByRole('button', { name: 'Continue with Google', exact: true });
      assert.equal(await apple.isVisible(), true);
      assert.equal(await google.isVisible(), true);
      for (const button of [apple, google]) assert.ok((await button.boundingBox()).height >= 48);
      assert.ok((await google.boundingBox()).y < (await page.getByPlaceholder('Full name', { exact: true }).boundingBox()).y);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/signup-${width}.png` });
      const emailSubmit = page.getByRole('button', { name: 'Create account & continue', exact: true });
      await emailSubmit.scrollIntoViewIfNeeded();
      const submitBox = await emailSubmit.boundingBox();
      assert.ok(submitBox.y >= 0 && submitBox.y + submitBox.height <= 900);
      await page.screenshot({ path: `${output}/signup-footer-${width}.png` });
      await page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
      assert.equal(await apple.isVisible(), true);
      assert.equal(await google.isVisible(), true);
      assert.equal(await page.getByPlaceholder('Full name', { exact: true }).count(), 0);
      await page.screenshot({ path: `${output}/signin-${width}.png`, fullPage: true });
      results.push(`Signup and sign-in layout: ${width}px`);
      await context.close();
    }

    {
      const { context, page, calls } = await open(browser);
      await page.getByPlaceholder('Full name', { exact: true }).fill('Keep My Details');
      await page.getByRole('button', { name: 'Continue with Apple', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Apple sign-in is temporarily unavailable' }).waitFor();
      assert.equal(await page.getByPlaceholder('Full name', { exact: true }).inputValue(), 'Keep My Details');
      assert.equal(await page.getByRole('button', { name: 'Create account & continue', exact: true }).isEnabled(), true);
      assert.equal(calls.authorizations.length, 1);
      assert.equal(calls.authorizations[0].redirectTo, `${new URL(base).origin}/consent?s=${studioId}`);
      await page.screenshot({ path: `${output}/apple-unavailable.png`, fullPage: true });
      await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
      await page.getByRole('heading', { name: 'Mock provider sign-in', exact: true }).waitFor();
      assert.equal(calls.authorizations.filter(call => call.provider === 'google').length, 2);
      assert.equal(calls.authorizations.find(call => call.provider === 'google').redirectTo, `${new URL(base).origin}/consent?s=${studioId}`);
      results.push('Apple failure preserves email form; Google starts OAuth with studio return URL');
      await context.close();
    }

    {
      const { context, page } = await open(browser, { suffix: '#error=access_denied&error_description=Cancelled' });
      await page.getByRole('alert').filter({ hasText: 'Sign-in was not completed' }).waitFor();
      const returned = new URL(page.url());
      assert.equal(returned.hash, '');
      assert.equal(returned.searchParams.get('s'), studioId);
      results.push('Cancelled sign-in reports error and preserves studio context');
      await context.close();
    }

    for (const newProfile of [false, true]) {
      const { context, page, calls } = await open(browser, { signedIn: true, newProfile });
      assert.equal(await page.getByRole('button', { name: 'Continue with Google', exact: true }).count(), 0);
      const dob = page.getByLabel('Date of birth', { exact: true });
      assert.equal(await page.getByPlaceholder('Your name', { exact: true }).inputValue(), 'Local Client');
      assert.equal(await dob.isVisible(), true);
      assert.equal(await page.getByPlaceholder('Your phone number', { exact: true }).isVisible(), true);
      await dob.fill('1995-06-15');
      await page.getByPlaceholder('Your phone number', { exact: true }).fill('+61412345678');
      assert.equal(calls.profiles.length, newProfile ? 1 : 0);
      if (newProfile) assert.deepEqual(calls.profiles[0], { name: 'Local Client', accountType: 'user', termsAcceptedVersion: '1.0' });
      results.push(`${newProfile ? 'New' : 'Returning'} social account shows saved name and editable missing DOB and phone`);
      await context.close();
    }

    for (const width of [320, 390, 1280]) {
      const { context, page, calls } = await open(browser, {
        width, signedIn: true,
        metadata: { full_name: 'Account Name', dob: '1990-01-01', phone: '+61400123456' },
        profile: { name: 'Local Client', phone: '+61412345678' },
      });
      const name = page.getByLabel('Full name', { exact: false });
      const dob = page.getByLabel('Date of birth', { exact: true });
      const phone = page.getByLabel('Phone number', { exact: false });
      const email = page.getByLabel('Email', { exact: true });
      for (const field of [name, dob, phone, email]) assert(await field.isVisible(), 'Known details remain visible');
      assert.equal(await name.inputValue(), 'Local Client');
      assert.equal(await dob.inputValue(), '1990-01-01');
      const matchingDateStyle = await dob.evaluate(input => {
        const name = document.querySelector('input[autocomplete="name"]');
        const own = getComputedStyle(input), other = getComputedStyle(name);
        return input.offsetHeight === name.offsetHeight && own.font === other.font && own.border === other.border && own.padding === other.padding;
      });
      assert(matchingDateStyle, 'Date field matches the name field on mobile and desktop');
      assert.equal(await phone.inputValue(), '+61412345678');
      assert.equal(await email.inputValue(), user.email);
      assert(await email.evaluate(input => input.readOnly));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/prefilled-consent-${width}.png`, fullPage: true });
      await name.fill('Reviewed Client');
      await dob.fill('1991-02-03');
      await phone.fill('+61498765432');
      await page.getByRole('button', { name: 'Submit consent', exact: true }).click();
      await page.getByRole('heading', { name: 'Consent recorded', exact: true }).waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(calls.consents.length, 1);
      assert.equal(calls.consents[0].signer_name, 'Reviewed Client');
      assert.equal(calls.consents[0].dob, '1991-02-03');
      assert.equal(calls.consents[0].phone, '+61498765432');
      assert.equal(calls.updates.at(-1).data.full_name, 'Reviewed Client');
      results.push(`Complete account: all details visible, prefilled, editable and submitted correctly at ${width}px`);
      await context.close();
    }

    {
      const { context, page, calls } = await open(browser, { signedIn: true });
      const before = page.url();
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      await page.getByRole('heading', { name: 'Create an account', exact: true }).waitFor();
      assert.equal(page.url(), before);
      assert.equal(await page.getByRole('button', { name: 'Submit consent', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Log out', exact: true }).count(), 0);
      assert.equal(calls.logouts, 1);
      assert.equal(calls.consents.length, 0);
      results.push('Consent logout returns to signup/login at the same studio QR link');
      await context.close();
    }

    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    fs.writeFileSync(`${output}/results.json`, JSON.stringify({ results, errors, unexpected }, null, 2));
    console.log(results.join('\n'));
    console.log('All consent social sign-in checks passed; no requests reached external services.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
