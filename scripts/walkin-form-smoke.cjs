// Walk-in form (/walkin?s=<studio>): no sign-in, choose an artist, basics + the studio's
// chosen extras + consent, booked in straight away. All services are mocked.
// Serve out/ with clean URLs first.
const assert = require('node:assert/strict');
// Date of birth is three dropdowns (day, month, year).
const fillDob = async (page, iso) => { const [y, m, d] = iso.split('-'); const g = page.getByRole('group', { name: 'Date of birth' }).first(); await g.getByLabel('Day of birth').selectOption(String(+d)); await g.getByLabel('Month of birth').selectOption(String(+m)); await g.getByLabel('Year of birth').selectOption(y); };
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3056';
const shots = process.env.STUDIO_REVIEW_OUTPUT;
const artistId = '33333333-3333-4333-8333-333333333333';
const studio = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Tattoo Studio', artists: [{ artistId, name: 'Sam Rivers' }, { artistId: '44444444-4444-4444-8444-444444444444', name: 'Jo Lake' }] };
const template = { id: 'tmpl-1', name: 'Walk-in consent', requires_signature: false, fields: [{ id: 'healthy', type: 'yesno', label: 'Are you feeling well today?', required: true }] };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      const posts = []; let busy = width === 390;
      await context.route('**/*', route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === new URL(base).origin) return route.continue();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/public')) return route.fulfill({ json: studio, headers });
        if (url.pathname.endsWith('/walkin-form-config')) return route.fulfill({ json: { fields: { body_location: { enabled: true, required: true }, design_details: { enabled: false, required: false } } }, headers });
        if (url.pathname.endsWith('/form-config')) throw new Error('Walk-in must not use the booking form config');
        // Walk-ins get every studio consent form (?all=1), not only the booking-widget one, which this studio never chose.
        if (url.pathname.endsWith('/consent-templates')) return route.fulfill({ json: { templates: url.searchParams.get('all') === '1' ? [template] : [] }, headers });
        if (url.pathname.endsWith('/hours')) return route.fulfill({ json: { hours: [] }, headers });
        if (url.pathname.endsWith('/walk-in') && req.method() === 'POST') {
          posts.push(req.postDataJSON());
          if (busy) { busy = false; return route.fulfill({ status: 409, json: { error: 'That artist is with another client right now. Choose another artist or ask at the front desk.' }, headers }); }
          return route.fulfill({ status: 201, json: { id: 'b', status: 'confirmed' }, headers });
        }
        if (url.hostname.endsWith('supabase.co')) return route.fulfill({ status: 401, json: {}, headers });
        throw new Error(`Unexpected call: ${req.method()} ${url.pathname}`);
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/walkin?s=${studio.id}`, { waitUntil: 'networkidle' });
      await page.getByText('Walk-in', { exact: true }).waitFor();
      for (const absent of ['Continue as guest', 'Continue with Apple', 'Back to sign-in options', 'Appointment type', 'Colour', 'Your availability', 'Reference photos', 'Design description']) {
        assert.equal(await page.getByText(absent, { exact: true }).count(), 0, `${absent} is not on the walk-in form`);
      }
      assert.equal(await page.getByText('Send me one SMS reminder', { exact: false }).count(), 0);
      // The consent form sits straight in the page: no "Consent forms" header or box, titled with its own name.
      assert.equal(await page.getByText('Consent forms', { exact: true }).count(), 0);
      await page.getByText('Walk-in consent', { exact: true }).waitFor();
      const book = page.getByRole('button', { name: 'Book me in', exact: true });
      assert.equal(await book.isDisabled(), true, 'Book me in is disabled on an empty form');
      // Walk-ins give first and last name separately.
      assert.equal(await page.getByPlaceholder('Your name', { exact: true }).count(), 0);
      await page.getByPlaceholder('First name', { exact: true }).fill('Walk In');
      assert.equal(await book.isDisabled(), true, 'disabled until the last name is given');
      await page.getByText('Please provide your last name.').waitFor();
      await page.getByPlaceholder('Last name', { exact: true }).fill('Client');
      await fillDob(page, '1994-05-06');
      await page.getByPlaceholder('you@example.com').fill('walkin@example.test');
      await page.getByPlaceholder('555 0100').fill('400111222');
      await page.getByRole('button', { name: 'Forearm', exact: true }).click();
      await page.getByRole('button', { name: 'Yes', exact: true }).click();
      // The artist is required and comes before the consent form.
      assert.equal(await book.isDisabled(), true, 'disabled until the artist is chosen');
      await page.getByText('Please choose your artist.').waitFor();
      // Artists are tappable cards (radio buttons), not a dropdown.
      const artists = page.getByRole('group', { name: /^Artist/ });
      assert.equal(await artists.getByRole('radio').count(), 2);
      assert.equal(await artists.getByRole('radio').first().evaluate(el => el.required), true);
      await artists.getByText('Sam Rivers', { exact: true }).click();
      assert.equal(await artists.getByRole('radio', { name: /Sam Rivers/ }).isChecked(), true);
      assert.equal(await book.isDisabled(), true, 'still disabled before agreeing to the consent form');
      await page.getByText('Please confirm you have read and agreed to "Walk-in consent".').waitFor();
      await page.getByText('I have read and agreed', { exact: false }).first().click();
      assert.equal(await book.isDisabled(), false, 'enabled once everything required is filled in');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (shots) await page.screenshot({ path: `${shots}/walkin-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Book me in', exact: true }).click();
      if (width === 390) {
        await page.getByRole('alert').filter({ hasText: 'with another client right now' }).waitFor();
        await page.getByRole('button', { name: 'Book me in', exact: true }).click();
      }
      await page.getByRole('heading', { name: "You're booked in!" }).waitFor();
      await page.getByText('Sam Rivers will be with you shortly.', { exact: false }).waitFor();
      const sent = posts.at(-1);
      assert.deepEqual([sent.artist_id, sent.name, sent.email, sent.dob, sent.phone.replaceAll(' ', ''), sent.body_location], [artistId, 'Walk In Client', 'walkin@example.test', '1994-05-06', '+61400111222', 'Forearm']);
      assert.equal(sent.consent_submissions[0].answers.healthy, 'Yes');
      // Shared iPad: start fresh for the next client.
      await page.getByRole('button', { name: 'Start a new walk-in' }).click();
      await page.getByPlaceholder('First name', { exact: true }).waitFor();
      assert.equal(await page.getByPlaceholder('First name', { exact: true }).inputValue(), '');
      assert.equal(await page.getByPlaceholder('Last name', { exact: true }).inputValue(), '');
      assert.deepEqual(errors, []);
      console.log(`PASS walk-in form at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
