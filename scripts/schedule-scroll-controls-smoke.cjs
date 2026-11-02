// Exercise real browser scrolling; all remote services are isolated fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3036';
const output = path.resolve(__dirname, '../../artifacts/schedule-scroll-controls-2026-10-29');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE });
  const results = [];
  try {
    for (const [width, height, touch, theme, reducedMotion] of [
      [390, 900, true, 'dark', 'no-preference'], [320, 900, true, 'light', 'no-preference'],
      [844, 390, true, 'dark', 'no-preference'], [1440, 650, false, 'light', 'no-preference'],
      [844, 390, true, 'light', 'reduce'],
    ]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion, timezoneId: 'Australia/Melbourne' });
      await setup(context);
      await context.addInitScript(value => localStorage.setItem('vanta-theme', value), theme);
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/dashboard/schedule`, { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        window.scrollChecks = [];
        for (const name of ['wheel', 'scroll']) document.querySelector('.studio-schedule-page').addEventListener(name, event => {
          const scroller = event.target.closest('.studio-calendar-scroll');
          window.scrollChecks.push({ name, deltaY: event.deltaY, top: scroller?.scrollTop, height: scroller?.clientHeight, collapsed: document.querySelector('.studio-schedule-page').dataset.controlsCollapsed });
        }, { capture: true, passive: true });
      });
      const frame = page.locator('.studio-schedule-page');
      async function choose(view) {
        const select = page.getByRole('combobox', { name: 'Calendar view', exact: true });
        if (await select.isVisible()) await select.selectOption(`${view}:artist`);
        else await page.getByRole('button', { name: view[0].toUpperCase() + view.slice(1), exact: true }).click();
      }
      async function state(collapsed) {
        try { await page.waitForFunction(value => document.querySelector('.studio-schedule-page')?.dataset.controlsCollapsed === String(value), collapsed); }
        catch (error) { console.error(await page.evaluate(() => window.scrollChecks)); throw error; }
        await page.waitForTimeout(reducedMotion === 'reduce' ? 40 : 240);
      }
      async function wheel(scroller, dx, dy) {
        const box = await scroller.boundingBox();
        await page.mouse.move(box.x + Math.min(100, box.width / 2), box.y + Math.min(100, box.height / 2));
        await page.mouse.wheel(dx, dy);
      }
      await choose('week');
      const week = page.getByRole('region', { name: 'Weekly schedule' });
      await week.waitFor();
      await state(false);
      const expanded = await week.boundingBox();
      // Programmatic initial positioning and horizontal panning must not hide controls.
      await week.evaluate(el => { el.scrollTop = 180; }); await page.waitForTimeout(150);
      assert.equal(await frame.getAttribute('data-controls-collapsed'), 'false');
      await week.evaluate(el => { el.scrollTop = 0; }); await page.waitForTimeout(150);
      await wheel(week, 180, 0); await page.waitForTimeout(150);
      assert.equal(await frame.getAttribute('data-controls-collapsed'), 'false');
      await week.evaluate(el => { el.scrollLeft = 0; });
      await page.screenshot({ path: path.join(output, `expanded-${width}-${theme}.png`) });
      await wheel(week, 0, 180); await state(true);
      const collapsed = await week.boundingBox();
      assert.ok(collapsed.y < expanded.y - 35, 'Controls must release actual calendar space');
      assert.ok(collapsed.height > expanded.height + 35, 'More time slots should be visible');
      const heading = await week.locator('section').first().getByRole('button').first().boundingBox();
      assert.ok(Math.abs(heading.y - collapsed.y) <= 2, 'Day/date headings must stay pinned');
      assert.equal(await page.getByRole('combobox', { name: 'Filter weekly schedule' }).count(), 0, 'Hidden controls must be removed from accessibility navigation');
      await page.screenshot({ path: path.join(output, `collapsed-${width}-${theme}.png`) });
      await wheel(week, 180, 0); await page.waitForTimeout(150);
      assert.equal(await frame.getAttribute('data-controls-collapsed'), 'true');
      await wheel(week, 0, -80); await state(false);
      await page.getByRole('combobox', { name: 'Filter weekly schedule' }).selectOption('artist-1');
      await page.getByRole('combobox', { name: 'Filter weekly schedule' }).selectOption('all');
      await wheel(week, 0, 10000); await state(true);
      await page.waitForTimeout(300);
      assert.equal(await frame.getAttribute('data-controls-collapsed'), 'true', 'Resizing/clamping at the bottom must not reopen controls');
      await week.focus(); await page.keyboard.press('PageUp'); await state(false);
      // Actual touch scrolling, including momentum, should use the same behavior.
      if (touch) {
        await week.evaluate(el => { el.scrollTop = 80; el.scrollLeft = 0; }); await page.waitForTimeout(1700);
        const box = await week.boundingBox(), cdp = await context.newCDPSession(page);
        const x = box.x + 100, from = box.y + box.height - 25, to = box.y + 35;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] });
        for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: from + (to - from) * i / 8 }] }); await page.waitForTimeout(25); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await state(true);
        await page.waitForTimeout(500);
        await wheel(week, 0, -10000); await state(false);
        await cdp.detach();
      }
      const next = page.getByRole('button', { name: 'Next week', exact: true });
      await next.click(); await state(false); await week.waitFor();
      await page.getByRole('button', { name: 'Previous week', exact: true }).click(); await state(false); await week.waitFor();
      await choose('day');
      const day = page.locator('.studio-calendar-scroll'); await day.waitFor();
      await wheel(day, 0, 200); await state(true);
      await wheel(day, 0, -100); await state(false);
      await choose('month'); await state(false);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow');
      assert.deepEqual(errors, []);
      results.push({ width, height, touch, theme, reducedMotion, directionChanges: true, pinnedDates: true, horizontalIgnored: true, programmaticIgnored: true, bottomStable: true, keyboard: true, filters: true, dayAndWeek: true });
      console.log(`PASS schedule scrolling ${width}x${height} ${theme} ${reducedMotion}`);
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
