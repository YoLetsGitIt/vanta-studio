// Local production preview; every external request is intercepted. No live data writes.
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3028';
const screenshots = process.env.STUDIO_SCREENSHOT_DIR || '../artifacts/studio-import-2026-10-28';
const fixture = name => ({ name: `${name}.csv`, mimeType: 'text/csv', buffer: readFileSync(`${__dirname}/fixtures/import/${name}.csv`) });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROMIUM_EXECUTABLE ? { executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE } : {}) });
  mkdirSync(screenshots, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      // The operator is in another timezone; the studio's Melbourne timezone must win.
      const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'America/New_York' });
      await setup(context);
      const requests = [], errors = [];
      let interruptSecondBatch = false;
      await context.route('**/studio/me/import', async route => {
        const payload = route.request().postDataJSON();
        requests.push(payload);
        if (interruptSecondBatch && requests.length === 2) return route.fulfill({ status: 503, json: { error: 'Test connection interruption' } });
        const kind = payload.clients ? 'clients' : 'appointments';
        return route.fulfill({ json: { [kind]: { imported: payload[kind].length, linked: 0, skipped: 0 }, errors: [] } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-28T00:00:00Z'));
      await page.goto(`${base}/dashboard/import.html`, { waitUntil: 'networkidle' });
      await page.locator('input[type=file]').setInputFiles({ name: 'broken.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Name\nAlex,Alex') });
      await page.getByRole('alert').getByText(/column names must be unique/).waitFor();
      await page.locator('input[type=file]').setInputFiles(fixture('acuity-appointments'));
      assert.equal(await page.getByRole('combobox', { name: 'Source', exact: true }).inputValue(), 'acuity');
      assert.equal(await page.getByLabel('Import timezone', { exact: true }).inputValue(), 'Australia/Melbourne');
      await page.getByRole('button', { name: 'Preview import', exact: true }).click();
      await page.getByText('3 rows excluded', { exact: true }).waitFor();
      const table = page.getByRole('table', { name: 'Import preview' });
      assert.equal(await table.locator('tbody tr').count(), 1);
      assert.match(await table.innerText(), /30 Oct 2030/);
      assert.match(await table.innerText(), /10:00 am/i);
      assert.match(await table.innerText(), /Sam Anderson/);
      assert.equal(requests.length, 0, 'Preview must not write data');
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download all problems', exact: true }).click();
      assert.equal((await download).suggestedFilename(), 'import-problems.csv');
      await page.screenshot({ path: `${screenshots}/acuity-preview-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Page fits the viewport');
      await page.getByRole('button', { name: 'Import 1 row', exact: true }).click();
      await page.getByRole('button', { name: 'Import another file', exact: true }).waitFor();
      assert.equal(requests[0].appointments[0].chosen_time, '2030-10-29T23:00:00.000Z');
      assert.equal(requests[0].appointments[0].duration_minutes, 90);
      assert.equal(requests[0].appointments[0].price, 450);

      await page.getByRole('button', { name: 'Import another file', exact: true }).click();
      await page.locator('input[type=file]').setInputFiles(fixture('jotform-clients'));
      assert.equal(await page.getByRole('combobox', { name: 'Source', exact: true }).inputValue(), 'jotform');
      await page.getByRole('button', { name: 'Preview import', exact: true }).click();
      await page.getByRole('button', { name: 'Import 2 rows', exact: true }).click();
      await page.getByRole('button', { name: 'Import another file', exact: true }).waitFor();
      assert.equal(requests[1].clients[1].email, '');
      assert.equal(requests[1].clients[1].phone, '0412000001');

      await page.getByRole('button', { name: 'Import another file', exact: true }).click();
      await page.locator('input[type=file]').setInputFiles(fixture('jotform-appointments'));
      await page.getByRole('button', { name: 'Preview import', exact: true }).click();
      await page.getByText(/1 ready bookings will be unassigned/).waitFor();
      await page.getByRole('button', { name: 'Import 2 rows', exact: true }).click();
      await page.getByRole('button', { name: 'Import another file', exact: true }).waitFor();
      assert.equal(requests[2].appointments[1].artist_id, '');
      assert.equal(requests[2].appointments[0].status, 'confirmed');

      // Resume a large import without replaying the first completed batch.
      requests.length = 0;
      interruptSecondBatch = true;
      await page.getByRole('button', { name: 'Import another file', exact: true }).click();
      const largeCSV = ['Name,Email', ...Array.from({ length: 401 }, (_, i) => `Client ${i},client${i}@example.test`)].join('\n');
      await page.locator('input[type=file]').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(largeCSV) });
      await page.getByRole('button', { name: 'Preview import', exact: true }).click();
      await page.getByRole('button', { name: 'Import 401 rows', exact: true }).click();
      await page.getByRole('button', { name: 'Retry remaining batches', exact: true }).waitFor();
      await page.getByText('200 of 401 rows processed in completed batches.', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Retry remaining batches', exact: true }).click();
      await page.getByRole('button', { name: 'Import another file', exact: true }).waitFor();
      assert.deepEqual(requests.map(body => body.clients[0].email), ['client0@example.test', 'client200@example.test', 'client200@example.test', 'client400@example.test']);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: Acuity, Jotform, phone-only clients, timezone, exclusions, reports, artist review and interrupted-batch retry.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
