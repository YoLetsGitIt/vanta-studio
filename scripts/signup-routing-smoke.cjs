// Build and serve out/ before running. No real signup/payment requests are made.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      const waitForRoute = path => {
        const expected = new URL(path, base);
        return page.waitForURL(url => url.origin === expected.origin
          && url.pathname.replace(/\/$/, '') === expected.pathname.replace(/\/$/, '')
          && url.search === expected.search && url.hash === expected.hash);
      };
      const errors = [], completions = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        if (new URL(request.url()).origin === new URL(base).origin) return route.continue();
        if (new URL(request.url()).pathname === '/studio/signup/email-availability') {
          const headers = { 'access-control-allow-origin': new URL(base).origin,
            'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
          return route.fulfill({ status: request.method() === 'OPTIONS' ? 204 : 200, headers, body: request.method() === 'OPTIONS' ? '' : '{}' });
        }
        if (new URL(request.url()).pathname === '/studio/signup/complete') {
          const headers = { 'access-control-allow-origin': new URL(base).origin,
            'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          completions.push(request.postDataJSON());
          return route.fulfill({ status: 400, headers, json: { error: 'Checkout return verified' } });
        }
        return route.fulfill({ status: 200, json: {} });
      });

      assert.equal((await page.goto(base + '/')).status(), 200);
      await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
      const backToStudio = page.getByRole('link', { name: 'Back to studio', exact: true });
      assert.equal(new URL(await backToStudio.getAttribute('href')).pathname, '/studio');
      await page.goto(base + '/signup/');
      await page.getByRole('heading', { name: 'Start your free trial', exact: true }).waitFor();
      assert.equal(await page.locator('[data-phase], .studio-visit').count(), 0);
      await page.reload();
      await page.getByRole('heading', { name: 'Start your free trial', exact: true }).waitFor();

      assert.equal(await page.getByText('Everything your studio needs', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Back', exact: true }).count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/signup-simplified-${viewport.width}.png`, fullPage: true });
      await page.getByLabel('Email', { exact: false }).fill('preview@example.com');
      await page.getByLabel('Password', { exact: false }).first().fill('preview-only-password');
      await page.getByLabel('Confirm password', { exact: false }).fill('different-password');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Passwords do not match' }).waitFor();
      await page.getByLabel('Confirm password', { exact: false }).fill('preview-only-password');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Search for your studio').waitFor();
      assert(await backToStudio.isVisible());
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      assert.equal(await page.getByLabel('Email', { exact: false }).inputValue(), 'preview@example.com');

      await page.goto(base + '/?signup');
      await waitForRoute('/signup?signup');
      await page.getByRole('heading', { name: 'Start your free trial', exact: true }).waitFor();
      await page.goto(base + '/?signin');
      await waitForRoute('/signin?signin');
      await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
      assert(await backToStudio.isVisible());

      await page.goto(base + '/?signup=complete&session_id=preview_session#return');
      await waitForRoute('/signup?signup=complete&session_id=preview_session#return');
      await page.getByText('Checkout return verified', { exact: true }).waitFor();
      assert.deepEqual(completions, [{ session_id: 'preview_session' }]);
      assert.deepEqual(errors, []);
      console.log(`PASS ${viewport.width}: account entry, direct signup/reload, legacy links, public return link, account validation, mocked checkout return`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
