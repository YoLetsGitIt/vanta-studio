// Is the live site serving the build in out/? Used by release.mjs after publishing.
//
// Every published page is checked, and every script and stylesheet it loads, not just
// the page's own chunk: a change inside a shared chunk (the booking panel lives in one)
// leaves each page's own chunk unchanged, so checking only those can report "live"
// while visitors still get the old shared code.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// The /_next/static scripts and stylesheets a page loads.
export function assetRefs(html) {
  return [...new Set(html.match(/\/_next\/static\/[A-Za-z0-9_\-./%[\]]+?\.(?:js|css)/g) ?? [])].sort();
}

// Where a built file is served. Folder index.html copies (signin/index.html beside
// signin.html) serve the same page, so they're skipped when the sibling exists.
export function pageURL(file, siblings = new Set()) {
  const path = file.replace(/\\/g, '/');
  if (path === 'index.html') return '/';
  if (path === '404.html') return '/404.html';
  if (path.endsWith('/index.html')) {
    const dir = path.slice(0, -'/index.html'.length);
    return siblings.has(`${dir}.html`) ? null : `/${dir}/`;
  }
  return `/${path.slice(0, -'.html'.length)}`;
}

// Every page in the build and the assets each one should load: [{ url, assets }].
export function builtPages(outDir) {
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '_next') walk(full); }
      else if (entry.name.endsWith('.html')) files.push(relative(outDir, full).replace(/\\/g, '/'));
    }
  };
  walk(outDir);
  const siblings = new Set(files);
  return files.sort().flatMap(file => {
    const url = pageURL(file, siblings);
    const assets = assetRefs(readFileSync(join(outDir, file), 'utf8'));
    return url && assets.length ? [{ url, assets }] : [];
  });
}

// The assets the live page doesn't load yet (empty when it's up to date).
export function missingAssets(expected, liveHtml) {
  const live = new Set(assetRefs(liveHtml));
  return expected.filter(asset => !live.has(asset));
}

// Pages whose live HTML is still the old build: [{ url, missing }].
export async function stalePages(site, pages, fetchPage = url => fetch(url).then(r => r.text())) {
  const stale = [];
  for (const { url, assets } of pages) {
    try {
      const html = await fetchPage(`${site}${url}${url.includes('?') ? '&' : '?'}release=${Date.now()}`);
      const missing = missingAssets(assets, html);
      if (missing.length) stale.push({ url, missing });
    } catch {
      stale.push({ url, missing: ['(page did not load)'] });
    }
  }
  return stale;
}
