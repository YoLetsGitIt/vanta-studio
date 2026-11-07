#!/usr/bin/env node
// One-step release of studio.vanta.tattoo:
//   npm run release -- "What changed"
//
// 1. Commits your changes with that message.
// 2. Catches up with anything newer on GitHub (stops if it can't merge cleanly).
// 3. Checks the live site was last deployed from code you have, so you can't
//    overwrite someone else's deploy by accident.
// 4. Builds, pushes to main, and publishes to GitHub Pages in add-only mode
//    (-a), which keeps the live pages that aren't in this code (signup, demos).
// 5. Waits until the live site serves the new build.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const SITE = 'https://studio.vanta.tattoo';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = cmd => execSync(cmd, { encoding: 'utf8' }).trim();
const step = text => console.log(`\n▸ ${text}`);
function fail(text) {
  console.error(`\n✗ ${text}`);
  process.exit(1);
}
async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

const message = process.argv.slice(2).join(' ').trim();

// ── Where are we ────────────────────────────────────────────────────────────
try { out('git rev-parse --is-inside-work-tree'); } catch { fail('Run this from the vanta-studio folder.'); }
if (!existsSync('.env.local')) fail('.env.local is missing. Copy it from the main vanta-studio folder first; the build needs it.');

// ── 1. Commit ───────────────────────────────────────────────────────────────
// node_modules can be a symlink in a worktree, which .gitignore's "node_modules/" doesn't cover.
const changes = out("git status --porcelain -- . ':!node_modules'");
if (changes) {
  if (!message) fail('You have changes. Say what changed:  npm run release -- "Wider booking panel"');
  step('Committing your changes');
  console.log(changes);
  run("git add -A -- . ':!node_modules'");
  run(`git commit -q -m ${JSON.stringify(message)}`);
}

// ── 2. Catch up with GitHub ─────────────────────────────────────────────────
step('Checking GitHub for newer changes');
run('git fetch -q origin main gh-pages');
const behind = Number(out('git rev-list --count HEAD..origin/main'));
if (behind > 0) {
  console.log(`  ${behind} newer commit(s) on GitHub; adding them under yours.`);
  try { run('git rebase -q origin/main'); }
  catch {
    try { run('git rebase --abort', { stdio: 'ignore' }); } catch { /* nothing to abort */ }
    fail('Your changes clash with newer changes on GitHub. Nothing was published. Ask Claude to merge them.');
  }
}

// ── 3. Is the live site from code we have? ──────────────────────────────────
const lastDeploy = out('git log -1 --format=%s origin/gh-pages');
const deployedSha = lastDeploy.match(/[Dd]eploy ([0-9a-f]{7,40})/)?.[1]; // also "Redeploy <sha>" nudges
const known = deployedSha && (() => { try { run(`git merge-base --is-ancestor ${deployedSha} HEAD`, { stdio: 'ignore' }); return true; } catch { return false; } })();
if (!known) {
  console.log(`\n⚠ The live site's last deploy was: "${lastDeploy}"`);
  console.log('  That build is not part of your code, so publishing may undo someone else\'s work.');
  if (!(await confirm('Publish anyway?'))) fail('Stopped. Nothing was published.');
}
if (deployedSha && out('git rev-parse HEAD').startsWith(deployedSha) && !changes) {
  console.log('\n✓ Nothing new: the live site already runs this code.');
  process.exit(0);
}

// ── 4. Build, push, publish ─────────────────────────────────────────────────
step('Building');
run('npx next build');
run('node scripts/prepare-static-routes.mjs');
writeFileSync('out/.nojekyll', '');

const sha = out('git rev-parse --short HEAD');
const subject = out('git log -1 --format=%s');
step('Pushing to GitHub (main)');
run('git push -q origin HEAD:main');

step('Publishing to studio.vanta.tattoo');
run(`npx gh-pages -d out -t -a -m ${JSON.stringify(`Deploy ${sha}: ${subject}`)}`);

// ── 5. Wait for it to go live ───────────────────────────────────────────────
// Check every dashboard page, not just one: a page that didn't change in this release
// would pass even while GitHub Pages is still serving the old build. GitHub Pages
// sometimes stalls; if pages are still stale after 2 minutes, publish a small marker
// file to make it rebuild (this has unstuck it every time so far).
step('Waiting for the live site to update');
const pages = readdirSync('out/dashboard').filter(f => f.endsWith('.html')).map(f => f.slice(0, -5));
const chunkFor = (html, page) => html.match(new RegExp(`/_next/static/chunks/app/dashboard/${page}/page-[a-z0-9]+\\.js`))?.[0];
const expected = Object.fromEntries(pages.map(p => [p, chunkFor(readFileSync(`out/dashboard/${p}.html`, 'utf8'), p)]).filter(([, c]) => c));
async function stalePages() {
  const stale = [];
  for (const [page, want] of Object.entries(expected)) {
    try {
      const html = await (await fetch(`${SITE}/dashboard/${page}?release=${Date.now()}`)).text();
      if (chunkFor(html, page) !== want) stale.push(page);
    } catch { stale.push(page); }
  }
  return stale;
}
let nudged = false;
for (let i = 0; i < 24; i++) {
  const stale = await stalePages();
  if (!stale.length) {
    console.log(`\n✓ Live: ${sha} "${subject}" (all ${Object.keys(expected).length} dashboard pages checked). Hard-refresh (Cmd + Shift + R) to see it.`);
    process.exit(0);
  }
  if (i === 8 && !nudged) {
    console.log(`  Still old after 2 minutes (${stale.join(', ')}). Nudging GitHub Pages to rebuild…`);
    writeFileSync('out/deploy-marker.txt', `redeploy ${sha} ${new Date().toISOString()}\n`);
    run(`npx gh-pages -d out -t -a -m ${JSON.stringify(`Redeploy ${sha} (Pages build stalled)`)}`);
    nudged = true;
  }
  await new Promise(r => setTimeout(r, 15000));
}
console.log('\n⚠ Published, but some pages still show the old build after 6 minutes.');
console.log('  Wait a few minutes and hard-refresh, or ask Claude to check the deploy.');
process.exit(1);
