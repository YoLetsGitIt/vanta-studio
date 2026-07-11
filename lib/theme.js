const KEY = 'vanta-theme';

export function getTheme() {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem(KEY) || 'dark';
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
