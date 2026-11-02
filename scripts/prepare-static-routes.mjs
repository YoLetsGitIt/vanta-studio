import { copyFile, mkdir } from 'node:fs/promises';

// Simple static hosts resolve /signup to the existing public/signup directory.
// Give auth routes directory indexes as well as Next's flat HTML exports, while
// keeping all existing /signup image and video URLs intact.
for (const route of ['signup', 'signin']) {
  const directory = new URL(`../out/${route}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  await copyFile(new URL(`../out/${route}.html`, import.meta.url), new URL('index.html', directory));
}
console.log('Prepared static signup and signin page entries.');
