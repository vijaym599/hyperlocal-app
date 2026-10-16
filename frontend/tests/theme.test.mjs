import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, getInitialTheme, getVisibleTheme, persistTheme, THEME_STORAGE_KEY } from '../src/theme.mjs';

test('saved theme takes precedence over the system preference', () => {
  const storage = { getItem: () => 'dark' };
  const media = () => ({ matches: false });
  assert.equal(getInitialTheme({ storage, media }), 'dark');
});

test('light theme is the default when no valid theme was saved', () => {
  const storage = { getItem: () => 'unexpected' };
  const media = () => ({ matches: true });
  assert.equal(getInitialTheme({ storage, media }), 'light');
});

test('signed-out visitors always use light while signed-in accounts keep their preference', () => {
  assert.equal(getVisibleTheme('dark', false), 'light');
  assert.equal(getVisibleTheme('dark', true), 'dark');
  assert.equal(getVisibleTheme('light', true), 'light');
});

test('theme application updates the document contract', () => {
  const root = { dataset: {}, style: {} };
  applyTheme('dark', root);
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.style.colorScheme, 'dark');
});

test('theme persistence uses the stable Nearbuy storage key', () => {
  const saved = new Map();
  persistTheme('light', { setItem: (key, value) => saved.set(key, value) });
  assert.equal(saved.get(THEME_STORAGE_KEY), 'light');
});
