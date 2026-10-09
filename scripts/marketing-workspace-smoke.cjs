// Run against an exported studio site. Every external request is intercepted;
// templates, recipients and campaign sends exist only in this test process.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'local@example.test', role: 'authenticated', aud: 'authenticated', user_metadata: { full_name: 'Local Studio' } };
const session = { access_token: 'local-test-token', refresh_token: 'local-refresh-token', expires_at: 2000000000, expires_in: 3600, token_type: 'bearer', user };

async function setup(browser, width, { ready = true, available = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.addInitScript(auth => {
    if (window !== window.top) return;
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify(auth));
    localStorage.setItem(`vanta-studio-tour:${auth.user.id}`, 'complete');
  }, session);
  const writes = [], unexpected = [], campaigns = [], templates = [];
  let settings = { sender_provider: 'resend', from_name: 'Local Studio', reply_to: 'studio@example.test', footer_address: 'Local address', from_local: 'hello', domain: '', domain_status: '' };
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    if (url.origin === new URL(base).origin) return route.continue();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const body = req.postDataJSON();
      writes.push({ path, method, body });
      if (path.endsWith('/marketing/preview')) return route.fulfill({ json: { subject: body.subject, html: '<html><body>Local email preview</body></html>' } });
      if (path.endsWith('/marketing/templates') && method === 'POST') {
        const saved = { ...body, id: 'local-template' }; templates.push(saved);
        return route.fulfill({ json: saved });
      }
      if (path.endsWith('/marketing/templates/local-template') && method === 'PUT') {
        const saved = { ...body, id: 'local-template' }; templates[0] = saved;
        return route.fulfill({ json: saved });
      }
      if (path.endsWith('/marketing/settings') && method === 'PUT') {
        settings = body; ready = true; return route.fulfill({ json: { settings } });
      }
      if (path.endsWith('/marketing/campaigns') && method === 'POST') {
        const template = templates.find(t => t.id === body.template_id);
        const saved = { ...template, ...body, id: `local-campaign-${campaigns.length}`, created_at: new Date().toISOString(), recipient_count: body.segment.client_ids.length, status: 'sent', sent: 1, delivered: 0, opened: 0, clicked: 0, failed: 0, unknown: 0, queued: 0 };
        campaigns.push(saved); return route.fulfill({ json: saved });
      }
      unexpected.push({ path, method });
      return route.fulfill({ status: 400, json: { detail: 'Unexpected mutation in isolated test' } });
    }
    if (path === '/auth/v1/user') return route.fulfill({ json: user });
    if (path === '/studio/me') return route.fulfill({ json: { status: 'approved', studio_id: 'local-studio', studio: { id: 'local-studio', name: 'Local Studio', timezone: 'Australia/Melbourne', subscription_status: 'active' } } });
    if (path.endsWith('/marketing')) return route.fulfill({ json: { available, ready, domain_available: true, settings, stats: { consented_clients: 2, sent_this_month: campaigns.length, unsubscribed: 0, failed_this_month: 0 } } });
    if (path.endsWith('/marketing/templates')) return route.fulfill({ json: { templates } });
    if (path.endsWith('/marketing/campaigns')) return route.fulfill({ json: { campaigns } });
    if (path.endsWith('/marketing/recipients')) return route.fulfill({ json: { clients: ['Alice', 'Bob'].map((name, i) => ({ id: `client-${i}`, name: `${name} Local`, email: `${name.toLowerCase()}@example.test`, completed_count: 1, last_visit: null, next_appointment: null, created_at: new Date().toISOString() })) } });
    if (path.endsWith('/marketing/saved-audiences')) return route.fulfill({ json: { audiences: [] } });
    if (path.endsWith('/marketing/mailboxes')) return route.fulfill({ json: { connections: [], providers: { gmail: true, outlook: true } } });
    return route.fulfill({ json: {} });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', err => errors.push(err.message));
  return { context, page, writes, unexpected, errors };
}

const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const selected = async (page, name) => {
  await page.waitForFunction(label => [...document.querySelectorAll('[role=tab]')].some(el => el.textContent === label && el.getAttribute('aria-selected') === 'true'), name);
  assert.equal(await tab(page, name).getAttribute('aria-selected'), 'true');
};
const noOverflow = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page should fit the viewport');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const { context, page, writes, unexpected, errors } = await setup(browser, width);
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'New template', exact: true }).waitFor();
      await selected(page, 'Templates');
      assert.equal(await page.getByRole('heading', { name: 'Setup checklist' }).count(), 0);
      await noOverflow(page);
      if (process.env.VANTA_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.VANTA_SCREENSHOT_DIR}/marketing-templates-${width}.png`, fullPage: true });
      await page.getByRole('textbox', { name: 'Template name', exact: true }).fill('Local promotion');
      await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Local offer');
      await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Hi {{client_name}}, local test message.');
      await tab(page, 'Settings').click();
      await page.getByRole('heading', { name: 'Marketing settings', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Sending overview', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Setup checklist', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Sender details', exact: true }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('tab'), 'settings');
      await noOverflow(page);
      if (process.env.VANTA_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.VANTA_SCREENSHOT_DIR}/marketing-settings-${width}.png`, fullPage: true });
      await tab(page, 'Templates').click();
      assert.equal(await page.getByRole('textbox', { name: 'Template name', exact: true }).inputValue(), 'Local promotion');
      assert.equal(await page.getByRole('textbox', { name: 'Subject', exact: true }).inputValue(), 'Local offer');
      assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Hi {{client_name}}, local test message.');
      assert.equal(await page.getByRole('heading', { name: 'Sender details', exact: true }).count(), 0);
      // Visit Sent before sending, to catch stale history when panels stay mounted.
      await tab(page, 'Sent').click();
      await page.getByRole('heading', { name: 'Nothing sent yet', exact: true }).waitFor();
      await tab(page, 'Templates').click();
      await page.getByRole('button', { name: 'Use in an email', exact: true }).click();
      await selected(page, 'Send emails');
      const chooser = page.getByRole('combobox', { name: 'Template', exact: true });
      await chooser.locator('option[value="local-template"]').waitFor({ state: 'attached' });
      assert.equal(await chooser.inputValue(), 'local-template');
      await page.getByRole('checkbox', { name: /Alice Local/ }).check();
      await tab(page, 'Settings').click();
      await tab(page, 'Send emails').click();
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      assert.equal(await chooser.inputValue(), 'local-template');
      // Edit a saved template and return without resetting the selected audience.
      await page.getByRole('button', { name: 'Edit templates', exact: true }).click();
      await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Updated local offer');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('#panel-templates button')].some(b => b.textContent === 'Save changes' && b.disabled));
      await tab(page, 'Send emails').click();
      await page.waitForFunction(() => document.querySelector('#panel-campaigns')?.textContent.includes('Updated local offer'));
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      await noOverflow(page);
      await page.getByRole('button', { name: 'Send to 1 client', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Send campaign', exact: true }).getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByRole('heading', { name: 'Local promotion', exact: true }).waitFor();
      await selected(page, 'Sent');
      const sent = writes.filter(w => w.path.endsWith('/marketing/campaigns'));
      assert.equal(sent.length, 1);
      assert.equal(sent[0].body.template_id, 'local-template');
      assert.deepEqual(sent[0].body.segment, { kind: 'selected', client_ids: ['client-0'] });
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      console.log(`PASS templates, settings, retained drafts/audience, updated template and intercepted send/history at ${width}px`);
      await context.close();
    }
    for (const query of ['?tab=settings', '?tab=sender', '?mailbox=connected']) {
      const { context, page, writes, errors } = await setup(browser, 390);
      await page.goto(`${base}/dashboard/marketing.html${query}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Marketing settings', exact: true }).waitFor();
      await selected(page, 'Settings');
      if (query.includes('mailbox')) {
        await page.getByRole('heading', { name: 'Connect an email account', exact: true }).waitFor();
        assert.equal(new URL(page.url()).searchParams.has('mailbox'), false);
      }
      assert.equal(new URL(page.url()).searchParams.get('tab'), 'settings');
      assert.deepEqual(writes, []); assert.deepEqual(errors, []);
      console.log(`PASS settings deep link ${query}`);
      await context.close();
    }
    for (const available of [true, false]) {
      const { context, page, writes, errors } = await setup(browser, 390, { ready: false, available });
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      await tab(page, 'Send emails').click();
      await page.getByRole('checkbox', { name: /Alice Local/ }).check();
      assert.equal(await page.getByRole('button', { name: 'Send to 1 client', exact: true }).isDisabled(), true);
      if (available) await page.getByRole('button', { name: 'Set it up', exact: true }).click();
      else await tab(page, 'Settings').click();
      await selected(page, 'Settings');
      await tab(page, 'Send emails').click();
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      assert.deepEqual(writes, []); assert.deepEqual(errors, []);
      console.log(`PASS sending blocked until configured, preserves audience (available=${available})`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
