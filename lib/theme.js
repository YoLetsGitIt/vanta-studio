const KEY = 'vanta-theme';

function validTheme(theme) {
  return theme === 'light' || theme === 'dark';
}

export function getTheme() {
  if (typeof window === 'undefined') return 'dark';
  // Once initialized, the page reflects the user's current choice. Storage may
  // still contain an older value if a later write was blocked or exceeded quota.
  const applied = document.documentElement.getAttribute('data-theme');
  if (validTheme(applied)) return applied;
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
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next;
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
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }
  return theme;
}

// Only static, allowlisted values are written. Run in the root layout before
// content paints to avoid a dark flash when a saved light theme is selected.
export function getThemeInitScript() {
  return `(function(){var theme='dark';try{var saved=window.localStorage.getItem('${KEY}');if(saved==='dark'||saved==='light')theme=saved;}catch(error){}document.documentElement.setAttribute('data-theme',theme);document.documentElement.style.colorScheme=theme;}());`;
}
