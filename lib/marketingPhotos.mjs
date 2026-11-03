// A marketing message is plain text; each photo is its own paragraph,
// ![caption](url). The editor shows each photo as a short [Photo n] marker
// instead, and Preview shows the real photos. The backend renders only photos
// from the studio's marketing-images bucket (vanta-backend
// internal/marketing/images.go); this mirrors that.
const PHOTO = /(^|\n\n)!\[([^\]\n]{0,300})\]\((\S+)\)(?=\n\n|$)/g;
const OWN_PHOTO = /\/storage\/v1\/object\/public\/marketing-images\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|gif)$/;
const MARKER = /\[Photo (\d+)\]/g;

// Message as shown in the editor, plus the photo URLs in marker order.
export function toDisplay(body) {
  const text = String(body ?? '');
  const urls = [];
  const out = text.replace(PHOTO, (match, sep, caption, url) => {
    if (!OWN_PHOTO.test(url)) return match;
    urls.push(url);
    return `${sep}[Photo ${urls.length}]`;
  });
  return { text: out, urls };
}

// Back from the editor text to the saved message. Markers for unknown photos
// stay as text; a marker typed mid-line is moved onto its own paragraph.
export function fromDisplay(text, urls) {
  let out = '', last = 0;
  for (const m of text.matchAll(MARKER)) {
    const url = urls[Number(m[1]) - 1];
    if (!url) continue;
    out += text.slice(last, m.index);
    if (out && !out.endsWith('\n\n')) out += out.endsWith('\n') ? '\n' : '\n\n';
    out += `![](${url})`;
    last = m.index + m[0].length;
    const rest = text.slice(last);
    if (rest && !rest.startsWith('\n\n')) out += rest.startsWith('\n') ? '\n' : '\n\n';
  }
  return out + text.slice(last);
}

// Adds a photo at `at` (a position in the editor text). Returns the new
// message and where the cursor should go in the new editor text.
export function insertPhoto(body, at, url) {
  const { text, urls } = toDisplay(body);
  const before = text.slice(0, at).replace(/\s+$/, ''), after = text.slice(at).replace(/^\s+/, '');
  const marker = `[Photo ${urls.length + 1}]`;
  const next = fromDisplay([before, marker, after].filter(Boolean).join('\n\n'), [...urls, url]);
  const shown = toDisplay(next).text;
  const index = [...before.matchAll(MARKER)].filter(m => urls[Number(m[1]) - 1]).length;
  const found = [...shown.matchAll(MARKER)][index];
  return { body: next, cursor: found ? found.index + found[0].length : shown.length };
}
