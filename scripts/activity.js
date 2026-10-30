/* Sincroniza preferências do portal quando a aula está incorporada. */
(() => {
  'use strict';
  if (window.parent === window) return;
  try {
    const parent = window.parent;
    function sync() {
      for (const key of ['theme', 'accent', 'motion']) {
        document.documentElement.dataset[key] = parent.document.documentElement.dataset[key];
      }
      const reduce = document.querySelector('#reduce');
      if (reduce && parent.document.documentElement.dataset.motion === 'reduced' && !reduce.checked) {
        reduce.checked = true;
        reduce.dispatchEvent(new Event('change'));
      }
    }
    parent.addEventListener('lumi:preferences', sync);
    addEventListener('pagehide', () => parent.removeEventListener('lumi:preferences', sync), { once: true });
    sync();
  } catch {
    // A atividade continua funcionando quando aberta fora do portal.
  }
})();
