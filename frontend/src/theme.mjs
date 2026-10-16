export const THEME_STORAGE_KEY = 'nearbuy-theme';

export function getInitialTheme(options = {}) {
  try {
    const storage = options.storage ?? globalThis.localStorage;
    const savedTheme = storage?.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }

  return 'light';
}

export function getVisibleTheme(preferredTheme, isAuthenticated) {
  if (!isAuthenticated) return 'light';
  return preferredTheme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  if (!root) return;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function persistTheme(theme, storage) {
  try {
    (storage ?? globalThis.localStorage)?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The visual theme still applies when persistence is unavailable.
  }
}
