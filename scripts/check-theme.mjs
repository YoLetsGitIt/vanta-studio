import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// A data URL loads the actual ES module without changing the app's package type.
const source = await readFile(new URL('../lib/theme.js', import.meta.url), 'utf8');
const { getTheme, setTheme, initTheme, getThemeInitScript } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function browser({ saved = null, applied, readBlocked = false, writeBlocked = false } = {}) {
  const state = { saved, applied };
  const root = {
    style: {},
    getAttribute() { return state.applied; },
    setAttribute(name, value) { assert.equal(name, 'data-theme'); state.applied = value; },
  };
  const document = { documentElement: root };
  const window = {
    localStorage: {
      getItem(key) {
        assert.equal(key, 'vanta-theme');
        if (readBlocked) throw new Error('Storage read denied');
        return state.saved;
      },
      setItem(key, value) {
        assert.equal(key, 'vanta-theme');
        if (writeBlocked) throw new Error('Storage write denied');
        state.saved = value;
      },
    },
  };
  globalThis.window = window;
  globalThis.document = document;
  return { state, root, runPrepaint: () => vm.runInNewContext(getThemeInitScript(), { window, document }) };
}

try {
  assert.equal(getTheme(), 'dark', 'Server rendering defaults to dark');
  assert.equal(initTheme(), 'dark', 'Server initialization is safe');
  assert.equal(setTheme('light'), 'light', 'Server preference calls are safe');

  for (const saved of ['light', 'dark', 'invalid', null]) {
    const expected = saved === 'light' ? 'light' : 'dark';
    const env = browser({ saved });
    assert.equal(getTheme(), expected, 'Saved preference is used before DOM initialization');
    env.runPrepaint();
    assert.equal(env.state.applied, expected, 'Prepaint applies only valid theme values');
    assert.equal(env.root.style.colorScheme, expected);
    assert.equal(initTheme(), expected);
  }

  const persisted = browser({ saved: 'dark' });
  persisted.runPrepaint();
  setTheme('light');
  assert.equal(persisted.state.saved, 'light');
  assert.equal(getTheme(), 'light');

  const noStorage = browser({ readBlocked: true, writeBlocked: true });
  noStorage.runPrepaint();
  assert.equal(noStorage.state.applied, 'dark');
  setTheme('light');
  assert.equal(getTheme(), 'light');
  assert.equal(initTheme(), 'light', 'Unavailable storage does not undo the current choice');

  for (const saved of ['dark', 'light']) {
    const next = saved === 'dark' ? 'light' : 'dark';
    const writeDenied = browser({ saved, writeBlocked: true });
    writeDenied.runPrepaint();
    assert.equal(getTheme(), saved);
    setTheme(next);
    assert.equal(writeDenied.state.saved, saved, 'The denied write leaves stale storage');
    assert.equal(getTheme(), next, 'Settings reads the current theme rather than stale storage');
    assert.equal(initTheme(), next, 'Reinitialization preserves the current theme');
    assert.equal(writeDenied.root.style.colorScheme, next);
  }

  browser({ saved: 'light', applied: 'invalid' });
  assert.equal(getTheme(), 'light', 'An invalid DOM value falls back to the saved preference');
  setTheme('invalid');
  assert.equal(getTheme(), 'dark', 'Unrecognized theme changes are normalized');

  console.log('Theme regression checks passed: server rendering, saved preferences, prepaint, invalid values, unavailable storage, and read-allowed/write-denied storage.');
} finally {
  delete globalThis.window;
  delete globalThis.document;
}
