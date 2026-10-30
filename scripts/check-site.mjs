/* Execute com: node scripts/check-site.mjs. Sem dependências externas. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function walk(directory) {
  const files = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const name = path.join(directory, item.name);
    files.push(...(item.isDirectory() ? await walk(name) : [name]));
  }
  return files;
}

const files = await walk(root);
const pages = files.filter(file => file.endsWith('.html'));
const scripts = files.filter(file => file.endsWith('.js'));
const css = files.filter(file => file.endsWith('.css'));

for (const file of scripts) {
  try { new vm.Script(await fs.readFile(file, 'utf8'), { filename: file }); }
  catch (error) { errors.push(error.message); }
}
for (const file of css) {
  if (!path.relative(root, file).startsWith(`template${path.sep}`)) errors.push(`CSS fora de template/: ${file}`);
}
for (const file of pages) {
  const source = await fs.readFile(file, 'utf8');
  const label = path.relative(root, file);
  if (/<style\b|\sstyle\s*=|<script(?![^>]*\bsrc=)[^>]*>/i.test(source)) errors.push(`${label}: CSS/JS inline`);
  if (/\son\w+\s*=/i.test(source)) errors.push(`${label}: evento inline`);
  for (const tag of ['html', 'head', 'body', 'title']) {
    const scope = tag === 'title' ? (source.match(/<head>[\s\S]*?<\/head>/i)?.[0] || '') : source;
    if ([...scope.matchAll(new RegExp(`<${tag}\\b`, 'gi'))].length !== 1) errors.push(`${label}: estrutura ${tag}`);
  }
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${label}: IDs duplicados`);
  for (const [, url] of source.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|data:|mailto:|tel:)/i.test(url)) continue;
    const [relative, fragment] = url.split('#');
    let target = relative ? path.resolve(path.dirname(file), decodeURIComponent(relative.split('?')[0])) : file;
    try {
      if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
      const targetText = await fs.readFile(target);
      if (fragment && target.endsWith('.html')) {
        const targetIds = [...targetText.toString().matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
        if (!targetIds.includes(decodeURIComponent(fragment))) errors.push(`${label}: âncora ausente ${url}`);
      }
    } catch { errors.push(`${label}: arquivo ausente ${url}`); }
  }
}

// Verifica contratos observáveis da preferência de tema, sem navegador.
const themeSource = await fs.readFile(path.join(root, 'scripts/theme.js'), 'utf8');
function environment({ saved = {}, dark = false, blocked = false } = {}) {
  const storage = new Map(Object.entries(saved));
  const listeners = {};
  const media = { matches: dark, addEventListener: (_type, callback) => { media.change = callback; } };
  const document = { documentElement: { dataset: {} } };
  const window = {
    addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
    dispatchEvent(event) { (listeners[event.type] || []).forEach(callback => callback(event)); }
  };
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('Storage bloqueado'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage bloqueado'); storage.set(key, value); }
  };
  const context = vm.createContext({ document, window, localStorage, matchMedia: () => media,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } } });
  vm.runInContext(themeSource, context);
  return { api: window.LumiTheme, document, window, media, storage };
}

const auto = environment({ dark: true });
assert.equal(auto.document.documentElement.dataset.theme, 'dark');
auto.media.matches = false;
auto.media.change();
assert.equal(auto.document.documentElement.dataset.theme, 'light');
assert.equal(auto.api.set({ theme: 'dark', accent: 'violeta', motion: 'reduced' }), true);
const reloaded = environment({ saved: Object.fromEntries(auto.storage) });
assert.equal(reloaded.document.documentElement.dataset.theme, 'dark');
assert.equal(reloaded.document.documentElement.dataset.accent, 'violeta');
assert.equal(reloaded.document.documentElement.dataset.motion, 'reduced');
reloaded.api.reset();
assert.equal(reloaded.api.get().theme, 'system');
assert.equal(reloaded.api.get().accent, 'dourado');

for (const oldKey of ['lumi-tema', 'lumi-theme']) {
  assert.equal(environment({ saved: { [oldKey]: 'dark' } }).api.get().theme, 'dark');
}
assert.equal(environment({ saved: { 'lumi-preferences': '{invalid' } }).api.get().theme, 'system');
const invalid = environment({ saved: { 'lumi-preferences': JSON.stringify({ theme: 'wrong', accent: 'wrong' }) } });
assert.equal(invalid.api.get().accent, 'dourado');
const blocked = environment({ blocked: true });
assert.equal(blocked.api.set({ theme: 'dark' }), false);
assert.equal(blocked.document.documentElement.dataset.theme, 'dark');
const tab = environment();
tab.storage.set('lumi-preferences', JSON.stringify({ theme: 'dark', accent: 'azul', motion: 'reduced' }));
tab.window.dispatchEvent({ type: 'storage', key: 'lumi-preferences' });
assert.equal(tab.document.documentElement.dataset.accent, 'azul');

if (errors.length) throw new Error(errors.join('\n'));
console.log(`${pages.length} páginas, ${scripts.length} scripts e ${css.length} CSS verificados. Links, estrutura e preferências: OK.`);
