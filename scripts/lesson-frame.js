/* Preserva links diretos para etapas das apresentações anteriores. */
(() => {
  'use strict';
  const frame = document.getElementById('lesson-frame');
  if (location.hash) frame.src += location.hash;
})();
