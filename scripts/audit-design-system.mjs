import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function filesIn(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(file));
    else if (/\.(js|css)$/.test(entry.name)) files.push(file);
  }
  return files;
}
const patterns = {
  styles: /style=\{/g,
  colours: /#[0-9a-fA-F]{3,8}\b|rgba?\(/g,
  shared: /components\/ui\/|var\(--/g,
  labels: /aria-(?:label|labelledby|describedby|pressed|selected|current)|htmlFor=/g,
};
const files = (await Promise.all(['app', 'components'].map(dir => filesIn(path.join(root, dir))))).flat().sort();
const lines = ['# Studio design-system source inventory', '',
  'Run `node scripts/audit-design-system.mjs` to refresh. Counts flag review candidates, not defects: chart colours, image geometry and deliberate dense data layouts can be appropriate. This scans all app and component JS/CSS, including the development-only gallery.', '',
  '| File | Inline styles | Colour literals | Shared UI/token references | Explicit labels/states |',
  '| --- | ---: | ---: | ---: | ---: |'];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const counts = Object.values(patterns).map(pattern => [...source.matchAll(pattern)].length);
  lines.push(`| \`${path.relative(root, file)}\` | ${counts.join(' | ')} |`);
}
await mkdir(path.join(root, 'docs'), { recursive: true });
await writeFile(path.join(root, 'docs/design-inventory.md'), `${lines.join('\n')}\n`);
console.log(`Inventoried ${files.length} app/component sources.`);
