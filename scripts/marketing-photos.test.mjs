import assert from 'node:assert/strict';
import test from 'node:test';
import { toBlocks, fromBlocks, insertPhotoAt, removePhotoAt } from '../lib/marketingPhotos.mjs';

const BUCKET = 'https://x.supabase.co/storage/v1/object/public/marketing-images/11111111-1111-4111-8111-111111111111/';
const A = BUCKET + '22222222-2222-4222-8222-222222222222.jpg';
const B = BUCKET + '33333333-3333-4333-8333-333333333333.gif';

test('a message splits into text and photos, always with text around each photo', () => {
  assert.deepEqual(toBlocks(`Hi\n\n![](${A})\n\nThanks`), [
    { type: 'text', text: 'Hi' }, { type: 'photo', url: A, caption: '' }, { type: 'text', text: 'Thanks' },
  ]);
  assert.deepEqual(toBlocks(`![Sheet](${A})\n\n![](${B})`), [
    { type: 'text', text: '' }, { type: 'photo', url: A, caption: 'Sheet' }, { type: 'text', text: '' },
    { type: 'photo', url: B, caption: '' }, { type: 'text', text: '' },
  ]);
});

test('only Vanta photos on their own line become photos', () => {
  const body = `See ![](${A}) inline\n\n![](https://evil.test/a.jpg)`;
  assert.deepEqual(toBlocks(body), [{ type: 'text', text: body }]);
});

test('editing text never loses blank lines', () => {
  for (const body of ['Hi', '', `Hello\n\n\n\n![](${A})`, `![](${A})\n\n\n\nfoo\n`, `a\n\n![](${A})\n\n![](${B})\n\nb`]) {
    assert.equal(fromBlocks(toBlocks(body)), body);
  }
  const blocks = toBlocks(`Hi\n\n![](${A})`);
  blocks[0] = { type: 'text', text: 'Hi there\n\n' };
  assert.equal(toBlocks(fromBlocks(blocks))[0].text, 'Hi there\n\n');
});

test('a photo goes in at the cursor and removing it joins the text back up', () => {
  const blocks = toBlocks('Hi Sam,\n\nFlash day soon.\n\nThanks');
  const at = 'Hi Sam,\n\nFlash day soon.'.length;
  const added = insertPhotoAt(blocks, 0, at, A);
  assert.equal(fromBlocks(added), `Hi Sam,\n\nFlash day soon.\n\n![](${A})\n\nThanks`);
  assert.equal(fromBlocks(removePhotoAt(added, 1)), 'Hi Sam,\n\nFlash day soon.\n\nThanks');
  assert.equal(fromBlocks(insertPhotoAt(toBlocks(''), 0, 0, A)), `![](${A})`);
});
