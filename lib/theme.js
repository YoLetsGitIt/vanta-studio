const KEY = 'vanta-theme';

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
  }
  return theme;
}

// Only static, allowlisted values are written. Run in the root layout before
// content paints so each saved palette and native colour scheme start together.
export function getThemeInitScript() {
  return `(function(){var theme='dark';if(${PUBLIC_PATHS.toString()}.test(location.pathname)){document.documentElement.setAttribute('data-public-form','');document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light';return;}try{var saved=window.localStorage.getItem('${KEY}');if(saved==='dark'||saved==='light'||saved==='nature'||saved==='space')theme=saved;}catch(error){}document.documentElement.setAttribute('data-theme',theme);document.documentElement.style.colorScheme=(theme==='dark'||theme==='space')?'dark':'light';}());`;
}
