import test from 'node:test';
import assert from 'node:assert/strict';
import { formTheme, formThemeMode, DEFAULT_LIGHT_ACCENT, DEFAULT_DARK_ACCENT } from '../lib/formTheme.js';
import { isPublicFormPath, getThemeInitScript } from '../lib/theme.js';

test('forms are light unless the studio chose a dark background', () => {
  assert.equal(formThemeMode(null), 'light');
  assert.equal(formThemeMode({ bg_color: '#ffffff' }), 'light');
  assert.equal(formThemeMode({ bg_color: '#f3eee4' }), 'light');
  assert.equal(formThemeMode({ bg_color: '#111111' }), 'dark');
  assert.equal(formThemeMode({ bg_color: 'nonsense' }), 'light');
});

test('the default highlight matches the theme', () => {
  assert.equal(formTheme(null, { card: '#fff', page: '#f6f5f2' })['--cf-accent'], DEFAULT_LIGHT_ACCENT);
  assert.equal(formTheme({ bg_color: '#111111' }, {})['--cf-accent'], DEFAULT_DARK_ACCENT);
  assert.equal(formTheme({ bg_color: '#111111', accent_color: '#ff0000' }, {})['--cf-accent'], '#ff0000');
});

test('client form pages start light; the dashboard keeps the saved theme', () => {
  for (const p of ['/studio-booking', '/walkin', '/consent', '/availability', '/sms-reminder', '/unsubscribe', '/consent.html'])
    assert.equal(isPublicFormPath(p), true, p);
  for (const p of ['/', '/dashboard', '/dashboard/settings', '/signin', '/consentx'])
    assert.equal(isPublicFormPath(p), false, p);
  const run = (pathname, saved) => {
    const attrs = {};
    const root = { style: {}, setAttribute: (k, v) => { attrs[k] = v; } };
    const ls = { getItem: () => saved };
    new Function('location', 'document', 'window', getThemeInitScript())({ pathname }, { documentElement: root }, { localStorage: ls });
    return attrs['data-theme'];
  };
  assert.equal(run('/consent', 'dark'), 'light');
  assert.equal(run('/studio-booking', 'space'), 'light');
  assert.equal(run('/dashboard', 'nature'), 'nature');
  assert.equal(run('/dashboard', null), 'dark');
});
