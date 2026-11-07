// The studio's form colours (Settings → Studio → Logo and colours), shared by the
// booking form, walk-in form and consent form, as CSS variables on a page wrapper:
//   --cf-card / --cf-page   the form card and the slightly darker page behind it
//   --cf-accent             the highlight: buttons, ticks, chosen answers, links
//   --cf-accent-soft / -line  tinted backgrounds and borders in the highlight colour
//   --cf-accent-text        readable text on the highlight
// --accent / --accent-contrast are set too, so shared Buttons follow the highlight.
// Unset colours keep each form's own default look.

export function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function isLightHex(hex) {
  const c = hexRgb(hex);
  return c ? (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.6 : false;
}

export function formTheme(style, defaults) {
  const bg = hexRgb(style?.bg_color) ? style.bg_color : null;
  const accent = hexRgb(style?.accent_color) ? style.accent_color : defaults.accent;
  const [ar, ag, ab] = hexRgb(accent) ?? [213, 208, 199];
  const accentText = isLightHex(accent) ? '#11151b' : '#ffffff';
  let card = defaults.card, page = defaults.page;
  if (bg) {
    const [r, g, b] = hexRgb(bg);
    card = bg;
    page = `rgb(${Math.round(r * 0.72)}, ${Math.round(g * 0.72)}, ${Math.round(b * 0.72)})`;
  }
  return {
    '--cf-card': card,
    '--cf-page': page,
    '--cf-accent': accent,
    '--cf-accent-soft': `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
    '--cf-accent-line': `rgba(${ar}, ${ag}, ${ab}, 0.35)`,
    '--cf-accent-text': accentText,
    '--accent': accent,
    '--accent-contrast': accentText,
  };
}
