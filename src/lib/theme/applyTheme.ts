type ThemeSetting = 'dark' | 'light' | 'system'

function resolveEffective(setting: ThemeSetting): 'dark' | 'light' {
  if (setting === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return setting
}

/**
 * Apply the given theme preference to `<html>`.
 * Adds or removes the `dark` class and keeps a `data-theme` attribute for CSS hooks.
 */
export function applyTheme(setting: ThemeSetting): void {
  if (typeof document === 'undefined') return
  const effective = resolveEffective(setting)
  const root = document.documentElement
  root.classList.toggle('dark', effective === 'dark')
  root.setAttribute('data-theme', effective)
}

/**
 * Inline script source injected in `<head>` to prevent FOUC.
 * Reads the persisted theme from the Zustand store in localStorage.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var raw = localStorage.getItem('buddget-finance-data');
    var theme = 'dark';
    if (raw) {
      var parsed = JSON.parse(raw);
      var s = parsed && parsed.state && parsed.state.settings;
      if (s && s.theme) theme = s.theme;
    }
    var eff = theme;
    if (theme === 'system') {
      eff = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var cl = document.documentElement.classList;
    if (eff === 'dark') cl.add('dark'); else cl.remove('dark');
    document.documentElement.setAttribute('data-theme', eff);
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`
