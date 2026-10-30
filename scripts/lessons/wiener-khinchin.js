'use strict';
/* =====================================================================
   MOTOR — utilitários, KaTeX, animação, biblioteca de gráficos (Chart),
   painel de resolução, caixas temáticas e navegação por etapas.
   ===================================================================== */
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const PI = Math.PI;
const C = {
  petro: '#146B73', navy: '#0B2540', aqua: '#5FC8C0', aquaD: '#2E9C94', gold: '#E3A23B', goldD: '#C7861E', red: '#C0392B',
  ink: '#13293D', mute: '#7C8E9B', gray: '#9AA9B3',
  goldF: 'rgba(227,162,59,.40)', goldF2: 'rgba(227,162,59,.22)', redF: 'rgba(192,57,43,.24)', petroF: 'rgba(20,107,115,.22)',
  navyF: 'rgba(11,37,64,.16)', aquaF: 'rgba(95,200,192,.30)'
};

function E(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(3)) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}
function SV(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function setA(e, attrs) { for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- números em pt-BR ---------- */
function nf(x, d = 2) {
  if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
  if (Math.abs(x) < 0.5 * Math.pow(10, -d)) x = 0;
  return x.toFixed(d).replace('-', '−').replace('.', ',');
}
const tnum = (x, d = 2) => nf(x, d).replace('−', '-').replace(',', '{,}');
function sciParts(x, d = 0) {
  if (x === 0) return { m: 0, e: 0 };
  let e = Math.floor(Math.log10(Math.abs(x)) + 1e-12), m = x / Math.pow(10, e);
  if (Math.abs(+m.toFixed(d)) >= 10) { e += 1; m = x / Math.pow(10, e); }
  return { m, e };
}
/* 2\times10^{-5} */
function sciT(x, d = 0) {
  const { m, e } = sciParts(x, d), ms = tnum(m, d);
  if (e === 0) return ms;
  if (e === 1 && Math.abs(m * 10) < 1000 && d === 0) return tnum(x, 0);
  return (ms === '1' ? '' : ms + '\\times ') + '10^{' + e + '}';
}
/* versão unicode (texto puro) */
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function sciU(x, d = 0) {
  const { m, e } = sciParts(x, d), ms = nf(m, d);
  return (ms === '1' ? '' : ms + '×') + '10' + String(e).split('').map(c => SUP[c]).join('');
}

/* ---------- KaTeX ---------- */
const KX = window.katex || null;
const MAC0 = { '\\dd': '\\mathrm{d}', '\\j': '\\mathrm{j}', '\\sinc': '\\operatorname{sinc}', '\\rms': '\\mathrm{rms}', '\\dB': '\\,\\mathrm{dB}' };
const MACS = {
  p: Object.assign({ '\\hl': '{#1}' }, MAC0),
  on: Object.assign({ '\\hl': '\\textcolor{##E3A23B}{#1}' }, MAC0),
  dark: Object.assign({ '\\hl': '\\textcolor{##A86B12}{#1}' }, MAC0)
};
const TC = new Map();
function T(s, o = {}) {
  const hl = o.hl || 'p', key = (o.d ? 'D' : 'I') + hl + s;
  let r = TC.get(key);
  if (r) return r;
  if (!KX) r = '<span class="tfb">' + esc(s) + '</span>';
  else {
    try { r = KX.renderToString(s, { displayMode: !!o.d, throwOnError: false, strict: 'ignore', output: 'html', macros: Object.assign({}, MACS[hl]) }); }
    catch (err) { r = esc(s); }
  }
  TC.set(key, r);
  return r;
}
/* texto com $...$ e $$...$$ */
function md(str, hl) {
  if (str == null) return '';
  return String(str)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => T(t, { d: true, hl }))
    .replace(/\$([^$]+?)\$/g, (_, t) => T(t, { hl }))
    .replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>');
}

/* ---------- animação ---------- */
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const linear = t => t;
function tween(dur, fn, o = {}) {
  const h = { dead: false, cancel() { this.dead = true; } };
  const e = o.ease || easeIO;
  if (RM || dur <= 0) { fn(1); h.done = Promise.resolve(); return h; }
  h.done = new Promise(res => {
    const t0 = performance.now() + (o.delay || 0);
    const tick = now => {
      if (h.dead) return res();
      let t = (now - t0) / dur;
      if (t < 0) { requestAnimationFrame(tick); return; }
      t = Math.min(1, t);
      fn(e(t));
      if (t < 1) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });
  return h;
}
const wait = ms => new Promise(r => setTimeout(r, RM ? 0 : ms));
function lerpAny(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v, i) => lerpAny(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    const o = {}; for (const k in b) o[k] = k in a ? lerpAny(a[k], b[k], t) : b[k]; return o;
  }
  return t < 1 ? a : b;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
}

/* ---------- funções matemáticas ---------- */
const sinc = x => Math.abs(x) < 1e-9 ? 1 : Math.sin(PI * x) / (PI * x);
const lor = (f, a, s2 = 1) => 2 * a * s2 / (a * a + 4 * PI * PI * f * f);
function integ(f, a, b, n = 2000) { /* Simpson */
  if (n % 2) n++;
  const h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}
/* gerador pseudoaleatório com semente fixa (mulberry32) e gaussiano por Box–Muller */
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(seed) {
  const r = rng(seed); let spare = null;
  return () => { if (spare !== null) { const s = spare; spare = null; return s; } let u = 0; while (u === 0) u = r(); const v = r(), m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * PI * v); return m * Math.cos(2 * PI * v); };
}
function gseq(seed, n) { const g = gauss(seed), out = []; for (let i = 0; i < n; i++) out.push(g()); return out; }
/* desenha uma sequência como linha + pontos (dados em coordenadas do gráfico) */
function seqDraw(c, g, pts, col, o = {}) {
  SV('path', { d: dPath(c, pts), fill: 'none', stroke: col, 'stroke-width': o.w || 2.4, 'stroke-linejoin': 'round', opacity: o.op ?? 1 }, g);
  if (o.dots !== false) pts.forEach(([x, y]) => SV('circle', { cx: c.X(x), cy: c.Y(y), r: o.r || 3.4, fill: col, opacity: o.op ?? 1 }, g));
}
/* botão liga/desliga */
function Toggle(parent, label, on, onchange, cls) {
  const b = E('button', { class: 'btn ' + (cls || 'ghost-d'), 'aria-pressed': on ? 'true' : 'false', html: md(label) });
  b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', v); onchange(v); b.blur(); });
  if (parent) parent.append(b);
  return { b, set(v) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); } };
}
/* FFT radix-2 iterativa (in-place) e estimador de Welch (janela de Hann, 50% de sobreposição) */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
/* DEP bilateral estimada (densidade por unidade de fs); devolve f de −fs/2 a fs/2 */
function welch(x, nper, fs = 1) {
  const w = new Float64Array(nper); let U = 0;
  for (let i = 0; i < nper; i++) { w[i] = 0.5 - 0.5 * Math.cos(2 * PI * i / nper); U += w[i] * w[i]; }
  const P = new Float64Array(nper), re = new Float64Array(nper), im = new Float64Array(nper);
  let K = 0;
  for (let s = 0; s + nper <= x.length; s += nper / 2) {
    for (let i = 0; i < nper; i++) { re[i] = x[s + i] * w[i]; im[i] = 0; }
    fft(re, im);
    for (let i = 0; i < nper; i++) P[i] += re[i] * re[i] + im[i] * im[i];
    K++;
  }
  const f = [], S = [];
  for (let i = 0; i < nper; i++) { const j = (i + nper / 2) % nper; f.push((i - nper / 2) * fs / nper); S.push(P[j] / (K * fs * U)); }
  return { f, S, K };
}
/* complexos mínimos */
const cx = (re, im = 0) => ({ re, im });
const cadd = (a, b) => cx(a.re + b.re, a.im + b.im), csub = (a, b) => cx(a.re - b.re, a.im - b.im);
const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cexp = a => { const m = Math.exp(a.re); return cx(m * Math.cos(a.im), m * Math.sin(a.im)); };

/* =====================================================================
   BIBLIOTECA DE GRÁFICOS
   new Chart(parent, {w,h,m,x:{min,max,ticks,label},y:{...},dom:k=>({x:[a,b],y:[a,b]})})
   chart.add(new Curve({...}))  ·  chart.goto(k, anim)  ·  chart.render()
   Marcas: Curve, Area, Impulse, Stems, VLine, HLine, Dot, Label, Bracket, Rect, Custom
   Transições: draw (curva/área se desenha da esquerda p/ direita), grow (impulsos), fade, morph (parâmetro p)
   ===================================================================== */
let UID = 0;
function niceTicks(min, max, n = 6) {
  const span = max - min; if (!(span > 0)) return [min];
  const s0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(s0))), r = s0 / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(12));
  return out;
}
function autoFmt(v, ticks) {
  let d = 0;
  for (const t of ticks) { let k = 0; while (k < 4 && Math.abs(t * Math.pow(10, k) - Math.round(t * Math.pow(10, k))) > 1e-6) k++; d = Math.max(d, k); }
  return nf(v, d);
}

class FO {
  constructor(parent, cls) {
    this.f = SV('foreignObject', { width: 10, height: 10 }, parent);
    this.d = document.createElement('div'); this.d.className = 'flab' + (cls ? ' ' + cls : '');
    this.f.appendChild(this.d); this.html = null;
  }
  set(x, y, html, an = 'cm', W = 700, H = 220) {
    if (html !== this.html) { this.d.innerHTML = html; this.html = html; }
    const h = an[0], v = an[1] || 'm';
    setA(this.f, { x: h === 'l' ? x : h === 'r' ? x - W : x - W / 2, y: v === 't' ? y : v === 'b' ? y - H : y - H / 2, width: W, height: H });
    const s = this.d.style;
    s.justifyContent = h === 'l' ? 'flex-start' : h === 'r' ? 'flex-end' : 'center';
    s.alignItems = v === 't' ? 'flex-start' : v === 'b' ? 'flex-end' : 'center';
    s.textAlign = h === 'l' ? 'left' : h === 'r' ? 'right' : 'center';
  }
  hide() { this.f.style.display = 'none'; }
  show() { this.f.style.display = ''; }
}
function labHTML(o) {
  let inner;
  if (o.tex != null) inner = T(o.tex, { hl: o.hl });
  else if (o.html != null) inner = md(o.html, o.hl);
  else inner = esc(o.text ?? '');
  const cls = o.bg === 'dark' ? 'chipd' : o.bg ? 'chip' : '';
  const st = [];
  if (o.color) st.push('color:' + o.color);
  if (o.size) st.push('font-size:' + o.size + 'px');
  if (o.weight) st.push('font-weight:' + o.weight);
  if (o.italic) st.push('font-style:italic');
  return `<span class="${cls}" style="${st.join(';')}">${inner}</span>`;
}

class Chart {
  constructor(parent, o) {
    this.id = 'c' + (++UID); this.o = o; this.w = o.w; this.h = o.h;
    this.m = Object.assign({ l: 72, r: 22, t: 40, b: 60 }, o.m || {});
    this.x = Object.assign({ min: 0, max: 1 }, o.x); this.y = Object.assign({ min: 0, max: 1 }, o.y);
    this.dbmix = this.y.db ? 1 : 0;
    this.svg = SV('svg', { viewBox: `0 0 ${o.w} ${o.h}`, class: 'chart' + (o.cls ? ' ' + o.cls : ''), role: 'img', 'aria-label': o.aria || '' });
    this.defs = SV('defs', null, this.svg);
    const cp = SV('clipPath', { id: this.id + 'pa' }, this.defs); this.paRect = SV('rect', {}, cp);
    this.L = {
      bg: SV('g', null, this.svg), grid: SV('g', null, this.svg), under: SV('g', { 'clip-path': `url(#${this.id}pa)` }, this.svg),
      plot: SV('g', { 'clip-path': `url(#${this.id}pa)` }, this.svg), axes: SV('g', null, this.svg), top: SV('g', null, this.svg)
    };
    this.bgRect = SV('rect', { class: 'c-plotbg' }, this.L.bg);
    this.axFO = []; this.marks = [];
    if (parent) parent.appendChild(this.svg);
    this.layout(); this.renderAxes();
  }
  get iw() { return this.w - this.m.l - this.m.r; }
  get ih() { return this.h - this.m.t - this.m.b; }
  layout() {
    setA(this.paRect, { x: this.m.l - 1, y: this.m.t - 1, width: this.iw + 2, height: this.ih + 2 });
    setA(this.bgRect, { x: this.m.l, y: this.m.t, width: this.iw, height: this.ih });
  }
  X(v) { const x = this.x; return this.m.l + (v - x.min) / (x.max - x.min) * this.iw; }
  Xi(px) { const x = this.x; return x.min + (px - this.m.l) / this.iw * (x.max - x.min); }
  Y(v) {
    const y = this.y, lin = this.m.t + (1 - (v - y.min) / (y.max - y.min)) * this.ih;
    if (!this.dbmix) return lin;
    const vd = 10 * Math.log10(Math.max(v, 1e-300));
    const yd = this.m.t + (1 - (vd - y.dmin) / (y.dmax - y.dmin)) * this.ih;
    return this.dbmix >= 1 ? yd : lerp(lin, yd, this.dbmix);
  }
  get x0() { return this.m.l; } get x1() { return this.w - this.m.r; }
  get y0() { return this.m.t; } get y1() { return this.h - this.m.b; }
  ticksOf(ax, isDb) {
    const min = isDb ? ax.dmin : ax.min, max = isDb ? ax.dmax : ax.max;
    let t = isDb ? ax.dticks : ax.ticks;
    if (typeof t === 'function') t = t(min, max);
    if (!Array.isArray(t)) t = niceTicks(min, max, t || 6);
    const nums = t.map(v => typeof v === 'number' ? v : v[0]);
    return t.map(v => {
      if (typeof v === 'number') return { v, s: ax.fmt ? ax.fmt(v) : autoFmt(v, nums) };
      return { v: v[0], s: v[1], tex: v[2] !== false && /[\\_^{]/.test(v[1]) };
    });
  }
  axFOget(i) { if (!this.axFO[i]) this.axFO[i] = new FO(this.L.axes); const f = this.axFO[i]; f.show(); if (f.f.parentNode !== this.L.axes) this.L.axes.appendChild(f.f); return f; }
  renderAxes() {
    const g = this.L.grid, a = this.L.axes;
    g.textContent = ''; [...a.childNodes].forEach(n => { if (n.nodeName !== 'foreignObject') n.remove(); });
    this.axFO.forEach(f => f.hide());
    let fi = 0;
    const { x0, x1, y0, y1 } = this, o = this.o;
    const xt = this.ticksOf(this.x), useDb = this.dbmix > .5, yt = this.ticksOf(this.y, useDb);
    for (const t of xt) {
      const px = this.X(t.v); if (px < x0 - .5 || px > x1 + .5) continue;
      if (o.grid !== false) SV('line', { x1: px, x2: px, y1: y0, y2: y1, class: 'c-gl' }, g);
      SV('line', { x1: px, x2: px, y1: y1, y2: y1 + 6, class: 'c-tk' }, a);
      if (t.tex) this.axFOget(fi++).set(px, y1 + 9, labHTML({ tex: t.s, size: 18, color: '#4E6476' }), 'ct');
      else SV('text', { x: px, y: y1 + 27, 'text-anchor': 'middle', class: 'c-tl' }, a).textContent = t.s;
    }
    for (const t of yt) {
      const py = useDb ? this.Y(Math.pow(10, t.v / 10)) : this.Y(t.v); if (py < y0 - .5 || py > y1 + .5) continue;
      if (o.grid !== false) SV('line', { x1: x0, x2: x1, y1: py, y2: py, class: 'c-gl' }, g);
      SV('line', { x1: x0 - 6, x2: x0, y1: py, y2: py, class: 'c-tk' }, a);
      if (t.tex) this.axFOget(fi++).set(x0 - 9, py, labHTML({ tex: t.s, size: 18, color: '#4E6476' }), 'rm');
      else SV('text', { x: x0 - 10, y: py + 6, 'text-anchor': 'end', class: 'c-tl' }, a).textContent = t.s;
    }
    SV('line', { x1: x0, x2: x1, y1: y1, y2: y1, class: 'c-sp' }, a);
    SV('line', { x1: x0, x2: x0, y1: y0, y2: y1, class: 'c-sp' }, a);
    if (!useDb && this.y.min < 0 && this.y.max > 0 && o.zero !== false) { const py = this.Y(0); SV('line', { x1: x0, x2: x1, y1: py, y2: py, class: 'c-zero' }, a); }
    if (o.xzero && this.x.min < 0 && this.x.max > 0) { const px = this.X(0); SV('line', { x1: px, x2: px, y1: y0, y2: y1, class: 'c-zero', 'stroke-dasharray': '2 4' }, a); }
    const xl = typeof this.x.label === 'function' ? this.x.label(this) : this.x.label;
    const yl = typeof this.y.label === 'function' ? this.y.label(this) : (useDb && this.y.dlabel ? this.y.dlabel : this.y.label);
    if (xl) {
      const lp = this.x.lpos === 'end' && this.m.b < 58 ? 'in' : this.x.lpos;
      if (lp === 'in') this.axFOget(fi++).set(x1 - 4, y1 - 4, labHTML({ html: xl, size: 18, color: '#33495C', bg: true }), 'rb');
      else this.axFOget(fi++).set(lp === 'end' ? x1 : (x0 + x1) / 2, this.h - 2, labHTML({ html: xl, size: 19, color: '#33495C' }), lp === 'end' ? 'rb' : 'cb');
    }
    if (yl) this.axFOget(fi++).set(x0 - (this.y.lx ?? 4), y0 - 8, labHTML({ html: yl, size: 19, color: '#33495C' }), 'lb');
  }
  add(mk, layer) { mk.attach(this, this.L[layer || mk.o.layer || 'plot']); this.marks.push(mk); return mk; }
  render() { this.renderAxes(); for (const mk of this.marks) if (mk.shown || mk.hiding) mk.render(); }
  goto(k, anim) {
    if (this.o.dom) { const d = this.o.dom(k); if (d) this.setDomain(d, anim); }
    for (const mk of this.marks) mk.step(k, anim);
  }
  setDomain(d, anim) {
    const cur = { x0: this.x.min, x1: this.x.max, y0: this.y.min, y1: this.y.max, db: this.dbmix };
    const to = { x0: d.x ? d.x[0] : cur.x0, x1: d.x ? d.x[1] : cur.x1, y0: d.y ? d.y[0] : cur.y0, y1: d.y ? d.y[1] : cur.y1, db: d.db != null ? (d.db ? 1 : 0) : cur.db };
    const apply = s => { this.x.min = s.x0; this.x.max = s.x1; this.y.min = s.y0; this.y.max = s.y1; this.dbmix = s.db; };
    const swap = () => { ['xticks', 'yticks', 'xlabel', 'ylabel'].forEach(k => { if (d[k] !== undefined) { const ax = k[0] === 'x' ? this.x : this.y; ax[k.slice(1) === 'ticks' ? 'ticks' : 'label'] = d[k]; } }); };
    if (same(cur, to)) { swap(); this.render(); return; }
    if (this.dt) this.dt.cancel();
    if (!anim) { apply(to); swap(); this.render(); return; }
    let swapped = false;
    this.dt = tween(d.dur || 900, t => { apply(lerpAny(cur, to, t)); if (t > .5 && !swapped) { swap(); swapped = true; } this.render(); });
  }
  /* coordenadas do ponto (dados) em px do svg */
  P(x, y) { return [this.X(x), this.Y(y)]; }
}

class Mark {
  constructor(o = {}) {
    this.o = o; this.g = SV('g'); if (o.cls) this.g.setAttribute('class', o.cls);
    this.shown = !o.vis; this.grow = 1; this.anim = null;
    if (!this.shown) this.g.style.display = 'none';
  }
  attach(c, layer) {
    this.c = c; layer.appendChild(this.g);
    if (this.o.p) this.pv = this.o.p(-1);
    if (this.build) this.build();
    if (this.shown) this.render();
    return this;
  }
  val(v) { return typeof v === 'function' ? v(this.pv, this) : v; }
  cancel() { if (this.anim) { this.anim.cancel(); this.anim = null; } }
  step(k, anim) {
    const o = this.o;
    if (o.p) { const np = o.p(k); if (!same(np, this.pv)) this.setP(np, anim && (this.shown || (o.vis && o.vis(k)))); }
    if (o.vis) { const v = !!o.vis(k); if (v !== this.shown) v ? this.show(anim) : this.hide(anim); }
  }
  setP(np, anim) {
    const from = this.pv;
    if (this.pt) this.pt.cancel();
    if (!anim || typeof np !== 'number' && !Array.isArray(np) && typeof np !== 'object') { this.pv = np; if (this.shown) this.render(); return; }
    this.pt = tween(this.o.pdur || 900, t => { this.pv = lerpAny(from, np, t); if (this.shown) this.render(); }, { delay: this.o.pdelay || 0, ease: this.o.pease });
  }
  get mode() { return this.o.reveal || this.rv || 'fade'; }
  clipRect() {
    if (!this.cr) {
      this.cid = this.c.id + 'k' + (++UID);
      const cp = SV('clipPath', { id: this.cid }, this.c.defs);
      this.cr = SV('rect', { x: -4000, y: -4000, width: 0, height: 9000 }, cp);
    }
    this.g.setAttribute('clip-path', `url(#${this.cid})`);
    return this.cr;
  }
  show(anim) {
    this.shown = true; this.hiding = false; this.cancel(); this.g.style.display = '';
    const mode = this.mode;
    if (!anim || RM) { this.g.style.opacity = 1; this.grow = 1; this.g.removeAttribute('clip-path'); this.render(); return; }
    const dur = this.o.dur || (mode === 'draw' ? 850 : mode === 'grow' ? 650 : 420), delay = this.o.delay || 0;
    this.render();
    if (mode === 'draw') {
      const r = this.clipRect(); this.g.style.opacity = 1;
      const xa = this.o.ra != null ? this.c.X(this.val(this.o.ra)) : this.c.x0 - 2, xb = this.o.rb != null ? this.c.X(this.val(this.o.rb)) : this.c.x1 + 2;
      const rtl = !!this.o.rtl;
      r.setAttribute('width', 0); r.setAttribute('x', rtl ? xb : -4000);
      this.anim = tween(dur, t => {
        if (rtl) { const x = lerp(xb, xa, t); setA(r, { x, width: 9000 }); }
        else setA(r, { x: -4000, width: 4000 + lerp(xa, xb, t) });
      }, { delay, ease: this.o.ease || easeIO });
      const a = this.anim; a.done.then(() => { if (!a.dead) this.g.removeAttribute('clip-path'); });
    } else if (mode === 'grow') {
      this.grow = 0; this.g.style.opacity = 1; this.render();
      this.anim = tween(dur, t => { this.grow = t; this.render(); }, { delay, ease: easeOut });
    } else {
      this.g.style.opacity = 0;
      this.anim = tween(dur, t => { this.g.style.opacity = t; }, { delay });
    }
  }
  hide(anim) {
    this.shown = false; this.cancel();
    if (!anim || RM) { this.g.style.display = 'none'; this.hiding = false; return; }
    this.hiding = true; this.g.removeAttribute('clip-path');
    const op0 = +this.g.style.opacity || 1;
    const a = this.anim = tween(300, t => { this.g.style.opacity = op0 * (1 - t); });
    a.done.then(() => { if (!this.shown && !a.dead) { this.g.style.display = 'none'; this.hiding = false; } });
  }
  render() { }
}
/* Curva y = f(x, p) ou pontos pts(p) */
class Curve extends Mark {
  constructor(o) { super(o); this.rv = 'draw'; }
  build() { this.path = SV('path', { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, this.g); }
  pts() {
    const o = this.o, c = this.c;
    if (o.pts) return this.val(o.pts);
    const a = o.x0 != null ? this.val(o.x0) : c.x.min, b = o.x1 != null ? this.val(o.x1) : c.x.max, n = o.n || 500, out = [];
    for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; out.push([x, o.f(x, this.pv, this)]); }
    return out;
  }
  render() {
    const c = this.c, o = this.o; let d = '', pen = false;
    for (const [x, y] of this.pts()) {
      if (y == null || !isFinite(y)) { pen = false; continue; }
      const X = c.X(x), Y = clamp(c.Y(y), -4000, 6000);
      d += (pen ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1); pen = true;
    }
    setA(this.path, { d, stroke: this.val(o.color) || C.petro, 'stroke-width': this.val(o.w) || 3.2, 'stroke-dasharray': this.val(o.dash) || 'none', opacity: this.val(o.op) ?? 1 });
  }
}
/* Área entre base(x) e f(x) em [a,b] */
class Area extends Mark {
  constructor(o) { super(o); this.rv = 'draw'; }
  build() { this.path = SV('path', {}, this.g); }
  render() {
    const c = this.c, o = this.o, p = this.pv;
    let top;
    if (o.pts) top = this.val(o.pts);
    else {
      const a = this.val(o.a ?? c.x.min), b = this.val(o.b ?? c.x.max), n = o.n || 300; top = [];
      if (b <= a) { this.path.setAttribute('d', ''); return; }
      for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; top.push([x, o.f(x, p, this)]); }
    }
    const base = o.base;
    let d = '';
    top.forEach(([x, y], i) => { d += (i ? 'L' : 'M') + c.X(x).toFixed(1) + ' ' + clamp(c.Y(y), -4000, 6000).toFixed(1); });
    for (let i = top.length - 1; i >= 0; i--) { const x = top[i][0]; const yb = base == null ? (c.dbmix ? c.y1 : 0) : typeof base === 'function' ? base(x, p) : base; d += 'L' + c.X(x).toFixed(1) + ' ' + (c.dbmix && base == null ? c.y1 : clamp(c.Y(yb), -4000, 6000)).toFixed(1); }
    setA(this.path, { d: d + 'Z', fill: this.val(o.fill) || C.goldF, stroke: this.val(o.stroke) || 'none', 'stroke-width': o.sw || 2, opacity: this.val(o.op) ?? 1 });
  }
}
/* Impulso (raia) com peso escrito */
class Impulse extends Mark {
  constructor(o) { super(o); this.rv = 'grow'; if (!o.layer) o.layer = 'top'; }
  build() { this.line = SV('line', {}, this.g); this.head = SV('path', {}, this.g); if (this.o.tex || this.o.html) this.fo = new FO(this.g); }
  render() {
    const c = this.c, o = this.o, x = c.X(this.val(o.x)), base = this.val(o.base) || 0, hv = this.val(o.h) * this.grow;
    const y0 = c.Y(base), y1 = c.Y(base + hv), col = this.val(o.color) || C.navy, up = y1 <= y0, s = o.hs || 13;
    setA(this.line, { x1: x, x2: x, y1: y0, y2: up ? y1 + s * .8 : y1 - s * .8, stroke: col, 'stroke-width': o.w || 3.4 });
    setA(this.head, { d: up ? `M${x} ${y1}L${x - s * .55} ${y1 + s}L${x + s * .55} ${y1 + s}Z` : `M${x} ${y1}L${x - s * .55} ${y1 - s}L${x + s * .55} ${y1 - s}Z`, fill: col, opacity: Math.abs(y1 - y0) > 4 ? 1 : 0 });
    if (this.fo) {
      const side = o.side || 'r', lx = side === 'r' ? x + 10 : side === 'l' ? x - 10 : x, ly = side === 't' ? y1 - 6 : y1 + 10;
      this.fo.set(lx + (o.dx || 0), ly + (o.dy || 0), labHTML({ tex: this.val(o.tex), html: this.val(o.html), color: o.lcolor || col, size: o.size || 20, bg: o.bg }), side === 'r' ? 'lt' : side === 'l' ? 'rt' : 'cb');
      this.fo.d.style.opacity = this.grow > .6 && Math.abs(y1 - y0) > 4 ? 1 : 0;
    }
  }
}
/* Haste (stem plot) */
class Stems extends Mark {
  constructor(o) { super(o); this.rv = 'grow'; }
  build() { this.gg = SV('g', null, this.g); }
  render() {
    const c = this.c, o = this.o, pts = this.val(o.pts), col = this.val(o.color) || C.petro; this.gg.textContent = '';
    const b0 = o.base || 0;
    this.gg.setAttribute('opacity', this.val(o.op) ?? 1);
    pts.forEach(([k, v, bb]) => {
      const base = bb ?? b0, x = c.X(k), y0 = c.Y(base), y1 = c.Y(base + v * this.grow);
      SV('line', { x1: x, x2: x, y1: y0, y2: y1, stroke: col, 'stroke-width': o.w || 3 }, this.gg);
      SV('circle', { cx: x, cy: y1, r: o.r || 6.5, fill: o.hollow ? '#fff' : col, stroke: col, 'stroke-width': 2.5 }, this.gg);
    });
  }
}
class VLine extends Mark {
  constructor(o) { super(o); if (!o.layer) o.layer = 'top'; this.rv = o.reveal || 'fade'; }
  build() { this.l = SV('line', {}, this.g); if (this.o.tex || this.o.html || this.o.text) this.fo = new FO(this.g); }
  render() {
    const c = this.c, o = this.o, x = c.X(this.val(o.x));
    const ya = o.y0 != null ? c.Y(this.val(o.y0)) : c.y1, yb = o.y1 != null ? c.Y(this.val(o.y1)) : c.y0;
    setA(this.l, { x1: x, x2: x, y1: ya, y2: lerp(ya, yb, this.grow), stroke: this.val(o.color) || C.navy, 'stroke-width': o.w || 2, 'stroke-dasharray': o.dash ?? '7 6' });
    if (this.fo) this.fo.set(x + (o.dx ?? 0), (o.ly != null ? c.Y(this.val(o.ly)) : yb) + (o.dy ?? -4), labHTML({ tex: this.val(o.tex), html: this.val(o.html), text: this.val(o.text), color: o.lcolor || this.val(o.color) || C.navy, size: o.size || 18, bg: o.bg ?? true }), o.an || 'cb');
  }
}
class HLine extends Mark {
  constructor(o) { super(o); if (!o.layer) o.layer = 'top'; this.rv = o.reveal || 'draw'; }
  build() { this.l = SV('line', {}, this.g); if (this.o.tex || this.o.html || this.o.text) this.fo = new FO(this.g); }
  render() {
    const c = this.c, o = this.o, y = c.Y(this.val(o.y));
    const xa = o.x0 != null ? c.X(this.val(o.x0)) : c.x0, xb = o.x1 != null ? c.X(this.val(o.x1)) : c.x1;
    setA(this.l, { x1: xa, x2: xb, y1: y, y2: y, stroke: this.val(o.color) || C.navy, 'stroke-width': o.w || 2, 'stroke-dasharray': o.dash ?? '7 6' });
    if (this.fo) this.fo.set((o.lx != null ? c.X(this.val(o.lx)) : xb) + (o.dx ?? 0), y + (o.dy ?? -4), labHTML({ tex: this.val(o.tex), html: this.val(o.html), text: this.val(o.text), color: o.lcolor || this.val(o.color) || C.navy, size: o.size || 18, bg: o.bg ?? true }), o.an || 'rb');
  }
}
class Dot extends Mark {
  constructor(o) { super(o); if (!o.layer) o.layer = 'top'; this.rv = 'fade'; }
  build() { this.ci = SV('circle', {}, this.g); if (this.o.tex || this.o.html || this.o.text) this.fo = new FO(this.g); }
  render() {
    const c = this.c, o = this.o, x = c.X(this.val(o.x)), y = c.Y(this.val(o.y)), col = this.val(o.color) || C.gold;
    setA(this.ci, { cx: x, cy: y, r: o.r || 8, fill: o.hollow ? '#fff' : col, stroke: o.ring || (o.hollow ? col : '#fff'), 'stroke-width': o.sw || 3 });
    if (this.fo) this.fo.set(x + (o.dx ?? 12), y + (o.dy ?? -10), labHTML({ tex: this.val(o.tex), html: this.val(o.html), text: this.val(o.text), color: o.lcolor || C.ink, size: o.size || 19, bg: o.bg ?? true }), o.an || 'lb');
  }
}
class Label extends Mark {
  constructor(o) { super(o); if (!o.layer) o.layer = 'top'; this.rv = 'fade'; }
  build() { this.fo = new FO(this.g, this.o.cls); }
  render() {
    const c = this.c, o = this.o;
    let x = this.val(o.x), y = this.val(o.y);
    if (!(o.px || o.xpx)) x = c.X(x);
    if (!(o.px || o.ypx)) y = c.Y(y);
    this.fo.set(x + (o.dx || 0), y + (o.dy || 0), labHTML({ tex: this.val(o.tex), html: this.val(o.html), text: this.val(o.text), color: this.val(o.color), size: o.size || 20, bg: o.bg, weight: o.weight, italic: o.italic }), o.an || 'cm', o.W || 700, o.H || 220);
    if (o.op != null) this.fo.d.style.opacity = this.val(o.op);
  }
}
/* cota horizontal |<— texto —>| */
class Bracket extends Mark {
  constructor(o) { super(o); if (!o.layer) o.layer = 'top'; this.rv = 'fade'; }
  build() { this.p = SV('path', { fill: 'none' }, this.g); this.fo = new FO(this.g); }
  render() {
    const c = this.c, o = this.o, xa = c.X(this.val(o.x0)), xb = c.X(this.val(o.x1));
    const y = (o.ypx ? this.val(o.y) : c.Y(this.val(o.y))) + (o.dy || 0), col = o.color || C.navy, s = 7;
    setA(this.p, { d: `M${xa} ${y - s}V${y + s}M${xb} ${y - s}V${y + s}M${xa} ${y}H${xb}M${xa + 9} ${y - 5}L${xa} ${y}L${xa + 9} ${y + 5}M${xb - 9} ${y - 5}L${xb} ${y}L${xb - 9} ${y + 5}`, stroke: col, 'stroke-width': 2 });
    const below = o.below;
    this.fo.set((xa + xb) / 2, below ? y + 8 : y - 6, labHTML({ tex: this.val(o.tex), html: this.val(o.html), text: this.val(o.text), color: col, size: o.size || 18, bg: o.bg ?? true }), below ? 'ct' : 'cb');
  }
}
class Rect extends Mark {
  constructor(o) { super(o); this.rv = o.reveal || 'draw'; }
  build() { this.r = SV('rect', {}, this.g); }
  render() {
    const c = this.c, o = this.o, xa = c.X(this.val(o.x0)), xb = c.X(this.val(o.x1)), ya = c.Y(this.val(o.y0)), yb = c.Y(this.val(o.y1));
    setA(this.r, { x: Math.min(xa, xb), y: Math.min(ya, yb), width: Math.abs(xb - xa), height: Math.abs(yb - ya), fill: this.val(o.fill) || 'none', stroke: this.val(o.stroke) || 'none', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || 'none', rx: o.rx || 0, opacity: this.val(o.op) ?? 1 });
  }
}
/* desenho livre: o.draw(chart, g, p, mark) — g é limpo a cada render; mark.lab(key) dá rótulo persistente */
class Custom extends Mark {
  constructor(o) { super(o); this.rv = o.reveal || 'fade'; this.labs = {}; if (!o.layer) o.layer = 'top'; }
  build() { this.tmp = SV('g', null, this.g); this.lg = SV('g', null, this.g); }
  lab(key) { if (!this.labs[key]) this.labs[key] = new FO(this.lg); this.labs[key].used = true; this.labs[key].show(); return this.labs[key]; }
  render() {
    this.tmp.textContent = ''; for (const k in this.labs) this.labs[k].used = false;
    this.o.draw(this.c, this.tmp, this.pv, this);
    for (const k in this.labs) if (!this.labs[k].used) this.labs[k].hide();
  }
}
/* polígono/caminho a partir de pontos em coordenadas de dados */
function dPath(c, pts, close) { return pts.map(([x, y], i) => (i ? 'L' : 'M') + c.X(x).toFixed(1) + ' ' + clamp(c.Y(y), -4000, 6000).toFixed(1)).join('') + (close ? 'Z' : ''); }
function sample(f, a, b, n = 300) { const out = []; for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; out.push([x, f(x)]); } return out; }
function arrowPath(x1, y1, x2, y2, s = 11) {
  const a = Math.atan2(y2 - y1, x2 - x1), b = 0.42;
  return `M${x1} ${y1}L${x2} ${y2}M${x2 - s * Math.cos(a - b)} ${y2 - s * Math.sin(a - b)}L${x2} ${y2}L${x2 - s * Math.cos(a + b)} ${y2 - s * Math.sin(a + b)}`;
}

/* =====================================================================
   COMPONENTES DE PAINEL
   ===================================================================== */
const BOX = {
  plano: 'PLANO DE ATAQUE', res: 'RESOLUÇÃO COMENTADA', final: 'RESPOSTA FINAL', interp: 'INTERPRETAÇÃO FÍSICA', erro: 'ERRO COMUM',
  aplic: 'APLICAÇÃO NA ENGENHARIA ELÉTRICA', pesq: 'CONEXÃO COM A PESQUISA', dica: 'DICA DO PROFESSOR', analogia: 'ANALOGIA', teorema: 'TEOREMA',
  comoler: 'COMO LER', truque: 'TRUQUE MENTAL', resultado: 'RESULTADO', limit: 'LIMITAÇÕES E HIPÓTESES', hist: 'CURIOSIDADE HISTÓRICA'
};
function Box(kind, html, o = {}) {
  return E('div', { class: 'box box-' + kind + (o.size ? ' ' + o.size : ''), style: o.style },
    E('div', { class: 'box-h' }, BOX[kind] || kind, o.sub ? E('span', { html: ' — ' + md(o.sub) }) : null),
    E('div', { class: 'box-b', html: md(html, 'dark') }));
}
const ROAD = [
  ['O que foi dado?', 'Uma autocorrelação $R_X$, uma DEP $S_X$, um modelo do processo ou um filtro $H(f)$?'],
  ['As hipóteses valem?', 'O processo é WSS (média constante e $R_X$ dependendo só de $\\tau$)?'],
  ['Qual ponte usar?', 'A definição (Eq. 7.9), Wiener–Khinchin (Eq. 8.1) com a tabela de pares, ou a regra do filtro (Eq. 8.5).'],
  ['Calcule usando propriedades', 'Linearidade, modulação, escala, pares conhecidos — não “do zero”.'],
  ['Confira e interprete', '$S_X\\ge0$? É par? $\\int S_X\\,\\dd f=R_X(0)$? Unidades? Bilateral ou unilateral?']
];
function Road5(on) {
  return E('div', { class: 'road5' }, ROAD.map((r, i) => E('div', { class: 'st' + ((Array.isArray(on) ? on.includes(i + 1) : on === i + 1) ? ' on' : '') },
    E('span', { class: 'n', text: i + 1 }), E('div', { html: `<b>${r[0]}</b> ${md(r[1])}` }))));
}
class ResPanel {
  constructor(parent, sub) {
    this.road = E('div', { class: 'road' });
    this.list = E('div', { class: 'rp-list' });
    this.root = E('div', { class: 'rp' }, E('div', { class: 'rp-h' }, E('span', { text: 'RESOLUÇÃO COMENTADA' }), E('span', { text: sub ? '— ' + sub : '' })), this.road, this.list);
    parent.append(this.root); this.last = -2;
  }
  set(rows, cur, anim) {
    this.list.textContent = '';
    const n = Math.min(cur, rows.length - 1), first = Math.max(0, n - 9);
    if (first > 0) this.list.append(E('div', { class: 'rp-row', style: { fontSize: '15px' }, text: `⋯ ${first} passo${first > 1 ? 's' : ''} anterior${first > 1 ? 'es' : ''} (versão para impressão traz a resolução inteira)` }));
    for (let i = first; i <= n; i++) {
      const r = rows[i], isCur = i === n;
      const row = E('div', { class: 'rp-row' + (isCur ? ' cur' : '') + (isCur && anim && n > this.last ? ' enter' : '') });
      row.innerHTML = (r.tag ? `<span class="tag">${r.tag}</span>` : '') + T(r.tex, { hl: isCur ? 'on' : 'p' });
      if (isCur && r.note) row.append(E('div', { class: 'rp-cm' }, E('span', { html: md(r.note) })));
      this.list.append(row);
    }
    const rd = n >= 0 ? rows[n].road : 0;
    this.road.innerHTML = [1, 2, 3, 4, 5].map(i => `<i class="${i === rd ? 'on' : ''}">${i}</i>`).join('') + (rd ? `<span class="rl">${ROAD[rd - 1][0]}</span>` : '');
    this.road.style.display = rows.some(r => r.road) ? '' : 'none';
    const sc = () => { this.list.scrollTop = this.list.scrollHeight; };
    requestAnimationFrame(sc); setTimeout(sc, 600);
    this.last = n;
  }
}
/* controle deslizante com rótulo e leitura */
function Slider(parent, o) {
  const id = o.id || ('sl' + (++UID));
  const inp = E('input', { type: 'range', id, min: o.min, max: o.max, step: o.step || 'any', value: o.value });
  const val = E('span', { class: 'val' });
  const row = E('div', { class: 'ctl' }, E('label', { for: id, html: md(o.label) }), inp, val);
  if (parent) parent.append(row);
  const toV = s => o.log ? Math.pow(10, +s) : +s;
  const upd = (fire) => {
    const v = toV(inp.value);
    inp.style.setProperty('--pct', ((inp.value - o.min) / (o.max - o.min) * 100) + '%');
    val.innerHTML = o.fmt ? md(o.fmt(v)) : nf(v, 2);
    if (fire && o.oninput) o.oninput(v);
  };
  inp.addEventListener('input', () => upd(true));
  inp.addEventListener('pointerup', () => inp.blur());
  upd(false);
  return { row, inp, get: () => toV(inp.value), set(v, fire = false) { inp.value = o.log ? Math.log10(v) : v; upd(fire); } };
}
function Readout(parent, items) {
  const dl = E('dl', { class: 'readout' }); const refs = {};
  for (const [k, lab, cls] of items) { dl.append(E('dt', { html: md(lab) })); refs[k] = E('dd', { class: cls || '' }); dl.append(refs[k]); }
  if (parent) parent.append(dl);
  return { root: dl, set(k, html) { if (refs[k].innerHTML !== html) refs[k].innerHTML = html; } };
}
function chartCard(parent, title, o = {}) {
  const card = E('div', { class: 'card cc' + (o.cls ? ' ' + o.cls : ''), style: o.style });
  if (title) card.append(E('div', { class: 'cc-t' }, E('span', { html: md(title) })));
  parent.append(card); return card;
}
function FArrow(top, bottom) {
  const mk = (txt, dir) => E('div', { class: 'fa' }, E('span', { html: md(txt) }), E('span', { html: `<svg viewBox="0 0 60 20"><path d="${dir > 0 ? 'M2 10H54M44 3L56 10L44 17' : 'M58 10H6M16 3L4 10L16 17'}" stroke="#E3A23B" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>` }));
  return E('div', { class: 'farrow' }, top ? mk(top, 1) : null, bottom ? mk(bottom, -1) : null);
}

/* =====================================================================
   CENAS E NAVEGAÇÃO
   ===================================================================== */
const SCENES = [];
const SOON = [];
const APP = { si: -1, k: 0, scale: 1, flow: false };
const LV = {
  1: { name: 'Aquecimento', sub: 'ler uma DEP', c: 'var(--n1)', hex: '#A9CED3', q: '8.1 a 8.4' },
  2: { name: 'W–K direto', sub: 'de $R_X$ para $S_X$', c: 'var(--n2)', hex: '#7BB1B6', q: '8.5 a 8.9' },
  3: { name: 'Caminho inverso', sub: 'de $S_X$ para $R_X$', c: 'var(--n3)', hex: '#4C979C', q: '8.10 a 8.13' },
  4: { name: 'Filtragem', sub: '$S_Y=|H|^2S_X$', c: 'var(--n4)', hex: '#2F5D84', q: '8.14 a 8.17' },
  5: { name: 'Desafios', sub: 'pesquisa e projeto', c: 'var(--n5)', hex: '#10304F', q: '8.18 a 8.20' }
};
const KIND = { enun: 'ENUNCIADO', plano: 'PLANO DE ATAQUE', res: 'RESOLUÇÃO', erro: 'ERRO COMUM', final: 'RESPOSTA FINAL', interp: 'INTERPRETAÇÃO' };
function addScene(d) { d.idx = SCENES.length; SCENES.push(d); return d; }

function Frame(root, o) {
  const kick = E('div', { class: 'kick' }, o.level ? E('span', { class: 'lv-stripe', style: { '--lc': LV[o.level].c } }) : null, E('span', { html: o.kicker }));
  const kind = E('span', { class: 'kind', hidden: true });
  const r = E('div', { class: 'hd-r' });
  if (o.level) {
    const L = LV[o.level];
    r.append(E('span', { class: 'lvl' + (o.level >= 4 ? ' dark' : ''), style: { '--lc': L.c } }, 'Nível ' + o.level, E('span', { class: 'dots', text: '●'.repeat(o.level) + '○'.repeat(5 - o.level) })));
  }
  r.append(kind);
  const plain = String(o.title).replace(/\$[^$]*\$/g, 'xx').replace(/<[^>]+>/g, '');
  const hd = E('header', { class: 'hd' }, E('div', { class: 'hd-l' }, kick, E('h1', { class: 'ttl' + (plain.length > 46 ? ' long' : ''), html: md(o.title) })), r);
  const body = E('div', { class: 'bd' + (o.split ? ' split' : '') });
  root.append(hd, body);
  const f = { hd, body, setKind(k) { if (!k) { kind.hidden = true; return; } kind.hidden = false; kind.dataset.k = k; kind.textContent = KIND[k] || k; } };
  if (o.split) { f.L = E('div', { class: 'lft' }); f.R = E('div', { class: 'rgt' }); body.append(f.L, f.R); }
  return f;
}
/* utilitários de etapas: from('a1')(k) etc. */
function Steps(steps) {
  const names = steps.map(s => typeof s === 'string' ? s : s.n);
  const I = n => { const i = names.indexOf(n); if (i < 0) throw new Error('etapa ' + n); return i; };
  return {
    I,
    from: n => k => k >= I(n),
    upto: n => k => k >= 0 && k <= I(n),
    btw: (a, b) => k => k >= I(a) && k < I(b),
    only: (...ns) => k => k >= 0 && ns.includes(names[k]),
    not: (...ns) => k => k >= 0 && !ns.includes(names[k]),
    kind: k => k >= 0 ? (steps[k].k || null) : null,
    name: k => names[k]
  };
}
/* mostra um subconjunto de painéis (.pane) */
function panes(map, key) { for (const k in map) map[k].classList.toggle('off', k !== key); }

function sceneRoot(d) {
  if (!d.root) {
    d.root = E('section', { class: 'scene', 'data-id': d.id, 'aria-roledescription': 'slide' });
    STAGE.insertBefore(d.root, FOOT);
    d.api = d.build(d.root, d) || {};
    if (d.api.goto) d.api.goto(-1, false, -1);
  }
  return d.root;
}
function go(si, k, o = {}) {
  si = clamp(si, 0, SCENES.length - 1);
  const d = SCENES[si]; sceneRoot(d);
  k = clamp(k, 0, d.steps.length - 1);
  const anim = o.anim !== false;
  const psi = APP.si, pk = APP.k;
  APP.si = si; APP.k = k;
  if (si !== psi) {
    const prev = SCENES[psi];
    if (prev) { prev.root.classList.remove('on'); prev.api.leave && prev.api.leave(); }
    d.root.classList.add('on');
    const fwd = o.fwd !== false && k === 0;
    if (d.api.goto) { d.api.goto(-1, false, -1); if (fwd) d.api.goto(0, anim, -1); else d.api.goto(k, false, -1); }
    d.api.enter && d.api.enter(k);
  } else if (k !== pk) {
    d.api.goto && d.api.goto(k, anim && Math.abs(k - pk) === 1, pk);
  }
  chrome(); writeHash();
}
function next() { const d = SCENES[APP.si]; if (APP.k < d.steps.length - 1) go(APP.si, APP.k + 1); else if (APP.si < SCENES.length - 1) go(APP.si + 1, 0); else toast('Fim da Parte atual — as próximas questões entram nas próximas partes.'); }
function prev() { if (APP.k > 0) go(APP.si, APP.k - 1); else if (APP.si > 0) { const p = SCENES[APP.si - 1]; sceneRoot(p); go(APP.si - 1, p.steps.length - 1, { fwd: false }); } }
function replay() {
  const d = SCENES[APP.si]; if (!d) return;
  if (d.api.replay) { d.api.replay(APP.k); return; }
  if (d.api.goto) { const k = APP.k; APP.k = k - 1; d.api.goto(k - 1, false, -1); APP.k = k; d.api.goto(k, true, k - 1); }
}
function hashFor(si, k) { return SCENES[si].id + '-' + (k + 1); }
function writeHash() {
  const h = '#' + hashFor(APP.si, APP.k);
  if (location.hash === h) return;
  APP.ownHash = h;
  try { history.replaceState(null, '', h); } catch (e) { try { location.hash = h; } catch (e2) { } }
}
function readHash() {
  let h = decodeURIComponent((location.hash || '').slice(1)).replace(/\//g, '-').toLowerCase();
  if (!h) return null;
  let best = null;
  for (const d of SCENES) {
    if (h === d.id || (h.startsWith(d.id + '-') && /^\d+$/.test(h.slice(d.id.length + 1)))) {
      if (!best || d.id.length > best.d.id.length) best = { d, k: h === d.id ? 0 : (+h.slice(d.id.length + 1)) - 1 };
    }
  }
  return best;
}
function chrome() {
  const d = SCENES[APP.si];
  const dots = document.getElementById('dots'); dots.textContent = '';
  d.steps.forEach((s, i) => {
    const b = E('button', { class: i === APP.k ? 'cur' : i < APP.k ? 'done' : '', 'aria-label': 'Etapa ' + (i + 1), title: 'Etapa ' + (i + 1) });
    b.addEventListener('click', () => go(APP.si, i, { anim: i === APP.k + 1 })); dots.append(b);
  });
  document.getElementById('pos').textContent = `${d.short || d.id.toUpperCase()} · etapa ${APP.k + 1}/${d.steps.length}`;
  document.querySelectorAll('#menu a[data-si]').forEach(a => a.classList.toggle('cur', +a.dataset.si === APP.si));
  if (!document.getElementById('notes').hidden) fillNotes();
}
let toastT;
function toast(msg, ms = 2200) { const t = document.getElementById('toast'); t.innerHTML = md(msg); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

/* menu lateral */
function buildMenu() {
  const m = document.getElementById('menu'); m.textContent = '';
  m.append(E('h2', { text: 'Capítulo 8 — Wiener–Khinchin' }));
  const groups = [['t', 'Parte 0 — Teoria (Seções 8.1 a 8.3)', null], ['n1', 'Nível 1 — Aquecimento', 1], ['n2', 'Nível 2 — W–K direto', 2], ['n3', 'Nível 3 — Caminho inverso', 3], ['n4', 'Nível 4 — Filtragem', 4], ['n5', 'Nível 5 — Desafios', 5], ['f', 'Fecho', null]];
  for (const [g, title, lv] of groups) {
    m.append(E('h3', null, lv ? E('i', { style: { '--lc': LV[lv].c } }) : null, title));
    SCENES.filter(d => d.group === g).forEach(d => {
      const a = E('a', { href: '#' + d.id + '-1', 'data-si': d.idx }, E('span', { class: 'n', text: d.mnum || '' }), E('span', { html: md(d.menu) }));
      a.addEventListener('click', ev => { ev.preventDefault(); closeOverlays(); go(d.idx, 0); });
      m.append(a);
    });
    SOON.filter(s => s.group === g).forEach(s => m.append(E('a', { class: 'soon', href: '#', onclick: ev => { ev.preventDefault(); toast(s.msg || 'Entra numa próxima parte.'); } }, E('span', { class: 'n', text: s.num }), E('span', { html: md(s.title + ' · <i>em breve</i>') }))));
  }
  const pv = E('a', { href: '#', onclick: ev => { ev.preventDefault(); closeOverlays(); openPrint(); } }, E('span', { class: 'n', text: '⎙' }), E('span', { text: 'Versão para impressão (questões prontas)' }));
  m.append(E('h3', null, 'Ferramentas'), pv);
  m.append(E('div', { class: 'mk', html: '<b>Teclas:</b> → / espaço avançam · ← volta · <b>M</b> menu · <b>N</b> notas do professor · <b>R</b> repete a animação · <b>G</b> + número vai à questão (ex.: G 3) · <b>Esc</b> fecha.' }));
}
function openMenu() { const m = document.getElementById('menu'); buildMenu(); m.hidden = false; document.getElementById('ovl').hidden = false; chrome(); const c = m.querySelector('a.cur'); if (c) c.scrollIntoView({ block: 'center' }); }
function closeOverlays() { document.getElementById('menu').hidden = true; document.getElementById('ovl').hidden = true; document.getElementById('notes').hidden = true; const md2 = document.querySelector('.modal'); if (md2) md2.remove(); }
function fillNotes() {
  const d = SCENES[APP.si], n = document.getElementById('notes');
  let nt = d.notes ? (typeof d.notes === 'function' ? d.notes(APP.k) : d.notes) : null;
  n.textContent = '';
  n.append(E('h4', { text: 'Notas do professor' }), E('div', { class: 'nt', html: md(d.menu) }));
  if (!nt) { n.append(E('p', { text: 'Sem notas para este slide.' })); return; }
  if (nt.fala) n.append(E('p', { html: '<b>O que falar:</b> ' + md(nt.fala) }));
  if (nt.pergunta) n.append(E('p', { class: 'q', html: '<b>Pergunta à turma:</b> ' + md(nt.pergunta) }));
  if (nt.passo && nt.passo[APP.k]) n.append(E('p', { html: '<b>Nesta etapa:</b> ' + md(nt.passo[APP.k]) }));
  if (nt.tempo) n.append(E('p', { class: 'tm', text: 'Tempo sugerido: ' + nt.tempo }));
}
function toggleNotes() { const n = document.getElementById('notes'); n.hidden = !n.hidden; if (!n.hidden) fillNotes(); }

/* G + número */
let gMode = null;
function gKey(ch) {
  if (gMode === null) return false;
  clearTimeout(gMode.t);
  if (/\d/.test(ch)) { gMode.s += ch; toast('Ir para a questão 8.' + gMode.s + ' …'); gMode.t = setTimeout(gGo, 1100); return true; }
  if (ch === 'Enter') { gGo(); return true; }
  gMode = null; return false;
}
function gGo() {
  const s = gMode && gMode.s; gMode = null; if (!s) return;
  const d = SCENES.find(x => x.id === 'q8-' + (+s));
  if (d) { go(d.idx, 0); toast('Questão 8.' + (+s)); }
  else { const so = SOON.find(x => x.num === '8.' + (+s)); toast(so ? 'A Questão 8.' + (+s) + ' entra numa próxima parte.' : 'Não há Questão 8.' + s + '.'); }
}
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase(), isRange = tag === 'input' && e.target.type === 'range';
  if (tag === 'input' && !isRange || tag === 'textarea') return;
  if (gKey(e.key)) { e.preventDefault(); return; }
  const k = e.key;
  if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !isRange)) { e.preventDefault(); next(); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
  else if (k === 'Home') go(APP.si, 0);
  else if (k === 'End') go(APP.si, SCENES[APP.si].steps.length - 1, { anim: false });
  else if (k === 'm' || k === 'M') { const m = document.getElementById('menu'); m.hidden ? openMenu() : closeOverlays(); }
  else if (k === 'n' || k === 'N') toggleNotes();
  else if (k === 'r' || k === 'R') replay();
  else if (k === 'g' || k === 'G') { gMode = { s: '', t: setTimeout(() => { gMode = null; }, 2500) }; toast('Ir para a questão 8.__ (digite o número)'); }
  else if (k === 'Escape') { if (document.body.classList.contains('pv')) closePrint(); else closeOverlays(); }
}

/* escala do palco / modo fluxo */
function fit() {
  const W = window.innerWidth, H = window.innerHeight;
  const flow = W < 860 || W / H < 1.0;
  document.body.classList.toggle('flow', flow); APP.flow = flow;
  if (flow) { STAGE.style.transform = 'none'; APP.scale = 1; return; }
  const s = Math.min(W / 1600, H / 900);
  APP.scale = s;
  STAGE.style.transform = `translate(${(W - 1600 * s) / 2}px, ${(H - 900 * s) / 2}px) scale(${s})`;
}
/* posição de um elemento em coordenadas do palco, relativo a um contêiner */
function stagePos(elm, cont) {
  const a = elm.getBoundingClientRect(), b = cont.getBoundingClientRect(), s = APP.scale || 1;
  return { x: (a.left - b.left) / s, y: (a.top - b.top) / s, w: a.width / s, h: a.height / s };
}
function svgPt(chart, x, y, cont) {
  const r = chart.svg.getBoundingClientRect(), b = cont.getBoundingClientRect(), s = APP.scale || 1;
  const kx = r.width / chart.w, ky = r.height / chart.h;
  return { x: (r.left - b.left + chart.X(x) * kx) / s, y: (r.top - b.top + chart.Y(y) * ky) / s };
}

/* =====================================================================
   PARTE 0 — ABERTURA E TEORIA (Seções 8.1 a 8.3)
   ===================================================================== */

/* ---------- S1 · Capa com a escada (Fig. 8.1) ---------- */
addScene({
  id: 's1', group: 't', mnum: 'S1', short: 'S1', menu: 'Capa — a escada do capítulo', steps: ['capa'],
  notes: {
    fala: 'No Capítulo 7 a DEP veio pelo caminho longo: truncar, transformar, dividir pelo tempo e promediar. Hoje ganhamos o atalho — o Teorema de Wiener–Khinchin — e subimos cinco degraus de questões, do aquecimento aos desafios.',
    pergunta: 'Analogia do treino com carga progressiva: se uma questão de nível 4 parecer difícil, o problema costuma estar em qual nível?',
    tempo: '2 min'
  },
  build(root) {
    root.classList.add('cover');
    const W = 1180, base = 292, bw = 230, gap = 6, hs = [34, 70, 108, 148, 190];
    const svg = SV('svg', { viewBox: `0 0 ${W} 340`, class: 'stairs', role: 'img', 'aria-label': 'A escada do capítulo: cinco níveis, vinte questões' });
    const arr = SV('g', null, svg);
    SV('path', { d: arrowPath(10, 22, W - 20, 22, 14), stroke: C.gold, 'stroke-width': 3, fill: 'none' }, arr);
    const at = SV('text', { x: W / 2, y: 12, 'text-anchor': 'middle', fill: C.gold, 'font-size': 17, 'font-weight': 600, 'letter-spacing': '.06em', 'font-family': 'Fira Sans, sans-serif' }, arr);
    at.textContent = 'cada degrau acrescenta uma ideia';
    const bars = [];
    for (let i = 0; i < 5; i++) {
      const L = LV[i + 1], x = 2 + i * (bw + gap), h = hs[i];
      const g = SV('g', { class: 'bar', tabindex: 0, role: 'button', 'aria-label': 'Nível ' + (i + 1) + ': ' + L.name }, svg);
      const r = SV('rect', { x, y: base - h, width: bw, height: h, fill: L.hex, stroke: i === 4 ? 'rgba(255,255,255,.35)' : 'none' }, g);
      const t1 = SV('text', { x: x + bw / 2, y: base - 10, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 600, fill: i < 2 ? '#0B2540' : '#fff', 'font-family': 'Fira Sans, sans-serif' }, g); t1.textContent = 'Nível ' + (i + 1);
      const fo = new FO(g); fo.set(x + bw / 2, base - h - 8, `<span style="color:#fff;font-size:21px;font-weight:600;line-height:1.15">${L.name}<br><span style="font-weight:400;font-size:17px;color:#D7E8EB">${md(L.sub)}</span></span>`, 'cb', 300, 90);
      const q = SV('text', { x: x + bw / 2, y: base + 30, 'text-anchor': 'middle', 'font-size': 16, fill: 'rgba(255,255,255,.75)', 'font-family': 'Fira Sans, sans-serif' }, g); q.textContent = 'Questões ' + L.q;
      const goLv = () => { const d = SCENES.find(s => s.group === 'n' + (i + 1)); if (d) go(d.idx, 0); else toast('O Nível ' + (i + 1) + ' entra numa próxima parte.'); };
      g.addEventListener('click', goLv); g.addEventListener('keydown', e => { if (e.key === 'Enter') goLv(); });
      bars.push({ r, h, x, lab: [t1, fo.f, q] });
    }
    const wrap = E('div', { class: 'cv' },
      E('div', { class: 'cv-k', text: 'APOSTILA DE PROCESSOS ESTOCÁSTICOS · ENGENHARIA ELÉTRICA — UFMA' }),
      E('h1', { class: 'cv-t', text: 'Capítulo 8' }),
      E('div', { class: 'cv-s', text: 'Densidade Espectral de Potência' }),
      E('div', { class: 'cv-s2', text: 'Wiener–Khinchin e Questões Resolvidas' }),
      svg,
      E('div', { class: 'cv-a', text: 'Prof. Me. Kennedy Nunes · CCBL — Curso de Engenharia Elétrica · Universidade Federal do Maranhão' }));
    root.append(wrap);
    let tw = [];
    const play = () => {
      tw.forEach(t => t.cancel()); tw = [];
      arr.style.opacity = 0;
      bars.forEach((b, i) => {
        setA(b.r, { y: base, height: 0 }); b.lab.forEach(l => l.style.opacity = 0);
        tw.push(tween(650, t => { setA(b.r, { y: base - b.h * t, height: b.h * t }); }, { delay: 250 + i * 420, ease: easeOut }));
        tw.push(tween(400, t => b.lab.forEach(l => l.style.opacity = t), { delay: 650 + i * 420 }));
      });
      tw.push(tween(600, t => arr.style.opacity = t, { delay: 250 + 5 * 420 }));
    };
    const still = () => { tw.forEach(t => t.cancel()); arr.style.opacity = 1; bars.forEach(b => { setA(b.r, { y: base - b.h, height: b.h }); b.lab.forEach(l => l.style.opacity = 1); }); };
    return { goto(k, anim) { if (k < 0) return; anim ? play() : still(); }, replay: play };
  }
});

/* ---------- S2 · Três frases de datasheet ---------- */
addScene({
  id: 's2', group: 't', mnum: 'S2', short: 'S2', menu: 'Motivação: três frases de datasheet', steps: ['amp', 'laser', 'lora', 'tools'],
  notes: {
    fala: 'As três frases falam da mesma coisa: da densidade espectral de potência de um processo aleatório. Nenhuma descreve uma forma de onda (todas são imprevisíveis); todas descrevem como a potência se distribui nas frequências — o que é estável e mensurável.',
    pergunta: 'Para cada frase: onde está a DEP aqui? O que é área e o que é densidade?',
    tempo: '4 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.1.1 · Motivação', title: 'Onde está a DEP aqui?' });
    const ds = E('div', { class: 'ds' }); f.body.append(ds);
    const rows = [], charts = [];
    const mk = (who, say, hint) => {
      const card = E('div', { class: 'card' });
      const r = E('div', { class: 'ds-row off' }, E('div', { class: 'ds-q' }, E('div', { class: 'who', text: who }), E('div', { class: 'say', html: md(say) }), E('div', { class: 'hint', html: md(hint) })), card);
      ds.append(r); rows.push(r); return card;
    };
    /* 1 · amp-op: piso plano */
    let c = new Chart(mk('Amplificador operacional de instrumentação', '“input voltage noise density: $10\\,\\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$”', 'Raiz de uma DEP unilateral plana — o piso.'), {
      w: 940, h: 174, m: { l: 70, r: 24, t: 34, b: 44 }, x: { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100], label: '$f$ (kHz)', lpos: 'end' },
      y: { min: 0, max: 15, ticks: [0, 10], label: '$e_n(f)$ (nV/√Hz)' }
    });
    c.add(new Area({ f: () => 10, a: 0, b: 100, fill: C.petroF, vis: k => k >= 0 }));
    c.add(new Curve({ f: () => 10, w: 4, vis: k => k >= 0 }));
    c.add(new Label({ x: 52, y: 12.6, html: 'piso plano: $e_n^2=(10^{-8})^2=10^{-16}\\ \\mathrm{V^2/Hz}$', bg: true, size: 19, vis: k => k >= 0, delay: 500 }));
    charts.push(c);
    /* 2 · laser: lorentziana estreita */
    const f0 = 299792458 / 1550e-9;
    c = new Chart(mk('Laser DFB de 1550 nm (óptica coerente)', '“linewidth: $<1\\,\\mathrm{MHz}$”', 'Largura de uma lorentziana estreita em torno de $f_0$.'), {
      w: 940, h: 174, m: { l: 70, r: 24, t: 34, b: 44 }, x: { min: -4, max: 4, ticks: [-4, -3, -2, -1, 0, 1, 2, 3, 4], label: '$f-f_0$ (MHz)', lpos: 'end' },
      y: { min: 0, max: 1.18, ticks: [0, 0.5, 1], label: '$S_E(f)$ (normalizada)' }
    });
    c.add(new Area({ f: x => 1 / (1 + 4 * x * x), fill: C.petroF, vis: k => k >= 1 }));
    c.add(new Curve({ f: x => 1 / (1 + 4 * x * x), w: 3.6, vis: k => k >= 1 }));
    c.add(new Bracket({ x0: -0.5, x1: 0.5, y: 0.5, tex: '\\Delta\\nu=1\\,\\mathrm{MHz}', below: true, vis: k => k >= 1, delay: 600 }));
    c.add(new Label({ x: 2.4, y: 0.72, html: `centro em $f_0=c/\\lambda\\approx${tnum(f0 / 1e12, 0)}$ THz`, bg: true, size: 19, vis: k => k >= 1, delay: 600 }));
    charts.push(c);
    /* 3 · LoRa: piso com a banda sombreada */
    c = new Chart(mk('Receptor LoRa de um nó IoT', '“noise floor: $-174\\,\\mathrm{dBm/Hz}+\\mathrm{NF}$”', 'Piso de ruído térmico; a banda do canal recorta a área.'), {
      w: 940, h: 174, m: { l: 70, r: 24, t: 34, b: 44 }, x: { min: -150, max: 150, ticks: [-150, -100, -62.5, 0, 62.5, 100, 150].map(v => [v, nf(v, Math.abs(v) === 62.5 ? 1 : 0)]), label: '$f-f_c$ (kHz)', lpos: 'end' },
      y: { min: -180, max: -164, ticks: [-180, -174], label: 'DEP (dBm/Hz)' }
    });
    c.add(new Area({ f: () => -174, a: -62.5, b: 62.5, base: -180, fill: C.goldF, vis: k => k >= 2, delay: 400 }));
    c.add(new Curve({ f: () => -174, w: 3.6, vis: k => k >= 2 }));
    c.add(new HLine({ y: -169, dash: '6 6', color: C.navy, html: '$-174\\,\\mathrm{dBm/Hz}+\\mathrm{NF}$', lx: 145, vis: k => k >= 2, delay: 300 }));
    c.add(new Label({ x: -146, y: -166.2, an: 'lm', html: `canal de 125 kHz: área = potência $\\approx${tnum(-174 + 10 * Math.log10(125e3), 0)}$ dBm + NF`, size: 16, bg: true, vis: k => k >= 2, delay: 800 }));
    charts.push(c);
    const tools = E('div', { class: 'tools off' },
      E('div', { class: 'tool', html: '<b>1 · ÁREA = POTÊNCIA</b>Área sob a DEP = potência (Eq. 7.10): transforma densidade em watts, volts² ou dBm.' }),
      E('div', { class: 'tool', html: '<b>2 · WIENER–KHINCHIN</b>Transforma <i>memória no tempo</i> (autocorrelação) em <i>distribuição em frequência</i> (DEP), e vice-versa.' }),
      E('div', { class: 'tool', html: '<b>3 · DEP NA SAÍDA DE UM FILTRO</b>Diz o que sobra do ruído depois que ele atravessa um circuito (Seção 8.3.8).' }));
    ds.append(tools);
    return {
      goto(k, anim) {
        rows.forEach((r, i) => r.classList.toggle('off', !(k >= i)));
        tools.classList.toggle('off', !(k >= 3));
        charts.forEach(ch => ch.goto(k, anim));
      }
    };
  }
});

/* ---------- S3 · O dicionário bilíngue (Fig. 8.2) ---------- */
addScene({
  id: 's3', group: 't', mnum: 'S3', short: 'S3', menu: 'O dicionário bilíngue (Fig. 8.2)', steps: ['analogia', 'quiz', 'cores', 'slider'],
  notes: {
    fala: 'Quem muda depressa “vive” nas frequências altas; quem muda devagar “vive” nas baixas. A autocorrelação descreve a conversa em tempês; a DEP, em frequencês. O dicionário é a Transformada de Fourier.',
    pergunta: 'Antes de revelar as cores: qual curva da esquerda corresponde a qual da direita?',
    passo: ['Leia a analogia da conversa.', 'Deixe a turma casar A, B, C com 1, 2, 3 (resposta: A↔2, B↔3, C↔1).', 'Memória longa ⇔ espectro estreito; as três áreas são iguais.', 'Arraste $a$: a memória encolhe e a DEP alarga; a área fica em 1.'],
    tempo: '5 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.1 · Intuição', title: 'Dois idiomas para a mesma informação' });
    const top = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 74px 1fr', gap: '6px', alignItems: 'stretch' } });
    const cR = chartCard(top, 'Tempês — memória <small>$R_X(\\tau)=e^{-a|\\tau|}$</small>');
    top.append(FArrow('$\\mathcal F\\{\\cdot\\}$', '$\\mathcal F^{-1}\\{\\cdot\\}$'));
    const cS = chartCard(top, 'Frequencês — espectro <small>$S_X(f)=\\dfrac{2a}{a^2+4\\pi^2f^2}$</small>');
    const bot = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 560px', gap: '18px', marginTop: '14px', alignItems: 'start' } });
    f.body.append(top, bot);
    const S = { a: 4 };
    const R = new Chart(cR, { w: 720, h: 380, x: { min: -2, max: 2, ticks: [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2], label: '$\\tau$ (s)', lpos: 'end' }, y: { min: 0, max: 1.08, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] } });
    const Sp = new Chart(cS, { w: 720, h: 380, x: { min: -6, max: 6, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 2.15, ticks: [0, 0.5, 1, 1.5, 2] } });
    const fam = [[1, C.navy], [4, C.petro], [15, C.gold]];
    const vfam = k => k >= 1, col = (cc) => p => mixHex('#A3B1BA', cc, p);
    for (const [a, cc] of fam) {
      R.add(new Curve({ f: t => Math.exp(-a * Math.abs(t)), color: col(cc), w: p => 3 - p * 0, op: () => S.live ? .35 : 1, p: k => k >= 2 ? 1 : 0, vis: vfam }));
      Sp.add(new Curve({ f: x => lor(x, a), color: col(cc), op: () => S.live ? .35 : 1, p: k => k >= 2 ? 1 : 0, vis: vfam, n: 800 }));
    }
    const tag = (ch, x, y, t, k1) => ch.add(new Label({ x, y, text: t, size: 22, weight: 700, color: C.ink, bg: true, vis: k1 }));
    const q = k => k === 1;
    tag(R, 1.45, 0.33, 'A', q); tag(R, -0.5, 0.25, 'B', q); tag(R, 0.17, 0.08, 'C', q);
    tag(Sp, 0.45, 1.92, '2', q); tag(Sp, 0.62, 0.52, '3', q); tag(Sp, 3.4, 0.2, '1', q);
    const lg = k => k === 2;
    R.add(new Label({ x: 1.95, y: 1.0, an: 'rt', html: '<span style="color:#0B2540">━ $a=1\\,\\mathrm{s^{-1}}$</span><br><span style="color:#146B73">━ $a=4\\,\\mathrm{s^{-1}}$</span><br><span style="color:#C7861E">━ $a=15\\,\\mathrm{s^{-1}}$</span>', size: 18, bg: true, vis: lg }));
    Sp.add(new Label({ x: 5.9, y: 2.08, an: 'rt', html: fam.map(([a, cc]) => `<span style="color:${cc === C.gold ? C.goldD : cc}">━ $a=${a}$: $f_{3\\mathrm{dB}}=${tnum(a / (2 * PI), 2)}$ Hz</span>`).join('<br>'), size: 18, bg: true, vis: lg }));
    /* curva ao vivo */
    const live = k => k >= 3;
    Sp.add(new Area({ f: x => lor(x, S.a), fill: C.goldF2, vis: live }));
    R.add(new Curve({ f: t => Math.exp(-S.a * Math.abs(t)), color: C.petro, w: 4.5, vis: live }));
    Sp.add(new Curve({ f: x => lor(x, S.a), color: C.petro, w: 4.5, vis: live, n: 800 }));
    Sp.add(new HLine({ y: () => 1 / S.a, x0: () => -S.a / (2 * PI), x1: () => S.a / (2 * PI), color: C.red, dash: '6 5', vis: live, reveal: 'fade' }));
    Sp.add(new VLine({ x: () => S.a / (2 * PI), y0: 0, y1: () => 1 / S.a, color: C.red, vis: live, html: () => `$f_{3\\mathrm{dB}}=\\frac{a}{2\\pi}=${tnum(S.a / (2 * PI), 2)}$ Hz`, an: 'lb', dx: 8, dy: -6, lcolor: C.red }));
    Sp.add(new VLine({ x: () => -S.a / (2 * PI), y0: 0, y1: () => 1 / S.a, color: C.red, vis: live }));
    Sp.add(new Label({ x: -5.8, y: 1.5, an: 'lm', html: '<b>área = $R_X(0)=1$</b> (fixa)', bg: true, size: 20, color: C.goldD, vis: live }));
    R.add(new Label({ x: -1.95, y: 0.85, an: 'lm', html: () => `memória $\\sim 1/a = ${tnum(1 / S.a, 2)}$ s`, bg: true, size: 19, vis: live }));
    const bx = [
      Box('analogia', 'Duas pessoas conversando: uma muda de assunto a cada segundo (<i>memória curta</i>); a outra passa meia hora no mesmo assunto (<i>memória longa</i>). A autocorrelação descreve a conversa em <b>tempês</b>; a DEP, em <b>frequencês</b>. O Teorema de Wiener–Khinchin é o <b>dicionário bilíngue</b> — e o dicionário é a Transformada de Fourier.', { sub: 'a conversa e o dicionário bilíngue', size: 'sm' }),
      Box('dica', 'Pergunta à turma: <b>qual curva da esquerda (A, B, C) corresponde a qual da direita (1, 2, 3)?</b> Pista: quanto maior $a$, mais depressa a memória se apaga.', { size: 'sm' }),
      Box('interp', 'Memória longa ⇔ espectro estreito. As três autocorrelações têm a mesma potência $R_X(0)=1$; logo, as três DEPs têm a <b>mesma área</b>. O que muda é <i>como</i> essa área se distribui. (A↔2, B↔3, C↔1.)', { size: 'sm' }),
      Box('interp', 'Arraste $a$: a memória encolhe e a DEP alarga ao vivo. O pico $S_X(0)=2/a$ cai, a largura $f_{3\\mathrm{dB}}=a/2\\pi$ cresce, e a área continua $R_X(0)=1$.', { size: 'sm' })
    ];
    const bw = E('div', { style: { position: 'relative', minHeight: '190px' } }); bx.forEach(b => { b.classList.add('pane'); bw.append(b); });
    const side = E('div', { class: 'vstack' });
    const sc = E('div', { class: 'card cc' }); side.append(sc);
    const ro = Readout(side, [['a', '$a$'], ['f3', '$f_{3\\mathrm{dB}}=a/2\\pi$'], ['s0', '$S_X(0)=2/a$'], ['ar', 'área $=R_X(0)$', 'g']]);
    const upd = () => { ro.set('a', nf(S.a, 1) + ' s⁻¹'); ro.set('f3', nf(S.a / (2 * PI), 2) + ' Hz'); ro.set('s0', nf(2 / S.a, 2) + ' s'); ro.set('ar', '1'); };
    const sl = Slider(sc, { label: '$a$ (s⁻¹)', min: 1, max: 15, step: 0.1, value: 4, fmt: v => nf(v, 1) + ' s⁻¹', oninput: v => { S.a = v; upd(); R.render(); Sp.render(); } });
    upd();
    bot.append(bw, side);
    return {
      goto(k, anim) {
        S.live = k >= 3;
        bx.forEach((b, i) => b.classList.toggle('off', i !== Math.max(0, k)));
        side.style.opacity = k >= 3 ? 1 : .25; sl.inp.disabled = k < 3;
        R.goto(k, anim); Sp.goto(k, anim);
        R.render(); Sp.render();
      }
    };
  }
});

/* ---------- S4 · O teorema e os dois "presentes" ---------- */
addScene({
  id: 's4', group: 't', mnum: 'S4', short: 'S4', menu: 'O Teorema de Wiener–Khinchin (Eqs. 8.1–8.3)', steps: ['teorema', 'tau0', 'f0', 'comoler'],
  notes: {
    fala: 'A trajetória $x(t)$ não tem Transformada de Fourier (energia infinita). A autocorrelação é uma função determinística de $\\tau$ que, em geral, decai: ela tem transformada. O teorema troca um objeto que não se deixa transformar por outro que se deixa.',
    pergunta: 'O que acontece se fizermos $\\tau=0$ na Eq. 8.2? E $f=0$ na Eq. 8.1?',
    tempo: '5 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.2 · Enunciado', title: 'O Teorema de Wiener–Khinchin' });
    const a = 4, Rf = t => Math.exp(-a * Math.abs(t)), Sf = x => lor(x, a);
    const areaR = integ(Rf, -12, 12, 6000), Sx0 = Sf(0), P = Rf(0);
    const th = Box('teorema', 'Seja $X(t)$ WSS com autocorrelação $R_X(\\tau)=E[X(t+\\tau)X^*(t)]$ absolutamente integrável. Então o limite que define a DEP (Eq. 7.9) existe e é igual à Transformada de Fourier da autocorrelação:' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:10px;align-items:center;margin-top:4px">' +
      `<div>${T('S_X(f)=\\int_{-\\infty}^{\\infty}R_X(\\tau)\\,e^{-\\j2\\pi f\\tau}\\,\\dd\\tau\\quad(8.1)', { d: true })}</div>` +
      `<div>${T('R_X(\\tau)=\\int_{-\\infty}^{\\infty}S_X(f)\\,e^{\\j2\\pi f\\tau}\\,\\dd f\\quad(8.2)', { d: true })}</div>` +
      `<div style="font-size:.86em"><b>Tempo discreto</b> ($\\sum|R_X[k]|<\\infty$):${T('S_X(e^{\\j\\omega})=\\sum_k R_X[k]e^{-\\j\\omega k},\\ R_X[k]=\\tfrac{1}{2\\pi}\\int_{-\\pi}^{\\pi}S_Xe^{\\j\\omega k}\\dd\\omega\\ (8.3)', { d: true })}</div></div>`, { sub: 'Wiener–Khinchin', size: 'xs' });
    const row = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 84px 1fr', gap: '6px', marginTop: '12px' } });
    const cR = chartCard(row, 'Autocorrelação <small>exemplo: $R_X(\\tau)=e^{-4|\\tau|}$</small>');
    row.append(FArrow('$\\mathcal F\\{\\cdot\\}$ (8.1)', '$\\mathcal F^{-1}\\{\\cdot\\}$ (8.2)'));
    const cS = chartCard(row, 'DEP <small>$S_X(f)=\\dfrac{8}{16+4\\pi^2f^2}$</small>');
    const cap = E('div', { style: { position: 'relative', height: '96px', marginTop: '12px' } });
    f.body.append(th, row, cap);
    const R = new Chart(cR, { w: 690, h: 290, x: { min: -1.5, max: 1.5, ticks: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], label: '$\\tau$ (s)', lpos: 'end' }, y: { min: 0, max: 1.12, ticks: [0, 0.5, 1] } });
    const Sp = new Chart(cS, { w: 690, h: 290, x: { min: -3, max: 3, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 0.62, ticks: [0, 0.25, 0.5] } });
    R.add(new Area({ f: Rf, fill: C.petroF, vis: k => k === 2, dur: 900 }));
    R.add(new Curve({ f: Rf, w: 3.6, vis: k => k >= 0 }));
    Sp.add(new Area({ f: Sf, fill: C.goldF, vis: k => k === 1, dur: 900 }));
    Sp.add(new Curve({ f: Sf, w: 3.6, vis: k => k >= 0, n: 700 }));
    R.add(new Dot({ x: 0, y: P, color: C.gold, vis: k => k === 1, html: `$R_X(0)=${tnum(P, 0)}=P_X$`, dx: 14, dy: 0, an: 'lm' }));
    Sp.add(new Label({ x: 1.6, y: 0.33, html: `área $=\\int S_X\\,\\dd f=${tnum(P, 0)}$`, bg: true, color: C.goldD, size: 20, vis: k => k === 1, delay: 500 }));
    R.add(new Label({ x: 0.28, y: 0.72, an: 'lm', html: `área $=\\int R_X\\,\\dd\\tau=${tnum(areaR, 1)}$`, bg: true, color: C.petro, size: 19, vis: k => k === 2, delay: 400 }));
    Sp.add(new Custom({
      vis: k => k === 2, reveal: 'grow', dur: 800, delay: 700, draw(c, g, p, mk) {
        const x = c.X(0), y0 = c.Y(0), y1 = c.Y(Sx0 * mk.grow);
        SV('line', { x1: x, x2: x, y1: y0, y2: y1, stroke: C.petro, 'stroke-width': 9, 'stroke-linecap': 'round', opacity: .8 }, g);
        SV('circle', { cx: x, cy: y1, r: 8, fill: C.gold, stroke: '#fff', 'stroke-width': 3 }, g);
        mk.lab('v').set(x + 16, y1, labHTML({ html: `$S_X(0)=${tnum(Sx0, 1)}$`, bg: true, color: C.petro, size: 20 }), 'lm');
      }
    }));
    const caps = [
      Box('comoler', 'O teorema troca um objeto que não se deixa transformar (a trajetória) por outro que se deixa: a autocorrelação, função <b>determinística</b> de $\\tau$.', { size: 'xs' }),
      Box('comoler', '<b>Presente 1 — faça $\\tau=0$ em (8.2):</b> $R_X(0)=\\int S_X\\,\\dd f$. É a Eq. 7.10 do Capítulo 7 (potência = área), agora de graça.', { size: 'xs' }),
      Box('comoler', '<b>Presente 2 — faça $f=0$ em (8.1):</b> $S_X(0)=\\int R_X(\\tau)\\,\\dd\\tau$. A DEP na origem é a <i>área da memória</i>.', { size: 'xs' }),
      Box('comoler', 'Quando $R_X$ tem partes que <b>não decaem</b> (uma constante, um cosseno), a integral só existe no sentido generalizado, com impulsos: são exatamente as <b>raias</b> dos Exemplos 2, 3 e 4 do Capítulo 7.', { size: 'xs' })
    ];
    caps.forEach(b => { b.classList.add('pane'); cap.append(b); });
    return { goto(k, anim) { caps.forEach((b, i) => b.classList.toggle('off', i !== Math.max(0, k))); R.goto(k, anim); Sp.goto(k, anim); } };
  }
});

/* ---------- S5 · Demonstração: o quadrado e a contagem de pares (Fig. 8.3) ---------- */
addScene({
  id: 's5', group: 't', mnum: 'S5', short: 'S5', menu: 'Demonstração 1/3 — o quadrado e o lema da contagem', steps: ['r0', 'r1', 'r2', 'r3'],
  notes: {
    fala: 'A demonstração só usa duas ideias: expandir o módulo ao quadrado e contar quantos pares de instantes têm a mesma defasagem. O integrando é constante ao longo das diagonais $t_1-t_2=\\tau$; basta saber quão comprida é cada diagonal.',
    pergunta: 'Existem mais pares de instantes com defasagem pequena ou com defasagem perto de $2T$? Por quê?',
    tempo: '6 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.3 · Demonstração (1/3)', title: 'Contar pares de instantes com a mesma defasagem', split: true });
    const st = Steps(this.steps);
    const S = { tau: 0.6, trace: new Map() };
    const card = chartCard(f.L, 'Quadrado de integração $[-T,T]^2$ e o peso triangular', { style: { height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' } });
    const row = E('div', { style: { display: 'grid', gridTemplateColumns: '440px 1fr', gap: '10px', alignItems: 'center', flex: '1' } }); card.append(row);
    const Tt = [[-1, '-T'], [0, '0'], [1, 'T']];
    const Q = new Chart(row, { w: 440, h: 506, m: { l: 58, r: 24, t: 40, b: 60 }, x: { min: -1.3, max: 1.3, ticks: Tt, label: '$t_2$', lpos: 'end' }, y: { min: -1.65, max: 1.3, ticks: Tt, label: '$t_1$' }, zero: false });
    const Tr = new Chart(row, { w: 450, h: 380, m: { l: 58, r: 20, t: 40, b: 60 }, x: { min: -2.35, max: 2.35, ticks: [[-2, '-2T'], [-1, '-T'], [0, '0'], [1, 'T'], [2, '2T']], label: '$\\tau$', lpos: 'end' }, y: { min: 0, max: 2.35, ticks: [[0, '0'], [1, 'T'], [2, '2T']], label: 'comprimento $2T-|\\tau|$' } });
    Q.add(new Rect({ x0: -1, x1: 1, y0: -1, y1: 1, fill: 'rgba(20,107,115,.10)', stroke: C.petro, sw: 2.5, reveal: 'fade', vis: k => k >= 0 }));
    Q.add(new Custom({
      vis: st.from('r1'), reveal: 'draw', draw(c, g) {
        for (const t of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) {
          const a = Math.max(-1, -1 - t), b = Math.min(1, 1 - t);
          SV('line', { x1: c.X(a), y1: c.Y(a + t), x2: c.X(b), y2: c.Y(b + t), stroke: C.aquaD, 'stroke-width': 1.8, 'stroke-dasharray': '7 6' }, g);
        }
      }
    }));
    Q.add(new Custom({
      vis: st.from('r2'), layer: 'top', draw(c, g, p, mk) {
        const t = S.tau, a = Math.max(-1, -1 - t), b = Math.min(1, 1 - t), yb = -1.16;
        SV('line', { x1: c.X(a), y1: c.Y(a + t), x2: c.X(b), y2: c.Y(b + t), stroke: C.gold, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
        for (const x of [a, b]) SV('line', { x1: c.X(x), x2: c.X(x), y1: c.Y(x + t), y2: c.Y(yb), stroke: C.goldD, 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }, g);
        const y = c.Y(yb);
        SV('path', { d: `M${c.X(a)} ${y - 7}V${y + 7}M${c.X(b)} ${y - 7}V${y + 7}M${c.X(a)} ${y}H${c.X(b)}`, stroke: C.goldD, 'stroke-width': 2.4, fill: 'none' }, g);
        mk.lab('len').set((c.X(a) + c.X(b)) / 2, y + 12, labHTML({ html: `$2T-|\\tau|=${tnum(2 - Math.abs(t), 2)}\\,T$`, color: C.goldD, size: 19, bg: true }), 'ct');
        const mx = (a + b) / 2;
        mk.lab('eq').set(c.X(mx) + 10, c.Y(mx + t) - 10, labHTML({ html: `$t_1-t_2=\\tau=${tnum(t, 2)}T$`, color: C.goldD, size: 18, bg: true }), 'lb');
      }
    }));
    Tr.add(new Area({ pts: [[-2, 0], [0, 2], [2, 0]], fill: 'rgba(227,162,59,.25)', vis: st.from('r3'), dur: 1200 }));
    Tr.add(new Curve({ pts: [[-2.35, 0], [-2, 0], [0, 2], [2, 0], [2.35, 0]], color: C.goldD, w: 3, vis: st.from('r3'), dur: 1200 }));
    Tr.add(new Custom({
      vis: st.from('r2'), draw(c, g) {
        for (const [t, v] of S.trace) SV('circle', { cx: c.X(t), cy: c.Y(v), r: 4, fill: C.petro }, g);
        const t = S.tau, v = 2 - Math.abs(t);
        SV('line', { x1: c.X(t), x2: c.X(t), y1: c.Y(0), y2: c.Y(v), stroke: C.gold, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
        SV('circle', { cx: c.X(t), cy: c.Y(v), r: 8, fill: C.gold, stroke: '#fff', 'stroke-width': 3 }, g);
      }
    }));
    Tr.add(new Label({ x: 1.05, y: 1.85, an: 'lm', html: 'muitos pares com<br>defasagem pequena;<br>poucos perto de $2T$', size: 17, bg: true, vis: st.from('r3'), delay: 900 }));
    const ctl = E('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }); card.append(ctl);
    const draw = () => { S.trace.set(+S.tau.toFixed(2), 2 - Math.abs(S.tau)); Q.render(); Tr.render(); };
    const sl = Slider(ctl, { label: '$\\tau$', min: -2, max: 2, step: 0.01, value: S.tau, fmt: v => tnum(v, 2).replace('{,}', ',') + ' T', oninput: v => { S.tau = v; draw(); } });
    sl.row.style.flex = '1';
    let sw = null;
    const sweep = () => { if (sw) sw.cancel(); S.trace.clear(); sw = tween(4200, t => { S.tau = -2 + 4 * t; sl.set(S.tau); draw(); }, { ease: linear }); };
    const pb = E('button', { class: 'btn', text: '▶ varrer τ', onclick: sweep }); ctl.append(pb);
    const rows = [
      { tex: '|X_T(f)|^2=\\int_{-T}^{T}\\!\\!\\int_{-T}^{T}X(t_1)X^*(t_2)\\,\\hl{e^{-\\j2\\pi f(t_1-t_2)}}\\,\\dd t_1\\dd t_2', note: 'Módulo ao quadrado: o produto de duas integrais vira integral dupla.' },
      { tex: 'E|X_T(f)|^2=\\iint \\hl{R_X(t_1-t_2)}\\,e^{-\\j2\\pi f(t_1-t_2)}\\,\\dd t_1\\dd t_2', note: 'Único uso da hipótese WSS: só importa $\\tau=t_1-t_2$.' },
      { tex: 't_2\\in[\\max(-T,-T-\\tau),\\,\\min(T,T-\\tau)]:\\ \\hl{2T-|\\tau|}', note: 'É o comprimento da diagonal; para $|\\tau|>2T$ não há pares.' },
      { tex: '\\iint g(t_1-t_2)\\,\\dd t_1\\dd t_2=\\int_{-2T}^{2T}g(\\tau)\\,\\hl{(2T-|\\tau|)}\\,\\dd\\tau', note: '<b>Lema da contagem</b>: vale para qualquer função integrável $g$.' }
    ];
    const rp = new ResPanel(f.R, 'do periodograma ao lema da contagem');
    return {
      goto(k, anim) {
        rp.set(rows, k, anim); Q.goto(k, anim); Tr.goto(k, anim);
        ctl.style.opacity = k >= 2 ? 1 : .3; sl.inp.disabled = pb.disabled = k < 2;
        if (k === 3 && anim) setTimeout(sweep, 300);
        if (k < 2) S.trace.clear();
        if (k >= 2 && !S.trace.size) S.trace.set(+S.tau.toFixed(2), 2 - Math.abs(S.tau));
        Q.render(); Tr.render();
      },
      leave() { if (sw) sw.cancel(); }
    };
  }
});

/* ---------- S6 · A janela triangular pesa a autocorrelação (Fig. 8.4, esq.) ---------- */
const R84 = t => Math.exp(-0.6 * Math.abs(t)) * Math.cos(2 * PI * 2 * t);
addScene({
  id: 's6', group: 't', mnum: 'S6', short: 'S6', menu: 'Demonstração 2/3 — a janela triangular', steps: ['r0', 'r1', 'r2', 'r3'],
  notes: {
    fala: 'Dividindo o lema por $2T$ aparece o periodograma esperado: a autocorrelação multiplicada pela janela triangular $(1-|\\tau|/2T)$. Quando $T$ cresce, a janela se abre e vira a constante 1; a convergência dominada deixa o limite entrar na integral.',
    pergunta: 'Para $T=0{,}5$, que parte de $R_X$ a janela “apaga”? E para $T=3$?',
    tempo: '4 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.3 · Demonstração (2/3)', title: 'A janela triangular “pesa” a autocorrelação', split: true });
    const S = { T: 1 };
    const card = chartCard(f.L, '$R_X(\\tau)=e^{-0{,}6|\\tau|}\\cos(2\\pi\\cdot2\\tau)$ e a janela $1-|\\tau|/2T$');
    const ch = new Chart(card, { w: 904, h: 540, x: { min: -7, max: 7, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$\\tau$ (s)', lpos: 'end' }, y: { min: -0.85, max: 1.18, ticks: [-0.5, 0, 0.5, 1] } });
    const win = t => Math.max(0, 1 - Math.abs(t) / (2 * S.T));
    ch.add(new Curve({ f: R84, color: C.aqua, w: 1.8, n: 1800, vis: k => k >= 0 }));
    ch.add(new Curve({ f: t => win(t), color: C.goldD, w: 2.6, dash: '9 7', n: 400, vis: k => k >= 0, delay: 300 }));
    ch.add(new Curve({ f: t => R84(t) * win(t), color: C.petro, w: 3.2, n: 1800, vis: k => k >= 0, delay: 600 }));
    ch.add(new Curve({ f: t => Math.exp(-0.6 * Math.abs(t)), color: C.navy, w: 2, dash: '3 5', n: 300, vis: k => k >= 2 }));
    ch.add(new Curve({ f: t => -Math.exp(-0.6 * Math.abs(t)), color: C.navy, w: 2, dash: '3 5', n: 300, vis: k => k >= 2 }));
    ch.add(new Label({ x: 6.9, y: 1.12, an: 'rt', html: '<span style="color:#2E9C94">━ $R_X(\\tau)$</span><br><span style="color:#C7861E">┅ janela $1-|\\tau|/2T$</span><br><span style="color:#146B73">━ $R_X(\\tau)(1-|\\tau|/2T)$</span>', size: 18, bg: true, vis: k => k >= 0 }));
    ch.add(new Label({ x: 4.6, y: -0.62, html: '$|R_X(\\tau)(1-\\tfrac{|\\tau|}{2T})|\\le|R_X(\\tau)|$', size: 19, bg: true, color: C.navy, vis: k => k >= 2 }));
    ch.add(new Label({ x: () => Math.min(2 * S.T, 6.4), y: 0.12, html: () => `$2T=${tnum(2 * S.T, 1)}$`, size: 18, color: C.goldD, bg: true, vis: k => k >= 0 }));
    const ctl = E('div'); card.append(ctl);
    let tw = null;
    const sl = Slider(ctl, { label: '$T$ (s)', min: 0.5, max: 3, step: 0.01, value: 1, fmt: v => nf(v, 2) + ' s', oninput: v => { if (tw) tw.cancel(); S.T = v; ch.render(); } });
    const toT = (T1, anim) => { if (tw) tw.cancel(); const T0 = S.T; if (!anim) { S.T = T1; sl.set(T1); ch.render(); return; } tw = tween(1800, t => { S.T = lerp(T0, T1, t); sl.set(S.T); ch.render(); }); };
    const rows = [
      { tex: '\\frac{1}{2T}E|X_T(f)|^2=\\int_{-2T}^{2T}R_X(\\tau)\\,\\hl{\\Big(1-\\frac{|\\tau|}{2T}\\Big)}e^{-\\j2\\pi f\\tau}\\dd\\tau', note: 'Lema com $g=R_Xe^{-\\j2\\pi f\\tau}$, dividido por $2T$: periodograma esperado.' },
      { tex: '\\text{para cada }\\tau:\\ \\Big(1-\\frac{|\\tau|}{2T}\\Big)\\hl{\\to1}\\ \\text{quando }T\\to\\infty', note: 'A janela triangular se “abre” e vira a constante 1.' },
      { tex: '\\Big|R_X(\\tau)\\Big(1-\\frac{|\\tau|}{2T}\\Big)e^{-\\j2\\pi f\\tau}\\Big|\\le\\hl{|R_X(\\tau)|}', note: 'Dominado por função integrável (hipótese do teorema).' },
      { tex: 'S_X(f)=\\lim_{T\\to\\infty}\\frac{1}{2T}E|X_T(f)|^2=\\hl{\\int_{-\\infty}^{\\infty}R_X(\\tau)e^{-\\j2\\pi f\\tau}\\dd\\tau}\\ \\blacksquare', note: 'Convergência dominada: o limite pode entrar na integral.' }
    ];
    const rp = new ResPanel(f.R, 'dividir por $2T$ e passar ao limite'.replace(/\$/g, ''));
    return {
      goto(k, anim) {
        rp.set(rows, k, anim); ch.goto(k, anim);
        if (k === 0) toT(1, false);
        if (k === 1) toT(3, anim);
        if (k === 3) toT(3, anim);
      },
      leave() { if (tw) tw.cancel(); }
    };
  }
});

/* ---------- S7 · Periodograma esperado converge para S_X (Fig. 8.4, dir.) ---------- */
function Jre(a, w, L) { /* Re ∫_0^L e^{-(a-jw)τ}(1-τ/L)dτ */
  const s = cx(a, -w), one = cx(1, 0), e = cexp(cx(-s.re * L, -s.im * L));
  const t1 = cdiv(csub(one, e), s);
  const t2 = cdiv(csub(one, cmul(e, cx(1 + s.re * L, s.im * L))), cx(L * (s.re * s.re - s.im * s.im), L * 2 * s.re * s.im));
  return t1.re - t2.re;
}
const perT = (f, T) => Jre(0.6, 2 * PI * (f - 2), 2 * T) + Jre(0.6, 2 * PI * (f + 2), 2 * T);
const S84 = f => 0.6 / (0.36 + Math.pow(2 * PI * (f - 2), 2)) + 0.6 / (0.36 + Math.pow(2 * PI * (f + 2), 2));
addScene({
  id: 's7', group: 't', mnum: 'S7', short: 'S7', menu: 'Demonstração 3/3 — periodograma esperado → $S_X$', steps: ['sx', 't05', 't1', 't3', 'live'],
  notes: {
    fala: 'Com janela finita, o que se mede é a DEP verdadeira borrada por um núcleo de largura ≈ $1/T$. Quando $T\\to\\infty$ o núcleo vira um impulso e o borrão desaparece. Regra prática do laboratório: a resolução em frequência é o inverso do tempo de observação.',
    pergunta: 'Num analisador de espectro, se eu observo o sinal por 10 ms, consigo separar duas raias a 50 Hz uma da outra?',
    tempo: '5 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.3 · Demonstração (3/3)', title: 'Periodograma esperado: $S_X*\\kappa_T\\to S_X$', split: true });
    const S = { T: 1.5 };
    const card = chartCard(f.L, 'Periodograma esperado $\\frac{1}{2T}E|X_T(f)|^2$ para $R_X(\\tau)=e^{-0{,}6|\\tau|}\\cos(2\\pi\\cdot2\\tau)$');
    const ch = new Chart(card, { w: 904, h: 450, x: { min: -4.5, max: 4.5, ticks: [-4, -3, -2, -1, 0, 1, 2, 3, 4], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 1.9, ticks: [0, 0.5, 1, 1.5] } });
    ch.add(new Curve({ f: S84, color: C.red, w: 2.6, dash: '8 6', n: 900, vis: k => k >= 0 }));
    const fam = [[0.5, C.gold, 't05'], [1, C.aquaD, 't1'], [3, C.navy, 't3']];
    fam.forEach(([T, col], i) => ch.add(new Curve({ f: x => perT(x, T), color: col, w: 2.8, n: 700, op: () => S.live ? .28 : 1, vis: k => k >= i + 1 })));
    ch.add(new Curve({ f: x => perT(x, S.T), color: C.petro, w: 4, n: 700, vis: k => k >= 4 }));
    ch.add(new Label({ x: 4.4, y: 1.85, an: 'rt', html: '<span style="color:#C0392B">┅ $S_X(f)$ verdadeira</span><br><span style="color:#C7861E">━ $T=0{,}5$</span><br><span style="color:#2E9C94">━ $T=1$</span><br><span style="color:#0B2540">━ $T=3$</span>', size: 18, bg: true, vis: k => k >= 0 }));
    const low = E('div', { style: { display: 'grid', gridTemplateColumns: '520px 1fr', gap: '10px', alignItems: 'center' } }); card.append(low);
    const K = new Chart(low, { w: 520, h: 170, m: { l: 64, r: 14, t: 34, b: 44 }, x: { min: -2, max: 2, ticks: [-2, -1, 0, 1, 2], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 1.15, ticks: [0, 0.5, 1], label: 'núcleo normalizado $\\kappa_T(f)/2T=\\mathrm{sinc}^2(2Tf)$' } });
    K.add(new Curve({ f: x => sinc(2 * S.T * x) ** 2, color: C.navy, w: 2.6, n: 600, vis: k => k >= 4 }));
    K.add(new Bracket({ x0: () => -1 / (2 * S.T), x1: () => 1 / (2 * S.T), y: 0.5, html: () => `$\\approx 1/T=${tnum(1 / S.T, 2)}$ Hz`, color: C.petro, size: 17, vis: k => k >= 4 }));
    const sw = E('div'); low.append(sw);
    const sl = Slider(sw, { label: '$T$ (s)', min: 0.25, max: 6, step: 0.01, value: S.T, fmt: v => nf(v, 2) + ' s', oninput: v => { S.T = v; ch.render(); K.render(); ro.set('r', nf(1 / v, 2) + ' Hz'); } });
    const ro = Readout(null, [['r', 'resolução $\\approx 1/T$', 'g']]); ro.set('r', nf(1 / S.T, 2) + ' Hz');
    f.R.append(
      Box('resultado', 'O que um analisador de espectro mede com janela finita (Eq. 8.4):$$\\begin{aligned}\\tfrac{1}{2T}E|X_T(f)|^2&=\\int_{-2T}^{2T}R_X(\\tau)\\Big(1-\\tfrac{|\\tau|}{2T}\\Big)e^{-\\j2\\pi f\\tau}\\dd\\tau\\\\&=(S_X*\\kappa_T)(f),\\quad \\kappa_T(f)=2T\\,\\mathrm{sinc}^2(2Tf)\\end{aligned}$$', { size: 'sm' }),
      Box('interp', 'A transformada de um <i>produto</i> ($R_X$ vezes o triângulo) é a <i>convolução</i> das transformadas. Com janela finita mede-se a DEP verdadeira <b>borrada</b> por um núcleo de largura $\\approx1/T$. Quando $T\\to\\infty$, o núcleo vira um impulso. <b>A resolução em frequência é o inverso do tempo de observação.</b>', { size: 'sm' }),
      ro.root);
    const bxs = [...f.R.children];
    return {
      goto(k, anim) {
        S.live = k >= 4; ch.goto(k, anim); K.goto(k, anim); ch.render();
        bxs[1].style.opacity = k >= 3 ? 1 : .25; ro.root.style.opacity = k >= 4 ? 1 : .25;
        sw.style.opacity = k >= 4 ? 1 : .3; sl.inp.disabled = k < 4;
      }
    };
  }
});

/* ---------- S8 · Propriedades D1–D6 ---------- */
addScene({
  id: 's8', group: 't', mnum: 'S8', short: 'S8', menu: 'O que o teorema dá de graça: D1–D6', steps: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
  notes: {
    fala: '(D3) e o teorema juntos dão um teste de validade: se a transformada de $R(\\tau)$ fica negativa em algum lugar, $R(\\tau)$ não pode ser autocorrelação. (D6) é a versão quantitativa da analogia da conversa: tocar uma gravação duas vezes mais rápido encurta a memória pela metade e espalha a mesma potência numa faixa duas vezes mais larga.',
    pergunta: 'Se eu acelerar uma gravação de ruído, a potência total muda? E o valor de $S(0)$?',
    tempo: '5 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.4 · Propriedades da DEP de um processo WSS', title: 'O que o teorema dá de graça' });
    const g = E('div', { class: 'g3' }); f.body.append(g);
    const Sb = x => lor(x, 1), Rb = t => Math.exp(-Math.abs(t));
    const cards = [];
    const mk = (tag, name, fx) => { const c = E('div', { class: 'card pcard dim' }, E('h5', null, E('span', { text: tag + ' · ' + name })), E('div', { class: 'fx', html: md(fx) })); g.append(c); cards.push(c); return c; };
    const sOpt = (extra = {}) => Object.assign({ w: 478, h: 236, m: { l: 50, r: 16, t: 30, b: 40 }, x: { min: -1.2, max: 1.2, ticks: [-1, 0, 1], label: '$f$', lpos: 'end' }, y: { min: 0, max: 2.25, ticks: [0, 1, 2] } }, extra);
    const charts = [];
    /* D1 */
    let c = new Chart(mk('D1', 'Real', '$S_X(f)\\in\\mathbb R$, porque $R_X(-\\tau)=R_X^*(\\tau)$'), sOpt({ y: { min: -0.5, max: 2.25, ticks: [0, 1, 2] } }));
    c.add(new Curve({ f: Sb, w: 3.4, vis: k => k >= 0 })); c.add(new HLine({ y: 0, color: C.goldD, w: 3.5, dash: '10 6', html: '$\\mathrm{Im}\\,S_X\\equiv0$', lx: 1.15, dy: 28, an: 'rt', vis: k => k >= 0, delay: 500 }));
    c.add(new Label({ x: 0.55, y: 1.6, html: '$\\mathrm{Re}\\,S_X$', color: C.petro, size: 19, vis: k => k >= 0 })); charts.push([c, 0]);
    /* D2 */
    c = new Chart(mk('D2', 'Par', '$S_X(-f)=S_X(f)$ para processos reais'), sOpt({ xzero: true }));
    c.add(new Curve({ f: Sb, x0: 0, x1: 1.2, w: 3.4, vis: k => k >= 1 }));
    c.add(new Curve({ f: (x, p) => Sb(x), pts: p => sample(Sb, 0, 1.2, 200).map(([x, y]) => [-x * p, y]), p: k => k >= 1 ? 1 : 0, pdur: 1200, pdelay: 400, color: C.goldD, dash: '8 6', w: 3, vis: k => k >= 1, reveal: 'fade' }));
    c.add(new Label({ x: -0.7, y: 1.5, html: 'espelho em $f=0$', size: 18, color: C.goldD, vis: k => k >= 1, delay: 1200 })); charts.push([c, 1]);
    /* D3 */
    c = new Chart(mk('D3', 'Não negativa', '$S_X(f)\\ge0$ — limite de $\\frac{1}{2T}E|X_T|^2\\ge0$'), sOpt({ y: { min: -0.9, max: 2.25, ticks: [0, 1, 2] } }));
    c.add(new Rect({ x0: -1.2, x1: 1.2, y0: -0.9, y1: 0, fill: C.redF, reveal: 'fade', vis: k => k >= 2 }));
    c.add(new Label({ x: 0, y: -0.45, html: 'proibido: “potência negativa”', color: C.red, size: 18, weight: 600, vis: k => k >= 2 }));
    c.add(new Curve({ f: Sb, w: 3.4, vis: k => k >= 2 })); charts.push([c, 2]);
    /* D4 */
    c = new Chart(mk('D4', 'Potência', '$\\int_{-\\infty}^{\\infty}S_X(f)\\,\\dd f=R_X(0)=E|X(t)|^2$'), sOpt());
    c.add(new Area({ f: Sb, vis: k => k >= 3 })); c.add(new Curve({ f: Sb, w: 3.4, vis: k => k >= 3 }));
    c.add(new Label({ x: 0.66, y: 1.25, html: `área $=R_X(0)=${tnum(Rb(0), 0)}$`, color: C.goldD, size: 19, bg: true, vis: k => k >= 3, delay: 700 })); charts.push([c, 3]);
    /* D5 */
    const c5 = mk('D5', 'Origem', '$S_X(0)=\\int_{-\\infty}^{\\infty}R_X(\\tau)\\,\\dd\\tau$ (área da memória)');
    const r5 = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' } }); c5.append(r5);
    const aR = integ(Rb, -30, 30, 6000);
    c = new Chart(r5, { w: 236, h: 236, m: { l: 40, r: 10, t: 30, b: 40 }, x: { min: -3, max: 3, ticks: [-3, 0, 3], label: '$\\tau$', lpos: 'end' }, y: { min: 0, max: 1.1, ticks: [0, 1] } });
    c.add(new Area({ f: Rb, fill: C.petroF, vis: k => k >= 4 })); c.add(new Curve({ f: Rb, w: 3, vis: k => k >= 4 }));
    c.add(new Label({ x: 0, y: 0.25, html: `área $=${tnum(aR, 0)}$`, size: 17, color: C.petro, bg: true, vis: k => k >= 4, delay: 600 })); charts.push([c, 4]);
    c = new Chart(r5, { w: 236, h: 236, m: { l: 40, r: 10, t: 30, b: 40 }, x: { min: -1.2, max: 1.2, ticks: [-1, 0, 1], label: '$f$', lpos: 'end' }, y: { min: 0, max: 2.25, ticks: [0, 1, 2] } });
    c.add(new Curve({ f: Sb, w: 3, vis: k => k >= 4 }));
    c.add(new Dot({ x: 0, y: Sb(0), color: C.petro, html: `$S_X(0)=${tnum(Sb(0), 0)}$`, an: 'rm', dx: -12, dy: 4, size: 17, vis: k => k >= 4, delay: 900 })); charts.push([c, 4]);
    /* D6 */
    const c6 = mk('D6', 'Escala', '$Y(t)=X(at)\\Rightarrow R_Y(\\tau)=R_X(a\\tau),\\ S_Y(f)=\\frac1a S_X\\big(\\frac fa\\big)$');
    const r6 = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' } }); c6.append(r6);
    const sc = { a: 1 };
    const cR6 = new Chart(r6, { w: 236, h: 206, m: { l: 40, r: 10, t: 26, b: 40 }, x: { min: -3, max: 3, ticks: [-3, 0, 3], label: '$\\tau$', lpos: 'end' }, y: { min: 0, max: 1.1, ticks: [0, 1] } });
    const cS6 = new Chart(r6, { w: 236, h: 206, m: { l: 40, r: 10, t: 26, b: 40 }, x: { min: -1.2, max: 1.2, ticks: [-1, 0, 1], label: '$f$', lpos: 'end' }, y: { min: 0, max: 2.25, ticks: [0, 1, 2] } });
    cR6.add(new Curve({ f: t => Rb(sc.a * t), w: 3, vis: k => k >= 5 }));
    cS6.add(new Area({ f: x => Sb(x / sc.a) / sc.a, vis: k => k >= 5 }));
    cS6.add(new Curve({ f: x => Sb(x / sc.a) / sc.a, w: 3, vis: k => k >= 5 }));
    cS6.add(new Label({ x: 0.62, y: 1.7, html: 'área $=1$', size: 17, color: C.goldD, bg: true, vis: k => k >= 5 }));
    charts.push([cR6, 5], [cS6, 5]);
    const btn = E('button', { class: 'btn', text: '▶ tocar 2× mais rápido', 'aria-pressed': 'false' });
    let tw = null;
    btn.addEventListener('click', () => {
      const to = sc.a === 1 ? 2 : 1, from = sc.a; if (tw) tw.cancel();
      tw = tween(1100, t => { sc.a = lerp(from, to, t); cR6.render(); cS6.render(); });
      btn.textContent = to === 2 ? '◀ voltar à velocidade normal' : '▶ tocar 2× mais rápido'; btn.setAttribute('aria-pressed', to === 2);
    });
    c6.append(E('div', { style: { display: 'flex', justifyContent: 'center', padding: '2px 0 4px' } }, btn));
    return {
      goto(k, anim) {
        cards.forEach((cd, i) => cd.classList.toggle('dim', !(k >= i)));
        charts.forEach(([ch]) => ch.goto(k, anim));
        btn.disabled = k < 5;
      }
    };
  }
});

/* ---------- S9 · Tabela de pares (Tabela 8.3) ---------- */
const PAIRS = [
  { n: 'ruído branco (térmico)', R: '\\tfrac{N_0}{2}\\delta(\\tau)', S: '\\tfrac{N_0}{2}', r: { imp: [[0, 1]] }, s: { f: () => 0.6 } },
  { n: 'componente DC', R: 'c\\ (\\text{constante})', S: 'c\\,\\delta(f)', r: { f: () => 0.6 }, s: { imp: [[0, 1]] } },
  { n: 'portadora, fase aleatória', R: '\\tfrac{A^2}{2}\\cos(2\\pi f_0\\tau)', S: '\\tfrac{A^2}{4}[\\delta(f-f_0)+\\delta(f+f_0)]', r: { f: t => Math.cos(2 * PI * t), y: [-1.1, 1.1] }, s: { imp: [[-1, 0.5], [1, 0.5]] } },
  { n: 'ruído RC, Langevin, telégrafo', R: '\\sigma^2e^{-a|\\tau|},\\ a>0', S: '\\dfrac{2a\\sigma^2}{a^2+4\\pi^2f^2}', r: { f: t => Math.exp(-2 * Math.abs(t)) }, s: { f: x => lor(x, 2) / 1, y: [0, 1.1] } },
  { n: 'onda binária NRZ', R: '\\sigma^2\\big(1-\\tfrac{|\\tau|}{T}\\big),\\ |\\tau|\\le T', S: '\\sigma^2T\\,\\mathrm{sinc}^2(fT)', r: { f: t => Math.max(0, 1 - Math.abs(t)) }, s: { f: x => sinc(x) ** 2 } },
  { n: 'ruído de banda limitada', R: '2BS_0\\,\\mathrm{sinc}(2B\\tau)', S: 'S_0\\ \\text{para }|f|<B', r: { f: t => sinc(2 * t), y: [-0.3, 1.1] }, s: { f: x => Math.abs(x) < 1 ? 0.7 : 0, n: 1200 } },
  { n: 'laser, fase de alta variância', R: '\\sigma^2e^{-\\tau^2/(2\\tau_0^2)}', S: '\\sigma^2\\sqrt{2\\pi}\\,\\tau_0e^{-2\\pi^2\\tau_0^2f^2}', r: { f: t => Math.exp(-t * t * 2) }, s: { f: x => Math.exp(-2 * PI * PI * x * x / 4) } },
  { n: 'modulação (passa-faixa)', R: 'R(\\tau)\\cos(2\\pi f_0\\tau)', S: '\\tfrac12[S(f-f_0)+S(f+f_0)]', r: { f: t => Math.exp(-1.5 * Math.abs(t)) * Math.cos(2 * PI * 1.5 * t), y: [-1.1, 1.1], n: 600 }, s: { f: x => (lor(x - 1.5, 1.5) + lor(x + 1.5, 1.5)) / 2 / lor(0, 1.5) * 1.6 } },
  { n: 'ruído branco discreto', R: '\\sigma^2\\delta[k]', S: '\\sigma^2', d: 1, r: { st: k => k === 0 ? 1 : 0 }, s: { f: () => 0.6 } },
  { n: 'média móvel de 2 termos', R: 'r_0\\ (k=0);\\ r_1\\ (k=\\pm1)', S: 'r_0+2r_1\\cos\\omega', d: 1, r: { st: k => k === 0 ? 1 : Math.abs(k) === 1 ? 0.5 : 0 }, s: { f: w => (1 + Math.cos(w)) / 2 } },
  { n: 'AR(1): sensor com memória', R: '\\sigma^2a^{|k|},\\ |a|<1', S: '\\dfrac{\\sigma^2(1-a^2)}{1-2a\\cos\\omega+a^2}', d: 1, r: { st: k => Math.pow(0.7, Math.abs(k)) }, s: { f: w => (1 - 0.49) / (1 - 1.4 * Math.cos(w) + 0.49) / 5.67 } },
  { n: 'offset (DC) discreto', R: 'c\\ (\\text{constante})', S: '2\\pi c\\,\\delta(\\omega)', d: 1, r: { st: () => 0.6 }, s: { imp: [[0, 1]] } }
];
function pairChart(parent, spec, side, big) {
  const d = PAIRS[spec].d, sp = PAIRS[spec][side];
  const isR = side === 'r';
  const xr = d ? (isR ? [-5.5, 5.5] : [-PI, PI]) : (isR ? [-3, 3] : [-3, 3]);
  const yr = sp.y || [0, 1.15];
  const W = big ? 600 : 168, H = big ? 330 : 112;
  const m = big ? { l: 40, r: 16, t: 20, b: 46 } : { l: 6, r: 6, t: 8, b: 20 };
  const lab = d ? (isR ? '$k$' : '$\\omega$') : (isR ? '$\\tau$' : '$f$');
  const xt = big ? (d && !isR ? [[-PI, '-\\pi'], [0, '0'], [PI, '\\pi']] : [xr[0], 0, xr[1]].map(v => [v, nf(v, 0)])) : [];
  const c = new Chart(parent, { w: W, h: H, m, x: { min: xr[0], max: xr[1], ticks: xt, label: big ? lab : null, lpos: 'end' }, y: { min: yr[0], max: yr[1], ticks: [] }, grid: false });
  if (!big) { const fo = new FO(c.L.top); fo.set(W - 4, H - 1, labHTML({ html: lab, size: 15, color: '#4E6476' }), 'rb'); }
  const w = big ? 3.6 : 2.4;
  if (sp.f) { if (side === 's') c.add(new Area({ f: sp.f, fill: C.goldF2, n: sp.n || 400 })); c.add(new Curve({ f: sp.f, w, n: sp.n || 600, color: isR ? C.navy : C.petro })); }
  if (sp.imp) sp.imp.forEach(([x, h]) => c.add(new Impulse({ x, h: h * (yr[1] - 0.12), color: isR ? C.navy : C.petro, w: big ? 3.4 : 2.4, hs: big ? 14 : 9 })));
  if (sp.st) { const pts = []; for (let k = -5; k <= 5; k++) pts.push([k, sp.st(k)]); c.add(new Stems({ pts, color: C.navy, r: big ? 6.5 : 3.2, w: big ? 3 : 2 })); }
  return c;
}
addScene({
  id: 's9', group: 't', mnum: 'S9', short: 'S9', menu: 'A tabela de pares (Tabela 8.3)', steps: ['cont', 'disc'],
  notes: {
    fala: 'Na prática, quase ninguém calcula a integral (8.1) do zero: reconhece o par numa tabela e usa propriedades. Três propriedades da Transformada de Fourier fazem o resto: linearidade, modulação e escala.',
    pergunta: 'Antes de integrar, pergunte-se: “é um par da tabela disfarçado?” Qual destes pares aparece no ruído de um circuito RC?',
    tempo: '4 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.5 · A ferramenta mais usada do capítulo', title: 'Tabela de pares $R_X\\leftrightarrow S_X$ <small style="font-size:.5em;opacity:.8">(clique num cartão para ampliar)</small>' });
    const g = E('div', { class: 'g4' }); f.body.append(g);
    const cards = PAIRS.map((p, i) => {
      const card = E('div', { class: 'card pcard pair', tabindex: 0, role: 'button', 'aria-label': 'Ampliar par: ' + p.n },
        E('h5', null, E('span', { text: p.n })),
        E('div', { class: 'fx', style: { minHeight: '50px', fontSize: '15px' }, html: T(p.R) + ' <b style="color:#A86B12">⟷</b> ' + T(p.S) }));
      const mini = E('div', { class: 'mini' }); card.append(mini);
      pairChart(mini, i, 'r'); mini.append(E('div', { class: 'arr', text: '⟷' })); pairChart(mini, i, 's');
      const open = () => openPair(root, i);
      card.addEventListener('click', open); card.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
      g.append(card); return card;
    });
    return { goto(k) { cards.forEach((c, i) => c.classList.toggle('dim', i >= 8 && k < 1)); }, leave() { const m = root.querySelector('.modal'); if (m) m.remove(); } };
  }
});
function openPair(root, i) {
  const old = root.querySelector('.modal'); if (old) old.remove();
  const p = PAIRS[i];
  const m = E('div', { class: 'modal', role: 'dialog', 'aria-label': p.n });
  const x = E('button', { class: 'btn ghost-d modal-x', text: 'Fechar ✕', onclick: () => m.remove() });
  const row = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 70px 1fr', alignItems: 'center', gap: '8px' } });
  const a = chartCard(row, (p.d ? 'Autocorrelação $R_X[k]$' : 'Autocorrelação $R_X(\\tau)$'));
  row.append(E('div', { class: 'arr', style: { fontSize: '30px', color: '#A86B12', textAlign: 'center', fontWeight: 700 }, text: '⟷' }));
  const b = chartCard(row, p.d ? 'DEP $S_X(e^{\\j\\omega})$' : 'DEP $S_X(f)$');
  a.classList.remove('card'); b.classList.remove('card');
  pairChart(a, i, 'r', true); pairChart(b, i, 's', true);
  m.append(x, E('div', { class: 'cc-t', style: { fontSize: '20px' }, text: p.n + (p.d ? ' · tempo discreto (|ω| ≤ π)' : ' · convenção em f (Hz)') }),
    E('div', { style: { fontSize: '30px', textAlign: 'center', padding: '6px 0' }, html: T(p.R) + ' &nbsp;<b style="color:#A86B12">⟷</b>&nbsp; ' + T(p.S) }), row,
    E('div', { class: 'note-s', style: { color: '#4E6476', fontSize: '17px', textAlign: 'center' }, text: 'Formas ilustrativas (parâmetros normalizados). Pares da Tabela 8.3 da apostila.' }));
  root.append(m); x.focus();
}

/* ---------- S10 · Exemplos 8.1, 8.2 e 8.3 ---------- */
addScene({
  id: 'ex8-1', group: 't', mnum: 'Ex 8.1', short: 'Ex 8.1', menu: 'Exemplo 8.1 — senóide de fase aleatória', steps: ['r0', 'r1', 'r2'],
  notes: {
    fala: 'No Capítulo 7 (Exemplo 2), calcular essa DEP exigiu duas caixas de resolução e um argumento de limite. Com o teorema são três linhas: Euler separa o cosseno em duas exponenciais, e cada exponencial é uma raia.',
    pergunta: 'Para onde vai o termo $e^{+\\j2\\pi f_c\\tau}$: para $+f_c$ ou $-f_c$?',
    tempo: '3 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.6 · O atalho em ação', title: 'Exemplo 8.1 — a senóide de fase aleatória em três linhas', split: true });
    const st = Steps(this.steps);
    const top = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 56px 1fr', gap: '4px' } }); f.L.append(top);
    const cT = chartCard(top, '$R_X(\\tau)=\\frac{A^2}{2}\\cos(2\\pi f_c\\tau)$');
    top.append(FArrow('$\\mathcal F$'));
    const cF = chartCard(top, '$S_X(f)$');
    const Tt = new Chart(cT, { w: 420, h: 300, m: { l: 66, r: 14, t: 26, b: 60 }, x: { min: -2, max: 2, ticks: [[-2, '-\\tfrac{2}{f_c}'], [-1, '-\\tfrac{1}{f_c}'], [0, '0'], [1, '\\tfrac{1}{f_c}'], [2, '\\tfrac{2}{f_c}']], label: '$\\tau$', lpos: 'end' }, y: { min: -1.2, max: 1.25, ticks: [[-1, '-\\tfrac{A^2}{2}'], [0, '0'], [1, '\\tfrac{A^2}{2}']] } });
    const Ff = new Chart(cF, { w: 420, h: 300, m: { l: 66, r: 14, t: 26, b: 60 }, x: { min: -2, max: 2, ticks: [[-1, '-f_c'], [0, '0'], [1, 'f_c']], label: '$f$', lpos: 'end' }, y: { min: 0, max: 0.7, ticks: [[0, '0'], [0.5, '\\tfrac{A^2}{4}']] } });
    const S = { th: 0.7, run: false };
    Tt.add(new Curve({ f: t => Math.cos(2 * PI * t), w: 3.6, vis: k => k >= 0 }));
    Tt.add(new Dot({ x: () => S.th / (2 * PI), y: () => Math.cos(S.th), color: C.gold, vis: st.only('r1') }));
    Ff.add(new Impulse({ x: 1, h: 0.5, color: C.goldD, tex: '\\tfrac{A^2}{4}\\delta(f-f_c)', size: 19, vis: st.from('r2'), delay: 900 }));
    Ff.add(new Impulse({ x: -1, h: 0.5, color: C.aquaD, tex: '\\tfrac{A^2}{4}\\delta(f+f_c)', side: 'l', size: 19, vis: st.from('r2'), delay: 900 }));
    /* fasores */
    const low = E('div', { style: { display: 'grid', gridTemplateColumns: '420px 1fr', gap: '12px', marginTop: '12px', alignItems: 'stretch' } }); f.L.append(low);
    const cP = chartCard(low, 'Euler: fasores em sentidos opostos');
    const Ph = new Chart(cP, { w: 400, h: 270, m: { l: 20, r: 20, t: 10, b: 10 }, x: { min: -1.8, max: 1.8, ticks: [] }, y: { min: -1.25, max: 1.25, ticks: [] }, grid: false, zero: true, xzero: true });
    Ph.add(new Custom({
      vis: st.from('r1'), draw(c, g, p, mk) {
        const r = 0.8, th = S.th, cs = Math.cos(th), sn = Math.sin(th), sx = (c.X(1) - c.X(0)), sy = (c.Y(0) - c.Y(1));
        SV('ellipse', { cx: c.X(0), cy: c.Y(0), rx: sx * r, ry: sy * r, fill: 'none', stroke: '#B9C6CD', 'stroke-dasharray': '4 5' }, g);
        SV('path', { d: arrowPath(c.X(0), c.Y(0), c.X(r * cs), c.Y(r * sn)), stroke: C.goldD, 'stroke-width': 3.4, fill: 'none' }, g);
        SV('path', { d: arrowPath(c.X(r * cs), c.Y(r * sn), c.X(2 * r * cs), c.Y(0)), stroke: C.aquaD, 'stroke-width': 3.4, fill: 'none' }, g);
        SV('path', { d: arrowPath(c.X(0), c.Y(0) + 5, c.X(2 * r * cs), c.Y(0) + 5), stroke: C.petro, 'stroke-width': 4.5, fill: 'none' }, g);
        mk.lab('p').set(c.X(r * cs * 1.15), c.Y(r * sn * 1.15), labHTML({ tex: '\\tfrac{A^2}{4}e^{+\\j2\\pi f_c\\tau}', color: C.goldD, size: 18, bg: true }), (cs >= 0 ? 'l' : 'r') + (sn >= 0 ? 'b' : 't'));
        mk.lab('m').set(c.X(r * cs * 1.15), c.Y(-r * sn * 1.15), labHTML({ tex: '\\tfrac{A^2}{4}e^{-\\j2\\pi f_c\\tau}', color: C.aquaD, size: 18, bg: true }), (cs >= 0 ? 'l' : 'r') + (sn >= 0 ? 't' : 'b'));
        SV('path', { d: arrowPath(c.X(0), c.Y(0), c.X(r * cs), c.Y(-r * sn)), stroke: C.aquaD, 'stroke-width': 2, 'stroke-dasharray': '4 4', fill: 'none', opacity: .7 }, g);
      }
    }));
    const side = E('div', { class: 'vstack' }); low.append(side);
    side.append(Box('comoler', 'A soma dos dois fasores é sempre <b>real</b>: $\\frac{A^2}{4}e^{\\j\\theta}+\\frac{A^2}{4}e^{-\\j\\theta}=\\frac{A^2}{2}\\cos\\theta$. Cada exponencial é um par da tabela: $e^{\\j2\\pi f_c\\tau}\\leftrightarrow\\delta(f-f_c)$.', { size: 'xs' }));
    let raf = null;
    const loop = () => { S.th += 0.025; if (S.th > 4 * PI) S.th -= 4 * PI; Ph.render(); Tt.render(); raf = requestAnimationFrame(loop); };
    const startLoop = () => { if (!raf && !RM) raf = requestAnimationFrame(loop); };
    const stopLoop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
    const fly = () => {
      const cont = f.L;
      [['\\tfrac{A^2}{4}e^{+\\j2\\pi f_c\\tau}', 1, C.goldD, S.th], ['\\tfrac{A^2}{4}e^{-\\j2\\pi f_c\\tau}', -1, C.aquaD, -S.th]].forEach(([tx, side, col]) => {
        const p0 = svgPt(Ph, side > 0 ? 0.25 : 0.75, side > 0 ? 0.35 : -0.35, cont), p1 = svgPt(Ff, side, 0.55, cont);
        const el = E('div', { class: 'flyer', html: T(tx), style: { color: col, left: p0.x + 'px', top: p0.y + 'px' } });
        cont.append(el);
        tween(900, t => { el.style.left = lerp(p0.x, p1.x - 60, t) + 'px'; el.style.top = lerp(p0.y, p1.y - 30, t) + 'px'; }).done.then(() => tween(300, t => el.style.opacity = 1 - t).done.then(() => el.remove()));
      });
    };
    const rows = [
      { tex: 'R_X(\\tau)=\\frac{A^2}{2}\\cos(2\\pi f_c\\tau)', note: 'Já calculado no Capítulo 6 (processo WSS).' },
      { tex: '\\frac{A^2}{2}\\cos(2\\pi f_c\\tau)=\\hl{\\frac{A^2}{4}e^{\\j2\\pi f_c\\tau}+\\frac{A^2}{4}e^{-\\j2\\pi f_c\\tau}}', note: 'Euler: dois fasores de mesmo peso, sentidos opostos.' },
      { tex: 'S_X(f)=\\hl{\\frac{A^2}{4}[\\delta(f-f_c)+\\delta(f+f_c)]}', note: 'Par $e^{\\j2\\pi f_c\\tau}\\leftrightarrow\\delta(f-f_c)$. Mesmo resultado do Capítulo 7.' }
    ];
    const rp = new ResPanel(f.R, 'Exemplo 8.1');
    return {
      goto(k, anim) {
        rp.set(rows, k, anim); Tt.goto(k, anim); Ff.goto(k, anim); Ph.goto(k, anim);
        if (k === 1) startLoop(); else stopLoop();
        if (k === 2 && anim) fly();
      },
      leave: stopLoop
    };
  }
});
addScene({
  id: 'ex8-2', group: 't', mnum: 'Ex 8.2', short: 'Ex 8.2', menu: 'Exemplo 8.2 — sensor com offset', steps: ['r0', 'r1'],
  notes: {
    fala: 'Linearidade mais dois pares discretos da tabela. Sem núcleo de Fejér, sem limite. A parte constante de $R_X$ (que não decai) vira raia; a parte impulsiva vira piso plano.',
    pergunta: 'Qual parte de $R_X[k]$ “nunca esquece”? Em que ela se transforma?',
    tempo: '2 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.6 · O atalho em ação', title: 'Exemplo 8.2 — o sensor com offset, em duas linhas', split: true });
    const st = Steps(this.steps);
    const top = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 56px 1fr', gap: '4px' } }); f.L.append(top);
    const cT = chartCard(top, '$X[n]=\\mu+W[n]$: $R_X[k]=\\mu^2+\\sigma^2\\delta[k]$');
    top.append(FArrow('$\\mathcal F$'));
    const cF = chartCard(top, '$S_X(e^{\\j\\omega})$');
    const mu2 = 1, s2 = 1.2;
    const Tk = new Chart(cT, { w: 420, h: 470, m: { l: 74, r: 14, t: 30, b: 60 }, x: { min: -6.5, max: 6.5, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$k$', lpos: 'end' }, y: { min: 0, max: 2.6, ticks: [[0, '0'], [mu2, '\\mu^2'], [mu2 + s2, '\\mu^2+\\sigma^2']] } });
    const pts = []; for (let k = -6; k <= 6; k++) pts.push([k, mu2]);
    Tk.add(new Stems({ pts, color: C.navy, vis: k => k >= 0, op: 1 }));
    Tk.add(new Stems({ pts: [[0, s2, mu2]], color: C.goldD, vis: k => k >= 0, delay: 500 }));
    Tk.add(new Label({ x: 3.6, y: 1.35, html: '$\\mu^2$: nunca esquece', color: C.navy, size: 18, bg: true, vis: k => k >= 0 }));
    Tk.add(new Label({ x: 2.2, y: 2.25, html: '$\\sigma^2\\delta[k]$: sem memória', color: C.goldD, size: 18, bg: true, vis: k => k >= 0 }));
    const Fw = new Chart(cF, { w: 420, h: 470, m: { l: 74, r: 14, t: 30, b: 60 }, x: { min: -PI, max: PI, ticks: [[-PI, '-\\pi'], [-PI / 2, '-\\tfrac{\\pi}{2}'], [0, '0'], [PI / 2, '\\tfrac{\\pi}{2}'], [PI, '\\pi']], label: '$\\omega$', lpos: 'end' }, y: { min: 0, max: 7.3, ticks: [[0, '0'], [s2, '\\sigma^2'], [2 * PI * mu2, '2\\pi\\mu^2']] } });
    Fw.add(new Area({ f: () => s2, fill: C.goldF, vis: st.from('r1'), delay: 500 }));
    Fw.add(new Curve({ f: () => s2, color: C.goldD, w: 3.6, vis: st.from('r1'), delay: 500 }));
    Fw.add(new Impulse({ x: 0, h: 2 * PI * mu2, color: C.navy, tex: '2\\pi\\mu^2\\delta(\\omega)', vis: st.from('r1'), size: 20 }));
    Fw.add(new Label({ x: 1.9, y: 1.75, html: 'piso $\\sigma^2$', color: C.goldD, size: 19, bg: true, vis: st.from('r1'), delay: 900 }));
    f.L.append(E('div', { style: { marginTop: '12px' } }, Box('dica', '<b>Piso plano</b> ↔ amostras sem memória (ruído branco); <b>raia</b> (impulso) ↔ componente determinística escondida (DC em $f=0$, senóide em $\\pm f_0$). Ao olhar qualquer DEP, procure primeiro as raias e o piso.', { size: 'xs' })));
    const rows = [
      { tex: 'R_X[k]=\\hl{\\mu^2}+\\hl{\\sigma^2\\delta[k]}', note: 'Já calculado no Capítulo 7 (Exemplo 4).' },
      { tex: 'S_X(e^{\\j\\omega})=\\hl{2\\pi\\mu^2\\delta(\\omega)}+\\hl{\\sigma^2},\\quad|\\omega|\\le\\pi', note: 'Linearidade + dois pares discretos. Sem Fejér, sem limite.' }
    ];
    const rp = new ResPanel(f.R, 'Exemplo 8.2');
    return { goto(k, anim) { rp.set(rows, k, anim); Tk.goto(k, anim); Fw.goto(k, anim); } };
  }
});
addScene({
  id: 'ex8-3', group: 't', mnum: 'Ex 8.3', short: 'Ex 8.3', menu: 'Exemplo 8.3 — acelerar uma gravação de ruído', steps: ['r0', 'r1', 'r2', 'r3'],
  notes: {
    fala: 'Um registrador grava o ruído de um sensor com $R_X(\\tau)=e^{-|\\tau|}$ e o arquivo é reproduzido duas vezes mais rápido. Pico cai à metade, largura dobra, potência conservada — é a propriedade (D6) em ação.',
    pergunta: 'Se tocássemos 3× mais rápido, qual seria $S_Y(0)$?',
    tempo: '3 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.6 · O atalho em ação', title: 'Exemplo 8.3 — acelerar uma gravação de ruído: $Y(t)=X(2t)$', split: true });
    const st = Steps(this.steps);
    const top = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 56px 1fr', gap: '4px' } }); f.L.append(top);
    const cT = chartCard(top, 'Memória');
    top.append(FArrow('$\\mathcal F$'));
    const cF = chartCard(top, 'Espectro');
    const Rt = new Chart(cT, { w: 420, h: 560, m: { l: 56, r: 14, t: 30, b: 60 }, x: { min: -3, max: 3, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$\\tau$ (s)', lpos: 'end' }, y: { min: 0, max: 1.08, ticks: [0, 0.5, 1] } });
    const Sf = new Chart(cF, { w: 420, h: 560, m: { l: 56, r: 14, t: 30, b: 60 }, x: { min: -1.2, max: 1.2, ticks: [-1, -0.5, 0, 0.5, 1], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 2.2, ticks: [0, 0.5, 1, 1.5, 2] } });
    const SX = x => lor(x, 1), SY = x => lor(x, 2);
    Rt.add(new Curve({ f: t => Math.exp(-Math.abs(t)), w: 3.6, vis: k => k >= 0 }));
    Rt.add(new Curve({ f: t => Math.exp(-2 * Math.abs(t)), color: C.goldD, w: 3.6, vis: st.from('r1') }));
    Rt.add(new Label({ x: 1.6, y: 0.45, html: '$R_X=e^{-|\\tau|}$', color: C.petro, size: 19, bg: true, vis: k => k >= 0 }));
    Rt.add(new Label({ x: -1.5, y: 0.3, html: '$R_Y=e^{-2|\\tau|}$', color: C.goldD, size: 19, bg: true, vis: st.from('r1') }));
    Sf.add(new Area({ f: SX, fill: C.petroF, vis: st.only('r0', 'r3') }));
    Sf.add(new Curve({ f: SX, w: 3.6, vis: k => k >= 0, n: 700 }));
    Sf.add(new Area({ f: (x, p) => lerp(SX(x), SY(x), p), fill: C.goldF2, p: k => k >= 2 ? 1 : 0, vis: st.from('r3'), n: 400 }));
    Sf.add(new Curve({ f: (x, p) => lerp(SX(x), SY(x), p), color: C.goldD, w: 3.6, p: k => k >= 2 ? 1 : 0, pdur: 1300, vis: st.from('r2'), reveal: 'fade', n: 700 }));
    Sf.add(new Label({ x: 0.62, y: 1.25, html: '$S_X=\\frac{2}{1+4\\pi^2f^2}$', color: C.petro, size: 19, bg: true, vis: k => k >= 0 }));
    Sf.add(new Label({ x: 0.72, y: 0.62, html: '$S_Y=\\frac{4}{4+4\\pi^2f^2}$', color: C.goldD, size: 19, bg: true, vis: st.from('r2'), delay: 1000 }));
    const f3x = 1 / (2 * PI), f3y = 2 / (2 * PI), r3 = st.from('r3');
    Sf.add(new Dot({ x: 0, y: SX(0), color: C.petro, r: 7, html: `$S_X(0)=${tnum(SX(0), 0)}$`, an: 'lm', dx: 12, dy: 0, vis: r3 }));
    Sf.add(new Dot({ x: 0, y: SY(0), color: C.goldD, r: 7, html: `$S_Y(0)=${tnum(SY(0), 0)}$`, an: 'rm', dx: -12, dy: -14, vis: r3 }));
    for (const s of [1, -1]) {
      Sf.add(new VLine({ x: s * f3x, y0: 0, y1: SX(f3x), color: C.petro, w: 2.4, vis: r3 }));
      Sf.add(new VLine({ x: s * f3y, y0: 0, y1: SY(f3y), color: C.goldD, w: 2.4, vis: r3 }));
    }
    Sf.add(new Label({ x: -1.15, y: 1.72, an: 'lm', html: `pico: $2\\to1$<br>$f_{3\\mathrm{dB}}$: $${tnum(f3x, 2)}\\to${tnum(f3y, 2)}$ Hz<br>área: $1\\to1$`, size: 19, bg: true, vis: r3 }));
    const rows = [
      { tex: 'S_X(f)=\\hl{\\frac{2}{1+4\\pi^2f^2}}', note: 'Par lorentziano com $a=1$, $\\sigma^2=1$.' },
      { tex: 'R_Y(\\tau)=R_X(2\\tau)=\\hl{e^{-2|\\tau|}}', note: '(D6) com $a=2$: memória duas vezes mais curta.' },
      { tex: 'S_Y(f)=\\frac{4}{4+4\\pi^2f^2}=\\hl{\\tfrac12S_X\\big(\\tfrac f2\\big)}', note: 'Par lorentziano com $a=2$ — confere com a regra de escala.' },
      { tex: '\\hl{S_Y(0)=1},\\ S_X(0)=2;\\ \\int S_Y\\dd f=\\int S_X\\dd f=1', note: 'Pico cai à metade, largura dobra, potência conservada.' }
    ];
    const rp = new ResPanel(f.R, 'Exemplo 8.3');
    const ib = Box('interp', 'Os três exemplos mostram o papel do teorema: ele <b>não</b> muda nenhum resultado do Capítulo 7 — muda o <i>custo</i> de obtê-los.', { size: 'xs' });
    f.R.append(ib);
    return { goto(k, anim) { rp.set(rows, k, anim); Rt.goto(k, anim); Sf.goto(k, anim); ib.style.opacity = k >= 3 ? 1 : .2; } };
  }
});

/* ---------- S11 · Convenções: f ou ω, bilateral ou unilateral (Tabela 8.4) ---------- */
function foldDraw(c, g, F, X1, t, cols) { /* metade negativa de F (par) dobra sobre a positiva e empilha */
  const u = clamp(t / 0.6, 0, 1), v = clamp((t - 0.6) / 0.4, 0, 1);
  const pos = sample(F, 0, X1, 240);
  SV('path', { d: dPath(c, [[0, 0], ...pos, [X1, 0]], true), fill: cols.pos, stroke: 'none' }, g);
  const sc = 1 - 2 * u;
  const top = sample(F, -X1, 0, 240).map(([x, y]) => [x * sc, y + v * F(x)]);
  const bot = sample(F, -X1, 0, 240).map(([x]) => [x * sc, v * F(x)]).reverse();
  SV('path', { d: dPath(c, [...top, ...bot], true), fill: cols.neg, stroke: cols.negS || 'none', 'stroke-width': 2 }, g);
}
addScene({
  id: 's11', group: 't', mnum: 'S11', short: 'S11', menu: 'Convenções: $f$ ou $\\omega$, bilateral ou unilateral', steps: ['f', 'w', 'uni', 'erro'],
  notes: {
    fala: 'A forma de $S$ é a mesma nas duas convenções: o valor em $\\omega=2\\pi f$ é igual ao valor em $f$. O que muda é a medida da integral: $\\dd\\omega=2\\pi\\dd f$, daí o $1/2\\pi$. A unilateral $G=2S$ para $f\\ge0$ concentra nas frequências positivas a mesma potência total. A fórmula de Nyquist, $4kTR$, está na convenção unilateral.',
    pergunta: 'Se um datasheet dá a DEP unilateral e eu integro de $-\\infty$ a $\\infty$, erro por quantos dB?',
    tempo: '4 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.7 · Convenções', title: '$f$ ou $\\omega$, bilateral ou unilateral', split: true });
    const st = Steps(this.steps);
    const card = chartCard(f.L, 'A mesma DEP em duas réguas <small>$S(f)=\\dfrac{2}{1+4\\pi^2f^2}$</small>');
    const SF = x => lor(x, 1);
    const fT = [-1, -0.5, 0, 0.5, 1].map(v => [v, nf(v, 1)]), wT = [[-1, '-2\\pi'], [-0.5, '-\\pi'], [0, '0'], [0.5, '\\pi'], [1, '2\\pi']];
    const ch = new Chart(card, {
      w: 904, h: 560, x: { min: -1.25, max: 1.25, ticks: fT, label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 4.4, ticks: [0, 1, 2, 3, 4] },
      dom: k => k === 1 ? { xticks: wT, xlabel: '$\\omega$ (rad/s)' } : { xticks: fT, xlabel: '$f$ (Hz)' }
    });
    ch.add(new Area({ f: SF, fill: C.goldF, vis: st.only('f', 'w') }));
    ch.add(new Curve({ f: SF, w: 3.8, vis: st.only('f', 'w'), n: 700 }));
    ch.add(new Label({ x: 0.62, y: 1.5, html: '$\\int S(f)\\,\\dd f=1$', color: C.goldD, size: 22, bg: true, vis: st.only('f') }));
    ch.add(new Label({ x: 0.62, y: 1.5, html: '$\\frac{1}{2\\pi}\\int S(\\omega)\\,\\dd\\omega=1$', color: C.goldD, size: 22, bg: true, vis: st.only('w') }));
    ch.add(new Label({ x: 0, y: 3.4, html: 'o valor em $\\omega=2\\pi f$ é igual ao valor em $f$;<br>muda a medida: $\\dd\\omega=2\\pi\\,\\dd f$', size: 21, bg: true, vis: st.only('w') }));
    ch.add(new Custom({ vis: st.from('uni'), p: k => k >= 2 ? 1 : 0, pdur: 1800, draw(c, g, t) { foldDraw(c, g, SF, 1.25, t, { pos: C.petroF, neg: 'rgba(227,162,59,.45)', negS: C.goldD }); } }));
    ch.add(new Curve({ f: x => 2 * SF(x), x0: 0, x1: 1.25, w: 3.8, color: C.navy, vis: st.from('uni'), delay: 1700 }));
    ch.add(new Label({ x: 0.55, y: 2.6, html: '$G(f)=2S(f),\\ f\\ge0$<br>$\\int_0^{\\infty}G\\,\\dd f=1$', size: 21, bg: true, color: C.navy, vis: st.from('uni'), delay: 1700 }));
    ch.add(new Area({ f: x => 2 * SF(x), a: -1.25, b: 0, fill: C.redF, vis: st.from('erro') }));
    ch.add(new Curve({ f: x => 2 * SF(x), x0: -1.25, x1: 0, color: C.red, dash: '8 6', w: 3, vis: st.from('erro') }));
    ch.add(new Label({ x: -0.62, y: 2.6, html: '$\\int_{-\\infty}^{\\infty}G\\,\\dd f=2$ ✗<br>(erro de 2, isto é, 3 dB)', size: 20, bg: true, color: C.red, vis: st.from('erro') }));
    const tb = Box('resultado', '<table style="width:100%;border-collapse:collapse;font-size:.86em"><tr><th style="text-align:left">em $f$ (apostila)</th><td>$S(f)=\\int R\\,e^{-\\j2\\pi f\\tau}\\dd\\tau$</td><td>$\\int S\\,\\dd f$</td></tr><tr><th style="text-align:left">em $\\omega$ (Papoulis)</th><td>$S(\\omega)=\\int R\\,e^{-\\j\\omega\\tau}\\dd\\tau$</td><td>$\\frac{1}{2\\pi}\\int S\\,\\dd\\omega$</td></tr></table>', { sub: 'Tabela 8.4 — as duas convenções', size: 'xs' });
    const bs = [
      Box('comoler', 'Bilateral em $f$: a potência é a área. Esta é a convenção da apostila e de Kschischang.', { size: 'sm' }),
      Box('comoler', 'A <i>forma</i> de $S$ é a mesma nas duas convenções: o valor em $\\omega=2\\pi f$ é igual ao valor em $f$. O que muda é a <i>medida</i> da integral: $\\dd\\omega=2\\pi\\,\\dd f$, daí o $\\frac{1}{2\\pi}$.', { size: 'sm' }),
      Box('comoler', 'DEP <b>unilateral</b>: $S_+(\\omega)=2S(\\omega)$ para $\\omega\\ge0$ concentra nas frequências positivas a mesma potência total. A fórmula de Nyquist, $4kTR\\ \\mathrm{V^2/Hz}$, está nessa convenção.', { size: 'sm' }),
      Box('erro', 'Misturar convenções numa mesma conta: (i) integrar uma DEP em $\\omega$ com $\\dd f$ (erro de $2\\pi$); (ii) integrar uma DEP unilateral de $-\\infty$ a $\\infty$ (erro de 2, isto é, 3 dB); (iii) tratar uma densidade de <i>amplitude</i> em $\\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$ como se fosse DEP — é preciso elevá-la ao quadrado (Questão 8.3).', { size: 'sm' })
    ];
    const bw = E('div', { style: { position: 'relative', flex: '1' } }); bs.forEach(b => { b.classList.add('pane'); bw.append(b); });
    f.R.append(tb, bw);
    return { goto(k, anim) { bs.forEach((b, i) => b.classList.toggle('off', i !== Math.max(0, k))); ch.goto(k, anim); } };
  }
});

/* ---------- S12 · DEP na saída de um filtro (Eq. 8.5) ---------- */
addScene({
  id: 's12', group: 't', mnum: 'S12', short: 'S12', menu: 'DEP na saída de um filtro (Eq. 8.5)', steps: ['eq', 'fatia', 'eqz', 'erro'],
  notes: {
    fala: 'Um equalizador de som tem uma barra para cada faixa de frequências; subir a barra de 1 kHz em 6 dB multiplica a potência naquela faixa por 4, sem tocar nas outras. Um filtro linear faz exatamente isso com a DEP: cada “fatia” de frequência é multiplicada pelo ganho de potência $|H(f)|^2$.',
    pergunta: 'Dois filtros com o mesmo $|H|$ mas fases diferentes: as DEPs de saída são iguais? E as formas de onda?',
    tempo: '5 min'
  },
  build(root) {
    const f = Frame(root, { kicker: '8.3.8 · Ferramenta extra', title: 'DEP na saída de um filtro: $S_Y(f)=|H(f)|^2S_X(f)$', split: true });
    const st = Steps(this.steps);
    const S = { g: [6, 0, 0, 0, 0, 0, 0, 0], s: -8.5 };
    const SX = x => Math.abs(x) <= 8.5 ? 1 / (1 + (x / 2.5) ** 2) : 0;
    const band = x => clamp(Math.round(Math.abs(x)), 1, 8) - 1;
    const H2 = x => Math.pow(10, S.g[band(x)] / 10), H1 = x => Math.pow(10, S.g[band(x)] / 20);
    const SY = x => SX(x) * H2(x);
    const card = E('div', { class: 'card cc', style: { padding: '8px 12px' } }); f.L.append(card);
    const mkC = (lab, ymax, ticks) => new Chart(card, { w: 904, h: 212, m: { l: 70, r: 18, t: 32, b: 44 }, x: { min: -8.5, max: 8.5, ticks: [-8, -6, -4, -2, 0, 2, 4, 6, 8], label: '$f$ (kHz)', lpos: 'end' }, y: { min: 0, max: ymax, ticks, label: lab } });
    const cX = mkC('$S_X(f)$', 1.2, [0, 0.5, 1]);
    const cH = mkC('$\\times\\ |H(f)|^2$ (ganho de potência)', 4.6, [0, 1, 2, 4]);
    const cY = mkC('$=\\ S_Y(f)$', 4.6, [0, 1, 2, 4]);
    cX.add(new Area({ f: SX, fill: C.petroF, n: 600, vis: k => k >= 0 })); cX.add(new Curve({ f: SX, w: 3.4, n: 900, vis: k => k >= 0 }));
    cH.add(new Area({ f: H2, fill: C.navyF, n: 1400, vis: k => k >= 0, delay: 300 })); cH.add(new Curve({ f: H2, color: C.navy, w: 3.2, n: 1400, vis: k => k >= 0, delay: 300 }));
    cH.add(new Label({ x: 0, y: 4.25, html: () => S.g[0] === 6 ? 'barra de 1 kHz em +6 dB: potência ×4' : 'ganho de potência por faixa', size: 17, bg: true, vis: k => k >= 0 }));
    const sweepVis = st.only('fatia');
    cY.add(new Area({ f: SY, fill: C.goldF, n: 1400, a: -8.5, b: (p) => p, p: k => k === 1 ? 8.5 : k > 1 ? 8.5 : -8.5, pdur: 3200, pease: linear, vis: st.from('fatia') }));
    cY.add(new Curve({ f: SY, color: C.goldD, w: 3.4, n: 1400, x0: -8.5, x1: p => p, p: k => k === 1 ? 8.5 : k > 1 ? 8.5 : -8.5, pdur: 3200, pease: linear, vis: st.from('fatia'), reveal: 'fade' }));
    for (const [ch, F, col] of [[cX, SX, C.petro], [cH, H2, C.navy], [cY, SY, C.goldD]]) {
      ch.add(new Custom({
        vis: sweepVis, p: k => k === 1 ? 8.5 : -8.5, pdur: 3200, pease: linear, layer: 'top', draw(c, g, s) {
          if (s >= 8.49) return;
          SV('rect', { x: c.X(s - 0.22), y: c.y0, width: c.X(s + 0.22) - c.X(s - 0.22), height: c.ih, fill: 'rgba(227,162,59,.28)' }, g);
          SV('circle', { cx: c.X(s), cy: c.Y(F(s)), r: 6, fill: col, stroke: '#fff', 'stroke-width': 2 }, g);
        }
      }));
    }
    cY.add(new Curve({ f: x => SX(x) * H1(x), color: C.red, dash: '8 6', w: 3, n: 1400, vis: st.from('erro') }));
    cY.add(new Label({ x: 4.6, y: 3.2, html: '<span style="color:#C0392B">┅ errado: $|H|\\,S_X$ (×2)</span><br><span style="color:#C7861E">━ certo: $|H|^2S_X$ (×4)</span>', size: 18, bg: true, vis: st.from('erro') }));
    const PX = integ(SX, -8.5, 8.5, 4000);
    const PY = () => { let s = 0; for (let b = 0; b < 8; b++) { const lo = b === 0 ? 0 : b + 0.5, hi = b + 1.5 > 8.5 ? 8.5 : b + 1.5; s += 2 * Math.pow(10, S.g[b] / 10) * integ(SX, lo, Math.min(hi, 8.5), 200); } return s; };
    cY.add(new Label({ x: -8.3, y: 3.9, an: 'lm', html: () => `$P_Y/P_X=${tnum(PY() / PX, 2)}$`, size: 20, bg: true, color: C.goldD, vis: st.from('eqz') }));
    const boxes = E('div', { style: { position: 'relative', height: '250px', flex: 'none' } });
    const bs = [
      Box('analogia', 'Um equalizador de som tem uma barra para cada faixa de frequências; subir a barra de 1 kHz em 6 dB multiplica <i>a potência</i> naquela faixa por 4, sem tocar nas outras. Um filtro linear faz exatamente isso com a DEP: cada “fatia” de frequência é multiplicada pelo ganho de potência $|H(f)|^2$.', { sub: 'o equalizador gráfico', size: 'xs' }),
      Box('resultado', 'Se $X$ é WSS e o filtro LTI é estável, a saída $Y$ é WSS, com$$S_Y(f)=|H(f)|^2S_X(f),\\quad P_Y=\\int|H|^2S_X\\,\\dd f,\\quad m_Y=H(0)\\,m_X.$$Em tempo discreto: $S_Y(e^{\\j\\omega})=|H(e^{\\j\\omega})|^2S_X(e^{\\j\\omega})$.', { sub: 'relação entrada–saída (Eq. 8.5)', size: 'xs' }),
      Box('interp', 'Arraste as barras: cada faixa de $S_Y$ responde só à sua barra. $+6$ dB de amplitude = $\\times4$ na potência daquela faixa.', { size: 'xs' }),
      Box('erro', 'Usar $H(f)$ em vez de $|H(f)|^2$. A DEP é uma densidade de <i>potência</i>: o filtro multiplica amplitudes por $|H|$ e, portanto, potências por $|H|^2$. A fase de $H$ desaparece — dois filtros com o mesmo $|H|$ produzem saídas com a mesma DEP (embora formas de onda diferentes).', { size: 'xs' })
    ];
    bs.forEach(b => { b.classList.add('pane'); boxes.append(b); });
    const eqw = E('div', { class: 'eq', 'aria-label': 'Equalizador gráfico' });
    S.g.forEach((gv, i) => {
      const db = E('span', { class: 'db' }), x4 = E('span', { class: 'x4' });
      const inp = E('input', { type: 'range', min: -12, max: 6, step: 1, value: gv, id: 'eq' + i, 'aria-label': 'Faixa ' + (i + 1) + ' kHz' });
      const upd = () => { const v = +inp.value; S.g[i] = v; db.textContent = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' dB'; x4.textContent = '×' + nf(Math.pow(10, v / 10), v <= -10 ? 2 : 1); };
      inp.addEventListener('input', () => { upd(); cH.render(); cY.render(); });
      inp.addEventListener('pointerup', () => inp.blur());
      upd();
      eqw.append(E('div', { class: 'band' }, db, inp, E('span', { text: (i + 1) + ' kHz' }), x4));
    });
    f.R.append(boxes, eqw);
    return {
      goto(k, anim) {
        const show = k === 0 ? 0 : k === 1 ? 1 : k === 2 ? 2 : 3;
        bs.forEach((b, i) => b.classList.toggle('off', i !== show));
        if (k === 0) { bs[0].classList.remove('off'); bs[0].style.transform = 'translateY(0)'; }
        eqw.style.opacity = k >= 2 ? 1 : .3; eqw.querySelectorAll('input').forEach(i => i.disabled = k < 2);
        cX.goto(k, anim); cH.goto(k, anim); cY.goto(k, anim);
      }
    };
  }
});

/* =====================================================================
   MODELO FIXO DE QUESTÃO
   Enunciado → Plano de ataque → Resolução (1 linha da tabela = 1 etapa)
   → [Erro comum] → Resposta final → Interpretação/Aplicação (com controle)
   ===================================================================== */
const QUESTIONS = [];
function enunCard(q) {
  return E('div', { class: 'enun' },
    E('div', { class: 'eq' }, E('span', { text: 'QUESTÃO ' + q.num }), E('b', { text: `Nível ${q.level} ${'●'.repeat(q.level)}${'○'.repeat(5 - q.level)}` })),
    E('div', { class: 'et', html: md(q.title) }),
    E('div', { class: 'ex', html: md(q.enun.html) }),
    q.enun.chips ? E('div', { class: 'chips' }, q.enun.chips.map(c => E('span', { class: 'chip-d' + (c.startsWith('!') ? ' g' : ''), html: md(c.replace(/^!/, '')) }))) : null);
}
function Question(q) {
  const st = Steps(q.steps);
  const d = addScene({ id: q.id, group: 'n' + q.level, mnum: q.num, short: 'Q' + q.num, menu: q.title, steps: q.steps, notes: q.notes, q, st });
  QUESTIONS.push(d);
  d.build = (root) => {
    const f = Frame(root, { kicker: `Questão ${q.num} · Nível ${q.level} — ${LV[q.level].name}`, title: q.title, level: q.level, split: true });
    const cards = {};
    cards.enun = E('div', { class: 'pane' }, enunCard(q));
    cards.plano = E('div', { class: 'pane vstack' }, Box('plano', q.plano.html), Road5(q.plano.road));
    const resWrap = E('div', { class: 'pane', style: { display: 'flex', flexDirection: 'column' } });
    const rp = new ResPanel(resWrap, 'Questão ' + q.num);
    cards.res = resWrap;
    if (q.erro) cards.erro = E('div', { class: 'pane vstack' }, Box('erro', q.erro.html));
    cards.final = E('div', { class: 'pane vstack' }, Box('final', q.final.html));
    cards.interp = E('div', { class: 'pane vstack' }, ...(q.interp.boxes || []).map(([k, h, o]) => Box(k, h, o)));
    Object.values(cards).forEach(c => f.R.append(c));
    const ctx = { cards, frame: f, q };
    const left = q.left(f.L, st, ctx);
    const resIdx = q.steps.map((s, i) => s.k === 'res' ? i : -1).filter(i => i >= 0);
    const resRows = resIdx.map(i => q.steps[i]);
    let lastKind = null;
    return {
      goto(k, anim, pk) {
        const kind = st.kind(k);
        f.setKind(kind);
        panes(cards, kind || 'enun');
        if (kind === 'res') rp.set(resRows, resIdx.indexOf(k), anim);
        left.goto(k, anim, pk);
        lastKind = kind;
      },
      enter: left.enter, leave: left.leave
    };
  };
  return d;
}
/* painéis do lado esquerdo de uma questão, trocados conforme o tipo de etapa */
function LeftPanes(parent, keys) {
  const map = {};
  for (const k of keys) { map[k] = E('div', { class: 'pane' }); parent.append(map[k]); }
  return { map, show(key) { panes(map, key); } };
}

/* =====================================================================
   NÍVEL 1 — AQUECIMENTO: LENDO UMA DEP (Q8.1 a Q8.4)
   ===================================================================== */

/* ---------- Q8.1 · Lendo uma DEP retangular ---------- */
(() => {
  const S0 = 2e-9, FM = 5e3;                 /* V²/Hz, Hz */
  const P = S0 * 2 * FM;                      /* 2e-5 V² */
  const Xr = Math.sqrt(P);                    /* 4,47 mV */
  const Pb = 2 * S0 * (2e3 - 1e3);            /* 4e-6 V² */
  const Pb1 = S0 * (2e3 - 1e3);               /* 2e-6 V² (erro) */
  const G = 2 * S0, PG = G * FM;              /* 4e-9 V²/Hz ; 2e-5 V² */
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'a1', k: 'res', tag: '(a)', road: 3, tex: `P_X=\\int_{-\\infty}^{\\infty}S_X\\,\\dd f=(${sciT(S0)})(\\hl{${sciT(2 * FM)}})=\\hl{${sciT(P)}}\\ \\mathrm{V^2}`, note: 'Largura total do retângulo: de −5 a +5 kHz $=10^4$ Hz.' },
    { n: 'a2', k: 'res', road: 4, tex: `X_{\\rms}=\\sqrt{P_X}=\\sqrt{${sciT(P)}}\\approx\\hl{${tnum(Xr * 1e3, 2)}\\ \\mathrm{mV}}`, note: 'Valor eficaz $=\\sqrt{E[X^2]}$, pois a média é nula.' },
    { n: 'b1', k: 'res', tag: '(b)', road: 3, tex: `P_{[1,2]}=\\hl{2}\\int_{10^3}^{2\\times10^3}${sciT(S0)}\\,\\dd f=\\hl{${sciT(Pb)}}\\ \\mathrm{V^2}`, note: 'Eq. 7.11: as duas faixas $\\pm[1,2]$ kHz.' },
    { n: 'b2', k: 'res', road: 5, tex: `\\frac{P_{[1,2]}}{P_X}=\\frac{${sciT(Pb)}}{${sciT(P)}}=\\hl{${tnum(Pb / P, 2)}}`, note: 'DEP plana: potência proporcional à largura — 20%.' },
    { n: 'erro', k: 'erro' },
    { n: 'c1', k: 'res', tag: '(c)', road: 3, tex: `G_X(f)=\\hl{${sciT(G)}}\\ \\mathrm{V^2/Hz},\\ 0\\le f<5\\ \\mathrm{kHz}`, note: 'Eq. 7.12: dobra-se o valor; descartam-se as frequências negativas.' },
    { n: 'c2', k: 'res', road: 5, tex: `\\int_0^{\\infty}G_X\\,\\dd f=(${sciT(G)})(${sciT(FM)})=\\hl{${sciT(PG)}}\\ \\mathrm{V^2}`, note: 'Mesma potência: as duas descrições são equivalentes.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-1', num: '8.1', level: 1, title: 'Lendo uma DEP retangular', steps,
    enun: {
      html: 'Ruído de um pré-amplificador de áudio (WSS, média nula) com DEP bilateral retangular. (a) Potência ($R=1\\,\\Omega$) e valor eficaz. (b) Potência num passa-faixa ideal de 1 a 2 kHz e fração do total. (c) DEP unilateral $G_X(f)$.',
      chips: [`$S_X=${sciT(S0)}$ V²/Hz`, '$|f|<5$ kHz', '$R=1\\,\\Omega$', '!faixa 1–2 kHz']
    },
    plano: { html: 'Tudo aqui é <b>área de retângulo</b>. Para (b), lembrar que um processo real tem potência nas frequências negativas também (Eq. 7.11): a faixa $[1,2]$ kHz vem acompanhada da imagem $[-2,-1]$ kHz.', road: 3 },
    erro: { html: `Responder (b) com $\\int_{10^3}^{2\\times10^3}S_X\\,\\dd f=${sciT(Pb1)}\\ \\mathrm{V^2}$, esquecendo a faixa espelhada. A DEP <b>bilateral</b> reparte a potência de cada componente real entre $+f$ e $-f$; um filtro físico de 1 a 2 kHz coleta as duas metades.` },
    final: { html: `(a) $P_X=${sciT(P)}\\ \\mathrm{V^2}$, $X_{\\rms}\\approx${tnum(Xr * 1e3, 2)}$ mV.<br>(b) $${sciT(Pb)}\\ \\mathrm{V^2}$, isto é, ${nf(100 * Pb / P, 0)}% do total.<br>(c) $G_X=${sciT(G)}\\ \\mathrm{V^2/Hz}$ em $[0,5)$ kHz, com a mesma área.` },
    interp: { boxes: [['interp', 'Numa DEP plana, a potência é proporcional à largura da faixa: 1 kHz de banda útil (de 5 kHz) leva 20% da potência. Arraste a largura do passa-faixa e acompanhe a fração.', { size: 'sm' }]] },
    notes: {
      fala: 'Neste nível ainda não usamos Wiener–Khinchin. O objetivo é firmar o movimento básico do Capítulo 7: <b>densidade não é potência; potência é área</b>. Quem domina este nível não erra os fatores 2 das questões seguintes.',
      pergunta: 'Antes do item (b): um filtro de 1 a 2 kHz coleta 10% ou 20% da potência?',
      tempo: '6 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'erro', 'interp']);
      const F = x => Math.abs(x) <= 5 ? 2 : 0;
      const rectPts = [[-7.5, 0], [-5, 0], [-5, 2], [5, 2], [5, 0], [7.5, 0]];
      const opt = (w, h, extra) => Object.assign({ w, h, x: { min: -7, max: 7, ticks: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6], label: '$f$ (kHz)', lpos: 'end' }, y: { min: 0, max: 5.2, ticks: [0, 1, 2, 3, 4, 5], label: '$S_X(f)$ $(\\times10^{-9}\\ \\mathrm{V^2/Hz})$' } }, extra);
      const card = chartCard(lp.map.main, 'DEP bilateral do ruído na saída do filtro anti-<i>aliasing</i>');
      const ch = new Chart(card, opt(904, 610));
      const I = st.I;
      /* (a) */
      ch.add(new Area({ pts: [[-5, 2], [5, 2]], fill: C.goldF, p: k => ['b1', 'b2', 'final'].includes(st.name(k)) ? .3 : 1, op: p => p, vis: st.only('a1', 'a2', 'b1', 'b2', 'final'), dur: 1000 }));
      ch.add(new Curve({ pts: rectPts, w: 4, vis: st.not('c1', 'c2') }));
      ch.add(new Label({ x: 0, y: 1, html: `área $=${sciT(P)}\\ \\mathrm{V^2}$`, size: 24, weight: 600, color: C.ink, bg: true, vis: st.only('a1', 'a2'), delay: 700 }));
      ch.add(new Bracket({ x0: -5, x1: 5, y: 2, dy: -22, html: `largura $=${sciT(2 * FM)}$ Hz`, color: C.navy, vis: st.only('a1'), delay: 500 }));
      ch.add(new Label({ x: 0, y: 3.4, html: `$X_{\\rms}=\\sqrt{P_X}\\approx${tnum(Xr * 1e3, 2)}$ mV`, size: 24, color: C.petro, bg: true, vis: st.only('a2') }));
      /* (b) */
      for (const [a, b] of [[1, 2], [-2, -1]]) {
        ch.add(new Area({ pts: [[a, 2], [b, 2]], fill: 'rgba(227,162,59,.85)', vis: st.only('b1', 'b2', 'final'), ra: a, rb: b, delay: a > 0 ? 0 : 500 }));
        ch.add(new Label({ x: (a + b) / 2, y: 2.3, html: `$${sciT(Pb / 2)}$`, size: 19, color: C.goldD, vis: st.only('b1'), delay: 900 }));
      }
      ch.add(new Custom({
        vis: st.only('b1'), draw(c, g, p, mk) {
          for (const s of [1, -1]) SV('path', { d: dPath(c, [[s * 1, 0], [s * 1, 4.6], [s * 2, 4.6], [s * 2, 0]]), fill: 'none', stroke: C.navy, 'stroke-width': 2.4, 'stroke-dasharray': '8 6' }, g);
          mk.lab('h').set(c.X(0), c.Y(4.6) - 4, labHTML({ html: 'passa-faixa ideal $|H|^2$: 1 a 2 kHz <b>e</b> −2 a −1 kHz', size: 18, color: C.navy, bg: true }), 'cb');
        }
      }));
      ch.add(new Label({ x: 0, y: 3.4, html: `$P_{[1,2]}=${sciT(Pb)}\\ \\mathrm{V^2}$`, size: 24, color: C.goldD, bg: true, vis: st.only('b1'), delay: 1000 }));
      ch.add(new Custom({
        vis: st.only('b2'), reveal: 'draw', draw(c, g, p, mk) {
          for (let x = -4; x <= 4; x++) SV('line', { x1: c.X(x), x2: c.X(x), y1: c.Y(0), y2: c.Y(2), stroke: '#fff', 'stroke-width': 2.5 }, g);
          mk.lab('t').set(c.X(0), c.Y(2) - 14, labHTML({ html: `2 de 10 fatias de 1 kHz $=${tnum(100 * Pb / P, 0)}\\%$`, size: 23, color: C.ink, bg: true }), 'cb');
        }
      }));
      /* (c) dobra */
      ch.add(new Custom({ vis: st.only('c1', 'c2'), p: k => k >= I('c1') ? 1 : 0, pdur: 1900, draw(c, g, t) { foldDraw(c, g, F, 5, t, { pos: C.petroF, neg: 'rgba(227,162,59,.5)', negS: C.goldD }); } }));
      ch.add(new Curve({ pts: [[0, 0], [0, 4], [5, 4], [5, 0]], color: C.navy, w: 4, vis: st.only('c1', 'c2'), delay: 1800 }));
      ch.add(new Label({ x: 2.5, y: 4.55, html: `$G_X(f)=${sciT(G)}\\ \\mathrm{V^2/Hz}$, $0\\le f<5$ kHz`, size: 21, color: C.navy, bg: true, vis: st.only('c1', 'c2'), delay: 1900 }));
      ch.add(new Label({ x: -3.5, y: 1, html: 'frequências<br>negativas<br>descartadas', size: 19, color: C.mute, vis: st.only('c1', 'c2'), delay: 1900 }));
      ch.add(new Area({ pts: [[0, 4], [5, 4]], fill: C.goldF, vis: st.only('c2'), ra: 0, rb: 5 }));
      ch.add(new Label({ x: 2.5, y: 2, html: `área $=${sciT(PG)}\\ \\mathrm{V^2}$`, size: 24, weight: 600, bg: true, vis: st.only('c2'), delay: 800 }));
      /* resposta final */
      ch.add(new Curve({ pts: [[0, 0], [0, 4], [5, 4], [5, 0]], color: C.navy, w: 2.6, dash: '9 7', vis: st.only('final') }));
      ch.add(new Label({ x: 0, y: 1, html: `$P_X=${sciT(P)}\\ \\mathrm{V^2}$ · $X_{\\rms}\\approx${tnum(Xr * 1e3, 2)}$ mV`, size: 21, bg: true, vis: st.only('final') }));
      ch.add(new Label({ x: -2.7, y: 2.9, html: `$\\pm[1,2]$ kHz: $${sciT(Pb)}\\ \\mathrm{V^2}$ (20%)`, size: 21, color: C.goldD, bg: true, vis: st.only('final') }));
      ch.add(new Label({ x: 3.3, y: 4.45, html: `$G_X=${sciT(G)}$ em $[0,5)$ kHz`, size: 21, color: C.navy, bg: true, vis: st.only('final') }));
      /* erro comum: errado × certo */
      const er = E('div', { class: 'hrow', style: { alignItems: 'flex-start' } }); lp.map.erro.append(er);
      const cW = chartCard(er, '<span style="color:#9E2B25">✗ Errado</span> <small>só a faixa positiva</small>', { style: { flex: '1' } });
      const cR = chartCard(er, '<span style="color:#146B73">✓ Certo</span> <small>as duas faixas</small>', { style: { flex: '1' } });
      const eW = new Chart(cW, opt(440, 630, { x: { min: -7, max: 7, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$f$ (kHz)', lpos: 'end' } }));
      const eR = new Chart(cR, opt(440, 630, { x: { min: -7, max: 7, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$f$ (kHz)', lpos: 'end' } }));
      for (const c of [eW, eR]) c.add(new Curve({ pts: rectPts, w: 3.4 }));
      eW.add(new Area({ pts: [[1, 2], [2, 2]], fill: 'rgba(192,57,43,.55)', vis: st.only('erro'), ra: 1, rb: 2 }));
      eW.add(new Label({ x: 0, y: 3.6, html: `$${sciT(Pb1)}\\ \\mathrm{V^2}$ ✗`, size: 26, color: C.red, weight: 700, bg: true, vis: st.only('erro'), delay: 500 }));
      eW.add(new Label({ x: -1.5, y: 1, html: 'imagem<br>esquecida', size: 18, color: C.red, vis: st.only('erro'), delay: 700 }));
      eR.add(new Area({ pts: [[-2, 2], [-1, 2]], fill: 'rgba(227,162,59,.85)', vis: st.only('erro'), ra: -2, rb: -1, delay: 300 }));
      eR.add(new Area({ pts: [[1, 2], [2, 2]], fill: 'rgba(227,162,59,.85)', vis: st.only('erro'), ra: 1, rb: 2, delay: 300 }));
      eR.add(new Label({ x: 0, y: 3.6, html: `$${sciT(Pb)}\\ \\mathrm{V^2}$ ✓`, size: 26, color: C.petro, weight: 700, bg: true, vis: st.only('erro'), delay: 800 }));
      /* interpretação: largura do passa-faixa */
      const S = { d: 1 };
      const ci = chartCard(lp.map.interp, 'Passa-faixa ideal de $1$ a $1+\\Delta$ kHz (e a imagem negativa)');
      const iC = new Chart(ci, opt(904, 540));
      iC.add(new Area({ pts: [[-5, 2], [5, 2]], fill: C.goldF2 }));
      iC.add(new Curve({ pts: rectPts, w: 3.6 }));
      for (const s of [1, -1]) iC.add(new Area({ f: () => 2, a: () => s > 0 ? 1 : -1 - S.d, b: () => s > 0 ? 1 + S.d : -1, fill: 'rgba(227,162,59,.85)', n: 4 }));
      iC.add(new Label({ x: 0, y: 3.6, html: () => `fração $=\\dfrac{2\\cdot${sciT(S0)}\\cdot${tnum(S.d, 2)}\\times10^3}{${sciT(P)}}=${tnum(100 * 2 * S0 * S.d * 1e3 / P, 0)}\\%$`, size: 23, bg: true }));
      const ro = Readout(ctx.cards.interp, [['w', 'largura $\\Delta$'], ['pb', 'potência na faixa'], ['fr', 'fração do total', 'g']]);
      const upd = () => { const pb = 2 * S0 * S.d * 1e3; ro.set('w', nf(S.d, 2) + ' kHz'); ro.set('pb', T(sciT(pb, 1) + '\\ \\mathrm{V^2}')); ro.set('fr', nf(100 * pb / P, 0) + ' %'); };
      Slider(ci, { label: 'largura $\\Delta$', min: 0.1, max: 4, step: 0.05, value: 1, fmt: v => nf(v, 2) + ' kHz', oninput: v => { S.d = v; upd(); iC.render(); } });
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          lp.show(kind === 'erro' ? 'erro' : kind === 'interp' ? 'interp' : 'main');
          ch.goto(k, anim); eW.goto(k, anim); eR.goto(k, anim);
        }
      };
    }
  });
})();

/* ---------- Q8.2 · Onde está a potência numa DEP triangular? ---------- */
(() => {
  const rho = b => 1 - Math.pow(1 - b, 2);
  const bh = 0.5, r75 = rho(bh), b90 = 1 - Math.sqrt(0.1);
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'a1', k: 'res', tag: '(a)', road: 3, tex: 'P_X=\\tfrac12\\cdot(\\hl{2B})\\cdot\\hl{S_0}=\\hl{S_0B}', note: 'Área do triângulo: base $2B$, altura $S_0$.' },
    { n: 'r2', k: 'res', road: 4, tex: '\\text{fora de }|f|<b:\\ \\text{2 triângulos de base }\\hl{B-b}\\text{, altura }\\hl{S_0(1-b/B)}', note: 'As “pontas” do triângulo, semelhantes ao todo.' },
    { n: 'r3', k: 'res', road: 4, tex: 'P_{\\text{fora}}=2\\cdot\\tfrac12(B-b)\\,S_0\\Big(1-\\frac bB\\Big)=\\hl{S_0B\\Big(1-\\frac bB\\Big)^2}', note: 'Área das duas pontas.' },
    { n: 'r4', k: 'res', road: 4, tex: '\\rho(b)=\\hl{1-\\Big(1-\\frac bB\\Big)^2}', note: 'Fração dentro: fórmula geral para qualquer $b\\le B$.' },
    { n: 'b1', k: 'res', tag: '(b)', road: 5, tex: `\\rho(B/2)=1-\\big(\\tfrac12\\big)^2=\\hl{${tnum(r75, 2)}}`, note: 'Metade da banda carrega três quartos da potência.' },
    { n: 'c1', k: 'res', tag: '(c)', road: 4, tex: `1-(1-b/B)^2=0{,}9\\Rightarrow 1-b/B=\\hl{\\sqrt{0{,}1}\\approx${tnum(Math.sqrt(0.1), 3)}}`, note: 'Isolamos $b$.' },
    { n: 'c2', k: 'res', road: 5, tex: `b\\approx\\hl{${tnum(b90, 3)}\\,B}`, note: 'Para 90%, basta cerca de 68% da banda.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-2', num: '8.2', level: 1, title: 'Onde está a potência numa DEP triangular?', steps,
    enun: {
      html: 'Ruído de banda base com DEP triangular $S_X(f)=S_0\\big(1-\\frac{|f|}{B}\\big)$ para $|f|<B$ e zero fora. (a) Potência total. (b) Fração da potência em $|f|<B/2$. (c) Largura $b$ tal que $|f|<b$ contém 90% da potência.',
      chips: ['altura $S_0$', 'meia-base $B$', '!90% da potência']
    },
    plano: { html: 'A área de um triângulo dá (a). Para (b) e (c) é mais fácil calcular a potência <b>fora</b> da faixa: o que sobra nas pontas são dois triângulos pequenos, semelhantes ao grande.', road: 4 },
    final: { html: `(a) $P_X=S_0B$.<br>(b) $${tnum(100 * r75, 0)}\\%$.<br>(c) $b\\approx${tnum(b90, 2)}\\,B$.` },
    interp: { boxes: [['interp', 'Numa DEP que cai com $|f|$, as baixas frequências “valem mais”. É por isso que normas de comunicação definem larguras de banda por <b>fração de potência</b> (“banda de 99%”) e não por onde a DEP chega a zero: a última fatia de banda custa muito espectro e quase não carrega potência.', { size: 'sm' }]] },
    notes: {
      fala: 'Truque das pontas: em vez de integrar o miolo, calcule o que sobra fora — dois triângulos semelhantes ao grande, com razão de semelhança $(1-b/B)$. Área escala com o quadrado da razão.',
      pergunta: 'Para levar 90% da potência, preciso de 90% da banda? Mais? Menos?',
      tempo: '6 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main']);
      const card = chartCard(lp.map.main, 'DEP triangular e a fração de potência $\\rho(b)$', { style: { height: '100%', boxSizing: 'border-box' } });
      const row = E('div', { style: { display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '8px' } }); card.append(row);
      const I = st.I;
      const S = { b: 0.4, live: false };
      const Tx = [[-1, '-B'], [-0.5, '-B/2'], [0, '0'], [0.5, 'B/2'], [1, 'B']];
      const T1 = new Chart(row, { w: 530, h: 590, m: { l: 52, r: 16, t: 40, b: 60 }, x: { min: -1.22, max: 1.22, ticks: Tx, label: '$f$', lpos: 'end' }, y: { min: 0, max: 1.25, ticks: [[0, '0'], [0.5, 'S_0/2'], [1, 'S_0']], label: '$S_X(f)$' } });
      const R1 = new Chart(row, { w: 370, h: 590, m: { l: 58, r: 16, t: 40, b: 60 }, x: { min: 0, max: 1, ticks: [[0, '0'], [0.5, 'B/2'], [1, 'B']], label: '$b$', lpos: 'end' }, y: { min: 0, max: 1.08, ticks: [0, 0.25, 0.5, 0.75, 0.9, 1].map(v => [v, nf(v, 2)]), label: '$\\rho(b)$ = fração dentro' } });
      const tri = x => Math.max(0, 1 - Math.abs(x));
      const bFor = k => k >= I('c2') ? b90 : k >= I('b1') ? bh : 0.4;
      const bNow = p => S.live ? S.b : p;
      T1.add(new Area({ f: tri, fill: C.goldF, vis: st.only('a1'), dur: 1000 }));
      T1.add(new Curve({ pts: [[-1.3, 0], [-1, 0], [0, 1], [1, 0], [1.3, 0]], w: 4, vis: k => k >= 0 }));
      T1.add(new Label({ x: 0, y: 0.32, html: 'área $=\\tfrac12\\cdot2B\\cdot S_0=S_0B$', size: 22, bg: true, vis: st.only('a1'), delay: 700 }));
      T1.add(new Bracket({ x0: -1, x1: 1, y: 0.06, html: 'base $2B$', color: C.navy, vis: st.only('a1'), delay: 400 }));
      T1.add(new Custom({
        vis: st.from('r2'), p: bFor, pdur: 1100, draw(c, g, p, mk) {
          const b = bNow(p), tb = tri(b), k = st.name(APP.k);
          SV('path', { d: dPath(c, [[-b, 0], [-b, tb], [0, 1], [b, tb], [b, 0]], true), fill: 'rgba(227,162,59,.55)' }, g);
          for (const s of [1, -1]) SV('path', { d: dPath(c, [[s * b, 0], [s * b, tb], [s * 1, 0]], true), fill: 'rgba(11,37,64,.55)' }, g);
          for (const s of [1, -1]) SV('line', { x1: c.X(s * b), x2: c.X(s * b), y1: c.Y(0), y2: c.Y(1.12), stroke: C.goldD, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, g);
          mk.lab('b').set(c.X(b), c.Y(1.12) - 4, labHTML({ html: Math.abs(b - bh) < 1e-3 ? '$b=B/2$' : Math.abs(b - b90) < 1e-3 ? `$b\\approx${tnum(b90, 3)}B$` : (S.live ? `$b=${tnum(b, 2)}B$` : '$b$'), size: 19, color: C.goldD, bg: true }), 'cb');
          mk.lab('in').set(c.X(0), c.Y(0.2), labHTML({ html: `dentro: $${tnum(100 * rho(b), 0)}\\%$`, size: 21, weight: 600, bg: true }), 'cm');
          if (k === 'r2' || k === 'r3') {
            mk.lab('base').set(c.X((b + 1) / 2), c.Y(0) - 4, labHTML({ html: '$B-b$', size: 17, color: '#fff' }), 'cb');
            mk.lab('alt').set(c.X(b) + 6, c.Y(tb / 2), labHTML({ html: '$S_0(1-b/B)$', size: 17, color: C.navy, bg: true }), 'lm');
          }
          if (k === 'r3' || k === 'r4') mk.lab('fora').set(c.X(-(b + 1) / 2), c.Y(tb) - 8, labHTML({ html: '$P_{\\text{fora}}=S_0B(1-b/B)^2$', size: 17, color: C.navy, bg: true }), 'cb');
        }
      }));
      R1.add(new Curve({ f: rho, w: 4, vis: st.from('r4'), dur: 1100 }));
      R1.add(new Custom({
        vis: st.from('r4'), p: bFor, pdur: 1100, draw(c, g, p, mk) {
          const b = bNow(p), r = rho(b);
          SV('path', { d: `M${c.X(b)} ${c.Y(0)}V${c.Y(r)}H${c.X(0)}`, stroke: C.goldD, 'stroke-width': 2, 'stroke-dasharray': '5 5', fill: 'none' }, g);
          SV('circle', { cx: c.X(b), cy: c.Y(r), r: 9, fill: C.gold, stroke: '#fff', 'stroke-width': 3 }, g);
          mk.lab('v').set(c.X(b) + (b > 0.75 ? -12 : 12), c.Y(r) + 16, labHTML({ html: `$\\rho=${tnum(r, 2)}$`, size: 20, bg: true, color: C.goldD }), b > 0.75 ? 'rt' : 'lt');
        }
      }));
      R1.add(new HLine({ y: 0.9, color: C.red, html: '90%', lx: 0.02, an: 'lb', dx: 0, vis: st.from('c1') }));
      R1.add(new Dot({ x: bh, y: r75, color: C.petro, r: 6, vis: st.from('b1'), html: '75%', dx: -10, dy: -8, an: 'rb', size: 17 }));
      R1.add(new Dot({ x: b90, y: 0.9, color: C.red, r: 6, vis: k => k >= I('c2') && st.name(k) !== 'interp' }));
      const slw = E('div'); card.append(slw);
      const sl = Slider(slw, { label: 'largura $b$', min: 0, max: 1, step: 0.005, value: b90, fmt: v => `${nf(v, 3)} B`, oninput: v => { S.b = v; T1.render(); R1.render(); upd(); } });
      const ro = Readout(ctx.cards.interp, [['b', 'largura $b/B$'], ['in', 'potência dentro', 'g'], ['out', 'potência nas pontas']]);
      const upd = () => { ro.set('b', nf(S.b, 3)); ro.set('in', nf(100 * rho(S.b), 1) + ' %'); ro.set('out', nf(100 * (1 - rho(S.b)), 1) + ' %'); };
      return {
        goto(k, anim) {
          const live = st.kind(k) === 'interp';
          if (live && !S.live) { S.b = b90; sl.set(b90); }
          S.live = live; slw.style.display = live ? '' : 'none'; upd();
          T1.goto(k, anim); R1.goto(k, anim); T1.render(); R1.render();
        }
      };
    }
  });
})();

/* ---------- Q8.3 · dBm/Hz, W/Hz e nV/√Hz ---------- */
(() => {
  const Gdbm = -170, Bw = 20e6;
  const dB = 10 * Math.log10(Bw);                 /* 73,0 dB */
  const Pdbm = Gdbm + dB;                          /* −97 dBm */
  const PmW = Math.pow(10, Pdbm / 10), PW = PmW * 1e-3;
  const GW = Math.pow(10, Gdbm / 10) * 1e-3;       /* 1e-20 W/Hz */
  const N02 = GW / 2;
  const en = 10e-9, GV = en * en;                  /* 1e-16 V²/Hz */
  const f1 = 20, f2 = 20e3, PV = GV * (f2 - f1), Vr = Math.sqrt(PV);
  const Vr4 = en * Math.sqrt(4 * (f2 - f1));
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'a1', k: 'res', tag: '(a)', road: 3, tex: `P=-170+10\\log_{10}(2\\times10^7)=-170+\\hl{${tnum(dB, 1)}}\\approx\\hl{${tnum(Pdbm, 0)}\\ \\mathrm{dBm}}`, note: 'DEP plana: potência = densidade × banda.' },
    { n: 'a2', k: 'res', road: 4, tex: `${tnum(Pdbm, 0)}\\ \\mathrm{dBm}=10^{${tnum(Pdbm / 10, 1)}}\\ \\mathrm{mW}\\approx\\hl{${sciT(PW)}\\ \\mathrm{W}}`, note: '$P[\\mathrm{mW}]=10^{P[\\mathrm{dBm}]/10}$.' },
    { n: 'a3', k: 'res', road: 5, tex: `G=10^{-17}\\ \\mathrm{mW/Hz}=\\hl{${sciT(GW)}}\\ \\mathrm{W/Hz};\\ N_0/2=\\hl{${sciT(N02)}}\\ \\mathrm{W/Hz}`, note: 'A DEP bilateral é metade da unilateral (Eq. 7.12).' },
    { n: 'b1', k: 'res', tag: '(b)', road: 1, tex: `G_V(f)=e_n^2=(10^{-8})^2=\\hl{${sciT(GV)}}\\ \\mathrm{V^2/Hz}`, note: 'Densidade de amplitude ao quadrado = DEP unilateral.' },
    { n: 'b2', k: 'res', road: 3, tex: `P_V=\\int_{20}^{20\\,000}10^{-16}\\,\\dd f\\approx10^{-16}\\cdot2\\times10^4=\\hl{${sciT(PV)}}\\ \\mathrm{V^2}`, note: 'Banda $\\approx19{,}98$ kHz $\\approx$ 20 kHz.' },
    { n: 'b3', k: 'res', road: 4, tex: `V_{\\rms}=\\sqrt{${sciT(PV)}}\\approx\\hl{${tnum(Vr * 1e6, 2)}\\ \\mu\\mathrm{V}}`, note: 'Raiz da potência.' },
    { n: 'c1', k: 'res', tag: '(c)', road: 5, tex: 'V_{\\rms}=e_n\\sqrt{\\Delta f}\\Rightarrow\\text{banda }\\times4\\Rightarrow\\hl{\\text{ruído }\\times2}', note: 'O ruído eficaz cresce com a <b>raiz</b> da banda.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-3', num: '8.3', level: 1, title: 'dBm/Hz, W/Hz e nV/√Hz: as unidades do mundo real', steps,
    enun: {
      html: '(a) Wi-Fi: densidade unilateral de $-170$ dBm/Hz num canal de 20 MHz — potência em dBm e W; densidade em W/Hz e $N_0/2$. (b) Amp-op com $e_n=10\\,\\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$ (plana, unilateral): ruído eficaz de 20 Hz a 20 kHz. (c) E com a banda quadruplicada?',
      chips: ['$G=-170$ dBm/Hz', '$\\Delta f=20$ MHz', '$e_n=10\\ \\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$', '!20 Hz – 20 kHz']
    },
    plano: { html: 'Em dB, multiplicar vira somar: $P[\\mathrm{dBm}]=G[\\mathrm{dBm/Hz}]+10\\log_{10}(\\Delta f)$. Em (b), a grandeza $\\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$ é a <b>raiz</b> de uma DEP unilateral: eleva-se ao quadrado, integra-se e tira-se a raiz.', road: [3, 4] },
    final: { html: `(a) $${tnum(Pdbm, 0)}$ dBm $\\approx ${sciT(PW)}$ W; $G=${sciT(GW)}$ W/Hz, $N_0/2=${sciT(N02)}$ W/Hz.<br>(b) $\\approx${tnum(Vr * 1e6, 2)}\\ \\mu$V eficazes.<br>(c) O ruído eficaz dobra ($${tnum(Vr4 * 1e6, 2)}\\ \\mu$V).` },
    interp: { boxes: [['aplic', 'A unidade $\\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$ existe por causa do item (c): como $V_{\\rms}=e_n\\sqrt{\\Delta f}$, o projetista multiplica o número do <i>datasheet</i> pela raiz da banda do seu circuito e obtém o ruído eficaz na hora — eletrocardiógrafo, microfone MEMS, sensor de vibração.', { size: 'sm' }]] },
    notes: {
      fala: 'Três unidades, uma ideia: área sob a DEP é potência. Em dB, a área de um retângulo vira soma; em $\\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$, é preciso elevar ao quadrado antes de integrar.',
      pergunta: 'Se eu quadruplicar a banda de áudio, o ruído eficaz quadruplica?',
      tempo: '7 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const I = st.I;
      const row = E('div', { class: 'hrow', style: { height: '100%' } }); lp.map.main.append(row);
      const ca = chartCard(row, '(a) Wi-Fi: régua de dB', { style: { flex: '1', transition: 'opacity .4s' } });
      const cb = chartCard(row, '(b) e (c) amp-op de áudio', { style: { flex: '1', transition: 'opacity .4s' } });
      /* régua de dB */
      const Ru = new Chart(ca, { w: 430, h: 360, m: { l: 70, r: 16, t: 36, b: 20 }, x: { min: 0, max: 1, ticks: [] }, y: { min: -184, max: -86, ticks: [-180, -170, -160, -150, -140, -130, -120, -110, -100, -90], label: 'dBm (ou dBm/Hz)' }, grid: true });
      Ru.add(new Dot({ x: 0.16, y: Gdbm, color: C.navy, r: 9, html: '$G=-170$ dBm/Hz', dx: 14, dy: 0, an: 'lm', vis: k => k >= 0 }));
      Ru.add(new Custom({
        vis: st.from('a1'), reveal: 'grow', dur: 1100, draw(c, g, p, mk) {
          const y0 = c.Y(Gdbm), y1 = c.Y(lerp(Gdbm, Pdbm, mk.grow)), x = c.X(0.16);
          SV('path', { d: arrowPath(x, y0 - 10, x, y1 + 2, 14), stroke: C.goldD, 'stroke-width': 4, fill: 'none' }, g);
          mk.lab('d').set(x + 14, (y0 + y1) / 2, labHTML({ html: `$+10\\log_{10}(2\\times10^7)$<br>$=+${tnum(dB * mk.grow, 1)}$ dB`, size: 18, color: C.goldD, bg: true }), 'lm');
        }
      }));
      Ru.add(new Dot({ x: 0.16, y: Pdbm, color: C.gold, r: 10, html: `$P\\approx${tnum(Pdbm, 0)}$ dBm`, dx: 14, dy: 0, an: 'lm', vis: st.from('a1'), delay: 1000, size: 21 }));
      Ru.add(new Label({ x: 0.97, y: -116, an: 'rm', html: `$${tnum(Pdbm, 0)}$ dBm $=10^{${tnum(Pdbm / 10, 1)}}$ mW<br>$\\approx${sciT(PW)}$ W`, size: 18, color: C.navy, bg: true, vis: st.from('a2') }));
      const Gm = new Chart(ca, { w: 430, h: 236, m: { l: 92, r: 14, t: 34, b: 46 }, x: { min: -25, max: 25, ticks: [-20, 0, 20], label: '$f$ (MHz)', lpos: 'end' }, y: { min: 0, max: 1.3, ticks: [[0, '0'], [0.5, '5\\!\\times\\!10^{-21}'], [1, '10^{-20}']], label: 'W/Hz' } });
      const F2 = x => Math.abs(x) <= 20 ? 0.5 : 0;
      Gm.add(new Custom({ vis: k => k >= 0, p: k => k >= I('a3') && st.kind(k) !== 'interp' ? 0 : 1, pdur: 1700, draw(c, g, t) { foldDraw(c, g, F2, 20, t, { pos: C.petroF, neg: 'rgba(227,162,59,.5)', negS: C.goldD }); } }));
      Gm.add(new Label({ x: 10, y: 1.18, html: '$G$ unilateral', size: 17, color: C.navy, vis: k => k >= 0 && k < I('a3') }));
      Gm.add(new Label({ x: 0, y: 0.85, html: `$N_0/2=${sciT(N02)}$ (bilateral)`, size: 17, color: C.goldD, bg: true, vis: st.from('a3'), delay: 1500 }));
      /* amp-op */
      const Am = new Chart(cb, {
        w: 430, h: 610, m: { l: 66, r: 16, t: 40, b: 60 }, x: { min: 0, max: 90, ticks: [0, 20, 40, 60, 80], label: '$f$ (kHz)', lpos: 'end' }, y: { min: 0, max: 13, ticks: [0, 5, 10], label: '$e_n(f)$ (nV/√Hz)' },
        dom: k => k >= I('b1') ? { y: [0, 130], yticks: [0, 50, 100], ylabel: '$G_V=e_n^2$ ((nV)²/Hz)' } : { y: [0, 13], yticks: [0, 5, 10], ylabel: '$e_n(f)$ (nV/√Hz)' }
      });
      const bEnd = k => k >= I('c1') ? (f1 + 4 * (f2 - f1)) / 1e3 : f2 / 1e3;
      Am.add(new Area({ f: (x, p) => 100, a: f1 / 1e3, b: p => p, p: bEnd, pdur: 1500, fill: C.goldF, vis: st.from('b2'), ra: 0, rb: 20 }));
      Am.add(new Curve({ f: (x, p) => p, p: k => k >= I('b1') ? 100 : 10, pdelay: 900, pdur: 1000, w: 4, vis: k => k >= 0 }));
      Am.add(new Label({ x: 45, y: () => (APP.k >= I('b1') ? 114 : 11.4), html: () => APP.k >= I('b1') ? '$e_n^2=100\\ \\mathrm{(nV)^2/Hz}=10^{-16}\\ \\mathrm{V^2/Hz}$' : '$e_n=10\\ \\mathrm{nV}/\\sqrt{\\mathrm{Hz}}$ (plana)', size: 17, bg: true, color: C.petro, vis: k => k >= 0 }));
      Am.add(new Label({ x: 10, y: 60, html: `área $\\approx${sciT(PV)}$ V²`, size: 18, bg: true, vis: st.only('b2', 'b3'), delay: 900 }));
      Am.add(new Label({ x: 10, y: 35, html: `$\\sqrt{\\ }\\to${tnum(Vr * 1e6, 2)}\\ \\mu$V`, size: 20, bg: true, color: C.goldD, weight: 600, vis: st.only('b3') }));
      Am.add(new Label({ x: 42, y: 50, html: `banda $\\times4$ → área $\\times4$<br>$\\sqrt{\\ }\\to${tnum(Vr4 * 1e6, 2)}\\ \\mu$V (×2)`, size: 19, bg: true, color: C.goldD, vis: st.from('c1'), delay: 1300 }));
      /* interpretação: banda ×1…×4 */
      const S = { m: 1 };
      const ir = E('div', { class: 'hrow', style: { height: '100%' } }); lp.map.interp.append(ir);
      const ci1 = chartCard(ir, 'DEP de tensão $G_V$ e a banda', { style: { flex: '1.25' } });
      const ci2 = chartCard(ir, 'Ruído eficaz × banda', { style: { flex: '1' } });
      const Ai = new Chart(ci1, { w: 500, h: 520, m: { l: 66, r: 16, t: 40, b: 60 }, x: { min: 0, max: 90, ticks: [0, 20, 40, 60, 80], label: '$f$ (kHz)', lpos: 'end' }, y: { min: 0, max: 130, ticks: [0, 50, 100], label: '$G_V$ ((nV)²/Hz)' } });
      Ai.add(new Area({ f: () => 100, a: f1 / 1e3, b: () => (f1 + S.m * (f2 - f1)) / 1e3, fill: C.goldF, n: 4 }));
      Ai.add(new Curve({ f: () => 100, w: 4 }));
      const Vi = new Chart(ci2, { w: 380, h: 520, m: { l: 62, r: 16, t: 40, b: 60 }, x: { min: 1, max: 4, ticks: [1, 2, 3, 4].map(v => [v, '×' + v]), label: 'banda', lpos: 'end' }, y: { min: 0, max: 3.2, ticks: [0, 1, 2, 3], label: '$V_{\\rms}$ (µV)' } });
      Vi.add(new Curve({ f: m => en * Math.sqrt(m * (f2 - f1)) * 1e6, w: 4 }));
      Vi.add(new Curve({ f: m => m * Vr * 1e6, color: C.red, dash: '7 6', w: 2.4 }));
      Vi.add(new Label({ x: 2.2, y: 3.0, html: 'se fosse linear ✗', size: 17, color: C.red }));
      Vi.add(new Dot({ x: () => S.m, y: () => en * Math.sqrt(S.m * (f2 - f1)) * 1e6, html: () => `$${tnum(en * Math.sqrt(S.m * (f2 - f1)) * 1e6, 2)}\\ \\mu$V`, dx: -12, dy: -10, an: 'rb' }));
      const ro = Readout(ctx.cards.interp, [['df', '$\\Delta f$'], ['pv', '$P_V=e_n^2\\Delta f$'], ['vr', '$V_{\\rms}=e_n\\sqrt{\\Delta f}$', 'g']]);
      const upd = () => { const df = S.m * (f2 - f1); ro.set('df', nf(df / 1e3, 2) + ' kHz'); ro.set('pv', T(sciT(GV * df, 2) + '\\ \\mathrm{V^2}')); ro.set('vr', nf(en * Math.sqrt(df) * 1e6, 2) + ' µV'); };
      Slider(lp.map.interp, { label: 'banda', min: 1, max: 4, step: 0.05, value: 1, fmt: v => '×' + nf(v, 2), oninput: v => { S.m = v; upd(); Ai.render(); Vi.render(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          lp.show(kind === 'interp' ? 'interp' : 'main');
          const ka = kind === 'res' && k <= I('a3'), kb = kind === 'res' && k >= I('b1');
          ca.style.opacity = kb ? .45 : 1; cb.style.opacity = ka ? .45 : 1;
          Ru.goto(k, anim); Gm.goto(k, anim); Am.goto(k, anim);
        }
      };
    }
  });
})();

/* ---------- Q8.4 · Quais funções podem ser a DEP de um processo real? ---------- */
(() => {
  /* ck: estado de D1..D4 ('ok' | 'no' | 'na') */
  const P = [
    { id: 'a', tex: '\\frac{f}{1+f^2}', f: x => x / (1 + x * x), y: [-0.6, 0.6], ok: false, ck: ['ok', 'no', 'no', 'na'], neg: true, mirror: true },
    { id: 'b', tex: 'e^{-|f|}', f: x => Math.exp(-Math.abs(x)), y: [0, 1.12], ok: true, ck: ['ok', 'ok', 'ok', 'ok'], area: integ(x => Math.exp(-Math.abs(x)), -40, 40, 8000), areaTex: '2' },
    { id: 'c', tex: '\\cos(\\pi f/2)', f: x => Math.cos(PI * x / 2), y: [-1.15, 1.15], ok: false, ck: ['ok', 'ok', 'no', 'no'], neg: true },
    { id: 'd', tex: '\\frac{1}{(1+f^2)^2}', f: x => 1 / Math.pow(1 + x * x, 2), y: [0, 1.12], ok: true, ck: ['ok', 'ok', 'ok', 'ok'], area: integ(x => 1 / Math.pow(1 + x * x, 2), -60, 60, 12000), areaTex: '\\pi/2' },
    { id: 'e', tex: '\\delta(f-1)+2\\delta(f+1)', imp: [[1, 1], [-1, 2]], y: [0, 2.5], ok: false, ck: ['ok', 'no', 'ok', 'ok'], mirror: true },
    { id: 'f', tex: '1\\ \\text{para todo } f', f: () => 1, y: [0, 1.5], ok: false, ck: ['ok', 'ok', 'ok', 'no'], inf: true }
  ];
  const rows = [
    { tex: 'S(-f)=\\hl{-S(f)}\\ \\text{e}\\ \\hl{S<0}\\ \\text{para } f<0', note: 'Ímpar e negativa: viola (D2) e (D3). <b>Não.</b>' },
    { tex: `e^{-|f|}\\ge0,\\ \\text{par},\\ \\int e^{-|f|}\\dd f=\\hl{${tnum(P[1].area, 0)}}`, note: 'Passa em tudo. <b>Sim</b>: $R(\\tau)=\\frac{2}{1+4\\pi^2\\tau^2}$, potência 2.' },
    { tex: '\\cos(\\pi f/2)\\hl{<0}\\ \\text{para } 1<|f|<3', note: 'Viola (D3) — e nem tem área finita. <b>Não.</b>' },
    { tex: `(1+f^2)^{-2}\\ge0,\\ \\text{par},\\ \\int(1+f^2)^{-2}\\dd f=\\hl{\\pi/2}`, note: `<b>Sim</b>, com potência $\\pi/2\\approx${tnum(P[3].area, 2)}$.` },
    { tex: '\\text{raias de pesos } \\hl{\\text{diferentes}} \\text{ em } +1 \\text{ e } -1', note: 'Não é par: <b>não</b> para processo real (sim para complexo, $I+\\j Q$).' },
    { tex: 'S\\equiv1:\\ \\text{não negativa e par, mas }\\int S\\,\\dd f=\\hl{\\infty}', note: 'Potência infinita: idealização do ruído branco, útil só com banda finita.' }
  ];
  const steps = [{ n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' }, ...rows.map((r, i) => Object.assign({ n: 'p' + P[i].id, k: 'res', tag: '(' + P[i].id + ')', road: 5 }, r)), { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }];
  Question({
    id: 'q8-4', num: '8.4', level: 1, title: 'Quais funções podem ser a DEP de um processo real?', steps,
    enun: {
      html: 'Diga quais podem ser a DEP de um processo WSS <b>real</b> e justifique: (a) $\\frac{f}{1+f^2}$; (b) $e^{-|f|}$; (c) $\\cos(\\pi f/2)$; (d) $\\frac{1}{(1+f^2)^2}$; (e) $\\delta(f-1)+2\\delta(f+1)$; (f) $S(f)=1$ para todo $f$.',
      chips: ['D1 real', 'D2 par', 'D3 $\\ge0$', 'D4 área finita', '!modo quiz: votem!']
    },
    plano: { html: 'Aplicar o <i>checklist</i> das propriedades (D1)–(D4): real, <b>não negativa</b>, <b>par</b> (processo real) e com <b>área finita</b> (potência finita).', road: 5 },
    final: { html: 'Podem ser DEP de processo real: <b>(b)</b> e <b>(d)</b>. (f) é uma idealização (ruído branco) aceitável apenas quando o sistema posterior limita a banda.' },
    interp: { boxes: [['dica', 'Em prova, o teste mais rápido é o da <b>não negatividade</b>: procure um valor de $f$ em que a função fique negativa. Se existir, a resposta é “não” e a justificativa é física — um filtro estreito centrado ali entregaria <b>potência negativa</b> (Eq. 7.11).', { size: 'sm' }]] },
    notes: {
      fala: 'Antes de revelar, peça a votação “é DEP ou não?” em cada painel (Seção 8.10). Depois, o checklist D1–D4 acende em cada candidata. Termine com o filtro estreito: é ele que transforma “DEP negativa” em absurdo físico.',
      pergunta: 'Painel por painel: é DEP de processo real? Levante a mão para “sim”.',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const I = st.I;
      const grid = E('div', { class: 'g3', style: { gap: '12px' } }); lp.map.main.append(grid);
      const cells = P.map((p, i) => {
        const seal = E('span', { class: 'seal ' + (p.ok ? 'v' : 'x'), text: p.ok ? 'VÁLIDA' : 'INVÁLIDA' });
        const votes = { s: 0, n: 0 };
        const hit = E('span', { class: 'hit' });
        const bS = E('button', { text: 'Sim 0', 'aria-label': 'Votar sim no painel ' + p.id }), bN = E('button', { class: 'n', text: 'Não 0', 'aria-label': 'Votar não no painel ' + p.id });
        bS.onclick = () => { votes.s++; bS.textContent = 'Sim ' + votes.s; }; bN.onclick = () => { votes.n++; bN.textContent = 'Não ' + votes.n; };
        const head = E('h5', null, E('span', { html: `(${p.id}) ` + T(p.tex) }), seal);
        const cell = E('div', { class: 'card pcard q4cell' }, head);
        const c = new Chart(cell, { w: 284, h: 200, m: { l: 46, r: 10, t: 14, b: 36 }, x: { min: -4, max: 4, ticks: [-4, 0, 4], label: '$f$', lpos: 'end' }, y: { min: p.y[0], max: p.y[1], ticks: p.y[0] < 0 ? [p.y[0] < -1 ? -1 : -0.5, 0, p.y[1] > 1 ? 1 : 0.5] : [0, 1, 2].filter(v => v <= p.y[1]) }, xzero: true });
        const ck = E('div', { class: 'ck' }, ['D1 real', 'D2 par', 'D3 ≥ 0', 'D4 área'].map(t => E('span', { text: t })));
        const vt = E('div', { class: 'vote' }, E('span', { style: { fontSize: '13px', color: '#4E6476' }, text: 'É DEP?' }), bS, bN, hit);
        cell.append(ck, vt);
        grid.append(cell);
        const at = I('p' + p.id), rev = k => k >= at && st.kind(k) !== 'interp';
        if (p.f) {
          if (p.neg) c.add(new Area({ f: x => Math.min(0, p.f(x)), fill: 'rgba(192,57,43,.45)', base: 0, vis: rev, delay: 1100 }));
          if (p.area) c.add(new Area({ f: p.f, fill: C.goldF, vis: rev, delay: 1500 }));
          if (p.inf) c.add(new Area({ f: () => 1, a: p => -p, b: p => p, p: k => rev(k) ? 4 : 0, pdur: 1600, pdelay: 1400, fill: C.goldF, vis: rev, reveal: 'fade', n: 4 }));
          c.add(new Curve({ f: p.f, w: 3.4, color: C.ink, vis: k => k >= 0, n: 600 }));
          if (p.mirror) c.add(new Curve({ f: x => p.f(-x), color: C.goldD, dash: '7 6', w: 2.6, vis: rev, delay: 600, reveal: 'fade' }));
          if (p.area) c.add(new Label({ x: 2.3, y: p.y[1] * 0.62, html: `área $=${p.areaTex}$`, size: 18, color: C.goldD, bg: true, vis: rev, delay: 1700 }));
          if (p.inf) c.add(new Label({ x: 0, y: 1.3, html: p2 => `$\\int_{-L}^{L}1\\,\\dd f=2L\\to\\infty$`, size: 18, color: C.red, bg: true, vis: rev, delay: 1800 }));
          if (p.id === 'c') c.add(new Label({ x: 0, y: -0.62, html: '$S<0$', size: 16, color: C.red, weight: 600, bg: true, vis: rev, delay: 1200 }));
          if (p.id === 'a') c.add(new Label({ x: -2, y: 0.35, html: '$S(-f)\\ne S(f)$', size: 16, color: C.goldD, bg: true, vis: rev, delay: 800 }));
        }
        if (p.imp) {
          p.imp.forEach(([x, h]) => c.add(new Impulse({ x, h, color: C.ink, tex: (h === 1 ? '' : h) + '\\delta', size: 17, vis: k => k >= 0 })));
          c.add(new Custom({
            vis: rev, delay: 600, draw(cc, g) {
              p.imp.forEach(([x, h]) => { const X = cc.X(-x); SV('path', { d: arrowPath(X + 8, cc.Y(0), X + 8, cc.Y(h), 10), stroke: C.goldD, 'stroke-width': 2.4, 'stroke-dasharray': '6 5', fill: 'none' }, g); });
            }
          }));
          c.add(new Label({ x: 2.6, y: 2.2, html: 'espelho ≠ original', size: 16, color: C.goldD, bg: true, vis: rev, delay: 900 }));
        }
        return { p, c, cell, ck, seal, hit, votes, at };
      });
      /* interpretação: filtro estreito sobre cos(πf/2) */
      const S = { f0: 2 };
      const ci = chartCard(lp.map.interp, 'Filtro estreito centrado em $\\pm f_0$ sobre a candidata (c) $\\cos(\\pi f/2)$');
      const iC = new Chart(ci, { w: 904, h: 520, x: { min: -4, max: 4, ticks: [-4, -3, -2, -1, 0, 1, 2, 3, 4], label: '$f$', lpos: 'end' }, y: { min: -1.2, max: 1.3, ticks: [-1, -0.5, 0, 0.5, 1], label: '$S(f)$' }, xzero: true });
      const Fc = x => Math.cos(PI * x / 2), hw = 0.1;
      const Pf = f0 => 2 * integ(Fc, f0 - hw, f0 + hw, 200);
      iC.add(new Area({ f: x => Math.min(0, Fc(x)), fill: 'rgba(192,57,43,.25)', base: 0 }));
      iC.add(new Curve({ f: Fc, w: 3.6, color: C.ink }));
      for (const s of [1, -1]) iC.add(new Area({ f: Fc, a: () => s * S.f0 - hw, b: () => s * S.f0 + hw, fill: () => Pf(S.f0) < 0 ? 'rgba(192,57,43,.85)' : 'rgba(227,162,59,.9)', n: 30 }));
      for (const s of [1, -1]) iC.add(new Custom({ draw(c, g) { const x0 = s * S.f0 - hw, x1 = s * S.f0 + hw; SV('path', { d: dPath(c, [[x0, -1.2], [x0, 1.15], [x1, 1.15], [x1, -1.2]]), stroke: C.navy, 'stroke-width': 2, 'stroke-dasharray': '6 5', fill: 'none' }, g); } }));
      iC.add(new Label({ x: 0, y: 1.2, html: () => { const v = Pf(S.f0); return `$P_Y=\\int|H|^2S\\,\\dd f\\approx${tnum(v, 3)}$ ${v < 0 ? '<b style="color:#C0392B">— potência negativa: impossível!</b>' : ''}`; }, size: 21, bg: true }));
      const ro = Readout(ctx.cards.interp, [['f0', '$f_0$ (centro do filtro)'], ['p', 'potência entregue', 'g']]);
      const upd = () => { const v = Pf(S.f0); ro.set('f0', nf(S.f0, 2)); ro.set('p', `<span style="color:${v < 0 ? '#FF8A7A' : '#E3A23B'}">${nf(v, 3)}${v < 0 ? ' (absurdo)' : ''}</span>`); };
      Slider(ci, { label: 'centro $f_0$', min: 0.1, max: 3.9, step: 0.01, value: 2, fmt: v => nf(v, 2), oninput: v => { S.f0 = v; upd(); iC.render(); } });
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          lp.show(kind === 'interp' ? 'interp' : 'main');
          cells.forEach(cl => {
            const done = k >= cl.at && kind !== 'interp', now = k === cl.at;
            cl.cell.classList.toggle('focus', now);
            cl.cell.classList.toggle('dim', kind === 'res' && !now && !done);
            [...cl.ck.children].forEach((s, j) => {
              s.className = done ? cl.p.ck[j] : '';
              s.style.transitionDelay = now && anim ? (j * 0.45) + 's' : '0s';
            });
            cl.seal.classList.toggle('on', done);
            cl.seal.style.transitionDelay = now && anim ? '2s' : '0s';
            const tot = cl.votes.s + cl.votes.n;
            if (done && tot) { const said = cl.votes.s > cl.votes.n; const okk = said === cl.p.ok; cl.hit.textContent = okk ? 'turma ✓' : 'turma ✗'; cl.hit.className = 'hit' + (okk ? '' : ' bad'); }
            else { cl.hit.textContent = ''; }
            cl.c.goto(k, anim);
          });
        }
      };
    }
  });
})();

/* questões das próximas partes (aparecem no menu como “em breve”) */
[
  [2, '8.5', 'Média móvel de duas amostras'], [2, '8.6', 'Exponencial → lorentziana'], [2, '8.7', 'Triângulo → sinc²'], [2, '8.8', 'AR(1): sensor com memória'], [2, '8.9', 'Três personagens'],
  [3, '8.10', 'Ruído de banda limitada'], [3, '8.11', 'O datasheet do MEMS'], [3, '8.12', 'O mistério do pulso retangular'], [3, '8.13', 'Memória × banda'],
  [4, '8.14', 'Ruído térmico'], [4, '8.15', 'Filtro RC'], [4, '8.16', 'Johnson–Nyquist e kT/C'], [4, '8.17', 'Média de M amostras'],
  [5, '8.18', 'Sinal NRZ'], [5, '8.19', 'Langevin'], [5, '8.20', 'Largura de linha do laser']
].forEach(([lv, num, title]) => SOON.push({ group: 'n' + lv, num, title, msg: `A Questão ${num} entra na Parte ${lv === 5 ? 5 : lv}.` }));


/* =====================================================================
   NÍVEL 2 — WIENER–KHINCHIN DIRETO: DE R_X PARA S_X (Q8.5 a Q8.9)
   ===================================================================== */
const W_TICKS = [[-PI, '-\\pi'], [-PI / 2, '-\\tfrac{\\pi}{2}'], [0, '0'], [PI / 2, '\\tfrac{\\pi}{2}'], [PI, '\\pi']];
/* linha com dois cartões de gráfico (tempo à esquerda, frequência à direita) ligados por uma seta */
function TFRow(parent, cols, tTitle, fTitle, arrow = '$\\mathcal F\\{\\cdot\\}$', style, inv) {
  const row = E('div', { style: Object.assign({ display: 'grid', gridTemplateColumns: cols, gap: '4px' }, style || {}) });
  parent.append(row);
  const t = chartCard(row, tTitle);
  row.append(inv ? FArrow(null, arrow) : FArrow(arrow));
  const f = chartCard(row, fTitle);
  return { row, t, f };
}

/* ---------- Q8.5 · Média móvel de duas amostras ---------- */
(() => {
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'a1', k: 'res', tag: '(a)', road: 1, tex: 'R_X[k]=E\\big[(W[n+k]+W[n+k-1])\\,(W[n]+W[n-1])\\big]', note: 'Definição, com processo real.' },
    { n: 'a2', k: 'res', road: 4, tex: '=\\hl{R_W[k]+R_W[k-1]+R_W[k+1]+R_W[k]}=2\\sigma^2\\delta[k]+\\sigma^2\\delta[k-1]+\\sigma^2\\delta[k+1]', note: 'Cada termo vale $\\sigma^2$ só quando os índices coincidem.' },
    { n: 'a3', k: 'res', road: 5, tex: 'R_X[0]=\\hl{2\\sigma^2},\\ R_X[\\pm1]=\\hl{\\sigma^2},\\ R_X[k]=0\\ \\text{para }|k|\\ge2', note: 'Memória de exatamente uma amostra.' },
    { n: 'b1', k: 'res', tag: '(b)', road: 3, tex: 'S_X(e^{\\j\\omega})=2\\sigma^2+\\sigma^2e^{-\\j\\omega}+\\sigma^2e^{\\j\\omega}=\\hl{2\\sigma^2(1+\\cos\\omega)}', note: 'Eq. (8.3) com três termos; as partes imaginárias se cancelam.' },
    { n: 'b2', k: 'res', road: 5, tex: '=\\hl{4\\sigma^2\\cos^2(\\omega/2)}', note: 'Identidade $1+\\cos\\omega=2\\cos^2(\\omega/2)$: claramente $\\ge0$.' },
    { n: 'c1', k: 'res', tag: '(c)', road: 5, tex: '\\frac{1}{2\\pi}\\int_{-\\pi}^{\\pi}2\\sigma^2(1+\\cos\\omega)\\,\\dd\\omega=\\hl{2\\sigma^2=R_X[0]}', note: 'A integral do cosseno num período é nula.' },
    { n: 'd1', k: 'res', tag: '(d)', road: 4, tex: 'R_D[0]=2\\sigma^2,\\ R_D[\\pm1]=\\hl{-\\sigma^2}\\Rightarrow S_D=\\hl{2\\sigma^2(1-\\cos\\omega)=4\\sigma^2\\,\\mathrm{sen}^2(\\omega/2)}', note: 'Mesma conta, sinais cruzados negativos.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-5', num: '8.5', level: 2, title: 'Média móvel de duas amostras', steps,
    enun: {
      html: '$W[n]$ é ruído branco discreto (média nula, variância $\\sigma^2$) e $X[n]=W[n]+W[n-1]$: soma de duas leituras consecutivas de um sensor. (a) $R_X[k]$. (b) $S_X(e^{\\j\\omega})$ por Wiener–Khinchin. (c) Confira a potência. (d) Repita para $D[n]=W[n]-W[n-1]$.',
      chips: ['$R_W[k]=\\sigma^2\\delta[k]$', '$X[n]=W[n]+W[n-1]$', '!$D[n]=W[n]-W[n-1]$']
    },
    plano: { html: 'A autocorrelação de uma soma de poucas parcelas brancas tem poucos termos não nulos. A transformada discreta de uma sequência com três termos é imediata: $r_0+r_1e^{-\\j\\omega}+r_1e^{\\j\\omega}=r_0+2r_1\\cos\\omega$.', road: 3 },
    final: { html: '$S_X(e^{\\j\\omega})=4\\sigma^2\\cos^2(\\omega/2)$ (passa-baixas, zero em $\\omega=\\pm\\pi$);<br>$S_D(e^{\\j\\omega})=4\\sigma^2\\,\\mathrm{sen}^2(\\omega/2)$ (passa-altas, zero em $\\omega=0$).<br>As duas têm potência $2\\sigma^2$.' },
    interp: {
      boxes: [
        ['interp', 'Somar amostras vizinhas <b>cancela</b> as oscilações rápidas (em $\\omega=\\pi$, amostras alternam de sinal e a soma zera); subtrair cancela o que varia devagar. A memória de uma amostra ($R_X[\\pm1]\\ne0$) deu forma à DEP — sem memória, ela seria plana.', { size: 'xs' }],
        ['aplic', 'A diferença $W[n]-W[n-1]$ é a aproximação digital da <b>derivada</b>: o derivador joga o ruído para as altas frequências, onde o sinal útil não está. É a razão do filtro na ação derivativa dos controladores PID.', { size: 'xs' }]
      ]
    },
    notes: {
      fala: 'Primeira questão com o teorema de fato. O trabalho probabilístico é curto (quatro termos de $R_W$); o resto é somar três exponenciais. Insista na leitura: soma = passa-baixas, diferença = passa-altas, mesma potência.',
      pergunta: 'Se o sensor alterna +1, −1, +1, −1 (frequência $\\omega=\\pi$), o que sai da soma de duas leituras? E da diferença?',
      tempo: '7 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const { I, from, only } = st;
      const r = TFRow(lp.map.main, '300px 50px 1fr', 'Autocorrelação $R[k]$', 'DEP $S(e^{\\j\\omega})$');
      const sT = [[-1, '-\\sigma^2'], [0, '0'], [1, '\\sigma^2'], [2, '2\\sigma^2']];
      const K = new Chart(r.t, { w: 290, h: 320, m: { l: 60, r: 12, t: 22, b: 60 }, x: { min: -3.6, max: 3.6, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$k$', lpos: 'end' }, y: { min: -1.35, max: 2.5, ticks: sT } });
      const Wc = new Chart(r.f, { w: 560, h: 320, m: { l: 62, r: 16, t: 22, b: 60 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$ (rad/amostra)', lpos: 'end' }, y: { min: -1.35, max: 4.6, ticks: [[-1, '-\\sigma^2'], [0, '0'], [1, '\\sigma^2'], [2, '2\\sigma^2'], [4, '4\\sigma^2']] } });
      const cT = chartCard(lp.map.main, 'Trajetórias simuladas ($\\sigma^2=1$, semente fixa)', { style: { marginTop: '12px' } });
      const Tr = new Chart(cT, { w: 904, h: 250, m: { l: 52, r: 14, t: 16, b: 44 }, x: { min: 0, max: 60, ticks: [0, 10, 20, 30, 40, 50, 60], label: '$n$', lpos: 'end' }, y: { min: -4.6, max: 4.6, ticks: [-4, -2, 0, 2, 4] } });
      /* autocorrelações */
      K.add(new Stems({ pts: [[0, 1]], color: C.gray, vis: k => k >= 0 && k <= I('plano') }));
      K.add(new Label({ x: 1.4, y: 1.25, html: '$R_W[k]=\\sigma^2\\delta[k]$<br>(dado)', size: 17, bg: true, vis: k => k >= 0 && k <= I('plano') }));
      [[0, 1, 0, C.petro], [0, 1, 1, C.aquaD], [1, 1, 0, C.goldD], [-1, 1, 0, C.navy]].forEach(([kk, v, b], i) => K.add(new Stems({ pts: [[kk, v, b]], color: [C.petro, C.aquaD, C.goldD, C.navy][i], vis: only('a2'), delay: i * 350 })));
      K.add(new Label({ x: 0.15, y: 2.32, an: 'lm', html: '<span style="color:#146B73">$R_W[k]$</span> + <span style="color:#2E9C94">$R_W[k]$</span>', size: 16, bg: true, vis: only('a2'), delay: 400 }));
      K.add(new Label({ x: 1.1, y: 1.3, an: 'lm', html: '<span style="color:#C7861E">$R_W[k{-}1]$</span>', size: 16, bg: true, vis: only('a2'), delay: 900 }));
      K.add(new Label({ x: -1.1, y: 1.3, an: 'rm', html: '<span style="color:#0B2540">$R_W[k{+}1]$</span>', size: 16, bg: true, vis: only('a2'), delay: 1200 }));
      const off = k => k >= I('d1') ? 0.17 : 0;
      K.add(new Stems({ pts: p => [[-1 - p, 1], [0 - p, 2], [1 - p, 1]], p: off, color: C.petro, op: () => APP.k >= I('d1') && st.kind(APP.k) !== 'final' ? .4 : 1, vis: from('a3') }));
      K.add(new Stems({ pts: [[-3, 0], [-2, 0], [2, 0], [3, 0]], color: C.petro, hollow: true, r: 5, vis: from('a3') }));
      K.add(new Label({ x: 0, y: 2.33, html: '$2\\sigma^2$', size: 17, color: C.petro, vis: only('a3', 'b1', 'b2', 'c1') }));
      K.add(new Label({ x: 2.4, y: 0.5, html: '$0$ para $|k|\\ge2$', size: 15, color: C.ink, bg: true, vis: only('a3') }));
      K.add(new Stems({ pts: [[-1 + 0.17, -1], [0.17, 2], [1 + 0.17, -1]], color: C.goldD, vis: from('d1') }));
      K.add(new Label({ x: 2.3, y: -0.9, html: '$R_D[k]$', size: 17, color: C.goldD, bg: true, vis: from('d1') }));
      K.add(new Label({ x: 2.3, y: 1.7, html: '$R_X[k]$', size: 17, color: C.petro, bg: true, vis: from('d1') }));
      /* DEP */
      const SXf = w => 2 * (1 + Math.cos(w)), SDf = w => 2 * (1 - Math.cos(w));
      Wc.add(new Curve({ f: () => 2, color: C.navy, w: 2.6, dash: '8 6', vis: only('b1') }));
      Wc.add(new Curve({ f: w => Math.cos(w), color: C.goldD, w: 3, vis: only('b1'), delay: 300 }));
      Wc.add(new Curve({ f: w => -Math.sin(w), color: C.goldD, w: 2.2, dash: '5 5', p: k => k >= I('b1') ? 1 : 0, pdelay: 1500, pdur: 700, op: p => 1 - 0.85 * p, vis: only('b1'), delay: 500 }));
      Wc.add(new Curve({ f: w => Math.sin(w), color: C.aquaD, w: 2.2, dash: '5 5', p: k => k >= I('b1') ? 1 : 0, pdelay: 1500, pdur: 700, op: p => 1 - 0.85 * p, vis: only('b1'), delay: 700 }));
      Wc.add(new Label({ x: 3.1, y: 4.5, an: 'rt', html: '<span style="color:#0B2540">┅ $r_0=2\\sigma^2$</span><br><span style="color:#C7861E">━ $\\mathrm{Re}$ de $\\sigma^2e^{\\mp\\j\\omega}$: $\\sigma^2\\cos\\omega$ (×2)</span><br><span style="color:#2E9C94">┅ $\\mathrm{Im}$: $\\mp\\sigma^2\\,\\mathrm{sen}\\,\\omega$ — se cancelam</span>', size: 16, bg: true, vis: only('b1'), delay: 400 }));
      Wc.add(new Curve({ f: SXf, w: 4, vis: k => k >= I('b1'), delay: 1900, dur: 900 }));
      Wc.add(new Dot({ x: 0, y: 4, color: C.petro, html: '$4\\sigma^2$ em $\\omega=0$', dx: 12, dy: 2, an: 'lm', size: 17, vis: only('b2') }));
      Wc.add(new Dot({ x: PI, y: 0, color: C.red, r: 7, vis: only('b2', 'final') }));
      Wc.add(new Dot({ x: -PI, y: 0, color: C.red, r: 7, html: 'zero em $\\pm\\pi$', dx: 12, dy: -8, an: 'lb', size: 17, vis: only('b2') }));
      Wc.add(new Label({ x: 1.95, y: 3.0, html: '$4\\sigma^2\\cos^2(\\omega/2)\\ge0$', size: 19, color: C.petro, bg: true, vis: only('b2') }));
      Wc.add(new Area({ f: SXf, fill: C.goldF, vis: only('c1') }));
      Wc.add(new HLine({ y: 2, color: C.navy, html: 'média em $[-\\pi,\\pi]$: $2\\sigma^2=R_X[0]$', lx: 3.1, dy: -6, vis: only('c1'), delay: 600 }));
      Wc.add(new Curve({ f: SDf, color: C.goldD, w: 4, vis: from('d1') }));
      Wc.add(new Label({ x: 2.25, y: 3.5, html: '$S_D=4\\sigma^2\\mathrm{sen}^2(\\omega/2)$', size: 18, color: C.goldD, bg: true, vis: only('d1'), delay: 600 }));
      Wc.add(new Curve({ f: () => 1, color: C.red, w: 2.4, dash: '8 6', vis: only('final') }));
      Wc.add(new Label({ x: 0, y: -0.75, html: '<span style="color:#146B73">━ soma $X$</span> &nbsp; <span style="color:#C7861E">━ diferença $D$</span> &nbsp; <span style="color:#C0392B">┅ branco $W$</span>', size: 16, bg: true, vis: only('final') }));
      /* trajetórias */
      const w = gseq(85, 62), Xs = [], Ds = [], Ws = [];
      for (let n = 0; n <= 60; n++) { Ws.push([n, w[n + 1]]); Xs.push([n, w[n + 1] + w[n]]); Ds.push([n, w[n + 1] - w[n]]); }
      Tr.add(new Custom({ vis: k => k >= 0, draw(c, g) { seqDraw(c, g, Ws, C.gray, { w: 1.6, r: 2.6, op: APP.k >= I('a1') ? .45 : 1 }); } }));
      Tr.add(new Custom({ vis: from('a1'), reveal: 'draw', draw(c, g) { seqDraw(c, g, Xs, C.petro, { w: 2.6 }); } }));
      Tr.add(new Custom({ vis: from('d1'), reveal: 'draw', draw(c, g) { seqDraw(c, g, Ds, C.goldD, { w: 2.6 }); } }));
      Tr.add(new Label({ x: 59, y: 4.1, an: 'rm', html: () => APP.k >= I('d1') ? '<span style="color:#146B73">$X[n]$ suave</span> · <span style="color:#C7861E">$D[n]$ agitada</span> · <span style="color:#7C8E9B">$W[n]$</span>' : APP.k >= I('a1') ? '<span style="color:#146B73">$X[n]=W[n]+W[n-1]$</span> · <span style="color:#7C8E9B">$W[n]$</span>' : '<span style="color:#7C8E9B">$W[n]$ branco</span>', size: 16, bg: true, vis: k => k >= 0 }));
      /* interpretação: senóide discreta somada ou subtraída da vizinha */
      const S = { w0: PI / 4 };
      const ci = chartCard(lp.map.interp, 'Ganho de potência da soma e da diferença de vizinhas');
      const Fi = new Chart(ci, { w: 904, h: 270, m: { l: 52, r: 16, t: 18, b: 56 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$', lpos: 'end' }, y: { min: 0, max: 4.5, ticks: [0, 1, 2, 3, 4] } });
      Fi.add(new Curve({ f: w => 4 * Math.cos(w / 2) ** 2, w: 3.4 }));
      Fi.add(new Curve({ f: w => 4 * Math.sin(w / 2) ** 2, color: C.goldD, w: 3.4 }));
      Fi.add(new Custom({
        draw(c, g, p, mk) {
          for (const s of [1, -1]) SV('line', { x1: c.X(s * S.w0), x2: c.X(s * S.w0), y1: c.y0, y2: c.y1, stroke: C.navy, 'stroke-width': 1.8, 'stroke-dasharray': '6 5' }, g);
          const a = 4 * Math.cos(S.w0 / 2) ** 2, b = 4 * Math.sin(S.w0 / 2) ** 2;
          SV('circle', { cx: c.X(S.w0), cy: c.Y(a), r: 8, fill: C.petro, stroke: '#fff', 'stroke-width': 3 }, g);
          SV('circle', { cx: c.X(S.w0), cy: c.Y(b), r: 8, fill: C.gold, stroke: '#fff', 'stroke-width': 3 }, g);
          mk.lab('l').set(c.X(-3.05), c.Y(4.2), labHTML({ html: '<span style="color:#146B73">━ soma: $|1+e^{-\\j\\omega}|^2=4\\cos^2(\\omega/2)$</span><br><span style="color:#C7861E">━ diferença: $|1-e^{-\\j\\omega}|^2=4\\,\\mathrm{sen}^2(\\omega/2)$</span>', size: 16, bg: true }), 'lt');
        }
      }));
      const Ti = new Chart(ci, { w: 904, h: 250, m: { l: 52, r: 16, t: 14, b: 48 }, x: { min: 0, max: 24, ticks: [0, 4, 8, 12, 16, 20, 24], label: '$n$', lpos: 'end' }, y: { min: -2.2, max: 2.2, ticks: [-2, -1, 0, 1, 2] } });
      Ti.add(new Custom({
        draw(c, g) {
          const x = n => Math.cos(S.w0 * n), xs = [], ss = [], ds = [];
          for (let n = 0; n <= 24; n++) { xs.push([n, x(n)]); ss.push([n, x(n) + x(n - 1)]); ds.push([n, x(n) - x(n - 1)]); }
          xs.forEach(([n, v]) => { SV('line', { x1: c.X(n), x2: c.X(n), y1: c.Y(0), y2: c.Y(v), stroke: '#A3B1BA', 'stroke-width': 2 }, g); SV('circle', { cx: c.X(n), cy: c.Y(v), r: 4, fill: '#fff', stroke: '#A3B1BA', 'stroke-width': 2 }, g); });
          seqDraw(c, g, ss, C.petro, { w: 2.6 }); seqDraw(c, g, ds, C.goldD, { w: 2.6 });
        }
      }));
      Ti.add(new Label({ x: 23.6, y: 1.95, an: 'rm', html: '<span style="color:#7C8E9B">○ $x[n]=\\cos(\\omega_0n)$</span> · <span style="color:#146B73">$x[n]+x[n-1]$</span> · <span style="color:#C7861E">$x[n]-x[n-1]$</span>', size: 16, bg: true }));
      const ro = Readout(ctx.cards.interp, [['w', '$\\omega_0$'], ['s', 'ganho da soma'], ['d', 'ganho da diferença']]);
      const upd = () => { ro.set('w', nf(S.w0 / PI, 2) + ' π'); ro.set('s', '×' + nf(4 * Math.cos(S.w0 / 2) ** 2, 2)); ro.set('d', '×' + nf(4 * Math.sin(S.w0 / 2) ** 2, 2)); };
      Slider(ci, { label: 'frequência $\\omega_0$', min: 0, max: PI, step: 0.01, value: S.w0, fmt: v => nf(v / PI, 2) + ' π', oninput: v => { S.w0 = v; upd(); Fi.render(); Ti.render(); } });
      upd();
      return {
        goto(k, anim) {
          lp.show(st.kind(k) === 'interp' ? 'interp' : 'main');
          K.goto(k, anim); Wc.goto(k, anim); Tr.goto(k, anim); K.render(); Tr.render();
        }
      };
    }
  });
})();

/* ---------- Q8.6 · Autocorrelação exponencial ⇒ DEP lorentziana ---------- */
(() => {
  const s2 = 1e-6, a = 1e4;                     /* V², s⁻¹ (item d) */
  const f3 = a / (2 * PI), S0 = 2 * s2 / a, mem = 1 / a;
  const SU = 1e-10, TU = 1e-6;                  /* unidades dos eixos */
  const Lf = fk => 2 * a * s2 / (a * a + 4 * PI * PI * (fk * 1e3) ** 2) / SU;
  const ReH = fk => s2 * a / (a * a + (2 * PI * fk * 1e3) ** 2) / SU;
  const ImH = fk => s2 * (2 * PI * fk * 1e3) / (a * a + (2 * PI * fk * 1e3) ** 2) / SU;
  const Rt = tu => Math.exp(-a * Math.abs(tu) * TU);
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', tag: '(a)', road: 3, tex: 'S_X(f)=\\sigma^2\\!\\int_{-\\infty}^{0}\\!\\hl{e^{a\\tau}}e^{-\\j2\\pi f\\tau}\\dd\\tau+\\sigma^2\\!\\int_0^{\\infty}\\!\\hl{e^{-a\\tau}}e^{-\\j2\\pi f\\tau}\\dd\\tau', note: 'Quebramos no zero: $|\\tau|=-\\tau$ à esquerda, $\\tau$ à direita.' },
    { n: 'r2', k: 'res', road: 4, tex: '\\int_0^{\\infty}e^{-(a+\\j2\\pi f)\\tau}\\dd\\tau=\\hl{\\frac{1}{a+\\j2\\pi f}}', note: 'Exponencial que decai (pois $a>0$).' },
    { n: 'r3', k: 'res', road: 4, tex: '\\int_{-\\infty}^{0}e^{(a-\\j2\\pi f)\\tau}\\dd\\tau=\\hl{\\frac{1}{a-\\j2\\pi f}}', note: 'Mesma conta, espelhada.' },
    { n: 'r4', k: 'res', road: 5, tex: 'S_X(f)=\\sigma^2\\Big[\\frac{1}{a-\\j2\\pi f}+\\frac{1}{a+\\j2\\pi f}\\Big]=\\hl{\\frac{2a\\sigma^2}{a^2+4\\pi^2f^2}}', note: 'Denominador comum $a^2+4\\pi^2f^2$. Real, par e positiva.' },
    { n: 'r5', k: 'res', tag: '(b)', road: 4, tex: '\\frac{2a\\sigma^2}{a^2+4\\pi^2f^2}=\\frac12\\cdot\\hl{\\frac{2\\sigma^2}{a}}\\Rightarrow4\\pi^2f^2=a^2', note: '$S_X(0)=2\\sigma^2/a$.' },
    { n: 'r6', k: 'res', road: 5, tex: 'f_{3\\mathrm{dB}}=\\hl{\\frac{a}{2\\pi}}', note: 'A meia potência ocorre onde $2\\pi f=a$.' },
    { n: 'r7', k: 'res', tag: '(c)', road: 5, tex: '\\int\\frac{2a\\sigma^2\\,\\dd f}{a^2+4\\pi^2f^2}=\\frac{\\sigma^2}{\\pi}\\int_{-\\infty}^{\\infty}\\frac{\\dd u}{1+u^2}=\\hl{\\sigma^2}', note: 'Troca $u=2\\pi f/a$; a integral vale $\\pi$.' },
    { n: 'r8', k: 'res', tag: '(d)', road: 5, tex: `f_{3\\mathrm{dB}}=\\tfrac{10^4}{2\\pi}\\approx\\hl{${tnum(f3 / 1e3, 2)}\\ \\mathrm{kHz}};\\ S_X(0)=\\hl{${sciT(S0)}}\\ \\mathrm{V^2/Hz};\\ 1/a=\\hl{${tnum(mem * 1e6, 0)}\\ \\mu\\mathrm{s}}`, note: 'Substituição direta.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-6', num: '8.6', level: 2, title: 'Autocorrelação exponencial ⇒ DEP lorentziana', steps,
    enun: {
      html: 'Ruído WSS com $R_X(\\tau)=\\sigma^2e^{-a|\\tau|}$, $a>0$. (a) $S_X(f)$ pela Eq. (8.1), sem tabela. (b) $f_{3\\mathrm{dB}}$, onde $S_X=S_X(0)/2$. (c) Confira $\\int S_X\\,\\dd f=\\sigma^2$. (d) Com $\\sigma^2=10^{-6}$ V² e $a=10^4$ s⁻¹: $f_{3\\mathrm{dB}}$, $S_X(0)$ e $1/a$.',
      chips: ['$\\sigma^2=10^{-6}$ V²', '$a=10^4$ s⁻¹', '!sem usar a tabela']
    },
    plano: { html: 'O módulo $|\\tau|$ obriga a quebrar a integral em $\\tau<0$ e $\\tau>0$; cada metade é uma exponencial que se integra direto. Depois, somar as duas frações.', road: [3, 4] },
    final: { html: `$S_X(f)=\\dfrac{2a\\sigma^2}{a^2+4\\pi^2f^2}$ (lorentziana), $f_{3\\mathrm{dB}}=a/2\\pi$.<br>Com os números: $f_{3\\mathrm{dB}}\\approx${tnum(f3 / 1e3, 2)}$ kHz, $S_X(0)=${sciT(S0)}$ V²/Hz e memória de $${tnum(mem * 1e6, 0)}\\ \\mu$s.` },
    interp: { boxes: [['interp', 'O produto “memória × banda” é fixo: $\\frac1a\\cdot f_{3\\mathrm{dB}}=\\frac{1}{2\\pi}$. Encurtar a memória por 10 alarga a banda por 10. A lorentziana aparece no ruído após um filtro RC (Q8.15), na velocidade browniana (Q8.19) e no campo de um laser (Q8.20). Para $f\\gg f_{3\\mathrm{dB}}$ decai como $1/f^2$ — a “saia” de 20 dB por década.', { size: 'xs' }]] },
    notes: {
      fala: 'A conta é a mais importante do capítulo: duas exponenciais, duas frações, denominador comum. Mostre que cada metade de $R_X$ gera uma fração complexa e que só a soma é real — as partes imaginárias se cancelam porque $R_X$ é par.',
      pergunta: 'Se o ruído “esquece” dez vezes mais rápido, o que acontece com $f_{3\\mathrm{dB}}$? E com $S_X(0)$?',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const { I, from, only, btw } = st;
      const r = TFRow(lp.map.main, '1fr 50px 1fr', 'Autocorrelação <small>$R_X(\\tau)=\\sigma^2e^{-a|\\tau|}$</small>', 'DEP <small>valores do item (d)</small>');
      const R = new Chart(r.t, { w: 420, h: 610, m: { l: 58, r: 14, t: 40, b: 60 }, x: { min: -400, max: 400, ticks: [-400, -200, 0, 200, 400], label: '$\\tau$ (µs)', lpos: 'end' }, y: { min: 0, max: 1.12, ticks: [0, 0.25, 0.5, 0.75, 1].map(v => [v, nf(v, 2)]), label: '$R_X$ ($\\times10^{-6}$ V²)' } });
      const F = new Chart(r.f, { w: 440, h: 610, m: { l: 58, r: 14, t: 40, b: 60 }, x: { min: -8, max: 8, ticks: [-8, -4, -2, 0, 2, 4, 8], label: '$f$ (kHz)', lpos: 'end' }, y: { min: -0.7, max: 2.35, ticks: [-0.5, 0, 0.5, 1, 1.5, 2], label: '$S_X$ ($\\times10^{-10}$ V²/Hz)' } });
      R.add(new Area({ f: Rt, a: -400, b: 0, fill: 'rgba(95,200,192,.45)', vis: only('r1', 'r2', 'r3', 'r4') }));
      R.add(new Area({ f: Rt, a: 0, b: 400, fill: 'rgba(20,107,115,.38)', vis: only('r1', 'r2', 'r3', 'r4'), delay: 300 }));
      R.add(new Curve({ f: Rt, color: C.navy, w: 3.6, n: 800, vis: k => k >= 0 }));
      R.add(new Label({ x: -200, y: 0.55, html: '$|\\tau|=-\\tau$<br>$\\sigma^2e^{a\\tau}$', size: 18, color: C.aquaD, bg: true, vis: only('r1', 'r3') }));
      R.add(new Label({ x: 200, y: 0.55, html: '$|\\tau|=\\tau$<br>$\\sigma^2e^{-a\\tau}$', size: 18, color: C.petro, bg: true, vis: only('r1', 'r2') }));
      R.add(new Dot({ x: 0, y: 1, color: C.gold, html: '$R_X(0)=\\sigma^2$', dx: 12, dy: 0, an: 'lm', vis: from('r7') }));
      R.add(new Bracket({ x0: 0, x1: mem * 1e6, y: Math.exp(-1), html: `$1/a=${tnum(mem * 1e6, 0)}\\ \\mu$s`, color: C.goldD, vis: from('r8') }));
      /* metades → frações */
      F.add(new Area({ f: ReH, fill: 'rgba(20,107,115,.45)', n: 500, vis: only('r2', 'r3', 'r4') }));
      F.add(new Curve({ f: x => -ImH(x), color: C.petro, w: 2.4, dash: '6 5', n: 500, vis: only('r2', 'r3'), delay: 400 }));
      F.add(new Label({ x: 4.6, y: 0.62, html: '$\\mathrm{Re}\\,\\frac{\\sigma^2}{a+\\j2\\pi f}$', size: 18, color: C.petro, bg: true, vis: only('r2', 'r3') }));
      F.add(new Label({ x: 4.6, y: -0.42, html: '$\\mathrm{Im}$: $-\\frac{2\\pi f\\sigma^2}{a^2+4\\pi^2f^2}$', size: 16, color: C.petro, bg: true, vis: only('r2') }));
      F.add(new Area({ f: x => 2 * ReH(x), base: ReH, fill: 'rgba(95,200,192,.55)', n: 500, vis: only('r3', 'r4') }));
      F.add(new Curve({ f: x => ImH(x), color: C.aquaD, w: 2.4, dash: '6 5', n: 500, vis: only('r3'), delay: 400 }));
      F.add(new Label({ x: -4.6, y: 0.62, html: '$\\mathrm{Re}\\,\\frac{\\sigma^2}{a-\\j2\\pi f}$', size: 18, color: C.aquaD, bg: true, vis: only('r3') }));
      F.add(new Label({ x: 7.8, y: -0.5, an: 'rm', html: 'partes imaginárias:<br>iguais e opostas → zero', size: 15, bg: true, vis: only('r3') }));
      F.add(new Curve({ f: Lf, color: C.navy, w: 4, n: 800, vis: from('r4') }));
      F.add(new Label({ x: 4.2, y: 1.15, html: '$\\frac{2a\\sigma^2}{a^2+4\\pi^2f^2}$<br>real, par, positiva', size: 18, color: C.navy, bg: true, vis: only('r4') }));
      F.add(new Dot({ x: 0, y: Lf(0), color: C.petro, html: '$S_X(0)=2\\sigma^2/a$', dx: 12, dy: -2, an: 'lm', vis: only('r5', 'r6', 'r7') }));
      F.add(new HLine({ y: Lf(0) / 2, color: C.red, dash: '6 5', x0: -8, x1: 8, html: '$S_X(0)/2$', lx: -7.9, an: 'lb', dy: -4, vis: from('r5') }));
      for (const s of [1, -1]) F.add(new VLine({ x: s * f3 / 1e3, y0: 0, y1: Lf(0) / 2, color: C.red, w: 2.4, vis: from('r6'), html: s > 0 ? '$f_{3\\mathrm{dB}}=\\frac{a}{2\\pi}$' : null, an: 'lb', dx: 6, dy: -4, ly: 1.5 }));
      F.add(new Area({ f: Lf, fill: C.goldF, n: 600, vis: only('r7', 'final') }));
      F.add(new Label({ x: 4.6, y: 0.3, html: 'área $=\\sigma^2=R_X(0)$', size: 19, color: C.goldD, bg: true, vis: only('r7', 'final'), delay: 600 }));
      F.add(new Label({ x: 7.8, y: 2.18, an: 'rm', html: `$S_X(0)=${sciT(S0)}$ V²/Hz<br>$f_{3\\mathrm{dB}}\\approx${tnum(f3 / 1e3, 2)}$ kHz`, size: 18, bg: true, vis: from('r8') }));
      /* interpretação: deslizar a */
      const S = { a: 1e4 };
      const ir = TFRow(lp.map.interp, '1fr 50px 1fr', 'Memória', 'Espectro');
      const L2 = (fk, aa) => 2 * aa * s2 / (aa * aa + 4 * PI * PI * (fk * 1e3) ** 2) / SU;
      const Ri = new Chart(ir.t, { w: 420, h: 300, m: { l: 58, r: 14, t: 34, b: 60 }, x: { min: -400, max: 400, ticks: [-400, -200, 0, 200, 400], label: '$\\tau$ (µs)', lpos: 'end' }, y: { min: 0, max: 1.12, ticks: [0, 0.5, 1], label: '$R_X$ ($\\times10^{-6}$ V²)' } });
      const Fi = new Chart(ir.f, { w: 440, h: 300, m: { l: 58, r: 14, t: 34, b: 60 }, x: { min: -8, max: 8, ticks: [-8, -4, 0, 4, 8], label: '$f$ (kHz)', lpos: 'end' }, y: { min: 0, max: 4.4, ticks: [0, 1, 2, 3, 4], label: '$S_X$ ($\\times10^{-10}$ V²/Hz)' } });
      Ri.add(new Curve({ f: Rt, color: '#B9C6CD', w: 2, n: 600 }));
      Ri.add(new Curve({ f: tu => Math.exp(-S.a * Math.abs(tu) * TU), color: C.navy, w: 3.6, n: 800 }));
      Ri.add(new Label({ x: 380, y: 0.9, an: 'rm', html: () => `memória $1/a=${tnum(1e6 / S.a, 0)}\\ \\mu$s`, size: 17, bg: true }));
      Fi.add(new Curve({ f: Lf, color: '#B9C6CD', w: 2, n: 600 }));
      Fi.add(new Area({ f: fk => L2(fk, S.a), fill: C.goldF2, n: 600 }));
      Fi.add(new Curve({ f: fk => L2(fk, S.a), color: C.navy, w: 3.6, n: 800 }));
      Fi.add(new Label({ x: 7.8, y: 3.9, an: 'rm', html: () => `$f_{3\\mathrm{dB}}=${tnum(S.a / (2 * PI) / 1e3, 2)}$ kHz<br>área $=\\sigma^2$ (fixa)`, size: 17, bg: true }));
      const cL = chartCard(lp.map.interp, 'Escala log-log: a “saia” de 20 dB por década', { style: { marginTop: '10px' } });
      const Lg = new Chart(cL, { w: 904, h: 214, m: { l: 62, r: 16, t: 34, b: 44 }, x: { min: 1, max: 6, ticks: [[1, '10'], [2, '10^2'], [3, '10^3'], [4, '10^4'], [5, '10^5'], [6, '10^6']], label: '$f$ (Hz)', lpos: 'end' }, y: { min: -55, max: 5, ticks: [-50, -40, -30, -20, -10, 0], label: '$S_X/S_X(0)$ (dB)' } });
      Lg.add(new Curve({ f: lf => -10 * Math.log10(1 + (2 * PI * Math.pow(10, lf) / S.a) ** 2), color: C.navy, w: 3.4, n: 400 }));
      Lg.add(new Custom({
        draw(c, g, p, mk) {
          const l3 = Math.log10(S.a / (2 * PI));
          SV('line', { x1: c.X(l3), x2: c.X(l3), y1: c.y0, y2: c.y1, stroke: C.red, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, g);
          SV('path', { d: dPath(c, [[l3, 0], [Math.min(6, l3 + 2.6), -20 * Math.min(2.6, 6 - l3)]]), stroke: C.goldD, 'stroke-width': 2.4, 'stroke-dasharray': '8 6', fill: 'none' }, g);
          mk.lab('s').set(c.X(Math.min(5.9, l3 + 1.2)), c.Y(-20 * Math.min(1.2, 5.9 - l3)) - 10, labHTML({ html: '$-20$ dB/década', size: 17, color: C.goldD, bg: true }), 'lb');
        }
      }));
      const ro = Readout(ctx.cards.interp, [['m', 'memória $1/a$'], ['f', '$f_{3\\mathrm{dB}}=a/2\\pi$'], ['p', '$\\frac1a\\cdot f_{3\\mathrm{dB}}$', 'g']]);
      const upd = () => { ro.set('m', nf(1e6 / S.a, 0) + ' µs'); ro.set('f', nf(S.a / (2 * PI) / 1e3, 2) + ' kHz'); ro.set('p', nf((1 / S.a) * S.a / (2 * PI), 3) + ' = 1/2π'); };
      Slider(lp.map.interp, { label: '$a$ (s⁻¹)', min: 3.7, max: 4.6, step: 0.01, log: true, value: 4, fmt: v => T(sciT(v, 2)), oninput: v => { S.a = v; upd(); Ri.render(); Fi.render(); Lg.render(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return { goto(k, anim) { lp.show(st.kind(k) === 'interp' ? 'interp' : 'main'); R.goto(k, anim); F.goto(k, anim); } };
    }
  });
})();

/* ---------- Q8.7 · Autocorrelação triangular ⇒ DEP sinc² ---------- */
(() => {
  const fT0 = 0.75;                                   /* frequência de exemplo para o integrando */
  const integrand = t => (1 - t) * Math.cos(2 * PI * fT0 * t);
  const areaI = integ(integrand, 0, 1, 4000);         /* = sinc²(0,75)/2 */
  const S075 = sinc(fT0) ** 2;
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 3, tex: 'S_X(f)=\\hl{2}\\sigma^2\\int_0^T\\Big(1-\\frac{\\tau}{T}\\Big)\\hl{\\cos(2\\pi f\\tau)}\\,\\dd\\tau', note: '$R_X$ par: a parte em seno é ímpar e integra a zero.' },
    { n: 'r2', k: 'res', road: 4, tex: '\\int_0^T\\!\\Big(1-\\frac{\\tau}{T}\\Big)\\cos\\Omega\\tau\\,\\dd\\tau=\\Big[\\Big(1-\\frac{\\tau}{T}\\Big)\\frac{\\mathrm{sen}\\,\\Omega\\tau}{\\Omega}\\Big]_0^T+\\hl{\\frac1T\\int_0^T\\frac{\\mathrm{sen}\\,\\Omega\\tau}{\\Omega}\\dd\\tau}', note: 'Por partes, com $\\Omega=2\\pi f$.' },
    { n: 'r3', k: 'res', road: 4, tex: '=\\hl{0}+\\frac{1-\\cos\\Omega T}{T\\Omega^2}=\\hl{\\frac{2\\,\\mathrm{sen}^2(\\Omega T/2)}{T\\Omega^2}}', note: 'O termo de fronteira se anula nas duas pontas.' },
    { n: 'r4', k: 'res', road: 4, tex: 'S_X(f)=2\\sigma^2\\cdot\\frac{2\\,\\mathrm{sen}^2(\\pi fT)}{T\\,4\\pi^2f^2}=\\hl{\\sigma^2T\\Big[\\frac{\\mathrm{sen}(\\pi fT)}{\\pi fT}\\Big]^2}', note: 'Substituindo $\\Omega=2\\pi f$ e reorganizando.' },
    { n: 'r5', k: 'res', road: 5, tex: 'S_X(f)=\\hl{\\sigma^2T\\,\\mathrm{sinc}^2(fT)}', note: 'Zeros em $f=k/T$, $k=\\pm1,\\pm2,\\dots$' },
    { n: 'r6', k: 'res', road: 5, tex: '\\text{(D5): }S_X(0)=\\hl{\\sigma^2T}=\\int R_X\\,\\dd\\tau', note: 'A área do triângulo é $\\frac12(2T)\\sigma^2=\\sigma^2T$. Confere.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  const kT = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(k => [k, k === 0 ? '0' : (k < 0 ? '-' : '') + (Math.abs(k) === 1 ? '\\tfrac{1}{T}' : `\\tfrac{${Math.abs(k)}}{T}`)]);
  Question({
    id: 'q8-7', num: '8.7', level: 2, title: 'Autocorrelação triangular ⇒ DEP sinc²', steps,
    enun: {
      html: 'Calcule a DEP de um processo com $R_X(\\tau)=\\sigma^2\\big(1-\\frac{|\\tau|}{T}\\big)$ para $|\\tau|\\le T$ e $R_X(\\tau)=0$ fora. Onde estão os zeros da DEP? Confira a propriedade (D5).',
      chips: ['triângulo de meia-base $T$', 'altura $\\sigma^2$', '!confira (D5)']
    },
    plano: { html: 'Como $R_X$ é real e par, a exponencial pode ser trocada por um cosseno e a integral reduzida a $[0,T]$; depois, integração por partes. (Há um atalho: veja a Dica no fim.)', road: [3, 4] },
    final: { html: '$S_X(f)=\\sigma^2T\\,\\mathrm{sinc}^2(fT)\\ge0$, com zeros em $f=k/T$ ($k\\ne0$) e $S_X(0)=\\sigma^2T$.' },
    interp: { boxes: [['dica', '<b>Atalho pela convolução.</b> O triângulo é a autoconvolução de um pulso retangular: $\\big(1-\\frac{|\\tau|}{T}\\big)_{|\\tau|\\le T}=\\frac1T\\,\\mathrm{rect}(\\tau/T)*\\mathrm{rect}(\\tau/T)$. Convolução no tempo vira produto na frequência e $\\mathrm{rect}(\\tau/T)\\leftrightarrow T\\,\\mathrm{sinc}(fT)$: sai $\\frac1T\\cdot T\\,\\mathrm{sinc}\\cdot T\\,\\mathrm{sinc}=T\\,\\mathrm{sinc}^2(fT)$. É a DEP de todo sinal digital NRZ (Q8.18).', { size: 'xs' }]] },
    notes: {
      fala: 'Um processo cuja memória dura exatamente $T$ segundos tem a potência concentrada no lóbulo principal $|f|<1/T$ (Fig. 8.7). No passo do integrando, mostre que a área com sinal vezes $2\\sigma^2$ é exatamente o valor da DEP naquele $f$.',
      pergunta: 'Se a memória dobrar ($T\\to2T$), os zeros da DEP se aproximam ou se afastam da origem?',
      tempo: '7 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const { I, from, only } = st;
      const r = TFRow(lp.map.main, '1fr 50px 1fr', 'Autocorrelação <small>normalizada: $R_X/\\sigma^2$ × $\\tau/T$</small>', 'DEP <small>normalizada: $S_X/\\sigma^2T$ × $fT$</small>');
      const R = new Chart(r.t, { w: 430, h: 600, m: { l: 56, r: 14, t: 34, b: 60 }, x: { min: -2, max: 2, ticks: [[-2, '-2T'], [-1, '-T'], [0, '0'], [1, 'T'], [2, '2T']], label: '$\\tau$', lpos: 'end' }, y: { min: -0.65, max: 1.12, ticks: [[-0.5, '-\\tfrac{\\sigma^2}{2}'], [0, '0'], [0.5, '\\tfrac{\\sigma^2}{2}'], [1, '\\sigma^2']] } });
      const F = new Chart(r.f, { w: 430, h: 600, m: { l: 62, r: 14, t: 34, b: 60 }, x: { min: -4.3, max: 4.3, ticks: kT, label: '$f$', lpos: 'end' }, y: { min: -0.45, max: 1.12, ticks: [[0, '0'], [0.5, '\\tfrac{\\sigma^2T}{2}'], [1, '\\sigma^2T']] } });
      const tri = t => Math.max(0, 1 - Math.abs(t));
      R.add(new Area({ f: tri, a: 0, b: 1, fill: C.petroF, vis: only('r1') }));
      R.add(new Area({ f: tri, a: -1, b: 0, fill: 'rgba(160,175,185,.25)', vis: only('r1') }));
      R.add(new Curve({ pts: [[-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0]], color: C.navy, w: 3.6, vis: k => k >= 0 }));
      R.add(new Label({ x: 0.55, y: 0.75, an: 'lm', html: '$\\times2$: só $[0,T]$', size: 18, color: C.petro, bg: true, vis: only('r1') }));
      R.add(new Label({ x: -1.15, y: 0.75, an: 'cm', html: 'parte em seno:<br>ímpar → 0', size: 16, color: C.mute, bg: true, vis: only('r1') }));
      R.add(new Area({ f: t => Math.max(0, integrand(t)), a: 0, b: 1, fill: 'rgba(227,162,59,.55)', vis: only('r2', 'r3') }));
      R.add(new Area({ f: t => Math.min(0, integrand(t)), a: 0, b: 1, fill: 'rgba(192,57,43,.4)', vis: only('r2', 'r3') }));
      R.add(new Curve({ f: integrand, x0: 0, x1: 1, color: C.goldD, w: 3.2, vis: only('r2', 'r3') }));
      R.add(new Label({ x: 1.05, y: -0.4, an: 'lm', html: `integrando<br>para $fT=${tnum(fT0, 2)}$`, size: 17, color: C.goldD, bg: true, vis: only('r2') }));
      R.add(new Label({ x: 1.05, y: -0.4, an: 'lm', html: `área com sinal<br>$=${tnum(areaI, 3)}\\,T$`, size: 18, color: C.goldD, bg: true, vis: only('r3') }));
      R.add(new Area({ f: tri, fill: C.goldF, vis: only('r6') }));
      R.add(new Label({ x: 0, y: 0.3, html: 'área $=\\tfrac12(2T)\\sigma^2=\\sigma^2T$', size: 19, bg: true, vis: only('r6'), delay: 600 }));
      R.add(new Area({ f: tri, fill: C.navyF, vis: only('final') }));
      F.add(new Dot({ x: fT0, y: S075, color: C.goldD, html: `$2\\sigma^2\\cdot${tnum(areaI, 3)}T=${tnum(S075, 3)}\\,\\sigma^2T$`, dx: -12, dy: -10, an: 'rb', size: 17, vis: only('r3'), delay: 500 }));
      F.add(new Curve({ f: (x, p) => lerp(Math.max(0, 1 - Math.abs(x)), sinc(x) ** 2, p), p: k => k >= I('r4') ? 1 : 0, pdur: 1500, pdelay: 500, color: C.petro, w: 3.8, n: 900, vis: from('r4') }));
      F.add(new Label({ x: 2.4, y: 0.6, html: 'triângulo → $\\mathrm{sinc}^2$', size: 18, color: C.petro, bg: true, vis: only('r4'), delay: 300 }));
      for (let k = -4; k <= 4; k++) if (k) F.add(new Dot({ x: k, y: 0, r: 7, color: C.red, vis: from('r5'), delay: 120 * Math.abs(k) }));
      F.add(new Label({ x: 2.3, y: 0.32, html: 'zeros em $f=k/T$', size: 18, color: C.red, bg: true, vis: from('r5'), delay: 500 }));
      F.add(new Dot({ x: 0, y: 1, color: C.gold, html: '$S_X(0)=\\sigma^2T$', dx: 12, dy: 0, an: 'lm', vis: from('r6') }));
      F.add(new Area({ f: x => sinc(x) ** 2, fill: C.petroF, n: 600, vis: only('final') }));
      F.add(new Label({ x: 0, y: -0.35, html: 'potência concentrada no lóbulo $|f|<1/T$', size: 17, bg: true, vis: only('final') }));
      /* Dica: rect * rect = triângulo; sinc · sinc = sinc² */
      const S = { s: -0.6, T: 1, trace: new Map() };
      const ir = TFRow(lp.map.interp, '1fr 50px 1fr', 'Convolução $\\mathrm{rect}*\\mathrm{rect}$', 'Produto $\\mathrm{sinc}\\cdot\\mathrm{sinc}$');
      const Ci = new Chart(ir.t, { w: 430, h: 470, m: { l: 50, r: 14, t: 34, b: 60 }, x: { min: -3, max: 3, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$\\tau$ (s)', lpos: 'end' }, y: { min: 0, max: 1.6, ticks: [0, 0.5, 1] } });
      Ci.add(new Custom({
        draw(c, g, p, mk) {
          const T = S.T, h = 1, sh = S.s * T;
          const ov0 = Math.max(-T / 2, sh - T / 2), ov1 = Math.min(T / 2, sh + T / 2);
          if (ov1 > ov0) SV('rect', { x: c.X(ov0), y: c.Y(h), width: c.X(ov1) - c.X(ov0), height: c.Y(0) - c.Y(h), fill: 'rgba(227,162,59,.45)' }, g);
          SV('path', { d: dPath(c, [[-T / 2, 0], [-T / 2, h], [T / 2, h], [T / 2, 0]]), stroke: C.navy, 'stroke-width': 3, fill: 'none' }, g);
          SV('path', { d: dPath(c, [[sh - T / 2, 0], [sh - T / 2, h], [sh + T / 2, h], [sh + T / 2, 0]]), stroke: C.goldD, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '8 5' }, g);
          SV('path', { d: dPath(c, [[-T, 0], [0, 1], [T, 0]]), stroke: '#C7D3D9', 'stroke-width': 2, fill: 'none', 'stroke-dasharray': '4 5' }, g);
          const pts = [...S.trace.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => [x, y]);
          if (pts.length > 1) SV('path', { d: dPath(c, pts), stroke: C.petro, 'stroke-width': 4, fill: 'none' }, g);
          const v = Math.max(0, ov1 - ov0) / T;
          SV('circle', { cx: c.X(sh), cy: c.Y(v), r: 8, fill: C.petro, stroke: '#fff', 'stroke-width': 3 }, g);
          mk.lab('v').set(c.X(-2.9), c.Y(1.5), labHTML({ html: `deslocamento $${tnum(sh, 2)}$ s<br>sobreposição$/T=${tnum(v, 2)}$`, size: 17, bg: true }), 'lt');
        }
      }));
      const Fi = new Chart(ir.f, { w: 430, h: 470, m: { l: 50, r: 14, t: 34, b: 60 }, x: { min: -4, max: 4, ticks: [-4, -2, 0, 2, 4], label: '$f$ (Hz)', lpos: 'end' }, y: { min: -0.6, max: 2.2, ticks: [0, 1, 2] } });
      Fi.add(new Curve({ f: x => S.T * sinc(x * S.T), color: C.navy, w: 2.4, dash: '7 5', n: 800 }));
      Fi.add(new Area({ f: x => S.T * sinc(x * S.T) ** 2, fill: C.petroF, n: 600 }));
      Fi.add(new Curve({ f: x => S.T * sinc(x * S.T) ** 2, color: C.petro, w: 3.6, n: 800 }));
      Fi.add(new Custom({ draw(c, g) { for (let k = -8; k <= 8; k++) if (k) { const x = k / S.T; if (Math.abs(x) <= 4) SV('circle', { cx: c.X(x), cy: c.Y(0), r: 6, fill: C.red, stroke: '#fff', 'stroke-width': 2 }, g); } } }));
      Fi.add(new Label({ x: 3.9, y: 2.05, an: 'rm', html: '<span style="color:#0B2540">┅ $T\\,\\mathrm{sinc}(fT)$</span><br><span style="color:#146B73">━ $T\\,\\mathrm{sinc}^2(fT)$</span><br><span style="color:#C0392B">● zeros em $k/T$</span>', size: 16, bg: true }));
      const cc = E('div', { class: 'card', style: { marginTop: '10px', padding: '4px 14px' } }); lp.map.interp.append(cc);
      const redraw = () => { S.trace.set(+S.s.toFixed(2), Math.max(0, 1 - Math.abs(S.s)) * 1); Ci.render(); Fi.render(); };
      const ss = Slider(cc, { label: 'deslocamento (×$T$)', min: -1.5, max: 1.5, step: 0.01, value: S.s, fmt: v => nf(v, 2) + ' T', oninput: v => { S.s = v; redraw(); } });
      let tw = null;
      ss.row.append(E('button', { class: 'btn', text: '▶ deslizar', onclick: () => { if (tw) tw.cancel(); S.trace.clear(); tw = tween(4000, t => { S.s = -1.5 + 3 * t; ss.set(S.s); redraw(); }, { ease: linear }); } }));
      Slider(cc, { label: 'duração $T$', min: 0.5, max: 2, step: 0.01, value: 1, fmt: v => nf(v, 2) + ' s', oninput: v => { S.T = v; S.trace.clear(); redraw(); } });
      const ro = Readout(ctx.cards.interp, [['z', 'primeiro zero $1/T$'], ['h', 'pico $S_X(0)=\\sigma^2T$']]);
      const upd = () => { ro.set('z', nf(1 / S.T, 2) + ' Hz'); ro.set('h', nf(S.T, 2) + ' σ²·s'); };
      cc.querySelectorAll('input').forEach(i => i.addEventListener('input', upd)); upd(); redraw();
      return { goto(k, anim) { lp.show(st.kind(k) === 'interp' ? 'interp' : 'main'); R.goto(k, anim); F.goto(k, anim); }, leave() { if (tw) tw.cancel(); } };
    }
  });
})();

/* ---------- Q8.8 · O sensor com memória: processo AR(1) ---------- */
(() => {
  const A = 0.9;
  const Sar = (w, a) => (1 - a * a) / (1 - 2 * a * Math.cos(w) + a * a);
  const S0 = (1 + A) / (1 - A), Spi = (1 - A) / (1 + A), ratio = S0 / Spi, rdB = 10 * Math.log10(ratio);
  const partial = (w, N, a) => { let s = 1; for (let k = 1; k <= N; k++) s += 2 * Math.pow(a, k) * Math.cos(w * k); return s; };
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 3, tex: 'S_X=\\sigma^2\\Big[\\hl{\\sum_{k=0}^{\\infty}(ae^{-\\j\\omega})^k}+\\hl{\\sum_{k=1}^{\\infty}(ae^{\\j\\omega})^k}\\Big]', note: 'Eq. (8.3); à esquerda $|k|=-k$.' },
    { n: 'r2', k: 'res', road: 4, tex: '=\\sigma^2\\Big[\\hl{\\frac{1}{1-ae^{-\\j\\omega}}}+\\hl{\\frac{ae^{\\j\\omega}}{1-ae^{\\j\\omega}}}\\Big]', note: 'Séries geométricas, convergentes porque $|a|<1$.' },
    { n: 'r3', k: 'res', road: 4, tex: '\\text{numerador: }(1-ae^{\\j\\omega})+ae^{\\j\\omega}(1-ae^{-\\j\\omega})=\\hl{1-a^2}', note: 'Os termos $\\pm ae^{\\j\\omega}$ se cancelam.' },
    { n: 'r4', k: 'res', road: 4, tex: '\\text{denominador: }(1-ae^{-\\j\\omega})(1-ae^{\\j\\omega})=\\hl{1-2a\\cos\\omega+a^2}', note: '$e^{\\j\\omega}+e^{-\\j\\omega}=2\\cos\\omega$.' },
    { n: 'r5', k: 'res', tag: '(a)', road: 5, tex: 'S_X(e^{\\j\\omega})=\\hl{\\frac{\\sigma^2(1-a^2)}{1-2a\\cos\\omega+a^2}}', note: 'Real, par e positiva para todo $|a|<1$.' },
    { n: 'r6', k: 'res', tag: '(b)', road: 5, tex: `S_X(e^{\\j0})=\\sigma^2\\frac{1+a}{1-a}=\\hl{${tnum(S0, 0)}\\sigma^2};\\ S_X(e^{\\j\\pi})=\\sigma^2\\frac{1-a}{1+a}\\approx\\hl{${tnum(Spi, 3)}\\sigma^2}`, note: `Razão de ${nf(ratio, 0)} vezes ($\\approx${tnum(rdB, 1)}$ dB) entre DC e Nyquist.` },
    { n: 'r7', k: 'res', tag: '(c)', road: 5, tex: `a=-0{,}9:\\ S_X(e^{\\j0})\\approx\\hl{${tnum(Spi, 3)}\\sigma^2},\\ S_X(e^{\\j\\pi})=\\hl{${tnum(S0, 0)}\\sigma^2}`, note: 'Os valores se invertem: amostras alternam de sinal ⇒ passa-altas.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-8', num: '8.8', level: 2, title: 'O sensor com memória: processo AR(1)', steps,
    enun: {
      html: 'Um sensor de temperatura de um nó IoT é amostrado a cada segundo. As leituras (sem offset) formam um processo WSS com $R_X[k]=\\sigma^2a^{|k|}$, $|a|<1$. (a) Obtenha $S_X(e^{\\j\\omega})$. (b) Para $a=0{,}9$, compare $S_X$ em $\\omega=0$ e $\\omega=\\pi$. (c) E com $a=-0{,}9$?',
      chips: ['$R_X[k]=\\sigma^2a^{|k|}$', '$|a|<1$', '!$a=0{,}9$ e $a=-0{,}9$']
    },
    plano: { html: 'A soma de Wiener–Khinchin é uma <b>série geométrica</b> dos dois lados de $k=0$. Separe $k\\ge0$ e $k<0$, some cada série e junte com denominador comum.', road: [3, 4] },
    final: { html: `$S_X(e^{\\j\\omega})=\\dfrac{\\sigma^2(1-a^2)}{1-2a\\cos\\omega+a^2}$. Com $a=0{,}9$, a DEP é ${nf(ratio, 0)} vezes maior em DC do que em $\\omega=\\pi$ (passa-baixas); com $a=-0{,}9$ ocorre o inverso. Com $a=0$, recupera-se o ruído branco $S_X=\\sigma^2$.` },
    interp: { boxes: [['aplic', 'O AR(1) é o modelo mais simples de “ruído com memória” em sistemas amostrados: temperatura de um transformador, carga de uma bateria, desvio de um oscilador. Com $a=0{,}9$, quase toda a variabilidade está em baixas frequências — onde também está a tendência que se quer medir. Por isso promediar ajuda menos do que a regra $1/\\sqrt M$ sugere (Q8.17).', { size: 'xs' }]] },
    notes: {
      fala: 'Mostre a convergência: com poucos termos a soma de Wiener–Khinchin oscila em volta da fórmula fechada; com 20 a 25 termos já cola. Depois passe para dB — sem o log, o valor de 0,053σ² em $\\omega=\\pi$ some no gráfico.',
      pergunta: 'Um sensor de temperatura lento tem $a$ perto de +1 ou de −1? Onde fica a potência dele?',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const { I, from, only } = st;
      const SS = { forceDb: null };
      const r = TFRow(lp.map.main, '330px 50px 1fr', 'Autocorrelação $R_X[k]$', 'DEP $S_X(e^{\\j\\omega})$');
      const K = new Chart(r.t, { w: 320, h: 590, m: { l: 56, r: 12, t: 34, b: 60 }, x: { min: -12.6, max: 12.6, ticks: [-12, -6, 0, 6, 12], label: '$k$', lpos: 'end' }, y: { min: -1.05, max: 1.12, ticks: [[-1, '-\\sigma^2'], [0, '0'], [1, '\\sigma^2']] } });
      const dbDef = k => k >= I('r6');
      const F = new Chart(r.f, {
        w: 520, h: 590, m: { l: 70, r: 16, t: 34, b: 60 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$ (rad/amostra)', lpos: 'end' },
        y: { min: -3.5, max: 21, ticks: [[0, '0'], [5, '5\\sigma^2'], [10, '10\\sigma^2'], [15, '15\\sigma^2'], [19, '19\\sigma^2']], db: false, dmin: -20, dmax: 16, dticks: [-20, -15, -10, -5, 0, 5, 10, 15], dlabel: '$S_X/\\sigma^2$ (dB)' },
        dom: k => ({ db: SS.forceDb != null ? SS.forceDb : dbDef(k) })
      });
      const pts = (a, sgn) => { const o = []; for (let k = -12; k <= 12; k++) if (sgn === 0 || (sgn > 0 ? k >= 0 : k < 0)) o.push([k, Math.pow(a, Math.abs(k)) * (a < 0 && Math.abs(k) % 2 ? -1 : 1) * (a < 0 ? 1 : 1)]); return o; };
      const ak = k => k === I('r7') ? -A : A;
      const rk = (a, k) => Math.sign(a) ** Math.abs(k) * Math.pow(Math.abs(a), Math.abs(k));
      K.add(new Stems({ pts: p => { const o = []; for (let k = -12; k <= 12; k++) o.push([k, rk(p, k)]); return o; }, p: ak, pdur: 1600, color: C.navy, r: 4.5, w: 2.4, vis: k => k >= 0 && !(k >= I('r1') && k <= I('r2')) }));
      K.add(new Stems({ pts: pts(A, 1), color: C.petro, r: 4.5, w: 2.4, vis: only('r1', 'r2') }));
      K.add(new Stems({ pts: pts(A, -1), color: C.aquaD, r: 4.5, w: 2.4, vis: only('r1', 'r2'), delay: 300 }));
      K.add(new Label({ x: 6.4, y: 0.75, html: '$k\\ge0$:<br>$\\sum(ae^{-\\j\\omega})^k$', size: 16, color: C.petro, bg: true, vis: only('r1') }));
      K.add(new Label({ x: -6.4, y: 0.75, html: '$k<0$:<br>$\\sum(ae^{\\j\\omega})^k$', size: 16, color: C.aquaD, bg: true, vis: only('r1') }));
      K.add(new Custom({ vis: only('r2'), p: k => k === I('r2') ? 25 : 0, pdur: 3600, pease: linear, draw(c, g, p) { const N = Math.floor(p); for (let k = -Math.min(N, 12); k <= Math.min(N, 12); k++) SV('circle', { cx: c.X(k), cy: c.Y(Math.pow(A, Math.abs(k))), r: 9, fill: 'none', stroke: C.gold, 'stroke-width': 2.6 }, g); } }));
      K.add(new Label({ x: -12, y: -0.93, an: 'lm', html: () => APP.k === I('r7') ? '$a=-0{,}9$: sinais alternam' : '$a=0{,}9$', size: 17, bg: true, vis: k => k >= 0 }));
      /* DEP */
      F.add(new Curve({ f: w => Sar(w, A), color: C.red, w: 2.4, dash: '8 6', n: 800, vis: only('r2') }));
      F.add(new Curve({ f: (w, p) => partial(w, Math.floor(p), A), p: k => k === I('r2') ? 25 : 0, pdur: 3600, pease: linear, color: C.petro, w: 3.2, n: 800, vis: only('r2'), reveal: 'fade' }));
      F.add(new Label({ x: 1.9, y: 15, html: p => `soma parcial $|k|\\le N$, $N=${Math.floor(p)}$<br><span style="color:#C0392B">┅ fórmula fechada</span>`, p: k => k === I('r2') ? 25 : 0, pdur: 3600, pease: linear, size: 17, bg: true, vis: only('r2') }));
      F.add(new HLine({ y: 1 - A * A, color: C.navy, html: `numerador $\\sigma^2(1-a^2)=${tnum(1 - A * A, 2)}\\sigma^2$ (constante)`, lx: 3.1, dy: -6, vis: only('r3', 'r4') }));
      F.add(new Curve({ f: w => 1 - 2 * A * Math.cos(w) + A * A, color: C.goldD, w: 3.2, vis: only('r4') }));
      F.add(new Label({ x: 0, y: 6.5, html: `denominador $1-2a\\cos\\omega+a^2$<br>mínimo $(1-a)^2=${tnum((1 - A) ** 2, 2)}$ em $\\omega=0$`, size: 17, color: C.goldD, bg: true, vis: only('r4') }));
      F.add(new Curve({ f: (w, p) => Sar(w, p), p: ak, pdur: 1600, color: C.petro, w: 4, n: 800, vis: k => k >= I('r5') && k !== I('final') }));
      F.add(new Dot({ x: 0, y: p => Sar(0, p), p: ak, pdur: 1600, color: C.petro, vis: only('r6', 'r7'), html: p => `$${tnum(Sar(0, p), p > 0 ? 0 : 3)}\\sigma^2$ em DC`, dx: 12, dy: -6, an: 'lb', size: 17 }));
      F.add(new Dot({ x: PI * 0.985, y: p => Sar(PI, p), p: ak, pdur: 1600, color: C.goldD, vis: only('r6', 'r7'), html: p => `$${tnum(Sar(PI, p), p > 0 ? 3 : 0)}\\sigma^2$ em $\\pi$`, dx: -12, dy: -6, an: 'rb', size: 17 }));
      F.add(new Custom({
        vis: only('r6'), delay: 700, draw(c, g, p, mk) {
          const x = c.X(1.9), ya = c.Y(S0), yb = c.Y(Spi);
          SV('path', { d: dPath(c, [[0, S0], [1.9, S0]]), stroke: C.petro, 'stroke-dasharray': '4 4', 'stroke-width': 1.6, fill: 'none' }, g);
          SV('path', { d: dPath(c, [[1.9, Spi], [PI, Spi]]), stroke: C.goldD, 'stroke-dasharray': '4 4', 'stroke-width': 1.6, fill: 'none' }, g);
          SV('path', { d: arrowPath(x, yb, x, ya + 2, 12) + arrowPath(x, ya, x, yb - 2, 12), stroke: C.red, 'stroke-width': 2.6, fill: 'none' }, g);
          mk.lab('r').set(x - 10, (ya + yb) / 2, labHTML({ html: `$${tnum(rdB, 1)}$ dB<br>(×${nf(ratio, 0)})`, size: 19, color: C.red, bg: true }), 'rm');
        }
      }));
      const fam = [[0.9, C.navy, 'a=0{,}9'], [0.5, C.aquaD, 'a=0{,}5'], [0, C.red, 'a=0'], [-0.9, C.goldD, 'a=-0{,}9']];
      fam.forEach(([a, col], i) => F.add(new Curve({ f: w => Sar(w, a), color: col, w: 3, dash: a === 0 ? '8 6' : 'none', n: 800, vis: only('final'), delay: i * 250 })));
      F.add(new Label({ x: 0, y: Math.pow(10, -1.78), html: fam.map(([a, col, t]) => `<span style="color:${col}">━ $${t}$</span>`).join(' &nbsp; '), size: 16, bg: true, vis: only('final') }));
      const tg = E('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' } });
      const tb = Toggle(tg, 'escala em dB', false, v => { SS.forceDb = v; F.setDomain({ db: v }, true); }, 'ghost-d');
      r.f.append(tg);
      /* interpretação: deslizar a e ver trajetória */
      const S = { a: 0.9, db: true };
      const ir = TFRow(lp.map.interp, '330px 50px 1fr', '$R_X[k]=\\sigma^2a^{|k|}$', 'DEP (dB)');
      const Ki = new Chart(ir.t, { w: 320, h: 300, m: { l: 56, r: 12, t: 28, b: 56 }, x: { min: -12.6, max: 12.6, ticks: [-12, 0, 12], label: '$k$', lpos: 'end' }, y: { min: -1.05, max: 1.12, ticks: [[-1, '-\\sigma^2'], [0, '0'], [1, '\\sigma^2']] } });
      Ki.add(new Stems({ pts: () => { const o = []; for (let k = -12; k <= 12; k++) o.push([k, rk(S.a, k)]); return o; }, color: C.navy, r: 4, w: 2.2 }));
      const Fi = new Chart(ir.f, { w: 520, h: 300, m: { l: 64, r: 16, t: 28, b: 56 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$', lpos: 'end' }, y: { min: 0, max: 40, db: true, dmin: -18, dmax: 18, dticks: [-15, -10, -5, 0, 5, 10, 15], dlabel: '$S_X/\\sigma^2$ (dB)' } });
      Fi.add(new Curve({ f: () => 1, color: C.red, w: 2, dash: '7 6' }));
      Fi.add(new Curve({ f: w => Sar(w, S.a), color: C.petro, w: 3.8, n: 600 }));
      const cT = chartCard(lp.map.interp, 'Trajetória simulada $X[n]=aX[n-1]+\\sqrt{1-a^2}\\,\\sigma W[n]$ (semente fixa)', { style: { marginTop: '10px' } });
      const Ti = new Chart(cT, { w: 904, h: 200, m: { l: 52, r: 14, t: 12, b: 44 }, x: { min: 0, max: 120, ticks: [0, 20, 40, 60, 80, 100, 120], label: '$n$ (s)', lpos: 'end' }, y: { min: -3.6, max: 3.6, ticks: [-3, 0, 3] } });
      const wn = gseq(808, 122);
      Ti.add(new Custom({ draw(c, g) { const ps = []; let x = wn[0]; for (let n = 0; n <= 120; n++) { if (n) x = S.a * x + Math.sqrt(1 - S.a * S.a) * wn[n]; ps.push([n, x]); } seqDraw(c, g, ps, C.petro, { w: 2.2, r: 2.4 }); } }));
      const ro = Readout(ctx.cards.interp, [['a', '$a$'], ['s0', '$S_X(0)/\\sigma^2$'], ['sp', '$S_X(\\pi)/\\sigma^2$'], ['r', 'razão DC/Nyquist', 'g']]);
      const upd = () => { const s0 = Sar(0, S.a), sp = Sar(PI, S.a); ro.set('a', nf(S.a, 2)); ro.set('s0', nf(s0, s0 < 1 ? 3 : 1)); ro.set('sp', nf(sp, sp < 1 ? 3 : 1)); ro.set('r', nf(10 * Math.log10(s0 / sp), 1) + ' dB'); };
      Slider(lp.map.interp, { label: '$a$', min: -0.95, max: 0.95, step: 0.01, value: 0.9, fmt: v => nf(v, 2), oninput: v => { S.a = v; upd(); Ki.render(); Fi.render(); Ti.render(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return {
        goto(k, anim) { lp.show(st.kind(k) === 'interp' ? 'interp' : 'main'); K.goto(k, anim); F.goto(k, anim); K.render(); tb.set(SS.forceDb != null ? SS.forceDb : dbDef(k)); },
        enter() { SS.forceDb = null; }, leave() { SS.forceDb = null; }
      };
    }
  });
})();

/* ---------- Q8.9 · Uma autocorrelação com três personagens ---------- */
(() => {
  const dc = 4, s2n = 3, aN = 100, A2 = 2, f0 = 60;             /* V², V², s⁻¹, V², Hz */
  const Lz = f => 2 * aN * s2n / (aN * aN + 4 * PI * PI * f * f);  /* V²/Hz */
  const f3 = aN / (2 * PI), P = dc + s2n + A2;
  const frac = integ(Lz, -f3, f3, 4000) / s2n;
  const mX = Math.sqrt(dc), Amp = Math.sqrt(2 * A2);
  const IMP = 0.0165;                                           /* altura gráfica de um impulso de peso 1 */
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 3, tex: '4\\ \\leftrightarrow\\ \\hl{4\\delta(f)}', note: 'Constante ↔ raia DC.' },
    { n: 'r2', k: 'res', road: 3, tex: `3e^{-100|\\tau|}\\ \\leftrightarrow\\ \\frac{2\\cdot100\\cdot3}{100^2+4\\pi^2f^2}=\\hl{\\frac{600}{10^4+4\\pi^2f^2}}`, note: 'Par lorentziano com $a=100$, $\\sigma^2=3$.' },
    { n: 'r3', k: 'res', road: 3, tex: '2\\cos(2\\pi\\cdot60\\,\\tau)\\ \\leftrightarrow\\ \\hl{\\delta(f-60)+\\delta(f+60)}', note: '$120\\pi=2\\pi\\cdot60$; e $\\frac{A^2}{2}=2$ dá $\\frac{A^2}{4}=1$.' },
    { n: 'r4', k: 'res', tag: '(a)', road: 4, tex: 'S_X(f)=\\hl{4\\delta(f)+\\frac{600}{10^4+4\\pi^2f^2}+\\delta(f-60)+\\delta(f+60)}', note: 'Linearidade da transformada.' },
    { n: 'r5', k: 'res', tag: '(b)', road: 5, tex: `P_X=R_X(0)=4+3+2=\\hl{${tnum(P, 0)}\\ \\mathrm{V^2}}`, note: 'Mais rápido que integrar: (D4).' },
    { n: 'r6', k: 'res', tag: '(c)', road: 5, tex: `m_X^2=4\\Rightarrow|m_X|=\\hl{${tnum(mX, 0)}\\ \\mathrm{V}};\\ \\tfrac{A^2}{2}=2\\Rightarrow A=\\hl{${tnum(Amp, 0)}\\ \\mathrm{V}};\\ f_{3\\mathrm{dB}}=\\tfrac{100}{2\\pi}\\approx\\hl{${tnum(f3, 1)}\\ \\mathrm{Hz}}`, note: 'Supondo que a constante venha só do valor médio.' },
    { n: 'erro', k: 'erro' },
    { n: 'r7', k: 'res', tag: '(d)', road: 5, tex: `\\frac13\\int_{-f_{3\\mathrm{dB}}}^{f_{3\\mathrm{dB}}}\\frac{600\\,\\dd f}{10^4+4\\pi^2f^2}=\\frac{2}{\\pi}\\arctan(1)=\\hl{${tnum(frac, 1)}}`, note: 'Troca $u=2\\pi f/100$: $\\frac1\\pi\\int_{-1}^{1}\\frac{\\dd u}{1+u^2}$.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  const Rx = (t, o = {}) => (o.dc === false ? 0 : dc) + s2n * Math.exp(-aN * Math.abs(t)) + (o.hum === false ? 0 : A2 * Math.cos(2 * PI * f0 * t));
  /* barra empilhada de potência */
  function drawBar(c, g, mk, o) {
    const segs = [['DC', dc, C.navy, '#fff', o.dc !== false], ['hum', A2, C.goldD, '#3A2A08', o.hum !== false], ['ruído', s2n, C.petro, '#fff', true]];
    let x = 0; const y0 = c.Y(0.78), y1 = c.Y(0.22);
    segs.forEach(([n, v, col, tc, on], i) => {
      if (!on) { SV('rect', { x: c.X(x), y: y0, width: c.X(x + v) - c.X(x), height: y1 - y0, fill: 'none', stroke: '#B9C6CD', 'stroke-dasharray': '6 5' }, g); mk.lab('s' + i).set(c.X(x + v / 2), (y0 + y1) / 2, labHTML({ html: `${n}: removido`, size: 16, color: '#7C8E9B' }), 'cm'); x += v; return; }
      SV('rect', { x: c.X(x), y: y0, width: c.X(x + v) - c.X(x), height: y1 - y0, fill: col }, g);
      mk.lab('s' + i).set(c.X(x + v / 2), (y0 + y1) / 2, labHTML({ html: `${n} · $${tnum(v, 0)}$ V²`, size: 18, color: tc, weight: 600 }), 'cm');
      if (o.ident) mk.lab('i' + i).set(c.X(x + v / 2), y1 + 6, labHTML({ html: [`$|m_X|=${tnum(mX, 0)}$ V`, `$A=${tnum(Amp, 0)}$ V (60 Hz)`, `$f_{3\\mathrm{dB}}\\approx${tnum(f3, 1)}$ Hz`][i], size: 16, color: col === C.goldD ? C.goldD : col }), 'ct');
      x += v;
    });
    mk.lab('tot').set(c.X(x) + 10, (y0 + y1) / 2, labHTML({ html: `$=${tnum(x - (o.dc === false ? dc : 0) - (o.hum === false ? A2 : 0), 0)}$ V²`, size: 20, weight: 700, color: C.ink }), 'lm');
  }
  Question({
    id: 'q8-9', num: '8.9', level: 2, title: 'Uma autocorrelação com três personagens', steps,
    enun: {
      html: 'Sensor de corrente de efeito Hall perto de um painel elétrico: $R_X(\\tau)=4+3e^{-100|\\tau|}+2\\cos(120\\pi\\tau)$ [V²]. (a) $S_X(f)$. (b) Potência total. (c) Identifique cada parcela: média, amplitude do <i>hum</i>, banda do ruído. (d) Fração da potência do ruído abaixo da sua $f_{3\\mathrm{dB}}$.',
      chips: ['DC: 4', 'ruído: $3e^{-100|\\tau|}$', '!hum: $2\\cos(120\\pi\\tau)$']
    },
    plano: { html: 'Linearidade: cada parcela de $R_X$ é um par da Tabela 8.3. Depois, ler as “assinaturas”: raia em zero (DC), raias em $\\pm60$ Hz (senóide de $120\\pi$ rad/s) e uma lorentziana (ruído com memória).', road: 3 },
    erro: { html: 'Concluir automaticamente “$m_X=\\pm2$ V” a partir da constante 4. Uma constante em $R_X$ também aparece quando o processo tem um <b>offset aleatório</b> (Capítulo 7, Exemplo 3: $R_X=E[C^2]$ com $E[C]$ possivelmente nulo). A autocorrelação sozinha não distingue os dois casos; é preciso informação adicional (por exemplo, ergodicidade na média).' },
    final: { html: `$S_X(f)=4\\delta(f)+\\frac{600}{10^4+4\\pi^2f^2}+\\delta(f\\mp60)$; $P_X=${tnum(P, 0)}$ V²: 4 V² de DC (média de 2 V), 2 V² de <i>hum</i> de 60 Hz (amplitude 2 V) e 3 V² de ruído com $f_{3\\mathrm{dB}}\\approx${tnum(f3, 1)}$ Hz, metade dele abaixo dessa frequência.` },
    interp: { boxes: [['aplic', 'A leitura da DEP vira um plano de condicionamento de sinal: um <b>acoplamento AC</b> remove os 4 V² de DC; um filtro <b>notch</b> em 60 Hz remove os 2 V² do <i>hum</i>; o que resta (3 V²) é ruído genuíno, que só se reduz estreitando a banda. No Brasil a rede é de 60 Hz; em boa parte da Europa, 50 Hz — o notch muda de lugar.', { size: 'xs' }]] },
    notes: {
      fala: 'Três personagens, três assinaturas: raia em zero, lorentziana, raias em ±60 Hz. A potência total sai de graça por (D4): $R_X(0)=9$. Use o erro comum para lembrar que a constante 4 pode vir de um offset aleatório.',
      pergunta: 'Depois de um acoplamento AC e de um notch em 60 Hz, quanta potência sobra? Dá para reduzir mais?',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'erro', 'interp']);
      const { I, from, only } = st;
      const r = TFRow(lp.map.main, '1fr 50px 1fr', 'Autocorrelação em camadas', 'DEP');
      const R = new Chart(r.t, { w: 430, h: 370, m: { l: 50, r: 14, t: 30, b: 60 }, x: { min: -50, max: 50, ticks: [-50, -25, 0, 25, 50], label: '$\\tau$ (ms)', lpos: 'end' }, y: { min: -1.2, max: 9.9, ticks: [0, 2, 4, 6, 9], label: '$R_X$ (V²)' } });
      const F = new Chart(r.f, { w: 430, h: 370, m: { l: 62, r: 14, t: 30, b: 60 }, x: { min: -100, max: 100, ticks: [-100, -60, 0, 60, 100], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 0.078, ticks: [0, 0.02, 0.04, 0.06].map(v => [v, nf(v, 2)]), label: '$S_X$ (V²/Hz)' } });
      const tm = t => t / 1000;
      const dcL = only('r1', 'r2', 'r3', 'r4'), all = from('r1');
      R.add(new Curve({ f: t => Rx(tm(t)), color: C.ink, w: 3, n: 900, vis: k => k >= 0 && k < I('r1') }));
      R.add(new Area({ f: () => dc, base: 0, fill: 'rgba(11,37,64,.55)', vis: all }));
      R.add(new Area({ f: t => dc + s2n * Math.exp(-aN * Math.abs(tm(t))), base: dc, fill: 'rgba(20,107,115,.55)', n: 600, vis: from('r2') }));
      R.add(new Area({ f: t => Rx(tm(t)), base: t => dc + s2n * Math.exp(-aN * Math.abs(tm(t))), fill: 'rgba(227,162,59,.6)', n: 900, vis: from('r3') }));
      R.add(new Curve({ f: t => Rx(tm(t)), color: C.ink, w: 3, n: 900, vis: from('r4') }));
      R.add(new Label({ x: -48, y: 1.2, an: 'lm', html: 'DC: $4$', size: 17, color: '#fff', vis: dcL }));
      R.add(new Label({ x: 20, y: 7.6, an: 'lm', html: '$3e^{-100|\\tau|}$', size: 17, color: C.petro, bg: true, vis: only('r2') }));
      R.add(new Label({ x: 20, y: 7.6, an: 'lm', html: '$2\\cos(120\\pi\\tau)$', size: 17, color: C.goldD, bg: true, vis: only('r3') }));
      R.add(new Dot({ x: 0, y: P, color: C.gold, html: `$R_X(0)=${tnum(P, 0)}$ V²`, dx: 12, dy: 2, an: 'lm', vis: from('r5') }));
      F.add(new Impulse({ x: 0, h: dc * IMP, color: C.navy, tex: '4\\delta(f)', size: 18, vis: all }));
      F.add(new Area({ f: Lz, fill: 'rgba(20,107,115,.3)', n: 600, vis: from('r2') }));
      F.add(new Curve({ f: Lz, color: C.petro, w: 3.4, n: 700, vis: from('r2') }));
      F.add(new Label({ x: 35, y: 0.05, html: '$\\frac{600}{10^4+4\\pi^2f^2}$', size: 18, color: C.petro, bg: true, vis: only('r2', 'r4') }));
      F.add(new Impulse({ x: 60, h: IMP, color: C.goldD, tex: '\\delta(f-60)', size: 17, vis: from('r3') }));
      F.add(new Impulse({ x: -60, h: IMP, color: C.goldD, tex: '\\delta(f+60)', size: 17, vis: from('r3') }));
      for (const s of [1, -1]) F.add(new VLine({ x: s * f3, y0: 0, y1: Lz(f3), color: C.red, w: 2.2, vis: from('r6'), html: s > 0 ? `$f_{3\\mathrm{dB}}\\approx${tnum(f3, 1)}$ Hz` : null, an: 'lb', dx: 4, dy: -2, size: 16 }));
      F.add(new Area({ f: Lz, a: -f3, b: f3, fill: 'rgba(227,162,59,.75)', vis: from('r7'), ra: -f3, rb: f3 }));
      F.add(new Label({ x: -95, y: 0.07, an: 'lm', html: `${nf(100 * frac, 0)}% do ruído<br>($${tnum(frac * s2n, 1)}$ V²) em $|f|<f_{3\\mathrm{dB}}$`, size: 16, color: C.goldD, bg: true, vis: from('r7'), delay: 700 }));
      const cB = chartCard(lp.map.main, 'Potência total $P_X=R_X(0)$', { style: { marginTop: '12px' } });
      const B = new Chart(cB, { w: 904, h: 180, m: { l: 30, r: 90, t: 10, b: 44 }, x: { min: 0, max: 9.2, ticks: [[0, '0'], [2, '2'], [4, '4'], [6, '6'], [9, '9 V²', false]] }, y: { min: 0, max: 1, ticks: [] }, grid: false });
      B.add(new Custom({ vis: from('r5'), reveal: 'draw', dur: 1200, draw(c, g, p, mk) { drawBar(c, g, mk, { ident: APP.k >= I('r6') }); } }));
      /* erro comum: mesma constante 4, dois processos */
      const er = E('div', { class: 'hrow', style: { alignItems: 'flex-start' } }); lp.map.erro.append(er);
      const c1 = chartCard(er, 'Caso 1 · média de 2 V', { style: { flex: '1' } });
      const c2 = chartCard(er, 'Caso 2 · offset aleatório $C=\\pm2$ V', { style: { flex: '1' } });
      const rho = Math.exp(-aN * 1e-3);
      const mkSeq = (seed, off) => { const g = gauss(seed); let x = g() * Math.sqrt(s2n); const o = []; for (let n = 0; n <= 200; n++) { if (n) x = rho * x + Math.sqrt(s2n * (1 - rho * rho)) * g(); o.push([n, off + x]); } return o; };
      const cols = [C.petro, C.navy, C.goldD];
      [[c1, [2, 2, 2]], [c2, [2, -2, 2]]].forEach(([card, offs], j) => {
        const ch = new Chart(card, { w: 440, h: 560, m: { l: 50, r: 14, t: 30, b: 60 }, x: { min: 0, max: 200, ticks: [0, 50, 100, 150, 200], label: '$t$ (ms)', lpos: 'end' }, y: { min: -8, max: 8, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$X(t)$ (V)' } });
        offs.forEach((o, i) => { const sq = mkSeq(100 + 10 * j + i, o); ch.add(new Custom({ vis: only('erro'), reveal: 'draw', delay: i * 300, draw(c, g) { seqDraw(c, g, sq, cols[i], { w: 1.8, dots: false }); } })); });
        ch.add(new Label({ x: 100, y: 7.1, html: j ? '$E[C]=0$, mas $E[C^2]=4$' : '$m_X=2$ V, $m_X^2=4$', size: 18, bg: true, vis: only('erro') }));
        ch.add(new Label({ x: 100, y: -7.1, html: 'nos dois casos: $R_X$ tem a constante $4$', size: 17, color: C.red, bg: true, vis: only('erro'), delay: 800 }));
        ch.add(new HLine({ y: j ? 0 : 2, color: C.red, w: 2.4, dash: '8 6', vis: only('erro'), html: j ? 'média de conjunto 0' : 'média 2 V', lx: 198, dy: -4 }));
        card._ch = ch;
      });
      /* interpretação: acoplamento AC e notch */
      const S = { dc: true, hum: true };
      const ir = TFRow(lp.map.interp, '1fr 50px 1fr', 'Autocorrelação', 'DEP');
      const Ri = new Chart(ir.t, { w: 430, h: 330, m: { l: 50, r: 14, t: 26, b: 60 }, x: { min: -50, max: 50, ticks: [-50, -25, 0, 25, 50], label: '$\\tau$ (ms)', lpos: 'end' }, y: { min: -2.2, max: 9.9, ticks: [0, 2, 4, 6, 9] } });
      Ri.add(new Custom({
        draw(c, g) {
          const o = { dc: S.dc, hum: S.hum }, base = S.dc ? dc : 0;
          if (S.dc) SV('path', { d: dPath(c, [[-50, 0], [-50, dc], [50, dc], [50, 0]], true), fill: 'rgba(11,37,64,.55)' }, g);
          const ex = sample(t => base + s2n * Math.exp(-aN * Math.abs(tm(t))), -50, 50, 400);
          SV('path', { d: dPath(c, [...ex, [50, base], [-50, base]], true), fill: 'rgba(20,107,115,.55)' }, g);
          if (S.hum) { const top = sample(t => Rx(tm(t), o), -50, 50, 600); SV('path', { d: dPath(c, [...top, ...ex.slice().reverse()], true), fill: 'rgba(227,162,59,.6)' }, g); }
          SV('path', { d: dPath(c, sample(t => Rx(tm(t), o), -50, 50, 900)), stroke: C.ink, 'stroke-width': 3, fill: 'none' }, g);
        }
      }));
      const Fi = new Chart(ir.f, { w: 430, h: 330, m: { l: 62, r: 14, t: 26, b: 60 }, x: { min: -100, max: 100, ticks: [-100, -60, 0, 60, 100], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 0.078, ticks: [0, 0.02, 0.04, 0.06].map(v => [v, nf(v, 2)]) } });
      Fi.add(new Area({ f: Lz, fill: 'rgba(20,107,115,.3)', n: 600 }));
      Fi.add(new Curve({ f: Lz, color: C.petro, w: 3.4, n: 700 }));
      Fi.add(new Impulse({ x: 0, h: () => S.dc ? dc * IMP : 0, color: C.navy, tex: '4\\delta(f)', size: 18 }));
      Fi.add(new Impulse({ x: 60, h: () => S.hum ? IMP : 0, color: C.goldD, tex: '\\delta(f-60)', size: 16 }));
      Fi.add(new Impulse({ x: -60, h: () => S.hum ? IMP : 0, color: C.goldD, tex: '\\delta(f+60)', size: 16 }));
      Fi.add(new Custom({ draw(c, g, p, mk) { if (!S.dc) mk.lab('a').set(c.X(0), c.Y(0.03), labHTML({ html: 'DC removido', size: 15, color: C.navy, bg: true }), 'cm'); if (!S.hum) mk.lab('h').set(c.X(60), c.Y(0.025), labHTML({ html: 'notch', size: 15, color: C.goldD, bg: true }), 'cm'); } }));
      const cBi = chartCard(lp.map.interp, 'Potência que sobra', { style: { marginTop: '10px' } });
      const Bi = new Chart(cBi, { w: 904, h: 150, m: { l: 30, r: 90, t: 6, b: 40 }, x: { min: 0, max: 9.2, ticks: [[0, '0'], [2, '2'], [4, '4'], [6, '6'], [9, '9 V²', false]] }, y: { min: 0, max: 1, ticks: [] }, grid: false });
      Bi.add(new Custom({ draw(c, g, p, mk) { drawBar(c, g, mk, { dc: S.dc, hum: S.hum }); } }));
      const tg = E('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' } }); lp.map.interp.append(tg);
      const ro = Readout(ctx.cards.interp, [['p', 'potência que sobra', 'g'], ['v', 'valor eficaz']]);
      const upd = () => { const p = s2n + (S.dc ? dc : 0) + (S.hum ? A2 : 0); ro.set('p', nf(p, 0) + ' V²'); ro.set('v', nf(Math.sqrt(p), 2) + ' V'); Ri.render(); Fi.render(); Bi.render(); };
      Toggle(tg, '⏻ acoplamento AC (remove DC)', false, v => { S.dc = !v; upd(); }, 'ghost');
      Toggle(tg, '⏻ notch em 60 Hz (remove o <i>hum</i>)', false, v => { S.hum = !v; upd(); }, 'ghost');
      upd();
      const erCharts = [c1._ch, c2._ch];
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          lp.show(kind === 'erro' ? 'erro' : kind === 'interp' ? 'interp' : 'main');
          R.goto(k, anim); F.goto(k, anim); B.goto(k, anim); B.render(); erCharts.forEach(c => c.goto(k, anim));
        }
      };
    }
  });
})();

/* =====================================================================
   NÍVEL 3 — CAMINHO INVERSO: DE S_X PARA R_X (Q8.10 a Q8.13)
   ===================================================================== */
const FINV = '$\\mathcal F^{-1}$';

/* ---------- Q8.10 · DEP de banda limitada ---------- */
(() => {
  const t0 = 0.35;                               /* defasagem de exemplo (×1/B) */
  const rho4 = sinc(0.5);                        /* 2/π */
  const Rn = x => sinc(2 * x);                   /* R_X/(2BS0) com x = τ·B */
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', tag: '(a)', road: 3, tex: 'R_X(\\tau)=\\int_{-B}^{B}S_0e^{\\j2\\pi f\\tau}\\dd f=\\hl{S_0\\frac{e^{\\j2\\pi B\\tau}-e^{-\\j2\\pi B\\tau}}{\\j2\\pi\\tau}}', note: 'Eq. (8.2): só a faixa $|f|<B$ contribui.' },
    { n: 'r2', k: 'res', road: 4, tex: '=S_0\\frac{\\mathrm{sen}(2\\pi B\\tau)}{\\pi\\tau}=\\hl{2BS_0\\,\\mathrm{sinc}(2B\\tau)}', note: '$e^{\\j x}-e^{-\\j x}=2\\j\\,\\mathrm{sen}\\,x$; multiplicamos e dividimos por $2B$.' },
    { n: 'r3', k: 'res', road: 5, tex: '\\text{Conferência: }R_X(0)=\\hl{2BS_0}=\\int S_X\\,\\dd f', note: 'Área do retângulo: largura $2B$, altura $S_0$.' },
    { n: 'r4', k: 'res', tag: '(b)', road: 4, tex: '\\mathrm{sinc}(2B\\tau)=0\\iff \\hl{2B\\tau=k},\\ k=\\pm1,\\pm2,\\dots', note: 'Zeros do sinc nos inteiros não nulos.' },
    { n: 'r5', k: 'res', road: 5, tex: '\\tau=\\hl{\\frac{k}{2B}}', note: 'Defasagens múltiplas de $1/(2B)$.' },
    { n: 'r6', k: 'res', tag: '(c)', road: 5, tex: 'f_s=2B:\\ R_X[k]=R_X\\Big(\\frac{k}{2B}\\Big)=\\hl{2BS_0\\,\\delta[k]}', note: 'Todas as defasagens caem nos zeros: sequência <b>branca</b>, variância $2BS_0$.' },
    { n: 'r7', k: 'res', road: 5, tex: `f_s=4B:\\ R_X\\Big(\\frac{1}{4B}\\Big)=2BS_0\\,\\mathrm{sinc}\\big(\\tfrac12\\big)\\approx\\hl{${tnum(rho4, 2)}\\cdot2BS_0}`, note: 'Superamostrando, vizinhas ficam 64% correlacionadas.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-10', num: '8.10', level: 3, title: 'DEP de banda limitada: quando as amostras ficam descorrelacionadas?', steps,
    enun: {
      html: 'Um ruído tem DEP plana $S_X(f)=S_0$ para $|f|<B$ e zero fora (ruído branco depois de um passa-baixas ideal). (a) Obtenha $R_X(\\tau)$. (b) Para quais defasagens $R_X(\\tau)=0$? (c) O processo é amostrado à taxa $f_s$: o que dizer das amostras para $f_s=2B$ e $f_s=4B$?',
      chips: ['$S_X=S_0$ em $|f|<B$', '!$f_s=2B$ e $f_s=4B$']
    },
    plano: { html: 'Integral da exponencial sobre um intervalo simétrico: aparece um seno sobre $\\tau$, isto é, um sinc. Depois, ler os zeros do sinc e compará-los com o período de amostragem $1/f_s$.', road: 3 },
    final: { html: `$R_X(\\tau)=2BS_0\\,\\mathrm{sinc}(2B\\tau)$, nulo em $\\tau=k/(2B)$. Amostrado exatamente na taxa de Nyquist ($f_s=2B$), o ruído vira uma sequência branca de variância $2BS_0$; a $f_s=4B$, amostras vizinhas têm coeficiente de correlação $2/\\pi\\approx${tnum(rho4, 2)}$.` },
    interp: { boxes: [['interp', 'Este é o elo entre Wiener–Khinchin e o <b>Teorema da Amostragem</b>. Um processo de banda $B$ “renova” sua informação a cada $1/(2B)$ segundos — o período de Nyquist. Se o ruído for gaussiano, descorrelação implica independência: as amostras são i.i.d. Quando se superamostra, as amostras deixam de ser independentes — e promediá-las rende menos do que a regra $1/M$ promete (Q8.17).', { size: 'xs' }]] },
    notes: {
      fala: 'Primeiro caminho inverso: da DEP para a autocorrelação pela Eq. (8.2). Cada valor de $R_X(\\tau)$ é a área de $S_0\\cos(2\\pi f\\tau)$ dentro da banda. Os zeros do sinc ficam exatamente no período de Nyquist — por isso amostrar a $2B$ dá amostras brancas.',
      pergunta: 'Se eu amostrar a $3B$, as amostras vizinhas ficam mais ou menos correlacionadas do que a $4B$?',
      tempo: '7 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const { I, from, only } = st;
      const r = TFRow(lp.map.main, '1fr 50px 1fr', 'Autocorrelação <small>$R_X/(2BS_0)$ × $\\tau B$</small>', 'DEP <small>$S_X/S_0$ × $f/B$</small>', FINV, null, true);
      const R = new Chart(r.t, { w: 430, h: 370, m: { l: 58, r: 14, t: 26, b: 60 }, x: { min: -3.3, max: 3.3, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$\\tau\\cdot B$', lpos: 'end' }, y: { min: -0.32, max: 1.15, ticks: [-0.25, 0, 0.25, 0.5, 0.75, 1].map(v => [v, nf(v, 2)]) } });
      const S = new Chart(r.f, { w: 430, h: 370, m: { l: 58, r: 14, t: 26, b: 60 }, x: { min: -2.5, max: 2.5, ticks: [-2, -1, 0, 1, 2], label: '$f/B$', lpos: 'end' }, y: { min: -1.15, max: 1.35, ticks: [-1, -0.5, 0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      const cK = chartCard(lp.map.main, '', { style: { marginTop: '12px' } });
      const ttl = E('div', { class: 'cc-t' }, E('span')); cK.prepend(ttl);
      const K = new Chart(cK, { w: 904, h: 190, m: { l: 58, r: 14, t: 12, b: 44 }, x: { min: -6.6, max: 6.6, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$k$', lpos: 'end' }, y: { min: -0.3, max: 1.15, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      const rectPts = [[-2.5, 0], [-1, 0], [-1, 1], [1, 1], [1, 0], [2.5, 0]];
      S.add(new Area({ pts: [[-1, 1], [1, 1]], fill: C.goldF, vis: only('r3', 'final'), ra: -1, rb: 1 }));
      S.add(new Curve({ pts: rectPts, color: C.navy, w: 3.8, vis: k => k >= 0 }));
      const integ0 = f => Math.cos(2 * PI * f * t0);
      S.add(new Area({ f: f => Math.max(0, integ0(f)), a: -1, b: 1, fill: 'rgba(227,162,59,.55)', vis: only('r1') }));
      S.add(new Area({ f: f => Math.min(0, integ0(f)), a: -1, b: 1, fill: 'rgba(192,57,43,.4)', vis: only('r1') }));
      S.add(new Curve({ f: integ0, x0: -1, x1: 1, color: C.goldD, w: 3, vis: only('r1') }));
      S.add(new Label({ x: 0, y: -0.8, html: `integrando $S_0\\cos(2\\pi f\\tau)$ para $\\tau=${tnum(t0, 2)}/B$`, size: 17, color: C.goldD, bg: true, vis: only('r1') }));
      S.add(new Label({ x: 1.6, y: 0.62, html: 'área $=2BS_0$', size: 18, color: C.goldD, bg: true, vis: only('r3') }));
      R.add(new Dot({ x: t0, y: Rn(t0), color: C.goldD, html: `$R_X(${tnum(t0, 2)}/B)$ = área`, dx: 12, dy: -8, an: 'lb', size: 17, vis: only('r1'), delay: 500 }));
      R.add(new Curve({ f: Rn, color: C.petro, w: 3.8, n: 900, vis: from('r2') }));
      R.add(new Label({ x: 1.75, y: 0.75, html: '$2BS_0\\,\\mathrm{sinc}(2B\\tau)$', size: 18, color: C.petro, bg: true, vis: only('r2') }));
      R.add(new Dot({ x: 0, y: 1, color: C.gold, html: '$R_X(0)=2BS_0$', dx: 12, dy: 0, an: 'lm', vis: only('r3') }));
      for (let k = -6; k <= 6; k++) if (k) R.add(new Dot({ x: k / 2, y: 0, r: 6, color: C.red, vis: k2 => k2 >= I('r4') && k2 !== I('r7'), delay: 80 * Math.abs(k) }));
      R.add(new Label({ x: 0, y: -0.2, html: 'zeros em $\\tau=k/(2B)$', size: 17, color: C.red, bg: true, vis: only('r4') }));
      R.add(new Bracket({ x0: 0.5, x1: 1, y: 0.28, html: '$\\frac{1}{2B}$', color: C.red, vis: only('r5') }));
      R.add(new Custom({ vis: only('r6'), draw(c, g) { for (let k = -6; k <= 6; k++) SV('circle', { cx: c.X(k / 2), cy: c.Y(Rn(k / 2)), r: 10, fill: 'none', stroke: C.navy, 'stroke-width': 2.6 }, g); } }));
      R.add(new Custom({ vis: only('r7'), draw(c, g, p, mk) { for (let k = -13; k <= 13; k++) SV('circle', { cx: c.X(k / 4), cy: c.Y(Rn(k / 4)), r: 7, fill: C.gold, stroke: '#fff', 'stroke-width': 2 }, g); mk.lab('v').set(c.X(0.25) + 8, c.Y(rho4) - 6, labHTML({ html: `$\\approx${tnum(rho4, 2)}$`, size: 18, color: C.goldD, bg: true }), 'lb'); } }));
      R.add(new Label({ x: 1.9, y: 0.75, html: 'amostras em $t=n/(2B)$:<br>todas nos zeros, exceto a origem', size: 16, bg: true, vis: only('r6', 'final') }));
      const fsFor = k => k === I('r7') ? 4 : 2;
      K.add(new Stems({ pts: p => { const o = []; for (let k = -6; k <= 6; k++) o.push([k, Rn(k / p)]); return o; }, p: fsFor, pdur: 900, color: C.petro, vis: from('r6') }));
      K.add(new Label({ x: 3.5, y: 0.75, html: p => p < 3 ? 'branca: $R_X[k]=2BS_0\\,\\delta[k]$' : `vizinhas: $${tnum(rho4, 2)}$`, p: fsFor, size: 17, bg: true, vis: from('r6') }));
      /* interpretação: taxa de amostragem */
      const SS = { fs: 4 };
      const ir = TFRow(lp.map.interp, '1fr 50px 1fr', '$R_X(\\tau)$ e os instantes $k/f_s$', '$S_X(f)$', FINV, null, true);
      const Ri = new Chart(ir.t, { w: 430, h: 330, m: { l: 58, r: 14, t: 26, b: 60 }, x: { min: -3.3, max: 3.3, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$\\tau\\cdot B$', lpos: 'end' }, y: { min: -0.32, max: 1.15, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      Ri.add(new Curve({ f: Rn, color: C.petro, w: 3.4, n: 900 }));
      Ri.add(new Custom({ draw(c, g) { for (let k = -30; k <= 30; k++) { const x = k / SS.fs; if (Math.abs(x) <= 3.3) SV('circle', { cx: c.X(x), cy: c.Y(Rn(x)), r: 6, fill: C.gold, stroke: '#fff', 'stroke-width': 2 }, g); } } }));
      const Si = new Chart(ir.f, { w: 430, h: 330, m: { l: 58, r: 14, t: 26, b: 60 }, x: { min: -2.5, max: 2.5, ticks: [-2, -1, 0, 1, 2], label: '$f/B$', lpos: 'end' }, y: { min: 0, max: 1.35, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      Si.add(new Area({ pts: [[-1, 1], [1, 1]], fill: C.goldF2 })); Si.add(new Curve({ pts: rectPts, color: C.navy, w: 3.4 }));
      Si.add(new Custom({ draw(c, g, p, mk) { const h = SS.fs / 2; for (const s of [1, -1]) if (h <= 2.5) SV('line', { x1: c.X(s * h), x2: c.X(s * h), y1: c.y0, y2: c.y1, stroke: C.red, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, g); mk.lab('n').set(c.X(Math.min(h, 2.45)), c.Y(1.25), labHTML({ html: '$\\pm f_s/2$', size: 16, color: C.red, bg: true }), 'rm'); } }));
      const cKi = chartCard(lp.map.interp, 'Sequência amostrada $R_X[k]/(2BS_0)$', { style: { marginTop: '10px' } });
      const Ki = new Chart(cKi, { w: 904, h: 170, m: { l: 58, r: 14, t: 10, b: 44 }, x: { min: -6.6, max: 6.6, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$k$', lpos: 'end' }, y: { min: -0.3, max: 1.15, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      Ki.add(new Stems({ pts: () => { const o = []; for (let k = -6; k <= 6; k++) o.push([k, Rn(k / SS.fs)]); return o; }, color: C.petro }));
      const ro = Readout(ctx.cards.interp, [['fs', '$f_s$'], ['r', 'correlação de vizinhas', 'g'], ['w', 'amostras']]);
      const upd = () => { const c1 = Rn(1 / SS.fs); ro.set('fs', nf(SS.fs, 2) + ' B'); ro.set('r', nf(c1, 2)); ro.set('w', Math.abs(c1) < 0.005 ? 'brancas (descorrelacionadas)' : 'correlacionadas'); };
      Slider(lp.map.interp, { label: '$f_s$', min: 2, max: 8, step: 0.05, value: 4, fmt: v => nf(v, 2) + ' B', oninput: v => { SS.fs = v; upd(); Ri.render(); Si.render(); Ki.render(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return {
        goto(k, anim) {
          lp.show(st.kind(k) === 'interp' ? 'interp' : 'main');
          ttl.firstChild.innerHTML = md(k === I('r7') ? 'Amostrado a $f_s=4B$: $R_X[k]=R_X(k/4B)$' : 'Amostrado a $f_s=2B$: $R_X[k]=R_X(k/2B)$');
          cK.style.opacity = k >= I('r6') ? 1 : .3;
          R.goto(k, anim); S.goto(k, anim); K.goto(k, anim);
        }
      };
    }
  });
})();

/* ---------- Q8.11 · Lendo um datasheet: do espectro à memória ---------- */
(() => {
  const c = 8e-6, fc = 100;                       /* V²/Hz, Hz */
  const a = 2 * PI * fc, s2 = PI * c * fc, Xr = Math.sqrt(s2), mem = 1 / a, rho = Math.exp(-a * 0.01);
  const Sds = f => c / (1 + (f / fc) ** 2);
  const Stab = (f, aa, ss) => 2 * aa * ss / (aa * aa + 4 * PI * PI * f * f);
  const rectP = c * 2 * fc, inside = (2 / PI) * Math.atan(1);
  const a1 = 2 * PI * 40, s1 = 1.2e-3;
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 3, tex: '\\frac{2\\sigma^2/a}{1+(2\\pi f/a)^2}=\\frac{c}{1+(f/f_c)^2}', note: 'Comparamos com o par da tabela, escrito com “1+” no denominador.' },
    { n: 'r2', k: 'res', road: 4, tex: `\\frac{2\\pi}{a}=\\frac{1}{f_c}\\Rightarrow a=2\\pi f_c\\approx\\hl{${tnum(a, 1)}\\ \\mathrm{s^{-1}}}`, note: 'Casando os denominadores.' },
    { n: 'r3', k: 'res', road: 4, tex: `\\frac{2\\sigma^2}{a}=c\\Rightarrow\\sigma^2=\\frac{ca}{2}=\\pi cf_c\\approx\\hl{${sciT(s2, 2)}\\ \\mathrm{V^2}}`, note: 'Casando os numeradores.' },
    { n: 'r4', k: 'res', tag: '(a)', road: 4, tex: `R_X(\\tau)=\\hl{${sciT(s2, 2)}\\,e^{-${tnum(a, 0)}|\\tau|}}\\ \\mathrm{V^2}`, note: 'Wiener–Khinchin inverso pela tabela.' },
    { n: 'r5', k: 'res', tag: '(b)', road: 5, tex: `X_{\\rms}=\\sqrt{R_X(0)}=\\sqrt{${sciT(s2, 2)}}\\approx\\hl{${tnum(Xr * 1e3, 1)}\\ \\mathrm{mV}}`, note: '(D4): $R_X(0)$ é a potência.' },
    { n: 'erro', k: 'erro' },
    { n: 'r6', k: 'res', tag: '(c)', road: 5, tex: `1/a=\\frac{1}{2\\pi f_c}\\approx\\hl{${tnum(mem * 1e3, 2)}\\ \\mathrm{ms}}`, note: 'A correlação cai a $1/e$ em 1,59 ms.' },
    { n: 'r7', k: 'res', tag: '(d)', road: 5, tex: `\\rho=\\frac{R_X(0{,}01)}{R_X(0)}=e^{-${tnum(a, 0)}\\cdot0{,}01}=e^{-2\\pi}\\approx\\hl{${tnum(rho, 4)}}`, note: 'Coeficiente de correlação de leituras vizinhas.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-11', num: '8.11', level: 3, title: 'Lendo um <i>datasheet</i>: do espectro à memória', steps,
    enun: {
      html: 'O ruído de um acelerômetro MEMS em repouso tem DEP bilateral $S_X(f)=\\dfrac{c}{1+(f/f_c)^2}$. (a) $R_X(\\tau)$. (b) Valor eficaz. (c) Tempo de correlação $1/a$. (d) O microcontrolador lê o sensor a cada 10 ms: qual a correlação entre leituras consecutivas?',
      chips: [`$c=${sciT(c)}$ V²/Hz`, `$f_c=${fc}$ Hz`, '!leitura a cada 10 ms']
    },
    plano: { html: 'Reconhecer a lorentziana “disfarçada”. O par da tabela é $\\sigma^2e^{-a|\\tau|}\\leftrightarrow\\frac{2a\\sigma^2}{a^2+4\\pi^2f^2}=\\frac{2\\sigma^2/a}{1+(2\\pi f/a)^2}$. Basta casar os parâmetros: $a\\leftrightarrow f_c$ e $\\sigma^2\\leftrightarrow c$.', road: [3, 4] },
    erro: { html: 'Calcular a potência como “$c\\cdot f_c$” ou “$c\\cdot2f_c$”, como se a lorentziana fosse um retângulo de largura $f_c$. A área exata é $\\pi cf_c$: a lorentziana tem caudas que decaem só como $1/f^2$ e carregam uma fração considerável da potência — a “largura equivalente” é $\\frac{\\pi}{2}f_c$ de cada lado (Q8.13).' },
    final: { html: `$R_X(\\tau)=\\pi cf_c\\,e^{-2\\pi f_c|\\tau|}\\approx${sciT(s2, 2)}\\,e^{-${tnum(a, 0)}|\\tau|}$ V²; ruído de $\\approx${tnum(Xr * 1e3, 0)}$ mV eficazes; memória de $\\approx${tnum(mem * 1e3, 1)}$ ms; leituras a cada 10 ms têm correlação $\\approx${tnum(rho, 3)}$ — na prática, independentes.` },
    interp: { boxes: [['aplic', 'A memória do ruído decide se vale a pena promediar leituras: amostras quase independentes (a cada 10 ms) somam ruído “branco” e a média de $M$ leituras reduz a variância por $M$; amostras rápidas demais (bem abaixo de 1,6 ms) carregam o mesmo ruído e a média ajuda pouco (Q8.10 e Q8.17).', { size: 'xs' }]] },
    notes: {
      fala: 'O datasheet não escreve a lorentziana na forma da tabela. O trabalho é algébrico: reescrever o par com “1+” no denominador e casar os parâmetros. Depois, tudo sai de graça: potência por (D4), memória por $1/a$, correlação de leituras por $e^{-a T_s}$.',
      pergunta: 'Se o firmware lesse o sensor a cada 1 ms, as leituras seriam praticamente independentes?',
      tempo: '7 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'erro', 'interp']);
      const { I, from, only } = st;
      const r = TFRow(lp.map.main, '1fr 50px 1fr', 'Autocorrelação <small>$R_X(\\tau)$</small>', 'DEP do <i>datasheet</i>', FINV, null, true);
      const R = new Chart(r.t, { w: 430, h: 600, m: { l: 58, r: 14, t: 40, b: 60 }, x: { min: -12, max: 12, ticks: [-10, -5, 0, 5, 10], label: '$\\tau$ (ms)', lpos: 'end' }, y: { min: 0, max: 2.85, ticks: [0, 0.5, 1, 1.5, 2, 2.5].map(v => [v, nf(v, 1)]), label: '$R_X$ ($\\times10^{-3}$ V²)' } });
      const F = new Chart(r.f, { w: 430, h: 600, m: { l: 58, r: 14, t: 40, b: 60 }, x: { min: -500, max: 500, ticks: [-400, -100, 0, 100, 400], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 10.5, ticks: [0, 2, 4, 6, 8, 10], label: '$S_X$ ($\\times10^{-6}$ V²/Hz)' } });
      const Ru = tm => s2 * Math.exp(-a * Math.abs(tm) * 1e-3) / 1e-3;
      F.add(new Area({ f: f => Sds(f) / 1e-6, fill: C.goldF, n: 600, vis: only('r5', 'final') }));
      F.add(new Curve({ f: f => Sds(f) / 1e-6, color: C.navy, w: 4, n: 700, vis: k => k >= 0 }));
      F.add(new Label({ x: 490, y: 9.8, an: 'rm', html: '<i>datasheet</i>: $\\frac{c}{1+(f/f_c)^2}$', size: 17, color: C.navy, bg: true, vis: k => k >= 0 && k < I('r4') }));
      const pAt = k => k >= I('r3') ? [a, s2] : k >= I('r2') ? [a, s1] : [a1, s1];
      F.add(new Curve({ f: (f, p) => Stab(f, p[0], p[1]) / 1e-6, p: pAt, pdur: 1300, color: C.goldD, w: 3.2, dash: '9 6', n: 700, vis: only('r1', 'r2', 'r3'), reveal: 'fade' }));
      F.add(new Label({ x: -490, y: 7.0, an: 'lm', html: p => `tabela: $\\frac{2a\\sigma^2}{a^2+4\\pi^2f^2}$<br>$a=${tnum(p[0], 0)}$ s⁻¹, $\\sigma^2=${sciT(p[1], 2)}$`, p: pAt, pdur: 1300, size: 16, color: C.goldD, bg: true, vis: only('r1', 'r2', 'r3') }));
      F.add(new Label({ x: 250, y: 6.2, html: '$a\\leftrightarrow2\\pi f_c$', size: 19, color: C.goldD, bg: true, vis: only('r2') }));
      F.add(new Label({ x: 250, y: 6.2, html: '$\\sigma^2\\leftrightarrow\\pi cf_c$ — coincidem!', size: 19, color: C.goldD, bg: true, vis: only('r3') }));
      for (const s of [1, -1]) F.add(new VLine({ x: s * fc, y0: 0, y1: Sds(fc) / 1e-6, color: C.red, w: 2.2, vis: only('r2'), html: s > 0 ? '$f_c$: meia altura' : null, an: 'lb', dx: 4, dy: -4, size: 16 }));
      F.add(new Label({ x: 260, y: 4.4, html: `área $=\\pi cf_c=${sciT(s2, 2)}$ V²`, size: 18, color: C.goldD, bg: true, vis: only('r5', 'final'), delay: 600 }));
      R.add(new Curve({ f: Ru, color: C.petro, w: 4, n: 900, vis: from('r4') }));
      R.add(new Label({ x: 5.5, y: 2.1, html: `$${sciT(s2, 2)}\\,e^{-${tnum(a, 0)}|\\tau|}$`, size: 18, color: C.petro, bg: true, vis: only('r4') }));
      R.add(new Dot({ x: 0, y: s2 / 1e-3, color: C.gold, html: `$R_X(0)=${sciT(s2, 2)}$ V²<br>$X_{\\rms}\\approx${tnum(Xr * 1e3, 1)}$ mV`, dx: 12, dy: 6, an: 'lm', vis: from('r5') }));
      R.add(new Bracket({ x0: 0, x1: mem * 1e3, y: s2 / 1e-3 * Math.exp(-1), html: `$1/a\\approx${tnum(mem * 1e3, 2)}$ ms`, color: C.goldD, vis: from('r6') }));
      for (const s of [1, -1]) R.add(new VLine({ x: s * 10, color: C.navy, w: 2, vis: from('r7'), html: s > 0 ? '10 ms' : null, an: 'rb', dx: -4, ly: 1.6 }));
      R.add(new Dot({ x: 10, y: Ru(10), color: C.red, r: 7, html: `$\\rho=e^{-2\\pi}\\approx${tnum(rho, 4)}$`, dx: -12, dy: -14, an: 'rb', vis: from('r7'), size: 18 }));
      /* erro comum */
      const er = E('div', { class: 'hrow', style: { alignItems: 'flex-start' } }); lp.map.erro.append(er);
      const cW = chartCard(er, '<span style="color:#9E2B25">✗ Retângulo de largura $f_c$</span>', { style: { flex: '1' } });
      const cR = chartCard(er, '<span style="color:#146B73">✓ Lorentziana inteira</span>', { style: { flex: '1' } });
      const eo = () => ({ w: 440, h: 620, m: { l: 52, r: 14, t: 40, b: 60 }, x: { min: -500, max: 500, ticks: [-400, -100, 0, 100, 400], label: '$f$ (Hz)', lpos: 'end' }, y: { min: 0, max: 10.5, ticks: [0, 2, 4, 6, 8, 10], label: '$\\times10^{-6}$ V²/Hz' } });
      const eW = new Chart(cW, eo()), eR = new Chart(cR, eo());
      eW.add(new Rect({ x0: -fc, x1: fc, y0: 0, y1: c / 1e-6, fill: 'rgba(192,57,43,.35)', stroke: C.red, vis: only('erro') }));
      eW.add(new Curve({ f: f => Sds(f) / 1e-6, color: C.navy, w: 3, n: 600 }));
      eW.add(new Label({ x: 0, y: 9.4, html: `$c\\cdot2f_c=${sciT(rectP, 1)}$ V²<br>só ${nf(100 * rectP / s2, 0)}% do valor certo ✗`, size: 18, color: C.red, bg: true, vis: only('erro'), delay: 500 }));
      eR.add(new Area({ f: f => Sds(f) / 1e-6, a: -fc, b: fc, fill: C.goldF, vis: only('erro') }));
      eR.add(new Area({ f: f => Sds(f) / 1e-6, a: fc, b: 500, fill: 'rgba(227,162,59,.8)', vis: only('erro'), delay: 400 }));
      eR.add(new Area({ f: f => Sds(f) / 1e-6, a: -500, b: -fc, fill: 'rgba(227,162,59,.8)', vis: only('erro'), delay: 400 }));
      eR.add(new Curve({ f: f => Sds(f) / 1e-6, color: C.navy, w: 3, n: 600 }));
      eR.add(new Label({ x: 0, y: 9.4, html: `$\\pi cf_c=${sciT(s2, 2)}$ V² ✓`, size: 18, color: C.petro, bg: true, vis: only('erro'), delay: 500 }));
      eR.add(new Label({ x: 300, y: 3.2, html: `caudas $|f|>f_c$:<br>${nf(100 * (1 - inside), 0)}% da potência`, size: 17, color: C.goldD, bg: true, vis: only('erro'), delay: 900 }));
      /* interpretação: intervalo entre leituras */
      const SS = { Ts: 1 };
      const ci = chartCard(lp.map.interp, 'Leituras a cada $T_s$: correlação $e^{-2\\pi f_cT_s}$');
      const Ri = new Chart(ci, { w: 904, h: 470, m: { l: 58, r: 16, t: 40, b: 60 }, x: { min: 0, max: 12, ticks: [0, 2, 4, 6, 8, 10, 12], label: '$\\tau$ (ms)', lpos: 'end' }, y: { min: 0, max: 2.85, ticks: [0, 0.5, 1, 1.5, 2, 2.5].map(v => [v, nf(v, 1)]), label: '$R_X$ ($\\times10^{-3}$ V²)' } });
      Ri.add(new Curve({ f: Ru, color: C.petro, w: 3.6, n: 800 }));
      Ri.add(new HLine({ y: s2 / 1e-3 / Math.E, color: C.mute, dash: '5 5', html: '$R_X(0)/e$', lx: 11.9, dy: -4 }));
      Ri.add(new Custom({ draw(c, g, p, mk) { for (let k = 0; k * SS.Ts <= 12.001; k++) { const x = k * SS.Ts; SV('line', { x1: c.X(x), x2: c.X(x), y1: c.Y(0), y2: c.Y(Ru(x)), stroke: C.goldD, 'stroke-width': 2 }, g); SV('circle', { cx: c.X(x), cy: c.Y(Ru(x)), r: 6, fill: C.gold, stroke: '#fff', 'stroke-width': 2 }, g); } mk.lab('r').set(c.X(SS.Ts) + 10, c.Y(Ru(SS.Ts)) - 8, labHTML({ html: `vizinhas: $\\rho=${tnum(Math.exp(-a * SS.Ts * 1e-3), 3)}$`, size: 18, color: C.goldD, bg: true }), 'lb'); } }));
      const ro = Readout(ctx.cards.interp, [['t', 'intervalo $T_s$'], ['r', 'correlação $\\rho$', 'g'], ['v', 'leituras']]);
      const upd = () => { const rr = Math.exp(-a * SS.Ts * 1e-3); ro.set('t', nf(SS.Ts, 2) + ' ms'); ro.set('r', nf(rr, 4)); ro.set('v', rr < 0.01 ? 'praticamente independentes' : rr < 0.3 ? 'fracamente correlacionadas' : 'fortemente correlacionadas'); };
      Slider(ci, { label: 'intervalo $T_s$', min: -0.7, max: 1, step: 0.005, log: true, value: 0, fmt: v => nf(v, 2) + ' ms', oninput: v => { SS.Ts = v; upd(); Ri.render(); } });
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          lp.show(kind === 'erro' ? 'erro' : kind === 'interp' ? 'interp' : 'main');
          R.goto(k, anim); F.goto(k, anim); eW.goto(k, anim); eR.goto(k, anim);
        }
      };
    }
  });
})();

/* ---------- Q8.12 · O mistério do pulso retangular ---------- */
(() => {
  const Sr = f => 2 * sinc(2 * f);
  const S075 = Sr(0.75);
  const sq2 = Math.SQRT2;
  const terms = [['a_1^2M_{11}', 1], ['a_2^2M_{22}', 2], ['a_3^2M_{33}', 1], ['2a_1a_2M_{12}', -2 * sq2], ['2a_2a_3M_{23}', -2 * sq2], ['2a_1a_3M_{13}', 0]];
  const EZ2 = terms.reduce((s, t) => s + t[1], 0);   /* 4 − 4√2 */
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', tag: '(a)', road: 2, tex: 'R(0)=1\\ge0;\\ \\hl{R(-\\tau)=R(\\tau)};\\ \\hl{|R(\\tau)|\\le1=R(0)}', note: '(P1), (P2) e (P3) satisfeitas.' },
    { n: 'r2', k: 'res', tag: '(b)', road: 3, tex: '\\int_{-1}^{1}e^{-\\j2\\pi f\\tau}\\dd\\tau=\\hl{2\\,\\mathrm{sinc}(2f)}', note: 'Eq. 7.16 com $T=1$.' },
    { n: 'r3', k: 'res', road: 4, tex: `f=0{,}75:\\ 2\\,\\mathrm{sinc}(1{,}5)=2\\frac{\\mathrm{sen}(1{,}5\\pi)}{1{,}5\\pi}=-\\frac{4}{3\\pi}\\approx\\hl{${tnum(S075, 2)}}`, note: 'Negativa em $\\frac12<|f|<1$ (e em outros lóbulos).' },
    { n: 'r4', k: 'res', road: 3, tex: '\\text{se }R\\text{ fosse autocorrelação, }\\hl{2\\,\\mathrm{sinc}(2f)\\text{ seria uma DEP}}', note: 'Wiener–Khinchin.' },
    { n: 'r5', k: 'res', road: 5, tex: '\\text{DEP não pode ser negativa (D3)}\\Rightarrow\\hl{\\text{contradição}}', note: 'Logo $R$ <b>não</b> é autocorrelação.' },
    { n: 'r6', k: 'res', tag: '(c)', road: 1, tex: 't=0;\\,0{,}6;\\,1{,}2:\\ \\mathbf M=\\hl{\\begin{bmatrix}1&1&0\\\\1&1&1\\\\0&1&1\\end{bmatrix}}', note: '$R(0{,}6)=1$ (pois $0{,}6<1$) e $R(1{,}2)=0$.' },
    { n: 'r7', k: 'res', road: 4, tex: 'Z=X(0)\\hl{-\\sqrt2}\\,X(0{,}6)+X(1{,}2)', note: 'Combinação linear com $\\mathbf a=(1,-\\sqrt2,1)$.' },
    { n: 'r8', k: 'res', road: 4, tex: 'E[Z^2]=\\mathbf a^{\\mathsf T}\\mathbf M\\mathbf a=\\hl{(1+2+1)+2(-\\sqrt2)(1)+2(-\\sqrt2)(1)+0}', note: 'Expansão de $\\sum_i\\sum_k a_ia_kM_{ik}$ (propriedade P4).' },
    { n: 'r9', k: 'res', road: 5, tex: `=4-4\\sqrt2\\approx\\hl{${tnum(EZ2, 2)}<0}`, note: '“Potência” negativa: absurdo. (P4) é violada.' },
    { n: 'r10', k: 'res', tag: '(d)', road: 5, tex: 'R=(1-|\\tau|)_{|\\tau|\\le1}\\ \\leftrightarrow\\ \\hl{\\mathrm{sinc}^2(f)\\ge0}', note: 'Válido: é a autocorrelação da onda NRZ (Q8.18).' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-12', num: '8.12', level: 3, title: 'O mistério do pulso retangular', steps,
    enun: {
      html: 'No Capítulo 7 ficou uma pergunta: $R(\\tau)=1$ para $|\\tau|<1$ e $0$ para $|\\tau|\\ge1$ é não negativa, par e máxima na origem. (a) Mostre (P1)–(P3). (b) Use Wiener–Khinchin para mostrar que ela <i>não</i> é autocorrelação. (c) Três amostras com “potência negativa”. (d) Compare com o triângulo.',
      chips: ['$R=1$ em $|\\tau|<1$', '!autocorrelação ou não?']
    },
    plano: { html: 'Se $R$ fosse autocorrelação, sua transformada seria uma DEP, logo $\\ge0$ (D3). Calcular a transformada e procurar um valor negativo. Para (c), montar a matriz de correlação de três amostras e testar a propriedade (P4).', road: [3, 5] },
    final: { html: `O pulso retangular satisfaz (P1)–(P3), mas sua transformada $2\\,\\mathrm{sinc}(2f)$ fica negativa; pela combinação $Z=X(0)-\\sqrt2X(0{,}6)+X(1{,}2)$ teríamos $E[Z^2]=4-4\\sqrt2\\approx${tnum(EZ2, 2)}<0$. Não é autocorrelação. O triângulo, cuja transformada $\\mathrm{sinc}^2$ é não negativa, é.` },
    interp: { boxes: [['interp', 'Leitura física do absurdo: $R(0{,}6)=R(0)$ significa $E|X(t+0{,}6)-X(t)|^2=2R(0)-2R(0{,}6)=0$ — o processo <i>repete exatamente</i> seu valor depois de 0,6 s. Então também repete depois de 1,2 s, e $R(1{,}2)$ teria de valer 1, não 0. Correlação perfeita até $\\tau=1$ e nenhuma logo depois é um “salto” de memória impossível. O triângulo perde a memória <i>gradualmente</i>.', { size: 'xs' }], ['dica', 'O filtro estreito sonda a “DEP”: onde ela é negativa, ele entregaria potência negativa.', { size: 'xs' }]] },
    notes: {
      fala: 'Este é o “mistério” deixado no Capítulo 7. Duas provas: a de Wiener–Khinchin (uma linha: a transformada fica negativa) e a de três amostras (a potência de $Z$ fica negativa). Termine com a comparação da Fig. 8.9: o triângulo passa no teste.',
      pergunta: 'Antes do item (b): o pulso retangular parece uma boa autocorrelação. O que, fisicamente, há de estranho nele?',
      tempo: '9 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'z', 'cmp', 'interp']);
      const { I, from, only } = st;
      const rectPts = [[-2.5, 0], [-1, 0], [-1, 1], [1, 1], [1, 0], [2.5, 0]];
      const r = TFRow(lp.map.main, '1fr 50px 1fr', 'Candidata $R(\\tau)$', 'Transformada $\\mathcal F\\{R\\}$');
      const R = new Chart(r.t, { w: 430, h: 600, m: { l: 50, r: 14, t: 34, b: 60 }, x: { min: -2.5, max: 2.5, ticks: [-2, -1, 0, 1, 2], label: '$\\tau$ (s)', lpos: 'end' }, y: { min: -0.4, max: 1.6, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      const F = new Chart(r.f, { w: 430, h: 600, m: { l: 50, r: 14, t: 34, b: 60 }, x: { min: -3.2, max: 3.2, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$f$ (Hz)', lpos: 'end' }, y: { min: -0.65, max: 2.25, ticks: [-0.5, 0, 0.5, 1, 1.5, 2].map(v => [v, nf(v, 1)]) } });
      R.add(new Area({ pts: [[-1, 1], [1, 1]], fill: C.navyF, vis: k => k >= 0 }));
      R.add(new Curve({ pts: rectPts, color: C.navy, w: 4, vis: k => k >= 0 }));
      [['(P1) $R(0)=1\\ge0$ ✓', 1.5], ['(P2) par: $R(-\\tau)=R(\\tau)$ ✓', 1.38], ['(P3) $|R(\\tau)|\\le R(0)$ ✓', 1.26]].forEach(([h, y], i) => R.add(new Label({ x: -2.4, y, an: 'lm', html: h, size: 17, color: C.petro, bg: true, vis: only('r1'), delay: 300 * i })));
      R.add(new Label({ x: 0, y: -0.22, html: 'parece uma autocorrelação…', size: 17, color: C.mute, vis: only('r1', 'r2') }));
      F.add(new Area({ f: f => Math.min(0, Sr(f)), base: 0, fill: 'rgba(192,57,43,.55)', n: 800, vis: from('r5') }));
      F.add(new Curve({ f: Sr, color: C.navy, w: 3.8, n: 900, vis: from('r2') }));
      F.add(new Label({ x: 1.9, y: 1.55, html: '$2\\,\\mathrm{sinc}(2f)$', size: 19, color: C.navy, bg: true, vis: only('r2', 'r3', 'r4') }));
      F.add(new Dot({ x: 0.75, y: S075, color: C.red, r: 8, html: `$f=0{,}75$: $${tnum(S075, 2)}$`, dx: 12, dy: 8, an: 'lt', size: 18, vis: from('r3') }));
      F.add(new Label({ x: 0, y: 2.12, html: 'se $R$ fosse autocorrelação, isto seria uma DEP', size: 17, bg: true, vis: only('r4') }));
      F.add(new Label({ x: 0, y: 2.12, html: '<b style="color:#C0392B">✗ “densidade negativa” ⇒ contradição</b>', size: 19, bg: true, vis: only('r5') }));
      /* (c) três amostras */
      const zt = chartCard(lp.map.z, 'Três amostras: $t=0$; $0{,}6$; $1{,}2$ s');
      const Zc = new Chart(zt, { w: 904, h: 250, m: { l: 50, r: 16, t: 20, b: 50 }, x: { min: -0.4, max: 2.2, ticks: [0, 0.6, 1.2, 1.8].map(v => [v, nf(v, 1)]), label: '$t$ (s)', lpos: 'end' }, y: { min: -1.9, max: 1.6, ticks: [[-sq2, '-\\sqrt2'], [0, '0'], [1, '1']] } });
      Zc.add(new Custom({
        vis: from('r6'), draw(c, g, p, mk) {
          for (const t of [0, 0.6, 1.2]) SV('circle', { cx: c.X(t), cy: c.Y(0), r: 7, fill: C.navy }, g);
          if (APP.k <= I('r6')) {
            SV('path', { d: `M${c.X(0)} ${c.Y(-0.5)}H${c.X(0.6)}M${c.X(0)} ${c.Y(-0.4)}V${c.Y(-0.6)}M${c.X(0.6)} ${c.Y(-0.4)}V${c.Y(-0.6)}`, stroke: C.petro, 'stroke-width': 2.2, fill: 'none' }, g);
            SV('path', { d: `M${c.X(0)} ${c.Y(-1.25)}H${c.X(1.2)}M${c.X(0)} ${c.Y(-1.15)}V${c.Y(-1.35)}M${c.X(1.2)} ${c.Y(-1.15)}V${c.Y(-1.35)}`, stroke: C.red, 'stroke-width': 2.2, fill: 'none' }, g);
            mk.lab('a').set(c.X(0.3), c.Y(-0.5) - 6, labHTML({ html: '$0{,}6<1\\Rightarrow R=1$', size: 17, color: C.petro, bg: true }), 'cb');
            mk.lab('b').set(c.X(1.3), c.Y(-1.25), labHTML({ html: '$1{,}2\\ge1\\Rightarrow R=0$', size: 17, color: C.red, bg: true }), 'lm');
          }
        }
      }));
      Zc.add(new Stems({ pts: [[0, 1], [0.6, -sq2], [1.2, 1]], color: C.goldD, r: 8, w: 3.4, vis: from('r7') }));
      Zc.add(new Label({ x: 1.75, y: 1.1, html: '$\\mathbf a=(1,-\\sqrt2,1)$', size: 19, color: C.goldD, bg: true, vis: from('r7') }));
      const zr = E('div', { style: { display: 'grid', gridTemplateColumns: '330px 1fr', gap: '12px', marginTop: '12px' } }); lp.map.z.append(zr);
      const mc = E('div', { class: 'card cc', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px' } }); zr.append(mc);
      mc.append(E('div', { class: 'cc-t' }, E('span', { text: 'Matriz de correlação' })), E('div', { style: { fontSize: '28px' }, html: T('\\mathbf M=\\begin{bmatrix}R(0)&R(0{,}6)&R(1{,}2)\\\\R(0{,}6)&R(0)&R(0{,}6)\\\\R(1{,}2)&R(0{,}6)&R(0)\\end{bmatrix}', { d: true }).replace('katex-display', 'katex-display" style="font-size:.62em') }), E('div', { style: { fontSize: '30px' }, html: T('=\\begin{bmatrix}1&1&\\textcolor{#C0392B}{0}\\\\1&1&1\\\\\\textcolor{#C0392B}{0}&1&1\\end{bmatrix}', { d: true }) }));
      const wc = chartCard(zr, 'Termo a termo: $E[Z^2]=\\sum_i\\sum_k a_ia_kM_{ik}$');
      const Wf = new Chart(wc, { w: 540, h: 330, m: { l: 56, r: 12, t: 20, b: 66 }, x: { min: -0.6, max: 6.6, ticks: ['M_{11}', 'M_{22}', 'M_{33}', '2M_{12}', '2M_{23}', '2M_{13}', 'E[Z^2]'].map((t, i) => [i, t]) }, y: { min: -2.2, max: 4.6, ticks: [-2, -1, 0, 1, 2, 3, 4] } });
      Wf.add(new Custom({
        vis: from('r8'), p: k => k >= I('r9') ? 7 : k >= I('r8') ? 6 : 0, pdur: 2400, pease: linear, draw(c, g, p, mk) {
          let acc = 0; const n = Math.floor(p + 1e-6), w = (c.X(1) - c.X(0)) * 0.62;
          for (let i = 0; i < Math.min(n, 6); i++) {
            const v = terms[i][1], a0 = acc, a1 = acc + v; acc = a1;
            const col = v >= 0 ? C.petro : C.red;
            SV('rect', { x: c.X(i) - w / 2, y: c.Y(Math.max(a0, a1)), width: w, height: Math.max(2, Math.abs(c.Y(a0) - c.Y(a1))), fill: col, opacity: .85 }, g);
            if (i < 5) SV('line', { x1: c.X(i) + w / 2, x2: c.X(i + 1) - w / 2, y1: c.Y(a1), y2: c.Y(a1), stroke: '#8FA1AD', 'stroke-dasharray': '3 3' }, g);
            mk.lab('t' + i).set(c.X(i), c.Y(Math.max(a0, a1)) - 4, labHTML({ html: `$${v >= 0 ? '+' : ''}${tnum(v, 2)}$`, size: 15, color: col }), 'cb');
          }
          if (n >= 7) {
            SV('rect', { x: c.X(6) - w / 2, y: c.Y(0), width: w, height: c.Y(EZ2) - c.Y(0), fill: C.red }, g);
            mk.lab('tot').set(c.X(6) - w / 2 - 6, c.Y(EZ2), labHTML({ html: `$${tnum(EZ2, 2)}<0$`, size: 19, color: C.red, weight: 700, bg: true }), 'rm');
          }
        }
      }));
      /* (d) e resposta: Fig. 8.9 */
      const g2 = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }); lp.map.cmp.append(g2);
      const mk2 = (title, tri) => {
        const card = chartCard(g2, title);
        const t = new Chart(card, { w: 430, h: 200, m: { l: 46, r: 12, t: 16, b: 44 }, x: { min: -2, max: 2, ticks: [-2, -1, 0, 1, 2], label: '$\\tau$', lpos: 'end' }, y: { min: 0, max: 1.2, ticks: [0, 1] } });
        t.add(new Area({ pts: tri ? [[-1, 0], [0, 1], [1, 0]] : [[-1, 1], [1, 1]], fill: C.navyF }));
        t.add(new Curve({ pts: tri ? [[-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0]] : [[-2, 0], [-1, 0], [-1, 1], [1, 1], [1, 0], [2, 0]], color: C.navy, w: 3.4 }));
        const Fn = tri ? (f => sinc(f) ** 2) : Sr;
        const fc2 = new Chart(card, { w: 430, h: 380, m: { l: 50, r: 12, t: 16, b: 60 }, x: { min: -3.2, max: 3.2, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$f$ (Hz)', lpos: 'end' }, y: tri ? { min: -0.15, max: 1.15, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } : { min: -0.6, max: 2.2, ticks: [-0.5, 0, 0.5, 1, 1.5, 2].map(v => [v, nf(v, 1)]) } });
        if (tri) fc2.add(new Area({ f: Fn, fill: C.petroF, n: 600 }));
        else fc2.add(new Area({ f: f => Math.min(0, Fn(f)), base: 0, fill: 'rgba(192,57,43,.55)', n: 800 }));
        fc2.add(new Curve({ f: Fn, color: tri ? C.petro : C.navy, w: 3.4, n: 900 }));
        fc2.add(new Label({ x: 0, y: tri ? 1.08 : 2.08, html: tri ? '$\\mathrm{sinc}^2(f)\\ge0$ — <b style="color:#146B73">válida</b>' : '$2\\,\\mathrm{sinc}(2f)$ fica negativa — <b style="color:#C0392B">inválida</b>', size: 17, bg: true }));
        return [t, fc2];
      };
      mk2('$R=$ retângulo $\\Rightarrow S=2\\,\\mathrm{sinc}(2f)$', false);
      mk2('$R=$ triângulo $\\Rightarrow S=\\mathrm{sinc}^2(f)$', true);
      /* interpretação: filtro estreito sondando 2 sinc(2f) */
      const SS = { f0: 0.75 };
      const ci = chartCard(lp.map.interp, 'Filtro estreito em $\\pm f_0$ sobre $2\\,\\mathrm{sinc}(2f)$');
      const Fi = new Chart(ci, { w: 904, h: 520, x: { min: -3.2, max: 3.2, ticks: [-3, -2, -1, 0, 1, 2, 3], label: '$f$ (Hz)', lpos: 'end' }, y: { min: -0.65, max: 2.3, ticks: [-0.5, 0, 0.5, 1, 1.5, 2].map(v => [v, nf(v, 1)]) } });
      const hw = 0.05, Pf = f0 => 2 * integ(Sr, f0 - hw, f0 + hw, 200);
      Fi.add(new Area({ f: f => Math.min(0, Sr(f)), base: 0, fill: 'rgba(192,57,43,.22)', n: 800 }));
      Fi.add(new Curve({ f: Sr, color: C.navy, w: 3.4, n: 900 }));
      for (const s of [1, -1]) Fi.add(new Area({ f: Sr, a: () => s * SS.f0 - hw, b: () => s * SS.f0 + hw, fill: () => Pf(SS.f0) < 0 ? 'rgba(192,57,43,.9)' : 'rgba(227,162,59,.9)', n: 30 }));
      for (const s of [1, -1]) Fi.add(new Custom({ draw(c, g) { const x0 = s * SS.f0 - hw, x1 = s * SS.f0 + hw; SV('path', { d: dPath(c, [[x0, -0.65], [x0, 2.2], [x1, 2.2], [x1, -0.65]]), stroke: C.navy, 'stroke-width': 1.8, 'stroke-dasharray': '6 5', fill: 'none' }, g); } }));
      Fi.add(new Label({ x: 0, y: 2.18, html: () => { const v = Pf(SS.f0); return `$P_Y\\approx${tnum(v, 3)}$ ${v < 0 ? '<b style="color:#C0392B">— potência negativa: impossível!</b>' : ''}`; }, size: 20, bg: true }));
      const ro = Readout(ctx.cards.interp, [['f0', '$f_0$'], ['p', 'potência entregue', 'g']]);
      const upd = () => { const v = Pf(SS.f0); ro.set('f0', nf(SS.f0, 2) + ' Hz'); ro.set('p', `<span style="color:${v < 0 ? '#FF8A7A' : '#E3A23B'}">${nf(v, 3)}${v < 0 ? ' (absurdo)' : ''}</span>`); };
      Slider(ci, { label: 'centro $f_0$', min: 0.06, max: 3, step: 0.01, value: 0.75, fmt: v => nf(v, 2) + ' Hz', oninput: v => { SS.f0 = v; upd(); Fi.render(); } });
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k), n = st.name(k);
          lp.show(kind === 'interp' ? 'interp' : ['r6', 'r7', 'r8', 'r9'].includes(n) ? 'z' : ['r10', 'final'].includes(n) ? 'cmp' : 'main');
          mc.style.opacity = k >= I('r6') ? 1 : .3;
          R.goto(k, anim); F.goto(k, anim); Zc.goto(k, anim); Wf.goto(k, anim); Zc.render();
        }
      };
    }
  });
})();

/* ---------- Q8.13 · Memória × banda ---------- */
(() => {
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 3, tex: 'S_X(0)=\\int_{-\\infty}^{\\infty}R_X\\,\\dd\\tau=2\\int_0^{\\infty}R_X\\,\\dd\\tau=\\hl{2R_X(0)\\,\\tau_c}', note: '(D5) e paridade de $R_X$.' },
    { n: 'r2', k: 'res', road: 4, tex: 'B_N=\\frac{R_X(0)}{2S_X(0)}=\\frac{R_X(0)}{4R_X(0)\\tau_c}=\\hl{\\frac{1}{4\\tau_c}}', note: '(D4) no numerador.' },
    { n: 'r3', k: 'res', tag: '(a)', road: 5, tex: '\\hl{B_N\\,\\tau_c=\\tfrac14}', note: 'Identidade: vale para qualquer processo com $S_X(0)>0$.' },
    { n: 'r4', k: 'res', tag: '(b)', road: 4, tex: '\\text{Exponencial }\\sigma^2e^{-a|\\tau|}:\\ \\tau_c=\\hl{\\tfrac1a};\\ B_N=\\frac{\\sigma^2}{2\\cdot2\\sigma^2/a}=\\hl{\\tfrac a4}', note: 'Produto $=\\frac14$.' },
    { n: 'r5', k: 'res', road: 4, tex: '\\text{Triângulo de meia-largura }T:\\ \\tau_c=\\hl{\\tfrac T2};\\ B_N=\\frac{\\sigma^2}{2\\sigma^2T}=\\hl{\\tfrac{1}{2T}}', note: 'Produto $=\\frac14$.' },
    { n: 'r6', k: 'res', road: 4, tex: '\\text{DEP retangular de banda }B:\\ B_N=\\hl{B};\\ \\tau_c=\\int_0^{\\infty}\\mathrm{sinc}(2B\\tau)\\dd\\tau=\\hl{\\tfrac{1}{4B}}', note: 'Produto $=\\frac14$.' },
    { n: 'r7', k: 'res', tag: '(c)', road: 5, tex: `f_{3\\mathrm{dB}}=\\tfrac{a}{2\\pi}\\Rightarrow B_N=\\tfrac a4=\\hl{\\tfrac{\\pi}{2}f_{3\\mathrm{dB}}\\approx${tnum(PI / 2, 2)}f_{3\\mathrm{dB}}}`, note: 'A banda de ruído é 57% maior que a banda de 3 dB.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  /* três processos (parâmetros normalizados; s = escala de tempo no slide interativo) */
  const SS = { s: 1, live: false };
  const sc = () => SS.live ? SS.s : 1;
  const P = [
    { key: 'exp', name: 'Exponencial', fx: '$R=e^{-a|\\tau|}$, $a=1/s$', R: t => Math.exp(-Math.abs(t) / sc()), S: f => { const a = 1 / sc(); return 2 * a / (a * a + 4 * PI * PI * f * f); }, tc: () => sc(), BN: () => 1 / (4 * sc()), R0: () => 1, S0: () => 2 * sc(), tx: [-0.15, 4.2], fx2: [-1.05, 1.05], ry: [0, 1.15], sy: [0, 4.4], at: 'r1' },
    { key: 'tri', name: 'Triângulo', fx: '$R=(1-|\\tau|/T)_+$, $T=s$', R: t => Math.max(0, 1 - Math.abs(t) / sc()), S: f => sc() * sinc(f * sc()) ** 2, tc: () => sc() / 2, BN: () => 1 / (2 * sc()), R0: () => 1, S0: () => sc(), tx: [-0.1, 2.15], fx2: [-2.6, 2.6], ry: [0, 1.15], sy: [0, 2.2], at: 'r5' },
    { key: 'rect', name: 'DEP retangular', fx: '$S=1$ em $|f|<B$, $B=1/s$', R: t => (2 / sc()) * sinc(2 * t / sc()), S: f => Math.abs(f) < 1 / sc() ? 1 : 0, tc: () => sc() / 4, BN: () => 1 / sc(), R0: () => 2 / sc(), S0: () => 1, tx: [-0.1, 2.6], fx2: [-2.3, 2.3], ry: [-0.95, 4.4], sy: [0, 1.25], at: 'r6' }
  ];
  Question({
    id: 'q8-13', num: '8.13', level: 3, title: 'Memória × banda: um “princípio da incerteza” para processos', steps,
    enun: {
      html: 'Processo real WSS, média nula, $S_X(0)>0$. Tempo de correlação $\\tau_c=\\frac{1}{R_X(0)}\\int_0^\\infty R_X\\,\\dd\\tau$ e banda equivalente de ruído $B_N=\\frac{1}{2S_X(0)}\\int S_X\\,\\dd f$. (a) Mostre que $B_N\\tau_c=\\frac14$ sempre. (b) Verifique para a exponencial, o triângulo e a DEP retangular. (c) Exponencial: $B_N$ × $f_{3\\mathrm{dB}}$.',
      chips: ['$\\tau_c$: largura da memória', '$B_N$: retângulo de mesma potência', '!$B_N\\tau_c=?$']
    },
    plano: { html: 'Usar duas consequências do teorema: $\\int S_X\\,\\dd f=R_X(0)$ (D4) e $S_X(0)=\\int R_X\\,\\dd\\tau$ (D5). Como $R_X$ é par, $\\int_{-\\infty}^{\\infty}R_X=2\\int_0^{\\infty}R_X$.', road: 3 },
    final: { html: '$B_N\\tau_c=\\frac14$ para todo processo (com $S_X(0)>0$): quanto mais curta a memória, mais larga a banda, na proporção exata. Para a lorentziana, $B_N=\\frac{\\pi}{2}f_{3\\mathrm{dB}}$.' },
    interp: {
      boxes: [
        ['interp', 'Não é coincidência dos exemplos: é Wiener–Khinchin aplicado em $\\tau=0$ e em $f=0$. A identidade é o equivalente, para processos aleatórios, do princípio “curto no tempo ⇔ largo na frequência” do Capítulo 7.', { size: 'xs' }],
        ['limit', '$\\tau_c$ só faz sentido quando $\\int_0^\\infty R_X>0$. Num processo passa-altas (como $D[n]$ da Q8.5), $S_X(0)=0$ e $\\tau_c=0$: a memória existe, mas as áreas positiva e negativa de $R_X$ se cancelam.', { size: 'xs' }]
      ]
    },
    notes: {
      fala: 'Dois retângulos equivalentes: no tempo, um retângulo de altura $R_X(0)$ com a área de $R_X$ em $\\tau\\ge0$ (largura $\\tau_c$); na frequência, um retângulo de altura $S_X(0)$ com a área de $S_X$ (meia-largura $B_N$). O contador mostra 1/4 nos três casos. No slide interativo, estique o tempo: as duas larguras mudam, o produto não.',
      pergunta: 'Para a DEP retangular, $\\tau_c=1/(4B)$ mas a autocorrelação tem lóbulos negativos. O que $\\tau_c$ está medindo?',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main']);
      const { I, from, only } = st;
      const rows = [], charts = [];
      const grid = E('div', { style: { display: 'grid', gridTemplateRows: 'repeat(3, auto)', gap: '8px' } }); lp.map.main.append(grid);
      P.forEach((p, i) => {
        const row = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 34px 1fr 128px', gap: '4px', alignItems: 'stretch', transition: 'opacity .4s' } }); grid.append(row);
        const ct = chartCard(row, `${p.name} <small>${p.fx}</small>`, { style: { padding: '6px 10px 4px' } });
        row.append(FArrow('$\\mathcal F$'));
        const cf = chartCard(row, 'DEP', { style: { padding: '6px 10px 4px' } });
        const ctr = E('div', { class: 'card', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '6px', textAlign: 'center' } }); row.append(ctr);
        const opt = (dom, y, lab) => ({ w: 380, h: 160, m: { l: 46, r: 10, t: 10, b: 36 }, x: { min: dom[0], max: dom[1], ticks: 5, label: lab, lpos: 'end' }, y: { min: y[0], max: y[1], ticks: 3 } });
        const Ct = new Chart(ct, opt(p.tx, p.ry, '$\\tau$')), Cf = new Chart(cf, opt(p.fx2, p.sy, '$f$'));
        const on = k => k >= I(p.at) && !(p.key !== 'exp' && false);
        const vis = p.key === 'exp' ? (k => k >= I('r1')) : (k => k >= I(p.at));
        Ct.add(new Area({ f: t => p.R(t), a: 0, b: p.tx[1], fill: C.petroF, n: 700, vis }));
        Ct.add(new Curve({ f: t => p.R(t), color: C.navy, w: 2.8, n: 900, vis: k => k >= 0 }));
        Ct.add(new Custom({ vis, delay: 500, draw(c, g, q, mk) { const x1 = p.tc(), h = p.R0(); SV('path', { d: dPath(c, [[0, 0], [0, h], [x1, h], [x1, 0]]), stroke: C.goldD, 'stroke-width': 2.6, 'stroke-dasharray': '7 5', fill: 'rgba(227,162,59,.18)' }, g); mk.lab('t').set(c.X(x1) + 6, c.Y(h * 0.62), labHTML({ html: `$\\tau_c=${tnum(x1, 2)}$`, size: 16, color: C.goldD, bg: true }), 'lm'); } }));
        const fvis = p.key === 'exp' ? (k => k >= I('r2')) : vis;
        Cf.add(new Area({ f: f => p.S(f), fill: C.petroF, n: 900, vis: fvis }));
        Cf.add(new Curve({ f: f => p.S(f), color: C.navy, w: 2.8, n: 1100, vis: k => k >= 0 }));
        Cf.add(new Custom({ vis: fvis, delay: 500, draw(c, g, q, mk) { const b = p.BN(), h = p.S0(); SV('path', { d: dPath(c, [[-b, 0], [-b, h], [b, h], [b, 0]]), stroke: C.goldD, 'stroke-width': 2.6, 'stroke-dasharray': '7 5', fill: 'rgba(227,162,59,.18)' }, g); mk.lab('b').set(c.X(b) + 6, c.Y(h * 0.62), labHTML({ html: `$B_N=${tnum(b, 2)}$`, size: 16, color: C.goldD, bg: true }), 'lm'); } }));
        if (p.key === 'exp') {
          const f3 = () => 1 / (2 * PI * sc());
          Cf.add(new Custom({ vis: only('r7'), draw(c, g, q, mk) { const x = f3(); for (const s of [1, -1]) SV('line', { x1: c.X(s * x), x2: c.X(s * x), y1: c.Y(0), y2: c.Y(p.S(x)), stroke: C.red, 'stroke-width': 2.4, 'stroke-dasharray': '5 4' }, g); mk.lab('f').set(c.X(-1.0), c.Y(p.S0() * 0.92), labHTML({ html: `$f_{3\\mathrm{dB}}=${tnum(x, 3)}$<br>$B_N=${tnum(PI / 2, 2)}f_{3\\mathrm{dB}}$`, size: 15, color: C.red, bg: true }), 'lt'); } }));
        }
        charts.push(Ct, Cf);
        rows.push({ p, row, ctr });
      });
      const sw = E('div', { style: { display: 'none' } }); lp.map.main.append(sw);
      Slider(sw, { label: 'escala de tempo $s$', min: 0.5, max: 2, step: 0.01, value: 1, fmt: v => nf(v, 2), oninput: v => { SS.s = v; charts.forEach(c => c.render()); counters(APP.k); upd(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:8px;padding:6px 14px';
      const ro = Readout(ctx.cards.interp, P.map(p => [p.key, `$B_N\\tau_c$ · ${p.name.toLowerCase()}`, 'g']));
      const upd = () => P.forEach(p => ro.set(p.key, `${nf(p.BN() * p.tc(), 3)} = 1/4`));
      const counters = k => rows.forEach(({ p, ctr }) => {
        const shown = (p.key === 'exp' && k >= I('r3')) || (p.key !== 'exp' && k >= I(p.at));
        ctr.innerHTML = `<div style="font-size:15px;color:#4E6476;letter-spacing:.08em">CONTADOR</div><div style="font-size:24px;margin:2px 0">${T('B_N\\,\\tau_c')}</div>` + (shown ? `<div style="font-size:30px;font-weight:700;color:#146B73">${T('=' + tnum(p.BN() * p.tc(), 3).replace('0{,}250', '\\tfrac14'))}</div><div style="font-size:14px;color:#4E6476">${T(tnum(p.BN(), 2) + '\\times' + tnum(p.tc(), 2))}</div>` : '<div style="font-size:30px;color:#B9C6CD">?</div>');
      });
      upd();
      return {
        goto(k, anim) {
          SS.live = st.kind(k) === 'interp';
          if (!SS.live) SS.s = 1;
          sw.style.display = SS.live ? '' : 'none';
          rows.forEach(({ p, row }) => {
            const active = st.kind(k) !== 'res' || (p.key === 'exp' ? (k <= I('r4') || k === I('r7')) : k === I(p.at));
            row.style.opacity = active ? 1 : .35;
          });
          counters(k);
          charts.forEach(c => { c.goto(k, anim); c.render(); });
        }
      };
    }
  });
})();

/* =====================================================================
   NÍVEL 4 — FILTRAGEM: O QUE SAI DO OUTRO LADO (Q8.14 a Q8.17)
   ===================================================================== */
const KB = 1.38e-23;
/* régua de dB vertical reaproveitável */
function dbRuler(parent, o) {
  return new Chart(parent, { w: o.w || 336, h: o.h || 300, m: { l: 66, r: 12, t: 34, b: 18 }, x: { min: 0, max: 1, ticks: [] }, y: { min: o.min, max: o.max, ticks: o.ticks, label: o.label || 'dBm' } });
}
/* seta vertical animada numa régua de dB */
function dbArrow(ch, x, from, to, html, vis, col = C.goldD, side = 'r') {
  ch.add(new Custom({
    vis, reveal: 'grow', dur: 1000, draw(c, g, p, mk) {
      const y0 = c.Y(from), y1 = c.Y(lerp(from, to, mk.grow)), X = c.X(x);
      SV('path', { d: arrowPath(X, y0 - (to > from ? 8 : -8), X, y1, 13), stroke: col, 'stroke-width': 3.6, fill: 'none' }, g);
      mk.lab('d').set(X + (side === 'r' ? 12 : -12), (y0 + y1) / 2, labHTML({ html, size: 17, color: col, bg: true }), side === 'r' ? 'lm' : 'rm');
    }
  }));
}
/* setas “continua” nas pontas de um piso infinito */
function infArrows(ch, y, col) {
  ch.add(new Custom({
    draw(c, g) {
      const Y = c.Y(y);
      SV('path', { d: arrowPath(c.x1 - 40, Y, c.x1 - 2, Y, 12) + arrowPath(c.x0 + 40, Y, c.x0 + 2, Y, 12), stroke: col, 'stroke-width': 3.4, fill: 'none' }, g);
    }
  }));
}

/* ---------- Q8.14 · Ruído térmico num receptor ---------- */
(() => {
  const T0 = 290, N0 = KB * T0, B1 = 1e6, BL = 125e3;
  const P1 = N0 * B1, PL = N0 * BL, d1 = 10 * Math.log10(P1 / 1e-3), dL = -174 + 10 * Math.log10(BL);
  const N0h = N0 / 2 / 1e-21;                      /* altura em ×10⁻²¹ W/Hz */
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 1, tex: `N_0=kT_0=(1{,}38\\times10^{-23})(290)\\approx\\hl{${sciT(N0, 1)}}\\ \\mathrm{W/Hz}`, note: 'Densidade unilateral (Capítulo 7).' },
    { n: 'r2', k: 'res', road: 3, tex: 'S_Y(f)=|H(f)|^2\\frac{N_0}{2}=\\hl{\\frac{N_0}{2}}\\ \\text{para }|f|<B;\\ 0\\text{ fora}', note: 'Eq. (8.5) com a DEP bilateral.' },
    { n: 'r3', k: 'res', tag: '(a)', road: 4, tex: `P_Y=\\frac{N_0}{2}\\cdot2B=N_0B=\\hl{${sciT(P1, 1)}}\\ \\mathrm{W}`, note: 'Área do retângulo: o fator 2 da largura cancela o $\\frac12$.' },
    { n: 'r4', k: 'res', road: 5, tex: `10\\log_{10}\\frac{${sciT(P1, 1)}}{10^{-3}}\\approx\\hl{${tnum(d1, 0)}\\ \\mathrm{dBm}}`, note: 'Ou: $-174+10\\log_{10}(10^6)=-174+60$.' },
    { n: 'r5', k: 'res', tag: '(b)', road: 4, tex: 'R_Y(\\tau)=\\hl{N_0B\\,\\mathrm{sinc}(2B\\tau)}', note: 'Questão 8.10 com $S_0=N_0/2$.' },
    { n: 'r6', k: 'res', tag: '(c)', road: 5, tex: `-174+10\\log_{10}(1{,}25\\times10^5)\\approx-174+51=\\hl{${tnum(dL, 0)}\\ \\mathrm{dBm}}`, note: 'Canal mais estreito, menos ruído.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-14', num: '8.14', level: 4, title: 'Ruído térmico num receptor: o piso de −174 dBm/Hz', steps,
    enun: {
      html: 'O ruído térmico na entrada de um receptor é branco, com densidade unilateral $N_0=kT_0$, $T_0=290$ K. (a) Potência de ruído na saída de um filtro passa-baixas ideal de banda $B=1$ MHz, em watts e dBm. (b) $R_Y(\\tau)$. (c) Repita (a) para um canal LoRa de $B=125$ kHz.',
      chips: ['$N_0=kT_0$', '$T_0=290$ K', '$B=1$ MHz', '!LoRa: 125 kHz']
    },
    plano: { html: 'Na entrada, DEP <b>bilateral</b> $N_0/2$ (atenção ao fator 2!). Filtro ideal: $|H|^2=1$ em $|f|<B$. A saída é a DEP retangular da Questão 8.10.', road: [1, 3] },
    final: { html: `(a) $P_Y=kT_0B\\approx${sciT(P1, 1)}$ W $\\approx${tnum(d1, 0)}$ dBm. (b) $R_Y(\\tau)=N_0B\\,\\mathrm{sinc}(2B\\tau)$. (c) $\\approx${tnum(dL, 0)}$ dBm.` },
    interp: { boxes: [['aplic', 'Este é o cálculo de “piso de ruído” de todo enlace de rádio: $P_{\\text{ruído}}[\\mathrm{dBm}]=-174+10\\log_{10}B+\\mathrm{NF}$, em que NF é a figura de ruído do receptor. Os 9 dB que separam o canal de 1 MHz do de 125 kHz são uma das razões pelas quais o LoRa alcança quilômetros com potências de miliwatts: um receptor de banda estreita “ouve” menos ruído.', { size: 'xs' }]] },
    notes: {
      fala: 'O ruído branco tem potência infinita; quem a torna finita é o filtro. A conta é a área de um retângulo — o único cuidado é o fator 2 entre $N_0$ (unilateral) e $N_0/2$ (bilateral), que se cancela com a largura $2B$.',
      pergunta: 'Se eu reduzir a banda de 1 MHz para 125 kHz, quantos dB de ruído deixo de “ouvir”? (Resposta: $10\\log_{10}8\\approx9$ dB.)',
      tempo: '7 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'interp']);
      const { I, from, only } = st;
      const g = E('div', { style: { display: 'grid', gridTemplateColumns: '560px 1fr', gap: '12px' } }); lp.map.main.append(g);
      const colA = E('div', { class: 'vstack', style: { gap: '10px' } }), colB = E('div', { class: 'vstack', style: { gap: '12px' } }); g.append(colA, colB);
      const xo = { min: -1.5, max: 1.5, ticks: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], label: '$f$ (MHz)', lpos: 'end' };
      const Bp = k => k >= I('r6') && st.kind(k) !== 'final' ? BL / 1e6 : 1;
      const cA = chartCard(colA, 'Entrada: ruído branco $S_X=N_0/2$');
      const A = new Chart(cA, { w: 532, h: 140, m: { l: 58, r: 12, t: 16, b: 40 }, x: xo, y: { min: 0, max: 3.2, ticks: [0, 2], label: null } });
      A.add(new Curve({ f: () => N0h, color: C.navy, w: 3.6, vis: k => k >= 0 }));
      infArrows(A, N0h, C.navy);
      A.add(new Label({ x: 0, y: 2.75, html: `$N_0/2=${sciT(N0 / 2, 1)}$ W/Hz em toda $f$ — potência infinita`, size: 16, bg: true, vis: from('r1') }));
      const cH = chartCard(colA, '$\\times\\ |H(f)|^2$: passa-baixas ideal');
      const H = new Chart(cH, { w: 532, h: 120, m: { l: 58, r: 12, t: 16, b: 40 }, x: xo, y: { min: 0, max: 1.35, ticks: [0, 1] } });
      H.add(new Curve({ pts: p => [[-1.5, 0], [-p, 0], [-p, 1], [p, 1], [p, 0], [1.5, 0]], p: Bp, pdur: 1200, color: C.navy, w: 3.4, vis: from('r2') }));
      H.add(new Label({ x: 0, y: 0.5, html: p => p < 0.5 ? '$B=125$ kHz' : '$B=1$ MHz', p: Bp, size: 16, bg: true, vis: from('r2') }));
      const cY = chartCard(colA, '$=\\ S_Y(f)$ (×10⁻²¹ W/Hz)');
      const Y = new Chart(cY, { w: 532, h: 172, m: { l: 58, r: 12, t: 16, b: 40 }, x: xo, y: { min: 0, max: 3.2, ticks: [0, 1, 2, 3] } });
      Y.add(new Area({ f: () => N0h, a: p => -p, b: p => p, p: Bp, pdur: 1200, n: 4, fill: C.goldF, vis: from('r3') }));
      Y.add(new Curve({ pts: p => [[-1.5, 0], [-p, 0], [-p, N0h], [p, N0h], [p, 0], [1.5, 0]], p: Bp, pdur: 1200, color: C.petro, w: 3.6, vis: from('r2') }));
      Y.add(new Label({ x: 0, y: 1.0, html: p => p < 0.5 ? `$N_0B=${sciT(PL, 1)}$ W` : `área $=N_0B=${sciT(P1, 1)}$ W`, p: Bp, size: 17, weight: 600, bg: true, vis: from('r3'), delay: 600 }));
      Y.add(new Bracket({ x0: p => -p, x1: p => p, y: N0h, dy: -18, html: '$2B$', p: Bp, color: C.navy, vis: only('r3') }));
      /* régua de dBm */
      const cR = chartCard(colB, 'Régua de dBm');
      const Ru = dbRuler(cR, { h: 300, min: -180, max: -105, ticks: [-180, -174, -160, -150, -140, -123, -114].map(v => [v, nf(v, 0)]) });
      Ru.add(new Dot({ x: 0.14, y: -174, color: C.navy, r: 8, html: '$-174$ dBm/Hz', dx: 12, dy: 0, an: 'lm', size: 16, vis: from('r1') }));
      dbArrow(Ru, 0.14, -174, d1, '$+10\\log_{10}10^6$<br>$=+60$ dB', from('r4'));
      Ru.add(new Dot({ x: 0.14, y: d1, color: C.gold, r: 9, html: `$${tnum(d1, 0)}$ dBm (1 MHz)`, dx: 12, dy: 0, an: 'lm', size: 16, vis: from('r4'), delay: 900 }));
      dbArrow(Ru, 0.62, -174, dL, '$+51$ dB', from('r6'), C.petro);
      Ru.add(new Dot({ x: 0.62, y: dL, color: C.petro, r: 8, vis: from('r6'), delay: 900 }));
      Ru.add(new Label({ x: 0.97, y: -133, an: 'rm', html: `LoRa: $${tnum(dL, 0)}$ dBm<br><b>9 dB a menos</b>`, size: 15, color: C.petro, bg: true, vis: from('r6'), delay: 900 }));
      const cS = chartCard(colB, '$R_Y(\\tau)=N_0B\\,\\mathrm{sinc}(2B\\tau)$');
      const Rs = new Chart(cS, { w: 336, h: 226, m: { l: 52, r: 10, t: 22, b: 44 }, x: { min: -5, max: 5, ticks: [-4, -2, 0, 2, 4], label: '$\\tau$ (µs)', lpos: 'end' }, y: { min: -1.1, max: 4.6, ticks: [0, 2, 4], label: '×10⁻¹⁵ W' } });
      Rs.add(new Curve({ f: (t, p) => N0 * p * 1e6 / 1e-15 * sinc(2 * p * t), p: Bp, pdur: 1200, color: C.petro, w: 3.2, n: 900, vis: from('r5') }));
      Rs.add(new Label({ x: 2.6, y: 3.6, html: p => p < 0.5 ? 'zeros em $\\pm4$ µs' : 'zeros em $k/(2B)=0{,}5k$ µs', p: Bp, size: 14, bg: true, vis: from('r5') }));
      cS.style.opacity = 1;
      /* interpretação */
      const SS = { B: 1e6 };
      const ir = E('div', { style: { display: 'grid', gridTemplateColumns: '560px 1fr', gap: '12px' } }); lp.map.interp.append(ir);
      const ci = chartCard(ir, 'Saída do filtro ideal de banda $B$');
      const Yi = new Chart(ci, { w: 532, h: 470, m: { l: 58, r: 12, t: 30, b: 56 }, x: xo, y: { min: 0, max: 3.2, ticks: [0, 1, 2, 3], label: '×10⁻²¹ W/Hz' } });
      Yi.add(new Area({ f: () => N0h, a: () => -SS.B / 1e6, b: () => SS.B / 1e6, n: 4, fill: C.goldF }));
      Yi.add(new Curve({ f: x => Math.abs(x) < SS.B / 1e6 ? N0h : 0, color: C.petro, w: 3.4, n: 1600 }));
      Yi.add(new Label({ x: 0, y: 2.8, html: () => `$P_Y=N_0B=${sciT(N0 * SS.B, 1)}$ W`, size: 19, bg: true }));
      const cRi = chartCard(ir, 'Piso de ruído');
      const Rui = dbRuler(cRi, { h: 470, min: -180, max: -100, ticks: [-180, -174, -160, -140, -130, -120, -110].map(v => [v, nf(v, 0)]) });
      Rui.add(new Dot({ x: 0.2, y: -174, color: C.navy, r: 8, html: '$-174$ dBm/Hz', dx: 12, dy: 0, an: 'lm', size: 16 }));
      Rui.add(new Custom({ draw(c, g, p, mk) { const d = -174 + 10 * Math.log10(SS.B); SV('path', { d: arrowPath(c.X(0.2), c.Y(-174) - 8, c.X(0.2), c.Y(d), 13), stroke: C.goldD, 'stroke-width': 3.6, fill: 'none' }, g); SV('circle', { cx: c.X(0.2), cy: c.Y(d), r: 9, fill: C.gold, stroke: '#fff', 'stroke-width': 3 }, g); mk.lab('v').set(c.X(0.2) + 14, c.Y(d), labHTML({ html: `$${tnum(d, 1)}$ dBm`, size: 18, color: C.goldD, bg: true }), 'lm'); mk.lab('a').set(c.X(0.2) + 14, (c.Y(-174) + c.Y(d)) / 2, labHTML({ html: `$+${tnum(10 * Math.log10(SS.B), 1)}$ dB`, size: 16, color: C.goldD, bg: true }), 'lm'); } }));
      const ro = Readout(ctx.cards.interp, [['b', 'banda $B$'], ['p', 'potência de ruído'], ['d', 'em dBm', 'g']]);
      const upd = () => { ro.set('b', SS.B >= 1e6 ? nf(SS.B / 1e6, 2) + ' MHz' : nf(SS.B / 1e3, 0) + ' kHz'); ro.set('p', T(sciT(N0 * SS.B, 2) + '\\ \\mathrm{W}')); ro.set('d', nf(-174 + 10 * Math.log10(SS.B), 1) + ' dBm'); Yi.render(); Rui.render(); };
      const cc = E('div', { class: 'card', style: { marginTop: '10px', padding: '4px 14px' } }); lp.map.interp.append(cc);
      const sl = Slider(cc, { label: 'banda $B$', min: 4, max: Math.log10(1.5e6), step: 0.005, log: true, value: 6, fmt: v => v >= 1e6 ? nf(v / 1e6, 2) + ' MHz' : nf(v / 1e3, 0) + ' kHz', oninput: v => { SS.B = v; upd(); } });
      const bb = E('div', { style: { display: 'flex', gap: '8px', padding: '2px 0 8px' } }); cc.append(bb);
      [['1 MHz', 1e6], ['canal LoRa 125 kHz', 125e3], ['25 kHz (rádio estreito)', 25e3]].forEach(([t, v]) => bb.append(E('button', { class: 'btn ghost-d', text: t, onclick: () => { const v0 = SS.B; tween(700, x => { SS.B = Math.pow(10, lerp(Math.log10(v0), Math.log10(v), x)); sl.set(SS.B); upd(); }); } })));
      upd();
      return { goto(k, anim) { lp.show(st.kind(k) === 'interp' ? 'interp' : 'main'); [A, H, Y, Ru, Rs].forEach(c => c.goto(k, anim)); cS.style.opacity = k >= I('r5') ? 1 : .35; } };
    }
  });
})();

/* ---------- Q8.15 · Ruído branco através de um filtro RC ---------- */
(() => {
  const RC = 159e-6, f3 = 1 / (2 * PI * RC), BN = 1 / (4 * RC);
  const f3k = f3 / 1e3, BNk = BN / 1e3;
  const H2 = (fk, f3x = f3k) => 1 / (1 + (fk / f3x) ** 2);
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 1, tex: '|H(f)|^2=\\hl{\\frac{1}{1+(2\\pi fRC)^2}}', note: 'Módulo ao quadrado de $1/(1+\\j x)$ é $1/(1+x^2)$.' },
    { n: 'r2', k: 'res', tag: '(a)', road: 3, tex: 'S_Y(f)=\\hl{\\frac{N_0/2}{1+(2\\pi fRC)^2}}', note: 'Eq. (8.5).' },
    { n: 'r3', k: 'res', road: 4, tex: '\\text{Par: }\\frac{2\\sigma^2/a}{1+(2\\pi f/a)^2}\\ \\text{com }\\hl{a=\\tfrac{1}{RC}}\\ \\text{e}\\ \\hl{\\tfrac{2\\sigma^2}{a}=\\tfrac{N_0}{2}}', note: 'Casamento com a tabela (como na Q8.11).' },
    { n: 'r4', k: 'res', road: 4, tex: '\\sigma^2=\\frac{N_0a}{4}=\\hl{\\frac{N_0}{4RC}}', note: 'Potência de saída.' },
    { n: 'r5', k: 'res', tag: '(b)', road: 4, tex: 'R_Y(\\tau)=\\hl{\\frac{N_0}{4RC}e^{-|\\tau|/RC}}', note: 'O filtro deu ao ruído uma memória de $RC$ segundos.' },
    { n: 'r6', k: 'res', tag: '(c)', road: 5, tex: 'P_Y=R_Y(0)=\\hl{\\frac{N_0}{4RC}}', note: 'Finita, embora a entrada tivesse potência infinita.' },
    { n: 'r7', k: 'res', tag: '(d)', road: 4, tex: 'P_Y=N_0B_N\\Rightarrow\\hl{B_N=\\frac{1}{4RC}};\\ f_{3\\mathrm{dB}}=\\frac{1}{2\\pi RC}', note: 'Banda ideal que deixaria passar a mesma potência (Q8.14).' },
    { n: 'r8', k: 'res', road: 5, tex: 'B_N/f_{3\\mathrm{dB}}=\\frac{2\\pi RC}{4RC}=\\hl{\\frac{\\pi}{2}}', note: 'Mesmo resultado da Questão 8.13.' },
    { n: 'erro', k: 'erro' },
    { n: 'r9', k: 'res', tag: '(e)', road: 5, tex: `RC=159\\ \\mu\\mathrm s:\\ f_{3\\mathrm{dB}}\\approx\\hl{${tnum(f3k, 2)}\\ \\mathrm{kHz}},\\ B_N\\approx\\hl{${tnum(BNk, 2)}\\ \\mathrm{kHz}}`, note: 'Substituição direta.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-15', num: '8.15', level: 4, title: 'Ruído branco através de um filtro RC: nasce o ruído colorido', steps,
    enun: {
      html: 'Ruído branco de DEP $N_0/2$ passa por um filtro RC passa-baixas, $H(f)=\\frac{1}{1+\\j2\\pi fRC}$. (a) $S_Y(f)$. (b) $R_Y(\\tau)$. (c) Potência de saída. (d) Mostre que a banda equivalente de ruído é $B_N=\\frac{\\pi}{2}f_{3\\mathrm{dB}}$. (e) Números: $R=1$ kΩ, $C=159$ nF.',
      chips: ['$S_X=N_0/2$', '$R=1$ kΩ', '$C=159$ nF', '!$RC=159\\ \\mu$s']
    },
    plano: { html: '$|H|^2$ do RC é uma lorentziana; a saída é o ruído exponencial da Questão 8.6. Casar parâmetros com a tabela, como na Questão 8.11.', road: [3, 4] },
    erro: { html: `Estimar o ruído de saída de um RC como $N_0f_{3\\mathrm{dB}}$, isto é, um retângulo que termina em $f_{3\\mathrm{dB}}$. Esse retângulo tem só $2/\\pi\\approx${tnum(2 / PI, 2)}$ da área certa: <b>subestima a potência em cerca de 36% (≈ 2 dB)</b>. Para ruído, a banda que importa é a banda <i>equivalente</i> $B_N=\\frac{\\pi}{2}f_{3\\mathrm{dB}}$ — 57% maior que $f_{3\\mathrm{dB}}$. Em filtros de ordem mais alta as caudas caem mais depressa e $B_N$ se aproxima de $f_{3\\mathrm{dB}}$.` },
    final: { html: `$S_Y=\\frac{N_0/2}{1+(2\\pi fRC)^2}$, $R_Y(\\tau)=\\frac{N_0}{4RC}e^{-|\\tau|/RC}$, $P_Y=\\frac{N_0}{4RC}$ e $B_N=\\frac{\\pi}{2}f_{3\\mathrm{dB}}$ (com os números: $f_{3\\mathrm{dB}}\\approx${tnum(f3k, 2)}$ kHz e $B_N\\approx${tnum(BNk, 2)}$ kHz).` },
    interp: { boxes: [['interp', 'O ruído branco não tem memória nem potência finita; o filtro dá as duas coisas. A forma da DEP de saída é $|H|^2$ — por isso se fala em “ruído colorido”. Mude $RC$: a memória cresce, a banda estreita e a potência $N_0B_N$ cai na mesma proporção.', { size: 'xs' }]] },
    notes: {
      fala: 'Fig. 8.10: o filtro RC e o filtro ideal equivalente para ruído têm a mesma área sob $|H|^2$, logo a mesma potência de saída. A largura do ideal é $\\pi/2$ vezes a banda de 3 dB porque as caudas do RC deixam passar bastante ruído.',
      pergunta: 'Um colega estimou o ruído do RC como $N_0f_{3\\mathrm{dB}}$. Erra para mais ou para menos? Por quanto?',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'erro', 'interp']);
      const { I, from, only } = st;
      const g = E('div', { style: { display: 'grid', gridTemplateColumns: '560px 1fr', gap: '12px' } }); lp.map.main.append(g);
      const colA = E('div', { class: 'vstack', style: { gap: '10px' } }), colB = E('div', { class: 'vstack', style: { gap: '12px' } }); g.append(colA, colB);
      const xo = { min: -5, max: 5, ticks: [-4, -2, -1, 0, 1, 2, 4], label: '$f$ (kHz)', lpos: 'end' };
      const cA = chartCard(colA, 'Entrada: $S_X=N_0/2$');
      const A = new Chart(cA, { w: 532, h: 112, m: { l: 58, r: 12, t: 14, b: 40 }, x: xo, y: { min: 0, max: 1.4, ticks: [[0, '0'], [1, '\\tfrac{N_0}{2}']] } });
      A.add(new Curve({ f: () => 1, color: C.navy, w: 3.4, vis: k => k >= 0 })); infArrows(A, 1, C.navy);
      const cH = chartCard(colA, '$\\times\\ |H(f)|^2$ do RC');
      const H = new Chart(cH, { w: 532, h: 130, m: { l: 58, r: 12, t: 14, b: 40 }, x: xo, y: { min: 0, max: 1.3, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      H.add(new Curve({ f: x => H2(x), color: C.navy, w: 3.4, n: 700, vis: from('r1') }));
      H.add(new Label({ x: 3.2, y: 0.85, html: '$\\frac{1}{1+(2\\pi fRC)^2}$', size: 17, bg: true, vis: from('r1') }));
      const cY = chartCard(colA, '$=\\ S_Y(f)$ (em unidades de $N_0/2$)');
      const Y = new Chart(cY, { w: 532, h: 250, m: { l: 58, r: 12, t: 20, b: 44 }, x: xo, y: { min: 0, max: 1.4, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      Y.add(new Area({ f: x => H2(x), fill: C.petroF, n: 600, vis: from('r2') }));
      Y.add(new Curve({ f: x => H2(x), color: C.petro, w: 3.8, n: 700, vis: from('r2') }));
      Y.add(new Label({ x: 3.3, y: 0.85, html: 'lorentziana:<br>“ruído colorido”', size: 16, bg: true, color: C.petro, vis: only('r2', 'r3') }));
      Y.add(new Label({ x: 3.3, y: 0.85, html: '$a=1/RC$<br>$2\\sigma^2/a=N_0/2$', size: 16, bg: true, color: C.goldD, vis: only('r3') }));
      Y.add(new Label({ x: 3.2, y: 0.8, html: 'área $=\\frac{N_0}{4RC}\\cdot2\\,/\\,\\frac{N_0}{2}$…<br>$P_Y=\\frac{N_0}{4RC}$', size: 15, bg: true, vis: only('r4', 'r6') }));
      Y.add(new Rect({ x0: -BNk, x1: BNk, y0: 0, y1: 1, fill: 'rgba(227,162,59,.22)', stroke: C.goldD, dash: '8 5', sw: 2.6, vis: from('r7'), reveal: 'draw' }));
      Y.add(new Bracket({ x0: -BNk, x1: BNk, y: 1, dy: -16, html: '$2B_N$ (mesma área)', color: C.goldD, vis: from('r7') }));
      for (const s of [1, -1]) Y.add(new VLine({ x: s * f3k, y0: 0, y1: 0.5, color: C.red, w: 2.4, vis: from('r8'), html: s > 0 ? '$f_{3\\mathrm{dB}}$' : null, an: 'lm', dx: 6, dy: 0, ly: 0.25 }));
      Y.add(new Label({ x: -4.9, y: 1.28, an: 'lm', html: `$B_N=\\frac{\\pi}{2}f_{3\\mathrm{dB}}$`, size: 17, bg: true, color: C.goldD, vis: only('r8') }));
      Y.add(new Label({ x: -4.9, y: 1.25, an: 'lm', html: `$f_{3\\mathrm{dB}}\\approx${tnum(f3k, 2)}$ kHz · $B_N\\approx${tnum(BNk, 2)}$ kHz`, size: 16, bg: true, vis: from('r9') }));
      const cR = chartCard(colB, 'Autocorrelação de saída $R_Y(\\tau)$');
      const R = new Chart(cR, { w: 336, h: 300, m: { l: 52, r: 10, t: 34, b: 44 }, x: { min: -800, max: 800, ticks: [-800, -400, 0, 400, 800], label: '$\\tau$ (µs)', lpos: 'end' }, y: { min: 0, max: 1.2, ticks: [[0, '0'], [1, '\\tfrac{N_0}{4RC}']] } });
      R.add(new Curve({ f: t => Math.exp(-Math.abs(t) / 159), color: C.petro, w: 3.6, n: 800, vis: from('r5') }));
      R.add(new Bracket({ x0: 0, x1: 159, y: Math.exp(-1), html: 'memória $RC$', color: C.goldD, vis: from('r5'), size: 15 }));
      R.add(new Dot({ x: 0, y: 1, color: C.gold, html: '$P_Y=R_Y(0)$', dx: 12, dy: -4, an: 'lm', size: 15, vis: from('r6') }));
      const nums = E('div', { class: 'card', style: { padding: '12px 16px', fontSize: '19px', lineHeight: 1.6 } }); colB.append(nums);
      nums.innerHTML = md(`$RC=159\\ \\mu$s<br>$f_{3\\mathrm{dB}}=\\frac{1}{2\\pi RC}\\approx${tnum(f3k, 2)}$ kHz<br>$B_N=\\frac{1}{4RC}\\approx${tnum(BNk, 2)}$ kHz<br><b style="color:#A86B12">$B_N/f_{3\\mathrm{dB}}=\\pi/2\\approx${tnum(PI / 2, 2)}$</b>`);
      /* erro comum */
      const er = E('div', { class: 'hrow', style: { alignItems: 'flex-start' } }); lp.map.erro.append(er);
      const cW = chartCard(er, '<span style="color:#9E2B25">✗ Retângulo em $f_{3\\mathrm{dB}}$</span>', { style: { flex: '1' } });
      const cOk = chartCard(er, '<span style="color:#146B73">✓ Retângulo em $B_N$</span>', { style: { flex: '1' } });
      const eo = () => ({ w: 440, h: 600, m: { l: 52, r: 12, t: 40, b: 56 }, x: { min: -5, max: 5, ticks: [-4, -2, 0, 2, 4], label: '$f$ (kHz)', lpos: 'end' }, y: { min: 0, max: 1.5, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]), label: '$S_Y/(N_0/2)$' } });
      const eW = new Chart(cW, eo()), eR = new Chart(cOk, eo());
      for (const c of [eW, eR]) { c.add(new Area({ f: x => H2(x), fill: C.petroF, n: 500 })); c.add(new Curve({ f: x => H2(x), color: C.petro, w: 3, n: 600 })); }
      eW.add(new Rect({ x0: -f3k, x1: f3k, y0: 0, y1: 1, fill: 'rgba(192,57,43,.35)', stroke: C.red, vis: only('erro') }));
      eW.add(new Label({ x: 0, y: 1.32, html: `área $=2f_{3\\mathrm{dB}}$: só $${tnum(100 * 2 / PI, 0)}\\%$<br><b>−36% (≈ 2 dB)</b> ✗`, size: 18, color: C.red, bg: true, vis: only('erro'), delay: 500 }));
      eR.add(new Rect({ x0: -BNk, x1: BNk, y0: 0, y1: 1, fill: 'rgba(227,162,59,.35)', stroke: C.goldD, vis: only('erro') }));
      eR.add(new Label({ x: 0, y: 1.32, html: 'área $=2B_N=\\pi f_{3\\mathrm{dB}}$<br>= área da lorentziana ✓', size: 18, color: C.petro, bg: true, vis: only('erro'), delay: 500 }));
      eR.add(new Label({ x: 3.5, y: 0.55, html: '$B_N=1{,}57\\,f_{3\\mathrm{dB}}$', size: 16, color: C.goldD, bg: true, vis: only('erro'), delay: 900 }));
      /* interpretação: slider RC */
      const SS = { rc: 159 };
      const ir = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }); lp.map.interp.append(ir);
      const ci1 = chartCard(ir, '$S_Y(f)$ e o retângulo $B_N$'), ci2 = chartCard(ir, '$R_Y(\\tau)$');
      const f3x = () => 1 / (2 * PI * SS.rc * 1e-6) / 1e3, bnx = () => 1 / (4 * SS.rc * 1e-6) / 1e3;
      const Yi = new Chart(ci1, { w: 430, h: 470, m: { l: 52, r: 12, t: 30, b: 56 }, x: { min: -5, max: 5, ticks: [-4, -2, 0, 2, 4], label: '$f$ (kHz)', lpos: 'end' }, y: { min: 0, max: 1.3, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
      Yi.add(new Area({ f: x => H2(x, f3x()), fill: C.petroF, n: 500 })); Yi.add(new Curve({ f: x => H2(x, f3x()), color: C.petro, w: 3.4, n: 600 }));
      Yi.add(new Custom({ draw(c, g) { const b = bnx(); SV('path', { d: dPath(c, [[-b, 0], [-b, 1], [b, 1], [b, 0]]), stroke: C.goldD, 'stroke-width': 2.6, 'stroke-dasharray': '8 5', fill: 'rgba(227,162,59,.18)' }, g); } }));
      const Ri = new Chart(ci2, { w: 430, h: 470, m: { l: 52, r: 12, t: 30, b: 56 }, x: { min: 0, max: 1500, ticks: [0, 500, 1000, 1500], label: '$\\tau$ (µs)', lpos: 'end' }, y: { min: 0, max: 7.2, ticks: [0, 2, 4, 6], label: '$R_Y$ (× $N_0\\cdot10^3$)' } });
      Ri.add(new Curve({ f: t => 1 / (4 * SS.rc * 1e-6) / 1e3 * Math.exp(-t / SS.rc), color: C.petro, w: 3.4, n: 600 }));
      Ri.add(new Custom({ draw(c, g, p, mk) { const v = 1 / (4 * SS.rc * 1e-6) / 1e3; SV('circle', { cx: c.X(0), cy: c.Y(v), r: 8, fill: C.gold, stroke: '#fff', 'stroke-width': 3 }, g); mk.lab('p').set(c.X(0) + 14, c.Y(v), labHTML({ html: `$P_Y=N_0B_N$`, size: 17, bg: true }), 'lm'); } }));
      const ro = Readout(ctx.cards.interp, [['rc', '$RC$'], ['f3', '$f_{3\\mathrm{dB}}$'], ['bn', '$B_N=\\frac{\\pi}{2}f_{3\\mathrm{dB}}$', 'g'], ['p', '$P_Y=N_0B_N$']]);
      const upd = () => { ro.set('rc', nf(SS.rc, 0) + ' µs'); ro.set('f3', nf(f3x(), 2) + ' kHz'); ro.set('bn', nf(bnx(), 2) + ' kHz'); ro.set('p', 'N₀ × ' + nf(bnx() * 1e3, 0) + ' Hz'); Yi.render(); Ri.render(); };
      Slider(lp.map.interp, { label: '$RC$', min: 50, max: 500, step: 1, value: 159, fmt: v => nf(v, 0) + ' µs', oninput: v => { SS.rc = v; upd(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return { goto(k, anim) { const kind = st.kind(k); lp.show(kind === 'erro' ? 'erro' : kind === 'interp' ? 'interp' : 'main'); [A, H, Y, R, eW, eR].forEach(c => c.goto(k, anim)); cR.style.opacity = k >= I('r5') ? 1 : .35; nums.style.opacity = k >= I('r9') || st.kind(k) === 'final' ? 1 : .3; } };
    }
  });
})();

/* ---------- Q8.16 · Johnson–Nyquist e kT/C ---------- */
(() => {
  const TT = 300, R0 = 100, df = 1e6, C0 = 1e-12;
  const G = 4 * KB * TT * R0, v2 = G * df, vr = Math.sqrt(v2), kTC = KB * TT / C0, vC = Math.sqrt(kTC);
  const fc0 = 1 / (2 * PI * R0 * C0) / 1e9;                 /* GHz */
  const SC = (fG, R) => 2 * KB * TT * R / (1 + (2 * PI * fG * 1e9 * R * C0) ** 2);
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', tag: '(a)', road: 4, tex: `\\overline{v^2}=4kTR\\,\\Delta f=4(1{,}38\\times10^{-23})(300)(100)(10^6)\\approx\\hl{${sciT(v2, 2)}}\\ \\mathrm{V^2}`, note: 'DEP unilateral × banda.' },
    { n: 'r2', k: 'res', road: 5, tex: `v_{\\rms}\\approx\\hl{${tnum(vr * 1e6, 2)}\\ \\mu\\mathrm V}`, note: 'A nota de referência obtém 1,28 µV (temperatura ligeiramente menor).' },
    { n: 'r3', k: 'res', tag: '(b)', road: 1, tex: 'S_V(f)=\\hl{2kTR}\\ \\text{(bilateral)};\\ H(f)=\\hl{\\frac{1}{1+\\j2\\pi fRC}}', note: 'Divisor de tensão entre $R$ e $C$.' },
    { n: 'r4', k: 'res', road: 3, tex: '\\overline{v_C^2}=\\int_{-\\infty}^{\\infty}\\frac{2kTR}{1+(2\\pi fRC)^2}\\,\\dd f', note: 'Eq. (8.5).' },
    { n: 'r5', k: 'res', road: 4, tex: '=2kTR\\cdot\\frac{1}{2RC}=\\hl{\\frac{kT}{C}}', note: '$\\int\\frac{\\dd f}{1+(2\\pi fRC)^2}=\\frac{1}{2RC}$ (troca $u=2\\pi fRC$).' },
    { n: 'r6', k: 'res', tag: '(c)', road: 5, tex: '\\text{mais }R\\Rightarrow\\text{DEP }\\hl{\\text{maior}}\\ (\\propto R),\\ \\text{banda }\\hl{\\text{menor}}\\ (\\propto1/R)', note: 'Os dois efeitos se cancelam exatamente.' },
    { n: 'r7', k: 'res', tag: '(d)', road: 5, tex: `\\overline{v_C^2}=\\frac{4{,}14\\times10^{-21}}{10^{-12}}=${sciT(kTC, 2)}\\ \\mathrm{V^2}\\Rightarrow v_{\\rms}\\approx\\hl{${tnum(vC * 1e6, 0)}\\ \\mu\\mathrm V}`, note: 'Um capacitor de 1 pF “treme” 64 µV à temperatura ambiente.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  /* circuito de Thévenin: fonte de ruído + R + C */
  function circuit() {
    const s = SV('svg', { viewBox: '0 0 320 196', class: 'chart' });
    const st = { stroke: C.ink, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    SV('circle', Object.assign({ cx: 50, cy: 100, r: 24 }, st), s);
    SV('path', { d: 'M38 100q6 -10 12 0t12 0', stroke: C.goldD, 'stroke-width': 3, fill: 'none' }, s);
    SV('path', Object.assign({ d: 'M50 76V30H90' }, st), s);
    SV('path', Object.assign({ d: 'M90 30l6 -10 12 20 12 -20 12 20 12 -20 12 20 6 -10H220' }, st), s);
    SV('path', Object.assign({ d: 'M220 30H250V86M232 86H268M232 104H268M250 104V160H50V124' }, st), s);
    const t = (x, y, txt, col, sz = 18) => { const e = SV('text', { x, y, 'text-anchor': 'middle', fill: col || C.ink, 'font-size': sz, 'font-family': 'Crimson Pro, Georgia, serif', 'font-style': 'italic' }, s); e.textContent = txt; };
    t(150, 64, 'R (sem ruído)', C.ink, 17); t(286, 100, 'C', C.ink, 20); t(60, 188, 'fonte: 2kTR', C.goldD, 16);
    SV('path', { d: 'M290 40V160', stroke: C.petro, 'stroke-width': 2, 'stroke-dasharray': '5 4', fill: 'none' }, s);
    t(300, 30, 'v_C', C.petro, 18);
    return s;
  }
  Question({
    id: 'q8-16', num: '8.16', level: 4, title: 'Ruído de Johnson–Nyquist e o ruído $kT/C$', steps,
    enun: {
      html: 'Um resistor $R$ à temperatura $T$ tem, em circuito aberto, ruído com DEP <i>unilateral</i> $G_V(f)=4kTR$ (Nyquist). (a) Ruído eficaz de 100 Ω a 300 K numa banda de 1 MHz. (b) Ligado a um capacitor $C$ (RC): mostre que $\\overline{v_C^2}=kT/C$. (c) Por que não depende de $R$? (d) Ruído eficaz para $C=1$ pF a 300 K.',
      chips: ['$G_V=4kTR$ (unilateral)', '$R=100\\,\\Omega$', '$T=300$ K', '!$C=1$ pF']
    },
    plano: { html: '(a) é a conta da Questão 8.3 com $4kTR$ no lugar de $e_n^2$. Em (b), o modelo de Thévenin do resistor ruidoso é uma fonte de ruído em série com $R$; a função de transferência da fonte até o capacitor é a do RC. Converter para DEP <b>bilateral</b> ($2kTR$) antes de integrar de $-\\infty$ a $\\infty$.', road: [1, 3] },
    final: { html: `(a) $\\approx${tnum(vr * 1e6, 1)}\\ \\mu$V eficazes. (b) $\\overline{v_C^2}=kT/C$. (c) $R$ aumenta a densidade e estreita a banda na mesma proporção. (d) $\\approx${tnum(vC * 1e6, 0)}\\ \\mu$V eficazes para 1 pF.` },
    interp: {
      boxes: [
        ['interp', 'O resultado $\\frac12C\\overline{v_C^2}=\\frac12kT$ é o <b>teorema da equipartição</b>: a energia média no capacitor é $\\frac12kT$, como a energia cinética média de uma molécula por grau de liberdade. Não poderia depender de $R$: o resistor só “conecta” o capacitor ao banho térmico.', { size: 'xs' }],
        ['aplic', 'O ruído $kT/C$ é o limite fundamental dos circuitos <i>sample-and-hold</i> de todo conversor A/D e dos pixels CMOS. Só se reduz aumentando $C$ ou com <i>amostragem dupla correlacionada</i>.', { size: 'xs' }]
      ]
    },
    notes: {
      fala: 'Curiosidade histórica (Seção 8.11): em 1928 a Physical Review publicou dois artigos consecutivos — Johnson <i>mediu</i> a tensão de ruído dos resistores; Nyquist <i>explicou</i> com linha de transmissão e equilíbrio térmico, a fórmula $4kTR\\Delta f$. Os dois eram suecos de nascimento e trabalhavam na AT&T/Bell Labs.',
      pergunta: 'Se eu trocar o resistor de 100 Ω por um de 1 MΩ no circuito RC, o ruído no capacitor aumenta?',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['a', 'b', 'interp']);
      const { I, from, only } = st;
      /* (a) */
      const ga = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: '12px' } }); lp.map.a.append(ga);
      const ca = chartCard(ga, 'DEP unilateral do resistor (circuito aberto)');
      const Ga = new Chart(ca, { w: 594, h: 560, m: { l: 66, r: 14, t: 40, b: 60 }, x: { min: 0, max: 1.3, ticks: [0, 0.25, 0.5, 0.75, 1, 1.25].map(v => [v, nf(v, 2)]), label: '$f$ (MHz)', lpos: 'end' }, y: { min: 0, max: 2.3, ticks: [0, 0.5, 1, 1.5, 2].map(v => [v, nf(v, 1)]), label: '$G_V$ ($\\times10^{-18}$ V²/Hz)' } });
      Ga.add(new Area({ f: () => G / 1e-18, a: 0, b: 1, n: 4, fill: C.goldF, vis: from('r1'), delay: 400 }));
      Ga.add(new Curve({ f: () => G / 1e-18, color: C.petro, w: 4, vis: k => k >= 0 }));
      Ga.add(new Label({ x: 0.65, y: 2.12, html: `$4kTR=${sciT(G, 2)}$ V²/Hz`, size: 18, bg: true, color: C.petro, vis: k => k >= 0 }));
      Ga.add(new Label({ x: 0.5, y: 0.8, html: `área $=4kTR\\,\\Delta f\\approx${sciT(v2, 2)}$ V²`, size: 19, weight: 600, bg: true, vis: from('r1'), delay: 900 }));
      Ga.add(new Bracket({ x0: 0, x1: 1, y: G / 1e-18, dy: -18, html: '$\\Delta f=1$ MHz', color: C.navy, vis: from('r1') }));
      Ga.add(new Label({ x: 0.5, y: 0.35, html: `$\\sqrt{\\ }\\ \\to\\ v_{\\rms}\\approx${tnum(vr * 1e6, 2)}\\ \\mu$V`, size: 21, color: C.goldD, weight: 600, bg: true, vis: from('r2') }));
      const cr = chartCard(ga, 'Fórmula de Nyquist');
      cr.append(E('div', { style: { fontSize: '20px', lineHeight: 1.7, padding: '6px 8px' }, html: md(`$G_V=4kTR$<br>$k=1{,}38\\times10^{-23}$ J/K<br>$T=300$ K, $R=100\\,\\Omega$<br>$\\Rightarrow ${sciT(G, 2)}$ V²/Hz<br><span style="color:#A86B12">unilateral: integra de $0$ a $\\infty$</span>`) }));
      /* (b)–(d) */
      const gb = E('div', { style: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '12px' } }); lp.map.b.append(gb);
      const cc = chartCard(gb, 'Modelo de Thévenin + capacitor');
      cc.append(circuit());
      const bx = E('div', { style: { fontSize: '17px', lineHeight: 1.55, padding: '6px 4px', color: '#33495C' }, html: md('Fonte de ruído $2kTR$ (bilateral) em série com $R$ ideal. Da fonte ao capacitor: $H(f)=\\frac{1}{1+\\j2\\pi fRC}$.') }); cc.append(bx);
      const cnum = E('div', { style: { fontSize: '19px', lineHeight: 1.6, padding: '8px 6px', borderTop: '1px solid #DCE4E7', marginTop: '6px' } }); cc.append(cnum);
      cnum.innerHTML = md(`$C=1$ pF, $T=300$ K:<br>$kT/C=${sciT(kTC, 2)}$ V²<br><b style="color:#A86B12">$v_{\\rms}\\approx${tnum(vC * 1e6, 0)}\\ \\mu$V</b>`);
      const cb = chartCard(gb, '$S_{V_C}(f)=2kTR\\,|H(f)|^2$ com $C=1$ pF');
      const Rp = k => k >= I('r6') && k <= I('r6') ? 200 : 100;
      const Gb = new Chart(cb, { w: 594, h: 560, m: { l: 66, r: 14, t: 40, b: 60 }, x: { min: -6, max: 6, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$f$ (GHz)', lpos: 'end' }, y: { min: 0, max: 1.95, ticks: [0, 0.5, 1, 1.5].map(v => [v, nf(v, 1)]), label: '$\\times10^{-18}$ V²/Hz' } });
      Gb.add(new Curve({ f: () => 2 * KB * TT * R0 / 1e-18, color: C.navy, w: 2.4, dash: '8 6', vis: only('r3') }));
      Gb.add(new Label({ x: 3.4, y: 0.98, html: '$2kTR$ (bilateral, plana)', size: 16, bg: true, color: C.navy, vis: only('r3') }));
      Gb.add(new Area({ f: x => SC(x, R0) / 1e-18, fill: C.petroF, n: 700, vis: from('r4') }));
      Gb.add(new Curve({ f: x => SC(x, R0) / 1e-18, color: C.petro, w: 3.8, n: 900, vis: from('r3'), delay: 500 }));
      Gb.add(new Label({ x: 3.6, y: 0.45, html: '$R=100\\,\\Omega$', size: 17, color: C.petro, bg: true, vis: from('r3') }));
      Gb.add(new Label({ x: 3.3, y: 1.3, html: `área $=kT/C=${sciT(kTC, 2)}$ V²`, size: 18, weight: 600, bg: true, vis: from('r5'), delay: 300 }));
      for (const s of [1, -1]) Gb.add(new VLine({ x: s * fc0, y0: 0, y1: SC(fc0, R0) / 1e-18, color: C.red, w: 2.2, vis: only('r4', 'r5'), html: s > 0 ? `$\\frac{1}{2\\pi RC}=${tnum(fc0, 2)}$ GHz` : null, an: 'lb', dx: 4, dy: -4, size: 15 }));
      Gb.add(new Area({ f: x => SC(x, 200) / 1e-18, fill: 'rgba(227,162,59,.35)', n: 700, vis: only('r6') }));
      Gb.add(new Curve({ f: x => SC(x, 200) / 1e-18, color: C.goldD, w: 3.8, n: 900, vis: only('r6') }));
      Gb.add(new Label({ x: -5.8, y: 1.82, an: 'lm', html: '$R=200\\,\\Omega$: altura $\\times2$, largura $\\div2$<br><b>mesma área $kT/C$</b>', size: 17, color: C.goldD, bg: true, vis: only('r6'), delay: 600 }));
      /* interpretação: R de 10 Ω a 1 MΩ, eixos log */
      const SS = { R: 100 };
      const ir = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 270px', gap: '12px' } }); lp.map.interp.append(ir);
      const ci = chartCard(ir, 'DEP no capacitor ($C=1$ pF), eixos logarítmicos');
      const Li = new Chart(ci, { w: 624, h: 500, m: { l: 66, r: 14, t: 34, b: 60 }, x: { min: 3, max: 12, ticks: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(v => [v, '10^{' + v + '}']), label: '$f$ (Hz)', lpos: 'end' }, y: { min: 1, max: 2, db: true, dmin: -200, dmax: -130, dticks: [-200, -190, -180, -170, -160, -150, -140, -130], dlabel: 'dB(V²/Hz)' } });
      const Sl = lf => 2 * KB * TT * SS.R / (1 + (2 * PI * Math.pow(10, lf) * SS.R * C0) ** 2);
      Li.add(new Area({ f: Sl, fill: C.goldF2, n: 400 }));
      Li.add(new Curve({ f: Sl, color: C.petro, w: 3.8, n: 500 }));
      Li.add(new Custom({ draw(c, g, p, mk) { const lf = Math.log10(1 / (2 * PI * SS.R * C0)); if (lf < 12) { SV('line', { x1: c.X(lf), x2: c.X(lf), y1: c.y0, y2: c.y1, stroke: C.red, 'stroke-width': 2, 'stroke-dasharray': '6 5' }, g); mk.lab('f').set(c.X(lf) + 6, c.y0 + 14, labHTML({ html: 'canto $\\frac{1}{2\\pi RC}$', size: 15, color: C.red, bg: true }), 'lt'); } mk.lab('h').set(c.X(3.1), c.Y(2 * KB * TT * SS.R) - 8, labHTML({ html: 'altura $2kTR\\propto R$', size: 16, color: C.petro, bg: true }), 'lb'); } }));
      const side = E('div', { class: 'vstack' }); ir.append(side);
      const big = E('div', { class: 'card', style: { padding: '14px 16px', textAlign: 'center' } }); side.append(big);
      const eqb = chartCard(side, 'Equipartição');
      const Eq = new Chart(eqb, { w: 242, h: 220, m: { l: 14, r: 14, t: 18, b: 52 }, x: { min: 0, max: 2, ticks: [[0.5, '\\tfrac12C\\overline{v_C^2}'], [1.5, '\\tfrac12kT']] }, y: { min: 0, max: 2.6, ticks: [] }, grid: false });
      Eq.add(new Custom({ draw(c, g, p, mk) { const v = 0.5 * C0 * kTC / 1e-21, w = c.X(0.35) - c.X(0); [[0.5, C.petro], [1.5, C.goldD]].forEach(([x, col]) => SV('rect', { x: c.X(x) - w, y: c.Y(v), width: 2 * w, height: c.Y(0) - c.Y(v), fill: col }, g)); mk.lab('v').set(c.X(1), c.Y(v) - 6, labHTML({ html: `$${sciT(v * 1e-21, 2)}$ J`, size: 15, bg: true }), 'cb'); } }));
      const upd = () => {
        const area = 2 * KB * TT * SS.R / (2 * SS.R * C0);
        big.innerHTML = `<div style="font-size:14px;letter-spacing:.12em;color:#4E6476">ÁREA SOB A CURVA</div><div style="font-size:16px;margin:4px 0">${T('2kTR\\times\\frac{1}{2RC}=\\frac{kT}{C}')}</div><div style="font-size:30px;font-weight:700;color:#146B73">${T(sciT(area, 2) + '\\ \\mathrm{V^2}')}</div><div style="font-size:15px;color:#A86B12;font-weight:600">não muda com R</div>`;
        Li.render();
      };
      const ro = Readout(ctx.cards.interp, [['r', '$R$'], ['h', 'altura $2kTR$'], ['b', 'canto $1/(2\\pi RC)$'], ['v', '$v_{\\rms}$ no capacitor', 'g']]);
      const upr = () => { ro.set('r', SS.R >= 1e6 ? nf(SS.R / 1e6, 2) + ' MΩ' : SS.R >= 1e3 ? nf(SS.R / 1e3, 1) + ' kΩ' : nf(SS.R, 0) + ' Ω'); ro.set('h', T(sciT(2 * KB * TT * SS.R, 2) + '\\ \\mathrm{V^2/Hz}')); const fc = 1 / (2 * PI * SS.R * C0); ro.set('b', fc >= 1e9 ? nf(fc / 1e9, 2) + ' GHz' : fc >= 1e6 ? nf(fc / 1e6, 1) + ' MHz' : nf(fc / 1e3, 0) + ' kHz'); ro.set('v', nf(vC * 1e6, 0) + ' µV (fixo)'); upd(); };
      Slider(lp.map.interp, { label: '$R$', min: 1, max: 6, step: 0.01, log: true, value: 2, fmt: v => v >= 1e6 ? nf(v / 1e6, 2) + ' MΩ' : v >= 1e3 ? nf(v / 1e3, 1) + ' kΩ' : nf(v, 0) + ' Ω', oninput: v => { SS.R = v; upr(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upr();
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          lp.show(kind === 'interp' ? 'interp' : (k >= I('r3') ? 'b' : 'a'));
          cnum.style.opacity = k >= I('r7') ? 1 : .2;
          Ga.goto(k, anim); Gb.goto(k, anim);
        }
      };
    }
  });
})();

/* ---------- Q8.17 · Promediar M amostras ---------- */
(() => {
  const A = 0.9, M0 = 10;
  const fej = (w, M) => { const s = Math.sin(w / 2); return Math.abs(s) < 1e-9 ? 1 : (Math.sin(M * w / 2) / (M * s)) ** 2; };
  const Sar = w => (1 - A * A) / (1 - 2 * A * Math.cos(w) + A * A);
  const brk = M => { let s = 1; for (let k = 1; k < M; k++) s += 2 * (1 - k / M) * Math.pow(A, k); return s; };
  const PYar = M => brk(M) / M;
  const b10 = brk(M0), py10 = PYar(M0);
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', tag: '(a)', road: 4, tex: 'H(e^{\\j\\omega})=\\frac1M\\sum_{n=0}^{M-1}e^{-\\j\\omega n}=\\hl{\\frac1M\\,\\frac{1-e^{-\\j\\omega M}}{1-e^{-\\j\\omega}}}', note: 'Soma geométrica finita.' },
    { n: 'r2', k: 'res', road: 4, tex: '=\\frac1M\\,e^{-\\j\\omega(M-1)/2}\\,\\hl{\\frac{\\mathrm{sen}(M\\omega/2)}{\\mathrm{sen}(\\omega/2)}}', note: 'Colocando $e^{-\\j\\omega M/2}$ e $e^{-\\j\\omega/2}$ em evidência.' },
    { n: 'r3', k: 'res', road: 5, tex: '|H(e^{\\j\\omega})|^2=\\hl{\\frac{1}{M^2}\\frac{\\mathrm{sen}^2(M\\omega/2)}{\\mathrm{sen}^2(\\omega/2)}}', note: 'Passa-baixas com primeiro zero em $\\omega=2\\pi/M$: o núcleo de Fejér.' },
    { n: 'r4', k: 'res', tag: '(b)', road: 3, tex: 'P_Y=\\frac{1}{2\\pi}\\int_{-\\pi}^{\\pi}|H|^2\\sigma^2\\,\\dd\\omega=\\hl{\\sigma^2\\sum_nh[n]^2}', note: 'Parseval discreto.' },
    { n: 'r5', k: 'res', road: 5, tex: '=\\sigma^2\\cdot M\\cdot\\frac{1}{M^2}=\\hl{\\frac{\\sigma^2}{M}}', note: 'Confere com a variância da média de $M$ v.a. i.i.d. (Capítulo 3).' },
    { n: 'r6', k: 'res', tag: '(c)', road: 4, tex: 'P_Y=\\frac{1}{M^2}\\sum_i\\sum_jR_X[i-j]=\\hl{\\frac{\\sigma^2}{M}\\Big[1+2\\sum_{k=1}^{M-1}\\Big(1-\\frac kM\\Big)a^k\\Big]}', note: 'Lema da contagem, versão discreta: $M-k$ pares com defasagem $k$.' },
    { n: 'r7', k: 'res', road: 5, tex: `a=0{,}9,\\ M=10:\\ \\text{colchete}\\approx${tnum(b10, 2)}\\Rightarrow P_Y\\approx\\hl{${tnum(py10, 2)}\\sigma^2}`, note: `A variância cai só por um fator $\\approx${tnum(1 / py10, 2)}$, e não por 10.` },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-17', num: '8.17', level: 4, title: 'Promediar $M$ amostras: quando a regra $1/M$ funciona e quando falha', steps,
    enun: {
      html: 'Um nó IoT tira a média de $M$ leituras consecutivas: $Y[n]=\\frac1M\\sum_{i=0}^{M-1}X[n-i]$. (a) $H(e^{\\j\\omega})$ e $|H(e^{\\j\\omega})|^2$. (b) Se $X$ é branco de variância $\\sigma^2$, mostre que $P_Y=\\sigma^2/M$. (c) Se $X$ é o AR(1) da Q8.8 com $a=0{,}9$ e $M=10$, quanto vale $P_Y$?',
      chips: ['média de $M$ leituras', '$M=10$', '!AR(1), $a=0{,}9$']
    },
    plano: { html: '$h[n]=\\frac1M$ para $0\\le n\\le M-1$: a resposta em frequência é uma soma geométrica finita. Para (b), usar Parseval em vez de integrar $|H|^2$. Para (c), trabalhar no tempo: a variância de uma média é a soma de todas as covariâncias.', road: [3, 4] },
    final: { html: `$|H|^2=\\frac{1}{M^2}\\frac{\\mathrm{sen}^2(M\\omega/2)}{\\mathrm{sen}^2(\\omega/2)}$. Com ruído branco, $P_Y=\\sigma^2/M$. Com o AR(1) de $a=0{,}9$ e $M=10$, $P_Y\\approx${tnum(py10, 2)}\\sigma^2$: a média de 10 leituras correlacionadas vale tanto quanto $\\approx${tnum(1 / py10, 1)}$ leituras independentes.` },
    interp: { boxes: [['interp', 'O filtro de média é um passa-baixas que corta as frequências acima de $\\approx2\\pi/M$. Ruído branco: a maior parte da potência está acima do corte e é removida. AR(1) com $a=0{,}9$: quase toda a potência está <i>abaixo</i> do corte e passa intacta. A regra “a incerteza cai com $1/\\sqrt M$” pressupõe amostras independentes; a DEP diz quando essa hipótese vale.', { size: 'xs' }]] },
    notes: {
      fala: 'Mesma operação, dois resultados opostos. A explicação está no espectro: compare onde está a potência do processo com onde está a banda passante do filtro de média.',
      pergunta: 'Um sensor de temperatura lento ($a$ perto de 1): vale a pena promediar 100 leituras seguidas?',
      tempo: '8 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['main', 'count', 'interp']);
      const { I, from, only } = st;
      const SS = { M: M0, live: false };
      const Mv = () => SS.M;
      const mk = (parent, h1 = 200, h2 = 290) => {
        const cF = chartCard(parent, '$|H(e^{\\j\\omega})|^2$ — núcleo de Fejér');
        const F = new Chart(cF, { w: 904, h: h1, m: { l: 60, r: 14, t: 16, b: 50 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$', lpos: 'end' }, y: { min: 0, max: 1.2, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]) } });
        const row = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' } }); parent.append(row);
        const cW = chartCard(row, 'Ruído branco: $S_X=\\sigma^2$'), cA = chartCard(row, 'AR(1), $a=0{,}9$');
        const W = new Chart(cW, { w: 430, h: h2, m: { l: 52, r: 12, t: 30, b: 50 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$', lpos: 'end' }, y: { min: 0, max: 1.35, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]), label: '$/\\sigma^2$' } });
        const Ar = new Chart(cA, { w: 430, h: h2, m: { l: 52, r: 12, t: 30, b: 50 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$', lpos: 'end' }, y: { min: 0, max: 21, ticks: [0, 5, 10, 15, 19], label: '$/\\sigma^2$' } });
        return { F, W, Ar, cF, cW, cA };
      };
      const m = mk(lp.map.main);
      const { F, W, Ar } = m;
      F.add(new Curve({ f: w => fej(w, Mv()), color: C.navy, w: 3.4, n: 900, vis: from('r3') }));
      F.add(new Curve({ f: w => Math.sqrt(fej(w, Mv())) * Math.sign(Math.sin(Mv() * w / 2) / Math.sin(w / 2) || 1), color: C.aquaD, w: 2.4, dash: '7 5', n: 900, vis: only('r2') }));
      F.add(new Label({ x: 2.2, y: 0.95, html: 'amplitude $\\frac{\\mathrm{sen}(M\\omega/2)}{M\\,\\mathrm{sen}(\\omega/2)}$', size: 16, color: C.aquaD, bg: true, vis: only('r2') }));
      for (const s of [1, -1]) F.add(new Dot({ x: s * 2 * PI / M0, y: 0, color: C.red, r: 7, vis: only('r3'), html: s > 0 ? 'primeiro zero $2\\pi/M$' : null, dx: 10, dy: -10, an: 'lb', size: 16 }));
      F.add(new Label({ x: -2.3, y: 0.9, html: '$M=10$', size: 18, bg: true, vis: from('r1') }));
      /* branco */
      W.add(new Area({ f: () => 1, fill: 'rgba(160,175,185,.25)', vis: k => k >= 0 }));
      W.add(new Curve({ f: () => 1, color: C.gray, w: 2.6, dash: '8 6', vis: k => k >= 0 }));
      W.add(new Area({ f: w => fej(w, Mv()), fill: C.goldF, n: 700, vis: from('r4') }));
      W.add(new Curve({ f: w => fej(w, Mv()), color: C.goldD, w: 3, n: 700, vis: from('r4') }));
      W.add(new Label({ x: 0, y: 1.22, html: () => `$P_Y=\\sigma^2/M=${tnum(1 / Mv(), 2)}\\sigma^2$`, size: 17, bg: true, color: C.goldD, vis: from('r5') }));
      W.add(new Label({ x: 2.1, y: 0.62, html: 'cortado', size: 15, color: C.mute, vis: from('r4') }));
      /* AR(1) */
      Ar.add(new Area({ f: Sar, fill: 'rgba(160,175,185,.25)', n: 700, vis: k => k >= 0 }));
      Ar.add(new Curve({ f: Sar, color: C.gray, w: 2.6, dash: '8 6', n: 700, vis: k => k >= 0 }));
      Ar.add(new Area({ f: w => Sar(w) * fej(w, Mv()), fill: C.goldF, n: 900, vis: from('r6') }));
      Ar.add(new Curve({ f: w => Sar(w) * fej(w, Mv()), color: C.goldD, w: 3, n: 900, vis: from('r6') }));
      Ar.add(new Label({ x: 1.7, y: 15, html: () => `$P_Y\\approx${tnum(PYar(Mv()), 2)}\\sigma^2$<br>regra $1/M$: $${tnum(1 / Mv(), 2)}\\sigma^2$`, size: 17, bg: true, color: C.goldD, vis: from('r7') }));
      Ar.add(new Label({ x: 1.9, y: 7, html: 'potência quase toda<br>abaixo do corte', size: 15, color: C.mute, vis: only('r6') }));
      /* contagem (r6) */
      const cc = chartCard(lp.map.count, 'Variância da média: $M-k$ pares com defasagem $k$, pesados por $a^k$');
      const Cn = new Chart(cc, { w: 904, h: 400, m: { l: 60, r: 14, t: 30, b: 56 }, x: { min: -0.6, max: 9.6, ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], label: '$k$', lpos: 'end' }, y: { min: 0, max: 1.12, ticks: [0, 0.25, 0.5, 0.75, 1].map(v => [v, nf(v, 2)]) } });
      const pts = f => { const o = []; for (let k = 0; k < M0; k++) o.push([k, f(k)]); return o; };
      Cn.add(new Stems({ pts: pts(k => 1 - k / M0).map(([k, v]) => [k - 0.18, v]), color: '#A3B1BA', r: 5, vis: only('r6') }));
      Cn.add(new Stems({ pts: pts(k => Math.pow(A, k)).map(([k, v]) => [k, v]), color: C.navy, r: 5, vis: only('r6'), delay: 400 }));
      Cn.add(new Stems({ pts: pts(k => (1 - k / M0) * Math.pow(A, k)).map(([k, v]) => [k + 0.18, v]), color: C.goldD, r: 6, vis: only('r6'), delay: 800 }));
      Cn.add(new Label({ x: 9.4, y: 1.04, an: 'rm', html: '<span style="color:#7C8E9B">● $1-k/M$ (pares)</span> &nbsp; <span style="color:#0B2540">● $a^k$ (correlação)</span> &nbsp; <span style="color:#C7861E">● produto</span>', size: 16, bg: true, vis: only('r6') }));
      const cb = chartCard(lp.map.count, 'Somando: $1+2\\sum_{k=1}^{9}(1-k/M)a^k$', { style: { marginTop: '10px' } });
      const Bn = new Chart(cb, { w: 904, h: 170, m: { l: 30, r: 120, t: 10, b: 44 }, x: { min: 0, max: 8, ticks: [0, 1, 2, 4, 6, 7.28].map(v => [v, nf(v, v % 1 ? 2 : 0)]) }, y: { min: 0, max: 1, ticks: [] }, grid: false });
      Bn.add(new Custom({
        vis: only('r6'), p: k => k === I('r6') ? 10 : 0, pdur: 3000, pease: linear, delay: 1200, draw(c, g, p, mk) {
          let acc = 0; const n = Math.floor(p);
          for (let k = 0; k < Math.min(n, M0); k++) { const v = k === 0 ? 1 : 2 * (1 - k / M0) * Math.pow(A, k); SV('rect', { x: c.X(acc), y: c.Y(0.75), width: c.X(acc + v) - c.X(acc), height: c.Y(0.25) - c.Y(0.75), fill: k === 0 ? C.navy : k % 2 ? C.goldD : C.gold, stroke: '#fff', 'stroke-width': 1.5 }, g); acc += v; }
          mk.lab('t').set(c.X(acc) + 10, c.Y(0.5), labHTML({ html: `$=${tnum(acc, 2)}$`, size: 20, weight: 700 }), 'lm');
        }
      }));
      /* interpretação */
      const im = mk(lp.map.interp, 150, 224);
      im.F.add(new Curve({ f: w => fej(w, Mv()), color: C.navy, w: 3.4, n: 900 }));
      im.F.add(new Custom({ draw(c, g, p, mk2) { const z = 2 * PI / Mv(); if (z <= PI) for (const s of [1, -1]) SV('circle', { cx: c.X(s * z), cy: c.Y(0), r: 7, fill: C.red, stroke: '#fff', 'stroke-width': 2 }, g); mk2.lab('m').set(c.X(-2.9), c.Y(0.95), labHTML({ html: `$M=${Mv()}$`, size: 18, bg: true }), 'lm'); } }));
      im.W.add(new Curve({ f: () => 1, color: C.gray, w: 2.6, dash: '8 6' }));
      im.W.add(new Area({ f: w => fej(w, Mv()), fill: C.goldF, n: 700 })); im.W.add(new Curve({ f: w => fej(w, Mv()), color: C.goldD, w: 3, n: 700 }));
      im.Ar.add(new Curve({ f: Sar, color: C.gray, w: 2.6, dash: '8 6', n: 700 }));
      im.Ar.add(new Area({ f: w => Sar(w) * fej(w, Mv()), fill: C.goldF, n: 900 })); im.Ar.add(new Curve({ f: w => Sar(w) * fej(w, Mv()), color: C.goldD, w: 3, n: 900 }));
      const cbar = chartCard(lp.map.interp, 'AR(1): regra $1/M$ × real', { style: { marginTop: '10px' } });
      const Bi = new Chart(cbar, { w: 904, h: 104, m: { l: 120, r: 70, t: 6, b: 36 }, x: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1].map(v => [v, nf(v, 2)]), label: '$P_Y/\\sigma^2$', lpos: 'end' }, y: { min: 0, max: 2, ticks: [[0.5, 'real'], [1.5, '1/M']] }, grid: false });
      Bi.add(new Custom({ draw(c, g, p, mk2) { const v1 = 1 / Mv(), v2 = PYar(Mv()); SV('rect', { x: c.X(0), y: c.Y(1.85), width: c.X(v1) - c.X(0), height: c.Y(1.15) - c.Y(1.85), fill: C.gray }, g); SV('rect', { x: c.X(0), y: c.Y(0.85), width: c.X(v2) - c.X(0), height: c.Y(0.15) - c.Y(0.85), fill: C.goldD }, g); mk2.lab('a').set(c.X(v1) + 8, c.Y(1.5), labHTML({ html: nf(v1, 3), size: 16 }), 'lm'); mk2.lab('b').set(c.X(v2) + 8, c.Y(0.5), labHTML({ html: nf(v2, 3), size: 16, weight: 700 }), 'lm'); } }));
      const ro = Readout(ctx.cards.interp, [['m', '$M$'], ['w', 'branco: $P_Y/\\sigma^2$'], ['a', 'AR(1): $P_Y/\\sigma^2$', 'g'], ['e', 'leituras independentes equivalentes']]);
      const upd = () => { ro.set('m', String(Mv())); ro.set('w', nf(1 / Mv(), 3)); ro.set('a', nf(PYar(Mv()), 3)); ro.set('e', nf(1 / PYar(Mv()), 2)); [im.F, im.W, im.Ar, Bi].forEach(c => c.render()); };
      Slider(lp.map.interp, { label: '$M$', min: 1, max: 40, step: 1, value: M0, fmt: v => String(v), oninput: v => { SS.M = Math.round(v); upd(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:6px 14px';
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          SS.live = kind === 'interp'; if (!SS.live) SS.M = M0;
          lp.show(kind === 'interp' ? 'interp' : k === I('r6') ? 'count' : 'main');
          [F, W, Ar, Cn, Bn].forEach(c => c.goto(k, anim)); upd();
          [F, W, Ar].forEach(c => c.render());
        }
      };
    }
  });
})();

/* =====================================================================
   NÍVEL 5 — DESAFIOS: DO SINAL DIGITAL AO LASER (Q8.18 a Q8.20)
   ===================================================================== */

/* ---------- Q8.18 · DEP de um sinal NRZ ---------- */
(() => {
  const frac90 = integ(u => sinc(u) ** 2, -1, 1, 4000);
  const tA = 3.3;                                     /* instante t (em unidades de T) */
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', road: 2, tex: 'E[X(t)]=\\sum_kE[A_k]\\,E[p(t-kT-D)]=\\hl{0}', note: '$E[A_k]=\\frac12(A)+\\frac12(-A)=0$ e independência de $D$.' },
    { n: 'r2', k: 'res', road: 4, tex: '\\text{mesmo bit: }E[A_k^2]=\\hl{A^2};\\ \\text{bits diferentes: }E[A_kA_j]=\\hl{0}', note: 'Símbolos i.i.d. de média nula.' },
    { n: 'r3', k: 'res', road: 4, tex: 'R_X(\\tau)=A^2\\,\\hl{P[\\text{nenhuma fronteira de bit em }(t,t+\\tau]]}', note: 'Lei da probabilidade total, condicionando em “mesmo bit”.' },
    { n: 'r4', k: 'res', road: 4, tex: 'U=(t-D)\\bmod T\\ \\sim\\ \\hl{\\mathrm U[0,T)}', note: 'Porque $D$ é uniforme em um período.' },
    { n: 'r5', k: 'res', road: 4, tex: 'P[\\text{mesmo bit}]=P[U+\\tau<T]=\\hl{\\frac{T-\\tau}{T}}\\ \\ (0\\le\\tau<T);\\ 0\\ (\\tau\\ge T)', note: 'Probabilidade de um intervalo de comprimento $T-\\tau$ em $[0,T)$.' },
    { n: 'r6', k: 'res', road: 5, tex: 'R_X(\\tau)=\\hl{A^2\\Big(1-\\frac{|\\tau|}{T}\\Big)},\\ |\\tau|<T', note: 'Paridade estende para $\\tau<0$. Não depende de $t$: WSS.' },
    { n: 'r7', k: 'res', tag: '(b)', road: 3, tex: 'S_X(f)=\\hl{A^2T\\,\\mathrm{sinc}^2(fT)}', note: 'Par triangular da Questão 8.7 com $\\sigma^2=A^2$.' },
    { n: 'r8', k: 'res', road: 5, tex: '\\int S_X\\,\\dd f=A^2T\\cdot\\frac1T=\\hl{A^2=R_X(0)}', note: 'Potência de um sinal $\\pm A$ é $A^2$.' },
    { n: 'r9', k: 'res', tag: '(c)', road: 5, tex: `\\frac{1}{A^2}\\int_{-1/T}^{1/T}A^2T\\,\\mathrm{sinc}^2(fT)\\,\\dd f=\\int_{-1}^{1}\\mathrm{sinc}^2(u)\\,\\dd u\\approx\\hl{${tnum(frac90, 3)}}`, note: 'Troca $u=fT$; integral numérica.' },
    { n: 'r10', k: 'res', tag: '(d)', road: 5, tex: 'T=100\\ \\mathrm{ns}\\Rightarrow\\text{primeiro nulo em }1/T=\\hl{10\\ \\mathrm{MHz}}', note: 'Nulos em múltiplos da taxa de bits.' },
    { n: 'r11', k: 'res', tag: '(e)', road: 2, tex: '\\text{sem }D:\\ R_X(t+\\tau,t)\\ \\hl{\\text{dependeria da posição de }t}\\text{ dentro do bit}', note: 'Processo <i>cicloestacionário</i>: o relógio do bit ficaria “à vista”.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  /* sinal NRZ simulado (A = 1, T = 1, 32 amostras por bit) para o Welch */
  let WEL = null;
  const welchNRZ = () => {
    if (WEL) return WEL;
    const r = rng(1818), ns = 32, nb = 4096, x = new Float64Array(ns * nb);
    for (let b = 0; b < nb; b++) { const a = r() < 0.5 ? -1 : 1; for (let i = 0; i < ns; i++) x[b * ns + i] = a; }
    const w = welch(x, 1024, ns);
    WEL = w.f.map((f, i) => [f, Math.max(w.S[i], 1e-7)]).filter(([f]) => Math.abs(f) <= 6.05);
    return WEL;
  };
  const bitsOf = (seed, n) => { const r = rng(seed), o = []; for (let i = 0; i < n; i++) o.push(r() < 0.5 ? -1 : 1); return o; };
  const wavePts = (bits, D, t0, t1) => { const o = []; for (let k = -1; k < bits.length - 1; k++) { const a = D + k, b = a + 1; if (b < t0 || a > t1) continue; const v = bits[k + 1]; o.push([Math.max(a, t0), v], [Math.min(b, t1), v]); } return o; };
  Question({
    id: 'q8-18', num: '8.18', level: 5, title: 'A DEP de um sinal digital NRZ (onda binária aleatória)', steps,
    enun: {
      html: 'Bits a cada $T$ s com pulsos NRZ: $X(t)=\\sum_kA_k\\,p(t-kT-D)$, $p=1$ em $[0,T)$, $A_k=\\pm A$ i.i.d. equiprováveis, atraso $D\\sim\\mathrm U[0,T)$. (a) $m_X=0$ e $R_X(\\tau)=A^2(1-|\\tau|/T)$ em $|\\tau|<T$. (b) $S_X(f)$. (c) Fração da potência em $|f|<1/T$. (d) Primeiro nulo a 10 Mbit/s. (e) Papel de $D$.',
      chips: ['$A_k=\\pm A$', 'bit de duração $T$', '$D\\sim\\mathrm U[0,T)$', '!10 Mbit/s']
    },
    plano: { html: 'Para $\\tau\\ge0$, $X(t)$ e $X(t+\\tau)$ só são correlacionados se caírem <b>no mesmo bit</b>; em bits diferentes, os símbolos são independentes e de média nula. Então $R_X(\\tau)=A^2\\cdot P[\\text{mesmo bit}]$. A DEP sai do par triangular (Q8.7).', road: [2, 4] },
    final: { html: `$R_X(\\tau)=A^2(1-|\\tau|/T)$ em $|\\tau|<T$; $S_X(f)=A^2T\\,\\mathrm{sinc}^2(fT)$; cerca de ${nf(100 * frac90, 0)}% da potência está em $|f|<1/T$; a 10 Mbit/s o primeiro nulo fica em 10 MHz. O atraso uniforme $D$ “apaga o relógio” e torna o processo WSS — o mesmo papel da fase uniforme no Capítulo 7.` },
    interp: { boxes: [['aplic', 'Este é o resultado que dimensiona a largura de banda de qualquer enlace digital em banda base (RS-485, barramentos seriais, a componente em fase de um BPSK): <b>“a banda é da ordem da taxa de bits”</b>. As caudas em $1/f^2$ do $\\mathrm{sinc}^2$ são o motivo de se usarem pulsos formatados — como o cosseno levantado das simulações da tese de Lins Júnior.', { size: 'xs' }]] },
    notes: {
      fala: 'Modelar a partir da física: dois instantes só “conversam” se estiverem no mesmo bit. A probabilidade disso é $(T-\\tau)/T$ — e o triângulo nasce dessa probabilidade, ponto a ponto. O $\\mathrm{sinc}^2$ é a Q8.7. A estimativa de Welch é calculada aqui mesmo, no navegador.',
      pergunta: 'Se o receptor soubesse exatamente onde começa cada bit (sem $D$), o processo ainda seria WSS?',
      tempo: '12 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['w', 's', 'c', 'interp']);
      const { I, from, only } = st;
      const D0 = 0.37, bits = bitsOf(77, 16);
      /* ---- painel w: onda, posição U, triângulo ponto a ponto ---- */
      const cw = chartCard(lp.map.w, 'Onda NRZ simulada ($A=1$, $T=1$, atraso $D$)');
      const Wv = new Chart(cw, { w: 904, h: 200, m: { l: 52, r: 14, t: 14, b: 44 }, x: { min: 0, max: 12, ticks: [0, 2, 4, 6, 8, 10, 12], label: '$t/T$', lpos: 'end' }, y: { min: -1.7, max: 1.7, ticks: [[-1, '-A'], [0, '0'], [1, 'A']] } });
      const tauP = k => k === I('r5') ? 1.35 : k >= I('r3') ? 0.45 : 0.45;
      Wv.add(new Custom({ vis: k => k >= 0, draw(c, g) { for (let k = 0; k < 13; k++) { const x = D0 + k; if (x <= 12) SV('line', { x1: c.X(x), x2: c.X(x), y1: c.y0, y2: c.y1, stroke: '#C7D3D9', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, g); } } }));
      Wv.add(new Curve({ pts: wavePts(bits, D0, 0, 12), color: C.navy, w: 3, vis: k => k >= 0 }));
      Wv.add(new HLine({ y: 0, color: C.red, w: 2.4, dash: '8 6', html: 'média de conjunto $E[X(t)]=0$', lx: 11.9, dy: -4, vis: only('r1') }));
      Wv.add(new Custom({
        vis: from('r2'), p: tauP, pdur: 3600, pease: linear, draw(c, g, tau, mk) {
          const showTau = APP.k >= I('r3') || st.kind(APP.k) === 'final';
          const t1 = tA, t2 = showTau ? tA + tau : 4.1, same = Math.floor(t1 - D0) === Math.floor(t2 - D0);
          const col = same ? C.petro : C.red;
          if (showTau) SV('rect', { x: c.X(t1), y: c.y0, width: c.X(t2) - c.X(t1), height: c.ih, fill: same ? 'rgba(20,107,115,.15)' : 'rgba(192,57,43,.13)' }, g);
          for (const t of [t1, t2]) { SV('line', { x1: c.X(t), x2: c.X(t), y1: c.y0, y2: c.y1, stroke: col, 'stroke-width': 2.6 }, g); const v = bits[Math.floor(t - D0) + 1]; SV('circle', { cx: c.X(t), cy: c.Y(v), r: 7, fill: col, stroke: '#fff', 'stroke-width': 2 }, g); }
          mk.lab('t').set(c.X(t1), c.y0 + 4, labHTML({ html: '$t$', size: 17, color: col, bg: true }), 'ct');
          mk.lab('t2').set(c.X(t2), c.y0 + 4, labHTML({ html: showTau ? '$t+\\tau$' : "$t'$", size: 17, color: col, bg: true }), 'ct');
          mk.lab('s').set(c.X(Math.max(t2, t1) + 0.25), c.Y(1.35), labHTML({ html: same ? '<b style="color:#146B73">mesmo bit</b>: $E[A_k^2]=A^2$' : '<b style="color:#C0392B">bits diferentes</b>: $E[A_kA_j]=0$', size: 17, bg: true }), 'lm');
        }
      }));
      const row = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' } }); lp.map.w.append(row);
      const cu = chartCard(row, 'Posição de $t$ dentro do bit: $U\\sim\\mathrm U[0,T)$');
      const Uc = new Chart(cu, { w: 430, h: 270, m: { l: 40, r: 16, t: 30, b: 50 }, x: { min: -0.1, max: 1.15, ticks: [[0, '0'], [0.5, 'T/2'], [1, 'T']], label: '$U$', lpos: 'end' }, y: { min: 0, max: 1.6, ticks: [] }, grid: false });
      Uc.add(new Rect({ x0: 0, x1: 1, y0: 0, y1: 1, fill: 'rgba(160,175,185,.25)', stroke: C.gray, vis: from('r4'), reveal: 'fade' }));
      Uc.add(new Label({ x: 0.5, y: 1.15, html: 'densidade $1/T$', size: 15, color: C.mute, vis: from('r4') }));
      Uc.add(new Custom({
        vis: from('r4'), p: tauP, pdur: 3600, pease: linear, draw(c, g, tau, mk) {
          if (APP.k < I('r5')) return;
          const L = Math.max(0, 1 - tau);
          SV('rect', { x: c.X(0), y: c.Y(1), width: c.X(L) - c.X(0), height: c.Y(0) - c.Y(1), fill: 'rgba(20,107,115,.5)' }, g);
          mk.lab('p').set(c.X(0.02), c.Y(1.42), labHTML({ html: `$\\tau=${tnum(Math.min(tau, 1.35), 2)}T$: $P[U<T-\\tau]=${tnum(L, 2)}$`, size: 17, bg: true, color: C.petro }), 'lm');
        }
      }));
      const ct = chartCard(row, '$R_X(\\tau)=A^2P[\\text{mesmo bit}]$ ponto a ponto');
      const Tc = new Chart(ct, { w: 430, h: 270, m: { l: 52, r: 14, t: 30, b: 50 }, x: { min: -1.5, max: 1.5, ticks: [[-1, '-T'], [0, '0'], [1, 'T']], label: '$\\tau$', lpos: 'end' }, y: { min: 0, max: 1.2, ticks: [[0, '0'], [0.5, 'A^2/2'], [1, 'A^2']] } });
      Tc.add(new Custom({
        vis: only('r5'), p: tauP, pdur: 3600, pease: linear, draw(c, g, tau) {
          for (let t = 0; t <= Math.min(tau, 1.35) + 1e-9; t += 0.05) SV('circle', { cx: c.X(t), cy: c.Y(Math.max(0, 1 - t)), r: 4.5, fill: C.petro }, g);
          SV('circle', { cx: c.X(Math.min(tau, 1.35)), cy: c.Y(Math.max(0, 1 - tau)), r: 8, fill: C.gold, stroke: '#fff', 'stroke-width': 3 }, g);
        }
      }));
      Tc.add(new Curve({ pts: [[-1.5, 0], [-1, 0], [0, 1], [1, 0], [1.5, 0]], color: C.navy, w: 3.4, vis: from('r6') }));
      Tc.add(new Label({ x: 0.85, y: 0.85, html: '$A^2(1-|\\tau|/T)$', size: 16, bg: true, vis: from('r6') }));
      /* ---- painel s: espectro ---- */
      const SS = { db: null };
      const sr = TFRow(lp.map.s, '300px 50px 1fr', '$R_X(\\tau)$', '$S_X(f)$: teoria × Welch (estimado nesta simulação)');
      const Ts = new Chart(sr.t, { w: 290, h: 260, m: { l: 50, r: 10, t: 22, b: 50 }, x: { min: -1.6, max: 1.6, ticks: [[-1, '-T'], [0, '0'], [1, 'T']], label: '$\\tau$', lpos: 'end' }, y: { min: 0, max: 1.15, ticks: [[0, '0'], [1, 'A^2']] } });
      Ts.add(new Area({ pts: [[-1, 0], [0, 1], [1, 0]], fill: C.navyF })); Ts.add(new Curve({ pts: [[-1.6, 0], [-1, 0], [0, 1], [1, 0], [1.6, 0]], color: C.navy, w: 3 }));
      const nb = E('div', { style: { fontSize: '17px', lineHeight: 1.6, padding: '10px 6px 4px', borderTop: '1px solid #DCE4E7', marginTop: '8px' } }); sr.t.append(nb);
      const fTt = [-6, -4, -2, -1, 0, 1, 2, 4, 6].map(v => [v, nf(v, 0)]), fMt = [-6, -4, -2, -1, 0, 1, 2, 4, 6].map(v => [v, nf(v * 10, 0)]);
      const dbOn = k => SS.db != null ? SS.db : k >= I('r7');
      const Sp = new Chart(sr.f, {
        w: 560, h: 560, m: { l: 66, r: 14, t: 34, b: 60 }, x: { min: -6.2, max: 6.2, ticks: fTt, label: '$fT$', lpos: 'end' },
        y: { min: 0, max: 1.12, ticks: [0, 0.25, 0.5, 0.75, 1].map(v => [v, nf(v, 2)]), label: '$S_X/A^2T$', db: true, dmin: -45, dmax: 3, dticks: [-40, -30, -20, -10, 0], dlabel: '$S_X/A^2T$ (dB)' },
        dom: k => ({ db: dbOn(k), xticks: k >= I('r10') && st.kind(k) === 'res' ? fMt : fTt, xlabel: k >= I('r10') && st.kind(k) === 'res' ? '$f$ (MHz) a 10 Mbit/s' : '$fT$' })
      });
      Sp.add(new Area({ f: x => sinc(x) ** 2, a: -1, b: 1, fill: C.goldF, n: 400, vis: from('r9') }));
      Sp.add(new Curve({ pts: () => welchNRZ(), color: C.petro, w: 2, op: .9, vis: from('r7'), delay: 900 }));
      Sp.add(new Curve({ f: x => sinc(x) ** 2, color: C.red, w: 2.6, dash: '8 6', n: 1600, vis: from('r7') }));
      Sp.add(new Label({ x: 6, y: () => Sp.dbmix > .5 ? Math.pow(10, 0.1) : 1.05, an: 'rt', html: '<span style="color:#146B73">━ Welch (estimado nesta simulação)</span><br><span style="color:#C0392B">┅ teoria $A^2T\\,\\mathrm{sinc}^2(fT)$</span>', size: 15, bg: true, vis: from('r7'), delay: 900 }));
      for (let k = -6; k <= 6; k++) if (k) Sp.add(new Dot({ x: k, y: 1e-4, r: 5, color: C.red, vis: only('r10') }));
      Sp.add(new Label({ x: 0, y: () => Sp.dbmix > .5 ? Math.pow(10, -3.2) : 0.5, html: `${nf(100 * frac90, 1)}% da potência<br>em $|f|<1/T$`, size: 17, color: C.goldD, bg: true, vis: only('r9') }));
      Sp.add(new Label({ x: 2.9, y: () => Sp.dbmix > .5 ? Math.pow(10, -0.6) : 0.5, html: 'primeiro nulo: <b>10 MHz</b>', size: 17, color: C.red, bg: true, vis: only('r10') }));
      Sp.add(new Label({ x: -3.6, y: () => Sp.dbmix > .5 ? Math.pow(10, -0.6) : 0.5, html: 'área $=A^2$', size: 17, bg: true, vis: only('r8') }));
      const tg = E('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '-2px' } }); sr.f.append(tg);
      const tb = Toggle(tg, 'escala em dB', true, v => { SS.db = v; Sp.setDomain({ db: v }, true); }, 'ghost-d');
      /* ---- painel c: cicloestacionário ---- */
      const CS = { tau: 0.4, noD: true };
      const cc1 = chartCard(lp.map.c, 'Cinco realizações: <span id="q818lab"></span>');
      const En = new Chart(cc1, { w: 904, h: 230, m: { l: 52, r: 14, t: 14, b: 44 }, x: { min: 0, max: 6, ticks: [0, 1, 2, 3, 4, 5, 6], label: '$t/T$', lpos: 'end' }, y: { min: -0.5, max: 10.5, ticks: [] }, grid: false });
      const ens = [0, 1, 2, 3, 4].map(i => ({ b: bitsOf(300 + i, 10), D: rng(900 + i)() }));
      En.add(new Custom({
        draw(c, g) {
          ens.forEach((e, i) => { const D = CS.noD ? 0 : e.D, y0 = 1 + i * 2.1; const pts = wavePts(e.b, D, 0, 6).map(([x, v]) => [x, y0 + 0.75 * v]); SV('path', { d: dPath(c, pts), stroke: [C.navy, C.petro, C.goldD, C.aquaD, C.red][i], 'stroke-width': 2.4, fill: 'none' }, g); for (let k = 0; k < 8; k++) { const x = D + k; if (x <= 6) SV('line', { x1: c.X(x), x2: c.X(x), y1: c.Y(y0 - 0.9), y2: c.Y(y0 + 0.9), stroke: '#C7D3D9', 'stroke-dasharray': '3 3' }, g); } });
        }
      }));
      const cc2 = chartCard(lp.map.c, '$R_X(t+\\tau,\\,t)$ em função de $t$, com $\\tau$ fixo', { style: { marginTop: '10px' } });
      const Rc = new Chart(cc2, { w: 904, h: 250, m: { l: 52, r: 14, t: 24, b: 50 }, x: { min: 0, max: 4, ticks: [0, 1, 2, 3, 4], label: '$t/T$', lpos: 'end' }, y: { min: 0, max: 1.3, ticks: [[0, '0'], [1, 'A^2']] } });
      Rc.add(new Curve({ f: t => CS.noD ? (((t % 1) + 1) % 1 < 1 - CS.tau ? 1 : 0) : 1 - CS.tau, color: C.petro, w: 3.4, n: 1600 }));
      Rc.add(new Curve({ f: () => 1 - CS.tau, color: C.goldD, w: 2.4, dash: '8 6' }));
      Rc.add(new Label({ x: 3.95, y: 1.18, an: 'rm', html: () => CS.noD ? '<b>sem $D$</b>: onda periódica em $t$ — cicloestacionário' : '<b>com $D$</b>: constante — WSS', size: 17, bg: true }));
      Rc.add(new Label({ x: 0.05, y: () => 1 - CS.tau + 0.08, an: 'lb', html: () => `média em $t$ (ou em $D$): $A^2(1-\\tau/T)=${tnum(1 - CS.tau, 2)}$`, size: 15, color: C.goldD, bg: true }));
      const cr = E('div', { class: 'card', style: { marginTop: '10px', padding: '4px 14px', display: 'flex', alignItems: 'center', gap: '12px' } }); lp.map.c.append(cr);
      const sl = Slider(cr, { label: '$\\tau$', min: 0.05, max: 0.95, step: 0.01, value: 0.4, fmt: v => nf(v, 2) + ' T', oninput: v => { CS.tau = v; Rc.render(); } }); sl.row.style.flex = '1';
      const lab = () => { const e = document.getElementById('q818lab'); if (e) e.innerHTML = md(CS.noD ? 'sem $D$, fronteiras alinhadas (relógio “à vista”)' : 'com $D$ uniforme, fronteiras espalhadas'); };
      const tD = Toggle(cr, 'remover $D$', true, v => { CS.noD = v; En.render(); Rc.render(); lab(); }, 'ghost-d');
      /* ---- interpretação: taxa de bits ---- */
      const IS = { rb: 10 };
      const ci = chartCard(lp.map.interp, 'DEP do NRZ em MHz: nulos na taxa de bits');
      const Fi = new Chart(ci, { w: 904, h: 520, m: { l: 66, r: 14, t: 34, b: 60 }, x: { min: -60, max: 60, ticks: [-60, -40, -20, 0, 20, 40, 60], label: '$f$ (MHz)', lpos: 'end' }, y: { min: 0, max: 1, db: true, dmin: -40, dmax: 3, dticks: [-40, -30, -20, -10, 0], dlabel: '$S_X/A^2T_0$ (dB), $T_0=100$ ns' } });
      const Sf = f => (10 / IS.rb) * sinc(f / IS.rb) ** 2;
      Fi.add(new Area({ f: Sf, a: () => -IS.rb, b: () => IS.rb, fill: C.goldF, n: 600 }));
      Fi.add(new Curve({ f: Sf, color: C.petro, w: 3, n: 2400 }));
      Fi.add(new Custom({ draw(c, g) { for (let k = -12; k <= 12; k++) { const x = k * IS.rb; if (k && Math.abs(x) <= 60) SV('circle', { cx: c.X(x), cy: c.y1, r: 6, fill: C.red, stroke: '#fff', 'stroke-width': 2 }, g); } } }));
      const ro = Readout(ctx.cards.interp, [['r', 'taxa de bits'], ['n', 'primeiro nulo'], ['b', 'banda com 90% da potência', 'g']]);
      const upd = () => { ro.set('r', nf(IS.rb, 1) + ' Mbit/s'); ro.set('n', nf(IS.rb, 1) + ' MHz'); ro.set('b', '|f| < ' + nf(IS.rb, 1) + ' MHz'); Fi.render(); };
      Slider(lp.map.interp, { label: 'taxa de bits', min: 2, max: 40, step: 0.5, value: 10, fmt: v => nf(v, 1) + ' Mbit/s', oninput: v => { IS.rb = v; upd(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k), n = st.name(k) || '';
          lp.show(kind === 'interp' ? 'interp' : n === 'r11' ? 'c' : (k >= I('r7') && kind === 'res') || kind === 'final' ? 's' : 'w');
          nb.innerHTML = md(k >= I('r10') && kind === 'res' ? '$T=100$ ns<br>$1/T=10$ MHz' : k >= I('r9') ? `$\\int_{-1}^{1}\\mathrm{sinc}^2=${tnum(frac90, 3)}$` : k >= I('r8') ? '$\\int S_X\\,\\dd f=A^2$' : '$\\mathcal F$: par triangular (Q8.7)');
          Wv.goto(k, anim); Uc.goto(k, anim); Tc.goto(k, anim); Sp.goto(k, anim); Wv.render();
          tb.set(dbOn(k)); lab();
        },
        enter() { SS.db = null; }, leave() { SS.db = null; }
      };
    }
  });
})();

/* ---------- Q8.19 · Movimento browniano: Langevin pela DEP ---------- */
(() => {
  const Tk = 300, eta = 1e-3, rho = 1050, r0 = 0.5e-6;
  const phys = r => { const Mg = 6 * PI * eta * r, M = rho * 4 / 3 * PI * r ** 3, g = Mg / M; return { Mg, M, g, D: KB * Tk / Mg, vr: Math.sqrt(KB * Tk / M) }; };
  const P0 = phys(r0);
  /* Ornstein–Uhlenbeck normalizado (γ = 1, kT/M = 1 ⇒ σ² = 1, D = 1) */
  let OU = null;
  const ou = () => {
    if (OU) return OU;
    const dt = 0.02, N = 100000, g = gauss(1919), e = Math.exp(-dt), s = Math.sqrt(1 - e * e), v = new Float64Array(N);
    v[0] = g(); for (let i = 1; i < N; i++) v[i] = e * v[i - 1] + s * g();
    const K = 250, R = [];
    for (let m = 0; m <= K; m++) { let a = 0; for (let i = 0; i < N - m; i++) a += v[i] * v[i + m]; R.push([m * dt, a / (N - m)]); }
    const tr = [0, 1, 2].map(j => { const o = []; for (let i = 0; i <= 1500; i += 2) o.push([i * dt, v[20000 + j * 25000 + i] + (2 - j) * 4.2]); return o; });
    const xs = [0, 1, 2, 3, 4].map(j => { const o = [[0, 0]]; let x = 0; const off = 5000 + j * 15000; for (let i = 1; i <= 10000; i++) { x += v[off + i] * dt; if (i % 25 === 0) o.push([i * dt, x]); } return o; });
    OU = { dt, R, tr, xs };
    return OU;
  };
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'r1', k: 'res', tag: '(a)', road: 1, tex: '(\\j2\\pi f+\\gamma)V(f)=N(f)\\Rightarrow\\hl{H(f)=\\frac{1}{\\gamma+\\j2\\pi f}}', note: 'Transformada de Fourier da equação: derivada vira $\\j2\\pi f$.' },
    { n: 'r2', k: 'res', road: 4, tex: '|H(f)|^2=\\hl{\\frac{1}{\\gamma^2+4\\pi^2f^2}}', note: 'Passa-baixas de primeira ordem, $f_{3\\mathrm{dB}}=\\gamma/2\\pi$.' },
    { n: 'r3', k: 'res', tag: '(b)', road: 3, tex: 'S_v(f)=|H(f)|^2S_\\eta(f)=\\hl{\\frac{C_1}{\\gamma^2+4\\pi^2f^2}}', note: 'Eq. (8.5) com $S_\\eta=C_1$ (Wiener–Khinchin de $C_1\\delta$).' },
    { n: 'r4', k: 'res', road: 4, tex: '\\frac{C_1}{\\gamma^2+4\\pi^2f^2}=\\frac{2\\gamma\\sigma^2}{\\gamma^2+4\\pi^2f^2}\\ \\text{com}\\ \\hl{\\sigma^2=\\frac{C_1}{2\\gamma}}', note: 'Casamento com o par lorentziano ($a=\\gamma$).' },
    { n: 'r5', k: 'res', road: 4, tex: 'R_v(\\tau)=\\hl{\\frac{C_1}{2\\gamma}e^{-\\gamma|\\tau|}}', note: 'Mesmo resultado da nota de referência (Eq. 22), obtido pela frequência.' },
    { n: 'r6', k: 'res', tag: '(c)', road: 5, tex: 'E[v^2]=R_v(0)=\\frac{C_1}{2\\gamma}=\\hl{\\frac{k_BT}{M}}', note: 'Equipartição: energia cinética média $\\frac12k_BT$.' },
    { n: 'r7', k: 'res', road: 4, tex: '\\hl{C_1=\\frac{2\\gamma k_BT}{M}}', note: '<b>Flutuação–dissipação</b>: a força aleatória é fixada pelo atrito e por $T$.' },
    { n: 'r8', k: 'res', tag: '(d)', road: 4, tex: 'D=\\int_0^{\\infty}\\frac{k_BT}{M}e^{-\\gamma\\tau}\\dd\\tau=\\hl{\\frac{k_BT}{M\\gamma}}', note: 'Coincide com a relação de Einstein–Stokes.' },
    { n: 'r9', k: 'res', road: 5, tex: 'S_v(0)=\\int_{-\\infty}^{\\infty}R_v\\,\\dd\\tau=\\hl{2D}', note: '(D5): o coeficiente de difusão é <i>metade da DEP da velocidade em $f=0$</i>.' },
    { n: 'r10', k: 'res', tag: '(e)', road: 1, tex: `M\\gamma=6\\pi(10^{-3})(0{,}5\\times10^{-6})\\approx\\hl{${sciT(P0.Mg, 1)}}\\ \\mathrm{kg/s};\\ M\\approx\\hl{${sciT(P0.M, 1)}}\\ \\mathrm{kg}`, note: 'Stokes e volume da esfera.' },
    { n: 'r11', k: 'res', road: 5, tex: `\\gamma\\approx${sciT(P0.g, 1)}\\ \\mathrm{s^{-1}}\\ (1/\\gamma\\approx\\hl{${tnum(1e9 / P0.g, 0)}\\ \\mathrm{ns}});\\ D\\approx\\hl{${sciT(P0.D, 1)}}\\ \\mathrm{m^2/s};\\ v_{\\rms}\\approx\\hl{${tnum(P0.vr * 1e3, 1)}\\ \\mathrm{mm/s}}`, note: '$D=k_BT/(M\\gamma)$ e $v_{\\rms}=\\sqrt{k_BT/M}$.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-19', num: '8.19', level: 5, title: 'Movimento browniano: a equação de Langevin vista pela DEP', steps,
    enun: {
      html: 'Partícula de massa $M$ num fluido a $T$: $\\dot v(t)+\\gamma v(t)=\\eta(t)$, com $R_\\eta(\\tau)=C_1\\delta(\\tau)$. (a) Filtro LTI: $H(f)$. (b) $S_v(f)$ e $R_v(\\tau)$. (c) Equipartição $\\frac12ME[v^2]=\\frac12k_BT$: $C_1$. (d) $D=\\int_0^\\infty R_v\\,\\dd\\tau=\\frac{k_BT}{M\\gamma}$ e $S_v(0)$. (e) Esfera de 0,5 µm, 1050 kg/m³, em água a 300 K.',
      chips: ['$\\dot v+\\gamma v=\\eta$', '$R_\\eta=C_1\\delta$', '$r=0{,}5$ µm', '!$M\\gamma=6\\pi\\eta_{\\text{visc}}r$']
    },
    plano: { html: 'A equação diferencial linear com entrada $\\eta$ e saída $v$ é um filtro de primeira ordem — o mesmo RC da Questão 8.15, com $\\gamma$ no lugar de $1/RC$. A saída é lorentziana/exponencial. A termodinâmica entra só em (c), fixando a <i>intensidade</i> do ruído.', road: [1, 3] },
    final: { html: `$H=\\frac{1}{\\gamma+\\j2\\pi f}$; $S_v=\\frac{C_1}{\\gamma^2+4\\pi^2f^2}$; $R_v=\\frac{k_BT}{M}e^{-\\gamma|\\tau|}$ com $C_1=\\frac{2\\gamma k_BT}{M}$; $D=\\frac{k_BT}{M\\gamma}=\\frac12S_v(0)$. Esfera de 0,5 µm: memória de $${tnum(1e9 / P0.g, 0)}$ ns, $D\\approx${tnum(P0.D * 1e12, 2)}\\ \\mu$m²/s e $v_{\\rms}\\approx${tnum(P0.vr * 1e3, 1)}$ mm/s.` },
    interp: { boxes: [['interp', 'A velocidade tem memória curtíssima (58 ns), mas a <i>posição</i> — a integral da velocidade — acumula esses passos como um passeio aleatório (Capítulo 4): $E[x^2]\\approx2Dt$. “O coeficiente de difusão é a integral da correlação de velocidades” é a fórmula de Green–Kubo: <i>coeficientes de transporte são DEPs avaliadas em frequência zero</i>.', { size: 'xs' }]] },
    notes: {
      fala: 'Curiosidade histórica: em 1905 Einstein explicou o movimento browniano e deduziu a relação entre difusão e temperatura. O botânico von Nägeli havia “provado” que as colisões eram fracas demais para mover uma partícula visível — esqueceu que $N$ chutes aleatórios somam algo da ordem de $\\sqrt N$ (Capítulo 4). Westgren confirmou a previsão com erro menor que 0,5% em 1918.',
      pergunta: 'Compare com a Q8.16: lá $\\frac12C\\overline{v_C^2}=\\frac12kT$; aqui $\\frac12M\\overline{v^2}=\\frac12k_BT$. Qual é o “resistor” e qual é o “capacitor” da partícula?',
      tempo: '12 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['blk', 'sv', 'num', 'interp']);
      const { I, from, only } = st;
      /* bloco */
      const bk = E('div', { class: 'card', style: { padding: '18px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '18px', fontSize: '26px' } }); lp.map.blk.append(bk);
      const arr = () => E('span', { html: '<svg viewBox="0 0 90 20" width="90" height="20"><path d="M2 10H80M70 3L84 10L70 17" stroke="#0B2540" stroke-width="3" fill="none"/></svg>' });
      bk.append(E('div', { html: md('$\\eta(t)$<br><small style="font-size:15px;color:#4E6476">força aleatória<br>(branco, $C_1\\delta$)</small>'), style: { textAlign: 'center' } }), arr(), E('div', { style: { border: '3px solid #146B73', borderRadius: '10px', padding: '12px 18px', background: '#EDF5F5', textAlign: 'center' }, html: md('$H(f)=\\dfrac{1}{\\gamma+\\j2\\pi f}$<br><small style="font-size:15px;color:#4E6476">atrito: filtro de 1ª ordem</small>') }), arr(), E('div', { html: md('$v(t)$<br><small style="font-size:15px;color:#4E6476">velocidade</small>'), style: { textAlign: 'center' } }));
      const ch = chartCard(lp.map.blk, '$|H(f)|^2$ (eixo em unidades de $\\gamma$)', { style: { marginTop: '12px' } });
      const Hc = new Chart(ch, { w: 904, h: 440, m: { l: 62, r: 14, t: 34, b: 60 }, x: { min: -1, max: 1, ticks: [-1, -0.5, 0, 0.5, 1].map(v => [v, nf(v, 1)]), label: '$f/\\gamma$', lpos: 'end' }, y: { min: 0, max: 1.2, ticks: [[0, '0'], [0.5, '\\tfrac{1}{2\\gamma^2}'], [1, '\\tfrac{1}{\\gamma^2}']] } });
      Hc.add(new Curve({ f: x => 1 / (1 + 4 * PI * PI * x * x), color: C.navy, w: 3.8, n: 700, vis: from('r2') }));
      for (const s of [1, -1]) Hc.add(new VLine({ x: s / (2 * PI), y0: 0, y1: 0.5, color: C.red, w: 2.2, vis: from('r2'), html: s > 0 ? '$f_{3\\mathrm{dB}}=\\gamma/2\\pi$' : null, an: 'lm', dx: 8, dy: 0, ly: 0.3 }));
      Hc.add(new Label({ x: 0.62, y: 0.9, html: 'mesmo filtro do RC (Q8.15)<br>com $\\gamma\\leftrightarrow1/RC$', size: 17, bg: true, vis: from('r2') }));
      /* sv */
      const ctr = chartCard(lp.map.sv, 'Três trechos da velocidade $v(t)$ (simulação OU, semente fixa; $\\gamma=1$, $k_BT/M=1$)');
      const Tr = new Chart(ctr, { w: 904, h: 180, m: { l: 30, r: 14, t: 8, b: 40 }, x: { min: 0, max: 30, ticks: [0, 5, 10, 15, 20, 25, 30], label: '$t\\gamma$', lpos: 'end' }, y: { min: -3.5, max: 12, ticks: [] }, grid: false });
      Tr.add(new Custom({ vis: k => k >= 0, reveal: 'draw', draw(c, g) { ou().tr.forEach((p, j) => SV('path', { d: dPath(c, p), stroke: [C.navy, C.petro, C.goldD][j], 'stroke-width': 1.6, fill: 'none' }, g)); } }));
      const rw = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' } }); lp.map.sv.append(rw);
      const cS = chartCard(rw, 'DEP $S_v(f)$'), cR = chartCard(rw, '$R_v(\\tau)$: estimada × teoria');
      const Sv = new Chart(cS, { w: 430, h: 400, m: { l: 58, r: 12, t: 34, b: 56 }, x: { min: -1, max: 1, ticks: [-1, -0.5, 0, 0.5, 1].map(v => [v, nf(v, 1)]), label: '$f/\\gamma$', lpos: 'end' }, y: { min: 0, max: 2.5, ticks: [[0, '0'], [1, 'D'], [2, '2D']] } });
      Sv.add(new Area({ f: x => 2 / (1 + 4 * PI * PI * x * x), fill: C.petroF, n: 500, vis: from('r3') }));
      Sv.add(new Curve({ f: x => 2 / (1 + 4 * PI * PI * x * x), color: C.petro, w: 3.6, n: 700, vis: from('r3') }));
      Sv.add(new Curve({ f: () => 2, color: C.navy, dash: '7 6', w: 2.2, vis: only('r3') }));
      Sv.add(new Label({ x: 0.5, y: 2.2, html: '$S_\\eta=C_1$ (branco)', size: 15, color: C.navy, bg: true, vis: only('r3') }));
      Sv.add(new Label({ x: 0.55, y: 1.3, html: 'lorentziana, $a=\\gamma$', size: 16, bg: true, vis: only('r4') }));
      Sv.add(new Dot({ x: 0, y: 2, color: C.gold, r: 9, html: '$S_v(0)=2D$', dx: 12, dy: -6, an: 'lb', vis: from('r9') }));
      const Rv = new Chart(cR, { w: 430, h: 400, m: { l: 58, r: 12, t: 34, b: 56 }, x: { min: 0, max: 5, ticks: [0, 1, 2, 3, 4, 5], label: '$\\tau\\gamma$', lpos: 'end' }, y: { min: -0.1, max: 1.15, ticks: [[0, '0'], [0.5, '\\tfrac{k_BT}{2M}'], [1, '\\tfrac{k_BT}{M}']] } });
      Rv.add(new Area({ f: t => Math.exp(-t), fill: C.goldF, n: 400, vis: from('r8') }));
      Rv.add(new Curve({ pts: () => ou().R, color: C.petro, w: 3, vis: from('r5'), delay: 500 }));
      Rv.add(new Curve({ f: t => Math.exp(-t), color: C.red, w: 2.4, dash: '8 6', n: 400, vis: from('r5') }));
      Rv.add(new Label({ x: 4.9, y: 1.05, an: 'rm', html: '<span style="color:#146B73">━ estimada (1 trajetória)</span><br><span style="color:#C0392B">┅ teoria $e^{-\\gamma\\tau}$</span>', size: 15, bg: true, vis: from('r5') }));
      Rv.add(new Dot({ x: 0, y: 1, color: C.gold, html: '$E[v^2]=k_BT/M$', dx: 12, dy: 2, an: 'lt', size: 16, vis: only('r6', 'r7') }));
      Rv.add(new Label({ x: 1.6, y: 0.22, html: 'área $=D=\\frac{k_BT}{M\\gamma}$', size: 17, bg: true, color: C.goldD, vis: from('r8') }));
      Rv.add(new Label({ x: 2.6, y: 0.62, html: '$C_1=2\\gamma k_BT/M$<br>flutuação–dissipação', size: 16, bg: true, vis: only('r7') }));
      /* num */
      const gn = E('div', { style: { display: 'grid', gridTemplateColumns: '330px 1fr', gap: '12px' } }); lp.map.num.append(gn);
      const tbl = E('div', { class: 'card', style: { padding: '14px 16px', fontSize: '19px', lineHeight: 1.75 } }); gn.append(tbl);
      const cx2 = chartCard(gn, 'Posição $x(t)=\\int v\\,\\dd t$: passeio aleatório');
      const Xc = new Chart(cx2, { w: 560, h: 560, m: { l: 52, r: 14, t: 34, b: 60 }, x: { min: 0, max: 200, ticks: [0, 50, 100, 150, 200], label: '$t\\gamma$', lpos: 'end' }, y: { min: -48, max: 48, ticks: [-40, -20, 0, 20, 40], label: '$x$ (unid. $\\sqrt{D/\\gamma}$)' } });
      Xc.add(new Custom({ vis: k => k >= 0, reveal: 'draw', dur: 1400, draw(c, g) { ou().xs.forEach((p, j) => SV('path', { d: dPath(c, p), stroke: [C.navy, C.petro, C.goldD, C.aquaD, '#7A5C9E'][j], 'stroke-width': 1.8, fill: 'none' }, g)); } }));
      Xc.add(new Curve({ f: t => Math.sqrt(2 * t), color: C.red, w: 2.4, dash: '8 6', n: 300 }));
      Xc.add(new Curve({ f: t => -Math.sqrt(2 * t), color: C.red, w: 2.4, dash: '8 6', n: 300 }));
      Xc.add(new Label({ x: 195, y: 43, an: 'rm', html: '┅ $\\pm\\sqrt{2Dt}$: $E[x^2]\\approx2Dt$', size: 16, color: C.red, bg: true }));
      /* interpretação: raio da esfera */
      const IS = { r: r0 };
      const ir = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }); lp.map.interp.append(ir);
      const ci1 = chartCard(ir, '$R_v(\\tau)$ em unidades físicas'), ci2 = chartCard(ir, 'Deslocamento quadrático médio $2Dt$');
      const Ri = new Chart(ci1, { w: 430, h: 500, m: { l: 64, r: 12, t: 34, b: 60 }, x: { min: 0, max: 600, ticks: [0, 100, 200, 300, 400, 500, 600], label: '$\\tau$ (ns)', lpos: 'end' }, y: { min: 0, max: 1.12, ticks: [0, 0.5, 1].map(v => [v, nf(v, 1)]), label: '$R_v/R_v(0)$' } });
      Ri.add(new Area({ f: t => Math.exp(-phys(IS.r).g * t * 1e-9), fill: C.goldF, n: 400 }));
      Ri.add(new Curve({ f: t => Math.exp(-phys(IS.r).g * t * 1e-9), color: C.petro, w: 3.4, n: 500 }));
      Ri.add(new Custom({ draw(c, g, p, mk) { const m = 1e9 / phys(IS.r).g; if (m <= 600) { SV('line', { x1: c.X(m), x2: c.X(m), y1: c.Y(0), y2: c.Y(Math.exp(-1)), stroke: C.red, 'stroke-width': 2.2, 'stroke-dasharray': '6 5' }, g); mk.lab('m').set(c.X(m) + 8, c.Y(Math.exp(-1)) - 6, labHTML({ html: `$1/\\gamma=${tnum(m, 0)}$ ns`, size: 16, color: C.red, bg: true }), 'lb'); } } }));
      const Di = new Chart(ci2, { w: 430, h: 500, m: { l: 64, r: 12, t: 34, b: 60 }, x: { min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10], label: '$t$ (s)', lpos: 'end' }, y: { min: 0, max: 25, ticks: [0, 5, 10, 15, 20, 25], label: '$E[x^2]$ (µm²)' } });
      Di.add(new Curve({ f: t => 2 * phys(IS.r).D * 1e12 * t, color: C.navy, w: 3.4, n: 100 }));
      Di.add(new Curve({ f: t => 2 * P0.D * 1e12 * t, color: C.gray, w: 2, dash: '6 5', n: 100 }));
      Di.add(new Label({ x: 9.8, y: 2 * P0.D * 1e12 * 10 + 1.2, an: 'rb', html: '0,5 µm (referência)', size: 14, color: C.mute }));
      const ro = Readout(ctx.cards.interp, [['r', 'raio'], ['g', 'memória $1/\\gamma$'], ['d', '$D$', 'g'], ['v', '$v_{\\rms}$']]);
      const upd = () => { const q = phys(IS.r); ro.set('r', nf(IS.r * 1e6, 2) + ' µm'); ro.set('g', nf(1e9 / q.g, 0) + ' ns'); ro.set('d', nf(q.D * 1e12, 3) + ' µm²/s'); ro.set('v', nf(q.vr * 1e3, 2) + ' mm/s'); Ri.render(); Di.render(); };
      Slider(lp.map.interp, { label: 'raio da esfera', min: -6.7, max: -5.8, step: 0.005, log: true, value: Math.log10(r0), fmt: v => nf(v * 1e6, 2) + ' µm', oninput: v => { IS.r = v; upd(); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k);
          lp.show(kind === 'interp' ? 'interp' : k <= I('r2') && kind === 'res' ? 'blk' : k >= I('r10') && kind === 'res' ? 'num' : kind === 'final' ? 'sv' : k <= I('r2') ? 'blk' : 'sv');
          const hi = k >= I('r11') ? 2 : 1;
          tbl.innerHTML = md(`<div style="font-size:13px;letter-spacing:.14em;color:#146B73;font-weight:600">ESFERA DE 0,5 µm EM ÁGUA, 300 K</div>$M\\gamma=6\\pi\\eta_{\\text{visc}}r\\approx${sciT(P0.Mg, 1)}$ kg/s<br>$M=\\rho\\frac43\\pi r^3\\approx${sciT(P0.M, 1)}$ kg` + (hi > 1 ? `<br><b style="color:#A86B12">$\\gamma\\approx${sciT(P0.g, 1)}$ s⁻¹</b><br>memória $1/\\gamma\\approx${tnum(1e9 / P0.g, 0)}$ ns<br><b style="color:#A86B12">$D\\approx${tnum(P0.D * 1e12, 2)}\\ \\mu$m²/s</b><br><b style="color:#A86B12">$v_{\\rms}\\approx${tnum(P0.vr * 1e3, 1)}$ mm/s</b>` : ''));
          Hc.goto(k, anim); Tr.goto(k, anim); Sv.goto(k, anim); Rv.goto(k, anim); Xc.goto(k, anim);
        }
      };
    }
  });
})();

/* ---------- Q8.20 · Largura de linha de um laser ---------- */
(() => {
  const lam = 1550e-9, dnu = 1e6, cL = 299792458;
  const f0 = cL / lam, tc = 1 / (PI * dnu), out = 1 - (2 / PI) * Math.atan(20);
  const Lz = (x) => (1 / PI) * 0.5 / (0.25 + x * x);       /* L(f), x = f/Δν, área 1 */
  const F0 = 15;                                         /* f0 ilustrativo em unidades de Δν */
  const steps = [
    { n: 'enun', k: 'enun' }, { n: 'plano', k: 'plano' },
    { n: 'a1', k: 'res', tag: '(a)', road: 1, tex: 'E(t+\\tau)E(t)=\\tfrac{E_0^2}{2}\\big[\\hl{\\cos(2\\pi f_0\\tau+\\Delta\\theta)}+\\cos(4\\pi f_0t+2\\pi f_0\\tau+\\theta(t{+}\\tau)+\\theta(t)+2\\Phi)\\big]', note: '$\\cos A\\cos B=\\frac12[\\cos(A-B)+\\cos(A+B)]$.' },
    { n: 'a2', k: 'res', road: 4, tex: '\\text{o termo com }2\\Phi\\text{ tem }\\hl{\\text{média nula}}', note: '$\\Phi$ uniforme em uma volta e independente de $\\theta$ (Capítulo 6).' },
    { n: 'a3', k: 'res', road: 4, tex: 'E[\\cos(2\\pi f_0\\tau+\\Delta\\theta)]=\\cos(2\\pi f_0\\tau)E[\\cos\\Delta\\theta]-\\mathrm{sen}(2\\pi f_0\\tau)\\hl{E[\\mathrm{sen}\\,\\Delta\\theta]}', note: 'Cosseno da soma.' },
    { n: 'a4', k: 'res', road: 4, tex: '\\hl{E[\\mathrm{sen}\\,\\Delta\\theta]=0}', note: 'Distribuição simétrica: seno é ímpar.' },
    { n: 'a5', k: 'res', road: 5, tex: 'R_E(\\tau)=\\hl{\\tfrac{E_0^2}{2}\\cos(2\\pi f_0\\tau)\\,E[\\cos\\Delta\\theta]}', note: 'Só depende de $\\tau$: o <i>campo</i> é WSS.' },
    { n: 'b1', k: 'res', tag: '(b)', road: 4, tex: 'E[\\cos\\Delta\\theta]=e^{-\\frac12\\cdot2\\pi\\Delta\\nu|\\tau|}=\\hl{e^{-\\pi\\Delta\\nu|\\tau|}}', note: '$E[\\cos Z]=e^{-s^2/2}$ com $s^2=2\\pi\\Delta\\nu|\\tau|$.' },
    { n: 'b2', k: 'res', road: 4, tex: 'R_E(\\tau)=\\hl{\\tfrac{E_0^2}{2}e^{-\\pi\\Delta\\nu|\\tau|}\\cos(2\\pi f_0\\tau)}', note: 'O ruído de fase faz a correlação <i>decair</i>.' },
    { n: 'b3', k: 'res', road: 3, tex: '\\tfrac{E_0^2}{2}e^{-a|\\tau|}\\leftrightarrow\\tfrac{E_0^2}{2}\\cdot\\frac{2a}{a^2+4\\pi^2f^2}=\\hl{\\tfrac{E_0^2}{2}L(f)},\\ a=\\pi\\Delta\\nu', note: 'Par lorentziano.' },
    { n: 'b4', k: 'res', road: 4, tex: 'L(f)=\\frac1\\pi\\,\\frac{\\Delta\\nu/2}{(\\Delta\\nu/2)^2+f^2},\\ \\hl{\\text{de área }1}', note: 'Simplificando $\\frac{2\\pi\\Delta\\nu}{\\pi^2\\Delta\\nu^2+4\\pi^2f^2}$.' },
    { n: 'b5', k: 'res', road: 3, tex: 'S_E(f)=\\hl{\\tfrac{E_0^2}{4}\\big[L(f-f_0)+L(f+f_0)\\big]}', note: 'Modulação: $\\cos(2\\pi f_0\\tau)$ desloca metade para $\\pm f_0$.' },
    { n: 'b6', k: 'res', road: 5, tex: '\\text{FWHM: }L(f)=\\tfrac12L(0)\\iff f^2=(\\Delta\\nu/2)^2\\Rightarrow\\hl{\\text{largura total }\\Delta\\nu}', note: 'Meia altura em $f=\\pm\\Delta\\nu/2$.' },
    { n: 'c1', k: 'res', tag: '(c)', road: 5, tex: `f_0=c/\\lambda\\approx\\hl{${tnum(f0 / 1e12, 1)}\\ \\mathrm{THz}};\\ 1/(\\pi\\Delta\\nu)\\approx\\hl{${tnum(tc * 1e9, 0)}\\ \\mathrm{ns}}\\ (c\\cdot${tnum(tc * 1e9, 0)}\\ \\mathrm{ns}\\approx${tnum(cL * tc, 0)}\\ \\mathrm m)`, note: 'Tempo e comprimento de coerência.' },
    { n: 'c2', k: 'res', road: 5, tex: `\\text{fora de }\\pm F:\\ 1-\\tfrac{2}{\\pi}\\arctan\\tfrac{2F}{\\Delta\\nu}=1-\\tfrac2\\pi\\arctan(20)\\approx\\hl{${tnum(out, 3)}}`, note: 'Integral da lorentziana; $F=10$ MHz.' },
    { n: 'd1', k: 'res', tag: '(d)', road: 4, tex: 'E[\\cos\\Delta\\theta]\\approx\\hl{1-\\tfrac12E[\\Delta\\theta^2]}', note: 'Taylor até segunda ordem (tese, Eq. 2.10).' },
    { n: 'd2', k: 'res', road: 4, tex: 'E[\\Delta\\theta^2]=\\hl{2R_\\theta(0)-2R_\\theta(\\tau)}', note: '$\\theta$ WSS de média nula (tese, Eq. 2.13).' },
    { n: 'd3', k: 'res', road: 4, tex: 'R_E(\\tau)\\approx\\tfrac{E_0^2}{2}\\big[\\hl{1-R_\\theta(0)+R_\\theta(\\tau)}\\big]\\cos(2\\pi f_0\\tau)', note: 'Forma da Eq. 2.15 da tese (com $m(t)=0$).' },
    { n: 'd4', k: 'res', road: 3, tex: '\\tfrac{E_0^2}{2}(1-R_\\theta(0))\\cos(2\\pi f_0\\tau)\\leftrightarrow\\hl{\\tfrac{E_0^2}{4}(1-R_\\theta(0))[\\delta(f\\mp f_0)]}', note: 'Parte constante: raia da portadora, <i>enfraquecida</i>.' },
    { n: 'd5', k: 'res', road: 3, tex: '\\tfrac{E_0^2}{2}R_\\theta(\\tau)\\cos(2\\pi f_0\\tau)\\leftrightarrow\\hl{\\tfrac{E_0^2}{4}[S_\\theta(f-f_0)+S_\\theta(f+f_0)]}', note: 'Modulação: um “pedestal” com a forma do espectro do ruído de fase.' },
    { n: 'd6', k: 'res', road: 5, tex: '\\text{Potência: }\\tfrac{E_0^2}{2}(1-R_\\theta(0))+\\tfrac{E_0^2}{2}R_\\theta(0)=\\hl{\\tfrac{E_0^2}{2}}', note: 'O ruído de fase não cria nem destrói potência: só a <i>redistribui</i>.' },
    { n: 'final', k: 'final' }, { n: 'interp', k: 'interp' }
  ];
  Question({
    id: 'q8-20', num: '8.20', level: 5, title: 'Largura de linha de um laser: ruído de fase e espectro lorentziano', steps,
    enun: {
      html: '$E(t)=E_0\\cos(2\\pi f_0t+\\theta(t)+\\Phi)$, $\\Phi\\sim\\mathrm U[0,2\\pi)$. (a) Se $\\Delta\\theta=\\theta(t+\\tau)-\\theta(t)$ é simétrico e só depende de $\\tau$: $R_E=\\frac{E_0^2}{2}\\cos(2\\pi f_0\\tau)E[\\cos\\Delta\\theta]$. (b) Henry: $\\Delta\\theta\\sim\\mathcal N(0,2\\pi\\Delta\\nu|\\tau|)$ — $R_E$, $S_E$ e FWHM. (c) $\\lambda=1550$ nm, $\\Delta\\nu=1$ MHz. (d) Baixa variância (tese, Caso I).',
      chips: ['$\\lambda=1550$ nm', '$\\Delta\\nu=1$ MHz', '$\\theta$: processo de Wiener', '!tese de Lins Júnior']
    },
    plano: { html: '(a) é o cálculo da senóide de fase aleatória (Capítulo 6) com uma fase extra. (b) precisa de um fato sobre a gaussiana: se $Z\\sim\\mathcal N(0,s^2)$, então $E[\\cos Z]=e^{-s^2/2}$. Depois, par lorentziano + modulação. (d) usa a aproximação de Taylor $\\cos x\\approx1-x^2/2$ da tese.', road: [1, 3] },
    final: { html: `(b) $R_E=\\frac{E_0^2}{2}e^{-\\pi\\Delta\\nu|\\tau|}\\cos(2\\pi f_0\\tau)$ e $S_E=\\frac{E_0^2}{4}[L(f-f_0)+L(f+f_0)]$, lorentziana de FWHM $\\Delta\\nu$. (c) $f_0\\approx${tnum(f0 / 1e12, 1)}$ THz, coerência $\\approx${tnum(tc * 1e9, 0)}$ ns ($\\approx${tnum(cL * tc, 0)}$ m) e $\\approx${tnum(100 * out, 1)}\\%$ (≈ −15 dB) da potência fora de ±10 MHz. (d) Raia residual de peso $1-R_\\theta(0)$ mais um pedestal com a forma de $S_\\theta$.` },
    interp: {
      boxes: [
        ['interp', 'A fase $\\theta(t)$ <b>não</b> é WSS (a variância cresce com $t$), mas o <i>campo</i> é — porque só os <i>incrementos</i> da fase aparecem em $R_E$. Arraste $R_\\theta(0)$: a raia perde peso, o pedestal ganha, e a potência total fica fixa.', { size: 'xs' }],
        ['pesq', 'A tese de Lins Júnior (2013, UFCG) generaliza este cálculo: inclui ruído de <b>amplitude</b>, trata três regimes de variância do ruído de fase (baixa: raia + pedestal; média; alta: teorema de Woodward) e leva o campo por moduladores Mach–Zehnder até o vazamento entre subportadoras OFDM. A ferramenta central: <i>calcular a autocorrelação e aplicar Wiener–Khinchin</i>.', { size: 'xs' }]
      ]
    },
    notes: {
      fala: 'Fecha um ciclo do Capítulo 7: lá a fase aleatória <i>constante</i> não alargava a raia — só “apagava o relógio”. Aqui a fase varia no tempo como um passeio aleatório, e a raia vira uma lorentziana. Curiosidade: medir a largura de linha é difícil (raia a 193 THz com MHz de largura); o truque DSHD (Okoshi, Kikuchi e Nakayama, 1980) faz o batimento cair em RF.',
      pergunta: 'Por que um laser não é uma raia perfeita no analisador de espectro?',
      tempo: '15 min'
    },
    left(L, st, ctx) {
      const lp = LeftPanes(L, ['a', 'b', 'd', 'interp']);
      const { I, from, only } = st;
      /* ---- painel a ---- */
      const fv = 1.2, dv = 0.12;                                  /* ilustrativos */
      const th = (() => { const g = gauss(2020), o = [0]; for (let i = 1; i <= 800; i++) o.push(o[i - 1] + Math.sqrt(2 * PI * dv * 0.01) * g()); return o; })();
      const ce = chartCard(lp.map.a, 'Uma realização do campo $E(t)$ (frequências ilustrativas)');
      const Ec = new Chart(ce, { w: 904, h: 200, m: { l: 52, r: 14, t: 14, b: 44 }, x: { min: 0, max: 8, ticks: [0, 2, 4, 6, 8], label: '$t$', lpos: 'end' }, y: { min: -1.5, max: 1.5, ticks: [[-1, '-E_0'], [0, '0'], [1, 'E_0']] } });
      Ec.add(new Curve({ pts: th.map((t, i) => [i * 0.01, Math.cos(2 * PI * fv * i * 0.01 + t + 0.7)]), color: C.navy, w: 2.2, vis: k => k >= 0 }));
      Ec.add(new Custom({ vis: from('a1'), draw(c, g, p, mk) { for (const [t, l] of [[2.3, '$t$'], [3.1, '$t+\\tau$']]) { SV('line', { x1: c.X(t), x2: c.X(t), y1: c.y0, y2: c.y1, stroke: C.goldD, 'stroke-width': 2.4 }, g); mk.lab(l).set(c.X(t), c.y0 + 2, labHTML({ html: l, size: 16, color: C.goldD, bg: true }), 'ct'); } } }));
      Ec.add(new Label({ x: 7.9, y: 1.32, an: 'rm', html: '$R_E(\\tau)$ só depende de $\\tau$ ⇒ <b>campo WSS</b>', size: 17, bg: true, color: C.petro, vis: only('a5') }));
      const ra = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' } }); lp.map.a.append(ra);
      const c2p = chartCard(ra, 'Termo com $2\\Phi$ para 8 valores de $\\Phi$'), cpd = chartCard(ra, 'Densidade de $\\Delta\\theta$ (simétrica) e $\\mathrm{sen}\\,\\Delta\\theta$');
      const P2 = new Chart(c2p, { w: 430, h: 350, m: { l: 46, r: 12, t: 30, b: 50 }, x: { min: 0, max: 2, ticks: [0, 0.5, 1, 1.5, 2].map(v => [v, nf(v, 1)]), label: '$t$', lpos: 'end' }, y: { min: -1.3, max: 1.4, ticks: [-1, 0, 1] } });
      for (let j = 0; j < 8; j++) P2.add(new Curve({ f: t => Math.cos(4 * PI * fv * t + 2 * (j * PI / 8)), color: '#9FB3BF', w: 1.6, op: .8, vis: from('a2'), delay: j * 80 }));
      P2.add(new Curve({ f: () => 0, color: C.red, w: 4, vis: from('a2'), delay: 800 }));
      P2.add(new Label({ x: 1, y: 1.25, html: 'média sobre $\\Phi$: <b style="color:#C0392B">zero</b>', size: 16, bg: true, vis: from('a2'), delay: 800 }));
      const s2 = 1.2, pdf = x => Math.exp(-x * x / (2 * s2)) / Math.sqrt(2 * PI * s2);
      const Pd = new Chart(cpd, { w: 430, h: 350, m: { l: 46, r: 12, t: 30, b: 50 }, x: { min: -4, max: 4, ticks: [-4, -2, 0, 2, 4], label: '$\\Delta\\theta$', lpos: 'end' }, y: { min: -0.4, max: 0.45, ticks: [-0.3, 0, 0.3].map(v => [v, nf(v, 1)]) } });
      Pd.add(new Curve({ f: pdf, color: C.navy, w: 3, n: 400, vis: from('a3') }));
      Pd.add(new Area({ f: x => pdf(x) * Math.sin(x), a: 0, b: 4, fill: 'rgba(20,107,115,.45)', n: 300, vis: from('a4') }));
      Pd.add(new Area({ f: x => pdf(x) * Math.sin(x), a: -4, b: 0, fill: 'rgba(192,57,43,.4)', n: 300, vis: from('a4') }));
      Pd.add(new Curve({ f: x => pdf(x) * Math.sin(x), color: C.goldD, w: 2.6, n: 400, vis: from('a4') }));
      Pd.add(new Label({ x: 0, y: 0.38, html: '$p(\\Delta\\theta)$ par', size: 15, bg: true, vis: from('a3') }));
      Pd.add(new Label({ x: 0, y: -0.3, html: '$\\int p\\,\\mathrm{sen}=0$: áreas se cancelam', size: 15, bg: true, color: C.goldD, vis: from('a4') }));
      /* ---- painel b (+c) ---- */
      const rb = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }); lp.map.b.append(rb);
      const cth = chartCard(rb, 'Fase $\\theta(t)$ (rad): 3 realizações, não WSS'), cre = chartCard(rb, '$E[\\cos\\Delta\\theta]$');
      const ttl = cre.querySelector('.cc-t span');
      const wp = [0, 1, 2].map(j => { const g = gauss(500 + j), o = [[0, 0]]; let x = 0; for (let i = 1; i <= 400; i++) { x += Math.sqrt(2 * PI * 0.02) * g(); o.push([i * 0.02, x]); } return o; });
      const Th = new Chart(cth, { w: 430, h: 250, m: { l: 52, r: 12, t: 14, b: 46 }, x: { min: 0, max: 8, ticks: [0, 2, 4, 6, 8], label: '$t\\cdot\\Delta\\nu$', lpos: 'end' }, y: { min: -14, max: 14, ticks: [-12, -8, -4, 0, 4, 8, 12] } });
      Th.add(new Area({ f: t => Math.sqrt(2 * PI * t), base: t => -Math.sqrt(2 * PI * t), fill: 'rgba(160,175,185,.2)', n: 200 }));
      wp.forEach((p, j) => Th.add(new Curve({ pts: p, color: [C.navy, C.petro, C.goldD][j], w: 1.8, vis: k => k >= 0 })));
      Th.add(new Label({ x: 7.8, y: -12, an: 'rm', html: 'variância $2\\pi\\Delta\\nu\\,t$ cresce', size: 14, color: C.mute, bg: true }));
      const Re = new Chart(cre, { w: 430, h: 250, m: { l: 52, r: 12, t: 14, b: 46 }, x: { min: -1.2, max: 1.2, ticks: [-1, -0.5, 0, 0.5, 1].map(v => [v, nf(v, 1)]), label: '$\\tau\\cdot\\Delta\\nu$', lpos: 'end' }, y: { min: -1.15, max: 1.15, ticks: [-1, 0, 1] } });
      Re.add(new Curve({ f: t => Math.exp(-PI * Math.abs(t)), color: C.goldD, w: 3, n: 400, vis: from('b1') }));
      Re.add(new Curve({ f: t => -Math.exp(-PI * Math.abs(t)), color: C.goldD, w: 2, dash: '6 5', n: 400, vis: from('b2') }));
      Re.add(new Curve({ f: t => Math.exp(-PI * Math.abs(t)) * Math.cos(2 * PI * 6 * t), color: C.petro, w: 2.2, n: 1200, vis: from('b2') }));
      Re.add(new Label({ x: 0.6, y: 0.75, html: '$e^{-\\pi\\Delta\\nu|\\tau|}$', size: 16, color: C.goldD, bg: true, vis: from('b1') }));
      const cS = chartCard(lp.map.b, 'Espectro do campo', { style: { marginTop: '10px' } });
      const kz = k => k >= I('b6');
      const zT = [[3, ''], [5, '-10'], [10, '-5'], [15, '0'], [20, '5'], [25, '10'], [27, '']];
      const Sp = new Chart(cS, {
        w: 904, h: 330, m: { l: 66, r: 14, t: 30, b: 56 }, x: { min: -10, max: 10, ticks: [-10, -5, 0, 5, 10], label: '$f/\\Delta\\nu$', lpos: 'end' }, y: { min: 0, max: 0.72, ticks: [0, 0.2, 0.4, 0.6].map(v => [v, nf(v, 1)]), label: '(unid. $E_0^2/2\\Delta\\nu$)', db: false, dmin: -40, dmax: 0, dticks: [-40, -30, -20, -10, 0], dlabel: 'dB (unid. $E_0^2/2\\Delta\\nu$)' },
        dom: k => k >= I('b6') && k <= I('c2') ? { x: [3, 27], xticks: zT, xlabel: '$(f-f_0)/\\Delta\\nu$', db: k === I('c2') } : k >= I('b5') ? { x: [-27, 27], xticks: [[-F0, '-f_0'], [0, '0'], [F0, 'f_0']], xlabel: '$f$ ($f_0$ fora de escala)', db: false } : { x: [-10, 10], xticks: [-10, -5, 0, 5, 10], xlabel: '$f/\\Delta\\nu$', db: false }
      });
      const shift = k => k >= I('b5') ? F0 : 0;
      Sp.add(new Area({ f: (x, p) => 0.5 * (Lz(x - p) + Lz(x + p)), p: shift, pdur: 1400, fill: C.petroF, n: 1600, vis: from('b3') }));
      Sp.add(new Curve({ f: (x, p) => 0.5 * (Lz(x - p) + Lz(x + p)), p: shift, pdur: 1400, color: C.petro, w: 3.4, n: 2400, vis: from('b3') }));
      Sp.add(new Label({ x: 5, y: 0.5, html: '$\\tfrac{E_0^2}{2}L(f)$, área $\\tfrac{E_0^2}{2}$', size: 17, bg: true, vis: only('b3', 'b4') }));
      Sp.add(new Label({ x: 5, y: 0.35, html: '$L$: área 1, pico $\\frac{2}{\\pi\\Delta\\nu}$', size: 16, bg: true, color: C.goldD, vis: only('b4') }));
      Sp.add(new Label({ x: 0, y: 0.5, html: 'metade em $+f_0$, metade em $-f_0$', size: 17, bg: true, vis: only('b5') }));
      Sp.add(new Bracket({ x0: F0 - 0.5, x1: F0 + 0.5, y: 0.5 * Lz(0.5), html: 'FWHM $=\\Delta\\nu$', color: C.red, vis: only('b6', 'c1') }));
      Sp.add(new Area({ f: x => 0.5 * Lz(x - F0), a: 3, b: 5, fill: 'rgba(192,57,43,.55)', n: 60, vis: only('c2') }));
      Sp.add(new Area({ f: x => 0.5 * Lz(x - F0), a: 25, b: 27, fill: 'rgba(192,57,43,.55)', n: 60, vis: only('c2') }));
      Sp.add(new Label({ x: 15, y: () => Sp.dbmix > .5 ? Math.pow(10, -2.6) : 0.05, html: `fora de $\\pm10$ MHz: $${tnum(100 * out, 1)}\\%$ (≈ $${tnum(10 * Math.log10(out), 0)}$ dB)`, size: 17, color: C.red, bg: true, vis: only('c2') }));
      const cnum = E('div', { class: 'card', style: { position: 'absolute', right: '20px', top: '336px', padding: '8px 14px', fontSize: '17px', lineHeight: 1.6, zIndex: 3 } }); lp.map.b.append(cnum);
      cnum.innerHTML = md(`$f_0=c/\\lambda\\approx${tnum(f0 / 1e12, 1)}$ THz<br>$\\Delta\\nu=1$ MHz<br>coerência $1/(\\pi\\Delta\\nu)\\approx${tnum(tc * 1e9, 0)}$ ns ($\\approx${tnum(cL * tc, 0)}$ m)`);
      /* ---- painel d ---- */
      const DS = { r0: 0.2 };
      const Rth = t => DS.r0 * Math.exp(-Math.abs(t) * 3);
      const rd = E('div', { style: { display: 'grid', gridTemplateColumns: '330px 1fr', gap: '12px' } }); lp.map.d.append(rd);
      const cty = chartCard(rd, 'Taylor: $\\cos x\\approx1-x^2/2$');
      const Ty = new Chart(cty, { w: 302, h: 250, m: { l: 44, r: 10, t: 14, b: 44 }, x: { min: -2, max: 2, ticks: [-2, -1, 0, 1, 2], label: '$x$', lpos: 'end' }, y: { min: -1.1, max: 1.15, ticks: [-1, 0, 1] } });
      Ty.add(new Curve({ f: Math.cos, color: C.navy, w: 3, vis: k => k >= 0 }));
      Ty.add(new Curve({ f: x => 1 - x * x / 2, color: C.goldD, w: 2.6, dash: '7 5', vis: from('d1') }));
      Ty.add(new Label({ x: 0, y: -0.75, html: 'bom para $|x|\\lesssim0{,}5$', size: 15, bg: true, vis: from('d1') }));
      const cen = chartCard(rd, 'Envoltória de $R_E$: $1-R_\\theta(0)+R_\\theta(\\tau)$');
      const En = new Chart(cen, { w: 560, h: 250, m: { l: 100, r: 12, t: 14, b: 44 }, x: { min: -2, max: 2, ticks: [-2, -1, 0, 1, 2], label: '$\\tau$ (ilustrativo)', lpos: 'end' }, y: { min: 0, max: 1.15, ticks: [[0, '0'], [0.8, '1-R_\\theta(0)'], [1, '1']] } });
      En.add(new Curve({ f: t => Rth(t), color: C.aquaD, w: 2.6, vis: from('d2') }));
      En.add(new Curve({ f: t => 2 * DS.r0 - 2 * Rth(t), color: C.goldD, w: 2.6, dash: '7 5', vis: only('d2') }));
      En.add(new Label({ x: 1.95, y: 0.5, an: 'rm', html: '<span style="color:#2E9C94">━ $R_\\theta(\\tau)$</span><br><span style="color:#C7861E">┅ $E[\\Delta\\theta^2]=2R_\\theta(0)-2R_\\theta(\\tau)$</span>', size: 15, bg: true, vis: only('d2') }));
      En.add(new Curve({ f: t => 1 - DS.r0 + Rth(t), color: C.petro, w: 3.4, vis: from('d3') }));
      En.add(new HLine({ y: () => 1 - DS.r0, color: C.navy, w: 2, dash: '6 5', html: 'piso que nunca decai ⇒ <b>raia</b>', lx: 1.95, dy: -4, vis: from('d3') }));
      const csp = chartCard(lp.map.d, 'Espectro em torno de $+f_0$: raia residual + pedestal', { style: { marginTop: '10px' } });
      const Pe = new Chart(csp, { w: 904, h: 300, m: { l: 66, r: 200, t: 30, b: 50 }, x: { min: -6, max: 6, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$f-f_0$ (ilustrativo)', lpos: 'end' }, y: { min: 0, max: 0.6, ticks: [0, 0.2, 0.4].map(v => [v, nf(v, 1)]), label: 'unid. $E_0^2/2$' } });
      const Sth = x => DS.r0 * lor(x, 3) / 2;                     /* metade em +f0: área r0/2 */
      Pe.add(new Area({ f: Sth, fill: C.goldF, n: 400, vis: from('d5') }));
      Pe.add(new Curve({ f: Sth, color: C.goldD, w: 3, n: 600, vis: from('d5') }));
      Pe.add(new Impulse({ x: 0, h: () => (1 - DS.r0) / 2 * 0.9, color: C.navy, tex: '\\tfrac{E_0^2}{4}(1-R_\\theta(0))\\,\\delta', size: 16, vis: from('d4') }));
      Pe.add(new Label({ x: 3.2, y: 0.12, html: 'pedestal: forma de $S_\\theta$', size: 15, color: C.goldD, bg: true, vis: from('d5') }));
      Pe.add(new Custom({
        vis: from('d6'), layer: 'top', draw(c, g, p, mk) {
          const x0 = c.x1 + 40, w = 46, top = c.y0 + 10, H = c.ih - 20, a = 1 - DS.r0;
          SV('rect', { x: x0, y: top + H * (1 - a), width: w, height: H * a, fill: C.navy }, g);
          SV('rect', { x: x0, y: top, width: w, height: H * (1 - a), fill: C.goldD }, g);
          mk.lab('a').set(x0 + w + 8, top + H * (1 - a / 2), labHTML({ html: `raia<br>$${tnum(a, 2)}$`, size: 14, color: C.navy }), 'lm');
          mk.lab('b').set(x0 + w + 8, top + H * (1 - a) / 2, labHTML({ html: `pedestal<br>$${tnum(1 - a, 2)}$`, size: 14, color: C.goldD }), 'lm');
          mk.lab('t').set(x0 + w / 2, top - 4, labHTML({ html: 'total $=1$', size: 14, weight: 700 }), 'cb');
        }
      }));
      /* ---- interpretação: slider de R_θ(0) ---- */
      const ci = chartCard(lp.map.interp, 'Baixa variância: a raia cede área ao pedestal');
      const Pi = new Chart(ci, { w: 904, h: 520, m: { l: 66, r: 200, t: 34, b: 56 }, x: { min: -6, max: 6, ticks: [-6, -4, -2, 0, 2, 4, 6], label: '$f-f_0$ (ilustrativo)', lpos: 'end' }, y: { min: 0, max: 0.6, ticks: [0, 0.2, 0.4].map(v => [v, nf(v, 1)]), label: 'unid. $E_0^2/2$' } });
      Pi.add(new Area({ f: Sth, fill: C.goldF, n: 400 })); Pi.add(new Curve({ f: Sth, color: C.goldD, w: 3, n: 600 }));
      Pi.add(new Impulse({ x: 0, h: () => (1 - DS.r0) / 2 * 0.9, color: C.navy, tex: '\\text{raia}', size: 16 }));
      Pi.add(new Custom({ layer: 'top', draw(c, g, p, mk) { const x0 = c.x1 + 40, w = 52, top = c.y0 + 10, H = c.ih - 20, a = 1 - DS.r0; SV('rect', { x: x0, y: top + H * (1 - a), width: w, height: H * a, fill: C.navy }, g); SV('rect', { x: x0, y: top, width: w, height: H * (1 - a), fill: C.goldD }, g); mk.lab('a').set(x0 + w + 8, top + H * (1 - a / 2), labHTML({ html: `raia $${tnum(a, 2)}$`, size: 15, color: C.navy }), 'lm'); mk.lab('b').set(x0 + w + 8, top + H * (1 - a) / 2, labHTML({ html: `pedestal $${tnum(1 - a, 2)}$`, size: 15, color: C.goldD }), 'lm'); mk.lab('t').set(x0 + w / 2, top - 4, labHTML({ html: 'potência total $=1$', size: 14, weight: 700 }), 'cb'); } }));
      const ro = Readout(ctx.cards.interp, [['r', '$R_\\theta(0)$ (variância da fase)'], ['a', 'peso da raia'], ['p', 'área do pedestal'], ['t', 'potência total', 'g']]);
      const upd = () => { ro.set('r', nf(DS.r0, 2) + ' rad²'); ro.set('a', nf(1 - DS.r0, 2)); ro.set('p', nf(DS.r0, 2)); ro.set('t', '1 (fixa)'); Pi.render(); };
      Slider(lp.map.interp, { label: '$R_\\theta(0)$', min: 0, max: 0.5, step: 0.01, value: 0.2, fmt: v => nf(v, 2) + ' rad²', oninput: v => { DS.r0 = v; upd(); [En, Pe].forEach(c => c.render()); } }).row.style.cssText = 'background:var(--paper);border-radius:12px;margin-top:10px;padding:8px 14px';
      upd();
      return {
        goto(k, anim) {
          const kind = st.kind(k), n = st.name(k) || '';
          lp.show(kind === 'interp' ? 'interp' : kind === 'final' ? 'b' : n[0] === 'd' ? 'd' : n[0] === 'b' || n[0] === 'c' ? 'b' : 'a');
          ttl.innerHTML = md(k >= I('b2') ? '$R_E(\\tau)$: envoltória × cosseno ($f_0$ ilustrativo)' : '$E[\\cos\\Delta\\theta]=e^{-\\pi\\Delta\\nu|\\tau|}$');
          cnum.style.display = n === 'c1' ? '' : 'none';
          [Ec, P2, Pd, Th, Re, Sp, Ty, En, Pe].forEach(c => c.goto(k, anim));
        }
      };
    }
  });
})();

/* =====================================================================
   FECHO — simulação da Seção 8.9, síntese e checklist
   ===================================================================== */
let SIM89 = null;
function sim89() {
  if (SIM89) return SIM89;
  const a = 0.9, N = 200000, g = gauss(113), s = Math.sqrt(1 - a * a), x = new Float64Array(N);
  let v = 0; for (let i = 0; i < 1000; i++) v = a * v + s * g();
  let mean = 0; for (let i = 0; i < N; i++) { v = a * v + s * g(); x[i] = v; mean += v; }
  mean /= N; for (let i = 0; i < N; i++) x[i] -= mean;
  const K = 200, R = new Float64Array(K + 1);
  for (let m = 0; m <= K; m++) { let acc = 0; for (let i = 0; i < N - m; i++) acc += x[i] * x[i + m]; R[m] = acc / (N - m); }
  const w = welch(x, 1024, 1);
  const wel = w.f.map((f, i) => [2 * PI * f, w.S[i]]);
  const s0w = (() => { const i = w.f.findIndex(f => f >= 0); return w.S[i]; })();
  SIM89 = { a, x, R, wel, s0w };
  return SIM89;
}
function swk(K, wv) { const S = sim89(); let s = S.R[0]; for (let k = 1; k <= K; k++) s += 2 * S.R[k] * (1 - k / (K + 1)) * Math.cos(wv * k); return s; }

addScene({
  id: 'sim', group: 'f', mnum: 'F1', short: 'Sim 8.9', menu: 'Simulação: Wiener–Khinchin na prática (Seção 8.9)', steps: ['traj', 'rhat', 'tres', 'k'],
  notes: {
    fala: 'Os dois caminhos — “Fourier da autocorrelação” (este capítulo) e “média de periodogramas” (Capítulo 7) — chegam à mesma curva, como o teorema garante. A janela de Bartlett aplicada a $\\hat R_X$ é exatamente a janela triangular da demonstração (Eq. 8.4). Os números variam um pouco em relação à apostila porque o gerador aleatório do navegador não é o do NumPy.',
    pergunta: 'O que acontece com o pico em $\\omega=0$ se eu usar só $K=20$ defasagens?',
    tempo: '8 min'
  },
  build(root) {
    const st = Steps(this.steps), { I, from, only } = st;
    const f = Frame(root, { kicker: 'Fecho · Seção 8.9 · Simulação computacional', title: 'Wiener–Khinchin na prática: três caminhos, uma DEP', split: true });
    const SS = { K: 200 };
    const S = sim89();
    const ct = chartCard(f.L, 'Passo 1: um trecho da trajetória AR(1), $a=0{,}9$ (200 000 amostras simuladas)');
    const Tj = new Chart(ct, { w: 904, h: 150, m: { l: 46, r: 14, t: 8, b: 40 }, x: { min: 0, max: 400, ticks: [0, 100, 200, 300, 400], label: '$n$', lpos: 'end' }, y: { min: -3.5, max: 3.5, ticks: [-3, 0, 3] } });
    Tj.add(new Curve({ pts: Array.from({ length: 401 }, (_, i) => [i, S.x[i + 5000]]), color: C.petro, w: 1.6, vis: k => k >= 0 }));
    const row = E('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' } }); f.L.append(row);
    const cr = chartCard(row, 'Passo 2: $\\hat R_X[k]$ por média temporal'), cs = chartCard(row, 'Passos 3–5: DEP (escala log)');
    const Rk = new Chart(cr, { w: 430, h: 420, m: { l: 52, r: 12, t: 30, b: 56 }, x: { min: -41, max: 41, ticks: [-40, -20, 0, 20, 40], label: '$k$', lpos: 'end' }, y: { min: 0, max: 1.1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1].map(v => [v, nf(v, 1)]) } });
    const est = []; for (let k = -40; k <= 40; k++) est.push([k, S.R[Math.abs(k)]]);
    Rk.add(new Stems({ pts: est, color: C.petro, r: 3, w: 1.6, vis: from('rhat') }));
    Rk.add(new Curve({ f: k => Math.pow(0.9, Math.abs(k)), color: C.red, w: 2.2, dash: '7 5', n: 400, vis: from('rhat') }));
    Rk.add(new Label({ x: 40, y: 1.0, an: 'rm', html: '<span style="color:#146B73">● estimada</span><br><span style="color:#C0392B">┅ teoria $0{,}9^{|k|}$</span>', size: 15, bg: true, vis: from('rhat') }));
    const Sd = new Chart(cs, { w: 430, h: 420, m: { l: 58, r: 12, t: 30, b: 56 }, x: { min: -PI, max: PI, ticks: W_TICKS, label: '$\\omega$', lpos: 'end' }, y: { min: 0, max: 1, db: true, dmin: -15, dmax: 15, dticks: [-15, -10, -5, 0, 5, 10, 15], dlabel: '$S$ (dB)' } });
    Sd.add(new Curve({ pts: S.wel.filter(([w]) => Math.abs(w) <= PI), color: C.goldD, w: 1.8, op: .85, vis: from('tres') }));
    Sd.add(new Curve({ f: w => Math.max(swk(SS.K, w), 1e-3), color: C.navy, w: 2.8, n: 700, vis: from('tres'), delay: 400 }));
    Sd.add(new Curve({ f: w => (1 - 0.81) / (1 - 1.8 * Math.cos(w) + 0.81), color: C.red, w: 2.2, dash: '7 5', n: 700, vis: from('tres'), delay: 800 }));
    Sd.add(new Label({ x: 3.05, y: Math.pow(10, 1.25), an: 'rm', html: '<span style="color:#C7861E">━ Welch (Cap. 7)</span><br><span style="color:#0B2540">━ $\\mathcal F\\{\\hat R_X\\}$ (W–K)</span><br><span style="color:#C0392B">┅ teoria (Q8.8)</span>', size: 14, bg: true, vis: from('tres') }));
    const box = Box('teorema', 'Simulação da apostila (Python/NumPy) reproduzida no navegador: AR(1) com $a=0{,}9$, $\\hat R_X$ por média temporal, $\\mathcal F\\{\\hat R_X\\}$ com janela de Bartlett, Welch com 1024 amostras por segmento e a teoria da Q8.8.', { sub: 'objetivo', size: 'xs' });
    box.querySelector('.box-h').firstChild.textContent = 'SIMULAÇÃO COMPUTACIONAL';
    f.R.append(box);
    const ro = Readout(f.R, [['r', '$\\hat R_X[0..3]$ (teoria 1; 0,9; 0,81; 0,73)'], ['s', '$\\hat S(0)$: W–K · Welch · teoria'], ['p', 'potência $\\frac{1}{2\\pi}\\int\\hat S\\,\\dd\\omega$', 'g']]);
    const note = E('div', { class: 'note-s', html: md('Valores <b>estimados nesta simulação</b> (gerador do navegador, semente fixa). A apostila obtém $\\approx(1{,}01;\\,0{,}91;\\,0{,}83;\\,0{,}74)$, $19{,}0$ e $19{,}8$. Com $K$ pequeno, o pico em DC cai e alarga (resolução $\\approx1/K$).') }); f.R.append(note);
    const sc = E('div', { class: 'card', style: { padding: '4px 14px' } }); f.R.append(sc);
    const upd = () => {
      ro.set('r', [0, 1, 2, 3].map(k => nf(S.R[k], 2)).join('; '));
      ro.set('s', `${nf(swk(SS.K, 0), 1)} · ${nf(S.s0w, 1)} · 19`);
      const pw = integ(w => swk(SS.K, w), -PI, PI, 800) / (2 * PI);
      ro.set('p', nf(pw, 2));
      Sd.render();
    };
    const sl = Slider(sc, { label: 'defasagens $K$', min: 5, max: 200, step: 1, value: 200, fmt: v => String(Math.round(v)) + (v < 40 ? ' (resolução ≈ 1/K)' : ''), oninput: v => { SS.K = Math.round(v); upd(); } });
    upd();
    return {
      goto(k, anim) {
        Tj.goto(k, anim); Rk.goto(k, anim); Sd.goto(k, anim);
        ro.root.style.opacity = k >= I('tres') ? 1 : .3; sc.style.opacity = k >= I('k') ? 1 : .3; sl.inp.disabled = k < I('k');
        if (k < I('k') && SS.K !== 200) { SS.K = 200; sl.set(200); upd(); }
      }
    };
  }
});

addScene({
  id: 'sintese', group: 'f', mnum: 'F2', short: 'Síntese', menu: 'Síntese: as assinaturas da DEP', steps: ['piso', 'lor', 'sinc', 'raias', 'nums'],
  notes: {
    fala: 'Ao olhar qualquer DEP, procure as quatro assinaturas: piso plano (sem memória), lorentziana (memória exponencial), sinc² (memória finita, pulsos), raias (componentes determinísticas). Elas apareceram em todas as questões.',
    pergunta: 'Qual assinatura tem o ruído do sensor Hall da Q8.9? (Resposta: três — raia em zero, lorentziana e raias em ±60 Hz.)',
    tempo: '4 min'
  },
  build(root) {
    const st = Steps(this.steps), { I } = st;
    const f = Frame(root, { kicker: 'Fecho · Seção 8.12', title: 'As assinaturas: o que a forma da DEP conta sobre o processo' });
    const g = E('div', { class: 'g4' }); f.body.append(g);
    const sig = [
      { t: 'Piso plano', fx: '$R=\\frac{N_0}{2}\\delta(\\tau)\\leftrightarrow S=\\frac{N_0}{2}$', who: 'sem memória: ruído branco, térmico (Q8.14), amostras a $f_s=2B$ (Q8.10)', r: { imp: [[0, 1]] }, s: { f: () => 0.6 } },
      { t: 'Lorentziana', fx: '$e^{-a|\\tau|}\\leftrightarrow\\frac{2a}{a^2+4\\pi^2f^2}$', who: 'memória exponencial: RC (Q8.15), Langevin (Q8.19), laser (Q8.20)', r: { f: t => Math.exp(-2 * Math.abs(t)) }, s: { f: x => lor(x, 2) } },
      { t: 'sinc²', fx: '$(1-|\\tau|/T)_+\\leftrightarrow T\\,\\mathrm{sinc}^2(fT)$', who: 'memória finita, pulsos: NRZ (Q8.18), triângulo (Q8.7)', r: { f: t => Math.max(0, 1 - Math.abs(t)) }, s: { f: x => sinc(x) ** 2 } },
      { t: 'Raias', fx: '$c\\leftrightarrow c\\,\\delta(f)$; $\\cos\\leftrightarrow\\delta(f\\mp f_0)$', who: 'componentes determinísticas: DC e hum de 60 Hz (Q8.9), portadora (Ex. 8.1)', r: { f: t => Math.cos(2 * PI * t), y: [-1.1, 1.1] }, s: { imp: [[-1, 0.5], [1, 0.5], [0, 0.8]] } }
    ];
    const cards = sig.map(s => {
      const c = E('div', { class: 'card pcard dim', style: { padding: '12px 14px' } }, E('h5', null, E('span', { text: s.t })), E('div', { class: 'fx', style: { fontSize: '18px', minHeight: '44px' }, html: md(s.fx) }));
      const mini = E('div', { class: 'mini', style: { display: 'grid', gridTemplateColumns: '1fr 22px 1fr', alignItems: 'center' } }); c.append(mini);
      const mk = (sp, lab) => { const yr = sp.y || [0, 1.15]; const ch = new Chart(mini, { w: 160, h: 150, m: { l: 6, r: 6, t: 8, b: 24 }, x: { min: -3, max: 3, ticks: [] }, y: { min: yr[0], max: yr[1], ticks: [] }, grid: false }); const fo = new FO(ch.L.top); fo.set(154, 149, labHTML({ html: lab, size: 15, color: '#4E6476' }), 'rb'); if (sp.f) { ch.add(new Area({ f: sp.f, fill: C.goldF2, n: 300 })); ch.add(new Curve({ f: sp.f, w: 2.6, n: 500 })); } if (sp.imp) sp.imp.forEach(([x, h]) => ch.add(new Impulse({ x, h, w: 2.6, hs: 10 }))); return ch; };
      mk(s.r, '$\\tau$'); mini.append(E('div', { class: 'arr', style: { color: '#A86B12', fontWeight: 700, textAlign: 'center' }, text: '⟷' })); mk(s.s, '$f$');
      c.append(E('div', { style: { fontSize: '16px', color: '#33495C', marginTop: '6px', lineHeight: 1.35 }, html: md(s.who) }));
      g.append(c); return c;
    });
    const nums = Box('resultado', '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px 24px">' + ['$-174$ dBm/Hz (térmico, Q8.14)', '$V_{\\rms}=e_n\\sqrt{\\Delta f}$ (Q8.3)', '$4kTR$ unilateral (Q8.16)', '$kT/C$ (Q8.16)', '$B_N=\\frac{\\pi}{2}f_{3\\mathrm{dB}}$ (Q8.15)', '$B_N\\tau_c=\\frac14$ (Q8.13)'].map(t => `<div>${md(t)}</div>`).join('') + '</div>', { sub: 'números de bancada', size: 'sm' });
    nums.style.marginTop = '16px';
    f.body.append(nums);
    return { goto(k) { cards.forEach((c, i) => c.classList.toggle('dim', !(k >= i))); nums.style.opacity = k >= I('nums') ? 1 : 0; } };
  }
});

addScene({
  id: 'checklist', group: 'f', mnum: 'F3', short: 'Checklist', menu: 'Checklist final e referências', steps: ['c1', 'c2', 'c3', 'c4', 'c5', 'refs'],
  notes: {
    fala: 'Cinco perguntas antes de entregar qualquer conta com DEP. Cada uma corresponde a um erro que apareceu no capítulo — e cada uma custa um fator: 2 (bilateral), $2\\pi$ (f ou ω), um quadrado ($|H|^2$), ou a validade inteira do resultado (WSS).',
    pergunta: 'Qual destes itens você mais esquece?',
    tempo: '3 min'
  },
  build(root) {
    const st = Steps(this.steps), { I } = st;
    const f = Frame(root, { kicker: 'Fecho · Sempre confira', title: 'Checklist antes de entregar uma conta com DEP', split: true });
    const items = [
      ['O processo é WSS?', 'Média constante e $R_X$ só de $\\tau$. Sem isso, nada de Wiener–Khinchin — a fase de Wiener (Q8.20) e a posição browniana (Q8.19) não são WSS; o NRZ só é graças a $D$ (Q8.18).'],
      ['$\\int S\\,\\dd f=R(0)$?', 'A área da DEP tem de devolver a potência. É a conferência mais barata (Q8.6, Q8.9, Q8.18).'],
      ['Bilateral ou unilateral?', '$G=2S$ para $f\\ge0$: misturar custa um fator 2 (3 dB). $4kTR$ e $N_0$ são unilaterais (Q8.14, Q8.16).'],
      ['Em $f$ ou em $\\omega$?', 'Em $\\omega$, a potência é $\\frac{1}{2\\pi}\\int S\\,\\dd\\omega$: misturar custa $2\\pi$ (Tabela 8.4).'],
      ['$|H|^2$, e não $H$?', 'O filtro multiplica potências por $|H|^2$; a fase de $H$ desaparece (Seção 8.3.8, Q8.15).']
    ];
    const list = E('div', { class: 'vstack', style: { gap: '12px' } }); f.L.append(list);
    const rows = items.map(([q, a], i) => {
      const r = E('div', { style: { display: 'grid', gridTemplateColumns: '64px 1fr', gap: '16px', alignItems: 'center', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.05)', transition: 'all .45s' } },
        E('div', { class: 'ck-n', style: { width: '56px', height: '56px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '28px', fontWeight: 700, border: '2px solid rgba(255,255,255,.4)', transition: 'all .45s' }, text: String(i + 1) }),
        E('div', null, E('div', { style: { fontFamily: 'var(--f-display)', fontSize: '30px', fontWeight: 600 }, html: md(q) }), E('div', { style: { fontSize: '18px', color: 'var(--ice)', marginTop: '2px' }, html: md(a) })));
      list.append(r); return r;
    });
    const refs = Box('hist', '<ul style="margin:0;padding-left:1.1em;font-size:.9em">' + [
      'KSCHISCHANG, F. R. <i>The Wiener–Khinchin Theorem</i> (notas de aula). Univ. of Toronto, 2017.',
      'Notas de aula “Wiener–Khinchin theorem; Brownian motion; Johnson–Nyquist noise” (Q8.16, Q8.19).',
      'LINS JÚNIOR, P. R. Tese de doutorado, UFCG, 2013 (Q8.20).',
      'NUNES, K. <i>Apostila de Processos Estocásticos</i> — Caps. 3, 4, 6 e 7.',
      'PAPOULIS, A.; PILLAI, S. U. 4. ed., 2002 — Cap. 9.',
      'LEON-GARCIA, A. 3. ed., 2008 — Cap. 10.',
      'LOPES DOS SANTOS; PERDICOULIS (2024) · FERNÁNDEZ, TE802 (UFPR, 2017).'
    ].map(t => `<li>${t}</li>`).join('') + '</ul>', { sub: 'referências utilizadas no capítulo', size: 'xs' });
    refs.querySelector('.box-h').firstChild.textContent = 'REFERÊNCIAS';
    const end = Box('final', 'Fim do Capítulo 8. A ferramenta central de todos os níveis: <b>calcular a autocorrelação e aplicar Wiener–Khinchin</b> — e, quando houver um filtro, multiplicar por $|H|^2$.', { size: 'sm' });
    f.R.append(end, refs);
    return {
      goto(k) {
        rows.forEach((r, i) => { const on = k >= i; r.style.background = on ? 'rgba(227,162,59,.14)' : 'rgba(255,255,255,.05)'; r.style.borderColor = on ? '#E3A23B' : 'rgba(255,255,255,.16)'; r.style.opacity = on ? 1 : .45; const n = r.querySelector('.ck-n'); n.textContent = on ? '✓' : String(i + 1); n.style.background = on ? '#E3A23B' : 'transparent'; n.style.color = on ? '#0B2540' : '#fff'; n.style.borderColor = on ? '#E3A23B' : 'rgba(255,255,255,.4)'; });
        end.style.opacity = k >= I('c5') ? 1 : .2; refs.style.opacity = k >= I('refs') ? 1 : 0;
      }
    };
  }
});

/* =====================================================================
   INICIALIZAÇÃO, VERSÃO PARA IMPRESSÃO E GESTOS
   ===================================================================== */
const STAGE = document.getElementById('stage'), FOOT = document.getElementById('ft');

function buildPrint() {
  const pv = document.getElementById('printv');
  if (pv.dataset.built) return;
  pv.dataset.built = '1';
  pv.append(E('div', { class: 'pv-bar' },
    E('button', { class: 'btn', text: '← Voltar à apresentação', onclick: closePrint }),
    E('span', { style: { color: '#4E6476' }, html: 'Para imprimir ou salvar em PDF, use <b>Ctrl+P</b> (ou <b>⌘P</b>). Cada questão sai com o gráfico final e a resolução inteira.' })));
  for (const d of QUESTIONS) {
    const q = d.q, st = d.st;
    const sec = E('section');
    sec.append(E('div', { class: 'pv-k', text: `QUESTÃO ${q.num} · NÍVEL ${q.level} — ${LV[q.level].name.toUpperCase()}` }), E('h2', { class: 'pv-h', html: md(q.title) }));
    sec.append(enunCard(q));
    const holder = E('div', { class: 'pv-chart', style: { position: 'relative' } });
    sec.append(holder);
    const fakeCards = { interp: E('div'), final: E('div'), erro: E('div'), enun: E('div') };
    const left = q.left(holder, st, { cards: fakeCards, q });
    const kf = st.I('final');
    left.goto(kf, false, -1);
    holder.querySelectorAll('.pane').forEach(p => { p.style.position = 'relative'; p.style.inset = 'auto'; if (p.classList.contains('off')) p.style.display = 'none'; });
    sec.append(Box('plano', q.plano.html, { size: 'xs' }));
    const tb = E('table'); tb.append(E('tr', null, E('th', { text: 'PASSO MATEMÁTICO' }), E('th', { text: 'COMENTÁRIO / JUSTIFICATIVA' })));
    q.steps.filter(s => s.k === 'res').forEach(s => tb.append(E('tr', null, E('td', { html: (s.tag ? `<b>${s.tag}</b> ` : '') + T(s.tex) }), E('td', { html: md(s.note) }))));
    sec.append(Box('res', '', { size: 'xs' })); sec.lastChild.querySelector('.box-b').append(tb);
    if (q.erro) sec.append(Box('erro', q.erro.html, { size: 'xs' }));
    sec.append(Box('final', q.final.html, { size: 'xs' }));
    (q.interp.boxes || []).forEach(([k, h]) => sec.append(Box(k, h, { size: 'xs' })));
    pv.append(sec);
  }
}
function openPrint() { buildPrint(); document.body.classList.add('pv'); window.scrollTo(0, 0); }
function closePrint() { document.body.classList.remove('pv'); fit(); }

(function boot() {
  for (let i = SOON.length - 1; i >= 0; i--) { const n = SOON[i].num.split('.')[1]; if (n && SCENES.some(d => d.id === 'q8-' + n)) SOON.splice(i, 1); }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('keydown', onKey);
  document.getElementById('bn').addEventListener('click', next);
  document.getElementById('bp').addEventListener('click', prev);
  document.getElementById('bm').addEventListener('click', openMenu);
  document.getElementById('bnotes').addEventListener('click', toggleNotes);
  document.getElementById('ovl').addEventListener('click', closeOverlays);
  window.addEventListener('beforeprint', buildPrint);
  /* gesto de deslizar (celular) */
  let t0 = null;
  STAGE.addEventListener('touchstart', e => { const t = e.target; if (t.closest && t.closest('input,button,.pair,.modal')) { t0 = null; return; } t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  STAGE.addEventListener('touchend', e => {
    if (!t0) return; const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y; t0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) dx < 0 ? next() : prev();
  }, { passive: true });
  const h = readHash();
  if (h) go(h.d.idx, h.k, { fwd: h.k === 0 }); else go(0, 0);
  window.addEventListener('hashchange', () => {
    if (location.hash === APP.ownHash) return;
    const r = readHash(); if (r && (r.d.idx !== APP.si || r.k !== APP.k)) go(r.d.idx, r.k, { anim: false, fwd: false });
  });
})();
