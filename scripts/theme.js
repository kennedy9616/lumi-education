/* Carregado no <head>, antes do CSS, para evitar flashes do tema errado. */
(() => {
  'use strict';
  const key = 'lumi-preferences';
  const defaults = { theme: 'system', accent: 'dourado', motion: 'system' };
  const allowed = {
    theme: ['system', 'light', 'dark'],
    accent: ['dourado', 'azul', 'verde', 'violeta'],
    motion: ['system', 'reduced']
  };
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let preferences = { ...defaults };

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      const legacy = localStorage.getItem('lumi-theme') || localStorage.getItem('lumi-tema');
      return saved || { ...defaults, theme: legacy || 'system' };
    } catch {
      return defaults;
    }
  }

  function apply(value) {
    for (const name of Object.keys(defaults)) {
      preferences[name] = allowed[name].includes(value[name]) ? value[name] : defaults[name];
    }
    const root = document.documentElement;
    root.dataset.theme = preferences.theme === 'system'
      ? (systemTheme.matches ? 'dark' : 'light') : preferences.theme;
    root.dataset.accent = preferences.accent;
    root.dataset.motion = preferences.motion;
    window.dispatchEvent(new CustomEvent('lumi:preferences', { detail: { ...preferences } }));
  }

  window.LumiTheme = {
    get: () => ({ ...preferences }),
    set(changes) {
      apply({ ...preferences, ...changes });
      try {
        localStorage.setItem(key, JSON.stringify(preferences));
        return true;
      } catch {
        return false;
      }
    },
    reset() { return this.set(defaults); }
  };
  apply(read());
  systemTheme.addEventListener('change', () => apply(preferences));
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(read());
  });
  window.addEventListener('pageshow', () => apply(read()));
})();
