
'use strict';
/* =========================================================================
   CONFIGURAÇÃO — troque aqui cores, textos e parâmetros das simulações.
   Todos os valores numéricos seguem a apostila (Cap. 7, Seções 7.1–7.5).
   ========================================================================= */
const CONFIG = {
  cores: {                         // aplicadas às variáveis CSS na inicialização
    navy: '#0B2540', petroleo: '#146B73', ouro: '#E3A23B',
    agua: '#5FC8C0', ceu: '#8EC5E8', teoria: '#E5534B', ok: '#6FCF8E', lilas: '#C3A6F2'
  },
  rodape: 'Processos Estocásticos — Cap. 7 · Prof. Me. Kennedy Nunes · CCBL/UFMA',
  semente: 23,                     // número fixo = aula reproduzível; null = sorteio a cada carga
  qualidadeCanvas: 1.5,            // resolução interna dos gráficos (× tamanho de desenho)
  zonaClique: 0.2,                 // fração da largura, em cada lateral, que avança/volta ao clicar
  s2:  { a: 0.9, nCaptura: 4096, nSeg: 256, salto: 128, maxCurvas: 8, amostrasTela: 300 },
  s6:  { nFeixe: 40, nEstat: 300, fc: 2.5 },
  s10: { a: 0.9, N: 256, K: 300 },
  ex1: { A: 1, Ns: [64, 256, 1024, 4096], Kmax: 400, Nidx0: 1 },
  v3:  { S: 2, fmax: 100, f1: 50, f2: 100, rbw: 10, varreduraMs: 4200 },
  ex2: { A: 1, fc: 5 },
  ex4: { N: 256, K: 300 },
  ex5: { A: 10e-6, N0meio: 2e-18 },
  proximaAula: '24/09'
};

/* ------------------------------------------------------------------ util */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduzido = () => RM.matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** número em português: vírgula decimal e sinal de menos tipográfico */
function br(v, d = 2) { return v.toFixed(d).replace('.', ',').replace('-', '−'); }
/** milhares separados por espaço fino (12 500) */
function milhar(v, d = 0) {
  const [i, f] = v.toFixed(d).split('.');
  const s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return f ? s + ',' + f : s;
}
/** notação científica em TeX: 4{,}0\times10^{-14} (ou só 10^{4} se a mantissa for 1) */
function texSci(x, d = 1, omitir1 = false) {
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / Math.pow(10, e);
  if (+m.toFixed(d) >= 10) { m /= 10; e += 1; }
  if (omitir1 && Math.abs(m - 1) < 5e-3) return `10^{${e}}`;
  return `${m.toFixed(d).replace('.', '{,}')}\\times10^{${e}}`;
}
function tex(str, el, display = false) {
  if (!el) return;
  if (window.katex) {
    try { katex.render(str, el, KATEX_OPC(display)); return; } catch (e) { /* cai no texto puro */ }
  }
  el.textContent = str;
}
const KATEX_OPC = d => ({ displayMode: d, throwOnError: false, strict: false });
function pctRange(inp) { const a = +inp.min, b = +inp.max; inp.style.setProperty('--pct', ((inp.value - a) / (b - a) * 100) + '%'); }

/* ------------------------------------------- aleatoriedade reprodutível
   Gerador mulberry32 (uniforme) + Box–Muller (gaussiano).  Cada simulação
   usa um "canal" próprio, então mexer num slide não altera os outros.     */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const SEMENTE_BASE = CONFIG.semente == null ? (Math.random() * 4294967296) >>> 0 : CONFIG.semente;
function criarRNG(canal) {
  const u = mulberry32((Math.imul(SEMENTE_BASE | 0, 2654435761) ^ Math.imul(canal + 1, 40503)) >>> 0);
  let reserva = null;
  return {
    u,
    /** normal padrão N(0,1) por Box–Muller */
    n() {
      if (reserva !== null) { const r = reserva; reserva = null; return r; }
      let a; do { a = u(); } while (a <= 1e-12);
      const b = u(), r = Math.sqrt(-2 * Math.log(a));
      reserva = r * Math.sin(2 * Math.PI * b);
      return r * Math.cos(2 * Math.PI * b);
    }
  };
}

/* ------------------------------------------------------- FFT radix-2
   In-place, decimação no tempo. Convenção: X[k] = Σ x[n] e^{-j2πkn/N}.    */
const FFT = (() => {
  const tabelas = new Map();
  function tab(N) {
    if (tabelas.has(N)) return tabelas.get(N);
    const bits = Math.round(Math.log2(N));
    const rev = new Uint32Array(N);
    for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >>> b) & 1) << (bits - 1 - b); rev[i] = r; }
    const cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / N); sn[i] = Math.sin(2 * Math.PI * i / N); }
    const t = { rev, cs, sn }; tabelas.set(N, t); return t;
  }
  function fft(re, im) {
    const N = re.length, { rev, cs, sn } = tab(N);
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let tam = 2; tam <= N; tam <<= 1) {
      const meio = tam >>> 1, passo = N / tam;
      for (let i = 0; i < N; i += tam) {
        for (let j = 0, k = 0; j < meio; j++, k += passo) {
          const l = i + j + meio;
          const tr = re[l] * cs[k] + im[l] * sn[k];
          const ti = im[l] * cs[k] - re[l] * sn[k];
          re[l] = re[i + j] - tr; im[l] = im[i + j] - ti;
          re[i + j] += tr; im[i + j] += ti;
        }
      }
    }
  }
  return { fft };
})();

/** Periodograma |X_N(e^{jω})|²/N, já reordenado para ω ∈ [−π, π) (passos 1–3) */
function periodograma(x) {
  const N = x.length, re = Float64Array.from(x), im = new Float64Array(N);
  FFT.fft(re, im);
  const P = new Float64Array(N), h = N / 2;
  for (let k = 0; k < N; k++) { const s = (k + h) % N; P[k] = (re[s] * re[s] + im[s] * im[s]) / N; }
  return P;
}
/** |X(e^{jω})| (módulo), reordenado para ω ∈ [−π, π) */
function modulo(x) {
  const N = x.length, re = Float64Array.from(x), im = new Float64Array(N);
  FFT.fft(re, im);
  const M = new Float64Array(N), h = N / 2;
  for (let k = 0; k < N; k++) { const s = (k + h) % N; M[k] = Math.hypot(re[s], im[s]); }
  return M;
}
/** Welch simples: média de periodogramas de trechos com janela de Hann (supõe ergodicidade) */
function welch(x, L, salto) {
  const w = new Float64Array(L); let U = 0;
  for (let n = 0; n < L; n++) { w[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / L); U += w[n] * w[n]; }
  const acc = new Float64Array(L), re = new Float64Array(L), im = new Float64Array(L);
  let nseg = 0;
  for (let s = 0; s + L <= x.length; s += salto) {
    for (let n = 0; n < L; n++) { re[n] = x[s + n] * w[n]; im[n] = 0; }
    FFT.fft(re, im);
    for (let k = 0; k < L; k++) acc[k] += (re[k] * re[k] + im[k] * im[k]) / U;
    nseg++;
  }
  const P = new Float64Array(L), h = L / 2;
  for (let k = 0; k < L; k++) P[k] = acc[(k + h) % L] / nseg;
  return P;
}
/** Trajetória AR(1): x[n] = a·x[n−1] + w[n], já partindo do regime estacionário */
function gerarAR1(r, N, a) {
  const x = new Float64Array(N);
  let v = r.n() / Math.sqrt(1 - a * a);
  for (let i = 0; i < N; i++) { v = a * v + r.n(); x[i] = v; }
  return x;
}
const sinc = u => (Math.abs(u) < 1e-9 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u));

/* ------------------------------------------------------------ desenho */
const TINTA = {
  eixo: 'rgba(255,255,255,.42)', grade: 'rgba(142,197,232,.14)', rotulo: 'rgba(255,255,255,.74)',
  fonte: '"IBM Plex Sans","Inter",system-ui,sans-serif', mono: '"IBM Plex Mono",ui-monospace,monospace',
  serif: '"Source Serif 4",Georgia,serif'
};
function cor(nome) { return CONFIG.cores[nome] || nome; }
function prepCanvas(cv) {
  const W = +cv.dataset.w, H = +cv.dataset.h, k = +(cv.dataset.k || CONFIG.qualidadeCanvas);
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  return { cv, ctx: cv.getContext('2d'), W, H, k };
}
const SUPS = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = n => String(n).split('').map(c => SUPS[c] || c).join('');

/** escreve texto no canvas interpretando _X ou _{abc} como subscrito */
function textoRico(c, s, x, y, tam, familia, peso, al, fundo) {
  const partes = [], re = /_(\{[^}]*\}|.)/g; let i = 0, m;
  while ((m = re.exec(s))) { if (m.index > i) partes.push([s.slice(i, m.index), false]); partes.push([m[1].replace(/[{}]/g, ''), true]); i = re.lastIndex; }
  if (i < s.length) partes.push([s.slice(i), false]);
  const fN = `${peso} ${tam}px ${familia}`, fS = `${peso} ${Math.round(tam * .7)}px ${familia}`;
  let w = 0; for (const p of partes) { c.font = p[1] ? fS : fN; p.w = c.measureText(p[0]).width; w += p.w; }
  let xx = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
  c.textAlign = 'left';
  if (fundo) { const f0 = c.fillStyle; c.fillStyle = fundo; c.fillRect(xx - 8, y - tam * .95, w + 16, tam * 1.35); c.fillStyle = f0; }
  for (const p of partes) { c.font = p[1] ? fS : fN; c.fillText(p[0], xx, p[1] ? y + tam * .24 : y); xx += p.w; }
}
class Plot {
  constructor(cv, o = {}) {
    Object.assign(this, prepCanvas(cv));
    this.o = Object.assign({ pad: { l: 64, r: 18, t: 16, b: 48 }, x: [0, 1], y: [0, 1], log: false }, o);
  }
  get x0() { return this.o.pad.l; } get x1() { return this.W - this.o.pad.r; }
  get y0() { return this.o.pad.t; } get y1() { return this.H - this.o.pad.b; }
  X(v) { const [a, b] = this.o.x; return this.x0 + (v - a) / (b - a) * (this.x1 - this.x0); }
  Y(v) {
    const [a, b] = this.o.y;
    const t = this.o.log ? (Math.log10(Math.max(v, 1e-300)) - a) / (b - a) : (v - a) / (b - a);
    return this.y1 - t * (this.y1 - this.y0);
  }
  limpar() {
    const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
  }
  /** grade, eixos e rótulos. xt/yt: lista de {v, l} */
  eixos({ xt = [], yt = [], xl = '', yl = '', grade = true, caixa = false, tam = 19 } = {}) {
    const c = this.ctx; c.save();
    c.font = `400 ${tam}px ${TINTA.fonte}`; c.fillStyle = TINTA.rotulo; c.lineWidth = 1;
    for (const t of yt) {
      const yy = Math.round(this.Y(t.v)) + .5;
      if (grade) { c.strokeStyle = TINTA.grade; c.beginPath(); c.moveTo(this.x0, yy); c.lineTo(this.x1, yy); c.stroke(); }
      c.textBaseline = 'middle'; textoRico(c, t.l, this.x0 - 10, yy, tam, TINTA.fonte, 400, 'right');
    }
    for (const t of xt) {
      const xx = Math.round(this.X(t.v)) + .5;
      if (grade) { c.strokeStyle = TINTA.grade; c.beginPath(); c.moveTo(xx, this.y0); c.lineTo(xx, this.y1); c.stroke(); }
      c.textBaseline = 'top'; textoRico(c, t.l, xx, this.y1 + 8, tam, TINTA.fonte, 400, 'center');
    }
    c.strokeStyle = TINTA.eixo; c.lineWidth = 1.5; c.beginPath();
    c.moveTo(this.x0, this.y0); c.lineTo(this.x0, this.y1); c.lineTo(this.x1, this.y1);
    if (caixa) { c.lineTo(this.x1, this.y0); c.closePath(); }
    c.stroke();
    c.fillStyle = TINTA.rotulo;
    if (xl) { c.textBaseline = 'bottom'; textoRico(c, xl, (this.x0 + this.x1) / 2, this.H - 4, tam, TINTA.fonte, 400, 'center'); }
    if (yl) { c.translate(18, (this.y0 + this.y1) / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'middle'; textoRico(c, yl, 0, 0, tam, TINTA.fonte, 400, 'center'); }
    c.restore();
  }
  recorte(p = 1) {
    const c = this.ctx; c.beginPath();
    c.rect(this.x0, this.y0 - 3, (this.x1 - this.x0) * clamp(p, 0, 1), this.y1 - this.y0 + 6); c.clip();
  }
  /** curva y(x); st: {cor, lw, alpha, dash, p (fração desenhada), brilho} */
  linha(xs, ys, st = {}) {
    const c = this.ctx; c.save(); this.recorte(st.p ?? 1);
    c.beginPath();
    for (let i = 0; i < xs.length; i++) { const px = this.X(xs[i]), py = this.Y(ys[i]); i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.strokeStyle = cor(st.cor || 'agua'); c.lineWidth = st.lw || 2; c.globalAlpha = st.alpha ?? 1;
    c.setLineDash(st.dash || []); c.lineJoin = 'round'; c.lineCap = 'round';
    if (st.brilho) { c.shadowColor = cor(st.cor || 'agua'); c.shadowBlur = st.brilho; }
    c.stroke(); c.restore();
  }
  /** área entre y(x) e uma base */
  area(xs, ys, st = {}) {
    const c = this.ctx; c.save(); this.recorte(st.p ?? 1);
    const base = st.base ?? (this.o.log ? Math.pow(10, this.o.y[0]) : this.o.y[0]);
    c.beginPath(); c.moveTo(this.X(xs[0]), this.Y(base));
    for (let i = 0; i < xs.length; i++) c.lineTo(this.X(xs[i]), this.Y(ys[i]));
    c.lineTo(this.X(xs[xs.length - 1]), this.Y(base)); c.closePath();
    c.fillStyle = cor(st.cor || 'agua'); c.globalAlpha = st.alpha ?? .2; c.fill(); c.restore();
  }
  /** faixa entre duas curvas (ex.: m ± σ) */
  faixa(xs, lo, hi, st = {}) {
    const c = this.ctx; c.save(); this.recorte(st.p ?? 1); c.beginPath();
    for (let i = 0; i < xs.length; i++) { const px = this.X(xs[i]), py = this.Y(hi[i]); i ? c.lineTo(px, py) : c.moveTo(px, py); }
    for (let i = xs.length - 1; i >= 0; i--) c.lineTo(this.X(xs[i]), this.Y(lo[i]));
    c.closePath(); c.fillStyle = cor(st.cor || 'ouro'); c.globalAlpha = st.alpha ?? .16; c.fill(); c.restore();
  }
  /** hastes verticais (periodograma de uma realização) */
  hastes(xs, ys, st = {}) {
    const c = this.ctx; c.save(); this.recorte(st.p ?? 1); c.beginPath();
    const yb = this.Y(st.base ?? 0);
    for (let i = 0; i < xs.length; i++) { const px = this.X(xs[i]); c.moveTo(px, yb); c.lineTo(px, this.Y(ys[i])); }
    c.strokeStyle = cor(st.cor || 'agua'); c.lineWidth = st.lw || 1.5; c.globalAlpha = st.alpha ?? 1; c.stroke(); c.restore();
  }
  hline(v, st = {}) { this.linha([this.o.x[0], this.o.x[1]], [v, v], Object.assign({ lw: 2.5 }, st)); }
  /** impulso (seta vertical) em x até a altura h; topo=true leva até o alto do gráfico */
  impulso(xv, h, st = {}) {
    const c = this.ctx, px = this.X(xv), yb = this.Y(st.base ?? (this.o.log ? Math.pow(10, this.o.y[0]) : 0));
    const yt = st.topo ? this.y0 + 4 : this.Y(h);
    c.save(); c.strokeStyle = c.fillStyle = cor(st.cor || 'ceu'); c.lineWidth = st.lw || 3.5; c.globalAlpha = st.alpha ?? 1;
    c.setLineDash(st.dash || []);
    c.beginPath(); c.moveTo(px, yb); c.lineTo(px, yt + 12); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(px, yt); c.lineTo(px - 9, yt + 18); c.lineTo(px + 9, yt + 18); c.closePath(); c.fill();
    c.restore();
  }
  texto(s, x, y, st = {}) {
    const c = this.ctx; c.save();
    c.fillStyle = cor(st.cor || 'rgba(255,255,255,.8)'); c.textBaseline = st.bl || 'alphabetic'; c.globalAlpha = st.alpha ?? 1;
    textoRico(c, s, x, y, st.tam || 20, st.fonte || TINTA.fonte, st.peso || 500, st.al || 'left', st.fundo); c.restore();
  }
}
const ticksPi = [
  { v: -Math.PI, l: '−π' }, { v: -Math.PI / 2, l: '−π/2' }, { v: 0, l: '0' }, { v: Math.PI / 2, l: 'π/2' }, { v: Math.PI, l: 'π' }
];
const decadas = (a, b) => { const r = []; for (let e = Math.ceil(a); e <= Math.floor(b); e++) r.push({ v: Math.pow(10, e), l: '10' + sup(e) }); return r; };
const num = v => String(v).replace('.', ',').replace('-', '−');
const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

/* ----------------------------------------------- animações (tweens) */
const tweens = new Set();
/** chama fn(p) com p de 0 a 1 ao longo de ms; com movimento reduzido, salta para o fim */
function tween(ms, fn, fim) {
  if (reduzido() || ms <= 0) { fn(1); if (fim) fim(); return () => {}; }
  const tw = { t0: performance.now(), ms, fn, fim };
  tweens.add(tw);
  return () => tweens.delete(tw);
}

/* =========================================================================
   MÓDULOS DOS SLIDES
   Cada módulo pode ter: init(slide), entrar(etapa, animar), etapa(n, ant),
   sair(), tick(dt, agora), final() [estado completo, usado na impressão]
   ========================================================================= */
const MOD = {};

/* ---------- 1 · capa: trajetória de ruído suave passando ao fundo ---------- */
MOD['slide-1'] = {
  init(sl) {
    this.p = prepCanvas($('.bgnoise', sl));
    const r = criarRNG(1), N = 9000;
    const gera = (a1, a2) => {
      const x = new Float32Array(N); let y1 = 0, y2 = 0, s = 0;
      for (let i = 0; i < 400; i++) { const y = a1 * y1 - a2 * y2 + r.n(); y2 = y1; y1 = y; }
      for (let i = 0; i < N; i++) { const y = a1 * y1 - a2 * y2 + r.n(); y2 = y1; y1 = y; x[i] = y; s += y * y; }
      const dp = Math.sqrt(s / N); for (let i = 0; i < N; i++) x[i] /= dp; return x;
    };
    this.a = gera(1.86, 0.88); this.b = gera(1.80, 0.85); this.off = 0;
  },
  entrar() { this.desenhar(); },
  final() { this.desenhar(); },
  tick(dt) { if (reduzido()) return; this.off += dt * 0.014; this.desenhar(); },
  desenhar() {
    const { ctx: c, W, H, k } = this.p, N = this.a.length;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.p.cv.width, this.p.cv.height); c.setTransform(k, 0, 0, k, 0, 0);
    const amostra = (arr, i) => { const j = Math.floor(i), f = i - j; return arr[((j % N) + N) % N] * (1 - f) + arr[(((j + 1) % N) + N) % N] * f; };
    const traco = (arr, y0, amp, span, corT, alfa, lw, desl) => {
      c.beginPath();
      for (let x = 0; x <= W; x += 4) { const y = y0 + amp * amostra(arr, desl + x / W * span); x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = corT; c.globalAlpha = alfa; c.lineWidth = lw; c.stroke();
    };
    traco(this.a, H * .5, 92, 560, CONFIG.cores.agua, .22, 3, this.off);
    traco(this.b, H * .6, 70, 680, CONFIG.cores.ceu, .12, 2, this.off * 0.8 + 3000);
    c.globalAlpha = 1;
  }
};

/* ---------- 2 · osciloscópio × analisador (Fig. 7.1) ---------- */
MOD['slide-2'] = {
  init(sl) {
    const C = CONFIG.s2; this.r = criarRNG(2);
    this.sc = new Plot($('#s2-scope'), { pad: { l: 6, r: 6, t: 6, b: 6 }, x: [0, C.amostrasTela - 1], y: [-8, 8] });
    this.sp = new Plot($('#s2-spec'), { pad: { l: 74, r: 16, t: 14, b: 64 }, x: [-.5, .5], y: [-0.75, 2.25], log: true });
    this.caps = []; this.total = 0; this.pS = 1; this.pF = 1; this.mostrarF = false;
    const L = C.nSeg; this.nu = new Float64Array(L); this.teo = new Float64Array(L);
    for (let k = 0; k < L; k++) { const v = -0.5 + k / L; this.nu[k] = v; this.teo[k] = 1 / (1 - 2 * C.a * Math.cos(2 * Math.PI * v) + C.a * C.a); }
    this.xs = Float64Array.from({ length: C.amostrasTela }, (_, i) => i);
    $('#s2-single').addEventListener('click', () => this.capturar(true));
  },
  capturar(animar) {
    const C = CONFIG.s2, x = gerarAR1(this.r, C.nCaptura, C.a);
    this.caps.push({ tela: x.slice(0, C.amostrasTela), est: welch(x, C.nSeg, C.salto) });
    if (this.caps.length > C.maxCurvas) this.caps.shift();
    this.total++; $('#s2-count').textContent = 'captura ' + this.total;
    if (animar) {
      tween(480, p => { this.pS = suave(p); this.desTela(); });
      if (this.mostrarF) tween(700, p => { this.pF = suave(p); this.desEsp(true); });
    } else { this.pS = 1; this.pF = 1; this.desTela(); this.desEsp(); }
  },
  entrar(n, animar) {
    if (!this.caps.length) { this.capturar(false); }
    this.mostrarF = n >= 1;
    if (animar) tween(480, p => { this.pS = suave(p); this.desTela(); }); else { this.pS = 1; this.desTela(); }
    this.pF = 1; this.desEsp();
  },
  etapa(n, ant) {
    this.mostrarF = n >= 1;
    if (n >= 1 && ant < 1) tween(900, p => { this.pF = suave(p); this.desEsp(false); });
  },
  final() { if (!this.caps.length) this.capturar(false); this.mostrarF = true; this.pS = this.pF = 1; this.desTela(); this.desEsp(); },
  desTela() {
    const P = this.sc, c = P.ctx; P.limpar();
    c.save(); c.strokeStyle = 'rgba(80,200,140,.16)'; c.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const x = P.x0 + i * (P.x1 - P.x0) / 10; c.beginPath(); c.moveTo(x, P.y0); c.lineTo(x, P.y1); c.stroke(); }
    for (let j = 0; j <= 8; j++) { const y = P.y0 + j * (P.y1 - P.y0) / 8; c.beginPath(); c.moveTo(P.x0, y); c.lineTo(P.x1, y); c.stroke(); }
    c.strokeStyle = 'rgba(80,200,140,.32)'; const xm = (P.x0 + P.x1) / 2, ym = (P.y0 + P.y1) / 2;
    c.beginPath(); c.moveTo(xm, P.y0); c.lineTo(xm, P.y1); c.moveTo(P.x0, ym); c.lineTo(P.x1, ym); c.stroke();
    for (let i = 0; i <= 50; i++) { const x = P.x0 + i * (P.x1 - P.x0) / 50; c.beginPath(); c.moveTo(x, ym - 5); c.lineTo(x, ym + 5); c.stroke(); }
    c.restore();
    const cap = this.caps[this.caps.length - 1]; if (!cap) return;
    P.linha(this.xs, cap.tela, { cor: '#7FF0C8', lw: 2.4, p: this.pS, brilho: 8 });
    P.texto('1 V/div', P.x0 + 10, P.y0 + 24, { tam: 18, fonte: TINTA.mono, cor: 'rgba(127,240,200,.7)' });
  },
  desEsp(soUltima) {
    const P = this.sp; P.limpar();
    if (!this.mostrarF) return;
    P.eixos({
      xt: [-.4, -.2, 0, .2, .4].map(v => ({ v, l: br(v, 1) })), yt: decadas(-0.75, 2.25),
      xl: 'frequência normalizada (ciclos/amostra)', yl: 'potência / frequência'
    });
    const n = this.caps.length;
    this.caps.forEach((cp, i) => {
      const ult = i === n - 1;
      const p = soUltima ? (ult ? this.pF : 1) : this.pF;
      P.linha(this.nu, cp.est, { cor: ult ? 'agua' : 'ceu', lw: ult ? 2.4 : 1.6, alpha: ult ? .95 : .28 + .4 * i / Math.max(1, n - 1), p });
    });
    P.linha(this.nu, this.teo, { cor: 'teoria', lw: 3, dash: [12, 9] });
  }
};

/* ---------- 3 · ícones dos três cartões ---------- */
MOD['slide-3'] = {
  init() {
    const r = criarRNG(3);
    this.j = Array.from({ length: 400 }, () => r.n());
    this.i1 = prepCanvas($('#s3-i1')); this.i2 = prepCanvas($('#s3-i2')); this.i3 = prepCanvas($('#s3-i3'));
  },
  entrar() { this.desenhar(); }, final() { this.desenhar(); },
  desenhar() {
    const lim = q => { const c = q.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, q.cv.width, q.cv.height); c.setTransform(q.k, 0, 0, q.k, 0, 0); return c; };
    const J = this.j, ag = CONFIG.cores.agua, ce = CONFIG.cores.ceu, ou = CONFIG.cores.ouro;
    // (1) raia saindo do piso de ruído, com a seta SNR
    let c = lim(this.i1);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(16, 150); c.lineTo(470, 150); c.stroke();
    c.beginPath(); for (let x = 16, i = 0; x <= 470; x += 4, i++) { const pico = 108 * Math.exp(-Math.pow((x - 230) / 7, 2)); const y = 128 - pico + 4 * J[i]; x === 16 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.strokeStyle = ag; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = ou; c.fillStyle = ou; c.lineWidth = 2.5; c.beginPath(); c.moveTo(300, 124); c.lineTo(300, 26); c.stroke();
    [[300, 20, 1], [300, 130, -1]].forEach(([x, y, s]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 8, y + 14 * s); c.lineTo(x + 8, y + 14 * s); c.closePath(); c.fill(); });
    c.font = `700 26px ${TINTA.fonte}`; c.fillText('SNR', 316, 84);
    // (2) concentrado em baixas × espalhado
    c = lim(this.i2);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(16, 140); c.lineTo(220, 140); c.moveTo(262, 140); c.lineTo(466, 140); c.stroke();
    c.beginPath(); for (let x = 16, i = 0; x <= 220; x += 4, i++) { const y = 136 - 104 * Math.exp(-(x - 16) / 30) - 3 * Math.abs(J[i + 50]); x === 16 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.strokeStyle = ag; c.lineWidth = 2.5; c.stroke();
    c.beginPath(); for (let x = 262, i = 0; x <= 466; x += 4, i++) { const y = 92 + 5 * J[i + 120]; x === 262 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.strokeStyle = ce; c.stroke();
    c.font = `500 19px ${TINTA.fonte}`; c.fillStyle = 'rgba(255,255,255,.7)'; c.textAlign = 'center';
    c.fillText('concentrado', 118, 166); c.fillText('espalhado', 364, 166); c.textAlign = 'left';
    // (3) ruído → H(f) → ?
    c = lim(this.i3);
    c.beginPath(); for (let x = 16, i = 0; x <= 168; x += 3, i++) { const y = 84 + 20 * J[i + 200] * 0.7 + 10 * Math.sin(x / 9); x === 16 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.strokeStyle = ag; c.lineWidth = 2.2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(176, 84); c.lineTo(214, 84); c.moveTo(204, 76); c.lineTo(214, 84); c.lineTo(204, 92); c.stroke();
    c.strokeStyle = ce; c.strokeRect(222, 44, 112, 80);
    c.fillStyle = '#fff'; c.font = `italic 600 32px ${TINTA.serif}`; c.textAlign = 'center'; c.fillText('H(f)', 278, 96);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(342, 84); c.lineTo(382, 84); c.moveTo(372, 76); c.lineTo(382, 84); c.lineTo(372, 92); c.stroke();
    c.fillStyle = ou; c.font = `700 70px ${TINTA.serif}`; c.fillText('?', 426, 108); c.textAlign = 'left';
  }
};

/* ---------- 4 · por que Fourier não basta ---------- */
MOD['slide-4'] = {
  init() {
    const r = criarRNG(4);
    this.sin = new Plot($('#s4-sin'), { pad: { l: 8, r: 8, t: 8, b: 8 }, x: [0, 1], y: [-1.3, 1.3] });
    this.sinF = new Plot($('#s4-sinF'), { pad: { l: 10, r: 10, t: 10, b: 34 }, x: [-8, 8], y: [0, 1.25] });
    this.ruido = new Plot($('#s4-noise'), { pad: { l: 8, r: 8, t: 8, b: 8 }, x: [0, 319], y: [-4.2, 4.2] });
    this.fl = new Plot($('#s4-flick'), { pad: { l: 16, r: 16, t: 14, b: 40 }, x: [0, .5], y: [0, 1.15] });
    this.ts = lin(0, 1, 300); this.sv = this.ts.map(t => Math.cos(2 * Math.PI * 4 * t));
    const rr = gerarAR1(r, 320, .6), dp = Math.sqrt(1 / (1 - .36));
    this.rx = Float64Array.from({ length: 320 }, (_, i) => i); this.ry = rr.map(v => v / dp * 1.3);
    const espectro = () => { const M = modulo(gerarAR1(r, 512, .6)); return M.slice(256); };
    this.m1 = espectro(); this.m2 = espectro();
    const mx = Math.max(...this.m1, ...this.m2); this.m1 = this.m1.map(v => v / mx); this.m2 = this.m2.map(v => v / mx);
    this.nu = Float64Array.from({ length: 256 }, (_, i) => i / 512);
    this.p = 1; this.pR = 1; this.n = 0; this.E = 0; this.T = 0; this.correndo = false; this.rE = criarRNG(40);
  },
  entrar(n, animar) {
    this.n = n; this.zerarE(); if (n >= 3) this.ligarE();
    if (animar) tween(800, p => { this.p = suave(p); this.desFixos(); }); else { this.p = 1; this.desFixos(); }
    this.pR = 1; this.desRuido(); this.desFlick(performance.now());
  },
  etapa(n, ant) {
    this.n = n;
    if (n >= 1 && ant < 1) tween(700, p => { this.pR = suave(p); this.desRuido(); });
    if (n >= 3 && ant < 3) this.ligarE();
    if (n < 3) this.zerarE();
  },
  sair() { this.correndo = false; },
  final() { this.p = this.pR = 1; this.n = 9; this.desFixos(); this.desRuido(); this.desFlick(0, true); $('#s4-E').textContent = '→ ∞'; $('#s4-T').textContent = 'quando T → ∞'; },
  zerarE() { this.correndo = false; this.E = 0; this.T = 0; $('#s4-E').textContent = '0,0 J'; $('#s4-T').textContent = 'T = 0,0 s'; },
  ligarE() {
    if (reduzido()) { $('#s4-E').textContent = '→ ∞'; $('#s4-T').textContent = 'quando T → ∞'; return; }
    this.correndo = true;
  },
  tick(dt, agora) {
    if (this.n >= 2) this.desFlick(agora);
    if (this.correndo) {
      // energia de uma trajetória de potência unitária: cresce ~ 2T e nunca para
      const dT = dt / 1000 * (1.2 + 0.45 * this.T);
      let s = 0; for (let i = 0; i < 64; i++) { const v = this.rE.n(); s += v * v; }
      this.T += dT; this.E += 2 * dT * s / 64;
      $('#s4-E').textContent = milhar(this.E, 1) + ' J';
      $('#s4-T').textContent = 'T = ' + milhar(this.T, 1) + ' s';
      if (this.E > 9e11) this.correndo = false;
    }
  },
  desFixos() {
    const a = this.sin; a.limpar(); a.hline(0, { cor: 'rgba(255,255,255,.25)', lw: 1 });
    a.linha(this.ts, this.sv, { cor: 'ceu', lw: 2.6, p: this.p });
    const b = this.sinF; b.limpar(); b.hline(0, { cor: 'rgba(255,255,255,.45)', lw: 1.5 });
    if (this.p > .5) {
      const al = (this.p - .5) * 2;
      b.impulso(-4, 1, { cor: 'ceu', alpha: al }); b.impulso(4, 1, { cor: 'ceu', alpha: al });
      b.texto('−f₀', b.X(-4), b.H - 8, { al: 'center', tam: 20, alpha: al }); b.texto('f₀', b.X(4), b.H - 8, { al: 'center', tam: 20, alpha: al });
    }
  },
  desRuido() { const P = this.ruido; P.limpar(); P.hline(0, { cor: 'rgba(255,255,255,.25)', lw: 1 }); P.linha(this.rx, this.ry, { cor: 'agua', lw: 2, p: this.pR }); },
  desFlick(agora, estatico) {
    const P = this.fl; P.limpar();
    P.eixos({ xt: [{ v: 0, l: '0' }, { v: .5, l: 'f' }], yt: [], grade: false });
    let a1 = .9, a2 = .9;
    if (!estatico && !reduzido()) { const s = (agora / 1000 % 1.8) / 1.8; a1 = .5 + .5 * Math.cos(2 * Math.PI * s); a1 = a1 * a1 * (3 - 2 * a1); a2 = 1 - a1; }
    P.linha(this.nu, this.m1, { cor: 'agua', lw: 2, alpha: .1 + .9 * a1 });
    P.linha(this.nu, this.m2, { cor: 'ouro', lw: 2, alpha: .1 + .9 * a2 });
    P.texto('|X(f, ω₁)|', P.x1 - 300, 34, { cor: 'agua', tam: 22, peso: 600, alpha: .25 + .75 * a1 });
    P.texto('|X(f, ω₂)|', P.x1 - 150, 34, { cor: 'ouro', tam: 22, peso: 600, alpha: .25 + .75 * a2 });
  }
};

/* ---------- 6 · quiz WSS (Fig. 7.2) ---------- */
MOD['slide-6'] = {
  init(sl) {
    const C = CONFIG.s6, r = criarRNG(6);
    const gerar = (xs, f) => {
      const todas = Array.from({ length: C.nEstat }, () => f(xs));
      const m = xs.map((_, i) => todas.reduce((s, t) => s + t[i], 0) / C.nEstat);
      const s = xs.map((_, i) => Math.sqrt(todas.reduce((q, t) => q + (t[i] - m[i]) ** 2, 0) / (C.nEstat - 1)));
      return { xs, feixe: todas.slice(0, C.nFeixe), m, lo: m.map((v, i) => v - s[i]), hi: m.map((v, i) => v + s[i]) };
    };
    const tc = lin(0, 2, 241), nd = Array.from({ length: 101 }, (_, i) => i);
    const tt = [0, .5, 1, 1.5, 2].map(v => ({ v, l: num(v) }));
    const tn = [0, 20, 40, 60, 80, 100].map(v => ({ v, l: String(v) }));
    this.d = [
      Object.assign(gerar(tc, xs => { const th = (2 * r.u() - 1) * Math.PI; return xs.map(t => Math.cos(2 * Math.PI * C.fc * t + th)); }),
        { y: [-1.3, 1.3], yt: [-1, 0, 1], xt: tt, wss: true }),
      Object.assign(gerar(tc, xs => { const A = r.u(); return xs.map(t => A * Math.sin(2 * Math.PI * t)); }),
        { y: [-1.1, 1.1], yt: [-1, 0, 1], xt: tt, wss: false }),
      Object.assign(gerar(nd, xs => { let v = 0; return xs.map((n) => (n === 0 ? 0 : (v += r.n()))); }),
        { y: [-26, 26], yt: [-20, 0, 20], xt: tn, wss: false }),
      Object.assign(gerar(nd, xs => xs.map(() => r.n())), { y: [-3.6, 3.6], yt: [-2, 0, 2], xt: tn, wss: true })
    ];
    this.pl = this.d.map((d, k) => new Plot($('#s6-' + k), { pad: { l: 50, r: 24, t: 8, b: 34 }, x: [d.xs[0], d.xs[d.xs.length - 1]], y: d.y }));
    this.painel = $$('.qp', sl); this.clicados = new Set(); this.n = 0; this.p = 1;
    this.painel.forEach((pn, k) => $('.reveal', pn).addEventListener('click', () => { this.clicados.add(k); this.atualizar(); }));
  },
  entrar(n, animar) {
    this.n = n; this.atualizar();
    if (animar) tween(1300, p => { this.p = suave(p); this.desenhar(); }); else { this.p = 1; this.desenhar(); }
  },
  etapa(n) { this.n = n; this.atualizar(); },
  sair() { this.clicados.clear(); },
  final() { this.n = 9; this.p = 1; this.atualizar(); this.desenhar(); },
  atualizar() {
    this.painel.forEach((pn, k) => {
      const rev = this.clicados.has(k) || this.n >= k + 1, d = this.d[k], v = $('.verdict', pn);
      v.textContent = rev ? (d.wss ? 'WSS' : 'NÃO WSS') : '?';
      v.className = 'verdict' + (rev ? (d.wss ? ' yes' : ' no') : '');
      $('.why', pn).setAttribute('aria-hidden', rev ? 'false' : 'true');
      $('.reveal', pn).hidden = rev;
    });
  },
  desenhar() {
    this.d.forEach((d, k) => {
      const P = this.pl[k]; P.limpar();
      P.eixos({ xt: d.xt, yt: d.yt.map(v => ({ v, l: num(v) })), tam: 17 });
      P.faixa(d.xs, d.lo, d.hi, { cor: 'ouro', alpha: .16, p: this.p });
      d.feixe.forEach(t => P.linha(d.xs, t, { cor: 'agua', lw: 1.1, alpha: .26, p: this.p }));
      P.linha(d.xs, d.hi, { cor: 'ouro', lw: 2, p: this.p }); P.linha(d.xs, d.lo, { cor: 'ouro', lw: 2, p: this.p });
      P.linha(d.xs, d.m, { cor: '#fff', lw: 3.4, p: this.p });
    });
  }
};

/* ---------- 7 · propriedades de R_X(τ) ---------- */
MOD['slide-7'] = {
  init() {
    this.t = lin(-6, 6, 481); this.R = this.t.map(t => Math.exp(-0.5 * Math.abs(t)) * Math.cos(2.4 * t));
    const o = { pad: { l: 12, r: 12, t: 10, b: 10 }, x: [-6, 6], y: [-1.25, 1.3] };
    this.P = [new Plot($('#s7-1'), o), new Plot($('#s7-2'), o), new Plot($('#s7-3'), o)];
    this.q = [1, 1, 1];
  },
  entrar(n, animar) {
    for (let i = 0; i < 3; i++) this.q[i] = (i <= n) ? 1 : 0;
    if (animar) { this.q[0] = 0; tween(900, p => { this.q[0] = suave(p); this.des(0); }); }
    this.des(0); this.des(1); this.des(2);
  },
  etapa(n, ant) {
    for (let i = 1; i < 3; i++) {
      if (n >= i && ant < i) tween(i === 1 ? 1500 : 1000, p => { this.q[i] = suave(p); this.des(i); });
      if (n < i) { this.q[i] = 0; this.des(i); }
    }
  },
  final() { this.q = [1, 1, 1]; [0, 1, 2].forEach(i => this.des(i)); },
  des(i) {
    const P = this.P[i], q = this.q[i]; P.limpar();
    P.hline(0, { cor: 'rgba(255,255,255,.35)', lw: 1.2 });
    P.linha([0, 0], [-1.2, 1.25], { cor: 'rgba(255,255,255,.18)', lw: 1 });
    P.texto('τ', P.x1 - 4, P.Y(0) - 8, { al: 'right', tam: 20, fonte: TINTA.serif, peso: 600 });
    if (q <= 0) return;
    if (i === 0) {
      P.linha(this.t, this.R, { cor: 'agua', lw: 2.6, p: q });
      if (q > .45) { const c = P.ctx; c.save(); c.fillStyle = CONFIG.cores.ouro; c.beginPath(); c.arc(P.X(0), P.Y(1), 8, 0, 7); c.fill(); c.restore();
        P.texto('R_X(0) = potência', P.X(0) + 16, P.Y(1) + 8, { cor: 'ouro', tam: 20, peso: 600 }); }
    } else if (i === 1) {
      const mid = 240, dir = this.t.slice(mid), Rd = this.R.slice(mid);
      const esq = this.t.slice(0, mid + 1).reverse(), Re = this.R.slice(0, mid + 1).reverse();
      const a = clamp(q * 2, 0, 1), b = clamp(q * 2 - 1, 0, 1);
      // metade direita, depois o espelho desenhado de 0 para −6
      this.parcial(P, dir, Rd, a, 'agua');
      if (b > 0) this.parcial(P, esq, Re, b, 'ceu');
      P.linha([0, 0], [-1.2, 1.25], { cor: 'ouro', lw: 2, dash: [6, 6], alpha: .9 });
    } else {
      const c = P.ctx; c.save(); c.fillStyle = 'rgba(229,83,75,.10)';
      c.fillRect(P.x0, P.y0, P.x1 - P.x0, P.Y(1) - P.y0); c.fillRect(P.x0, P.Y(-1), P.x1 - P.x0, P.y1 - P.Y(-1)); c.restore();
      P.hline(1, { cor: 'ouro', lw: 2, dash: [8, 6] }); P.hline(-1, { cor: 'ouro', lw: 2, dash: [8, 6], alpha: .6 });
      P.linha(this.t, this.R, { cor: 'agua', lw: 2.6, p: q });
      P.texto('R_X(0)', P.x0 + 6, P.Y(1) - 6, { cor: 'ouro', tam: 18, peso: 600 });
      P.texto('−R_X(0)', P.x0 + 6, P.Y(-1) - 7, { cor: 'ouro', tam: 18, peso: 600, alpha: .7 });
    }
  },
  parcial(P, xs, ys, q, corT) {
    const n = Math.max(2, Math.round(xs.length * q));
    P.linha(xs.slice(0, n), ys.slice(0, n), { cor: corT, lw: 2.6 });
  }
};

/* ---------- 8 · energia × potência, DEE do pulso (Fig. 7.4) ---------- */
MOD['slide-8'] = {
  init() {
    const r = criarRNG(8);
    this.pul = new Plot($('#s8-pulse'), { pad: { l: 14, r: 14, t: 10, b: 30 }, x: [-4, 4], y: [-.15, 1.3] });
    this.pow = new Plot($('#s8-pow'), { pad: { l: 14, r: 14, t: 10, b: 30 }, x: [0, 820], y: [-2.2, 2.6] });
    this.g = new Plot($('#s8-g'), { pad: { l: 52, r: 12, t: 14, b: 50 }, x: [-1.5, 1.5], y: [-.08, 1.3] });
    this.G = new Plot($('#s8-G'), { pad: { l: 76, r: 14, t: 14, b: 50 }, x: [-4, 4], y: [0, 1.1] });
    const N = 6000, rd = new Float32Array(N); let v = 0; for (let i = 0; i < N; i++) { v = .8 * v + r.n(); rd[i] = v * .38; } this.rd = rd;
    this.tp = lin(-4, 4, 400); this.yp = this.tp.map(t => Math.abs(t) < .5 ? 1 : 0);
    this.fs = lin(-4, 4, 801); this.off = 0; this.pP = 1; this.n = 0;
    this.T = 1; const inp = $('#s8-T'); pctRange(inp);
    inp.addEventListener('input', () => { this.T = +inp.value; pctRange(inp); this.desDEE(); });
  },
  entrar(n, animar) {
    this.n = n;
    if (animar) tween(900, p => { this.pP = suave(p); this.desPulso(); }); else { this.pP = 1; this.desPulso(); }
    this.desPow(); this.desDEE();
  },
  etapa(n) { this.n = n; this.desPow(); },
  final() { this.n = 9; this.pP = 1; this.desPulso(); this.desPow(); this.desDEE(); },
  tick(dt) { if (this.n >= 1 && !reduzido()) { this.off += dt * 0.09; this.desPow(); } },
  desPulso() {
    const P = this.pul; P.limpar(); P.hline(0, { cor: 'rgba(255,255,255,.4)', lw: 1.5 });
    P.area(this.tp, this.yp, { cor: 'agua', alpha: .22, base: 0, p: this.pP });
    P.linha(this.tp, this.yp, { cor: 'agua', lw: 3, p: this.pP });
    P.texto('t', P.x1 - 4, P.H - 6, { al: 'right', fonte: TINTA.serif, tam: 22 });
  },
  desPow() {
    const P = this.pow; P.limpar(); P.hline(0, { cor: 'rgba(255,255,255,.4)', lw: 1.5 });
    if (this.n < 1) return;
    const c = P.ctx, N = this.rd.length, o = this.off;
    c.save(); P.recorte(1);
    c.beginPath(); for (let x = 0; x <= 820; x += 3) { const y = P.Y(1.2 * Math.sin((x + o) / 26)); x ? c.lineTo(P.X(x), y) : c.moveTo(P.X(x), y); }
    c.strokeStyle = CONFIG.cores.ceu; c.lineWidth = 2.4; c.globalAlpha = .9; c.stroke();
    c.beginPath(); for (let x = 0; x <= 820; x += 3) { const i = Math.floor((x + o * 1.4) / 3) % N; const y = P.Y(this.rd[i]); x ? c.lineTo(P.X(x), y) : c.moveTo(P.X(x), y); }
    c.strokeStyle = CONFIG.cores.agua; c.lineWidth = 1.8; c.stroke(); c.restore();
    P.texto('⋯', P.x0 + 2, P.H - 6, { tam: 26 }); P.texto('⋯ t', P.x1 - 2, P.H - 6, { tam: 22, al: 'right' });
  },
  desDEE() {
    const T = this.T, A = this.g, B = this.G;
    A.limpar(); A.eixos({ xt: [-1, 0, 1].map(v => ({ v, l: num(v) })), yt: [{ v: 0, l: '0' }, { v: 1, l: 'A' }], xl: 't (s)' });
    const tg = lin(-1.5, 1.5, 601), yg = tg.map(t => Math.abs(t) < T / 2 ? 1 : 0);
    A.area(tg, yg, { cor: 'agua', alpha: .22, base: 0 }); A.linha(tg, yg, { cor: 'agua', lw: 3 });
    B.limpar(); B.eixos({ xt: [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(v => ({ v, l: num(v) })), yt: [0, .5, 1].map(v => ({ v, l: num(v) })), xl: 'f (Hz)', yl: '|G(f)|² / A²T²' });
    const yG = this.fs.map(f => sinc(f * T) ** 2);
    const lob = this.fs.map((f, i) => (Math.abs(f) <= 1 / T ? yG[i] : 0));
    B.area(this.fs, lob, { cor: 'ouro', alpha: .32, base: 0 });
    B.linha(this.fs, yG, { cor: 'agua', lw: 3 });
    $('#s8-To').textContent = 'T = ' + br(T, 2) + ' s';
    $('#s8-read').textContent = 'lóbulo principal: |f| < 1/T = ' + br(1 / T, 2) + ' Hz (≈ 90% da energia)';
  }
};

/* ---------- 9 · equalizador ---------- */
MOD['slide-9'] = {
  init() {
    const r = criarRNG(9); this.r = r;
    this.P = prepCanvas($('#s9-eq')); this.nb = 16;
    this.perfil = Array.from({ length: 16 }, (_, k) => .58 * Math.exp(-k / 6) + .18 + .14 * Math.exp(-Math.pow((k - 10) / 2.4, 2)));
    this.rot = ['25', '40', '63', '100', '160', '250', '400', '630', '1k', '1,6k', '2,5k', '4k', '6,3k', '10k', '13k', '16k'];
    this.h = this.perfil.slice(); this.m = this.perfil.slice(); this.cnt = 0; this.acc = 0; this.n = 0;
  },
  zerar() { this.cnt = 0; this.m = this.perfil.map(() => 0); },
  sorteio() {
    this.h = this.perfil.map(m => { let g = 0; for (let i = 0; i < 4; i++) g -= Math.log(Math.max(1e-9, this.r.u())); return Math.min(1, m * g / 4); });
    this.cnt++; this.m = this.m.map((v, k) => v + (this.h[k] - v) / this.cnt);
  },
  entrar(n) { this.n = n; this.zerar(); if (n >= 1) { this.sorteio(); } if (reduzido() || n >= 1) this.desenhar(); },
  etapa(n, ant) { this.n = n; if (n >= 1 && ant < 1) { this.zerar(); this.sorteio(); this.desenhar(); } },
  final() { this.n = 9; this.zerar(); for (let i = 0; i < 400; i++) this.sorteio(); this.desenhar(); },
  tick(dt) {
    if (this.n < 1) return;
    if (reduzido()) return;
    this.acc += dt; if (this.acc < 95) return; this.acc = 0; this.sorteio(); this.desenhar();
  },
  desenhar() {
    const { ctx: c, W, H, k } = this.P; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.P.cv.width, this.P.cv.height); c.setTransform(k, 0, 0, k, 0, 0);
    const x0 = 14, x1 = W - 14, base = H - 40, topo = 14, larg = (x1 - x0) / this.nb, segs = 18, hs = (base - topo) / segs;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, 0, W, H);
    for (let b = 0; b < this.nb; b++) {
      const xb = x0 + b * larg + 5, wb = larg - 10, aceso = Math.round(this.h[b] * segs);
      for (let s = 0; s < segs; s++) {
        const y = base - (s + 1) * hs + 2;
        c.fillStyle = s < aceso ? (s < segs * .62 ? CONFIG.cores.agua : CONFIG.cores.ceu) : 'rgba(255,255,255,.06)';
        c.globalAlpha = s < aceso ? .88 : 1; c.fillRect(xb, y, wb, hs - 4);
      }
      c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.6)'; c.font = `500 15px ${TINTA.mono}`; c.textAlign = 'center';
      c.fillText(this.rot[b], xb + wb / 2, H - 14);
    }
    if (this.cnt >= 2 || reduzido()) {
      const ms = reduzido() && this.cnt < 50 ? this.perfil : this.m;
      c.strokeStyle = CONFIG.cores.ouro; c.lineWidth = 4; c.lineJoin = 'round'; c.beginPath();
      ms.forEach((m, b) => { const x = x0 + b * larg + larg / 2, y = base - m * (base - topo); b ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      c.fillStyle = CONFIG.cores.ouro; ms.forEach((m, b) => { c.beginPath(); c.arc(x0 + b * larg + larg / 2, base - m * (base - topo), 5, 0, 7); c.fill(); });
    }
    c.textAlign = 'left';
  }
};

/* ---------- 10 · construção em 4 passos (Fig. 7.5) ---------- */
MOD['slide-10'] = {
  init(sl) {
    const C = CONFIG.s10, r = criarRNG(10), N = C.N;
    this.bx = $$('.pb', sl);
    this.x = gerarAR1(r, 4 * N, C.a); this.ini = 1.5 * N;
    this.nx = Float64Array.from({ length: 4 * N }, (_, i) => i);
    const seg = this.x.slice(this.ini, this.ini + N);
    this.nu = Float64Array.from({ length: N }, (_, k) => -.5 + k / N);
    this.mod = modulo(seg); this.per = periodograma(seg);
    this.pers = Array.from({ length: C.K }, () => periodograma(gerarAR1(r, N, C.a)));
    this.teo = this.nu.map(v => 1 / (1 - 2 * C.a * Math.cos(2 * Math.PI * v) + C.a * C.a));
    const o = (y, log) => ({ pad: { l: 8, r: 8, t: 8, b: 8 }, x: [-.5, .5], y, log });
    this.P = [new Plot($('#s10-1'), { pad: { l: 8, r: 8, t: 8, b: 26 }, x: [0, 4 * N - 1], y: [-8, 8] }),
      new Plot($('#s10-2'), o([0, 1.15 * Math.max(...this.mod)], false)), new Plot($('#s10-3'), o([-1.6, 3], true)), new Plot($('#s10-4'), o([-1.6, 3], true))];
    this.q = [0, 0, 0, 0]; this.kmed = C.K;
  },
  luzes(n) { this.bx.forEach((b, i) => b.classList.toggle('lit', n >= i + 1)); },
  entrar(n) { this.luzes(n); for (let i = 0; i < 4; i++) { this.q[i] = n >= i + 1 ? 1 : 0; } this.kmed = CONFIG.s10.K; [0, 1, 2, 3].forEach(i => this.des(i)); },
  etapa(n, ant) {
    this.luzes(n);
    for (let i = 0; i < 4; i++) {
      if (n >= i + 1 && ant < i + 1) {
        if (i === 3) tween(1900, p => { this.q[3] = 1; this.kmed = Math.max(1, Math.round(CONFIG.s10.K * suave(p))); this.des(3); });
        else tween(900, p => { this.q[i] = suave(p); this.des(i); });
      }
      if (n < i + 1) { this.q[i] = 0; this.des(i); }
    }
  },
  final() { this.luzes(9); this.q = [1, 1, 1, 1]; this.kmed = CONFIG.s10.K; [0, 1, 2, 3].forEach(i => this.des(i)); },
  des(i) {
    const P = this.P[i], q = this.q[i], N = CONFIG.s10.N; P.limpar();
    if (i === 0) {
      P.hline(0, { cor: 'rgba(255,255,255,.2)', lw: 1 });
      P.linha(this.nx, this.x, { cor: 'rgba(255,255,255,.5)', lw: 1.1, alpha: 1 - .55 * q });
      if (q > 0) {
        const c = P.ctx, xa = P.X(this.ini), xb = P.X(this.ini + N);
        c.save(); c.globalAlpha = q; c.fillStyle = 'rgba(142,197,232,.16)'; c.fillRect(xa, P.y0, xb - xa, P.y1 - P.y0);
        c.strokeStyle = CONFIG.cores.ceu; c.lineWidth = 2; c.strokeRect(xa, P.y0, xb - xa, P.y1 - P.y0); c.restore();
        const xs = Array.from(this.nx.slice(this.ini, this.ini + N)), ys = Array.from(this.x.slice(this.ini, this.ini + N));
        P.linha(xs, ys, { cor: 'ceu', lw: 1.8, alpha: q });
        P.texto('−T', xa, P.H - 4, { al: 'center', tam: 18, fonte: TINTA.serif, alpha: q }); P.texto('T', xb, P.H - 4, { al: 'center', tam: 18, fonte: TINTA.serif, alpha: q });
      }
    } else if (q > 0) {
      if (i === 1) P.linha(this.nu, this.mod, { cor: 'agua', lw: 1.6, p: q });
      if (i === 2) P.linha(this.nu, this.per, { cor: 'lilas', lw: 1.4, p: q });
      if (i === 3) {
        const K = this.kmed, m = new Float64Array(N);
        for (let j = 0; j < K; j++) { const pj = this.pers[j]; for (let k = 0; k < N; k++) m[k] += pj[k]; }
        for (let k = 0; k < N; k++) m[k] /= K;
        P.linha(this.nu, this.teo, { cor: 'teoria', lw: 2.4, dash: [8, 6] });
        P.linha(this.nu, m, { cor: 'ouro', lw: 2.6 });
        P.texto('K = ' + K, P.x1 - 6, P.y0 + 22, { al: 'right', tam: 18, fonte: TINTA.mono, cor: 'ouro' });
      }
    }
  }
};

MOD['slide-10'].alinhar = function () {
  const ts = $$('#sec-10 .eq79 .t'); if (!ts.length) return;
  ts.forEach(t => { t.style.paddingBottom = ''; });
  const caixa = $('#sec-10 .eq79'), esc = caixa.getBoundingClientRect().height / (caixa.offsetHeight || 1) || 1;
  const fundos = ts.map(t => t.getBoundingClientRect().bottom), max = Math.max(...fundos);
  ts.forEach((t, i) => { t.style.paddingBottom = (6 + (max - fundos[i]) / esc) + 'px'; });
};
{ const ent = MOD['slide-10'].entrar; MOD['slide-10'].entrar = function (n) { ent.call(this, n); this.alinhar(); }; }

/* ---------- 11 · periodograma × média (Exemplo 1, Fig. 7.6) ---------- */
MOD['slide-11'] = {
  init() {
    const C = CONFIG.ex1;
    this.P = new Plot($('#s11-c'), { pad: { l: 84, r: 20, t: 16, b: 66 }, x: [-Math.PI, Math.PI], y: [0, 7.4] });
    this.Ni = C.Nidx0; this.K = 1; this.epoca = 0; this.cache = new Map(); this.sujo = true;
    const iN = $('#s11-N'), iK = $('#s11-K'); pctRange(iN); pctRange(iK);
    iN.addEventListener('input', () => {
      this.Ni = +iN.value; pctRange(iN); const N = C.Ns[this.Ni];
      $('#s11-No').textContent = N; iN.setAttribute('aria-valuetext', N + ' amostras');
      this.msg('Mais denso, NÃO menos ruidoso.'); this.sujo = true;
    });
    iK.addEventListener('input', () => {
      this.K = +iK.value; pctRange(iK); $('#s11-Ko').textContent = this.K;
      this.msg(this.K > 1 ? 'A média converge para A² = 1.' : 'Uma única realização: o periodograma.'); this.sujo = true;
    });
    $('#s11-new').addEventListener('click', () => { this.epoca++; this.cache.clear(); this.sujo = true; this.msg('Outra realização: o mesmo comportamento.'); });
    const dr = $('#s11-drawer'), bt = $('#s11-res');
    bt.addEventListener('click', () => { dr.hidden = !dr.hidden; bt.setAttribute('aria-expanded', String(!dr.hidden)); if (!dr.hidden) $('#s11-close').focus(); });
    $('#s11-close').addEventListener('click', () => { dr.hidden = true; bt.setAttribute('aria-expanded', 'false'); bt.focus(); });
    this.xsCache = new Map();
  },
  msg(t) { $('#s11-msg').textContent = t; },
  lista() {
    const N = CONFIG.ex1.Ns[this.Ni], ch = N + ':' + this.epoca;
    if (!this.cache.has(ch)) this.cache.set(ch, { r: criarRNG(1100 + 17 * this.epoca + this.Ni), L: [] });
    return this.cache.get(ch);
  },
  /** completa as K realizações aos poucos, sem travar a animação */
  completar(orcamentoMs) {
    const N = CONFIG.ex1.Ns[this.Ni], A = CONFIG.ex1.A, e = this.lista(), t0 = performance.now();
    let mudou = false;
    while (e.L.length < this.K && performance.now() - t0 < orcamentoMs) {
      const x = new Float64Array(N); for (let n = 0; n < N; n++) x[n] = e.r.u() < .5 ? -A : A;
      e.L.push(periodograma(x)); mudou = true;
    }
    return mudou;
  },
  entrar() { this.completar(40); this.desenhar(); },
  final() { this.completar(4000); this.desenhar(); },
  tick() { const m = this.completar(7); if (m || this.sujo) { this.sujo = false; this.desenhar(); } },
  desenhar() {
    const P = this.P, N = CONFIG.ex1.Ns[this.Ni], e = this.lista(), K = Math.min(this.K, e.L.length);
    if (!this.xsCache.has(N)) this.xsCache.set(N, Float64Array.from({ length: N }, (_, i) => -Math.PI + 2 * Math.PI * i / N));
    const xs = this.xsCache.get(N);
    P.limpar();
    P.eixos({ xt: ticksPi, yt: [0, 1, 2, 3, 4, 5, 6, 7].map(v => ({ v, l: String(v) })), xl: 'ω (rad/amostra)', yl: '|X_N|² / N', tam: 21 });
    if (!K) return;
    const m = new Float64Array(N);
    for (let j = 0; j < K; j++) { const pj = e.L[j]; for (let k = 0; k < N; k++) m[k] += pj[k]; }
    let s1 = 0, s2 = 0; for (let k = 0; k < N; k++) { m[k] /= K; s1 += m[k]; s2 += m[k] * m[k]; }
    const media = s1 / N, dp = Math.sqrt(Math.max(0, s2 / N - media * media));
    const ys = Array.from(m, v => Math.min(v, 7.35));
    if (K === 1) P.hastes(xs, ys, { cor: 'agua', lw: N <= 256 ? 2 : N <= 1024 ? 1.2 : .7, alpha: .95 });
    else { P.area(xs, ys, { cor: 'agua', alpha: .16, base: 0 }); P.linha(xs, ys, { cor: 'agua', lw: N >= 1024 ? 1.4 : 2 }); }
    P.hline(CONFIG.ex1.A ** 2, { cor: 'teoria', lw: 3, dash: [12, 9] });
    P.texto('teoria: S_X = A² = 1', P.x1 - 14, P.Y(1) - 16, { al: 'right', cor: 'teoria', tam: 22, peso: 600, fundo: 'rgba(8,28,48,.92)' });
    P.texto(K === 1 ? '1 realização · N = ' + N : 'média de ' + K + ' realizações · N = ' + N, P.x0 + 14, P.y0 + 26, { tam: 21, fonte: TINTA.mono, cor: 'ouro' });
    if (K < this.K) P.texto('calculando ' + K + '/' + this.K, P.x1 - 8, P.y0 + 26, { al: 'right', tam: 18, fonte: TINTA.mono });
    $('#s11-m').textContent = br(media, 3); $('#s11-s').textContent = br(dp, 3);
  }
};

/* ---------- 12 · área = potência (Eq. 7.10–7.11) ---------- */
MOD['slide-12'] = {
  init() {
    const V = CONFIG.v3;
    this.P = new Plot($('#s12-c'), { pad: { l: 76, r: 20, t: 20, b: 66 }, x: [-150, 150], y: [0, 3] });
    this.f1 = V.f1; this.f2 = V.f2; this.med = null; this.fv = null; this.cancel = null;
    const i1 = $('#s12-f1'), i2 = $('#s12-f2'); pctRange(i1); pctRange(i2);
    const upd = (qual) => {
      let a = +i1.value, b = +i2.value;
      if (a > b) { if (qual === 1) { b = a; i2.value = b; } else { a = b; i1.value = a; } }
      this.f1 = a; this.f2 = b; pctRange(i1); pctRange(i2);
      $('#s12-f1o').textContent = a + ' Hz'; $('#s12-f2o').textContent = b + ' Hz';
      this.agendar();
    };
    i1.addEventListener('input', () => upd(1)); i2.addEventListener('input', () => upd(2));
    $('#s12-an').addEventListener('click', () => this.varrer());
    this.pendente = false;
  },
  S(f) { return Math.abs(f) < CONFIG.v3.fmax ? CONFIG.v3.S : 0; },
  agendar() { if (!this.pendente) { this.pendente = true; requestAnimationFrame(() => { this.pendente = false; this.desenhar(); this.calc(); }); } },
  entrar() { this.desenhar(); this.calc(); },
  sair() { if (this.cancel) this.cancel(); this.fv = null; this.med = null; $('#s12-anr').textContent = ''; },
  final() { this.fv = null; this.desenhar(); this.calc(); },
  calc() {
    const V = CONFIG.v3, ef = Math.max(0, Math.min(this.f2, V.fmax) - Math.min(this.f1, V.fmax)), P = 2 * V.S * ef;
    tex(`P_{[f_1,f_2]}=2\\int_{${this.f1}}^{${this.f2}}S_X(f)\\,df=2\\cdot ${V.S}\\cdot ${ef}=${P}\\ \\text{W}`, $('#s12-P'), true);
  },
  varrer() {
    const V = CONFIG.v3, df = V.rbw; if (this.cancel) this.cancel();
    this.med = [];
    const passo = (p) => {
      const fc = p * 150; this.fv = fc;
      // potência na saída do filtro estreito (as duas janelas ±fc): ≈ 2·S_X(fc)·Δf
      let ac = 0; const n = 40; for (let i = 0; i < n; i++) { const f = fc - df / 2 + (i + .5) * df / n; ac += this.S(f) * df / n; }
      const Pm = 2 * ac; this.med.push([fc, Pm / (2 * df)]);
      $('#s12-anr').innerHTML = `f = ${Math.round(fc)} Hz → P ≈ 2·S<sub>X</sub>·Δf = ${br(Pm, 1).replace(',0', '')} W`;
      this.agendar();
    };
    if (reduzido()) { for (let i = 0; i <= 150; i++) passo(i / 150); this.fv = null; this.agendar(); return; }
    this.cancel = tween(V.varreduraMs, passo, () => { this.fv = null; this.agendar(); });
  },
  desenhar() {
    const P = this.P, V = CONFIG.v3, c = P.ctx; P.limpar();
    P.eixos({ xt: [-150, -100, -50, 0, 50, 100, 150].map(v => ({ v, l: num(v) })), yt: [0, 1, 2, 3].map(v => ({ v, l: String(v) })), xl: 'f (Hz)', yl: 'S_X(f)  (W/Hz)', tam: 21 });
    const fs = lin(-150, 150, 1201), ys = fs.map(f => this.S(f));
    P.area(fs, ys, { cor: 'agua', alpha: .14, base: 0 });
    // faixa [f1,f2] e sua imagem negativa, sombreadas em dourado
    [[this.f1, this.f2], [-this.f2, -this.f1]].forEach(([a, b]) => {
      if (b <= a) return; const ff = lin(a, b, 200);
      P.area(ff, ff.map(f => this.S(f)), { cor: 'ouro', alpha: .55, base: 0 });
    });
    P.linha(fs, ys, { cor: 'agua', lw: 3 });
    c.save(); c.setLineDash([6, 5]); c.strokeStyle = CONFIG.cores.ouro; c.lineWidth = 2;
    [this.f1, this.f2, -this.f1, -this.f2].forEach(f => { const x = P.X(f); c.beginPath(); c.moveTo(x, P.y0 + 30); c.lineTo(x, P.y1); c.stroke(); });
    c.restore();
    P.texto('f₁', P.X(this.f1), P.y0 + 22, { al: 'center', cor: 'ouro', peso: 600, tam: 22, fonte: TINTA.serif });
    P.texto('f₂', P.X(this.f2), P.y0 + 22, { al: 'center', cor: 'ouro', peso: 600, tam: 22, fonte: TINTA.serif });
    P.texto('S_X = 2 W/Hz', P.X(-60), P.Y(2) - 12, { cor: 'agua', tam: 21, peso: 600 });
    if (this.med && this.med.length > 1) {
      const xs = this.med.map(m => m[0]), yv = this.med.map(m => m[1]);
      P.linha(xs, yv, { cor: 'ceu', lw: 3.5, alpha: .95 }); P.linha(xs.map(x => -x), yv, { cor: 'ceu', lw: 3.5, alpha: .95 });
    }
    if (this.fv != null) {
      const d = V.rbw / 2;
      [this.fv, -this.fv].forEach(f => { c.save(); c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(P.X(f - d), P.y0, Math.max(3, P.X(f + d) - P.X(f - d)), P.y1 - P.y0); c.restore(); });
      P.texto('RBW = Δf = 10 Hz', P.X(this.fv) + 12, P.y0 + 56, { tam: 19, fonte: TINTA.mono });
    }
  }
};

/* ---------- 13 · senóide de fase aleatória (Exemplo 2, Fig. 7.7) ---------- */
MOD['slide-13'] = {
  init() {
    this.K = new Plot($('#s13-k'), { pad: { l: 56, r: 14, t: 14, b: 58 }, x: [-2, 2], y: [0, 8.6] });
    this.X = new Plot($('#s13-x'), { pad: { l: 60, r: 14, t: 14, b: 58 }, x: [-8, 8], y: [0, 2.25] });
    this.fk = lin(-2, 2, 1601); this.fx = lin(-8, 8, 3201); this.T = .5;
    const inp = $('#s13-T'); pctRange(inp);
    inp.addEventListener('input', () => { if (this.cancel) this.cancel(); this.T = +inp.value; this.sync(); });
    $('#s13-play').addEventListener('click', () => {
      if (this.cancel) this.cancel();
      this.cancel = tween(4200, p => { this.T = .4 * Math.pow(10, p); this.sync(); });
    });
  },
  sync() { const inp = $('#s13-T'); inp.value = this.T; pctRange(inp); $('#s13-To').textContent = 'T = ' + br(this.T, 2) + ' s'; this.desenhar(); },
  entrar() { this.desenhar(); }, final() { this.desenhar(); },
  sair() { if (this.cancel) this.cancel(); },
  kap(f) { const T = this.T; return 2 * T * sinc(2 * T * f) ** 2; },
  desenhar() {
    const A = CONFIG.ex2.A, fc = CONFIG.ex2.fc, T = this.T, P = this.K, Q = this.X;
    P.limpar(); P.eixos({ xt: [-2, -1, 0, 1, 2].map(v => ({ v, l: num(v) })), yt: [0, 2, 4, 6, 8].map(v => ({ v, l: String(v) })), xl: 'f (Hz)' });
    const yk = this.fk.map(f => this.kap(f));
    P.area(this.fk, yk, { cor: 'agua', alpha: .22, base: 0 }); P.linha(this.fk, yk, { cor: 'agua', lw: 3 });
    P.texto('área = 1', P.x1 - 12, P.y0 + 34, { al: 'right', cor: 'ouro', tam: 30, peso: 700, fonte: TINTA.serif });
    P.texto('pico 2T = ' + br(2 * T, 2), P.x1 - 12, P.y0 + 68, { al: 'right', tam: 21, fonte: TINTA.mono });
    P.texto('lóbulo 1/T = ' + br(1 / T, 2) + ' Hz', P.x1 - 12, P.y0 + 96, { al: 'right', tam: 21, fonte: TINTA.mono });
    // seta indicando a largura do lóbulo principal (zeros em ±1/2T)
    const za = P.X(-1 / (2 * T)), zb = P.X(1 / (2 * T)), yy = P.y1 - 14, c = P.ctx;
    if (zb - za > 14) { c.save(); c.strokeStyle = c.fillStyle = CONFIG.cores.ouro; c.lineWidth = 2; c.beginPath(); c.moveTo(za, yy); c.lineTo(zb, yy); c.stroke();
      [[za, 1], [zb, -1]].forEach(([x, s]) => { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 9 * s, yy - 5); c.lineTo(x + 9 * s, yy + 5); c.closePath(); c.fill(); }); c.restore(); }
    Q.limpar(); Q.eixos({ xt: [-7.5, -5, -2.5, 0, 2.5, 5, 7.5].map(v => ({ v, l: num(v) })), yt: [0, .5, 1, 1.5, 2].map(v => ({ v, l: num(v) })), xl: 'f (Hz)' });
    Q.impulso(-fc, 0, { topo: true, cor: 'teoria', lw: 2.5, dash: [8, 6], alpha: .85 }); Q.impulso(fc, 0, { topo: true, cor: 'teoria', lw: 2.5, dash: [8, 6], alpha: .85 });
    Q.texto('limite: (A²/4)·δ', Q.X(fc) + 14, Q.y0 + 26, { cor: 'teoria', tam: 20, peso: 600 });
    const yx = this.fx.map(f => A * A / 4 * (this.kap(f - fc) + this.kap(f + fc)));
    Q.area(this.fx, yx, { cor: 'agua', alpha: .22, base: 0 }); Q.linha(this.fx, yx, { cor: 'agua', lw: 3 });
  }
};

/* ---------- 14 · sensor com offset (Exemplos 3 e 4, Fig. 7.8) ---------- */
MOD['slide-14'] = {
  init() {
    const C = CONFIG.ex4, N = C.N, r = criarRNG(14);
    // Pré-cálculo: média de |W_k|² e de Re W_0 sobre K realizações de W ~ N(0,1).
    // Assim, para qualquer μ e σ², o periodograma médio de μ + σW sai na hora.
    this.M = new Float64Array(N); this.mRe0 = 0;
    for (let j = 0; j < C.K; j++) {
      const re = new Float64Array(N), im = new Float64Array(N); for (let n = 0; n < N; n++) re[n] = r.n();
      FFT.fft(re, im); for (let k = 0; k < N; k++) this.M[k] += (re[k] * re[k] + im[k] * im[k]) / C.K; this.mRe0 += re[0] / C.K;
    }
    this.P = new Plot($('#s14-c'), { pad: { l: 84, r: 20, t: 16, b: 66 }, x: [-Math.PI, Math.PI], y: [-1.5, 3.7], log: true });
    this.xs = Float64Array.from({ length: N }, (_, i) => -Math.PI + 2 * Math.PI * i / N);
    this.mu = 2; this.s2 = 1; this.ac = false;
    const iM = $('#s14-mu'), iS = $('#s14-s2'); pctRange(iM); pctRange(iS);
    iM.addEventListener('input', () => { this.mu = +iM.value; pctRange(iM); this.atualizar(); });
    iS.addEventListener('input', () => { this.s2 = +iS.value; pctRange(iS); this.atualizar(); });
    const b = $('#s14-ac'); b.addEventListener('click', () => { this.ac = !this.ac; b.setAttribute('aria-pressed', String(this.ac)); this.atualizar(); });
  },
  entrar() { this.atualizar(); }, final() { this.atualizar(); },
  atualizar() {
    const N = CONFIG.ex4.N, mu = this.ac ? 0 : this.mu, s = Math.sqrt(this.s2), h = N / 2;
    $('#s14-muo').textContent = br(this.mu, 2); $('#s14-s2o').textContent = br(this.s2, 2);
    const Pk = new Float64Array(N); let soma = 0;
    for (let k = 0; k < N; k++) {
      let v = this.s2 * this.M[k]; if (k === 0) v += 2 * s * mu * N * this.mRe0 + mu * mu * N * N;
      Pk[(k + h) % N] = v / N; soma += v / N;
    }
    const P = this.P; P.limpar();
    P.eixos({ xt: ticksPi, yt: decadas(-1.5, 3.7), xl: 'ω (rad/amostra)', yl: 'S_X estimada', tam: 21 });
    P.linha(this.xs, Pk, { cor: 'agua', lw: 2 });
    P.hline(this.s2, { cor: 'teoria', lw: 2.5, dash: [10, 8] });
    P.texto('piso σ² = ' + br(this.s2, 2) + ' (ruído)', P.x0 + 14, P.Y(this.s2) - 14, { cor: 'teoria', tam: 21, peso: 600 });
    if (mu > .04) {
      const alt = Pk[h];
      P.texto('raia em ω = 0: componente DC', P.X(0) + 18, Math.max(P.y0 + 28, P.Y(alt) + 6), { cor: 'ceu', tam: 21, peso: 600 });
      P.texto('altura ≈ Nμ² = ' + milhar(N * mu * mu, 0), P.X(0) + 18, Math.max(P.y0 + 56, P.Y(alt) + 34), { cor: 'ceu', tam: 19, fonte: TINTA.mono });
    } else if (this.ac && this.mu > .04) {
      P.texto('raia DC removida pelo capacitor', P.X(0) + 18, P.y0 + 30, { cor: 'ceu', tam: 21, peso: 600 });
    }
    const MAX = 11, m2 = this.mu * this.mu;
    const dc = $('#s14-dc'), fl = $('#s14-fl');
    dc.style.width = (m2 / MAX * 100) + '%'; dc.classList.toggle('off', this.ac); fl.style.width = (this.s2 / MAX * 100) + '%';
    $('#s14-sum').innerHTML = this.ac
      ? `<span class="k1">μ² removido</span> + <span class="k2">σ² = ${br(this.s2, 2)}</span> = ${br(this.s2, 2)}<br><span class="dim">simulação: ${br(soma / N, 2)}</span>`
      : `<span class="k1">μ² = ${br(m2, 2)}</span> + <span class="k2">σ² = ${br(this.s2, 2)}</span> = ${br(m2 + this.s2, 2)}<br><span class="dim">simulação (1/N)ΣP: ${br(soma / N, 2)}</span>`;
  }
};

/* ---------- 15 · raia × piso e a SNR (Exemplo 5) ---------- */
MOD['slide-15'] = {
  init(sl) {
    this.P = new Plot($('#s15-c'), { pad: { l: 84, r: 20, t: 20, b: 66 }, x: [-60, 60], y: [0, 3.2] });
    this.lg = 4; const inp = $('#s15-df'); pctRange(inp);
    inp.addEventListener('input', () => { if (this.cancel) this.cancel(); this.lg = +inp.value; this.agendar(); });
    $$('[data-df]', sl).forEach(b => b.addEventListener('click', () => {
      if (this.cancel) this.cancel(); const a = this.lg, z = +b.dataset.df;
      this.cancel = tween(500, p => { this.lg = a + (z - a) * suave(p); this.agendar(); });
    }));
    tex(`P_{\\text{sinal}}=\\dfrac{A^2}{2}=\\dfrac{(10^{-5})^2}{2}=5\\times10^{-11}\\ \\text{W}`, $('#s15-ps'), true);
    this.pend = false;
  },
  agendar() { if (!this.pend) { this.pend = true; requestAnimationFrame(() => { this.pend = false; this.atualizar(); }); } },
  entrar() { this.atualizar(); }, final() { this.atualizar(); },
  sair() { if (this.cancel) this.cancel(); },
  atualizar() {
    const E = CONFIG.ex5, df = Math.pow(10, this.lg), inp = $('#s15-df');
    inp.value = this.lg; pctRange(inp);
    const rot = df >= 1000 ? br(df / 1000, df >= 1e4 ? 0 : 1) + ' kHz' : Math.round(df) + ' Hz';
    $('#s15-dfo').textContent = rot.replace(',0 kHz', ' kHz'); inp.setAttribute('aria-valuetext', rot);
    const Ps = E.A * E.A / 2, Pn = 2 * E.N0meio * df, snr = Ps / Pn, db = 10 * Math.log10(snr);
    const dfT = Math.abs(this.lg - Math.round(this.lg)) < 5e-3 ? `10^{${Math.round(this.lg)}}` : texSci(df, 2);
    tex(`\\begin{aligned}P_{\\text{ruído}}&=2\\cdot\\tfrac{N_0}{2}\\cdot\\Delta f=4\\times10^{-18}\\cdot\\Delta f\\\\&=4\\times10^{-18}\\cdot ${dfT}=${texSci(Pn, 1)}\\ \\text{W}\\end{aligned}`, $('#s15-pn'), true);
    const linT = snr >= 100 ? milhar(Math.round(snr), 0).replace(/ /g, '\\,') : br(snr, 1).replace(',', '{,}');
    tex(`\\text{SNR}=\\dfrac{P_{\\text{sinal}}}{P_{\\text{ruído}}}=${linT}\\approx ${br(db, 1).replace(',', '{,}')}\\ \\text{dB}`, $('#s15-snr'), true);
    $('#s15-fill').style.width = clamp(db / 60 * 100, 0, 100) + '%';
    // gráfico: f relativo a f_c, em kHz
    const P = this.P, c = P.ctx; P.limpar();
    P.eixos({ xt: [{ v: -50, l: '−50' }, { v: -25, l: '−25' }, { v: 0, l: 'f_c' }, { v: 25, l: '+25' }, { v: 50, l: '+50' }], yt: [0, 1, 2, 3].map(v => ({ v, l: String(v) })), xl: 'f − f_c (kHz)', yl: 'DEP (×10⁻¹⁸ W/Hz)', tam: 21 });
    const piso = E.N0meio * 1e18, w = df / 1000;
    c.save(); c.fillStyle = 'rgba(95,200,192,.12)'; c.fillRect(P.x0, P.Y(piso), P.x1 - P.x0, P.y1 - P.Y(piso)); c.restore();
    const xa = P.X(-w / 2), xb = P.X(w / 2), wl = Math.max(3, xb - xa), xm = (xa + xb) / 2;
    c.save(); c.fillStyle = 'rgba(227,162,59,.6)'; c.fillRect(xm - wl / 2, P.Y(piso), wl, P.y1 - P.Y(piso));
    c.strokeStyle = CONFIG.cores.ouro; c.lineWidth = 2; c.setLineDash([6, 5]); c.strokeRect(xm - wl / 2, P.y0 + 34, wl, P.y1 - P.y0 - 34); c.restore();
    P.hline(piso, { cor: 'agua', lw: 3 });
    P.texto('piso N₀/2 = 2×10⁻¹⁸ W/Hz', P.x0 + 14, P.Y(piso) - 14, { cor: 'agua', tam: 21, peso: 600 });
    P.impulso(0, 0, { topo: true, cor: 'ceu', lw: 4 });
    P.texto('raia do tom: A²/4 · δ(f − f_c)', P.X(0) + 18, P.y0 + 24, { cor: 'ceu', tam: 21, peso: 600 });
    P.texto('Δf = ' + rot.replace(',0 kHz', ' kHz'), xm + wl / 2 + 12, P.Y(piso) + 46, { cor: 'ouro', tam: 22, peso: 700, fonte: TINTA.mono });
    // miniatura bilateral: o mesmo acontece em −f_c (por isso o fator 2)
    const bx = P.x1 - 316, by = P.y1 - 124, bw = 300, bh = 100;
    c.save(); c.fillStyle = 'rgba(4,17,32,.85)'; c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.fillRect(bx, by, bw, bh); c.strokeRect(bx, by, bw, bh);
    const yb = by + bh - 22, yp = yb - 22; c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(bx + 10, yb); c.lineTo(bx + bw - 10, yb); c.stroke();
    c.fillStyle = 'rgba(95,200,192,.25)'; c.fillRect(bx + 10, yp, bw - 20, yb - yp);
    const ww = clamp(w / 120 * 70, 2, 70);
    [bx + 70, bx + bw - 70].forEach(x => { c.fillStyle = 'rgba(227,162,59,.8)'; c.fillRect(x - ww / 2, yp, ww, yb - yp); c.strokeStyle = CONFIG.cores.ceu; c.lineWidth = 3; c.beginPath(); c.moveTo(x, yb); c.lineTo(x, by + 32); c.stroke(); });
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `500 15px ${TINTA.fonte}`; c.textAlign = 'center';
    c.textBaseline = 'alphabetic'; textoRico(c, '−f_c', bx + 70, by + bh - 4, 16, TINTA.fonte, 500, 'center'); textoRico(c, 'f_c', bx + bw - 70, by + bh - 4, 16, TINTA.fonte, 500, 'center');
    textoRico(c, 'bilateral: janela em ±f_c (×2)', bx + bw / 2, by + 22, 16, TINTA.fonte, 500, 'center'); c.restore();
  }
};

/* ---------- 16 · assinaturas espectrais e cartões ---------- */
MOD['slide-16'] = {
  init(sl) {
    this.sl = sl; const r = criarRNG(16), o = { pad: { l: 8, r: 8, t: 8, b: 8 }, x: [-1, 1], y: [0, 1.2] };
    this.P = ['#s16-a', '#s16-b', '#s16-c'].map(id => new Plot($(id), o));
    this.j = Array.from({ length: 200 }, () => r.n());
    $$('.vcard', sl).forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
  },
  entrar() { this.desenhar(); }, final() { this.desenhar(); },
  sair() { $$('.vcard', this.sl).forEach(b => b.setAttribute('aria-pressed', 'false')); },
  desenhar() {
    const [a, b, c] = this.P, xs = lin(-1, 1, 120);
    [a, b, c].forEach(P => { P.limpar(); P.hline(0.06, { cor: 'rgba(255,255,255,.4)', lw: 1.4 }); });
    a.linha(xs, xs.map((_, i) => .5 + .035 * this.j[i]), { cor: 'agua', lw: 2.6 });
    b.impulso(-.55, .95, { base: .06, cor: 'ceu' }); b.impulso(.55, .95, { base: .06, cor: 'ceu' });
    c.impulso(0, .95, { base: .06, cor: 'ceu' });
  }
};

/* =========================================================================
   NAVEGAÇÃO: etapas, transições, hash, sumário, notas, teclado, toque
   ========================================================================= */
const deck = { slides: [], cur: 0, etapa: 0, flow: false, prontos: false };

function aplicarCores() {
  const r = document.documentElement.style, m = { navy: '--navy', petroleo: '--petroleo', ouro: '--ouro', agua: '--agua', ceu: '--ceu', teoria: '--teoria', ok: '--ok', lilas: '--lilas' };
  for (const k in m) if (CONFIG.cores[k]) r.setProperty(m[k], CONFIG.cores[k]);
}
function renderTeX() {
  if (!window.katex) return;
  $$('.tex').forEach(el => {
    if (el.dataset.ok) return;
    const src = el.textContent; el.dataset.src = src;
    try { katex.render(src, el, KATEX_OPC(el.classList.contains('d'))); el.dataset.ok = '1'; } catch (e) { el.textContent = src; }
  });
}
/* efeitos de revelação: traços SVG que se desenham e fórmulas termo a termo */
function animarTraco(p) {
  if (!p.getTotalLength) return;
  const L = p.getTotalLength(); if (!L) return;
  p.style.transition = 'none'; p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
  p.getBoundingClientRect();
  p.style.transition = `stroke-dashoffset ${p.dataset.ms || 700}ms cubic-bezier(.45,0,.25,1) ${p.dataset.d || 0}ms`;
  p.style.strokeDashoffset = 0;
}
function tracoFinal(p) { p.style.transition = 'none'; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }
function termos(tw, modo) {
  (tw._t || []).forEach(clearTimeout); tw._t = [];
  const ts = $$('.t', tw);
  if (modo === 'reset') { ts.forEach(t => t.classList.remove('on', 'flash')); return; }
  if (modo === 'final' || reduzido()) { ts.forEach(t => { t.classList.add('on'); t.classList.remove('flash'); }); return; }
  ts.forEach(t => t.classList.remove('on', 'flash'));
  ts.forEach((t, i) => tw._t.push(setTimeout(() => {
    t.classList.add('on', 'flash');
    tw._t.push(setTimeout(() => t.classList.remove('flash'), 1000));
  }, 120 + i * 430)));
}
/** dono de um efeito = o [data-step] mais próximo (ou o próprio slide) */
const dono = (el, sl) => el.closest('[data-step]') || sl;
function efeitos(sl, alvo, modo) {
  $$('.draw', sl).forEach(p => { if (dono(p, sl) === alvo) modo === 'anim' && !reduzido() ? animarTraco(p) : tracoFinal(p); });
  $$('.tw', sl).forEach(t => {
    const d = t.matches('[data-step]') ? t : dono(t, sl);
    if (d === alvo) termos(t, modo === 'anim' ? 'anim' : modo);
  });
}
function mostrarEtapas(sl, n, animar) {
  sl._passos.forEach(el => {
    const s = +el.dataset.step, vis = s <= n, tinha = el.classList.contains('shown');
    if (vis && !tinha) { el.classList.add('shown'); efeitos(sl, el, animar ? 'anim' : 'final'); }
    else if (vis && tinha && !animar) efeitos(sl, el, 'final');
    else if (!vis && tinha) { el.classList.remove('shown'); efeitos(sl, el, 'reset'); }
  });
}
function ativar(i, n, dir, animar, forcar) {
  const ant = deck.slides[deck.cur], novo = deck.slides[i], mudou = ant !== novo;
  if (mudou) {
    const mA = ant._mod; if (mA && mA.sair && deck.prontos) mA.sair();
    if (!deck.flow && !reduzido() && dir) {
      novo.style.transition = 'none'; novo.style.setProperty('--dx', (dir * 60) + 'px'); novo.getBoundingClientRect(); novo.style.transition = '';
      ant.style.setProperty('--dx', (-dir * 60) + 'px');
    }
    ant.classList.remove('active'); ant.setAttribute('aria-hidden', 'true');
    novo.classList.add('active'); novo.removeAttribute('aria-hidden');
    novo.style.setProperty('--dx', '0px');
    if (deck.flow) novo.scrollTop = 0;
  }
  deck.cur = i; deck.etapa = n;
  if (!deck.prontos) { novo.classList.add('active'); novo.removeAttribute('aria-hidden'); }
  if (mudou || !deck.prontos || forcar) {
    novo._passos.forEach(el => el.classList.remove('shown'));
    efeitos(novo, novo, animar ? 'anim' : 'final');
    mostrarEtapas(novo, n, animar && !deck.flow ? false : animar);
    const m = novo._mod; if (m && m.entrar) m.entrar(n, animar);
  }
  deck.prontos = true;
  atualizarCromo();
  const h = '#slide-' + (i + 1);
  if (location.hash !== h) { deck.ignorarHash = h; try { location.hash = h; } catch (e) { /* ignora */ } }
}
function irPara(i, n = 0, animar = true) {
  i = clamp(i, 0, deck.slides.length - 1);
  const dir = i > deck.cur ? 1 : i < deck.cur ? -1 : 0;
  const max = deck.slides[i]._max;
  ativar(i, deck.flow ? max : clamp(n, 0, max), dir, animar);
}
function avancar() {
  const sl = deck.slides[deck.cur];
  if (!deck.flow && deck.etapa < sl._max) {
    const ant = deck.etapa; deck.etapa++;
    mostrarEtapas(sl, deck.etapa, true);
    const m = sl._mod; if (m && m.etapa) m.etapa(deck.etapa, ant);
    atualizarCromo();
  } else if (deck.cur < deck.slides.length - 1) irPara(deck.cur + 1, 0, true);
}
function voltar() {
  const sl = deck.slides[deck.cur];
  if (!deck.flow && deck.etapa > 0) {
    const ant = deck.etapa; deck.etapa--;
    mostrarEtapas(sl, deck.etapa, false);
    const m = sl._mod; if (m && m.etapa) m.etapa(deck.etapa, ant);
    atualizarCromo();
  } else if (deck.cur > 0) { const i = deck.cur - 1; ativar(i, deck.slides[i]._max, -1, false); }
}
function atualizarCromo() {
  const n = deck.slides.length, sl = deck.slides[deck.cur];
  const frac = sl._max ? deck.etapa / (sl._max + 1) : 0;
  $('#progress i').style.width = Math.min(100, (deck.cur + frac) / (n - 1) * 100) + '%';
  $('#fCount').textContent = (deck.cur + 1) + ' / ' + n;
  $$('#menuList .mi').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === deck.cur)));
  const notas = $('.notes', sl);
  $('#notesContent').innerHTML =
    `<p class="nslide">slide ${deck.cur + 1} / ${n}` + (sl._max && !deck.flow ? ` · etapa ${deck.etapa} de ${sl._max}` : '') + `</p>` +
    `<h3>${sl.dataset.title}</h3>` + (notas ? notas.innerHTML : '');
}
function montarMenu() {
  const grupos = [['capa', 'Abertura'], ['7.1', '7.1 · Motivação'], ['7.2', '7.2 · Revisão: processos WSS'], ['7.3', '7.3 · Energia, potência e Fourier'], ['7.4', '7.4 · DEP: intuição e definição'], ['7.5', '7.5 · Exemplos resolvidos e síntese']];
  const lista = $('#menuList');
  grupos.forEach(([g, nome]) => {
    const itens = deck.slides.map((s, i) => [s, i]).filter(([s]) => s.dataset.group === g);
    if (!itens.length) return;
    const h = document.createElement('p'); h.className = 'mg'; h.textContent = nome; lista.appendChild(h);
    itens.forEach(([s, i]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mi'; b.dataset.i = i;
      b.innerHTML = `<span class="n">${i + 1}</span><span>${s.dataset.title}</span>`;
      b.addEventListener('click', () => { irPara(i, 0, true); abrirMenu(false); });
      lista.appendChild(b);
    });
  });
}
function abrirMenu(abrir) {
  const m = $('#menu'), aberto = abrir ?? !m.classList.contains('open');
  m.classList.toggle('open', aberto); m.setAttribute('aria-hidden', String(!aberto));
  $('#menuBtn').setAttribute('aria-expanded', String(aberto));
  if (aberto) { const a = $('.mi[aria-current="true"]', m) || $('.mi', m); if (a) a.focus(); }
}
function abrirNotas(abrir) {
  const aberto = abrir ?? !document.body.classList.contains('notes-open');
  document.body.classList.toggle('notes-open', aberto);
  $('#notes').setAttribute('aria-hidden', String(!aberto));
  $('#notesBtn').setAttribute('aria-expanded', String(aberto));
  setTimeout(escalar, 360); escalar();
}
function telaCheia() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
  } catch (e) { /* alguns navegadores bloqueiam */ }
}
function escalar() {
  const flow = innerWidth < 900 || (innerHeight > innerWidth && innerWidth < 1100);
  if (flow !== deck.flow) {
    deck.flow = flow; document.documentElement.classList.toggle('flow', flow);
    if (deck.prontos) ativar(deck.cur, flow ? deck.slides[deck.cur]._max : deck.etapa, 0, false, true);
  }
  if (!flow) {
    const vp = $('#viewport').getBoundingClientRect();
    const s = Math.min(vp.width / 1920, vp.height / 1080);
    document.documentElement.style.setProperty('--s', s.toFixed(4));
  }
}

function iniciar() {
  aplicarCores();
  renderTeX();
  deck.slides = $$('.slide');
  deck.slides.forEach((sl, i) => {
    sl._passos = $$('[data-step]', sl);
    sl._max = sl._passos.reduce((m, el) => Math.max(m, +el.dataset.step), 0);
    sl.setAttribute('aria-hidden', 'true');
    if (!sl.classList.contains('cover')) {
      const f = document.createElement('footer'); f.className = 'sfoot';
      f.innerHTML = `<span>${CONFIG.rodape}</span><span class="num">${i + 1} / ${deck.slides.length}</span>`;
      sl.appendChild(f);
    }
    sl._mod = MOD['slide-' + (i + 1)]; const m = sl._mod; if (m && m.init) m.init(sl);
  });
  montarMenu();
  // estado inicial pelo hash (#slide-8)
  const ler = () => { const m = /^#slide-(\d+)$/.exec(location.hash); return m ? clamp(+m[1] - 1, 0, deck.slides.length - 1) : 0; };
  escalar();
  deck.cur = ler();
  ativar(deck.cur, deck.flow ? deck.slides[deck.cur]._max : 0, 0, true);
  window.addEventListener('hashchange', () => {
    if (deck.ignorarHash === location.hash) { deck.ignorarHash = null; return; }
    const i = ler(); if (i !== deck.cur) irPara(i, 0, true);
  });
  window.addEventListener('resize', escalar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { const m = deck.slides[deck.cur]._mod; if (m && m.entrar) m.entrar(deck.etapa, false); });

  // teclado
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const alvo = e.target, ehRange = alvo.matches && alvo.matches('input[type=range]'), ehBotao = alvo.closest && alvo.closest('button');
    const k = e.key;
    if (k === 'Escape') { abrirMenu(false); abrirNotas(false); const d = $('#s11-drawer'); if (!d.hidden) $('#s11-close').click(); return; }
    if ($('#menu').classList.contains('open') && (k === 'ArrowDown' || k === 'ArrowUp')) {
      const itens = $$('#menu .mi'), j = itens.indexOf(document.activeElement);
      const nj = clamp((j < 0 ? 0 : j) + (k === 'ArrowDown' ? 1 : -1), 0, itens.length - 1); itens[nj].focus(); e.preventDefault(); return;
    }
    if (ehRange && (k.startsWith('Arrow') || k === 'Home' || k === 'End' || k === 'PageUp' || k === 'PageDown')) return;
    if (ehBotao && (k === ' ' || k === 'Enter')) return;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); avancar(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); voltar(); }
    else if (k === 'Home') { e.preventDefault(); irPara(0, 0, true); }
    else if (k === 'End') { e.preventDefault(); irPara(deck.slides.length - 1, 0, true); }
    else if (k === 'f' || k === 'F') telaCheia();
    else if (k === 'n' || k === 'N') abrirNotas();
    else if (k === 'm' || k === 'M') abrirMenu();
  });
  // clique nas laterais
  $('#viewport').addEventListener('click', e => {
    if (deck.flow) return;
    if (e.target.closest('button, input, a, label, select, textarea, output, .drawer, .vcard')) return;
    const r = $('#viewport').getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if (x < CONFIG.zonaClique) voltar(); else if (x > 1 - CONFIG.zonaClique) avancar();
  });
  // deslizar no celular/tablet
  let t0 = null;
  $('#viewport').addEventListener('touchstart', e => {
    if (e.target.closest('input, .drawer, canvas.interativo')) { t0 = null; return; }
    const t = e.changedTouches[0]; t0 = { x: t.clientX, y: t.clientY, t: performance.now() };
  }, { passive: true });
  $('#viewport').addEventListener('touchend', e => {
    if (!t0) return; const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y; t0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.6 * Math.abs(dy)) { dx < 0 ? avancar() : voltar(); }
  }, { passive: true });
  // botões de cromo
  $('#menuBtn').addEventListener('click', () => abrirMenu());
  $('#prevBtn').addEventListener('click', voltar); $('#nextBtn').addEventListener('click', avancar);
  $('#notesBtn').addEventListener('click', () => abrirNotas()); $('#fsBtn').addEventListener('click', telaCheia);
  $('#fMenu').addEventListener('click', () => abrirMenu()); $('#fPrev').addEventListener('click', () => irPara(deck.cur - 1, 0, true));
  $('#fNext').addEventListener('click', () => irPara(deck.cur + 1, 0, true)); $('#fNotes').addEventListener('click', () => abrirNotas());
  // mostra os botões do cromo quando o mouse se move
  let ui; document.addEventListener('mousemove', () => { document.body.classList.add('ui'); clearTimeout(ui); ui = setTimeout(() => document.body.classList.remove('ui'), 1800); });
  // impressão (Ctrl+P): todos os gráficos no estado final
  window.addEventListener('beforeprint', () => { deck.slides.forEach(sl => { const m = sl._mod; if (m && m.final) m.final(); }); $$('.tw').forEach(t => termos(t, 'final')); $$('.draw').forEach(tracoFinal); });
  window.addEventListener('afterprint', () => ativar(deck.cur, deck.etapa, 0, false, true));

  // laço único de animação
  let ult = performance.now();
  const quadro = agora => {
    const dt = Math.min(64, agora - ult); ult = agora;
    for (const tw of Array.from(tweens)) {
      const p = clamp((agora - tw.t0) / tw.ms, 0, 1); tw.fn(p);
      if (p >= 1) { tweens.delete(tw); if (tw.fim) tw.fim(); }
    }
    const m = deck.slides[deck.cur]._mod; if (m && m.tick) m.tick(dt, agora);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}
iniciar();
