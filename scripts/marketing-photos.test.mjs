import assert from 'node:assert/strict';
import test from 'node:test';
import { toDisplay, fromDisplay, insertPhoto, photoName } from '../lib/marketingPhotos.mjs';

const BUCKET = 'https://x.supabase.co/storage/v1/object/public/marketing-images/11111111-1111-4111-8111-111111111111/';
const A = BUCKET + '22222222-2222-4222-8222-222222222222.jpg';
const B = BUCKET + '33333333-3333-4333-8333-333333333333.gif';

test('photos show as their file name', () => {
  const shown = toDisplay(`Hi\n\n![flash.jpg](${A})\n\nThanks\n\n![](${B})`);
  assert.equal(shown.text, 'Hi\n\n[flash.jpg]\n\nThanks\n\n[Photo]');
  const outside = `See ![](${A}) inline\n\n![x.jpg](https://evil.test/a.jpg)`;
  assert.equal(toDisplay(outside).text, outside);
});

test('editing the message keeps photos, names and blank lines', () => {
  for (const body of ['Hi', '', `Hello\n\n\n\n![a.jpg](${A})`, `![](${A})\n\n\n\nfoo\n`, `a\n\n![a.jpg](${A})\n\n![b.gif](${B})\n\nb`]) {
    const { text, photos } = toDisplay(body);
    assert.equal(fromDisplay(text, photos), body);
  }
  const { photos } = toDisplay(`Hi\n\n![a.jpg](${A})\n\nThanks`);
  assert.equal(fromDisplay('Hi there\n\n[a.jpg]\n\nThanks', photos), `Hi there\n\n![a.jpg](${A})\n\nThanks`);
});

test('deleting a name removes that photo; other bracketed text stays text', () => {
  const { photos } = toDisplay(`Hi\n\n![a.jpg](${A})\n\n![b.gif](${B})`);
  assert.equal(fromDisplay('Hi\n\n[b.gif]', photos), `Hi\n\n![b.gif](${B})`);
  assert.equal(fromDisplay('Hi [note] [c.png]', photos), 'Hi [note] [c.png]');
});

test('a name typed mid-line still becomes its own paragraph', () => {
  const photos = [{ url: A, caption: 'a.jpg' }];
  assert.equal(fromDisplay('Look[a.jpg]here', photos), `Look\n\n![a.jpg](${A})\n\nhere`);
});

test('file names are cleaned up and kept unique', () => {
  assert.equal(photoName('flash [final]\n.jpg', []), 'flash (final) .jpg');
  assert.equal(photoName('   ', []), 'Photo');
  assert.equal(photoName('image.png', ['image.png']), 'image (2).png');
  assert.equal(photoName('image.png', ['image.png', 'image (2).png']), 'image (3).png');
  assert.equal(photoName('scan', ['scan']), 'scan (2)');
  assert.ok(photoName('x'.repeat(500) + '.jpg', []).length <= 100);
});

test('adding a photo puts its name at the cursor on its own line', () => {
  const body = 'Hi Sam,\n\nFlash day soon.\n\nThanks';
  const { body: next, cursor } = insertPhoto(body, 'Hi Sam,\n\nFlash day soon.'.length, A, 'flash.jpg');
  assert.equal(next, `Hi Sam,\n\nFlash day soon.\n\n![flash.jpg](${A})\n\nThanks`);
  assert.equal(toDisplay(next).text.slice(0, cursor), 'Hi Sam,\n\nFlash day soon.\n\n[flash.jpg]');
  assert.equal(insertPhoto('', 0, A, 'a.jpg').body, `![a.jpg](${A})`);
  const two = insertPhoto(`![a.jpg](${A})\n\nEnd`, 0, B, 'a.jpg');
  assert.equal(two.body, `![a (2).jpg](${B})\n\n![a.jpg](${A})\n\nEnd`);
  assert.equal(toDisplay(two.body).text.slice(0, two.cursor), '[a (2).jpg]');
});
