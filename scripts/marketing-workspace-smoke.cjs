// Run against an exported studio site. Every external request is intercepted;
// templates, recipients and campaign sends exist only in this test process.
const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const which = process.env.VANTA_MARKETING_CASE || 'all';
const cases = name => which === 'all' || which === name;
const base = process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'local@example.test', role: 'authenticated', aud: 'authenticated', user_metadata: { full_name: 'Local Studio' } };
const session = { access_token: 'local-test-token', refresh_token: 'local-refresh-token', expires_at: 2000000000, expires_in: 3600, token_type: 'bearer', user };

async function setup(browser, width, { ready = true, available = true, saveFailures = 0, sendFailures = 0, recipientFailures = 0, initialTemplates = [], lang = 'en', theme = 'dark', reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: process.env.STUDIO_MOBILE_TOUCH ? 844 : 1000 }, reducedMotion, ...(process.env.STUDIO_MOBILE_TOUCH ? {isMobile:true,hasTouch:true} : {}) });
  await context.addInitScript(({ auth, lang, theme }) => {
    if (window !== window.top) return;
    localStorage.setItem('studioLanguage', lang);
    localStorage.setItem('vanta-theme', theme);
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify(auth));
    localStorage.setItem(`vanta-studio-tour:${auth.user.id}`, 'complete');
  }, { auth: session, lang, theme });
  const writes = [], unexpected = [], campaigns = [], templates = initialTemplates.map(t => ({ ...t })), reads = [];
  let settings = { sender_provider: 'resend', from_name: 'Local Studio', reply_to: 'studio@example.test', footer_address: 'Local address', from_local: 'hello', domain: '', domain_status: '' };
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    if (url.origin === new URL(base).origin) return route.continue();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const body = req.postDataJSON();
      writes.push({ path, method, body });
      if (path.endsWith('/marketing/preview')) return route.fulfill({ json: { subject: body.subject, html: '<html><body>Local email preview</body></html>' } });
      if (path.endsWith('/marketing/templates') && method === 'POST') {
        if (saveFailures-- > 0) return route.fulfill({ status: 503, json: { error: 'Local template save unavailable' } });
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
        if (sendFailures-- > 0) return route.fulfill({ status: 503, json: { error: 'Local campaign send unavailable' } });
        const template = templates.find(t => t.id === body.template_id);
        const saved = { ...template, ...body, id: `local-campaign-${campaigns.length}`, created_at: new Date().toISOString(), recipient_count: body.segment.client_ids.length, status: 'sent', sent: 1, delivered: 0, opened: 0, clicked: 0, failed: 0, unknown: 0, queued: 0 };
        campaigns.push(saved); return route.fulfill({ json: saved });
      }
      unexpected.push({ path, method });
      return route.fulfill({ status: 400, json: { detail: 'Unexpected mutation in isolated test' } });
    }
    reads.push(path);
    if (path.endsWith('/marketing/recipients') && recipientFailures-- > 0) return route.fulfill({ status: 503, json: { error: 'Local recipients unavailable' } });
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
  if (process.env.VANTA_DELAY_TRANSLATIONS) await context.route('**/_next/static/chunks/339-*.js', async route => {
    await new Promise(resolve => setTimeout(resolve, Number(process.env.VANTA_DELAY_TRANSLATIONS)));
    return route.continue();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', err => { errors.push(err.message); if (process.env.VANTA_DEBUG_ERRORS) console.error(err.stack); });
  return { context, page, writes, unexpected, errors, reads };
}

const sectionAction = (page, section) => page.locator(`#tab-${section}`);
const selected = async (page, section) => {
  try { await page.waitForFunction(id => document.querySelector(`[data-marketing-view="${id}"] #panel-${id}:not([hidden])`), section); }
  catch (error) { await screenshot(page, 'navigation-failure'); console.error('Navigation failure:', page.url(), await page.locator('body').innerText()); throw error; }
  assert.equal(await page.locator(`#panel-${section}`).isVisible(), true);
  assert.equal(await page.getByRole('tablist').count(), 0);
  if (section !== 'templates') assert.equal(await sectionAction(page, section).getAttribute('aria-pressed'), 'true');
};
const noOverflow = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page should fit the viewport');

async function writeTemplate(page, { name = 'Local promotion', subject = 'Local offer' } = {}) {
  if (!await page.getByRole('region', { name: 'Template editor', exact: true }).isVisible()) {
    await page.getByRole('navigation', { name: 'Templates', exact: true }).getByRole('button', { name: 'New template', exact: true }).click();
  }
  await page.getByRole('textbox', { name: 'Template name', exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Subject', exact: true }).fill(subject);
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Hi {{client_name}}, local test message.');
}
async function continueFlow(page) {
  await page.getByRole('button', { name: 'Continue to clients', exact: true }).click();
  await page.getByRole('heading', { name: 'Review and send', exact: true }).waitFor();
}
async function confirmSend(page) {
  await page.getByRole('button', { name: 'Send to 1 client', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Send campaign', exact: true }).getByRole('button', { name: 'Send', exact: true }).click();
}
async function settleTemplatePanels(page) {
  await page.evaluate(async () => {
    const panels = document.querySelectorAll('[data-stage=editing] > section, [data-stage=editing] > aside');
    await Promise.all([...panels].flatMap(panel => panel.getAnimations()).map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
}
async function screenshot(page, name) {
  if (process.env.VANTA_SCREENSHOT_DIR) {
    await settleTemplatePanels(page);
    await page.screenshot({ path: `${process.env.VANTA_SCREENSHOT_DIR}/${name}.png`, fullPage: true });
  }
}
(async () => {
  const browser = await (process.env.STUDIO_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true, ...(process.env.STUDIO_CHROMIUM_EXECUTABLE && process.env.STUDIO_BROWSER !== 'webkit' ? { executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE } : {}) });
  try {
    for (const width of cases('personalisation') ? [390, 1440] : []) {
      const { context, page, writes, unexpected, errors } = await setup(browser, width);
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      await writeTemplate(page);
      const editor = page.getByRole('region', { name: 'Template editor', exact: true });
      const message = page.getByRole('textbox', { name: 'Message', exact: true });
      const subject = page.getByRole('textbox', { name: 'Subject', exact: true });
      for (const label of ['Client details', 'Visits and appointments', 'Studio details']) await editor.getByRole('heading', { name: label, exact: true }).waitFor();
      const tokens = ['client_name', 'client_full_name', 'client_email', 'visit_count', 'last_visit_date', 'next_appointment_date', 'next_appointment_time', 'studio_name', 'studio_address', 'booking_link'];
      for (const token of tokens) {
        await message.fill('Hello REPLACE!');
        await message.focus();
        await message.evaluate(el => el.setSelectionRange(6, 13));
        await editor.getByTitle(`{{${token}}}`, { exact: true }).click();
        assert.equal(await message.inputValue(), `Hello {{${token}}}!`);
        await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA');
        assert.equal(await message.evaluate(el => el === document.activeElement), true);
      }
      await subject.fill('Hello '); await subject.focus();
      await editor.getByTitle('{{client_full_name}}', { exact: true }).click();
      assert.equal(await subject.inputValue(), 'Hello {{client_full_name}}');
      await message.fill(tokens.map(token => `{{${token}}}`).join(' | '));
      await noOverflow(page); await screenshot(page, `personalisation-${width}`);
      await page.getByRole('complementary', { name: 'Template actions', exact: true }).getByRole('button', { name: 'Preview', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Email preview', exact: true });
      await dialog.getByText('Shown with sample client details.', { exact: true }).waitFor();
      await dialog.locator('iframe').waitFor();
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/preview')).at(-1).body.client_id, undefined);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await continueFlow(page);
      const alice = page.getByRole('checkbox', { name: /Alice Local/ });
      const bob = page.getByRole('checkbox', { name: /Bob Local/ });
      const previewFor = id => page.waitForResponse(response => response.url().endsWith('/marketing/preview') && response.request().postDataJSON().client_id === id);
      let preview = previewFor('client-0'); await alice.check(); await preview;
      preview = previewFor('client-1'); await bob.check(); await alice.uncheck(); await preview;
      const calls = writes.filter(w => w.path.endsWith('/marketing/preview'));
      assert.equal(calls.at(-1).body.client_id, 'client-1');
      assert.equal(calls.at(-1).body.client_name, 'Bob Local');
      assert.equal(writes.find(w => w.path.endsWith('/marketing/templates')).body.body, tokens.map(token => `{{${token}}}`).join(' | '));
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/campaigns')).length, 0);
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      console.log(`PASS all ten fields insert at cursor in message/subject, persist, use sample preview and switch real-client preview IDs at ${width}px`);
      await context.close();
    }
    for (const width of cases('navigation') ? [320, 390, 834, 1440] : []) {
      for (const theme of ['dark', 'light']) {
        const { context, page, writes, errors, reads } = await setup(browser, width, { theme });
        await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
        await selected(page, 'templates');
        const utilities = page.getByRole('navigation', { name:'Marketing sections', exact:true });
        await sectionAction(page, 'history').focus();
        await page.keyboard.press('Tab');
        assert.equal(await sectionAction(page, 'settings').evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Enter');
        await selected(page, 'settings');
        await sectionAction(page, 'history').focus();
        await page.keyboard.press('Enter');
        await selected(page, 'history');
        await page.getByRole('heading', {name:'Nothing sent yet', exact:true}).waitFor();
        await sectionAction(page, 'templates').focus();
        await page.keyboard.press('Enter');
        await selected(page, 'templates');
        assert.equal(new URL(page.url()).searchParams.get('tab'), 'templates');
        assert.equal(await utilities.getByRole('button').count(), 2);
        assert.equal(await page.getByRole('tab').count(), 0);
        assert.equal(await page.locator('main[data-marketing-view] > section:not([hidden])').count(), 1);
        const titleSize = await page.getByRole('heading', {name:'Create and send', exact:true, level:1}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
        const utilitySize = await sectionAction(page, 'history').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
        assert.ok(titleSize >= utilitySize * 1.75, 'Create and send must lead the visual hierarchy');
        assert.ok((await sectionAction(page, 'history').boundingBox()).height <= 48, 'Utilities should stay compact');
        await noOverflow(page); await screenshot(page, `navigation-${width}-${theme}`);
        assert.deepEqual(writes, []); assert.deepEqual(errors, []);
        await context.close();
      }
    }
    for (const width of cases('flow') ? (process.env.STUDIO_MOBILE_TOUCH ? [320, 390, 844] : [390, 834, 1280]) : []) {
      const { context, page, writes, unexpected, errors, reads } = await setup(browser, width);
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Your templates', exact: true }).waitFor();
      await selected(page, 'templates');
      assert.equal(await page.getByRole('tab').count(), 0);
      assert.equal(await sectionAction(page, 'settings').isVisible(), true);
      assert.equal(await page.getByRole('heading', { name: 'Setup checklist' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Continue to clients', exact: true }).count(), 0);
      assert.equal(reads.filter(p => p.endsWith('/marketing/campaigns')).length, 0);
      await writeTemplate(page);
      await noOverflow(page); await screenshot(page, `write-${width}`);
      await sectionAction(page, 'settings').click();
      await page.getByRole('heading', { name: 'Marketing settings', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Sending overview', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Sender details', exact: true }).waitFor();
      assert.equal(await page.locator('#panel-history').isVisible(), false);
      assert.equal(reads.filter(p => p.endsWith('/marketing/campaigns')).length, 0);
      await sectionAction(page, 'history').click();
      await page.getByRole('heading', { name: 'Nothing sent yet', exact: true }).waitFor();
      await sectionAction(page, 'templates').click();
      assert.equal(await page.getByRole('textbox', { name: 'Template name', exact: true }).inputValue(), 'Local promotion');
      assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Hi {{client_name}}, local test message.');
      await continueFlow(page);
      await selected(page, 'templates');
      assert.equal(await page.getByRole('combobox', { name: 'Template', exact: true }).count(), 0);
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/templates')).length, 1);
      await page.getByRole('checkbox', { name: /Alice Local/ }).check();
      await sectionAction(page, 'settings').click();
      await sectionAction(page, 'templates').click();
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      await page.getByRole('button', { name: 'Back to template', exact: true }).click();
      await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Updated local offer');
      await continueFlow(page);
      await page.locator('aside').getByText('Updated local offer', { exact: false }).waitFor();
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      await noOverflow(page); await screenshot(page, `recipients-${width}`);
      await page.getByRole('button', { name: 'Send to 1 client', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Send campaign', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/campaigns')).length, 0);
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      await confirmSend(page);
      await page.getByRole('heading', { name: 'Emails queued', exact: true }).waitFor();
      await selected(page, 'templates');
      await noOverflow(page); await screenshot(page, `queued-${width}`);
      const sent = writes.filter(w => w.path.endsWith('/marketing/campaigns'));
      assert.equal(sent.length, 1);
      assert.equal(sent[0].body.template_id, 'local-template');
      assert.deepEqual(sent[0].body.segment, { kind: 'selected', client_ids: ['client-0'] });
      await sectionAction(page, 'history').click();
      await page.getByRole('heading', { name: 'Local promotion', exact: true }).waitFor();
      await noOverflow(page); await screenshot(page, `settings-history-${width}`);
      await sectionAction(page, 'templates').click();
      await page.getByRole('button', { name: 'Create another email', exact: true }).click();
      await page.getByRole('heading', { name: 'Your templates', exact: true }).waitFor();
      assert.equal(await page.getByRole('region', { name: 'Template editor', exact: true }).count(), 0);
      assert.equal(await page.getByRole('complementary', { name: 'Template actions', exact: true }).count(), 0);
      // Saving for later stays in the editor; continuing reuses that saved template.
      await writeTemplate(page, { name: 'Saved for later' });
      await page.getByRole('button', { name: 'Save template', exact: true }).click();
      await page.getByRole('heading', { name: 'Edit template', exact: true }).waitFor();
      const savedCount = writes.filter(w => w.path.endsWith('/marketing/templates')).length;
      await continueFlow(page);
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/templates')).length, savedCount);
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), false);
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      console.log(`PASS continuous create/edit/send, retained draft/audience, cancel, queue confirmation and dedicated history at ${width}px`);
      await context.close();
    }
    for (const width of cases('switching') ? [390, 834, 1280] : []) {
      const saved = [
        { id: 'saved-one', name: 'Saved one', subject: 'First subject', body: 'First message' },
        { id: 'saved-two', name: 'Saved two', subject: 'Second subject', body: 'Second message' },
      ];
      const { context, page, writes, unexpected, errors, reads } = await setup(browser, width, { initialTemplates: saved });
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      try { await page.getByRole('heading', { name: 'Your templates', exact: true }).waitFor(); }
      catch (error) { await screenshot(page, `switching-load-failure-${width}`); console.error({ url: page.url(), errors, body: await page.locator('body').innerText(), reads }); throw error; }
      const nav = page.getByRole('navigation', { name: 'Templates', exact: true });
      async function choose(label) {
        if (!await nav.isVisible()) await page.getByRole('button', { name: 'Choose a saved template or example', exact: true }).click();
        const choice = nav.getByRole('button', { name: label });
        if (!await choice.isVisible()) await nav.locator('details summary').click();
        await choice.click();
      }
      const dialog = page.getByRole('alertdialog', { name: 'Discard changes', exact: true });
      const subject = page.getByRole('textbox', { name: 'Subject', exact: true });
      const name = page.getByRole('textbox', { name: 'Template name', exact: true });
      // Merely loading an example is not a user edit, but it can still be saved.
      for (const starter of ['Flash day', 'We miss you', 'Piercing check-in', 'Books open']) {
        await choose(new RegExp('^' + starter + '$'));
        assert.equal(await name.inputValue(), starter);
        assert.equal(await dialog.count(), 0);
        assert.equal(await page.getByText('Unsaved changes', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Save template', exact: true }).isEnabled(), true);
      }
      await page.getByRole('button', { name: 'Save template', exact: true }).click();
      await page.getByRole('heading', { name: 'Edit template', exact: true }).waitFor();
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/templates')).length, 1);
      await choose(/^Flash day$/);
      await continueFlow(page);
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/templates')).length, 2);
      await page.getByRole('button', { name: 'Back to template', exact: true }).click();
      await choose(/^Saved one/);
      await choose(/^Saved two/);
      assert.equal(await subject.inputValue(), 'Second subject');
      assert.equal(await dialog.count(), 0);
      await choose(/^Saved one/);
      // Re-selecting the current saved template must not discard its actual draft.
      await subject.fill('Draft subject');
      await choose(/^Saved one/);
      assert.equal(await dialog.count(), 0);
      assert.equal(await subject.inputValue(), 'Draft subject');
      await subject.fill('First subject');
      for (const [field, original] of [['Template name', 'Saved one'], ['Subject', 'First subject'], ['Message', 'First message']]) {
        const control = page.getByRole('textbox', { name: field, exact: true });
        await control.fill('Edited ' + original);
        await choose(/^Saved two/);
        await dialog.waitFor();
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(await control.inputValue(), 'Edited ' + original);
        // Restoring the original value clears the dirty state.
        await control.fill(original);
        await choose(/^Saved two/);
        assert.equal(await dialog.count(), 0);
        assert.equal(await subject.inputValue(), 'Second subject');
        await choose(/^Saved one/);
      }
      await subject.fill('An actual edit');
      await choose(/^Piercing check-in$/);
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
      assert.equal(await name.inputValue(), 'Piercing check-in');
      assert.equal(await page.getByText('Unsaved changes', { exact: true }).count(), 0);
      await choose(/^We miss you$/);
      assert.equal(await dialog.count(), 0);
      await noOverflow(page); await screenshot(page, `template-switching-${width}`);
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/campaigns')).length, 0);
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      console.log(`PASS template/example switching, real edits, cancelled discard, reverted edits and untouched-example save/continue at ${width}px`);
      await context.close();
    }
    for (const width of cases('panels') ? [390, 834, 1280, 1920] : []) {
      for (const theme of ['dark', 'light']) {
        const seed = [
          { id: 'saved-one', name: 'Studio flash day', subject: 'Flash day this Saturday', body: 'Hi {{client_name}},\n\nWe have fresh designs and new availability this Saturday. Reply to reserve a spot.\n\nThanks,\n{{studio_name}}' },
          { id: 'saved-two', name: 'Piercing follow-up', subject: 'How is your piercing healing?', body: 'Hi {{client_name}}, let us know if you have any questions.' },
        ];
        const { context, page, writes, unexpected, errors } = await setup(browser, width, { initialTemplates: theme === 'light' ? seed.slice(0, 1) : seed, theme });
        await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Your templates', exact: true }).waitFor();
        const library = page.getByRole('navigation', { name: 'Templates', exact: true });
        const editor = page.getByRole('region', { name: 'Template editor', exact: true });
        const actions = page.getByRole('complementary', { name: 'Template actions', exact: true });
        assert.equal(await editor.count(), 0);
        assert.equal(await actions.count(), 0);
        assert.equal(await library.isVisible(), true);
        await library.getByRole('heading', { name: 'Saved templates', exact: true }).waitFor();
        assert.equal(await library.getByRole('button', { name: 'New template', exact: true }).isEnabled(), true);
        const titleBox = await page.getByRole('heading', { name: 'Create and send', exact: true, level: 1 }).boundingBox();
        const settingsBox = await sectionAction(page, 'settings').boundingBox();
        assert.ok(settingsBox.height <= 48, 'Settings should be a compact utility');
        if (width > 760) assert.ok(settingsBox.x > titleBox.x + titleBox.width, 'Utilities should sit to the right of the main workspace');
        else assert.ok(settingsBox.y > titleBox.y + titleBox.height, 'Phone utilities should follow the main heading');
        const chooser = await page.locator('[data-stage="choosing"]').boundingBox();
        const examples = library.locator('details');
        assert.equal(await examples.getAttribute('open'), null, 'Examples start collapsed when saved templates exist');
        assert.equal(await library.getByRole('button', {name:'Flash day',exact:true}).isVisible(), false);
        const savedGroup = await library.locator('section').filter({has: page.getByRole('heading',{name:'Saved templates',exact:true})}).boundingBox();
        const examplesGroup = await examples.boundingBox();
        assert.ok(Math.abs(savedGroup.width-chooser.width)<=1, 'Saved templates should use the main chooser width');
        assert.ok(examplesGroup.y>=savedGroup.y+savedGroup.height, 'Examples should follow saved templates');
        assert.ok(examplesGroup.height<=64, 'Collapsed examples should be a compact secondary row');
        await noOverflow(page); await screenshot(page, `saved-first-${width}-${theme}`);
        await examples.locator('summary').focus(); await page.keyboard.press('Enter');
        await library.getByRole('button',{name:'Flash day',exact:true}).waitFor();
        const promotions = await library.locator('[data-tone="promotion"]').boundingBox();
        const care = await library.locator('[data-tone="care"]').boundingBox();
        if (chooser.width >= 500) {
          assert.ok(promotions.x + promotions.width <= care.x && Math.abs(promotions.y - care.y) <= 1, 'Example categories should sit side by side when space allows');
        } else {
          assert.ok(care.y >= promotions.y + promotions.height, 'Example categories should stack on smaller screens');
        }
        for (const button of await library.getByRole('button').all()) {
          assert.ok((await button.boundingBox()).height >= 44, 'Template choices should have comfortable touch targets');
        }
        await noOverflow(page); await screenshot(page, `chooser-${width}-${theme}`);
        await library.getByRole('heading', { name: 'Saved templates', exact: true }).waitFor();
        await library.getByRole('heading', { name: 'Promotions', exact: true }).waitFor();
        await library.getByRole('heading', { name: 'Client care', exact: true }).waitFor();
        await library.getByRole('button', { name: /^Studio flash day/ }).click();
        assert.equal(await page.getByRole('textbox', { name: 'Template name', exact: true }).inputValue(), 'Studio flash day');
        assert.equal(await actions.getByRole('button', { name: 'Continue to clients', exact: true }).isEnabled(), true);
        assert.equal(await actions.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true);
        assert.equal(await editor.getByRole('button', { name: 'Preview', exact: true }).count(), 0);
        await editor.getByRole('heading', { name: 'Template details', exact: true }).waitFor();
        await editor.getByRole('heading', { name: 'Email content', exact: true }).waitFor();
        await editor.getByRole('heading', { name: 'Personalisation', exact: true }).waitFor();
        await settleTemplatePanels(page);
        if (width >= 1280) {
          const l = await library.boundingBox(), e = await editor.boundingBox(), a = await actions.boundingBox();
          assert.ok(l.x + l.width <= e.x && e.x + e.width <= a.x, 'Library, editor and actions should be three separate columns');
          assert.equal(await library.getByRole('button', { name: /^Studio flash day/ }).getAttribute('aria-current'), 'true');
          await library.getByText('Selected', { exact: false }).waitFor();
        } else {
          assert.equal(await library.isVisible(), false);
          const e = await editor.boundingBox(), a = await actions.boundingBox();
          assert.ok(Math.abs(e.x - a.x) <= 1 && a.y >= e.y + e.height, 'Editor and actions should stack on narrow screens');
        }
        await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Updated flash day invitation');
        assert.equal(await actions.getByRole('button', { name: 'Save changes', exact: true }).isEnabled(), true);
        await noOverflow(page);
        await screenshot(page, `panels-${width}-${theme}`);
        await actions.getByRole('button', { name: 'Preview', exact: true }).click();
        const preview = page.getByRole('dialog', { name: 'Email preview', exact: true });
        await preview.waitFor();
        await preview.getByRole('button', { name: 'Close', exact: true }).click();
        await actions.locator('summary').click();
        await actions.getByRole('button', { name: 'Make a copy', exact: true }).waitFor();
        await actions.getByRole('button', { name: 'Delete', exact: true }).waitFor();
        await actions.locator('summary').click();
        await actions.scrollIntoViewIfNeeded();
        await screenshot(page, `actions-${width}-${theme}`);
        assert.equal(writes.filter(w => w.path.endsWith('/marketing/test') || w.path.endsWith('/marketing/campaigns') || w.path.includes('/marketing/templates')).length, 0);
        assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
        console.log(`PASS library categories, selected state, dedicated editor/actions, preview, responsive columns and ${theme} theme at ${width}px`);
        await context.close();
      }
    }
    for (const width of cases('reveal') ? [390, 1440] : []) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const { context, page, writes, unexpected, errors } = await setup(browser, width, { reducedMotion });
        await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
        const library = page.getByRole('navigation', { name: 'Templates', exact: true });
        await library.getByRole('heading', { name: 'Your templates', exact: true }).waitFor();
        assert.equal(await page.getByRole('textbox').count(), 0, 'Editor fields must not be present before choosing');
        assert.equal(await page.getByRole('complementary', { name: 'Template actions', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Choose a saved template or example', exact: true }).count(), 0);
        assert.equal(await library.locator('details').count(), 0, 'Examples remain prominent before any templates are saved');
        await library.getByRole('button',{name:'Flash day',exact:true}).waitFor();
        const newButton = library.getByRole('button', { name: 'New template', exact: true });
        await newButton.focus(); await page.keyboard.press('Enter');
        const editor = page.getByRole('region', { name: 'Template editor', exact: true });
        const actions = page.getByRole('complementary', { name: 'Template actions', exact: true });
        await editor.waitFor(); await actions.waitFor();
        await page.waitForFunction(() => document.activeElement?.textContent === 'New template');
        const animations = await Promise.all([editor, actions].map(el => el.evaluate(node => {
          const style = getComputedStyle(node);
          return { name: style.animationName, delay: style.animationDelay };
        })));
        if (reducedMotion === 'reduce') {
          assert.ok(animations.every(animation => animation.name === 'none'), 'Reduce Motion must disable both entrance animations');
        } else {
          assert.ok(animations.every(animation => animation.name !== 'none'));
          assert.ok(parseFloat(animations[1].delay) > parseFloat(animations[0].delay), 'Actions should follow the editor');
        }
        assert.equal(await actions.getByRole('button', { name: 'Continue to clients', exact: true }).isDisabled(), true);
        await writeTemplate(page); await continueFlow(page);
        await page.getByRole('button', { name: 'Back to template', exact: true }).click();
        assert.equal(await page.getByRole('textbox', { name: 'Template name', exact: true }).inputValue(), 'Local promotion');
        await noOverflow(page);
        assert.equal(writes.filter(w => w.path.endsWith('/marketing/campaigns') || w.path.endsWith('/marketing/test')).length, 0);
        assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
        console.log(`PASS chooser-first keyboard entry, staggered reveal, retained draft and ${reducedMotion} motion at ${width}px`);
        await context.close();
      }
    }
    for (const query of cases('links') ? ['?tab=settings', '?tab=sender', '?mailbox=connected', '?tab=history', '?tab=campaigns'] : []) {
      const { context, page, writes, errors } = await setup(browser, 390);
      await page.goto(`${base}/dashboard/marketing.html${query}`, { waitUntil: 'networkidle' });
      const isCompose = query.includes('campaigns');
      await selected(page, isCompose ? 'templates' : query.includes('history') ? 'history' : 'settings');
      if (query.includes('history')) await page.getByRole('heading', { name: 'Nothing sent yet', exact: true }).waitFor();
      if (query.includes('mailbox')) {
        await page.getByRole('heading', { name: 'Connect an email account', exact: true }).waitFor();
        assert.equal(new URL(page.url()).searchParams.has('mailbox'), false);
      }
      assert.deepEqual(writes, []); assert.deepEqual(errors, []);
      console.log(`PASS existing deep link ${query}`);
      await context.close();
    }
    for (const available of cases('setup') ? [true, false] : []) {
      const { context, page, writes, errors } = await setup(browser, 390, { ready: false, available });
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      await writeTemplate(page); await continueFlow(page);
      await page.getByRole('checkbox', { name: /Alice Local/ }).check();
      assert.equal(await page.getByRole('button', { name: 'Send to 1 client', exact: true }).isDisabled(), true);
      if (available) await page.getByRole('button', { name: 'Set it up', exact: true }).click();
      else await sectionAction(page, 'settings').click();
      await selected(page, 'settings');
      await sectionAction(page, 'templates').click();
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/campaigns')).length, 0);
      assert.deepEqual(errors, []);
      console.log(`PASS sender setup preserves flow and blocks sends (available=${available})`);
      await context.close();
    }
    if (cases('failures')) {
      const { context, page, writes, unexpected, errors } = await setup(browser, 390, { saveFailures: 1, sendFailures: 1, recipientFailures: 1 });
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      await writeTemplate(page);
      await page.getByRole('button', { name: 'Continue to clients', exact: true }).click();
      await page.getByText('Local template save unavailable', { exact: true }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'Subject', exact: true }).inputValue(), 'Local offer');
      assert.equal(await page.getByRole('heading', { name: 'Review and send', exact: true }).count(), 0);
      await continueFlow(page);
      await page.getByRole('alert').filter({ hasText: 'Local recipients unavailable' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Send campaign', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('checkbox', { name: /Alice Local/ }).check();
      await confirmSend(page);
      await page.getByText('Local campaign send unavailable', { exact: true }).waitFor();
      assert.equal(await page.getByRole('checkbox', { name: /Alice Local/ }).isChecked(), true);
      await noOverflow(page); await screenshot(page, 'send-error-390');
      await confirmSend(page);
      await page.getByRole('heading', { name: 'Emails queued', exact: true }).waitFor();
      assert.equal(writes.filter(w => w.path.endsWith('/marketing/campaigns')).length, 2);
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      console.log('PASS template, recipient and send failure recovery retains draft and audience');
      await context.close();
    }
    for (const [lang, next, review, history, back] of cases('languages') ? [
      ['zh-Hans', '继续选择客户', '检查并发送', '已发邮件', '创建并发送'],
      ['ko', '고객 선택으로 계속', '검토 및 발송', '보낸 이메일', '작성 및 발송']
    ] : []) {
      const { context, page, errors } = await setup(browser, 390, { lang });
      await page.goto(`${base}/dashboard/marketing.html`, { waitUntil: 'networkidle' });
      await selected(page, 'templates');
      await page.locator('nav[aria-label] button').first().click();
      const fields = page.locator('#panel-templates section[aria-label] input, #panel-templates section[aria-label] textarea');
      await fields.nth(0).fill('Local translation test');
      await fields.nth(1).fill('Local offer');
      await fields.nth(2).fill('Local message');
      await page.getByRole('button', { name: next, exact: true }).click();
      await page.getByRole('heading', { name: review, exact: true }).waitFor();
      await noOverflow(page); await screenshot(page, `recipients-${lang}-390`);
      await sectionAction(page, 'history').click();
      await page.getByRole('heading', { name: history, exact: true }).waitFor();
      const backButton = page.locator('#tab-templates');
      await backButton.click();
      await selected(page, 'templates');
      await page.getByRole('heading', { name: review, exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS new flow and dedicated history translated in ${lang}`);
      await context.close();
    }
    console.log(which === 'all' ? 'Isolated marketing flow scenarios passed. No real emails were sent.' : `Isolated marketing ${which} checks passed. No real emails were sent.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
