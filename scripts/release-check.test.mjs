import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetRefs, builtPages, missingAssets, pageURL, stalePages } from './release-check.mjs';

const page = (...assets) => `<html><head>${assets.map(a => a.endsWith('.css') ? `<link href="${a}">` : `<script src="${a}"></script>`).join('')}</head>
  <script>self.__next_f.push([1,"0:[\\"$\\",\\"script\\",{\\"src\\":\\"${assets[0]}\\"}]"])</script></html>`;

test('a page lists every script and stylesheet it loads, once each', () => {
  const html = page('/_next/static/chunks/7812-abc.js', '/_next/static/chunks/app/dashboard/schedule/page-111.js', '/_next/static/css/a1.css');
  assert.deepEqual(assetRefs(html), [
    '/_next/static/chunks/7812-abc.js',
    '/_next/static/chunks/app/dashboard/schedule/page-111.js',
    '/_next/static/css/a1.css',
  ]);
});

test('a page whose own chunk matches but a shared chunk is old counts as stale', () => {
  const built = ['/_next/static/chunks/7812-new.js', '/_next/static/chunks/app/dashboard/schedule/page-111.js'];
  const live = page('/_next/static/chunks/7812-old.js', '/_next/static/chunks/app/dashboard/schedule/page-111.js');
  assert.deepEqual(missingAssets(built, live), ['/_next/static/chunks/7812-new.js']);
  assert.deepEqual(missingAssets(built, page(...built)), []);
});

test('built files map to the URLs they are served at', () => {
  const siblings = new Set(['signin.html', 'signin/index.html', 'design/studio-visit/index.html']);
  assert.equal(pageURL('index.html'), '/');
  assert.equal(pageURL('404.html'), '/404.html');
  assert.equal(pageURL('studio-booking.html'), '/studio-booking');
  assert.equal(pageURL('dashboard/schedule.html'), '/dashboard/schedule');
  assert.equal(pageURL('signin/index.html', siblings), null);
  assert.equal(pageURL('design/studio-visit/index.html', siblings), '/design/studio-visit/');
});

test('every built page outside /_next is checked, including the public booking form', async () => {
  const out = mkdtempSync(join(tmpdir(), 'release-check-'));
  mkdirSync(join(out, 'dashboard'));
  mkdirSync(join(out, '_next/static/chunks'), { recursive: true });
  writeFileSync(join(out, 'dashboard/schedule.html'), page('/_next/static/chunks/7812-new.js'));
  writeFileSync(join(out, 'studio-booking.html'), page('/_next/static/chunks/booking-new.js'));
  writeFileSync(join(out, '_next/static/chunks/ignored.html'), page('/_next/static/chunks/x.js'));
  const pages = builtPages(out);
  assert.deepEqual(pages.map(p => p.url), ['/dashboard/schedule', '/studio-booking']);

  const live = { '/dashboard/schedule': page('/_next/static/chunks/7812-new.js'), '/studio-booking': page('/_next/static/chunks/booking-old.js') };
  const stale = await stalePages('https://studio.example', pages, async url => live[new URL(url).pathname]);
  assert.deepEqual(stale, [{ url: '/studio-booking', missing: ['/_next/static/chunks/booking-new.js'] }]);
});
