// Run against the local dev server: STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/design-system-smoke.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3007';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/design-system`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Studio design system', exact: true }).waitFor();
    for (const theme of ['light', 'dark']) {
      await page.getByRole('button', { name: `${theme === 'light' ? 'Light' : 'Dark'} theme`, exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await page.evaluate(() => localStorage.getItem('vanta-theme')), theme);
      const namedInput = page.getByLabel('Client name', { exact: false });
      await namedInput.focus();
      assert.equal(await namedInput.evaluate(el => el.matches(':focus-visible')), true);
      assert.notEqual(await namedInput.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      const email = page.getByLabel('Email', { exact: true });
      assert.equal(await email.getAttribute('aria-invalid'), 'true');
      assert.ok(await email.getAttribute('aria-describedby'));
      await page.screenshot({ path: `/private/tmp/studio-design-${theme}.png`, fullPage: true });
    }
    assert.equal(await page.getByRole('button', { name: 'Unavailable', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Saving…', exact: true }).isDisabled(), true);
    const opener = page.getByRole('button', { name: 'Open example dialog', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Record session', exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
    await dialog.getByRole('button', { name: 'Done', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await dialog.getByLabel('Final price', { exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Done', exact: true }).evaluate(el => el === document.activeElement), true);
    await dialog.getByLabel('Prevent dismissal while saving').check();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), true);
    await page.mouse.click(2, 2);
    assert.equal(await dialog.isVisible(), true);
    await dialog.getByLabel('Prevent dismissal while saving').uncheck();
    await dialog.getByRole('button', { name: 'Open nested confirmation', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Confirm example', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog', { name: 'Confirm example', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await dialog.isVisible(), true);
    await dialog.getByRole('button', { name: 'Show example error', exact: true }).click();
    const notice = dialog.getByRole('status');
    await notice.waitFor();
    assert.match(await notice.innerText(), /Example save failed/);
    await notice.getByRole('button', { name: 'Dismiss message' }).click();
    await dialog.getByRole('button', { name: 'Show example action notice', exact: true }).click();
    await dialog.getByRole('button', { name: 'Example action', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await dialog.getByLabel('Final price', { exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Example action', exact: true }).evaluate(el => el === document.activeElement), true);
    await dialog.getByRole('button', { name: 'Example action', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('dialog [role="status"]')?.textContent.includes('Example action done'));
    await dialog.getByRole('button', { name: 'Dismiss message' }).click();
    // FeedbackHost precedes the original dialog in DOM order, but its later
    // confirmation owns the top layer and must receive the actionable notice.
    await dialog.getByRole('button', { name: 'Open feedback confirmation', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Feedback confirmation', exact: true });
    await confirmation.waitFor();
    const confirmationAction = confirmation.getByRole('button', { name: 'Confirm notice action', exact: true });
    await confirmationAction.waitFor();
    await confirmationAction.focus();
    await page.keyboard.press('Tab');
    assert.equal(await confirmation.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await confirmationAction.evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    await confirmation.waitFor({ state: 'hidden' });
    // A remaining notice moves back into the exposed dialog.
    await dialog.getByRole('button', { name: 'Confirm notice action', exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Dismiss message' }).click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    // Narrow layout and native long-content/keyboard recovery.
    await page.setViewportSize({ width: 360, height: 640 });
    await opener.click();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 640);
    await page.screenshot({ path: '/private/tmp/studio-design-mobile-dialog.png', fullPage: true });
    await page.keyboard.press('Escape');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const duration = await page.locator('.studio-spinner').first().evaluate(el => parseFloat(getComputedStyle(el).animationDuration));
    assert.ok(duration < 0.01, `Reduced motion animation still runs (${duration})`);
    await page.getByRole('button', { name: 'Light theme', exact: true }).click();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    await page.getByLabel('Email', { exact: false }).fill('example@example.com');
    await page.getByLabel('Password', { exact: false }).fill('example-only');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.screenshot({ path: '/private/tmp/studio-signin-light-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    const feature = page.getByRole('button', { name: /^Learn more about / }).first();
    await feature.focus();
    await page.keyboard.press('Enter');
    const featureDialog = page.getByRole('dialog');
    await featureDialog.waitFor();
    assert.equal(await featureDialog.evaluate(el => getComputedStyle(el).colorScheme), 'dark');
    await page.keyboard.press('Escape');
    await featureDialog.waitFor({ state: 'hidden' });
    assert.equal(await feature.evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Start 14-day free trial', exact: true }).click();
    for (const label of ['Email', 'Password', 'Confirm password']) {
      assert.equal(await page.getByLabel(new RegExp(`^${label}(?:\\s*\\*)?$`)).count(), 1);
    }
    // Public booking is read-only here: local fixtures replace every studio request.
    await page.route('**/studios/design-system-fixture/**', route => {
      assert.equal(route.request().method(), 'GET');
      const pathname = new URL(route.request().url()).pathname;
      const json = pathname.endsWith('/public')
        ? { name: 'Design system fixture', artists: [] }
        : pathname.endsWith('/consent-templates') ? { templates: [] } : { fields: {} };
      return route.fulfill({ json });
    });
    await page.goto(`${base}/studio-booking?s=design-system-fixture`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Design system fixture', exact: true }).waitFor();
    const firstName = page.getByLabel('First name', { exact: false });
    assert.equal(await firstName.evaluate(el => getComputedStyle(el).colorScheme), 'dark');
    await firstName.fill('Example');
    await page.getByLabel(/^Phone(?:\s*\*)?$/).fill('5550100');
    assert.equal(await page.getByLabel('Phone country code', { exact: true }).count(), 1);
    const addPhotos = page.getByRole('button', { name: '+ Add photos', exact: true });
    await addPhotos.focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await chooser;
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '/private/tmp/studio-public-booking-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(`${base}/design-system`, { waitUntil: 'networkidle' });
    await blockedPage.getByRole('button', { name: 'Light theme', exact: true }).click();
    assert.equal(await blockedPage.locator('html').getAttribute('data-theme'), 'light');
    await blocked.close();
    console.log('PASS: themes, focus, fields, disabled/loading, nested dialogs, dismissal guards, portalled notices/actions, focus return, mobile bounds, reduced motion, sign-in/signup, public booking and blocked storage.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
