const KEY = 'vanta_demo_mode';

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) === '1';
}

export function setDemoMode(val) {
  if (typeof window === 'undefined') return;
  if (val) localStorage.setItem(KEY, '1');
  else localStorage.removeItem(KEY);
}
