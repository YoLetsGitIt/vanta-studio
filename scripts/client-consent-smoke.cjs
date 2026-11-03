// Clients → a client who signed through the studio's "Send link" shows as Consented,
// and the studio can read the completed form from the client panel. All requests mocked.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';
const email = 'alexandra.montgomery@example.test';
const template = { id: 'tmpl-1', name: 'Tattoo consent', updated_at: '2026-01-01T00:00:00Z', fields: [{ id: 'f_well', type: 'yesno', label: 'Are you feeling well today?' }, { id: 'f_meds', type: 'text', label: 'Medications' }] };
// Signed with no booking, so it carries no client_email from a booking join.
const sub = { id: 'sub-1', template_id: 'tmpl-1', template_name: 'Tattoo consent', signer_name: 'Alexandra Montgomery-Williams', submitted_at: '2026-11-03T05:00:00Z', answers: { f_well: 'Yes', f_meds: 'None', __agreed__: 'true' }, client_signature_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' };
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 800, hasTouch: width < 800 });
      await setup(context);
      await context.route('**/studio/me/consent-templates', route => route.fulfill({ json: { templates: [template] } }));
      await context.route('**/studio/me/clients/consent-submissions?**', route => {
        const url = new URL(route.request().url());
        if (url.searchParams.get('emails')) return route.fulfill({ json: { submissions: [{ ...sub, client_email: email }] } });
        return route.fulfill({ json: { submissions: url.searchParams.get('email') === email ? [sub] : [] } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/dashboard/clients?client=client-1', { waitUntil: 'networkidle' });
      const panel = page.locator('#client-detail');
      await panel.waitFor();
      await panel.getByText('Signed consent forms (1)').waitFor();
      assert.equal(await panel.getByText('Not consented', { exact: true }).count(), 0, 'signed client is not shown as not consented');
      assert.ok(await panel.getByText('Consented', { exact: true }).count() >= 1);
      assert.equal(await panel.getByRole('button', { name: 'Send link' }).count(), 0, 'no send link for a consented client');
      // Collapsed at first: name and signing date only, expanded on tap.
      const formToggle = panel.getByRole('button', { name: /Tattoo consent/ });
      assert.equal(await formToggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await panel.getByText('Are you feeling well today?', { exact: true }).count(), 0, 'answers hidden until expanded');
      await formToggle.click();
      assert.equal(await formToggle.getAttribute('aria-expanded'), 'true');
      // The completed form, with the form's own question labels.
      await panel.getByText('Are you feeling well today?', { exact: true }).waitFor();
      await panel.getByText('Medications', { exact: true }).waitFor();
      assert.equal(await panel.getByText('f_well').count(), 0, 'field ids are not shown');
      await panel.getByRole('img', { name: 'Client signature' }).waitFor();
      await panel.getByRole('button', { name: 'Download PDF' }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No sideways scroll');
      assert.deepEqual(errors, []);
      if (process.env.STUDIO_REVIEW_OUTPUT) await panel.getByText("Signed consent forms (1)").scrollIntoViewIfNeeded(), await page.screenshot({ path: `${process.env.STUDIO_REVIEW_OUTPUT}/client-consent-${width}.png` });
      console.log(`PASS client consent at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
