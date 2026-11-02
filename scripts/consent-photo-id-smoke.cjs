// Consent photo ID on the studio booking page: a guest attaches a photo of their ID,
// it uploads privately and its path is sent as the answer. All services are mocked.
// Serve out/ with clean URLs first.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3056';
const shots = process.env.STUDIO_REVIEW_OUTPUT;
const studio = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Tattoo Studio', artists: [] };
const template = { id: 'tmpl-1', name: 'Consent', is_required: true, requires_signature: false, fields: [{ id: 'photo', type: 'photo_id', label: 'Photo ID', required: true }] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const calls = { signs: [], puts: [], bookings: [] };
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      await context.route('**/*', route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === new URL(base).origin) return route.continue();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/public')) return route.fulfill({ json: studio, headers });
        if (url.pathname.endsWith('/form-config')) return route.fulfill({ json: { fields: {} }, headers });
        if (url.pathname.endsWith('/consent-templates')) return route.fulfill({ json: { templates: [template] }, headers });
        if (url.pathname.endsWith('/id-upload-sign')) { calls.signs.push(req.postDataJSON()); return route.fulfill({ json: { upload_url: 'https://storage.example.test/upload/id', storage_object_path: `ids/${studio.id}/22222222-2222-4222-8222-222222222222.jpg` }, headers }); }
        if (url.hostname === 'storage.example.test') { calls.puts.push(req.headers()['content-type']); return route.fulfill({ status: 200, headers }); }
        if (url.pathname.endsWith('/studio-booking') && req.method() === 'POST') { calls.bookings.push(req.postDataJSON()); return route.fulfill({ status: 201, json: { id: 'b' }, headers }); }
        return route.fulfill({ status: 401, json: {}, headers });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/studio-booking?s=${studio.id}&guest=1`, { waitUntil: 'networkidle' });
      await page.getByPlaceholder('Your name', { exact: true }).fill('Guest Client');
      await page.locator('input[type="date"]').fill('1992-03-04');
      await page.getByPlaceholder('you@example.com').fill('guest@example.test');
      await page.getByPlaceholder('555 0100').fill('400999888');
      await page.getByRole('button', { name: 'Forearm', exact: true }).click();
      await page.locator('textarea').first().fill('Fine line swallow');
      await page.getByText('I have read and agreed', { exact: false }).first().click();
      // Required: submitting without the photo is blocked.
      await page.getByRole('button', { name: 'Request booking', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'required fields' }).waitFor();
      assert.equal(calls.bookings.length, 0);
      await page.getByLabel('Photo ID').setInputFiles({ name: 'licence.png', mimeType: 'image/png', buffer: png });
      await page.getByRole('img', { name: 'Your photo ID' }).waitFor();
      if (shots) await page.getByRole('img', { name: 'Your photo ID' }).screenshot({ path: `${shots}/photo-id-${width}.png` }).catch(() => {});
      if (shots) await page.screenshot({ path: `${shots}/photo-id-form-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Request booking', exact: true }).click();
      await page.getByRole('heading', { name: "You're on the list!" }).waitFor();
      assert.equal(calls.signs.length, 1);
      assert.equal(calls.signs[0].mime_type, 'image/jpeg', 'Photo is converted to JPEG before upload');
      assert.equal(calls.puts[0], 'image/jpeg');
      const answers = calls.bookings[0].consent_submissions[0].answers;
      assert.equal(answers.photo, `ids/${studio.id}/22222222-2222-4222-8222-222222222222.jpg`);
      assert.deepEqual(errors, []);
      console.log(`PASS photo ID on studio booking at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
