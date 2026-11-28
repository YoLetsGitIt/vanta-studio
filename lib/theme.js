const KEY = 'vanta-theme';

// The phone's status bar and browser bar take this colour: the top bar of each theme
// (--bg-sidebar in globals.css). Public forms start light (white).
const BAR_COLOURS = { dark: '#0c0c0c', light: '#fafafa', nature: '#ede8db', space: '#18142b' };
const PUBLIC_BAR = '#ffffff';

function setBarColour(colour) {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'theme-color'); document.head.appendChild(meta); }
  meta.setAttribute('content', colour);
}

// Forms that clients open from a link (booking, walk-in, consent, availability,
// reminders, email preferences) always start light. They never read or change the
// studio's saved dashboard theme; a studio's own form colours can still darken them.
const PUBLIC_PATHS = /^\/(?:studio-booking|walkin|consent|availability|sms-reminder|unsubscribe)(?:\/|\.html|$)/;

export function isPublicFormPath(pathname) {
  return PUBLIC_PATHS.test(String(pathname || ''));
}

function validTheme(theme) {
  return theme === 'light' || theme === 'dark' || theme === 'nature' || theme === 'space';
}

export function getTheme() {
  if (typeof window === 'undefined') return 'dark';
  // Once initialized, the page reflects the user's current choice. Storage may
  // still contain an older value if a later write was blocked or exceeded quota.
  const root = document.documentElement;
  const applied = root.getAttribute('data-theme');
  // A public form's light theme isn't the user's choice.
  if (validTheme(applied) && !root.hasAttribute('data-public-form')) return applied;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (validTheme(saved)) return saved;
  } catch {
    // Private browsing or a blocked storage policy must not break the app.
  }
  return 'dark';
}

export function setTheme(theme) {
  const next = validTheme(theme) ? theme : 'dark';
  if (typeof window === 'undefined') return next;

  // Apply first so switching still works when persistence is unavailable.
  document.documentElement.removeAttribute('data-public-form');
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = (next === 'dark' || next === 'space') ? 'dark' : 'light';
  setBarColour(BAR_COLOURS[next]);
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // The current page retains the chosen theme even without storage access.
  }
  return next;
}

export function initTheme() {
  const theme = getTheme();
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-public-form');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = (theme === 'dark' || theme === 'space') ? 'dark' : 'light';
    setBarColour(BAR_COLOURS[theme]);
  }
  return theme;
}

// Only static, allowlisted values are written. Run in the root layout before
// content paints so each saved palette and native colour scheme start together.
export function getThemeInitScript() {
  const bars = JSON.stringify(BAR_COLOURS);
  return `(function(){var theme='dark';function bar(c){var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',c);}if(${PUBLIC_PATHS.toString()}.test(location.pathname)){document.documentElement.setAttribute('data-public-form','');document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light';bar('${PUBLIC_BAR}');return;}try{var saved=window.localStorage.getItem('${KEY}');if(saved==='dark'||saved==='light'||saved==='nature'||saved==='space')theme=saved;}catch(error){}document.documentElement.setAttribute('data-theme',theme);document.documentElement.style.colorScheme=(theme==='dark'||theme==='space')?'dark':'light';bar(${bars}[theme]);}());`;
}
