/* Ícones locais em SVG, sem dependência de CDN. */
(() => {
  'use strict';
  const paths = {
    'house': 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    'grid-2x2': 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
    'arrow-left': 'm10 5-7 7 7 7M3 12h18',
    'arrow-right': 'm14 5 7 7-7 7M3 12h18',
    'arrow-up': 'm5 10 7-7 7 7M12 3v18',
    'layers': 'm12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5',
    'list-checks': 'm3 6 2 2 3-4M11 6h10M3 14l2 2 3-4M11 14h10M11 20h10',
    'lightbulb': 'M9 18h6M9 22h6M8 14a7 7 0 1 1 8 0l-1 4H9Z',
    'network': 'M9 3h6v6H9ZM2 16h6v6H2Zm14 0h6v6h-6ZM12 9v4M5 16v-3h14v3',
    'cable': 'M4 3v5m4-5v5M2 8h8v4H2Zm4 4v4a4 4 0 0 0 8 0V8m-2-5v5m4-5v5M10 8h8',
    'arrow-left-right': 'M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4',
    'app-window': 'M3 3h18v18H3ZM3 8h18M6 5h1m3 0h1',
    'graduation-cap': 'm2 8 10-5 10 5-10 5Zm4 2v7l6 3 6-3v-7M22 8v8',
    'wrench': 'M14 3a6 6 0 0 0-7 7L2 18a3 3 0 0 0 4 4l8-8a6 6 0 0 0 7-7l-5 4-3-3Z',
    'triangle-alert': 'm12 3 10 18H2ZM12 9v5m0 3v1',
    'clock-3': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5h5',
    'route': 'M4 4h12a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12m-4-4 4 4-4 3',
    'search': 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0m-2 6 6 6',
    'sparkles': 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
    'pencil': 'm3 17 13-13 4 4L7 21H3Zm10-10 4 4'
  };
  document.querySelectorAll('[data-lucide]').forEach(element => {
    const drawing = paths[element.dataset.lucide] || paths.layers;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', `${element.className} lucide`);
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', drawing);
    svg.append(shape);
    element.replaceWith(svg);
  });
})();
