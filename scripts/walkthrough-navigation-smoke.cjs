// Build and serve out/ first. Exercises the modal header with real pointer and keyboard input.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const page = await browser.newPage({ viewport, reducedMotion });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/design/studio-walkthrough.html');
        const root = page.locator('[data-phase]').first();
        await root.evaluate(el => { el.scrollTop = el.clientHeight; });
        const dialog = page.getByRole('dialog', { name: 'Choose your Vanta experience' });
        await dialog.waitFor();
        const explore = page.getByRole('button', { name: 'Explore Vanta' });
        assert.equal(await explore.count(), 1);
        assert(await dialog.getByRole('button', { name: 'Explore Vanta' }).isVisible());
        await page.screenshot({ path: `/tmp/vanta-navigation-${viewport.width}-${reducedMotion}.png` });
        if (reducedMotion === 'reduce') {
          await page.keyboard.press('Tab');
          assert(await page.getByRole('button', { name: 'I’m a studio owner' }).evaluate(el => el === document.activeElement));
          await page.keyboard.press('Shift+Tab');
          assert(await explore.evaluate(el => el === document.activeElement));
          await page.keyboard.press('Enter');
        } else {
          await explore.click();
        }
        await page.waitForFunction(() => {
          const el = document.querySelector('[data-phase]');
          return el.dataset.audience === 'owner' && el.dataset.phase === 'form' && el.dataset.audienceOpen === 'false';
        });
        assert.equal(await page.locator('dialog[open]').count(), 0);
        await page.getByRole('button', { name: 'See the studio' }).click();
        await page.getByRole('button', { name: 'Explore features' }).waitFor();
        await page.getByRole('button', { name: 'Explore features' }).click();
        await page.waitForFunction(() => document.querySelector('#studio-features')?.getAttribute('aria-hidden') === 'false');

        // The other choice and Escape remain available in the same modal.
        await page.goto(base + '/design/studio-walkthrough.html');
        await root.evaluate(el => { el.scrollTop = el.clientHeight; });
        await dialog.waitFor();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('[data-phase]')?.dataset.audienceOpen === 'false');
        await root.evaluate(el => { el.scrollTop = el.clientHeight; });
        await dialog.waitFor();
        await page.getByRole('button', { name: 'I’m an artist' }).click();
        await page.waitForFunction(() => document.querySelector('[data-phase]')?.dataset.audience === 'artist');
        assert.equal(await page.locator('dialog[open]').count(), 0);
        assert.deepEqual(errors, []);
        console.log(`PASS ${viewport.width} ${reducedMotion}: Explore Vanta, studio/features navigation, Escape and artist choice`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
