import assert from 'node:assert/strict';
import test from 'node:test';
import { toDisplay, fromDisplay, insertPhoto } from '../lib/marketingPhotos.mjs';

const BUCKET = 'https://x.supabase.co/storage/v1/object/public/marketing-images/11111111-1111-4111-8111-111111111111/';
const A = BUCKET + '22222222-2222-4222-8222-222222222222.jpg';
const B = BUCKET + '33333333-3333-4333-8333-333333333333.gif';

test('photos show as short numbered markers', () => {
  assert.deepEqual(toDisplay(`Hi\n\n![](${A})\n\nThanks\n\n![](${B})`), { text: 'Hi\n\n[Photo 1]\n\nThanks\n\n[Photo 2]', urls: [A, B] });
  const outside = `See ![](${A}) inline\n\n![](https://evil.test/a.jpg)`;
  assert.deepEqual(toDisplay(outside), { text: outside, urls: [] });
});

test('editing the message keeps photos and blank lines', () => {
  for (const body of ['Hi', '', `Hello\n\n\n\n![](${A})`, `![](${A})\n\n\n\nfoo\n`, `a\n\n![](${A})\n\n![](${B})\n\nb`]) {
    const { text, urls } = toDisplay(body);
    assert.equal(fromDisplay(text, urls), body);
  }
  const { urls } = toDisplay(`Hi\n\n![](${A})\n\nThanks`);
  assert.equal(fromDisplay('Hi there\n\n[Photo 1]\n\nThanks', urls), `Hi there\n\n![](${A})\n\nThanks`);
});

test('deleting a marker removes the photo; unknown markers stay as text', () => {
  const { urls } = toDisplay(`Hi\n\n![](${A})\n\n![](${B})`);
  assert.equal(fromDisplay('Hi\n\n[Photo 2]', urls), `Hi\n\n![](${B})`);
  assert.equal(fromDisplay('Hi [Photo 9]', urls), 'Hi [Photo 9]');
});

test('a marker typed mid-line still becomes its own paragraph', () => {
  assert.equal(fromDisplay('Look[Photo 1]here', [A]), `Look\n\n![](${A})\n\nhere`);
  assert.equal(fromDisplay('Look\n[Photo 1]', [A]), `Look\n\n![](${A})`);
});

test('adding a photo puts a marker at the cursor on its own line', () => {
  const body = 'Hi Sam,\n\nFlash day soon.\n\nThanks';
  const { body: next, cursor } = insertPhoto(body, 'Hi Sam,\n\nFlash day soon.'.length, A);
  assert.equal(next, `Hi Sam,\n\nFlash day soon.\n\n![](${A})\n\nThanks`);
  const shown = toDisplay(next).text;
  assert.equal(shown.slice(0, cursor), 'Hi Sam,\n\nFlash day soon.\n\n[Photo 1]');
  assert.equal(insertPhoto('', 0, A).body, `![](${A})`);
  // Positions are in the message as shown, so earlier photos count as markers.
  const two = insertPhoto(`![](${A})\n\nEnd`, '[Photo 1]\n\nEnd'.length, B);
  assert.equal(two.body, `![](${A})\n\nEnd\n\n![](${B})`);
  assert.equal(toDisplay(two.body).text.slice(0, two.cursor), '[Photo 1]\n\nEnd\n\n[Photo 2]');
});
