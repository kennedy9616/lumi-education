(() => {
  'use strict';
  const form = document.getElementById('preferences');
  const status = document.getElementById('settings-status');
  function sync() {
    const preferences = window.LumiTheme.get();
    for (const [name, value] of Object.entries(preferences)) {
      const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
      if (input) input.checked = true;
    }
  }
  form.addEventListener('change', event => {
    const { name, value } = event.target;
    const saved = window.LumiTheme.set({ [name]: value });
    status.textContent = saved ? 'Preferências salvas neste navegador. O visual foi atualizado.' : 'Visual atualizado. Este navegador não permitiu salvar a preferência.';
  });
  document.getElementById('reset-preferences').addEventListener('click', () => {
    const saved = window.LumiTheme.reset();
    status.textContent = saved ? 'Preferências padrão restauradas.' : 'Padrão aplicado nesta página. O navegador não permitiu salvar.';
  });
  window.addEventListener('lumi:preferences', sync);
  sync();
})();
