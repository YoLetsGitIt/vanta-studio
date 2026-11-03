// A marketing message is plain text; each photo is its own paragraph,
// ![caption](url). The editor shows it as blocks: text, photo, text, photo,
// text — always with a text block around each photo so there's somewhere to
// type. The backend renders only photos from the studio's marketing-images
// bucket (vanta-backend internal/marketing/images.go); this mirrors that.
const PHOTO = /(^|\n\n)!\[([^\]\n]{0,300})\]\((\S+)\)(?=\n\n|$)/g;
const OWN_PHOTO = /\/storage\/v1\/object\/public\/marketing-images\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|gif)$/;

export function toBlocks(body) {
  const text = String(body ?? '');
  const blocks = [];
  let last = 0;
  for (const m of text.matchAll(PHOTO)) {
    if (!OWN_PHOTO.test(m[3])) continue;
    blocks.push({ type: 'text', text: last <= m.index ? text.slice(last, m.index) : '' });
    blocks.push({ type: 'photo', url: m[3], caption: m[2].trim() });
    last = m.index + m[0].length;
    if (text.startsWith('\n\n', last)) last += 2;
  }
  blocks.push({ type: 'text', text: text.slice(last) });
  return blocks;
}

export function fromBlocks(blocks) {
  let out = '', afterPhoto = false;
  for (const block of blocks) {
    if (block.type === 'photo') {
      out += (out ? '\n\n' : '') + `![${block.caption || ''}](${block.url})`;
      afterPhoto = true;
    } else if (block.text) {
      out += (afterPhoto ? '\n\n' : '') + block.text;
      afterPhoto = false;
    }
  }
  return out;
}

// Splits text block `index` at `at` and puts the photo in between.
export function insertPhotoAt(blocks, index, at, url) {
  const text = blocks[index]?.text ?? '';
  return [
    ...blocks.slice(0, index),
    { type: 'text', text: text.slice(0, at).replace(/\s+$/, '') },
    { type: 'photo', url, caption: '' },
    { type: 'text', text: text.slice(at).replace(/^\s+/, '') },
    ...blocks.slice(index + 1),
  ];
}

// Removes photo block `index` and joins the text either side of it.
export function removePhotoAt(blocks, index) {
  const before = blocks[index - 1]?.text ?? '', after = blocks[index + 1]?.text ?? '';
  const joined = [before.replace(/\s+$/, ''), after.replace(/^\s+/, '')].filter(Boolean).join('\n\n');
  return [...blocks.slice(0, index - 1), { type: 'text', text: joined }, ...blocks.slice(index + 2)];
}
