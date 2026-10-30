/* Navegação compartilhada: uma única fonte para o cabeçalho e o menu do AVA. */
(() => {
  'use strict';
  const body = document.body;
  const base = body.dataset.root || './';
  const area = body.dataset.area || 'inicio';
  const icon = name => `<span class="nav-symbol" aria-hidden="true">${name}</span>`;
  const links = [
    ['inicio', 'index.html', '⌂', 'Visão geral'],
    ['cursos', 'index.html#cursos', '▦', 'Todos os cursos'],
    ['infantil', 'infantil/index.html', 'Aa', 'Educação Infantil'],
    ['universidade', 'universidade/index.html', '◇', 'Universidade'],
    ['tecnico', 'tecnico/index.html', '⌘', 'Ensino Técnico'],
    ['biblioteca', 'biblioteca/index.html', '▤', 'Biblioteca'],
    ['configuracoes', 'configuracoes/index.html', '⚙', 'Configurações']
  ];
  const header = document.querySelector('[data-site-header]');
  if (header) header.innerHTML = `
    <a class="brand" href="${base}index.html" aria-label="LUMI Education, início">
      <span class="brand-mark" aria-hidden="true">L</span><span>LUMI <small>EDUCATION</small></span>
    </a>
    <div class="top-actions">
      <span class="top-caption">Ambiente Virtual de Aprendizagem</span>
      <button class="icon-btn" type="button" data-theme-toggle aria-label="Alternar tema">◐</button>
      <button class="icon-btn mobile-toggle" type="button" data-menu aria-controls="sidebar" aria-expanded="false" aria-label="Abrir menu">☰</button>
    </div>`;

  const sidebar = document.querySelector('[data-site-sidebar]');
  if (!sidebar) return;
  sidebar.innerHTML = `<div class="side-heading"><p class="side-kicker">SEU ESPAÇO DE APRENDER</p>
    <button class="icon-btn mobile-toggle side-close" type="button" data-menu aria-controls="sidebar" aria-expanded="false" aria-label="Fechar menu">×</button></div>
    <nav aria-label="Navegação principal">${links.map(([id, href, symbol, label]) =>
      `<a class="side-home${area === id ? ' active' : ''}" href="${base}${href}"${area === id ? ' aria-current="page"' : ''}>${icon(symbol)}${label}</a>`).join('')}</nav>
    <div data-course-navigation></div>
    <div class="sidebar-bottom"><strong>Luz para cada descoberta.</strong><br>Do primeiro som à próxima conexão.<br><br>LUMI Education</div>`;

  const courseNav = document.getElementById('course-navigation');
  if (courseNav) sidebar.querySelector('[data-course-navigation]').append(courseNav.content.cloneNode(true));
  const themeToggle = document.querySelector('[data-theme-toggle]');
  function themeLabel() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeToggle.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    themeToggle.title = themeToggle.getAttribute('aria-label');
  }
  themeToggle?.addEventListener('click', () => {
    window.LumiTheme.set({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' });
  });
  window.addEventListener('lumi:preferences', themeLabel);
  themeLabel();

  const toggles = [...document.querySelectorAll('[data-menu]')];
  const mobile = matchMedia('(max-width: 760px)');
  const main = document.querySelector('main');
  let returnFocus;
  function setMenu(open) {
    const show = open && mobile.matches;
    body.classList.toggle('menu-open', show);
    sidebar.inert = mobile.matches && !show;
    if (main) main.inert = show;
    toggles.forEach(button => button.setAttribute('aria-expanded', String(show)));
    if (show) {
      returnFocus = document.activeElement;
      sidebar.querySelector('button, a').focus();
    } else if (returnFocus) {
      returnFocus.focus();
      returnFocus = null;
    }
  }
  toggles.forEach(button => button.addEventListener('click', () => setMenu(!body.classList.contains('menu-open'))));
  document.querySelector('.scrim')?.addEventListener('click', () => setMenu(false));
  sidebar.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  mobile.addEventListener('change', () => setMenu(false));
  setMenu(false);
  document.addEventListener('keydown', event => {
    if (!body.classList.contains('menu-open')) return;
    if (event.key === 'Escape') setMenu(false);
    if (event.key !== 'Tab') return;
    const focusable = [...sidebar.querySelectorAll('a, button')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  const progress = document.querySelector('[data-reading-progress]');
  function updateProgress() {
    if (!progress) return;
    const distance = document.documentElement.scrollHeight - innerHeight;
    progress.value = distance > 0 ? Math.min(100, Math.max(0, scrollY / distance * 100)) : 100;
  }
  addEventListener('scroll', updateProgress, { passive: true });
  addEventListener('resize', updateProgress);
  document.querySelectorAll('details').forEach(el => el.addEventListener('toggle', updateProgress));
  updateProgress();
  document.querySelector('[data-to-top]')?.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    document.querySelector('h1')?.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-fullscreen]').forEach(button => button.addEventListener('click', async () => {
    const frame = document.getElementById(button.dataset.fullscreen);
    try { await frame.requestFullscreen(); } catch { window.open(frame.src, '_blank', 'noopener'); }
  }));
  if (window.lucide) window.lucide.createIcons();
})();
