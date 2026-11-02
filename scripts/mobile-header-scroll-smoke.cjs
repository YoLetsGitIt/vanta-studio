// Phones: the top bar slides away while scrolling down and returns on scroll up.
// Uses the shared dashboard fixtures. Serve out/ with clean URLs on STUDIO_TEST_URL first.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3058';
const shots = process.env.STUDIO_QA_OUTPUT;

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await setup(context);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/dashboard/settings?tab=requests`, { waitUntil: 'networkidle' });
    const header = page.locator('.studio-mobile-header');
    const main = page.locator('.studio-dashboard-main');
    const headerBottom = async () => { const b = await header.boundingBox(); return b.y + b.height; };
    const settle = () => page.waitForTimeout(320);
    // Content starts below the bar, not under it.
    const firstTop = await page.locator('.studio-settings-page h1').boundingBox();
    assert(firstTop.y >= await headerBottom() - 1, `content under the bar: ${firstTop.y}`);
    // Scroll down: the bar slides away.
    await main.evaluate(el => el.scrollBy(0, 600)); await settle();
    assert(await headerBottom() <= 1, 'bar hidden after scrolling down');
    if (shots) await page.screenshot({ path: `${shots}/header-hidden.png` });
    // A small scroll up brings it back.
    await main.evaluate(el => el.scrollBy(0, -40)); await settle();
    assert(await headerBottom() > 40, 'bar back after scrolling up');
    // Down again, then back to the top: visible.
    await main.evaluate(el => el.scrollBy(0, 400)); await settle();
    assert(await headerBottom() <= 1);
    await main.evaluate(el => el.scrollTo(0, 0)); await settle();
    assert(await headerBottom() > 40, 'bar visible at the top');
    // Changing page always shows the bar.
    await main.evaluate(el => el.scrollBy(0, 600)); await settle();
    await page.getByRole('link', { name: /Clients/ }).first().click();
    await page.waitForURL(/clients/); await settle();
    assert(await headerBottom() > 40, 'bar visible on a new page');
    assert.deepEqual(errors, []);
    console.log('PASS phone top bar hides on scroll down, returns on scroll up');
    await context.close();

    // Desktop: no phone bar, nothing moves.
    const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setup(desk);
    const d = await desk.newPage();
    await d.goto(`${base}/dashboard/settings?tab=requests`, { waitUntil: 'networkidle' });
    assert.equal(await d.locator('.studio-mobile-header').isVisible(), false);
    const pad = await d.locator('.studio-dashboard-main').evaluate(el => getComputedStyle(el).paddingTop);
    assert.equal(pad, '0px', `desktop main padding: ${pad}`);
    console.log('PASS desktop unaffected');
    await desk.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
