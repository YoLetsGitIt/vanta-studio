// A marketing message is plain text; each photo is its own paragraph,
// ![file name](url). The editor shows each photo as [file name] instead, and
// Preview shows the real photos. The backend renders only photos from the
// studio's marketing-images bucket (vanta-backend internal/marketing/images.go);
// this mirrors that.
const PHOTO = /(^|\n\n)!\[([^\]\n]{0,300})\]\((\S+)\)(?=\n\n|$)/g;
const OWN_PHOTO = /\/storage\/v1\/object\/public\/marketing-images\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|gif)$/;
const MARKER = /\[([^\]\n]{1,300})\]/g;
const label = caption => caption || 'Photo';

// Message as shown in the editor, plus its photos in order.
export function toDisplay(body) {
  const text = String(body ?? '');
  const photos = [];
  const out = text.replace(PHOTO, (match, sep, caption, url) => {
    if (!OWN_PHOTO.test(url)) return match;
    photos.push({ url, caption });
    return `${sep}[${label(caption)}]`;
  });
  return { text: out, photos };
}

// Back from the editor text to the saved message. A [name] becomes the next
// unused photo with that name; anything else in brackets stays text. A name
// typed mid-line is moved onto its own paragraph.
export function fromDisplay(text, photos) {
  const queues = new Map();
  for (const photo of photos) {
    const key = label(photo.caption);
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(photo);
  }
  let out = '', last = 0;
  for (const m of text.matchAll(MARKER)) {
    const photo = queues.get(m[1])?.shift();
    if (!photo) continue;
    out += text.slice(last, m.index);
    if (out && !out.endsWith('\n\n')) out += out.endsWith('\n') ? '\n' : '\n\n';
    out += `![${photo.caption}](${photo.url})`;
    last = m.index + m[0].length;
    const rest = text.slice(last);
    if (rest && !rest.startsWith('\n\n')) out += rest.startsWith('\n') ? '\n' : '\n\n';
  }
  return out + text.slice(last);
}

// A file name that fits in [ ] and isn't already used in this message.
export function photoName(fileName, taken) {
  let name = String(fileName ?? '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Photo';
  if (!taken.includes(name)) return name;
  const dot = name.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 2; ; n++) {
    const next = `${stem} (${n})${ext}`;
    if (!taken.includes(next)) return next;
  }
}

// Adds a photo at `at` (a position in the editor text). Returns the new
// message and where the cursor should go in the new editor text.
export function insertPhoto(body, at, url, fileName) {
  const { text, photos } = toDisplay(body);
  const caption = photoName(fileName, photos.map(p => label(p.caption)));
  const before = text.slice(0, at).replace(/\s+$/, ''), after = text.slice(at).replace(/^\s+/, '');
  const marker = `[${caption}]`;
  const next = fromDisplay([before, marker, after].filter(Boolean).join('\n\n'), [...photos, { url, caption }]);
  const shown = toDisplay(next).text;
  const found = shown.indexOf(marker, before.length);
  return { body: next, cursor: found >= 0 ? found + marker.length : shown.length };
}
