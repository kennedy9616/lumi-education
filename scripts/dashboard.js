(() => {
  'use strict';
  const search = document.querySelector('[data-course-search]');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('[data-course]')];
  const count = document.querySelector('[data-result-count]');
  const empty = document.querySelector('[data-empty-results]');
  let filter = 'todos';
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function update() {
    const query = normalize(search.value.trim());
    let visible = 0;
    cards.forEach(card => {
      const matches = (filter === 'todos' || card.dataset.category === filter || (filter === 'disponiveis' && card.dataset.available === 'true')) && normalize(card.textContent).includes(query);
      card.hidden = !matches;
      if (matches) visible++;
    });
    count.textContent = `${visible} ${visible === 1 ? 'curso encontrado' : 'cursos encontrados'}`;
    empty.hidden = visible !== 0;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  }
  buttons.forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; update(); }));
  search.addEventListener('input', update);
  document.querySelector('[data-clear-search]')?.addEventListener('click', () => { search.value = ''; filter = 'todos'; update(); search.focus(); });
  // Mantém os endereços antigos do catálogo funcionando após a reorganização.
  const legacyAreas = { infantil: 'infantil', superior: 'universidade', universidade: 'universidade', tecnico: 'tecnico' };
  function routeHash() {
    const hash = location.hash.slice(1);
    if (legacyAreas[hash]) { filter = legacyAreas[hash]; update(); document.getElementById('cursos').scrollIntoView(); }
    const legacyCourse = hash.replace(/^uni-/, 'universidade/').replace(/^tec-/, 'tecnico/');
    const card = cards.find(item => item.dataset.course === legacyCourse || item.dataset.course === `infantil/${hash}`);
    if (card) location.replace(card.querySelector('a').href);
  }
  update();
  routeHash();
  addEventListener('hashchange', routeHash);
})();
