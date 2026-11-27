// The inline script in index.html applies a stored theme before first paint.
const root = document.documentElement;

/** Effective theme: explicit data-theme, else the OS preference. */
export function getTheme() {
  const t = root.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // storage blocked: theme still applies for this page view
  }
  return next;
}
