
/* =====================================================================
   NÚCLEO — utilidades numéricas, formatação pt-BR, série E12,
   mapa de cores de potencial e modelo da curva do Zener.
   ===================================================================== */
'use strict';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVGNS = 'http://www.w3.org/2000/svg';

/* ---------- série E12 ---------- */
const E12_BASE = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
function e12List(min, max) {
  const out = [];
  for (let d = -1; d <= 6; d++) for (const b of E12_BASE) {
    const v = +(b * Math.pow(10, d)).toPrecision(3);
    if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
  }
  return out;
}
const E12_ALL = e12List(1, 1e7);
/** menor valor E12 maior ou igual a x (o "imediatamente acima" do roteiro) */
function e12Above(x) { return E12_ALL.find(v => v >= x * (1 - 1e-9)); }
/** maior valor E12 menor ou igual a x */
function e12Below(x) { let r = E12_ALL[0]; for (const v of E12_ALL) if (v <= x * (1 + 1e-9)) r = v; return r; }

/* ---------- formatação pt-BR ---------- */
function num(x, dec) {
  if (!isFinite(x)) return '∞';
  let s = Math.abs(x).toFixed(dec);
  if (x < 0 && +s !== 0) s = '−' + s;
  return s.replace('.', ',');
}
function fV(v, dec = 2) { return num(v, dec) + ' V'; }
function fI(i) {                                   // corrente em mA (ou µA)
  const a = Math.abs(i);
  if (a > 0 && a < 1e-4) return num(i * 1e6, 1) + ' µA';
  if (a >= 1) return num(i, 2) + ' A';
  return num(i * 1e3, a >= 0.1 ? 1 : 2) + ' mA';
}
function fP(p) {                                   // potência
  const a = Math.abs(p);
  if (a >= 1) return num(p, 2) + ' W';
  if (a >= 0.0095) return num(p * 1e3, 0) + ' mW';
  return num(p * 1e3, 1) + ' mW';
}
function fR(r) {
  if (!isFinite(r)) return '∞';
  if (r >= 1e6) return num(r / 1e6, r >= 1e7 ? 0 : 1) + ' MΩ';
  if (r >= 1000) { const k = r / 1000; return num(k, k >= 100 ? 0 : (Math.abs(k - Math.round(k * 10) / 10) < 1e-6 ? 1 : 2)).replace(/,0$/, '') + ' kΩ'; }
  const dec = r < 10 ? 1 : (r < 100 && Math.abs(r - Math.round(r)) > 0.05) ? 1 : 0;
  return num(r, dec) + ' Ω';
}
function fPct(x) { return num(x * 100, x < 0.1 ? 1 : 0) + ' %'; }
function fW(p) { return p >= 1 ? num(p, 0) + ' W' : (p === 0.25 ? '1/4 W' : p === 0.5 ? '1/2 W' : p === 0.125 ? '1/8 W' : fP(p)); }

/* Versões para KaTeX: vírgula decimal sem espaço extra ({,}) */
const tx = s => s.replace(/,/g, '{,}');
function tn(x, dec) { return tx(num(x, dec)).replace('−', '-'); }
function tV(v, dec = 2) { return tn(v, dec) + '\\,\\text{V}'; }
function tmA(i, dec = 2) { return tn(i * 1e3, dec) + '\\,\\text{mA}'; }
function tmW(p, dec = 0) { return tn(p * 1e3, dec) + '\\,\\text{mW}'; }
function tOhm(r) { return r >= 1000 ? tx(num(r / 1000, (r % 1000 === 0) ? 0 : 1)) + '\\,\\text{k}\\Omega' : tn(r, 0) + '\\,\\Omega'; }

/* ---------- mapa de cores de potencial: 0 V azul-escuro → máx. vermelho ---------- */
const VMAP = [
  [0.00, [31, 45, 77]],   // #1F2D4D
  [0.30, [46, 93, 170]],  // #2E5DAA
  [0.55, [44, 156, 156]], // #2C9C9C
  [0.76, [224, 160, 48]], // #E0A030
  [1.00, [217, 69, 43]],  // #D9452B
];
function vRGB(t) {
  t = clamp(t, 0, 1);
  for (let k = 1; k < VMAP.length; k++) {
    if (t <= VMAP[k][0]) {
      const [t0, c0] = VMAP[k - 1], [t1, c1] = VMAP[k];
      const u = (t - t0) / (t1 - t0);
      return c0.map((c, i) => Math.round(lerp(c, c1[i], u)));
    }
  }
  return VMAP[VMAP.length - 1][1];
}
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb = (c, a = 1) => a === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function vColor(v, vmax) { return rgb(vRGB(vmax > 0 ? v / vmax : 0)); }
function vGradientCSS() { return 'linear-gradient(90deg,' + VMAP.map(([t, c]) => `${rgb(c)} ${t * 100}%`).join(',') + ')'; }

/* cor da barra P/Pmáx: verde até 50 %, amarelo até 100 %, vermelho acima */
function ratioColor(r) { return r > 1 ? '#C9362A' : r > 0.5 ? '#D49114' : '#23884F'; }

/* ---------- modelo da curva reversa do Zener (só para DESENHO) ----------
   Os CÁLCULOS usam o modelo ideal da lista (fonte V_Z). A curva desenhada
   precisa de joelho e inclinação reais para os gráficos de resistência:
   - abaixo de V_Z: corrente de fuga + crescimento exponencial no joelho
     (a = Z_ZK·I_ZK dá a resistência dinâmica Z_ZK no joelho);
   - acima de V_Z: reta de inclinação 1/r_z (transição suave de largura b). */
function makeZenerModel(z) {
  const Vz = z.Vdraw || z.Vz, Izk = z.Izk, rz = z.rzDraw || z.rz || 10;
  const a = (z.Zzk || 700) * Izk, b = z.knee || 0.04, Ileak = z.Ileak || 0.5e-6;
  function I(V) {                                   // V = tensão reversa (≥ 0)
    const u = V - Vz, leak = Ileak * V / Vz;
    const off = Izk * Math.exp(-Vz / a);                 // garante I(0) = 0
    if (u <= 0) return leak + Izk * Math.exp(u / a) - off;
    return leak + Izk * (1 + u / a) - off + (u / rz) * (1 - Math.exp(-u / b));
  }
  // amostragem densa para inverter I(V) e obter R = V/I e r = dV/dI
  const pts = [];
  const Vtop = Vz + rz * (z.Izm || 0.1) * 1.6 + 0.3;
  for (let k = 0; k <= 900; k++) {
    const V = (k / 900) * Vtop;
    if (V <= 0) continue;
    const i = I(V), dI = (I(V + 1e-4) - I(V - 1e-4)) / 2e-4;
    pts.push({ V, I: i, Rs: V / i, rd: 1 / dI });
  }
  function atI(i) {                                  // ponto da curva com corrente i
    if (i <= pts[0].I) return pts[0];
    for (let k = 1; k < pts.length; k++) if (pts[k].I >= i) {
      const p0 = pts[k - 1], p1 = pts[k], t = (i - p0.I) / (p1.I - p0.I);
      return { V: lerp(p0.V, p1.V, t), I: i, Rs: lerp(p0.V, p1.V, t) / i, rd: lerp(p0.rd, p1.rd, t) };
    }
    return pts[pts.length - 1];
  }
  function atV(V) { const i = I(Math.max(V, 1e-6)); return { V, I: i, Rs: V / i, rd: 1 / ((I(V + 1e-4) - I(V - 1e-4)) / 2e-4) }; }
  return { z, I, pts, atI, atV, rz };
}

/* ---------- pequenos ícones (traço) ---------- */
const ICON = {
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  slow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 15c2-6 7-8 11-6 3 1.5 4 4 7 3"/><circle cx="8" cy="15" r="2.4"/><path d="M14 9l1-3"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/></svg>',
  relief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 19V7h5l3 6h4l2 4h4"/></svg>',
  meter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><circle cx="12" cy="15.5" r="2.6"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 10.5h5M10.5 8v5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
};

/* canvas.roundRect em navegadores antigos */
if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
}

/* =====================================================================
   MOTOR DE SIMULAÇÃO VISUAL
   Um objeto Sim desenha o esquemático (SVG), anima as partículas de
   corrente (canvas por cima do SVG) e reage ao "solver" da questão.

   Ideia central das partículas:
   - cada ramo (aresta) tem a corrente calculada pelo solver;
   - a fonte "emite" partículas a uma taxa ∝ corrente (fluxo ∝ I);
   - em cada nó, as partículas escolhem o ramo de saída na proporção
     exata das correntes (Lei dos Nós visível: I_R = I_Z + I_L);
   - velocidade ∝ √I e densidade ∝ √I  →  fluxo = densidade × velocidade ∝ I.
   ===================================================================== */

/* ---------- auxiliares de SVG ---------- */
function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
/** Texto com subscritos: "R_S", "P_ZM = 1 W", "V_{Z1}" → <tspan> rebaixado */
function svgRich(textEl, str) {
  while (textEl.firstChild) textEl.removeChild(textEl.firstChild);
  const re = /_(\{[^}]*\}|[A-Za-z0-9áéíóúãõâêôç,]+)/g;
  let last = 0, m;
  const add = (t, sub) => {
    if (!t) return;
    const ts = svgEl('tspan', {}, textEl);
    if (sub) { ts.setAttribute('font-size', '72%'); ts.setAttribute('dy', '0.32em'); }
    ts.textContent = t;
    if (sub) { const back = svgEl('tspan', { dy: '-0.23em' }, textEl); back.textContent = '​'; }
  };
  while ((m = re.exec(str))) {
    add(str.slice(last, m.index));
    add(m[1].replace(/[{}]/g, ''), true);
    last = re.lastIndex;
  }
  add(str.slice(last));
}
const ptKey = p => Math.round(p[0]) + ',' + Math.round(p[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/* ---------- desenho dos componentes ----------
   Cada função recebe a definição do componente e devolve:
   { g, pins, path (caminho interno das partículas), k (fator de
     velocidade dentro dele), junction (ponto da junção PN), center,
     box [x,y,w,h], update(sol, sim) } */
const NAVY = '#1F2D4D', ORANGE = '#E8772E';
const COMPS = {
  /* fonte CC: a = terminal −, b = terminal + */
  dc(c, sim, root) {
    const g = svgEl('g', { class: 'comp' }, root);
    const { x, y, r } = c;
    svgEl('circle', { cx: x, cy: y, r, fill: '#fff', stroke: NAVY, 'stroke-width': 3.4 }, g);
    const t1 = svgEl('text', { x, y: y - r * 0.18, class: 'sym' }, g); t1.textContent = '+';
    const t2 = svgEl('text', { x, y: y + r * 0.62, class: 'sym' }, g); t2.textContent = '−';
    const lab = svgEl('text', { x: x - r - 14, y: y + 8, class: 'val strong', 'text-anchor': 'end' }, g);
    return {
      g, pins: { a: [x, y + r], b: [x, y - r] }, path: [[x, y + r], [x, y - r]], k: 1.6, hideInside: true, center: [x, y],
      box: [x - r - 6, y - r - 6, 2 * r + 12, 2 * r + 12],
      update(sol, sim) { lab.textContent = c.label ? c.label(sim.p, sol) : ''; },
    };
  },
  /* resistor em zigue-zague entre a e b (com seta de variável opcional) */
  res(c, sim, root) {
    const g = svgEl('g', { class: 'comp' }, root);
    const [ax, ay] = c.a, [bx, by] = c.b, L = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / L, dy = (by - ay) / L, nx = -dy, ny = dx, amp = c.amp || 13, lead = L * 0.12;
    const pts = [[ax, ay], [ax + dx * lead, ay + dy * lead]];
    const n = 6, inner = L - 2 * lead;
    for (let i = 0; i < n; i++) {
      const t = lead + inner * (i + 0.5) / n, s = i % 2 ? -1 : 1;
      pts.push([ax + dx * t + nx * amp * s, ay + dy * t + ny * amp * s]);
    }
    pts.push([bx - dx * lead, by - dy * lead], [bx, by]);
    const gid = 'grad-' + sim.uid + '-' + c.id;
    const grad = svgEl('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: ax, y1: ay, x2: bx, y2: by }, sim.defs);
    const s1 = svgEl('stop', { offset: '0.12' }, grad), s2 = svgEl('stop', { offset: '0.88' }, grad);
    const halo = svgEl('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#fff', 'stroke-width': 9, 'stroke-linejoin': 'round' }, g);
    const body = svgEl('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: `url(#${gid})`, 'stroke-width': 4.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    const soot = svgEl('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#2a211c', 'stroke-width': 6, 'stroke-linejoin': 'round', opacity: 0 }, g);
    if (c.variable) {
      const cx = (ax + bx) / 2, cy = (ay + by) / 2, h = inner * 0.62;
      const p0 = [cx - dx * h / 2 + nx * h * 0.55, cy - dy * h / 2 + ny * h * 0.55], p1 = [cx + dx * h / 2 - nx * h * 0.55, cy + dy * h / 2 - ny * h * 0.55];
      svgEl('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], stroke: NAVY, 'stroke-width': 2.4 }, g);
      const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      const hp = (a) => [p1[0] - 11 * Math.cos(ang + a), p1[1] - 11 * Math.sin(ang + a)];
      svgEl('polygon', { points: [p1, hp(0.42), hp(-0.42)].map(p => p.join(',')).join(' '), fill: NAVY }, g);
    }
    return {
      g, pins: { a: c.a, b: c.b }, path: pts, k: 0.62, center: [(ax + bx) / 2, (ay + by) / 2],
      box: [Math.min(ax, bx) - (dx ? 0 : amp + 8), Math.min(ay, by) - (dy ? 0 : amp + 8), Math.abs(bx - ax) + (dx ? 0 : 2 * amp + 16), Math.abs(by - ay) + (dy ? 0 : 2 * amp + 16)],
      update(sol, sim) {
        const va = sol.V[c.nodes[0]] ?? 0, vb = sol.V[c.nodes[1]] ?? 0, on = sim.power;
        s1.setAttribute('stop-color', on ? vColor(va, sol.vmax) : NAVY);
        s2.setAttribute('stop-color', on ? vColor(vb, sol.vmax) : NAVY);
        const dmg = sim.damage[c.id];
        soot.setAttribute('opacity', dmg ? 0.9 : 0);
        const show = sol.comp[c.id] && sol.comp[c.id].show;
        g.style.display = show === 'hidden' ? 'none' : '';
        g.style.opacity = show === 'ghost' ? 0.25 : show === 'disc' ? 0.35 : 1;
      },
    };
  },
  /* diodo / Zener / LED: a = anodo, k = catodo (triângulo aponta para k) */
  diode(c, sim, root) {
    const g = svgEl('g', { class: 'comp' }, root);
    const [ax, ay] = c.a, [kx, ky] = c.k, L = Math.hypot(kx - ax, ky - ay);
    const dx = (kx - ax) / L, dy = (ky - ay) / L, nx = -dy, ny = dx, w = c.w || 36;
    const tri = svgEl('polygon', {
      points: [[ax + nx * w / 2, ay + ny * w / 2], [ax - nx * w / 2, ay - ny * w / 2], [kx, ky]].map(p => p.join(',')).join(' '),
      fill: NAVY, stroke: NAVY, 'stroke-width': 2.4, 'stroke-linejoin': 'round',
    }, g);
    let barPts;
    if (c.kind === 'zener') {
      barPts = [[kx + nx * w / 2 - dx * 8, ky + ny * w / 2 - dy * 8], [kx + nx * w / 2, ky + ny * w / 2], [kx - nx * w / 2, ky - ny * w / 2], [kx - nx * w / 2 + dx * 8, ky - ny * w / 2 + dy * 8]];
    } else barPts = [[kx + nx * w / 2, ky + ny * w / 2], [kx - nx * w / 2, ky - ny * w / 2]];
    const bar = svgEl('polyline', { points: barPts.map(p => p.join(',')).join(' '), fill: 'none', stroke: NAVY, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    // fissura (aparece quando queima)
    const cx = (ax + kx) / 2, cy = (ay + ky) / 2;
    const crack = svgEl('polyline', {
      points: [[cx - nx * 22 - dx * 10, cy - ny * 22 - dy * 10], [cx - nx * 8 + dx * 4, cy - ny * 8 + dy * 4], [cx + nx * 2 - dx * 6, cy + ny * 2 - dy * 6], [cx + nx * 12 + dx * 6, cy + ny * 12 + dy * 6], [cx + nx * 24 - dx * 2, cy + ny * 24 - dy * 2]].map(p => p.join(',')).join(' '),
      fill: 'none', stroke: '#fff', 'stroke-width': 3, opacity: 0,
    }, g);
    // LED: setas de emissão
    let rays = null;
    if (c.kind === 'led') {
      rays = svgEl('g', {}, g);
      for (const off of [-0.18, 0.22]) {
        const bx = cx + nx * (w * 0.75) + dx * L * off, by = cy + ny * (w * 0.75) + dy * L * off;
        const ex = bx + (nx + dx * 0.6) * 22, ey = by + (ny + dy * 0.6) * 22;
        svgEl('line', { x1: bx, y1: by, x2: ex, y2: ey, stroke: NAVY, 'stroke-width': 2.2 }, rays);
        const ang = Math.atan2(ey - by, ex - bx), hp = a => [ex - 8 * Math.cos(ang + a), ey - 8 * Math.sin(ang + a)];
        svgEl('polygon', { points: [[ex, ey], hp(0.45), hp(-0.45)].map(p => p.join(',')).join(' '), fill: NAVY }, rays);
      }
    }
    const hit = svgEl('rect', { x: Math.min(ax, kx) - w / 2 - 6, y: Math.min(ay, ky) - w / 2 - 6, width: Math.abs(kx - ax) + w + 12, height: Math.abs(ky - ay) + w + 12, fill: 'transparent', class: c.zoom ? 'zoomable' : '' }, g);
    if (c.zoom) hit.addEventListener('click', () => { if (!sim.vm) sim.openZoom(c.id); });
    return {
      g, pins: { a: c.a, k: c.k }, path: [c.a, c.k], k: 1, junction: [cx, cy], center: [cx, cy], normal: [nx, ny], tri,
      box: [Math.min(ax, kx) - w / 2 - 6, Math.min(ay, ky) - w / 2 - 6, Math.abs(kx - ax) + w + 12, Math.abs(ky - ay) + w + 12],
      update(sol, sim) {
        const st = sol.comp[c.id] || {};
        g.style.display = st.show === 'hidden' ? 'none' : '';
        g.classList.toggle('ghost', st.show === 'ghost');
        const dmg = sim.damage[c.id], th = sim.thermal[c.id];
        let fill = NAVY;
        if (dmg) fill = '#4a4a4a';
        else if (th && th.h > 0.55) fill = rgb(heatRGB(th.h));
        tri.setAttribute('fill', fill); tri.setAttribute('stroke', dmg ? '#2b2b2b' : fill);
        bar.setAttribute('stroke', dmg ? '#2b2b2b' : NAVY);
        crack.setAttribute('opacity', dmg ? 1 : 0);
      },
    };
  },
  /* chave: a = pino (topo), b = terra; fechada quando sol.comp[id].closed */
  switch(c, sim, root) {
    const g = svgEl('g', { class: 'comp' }, root);
    const [ax, ay] = c.a, [bx, by] = c.b, L = by - ay;
    svgEl('circle', { cx: ax, cy: ay, r: 4.5, fill: '#fff', stroke: NAVY, 'stroke-width': 2.4 }, g);
    svgEl('circle', { cx: bx, cy: by, r: 4.5, fill: NAVY }, g);
    const blade = svgEl('line', { x1: bx, y1: by, x2: ax, y2: ay, stroke: NAVY, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g);
    const hit = svgEl('rect', { x: ax - 18, y: ay - 10, width: 36, height: L + 20, fill: 'transparent', style: 'cursor:pointer' }, g);
    if (c.onClick) hit.addEventListener('click', () => { if (!sim.vm) c.onClick(sim); });
    return {
      g, pins: { a: c.a, b: c.b }, path: [c.a, c.b], k: 1, center: [ax, (ay + by) / 2],
      box: [ax - 18, ay - 8, 36, L + 16],
      update(sol) {
        const closed = !!(sol.comp[c.id] && sol.comp[c.id].closed);
        const ang = closed ? 0 : -0.55, ex = bx + Math.sin(ang) * L, ey = by - Math.cos(ang) * L;
        blade.setAttribute('x2', ex); blade.setAttribute('y2', ey);
      },
    };
  },
  /* módulo (caixa) entre a (topo) e b (base) */
  module(c, sim, root) {
    const g = svgEl('g', { class: 'comp' }, root);
    const [ax, ay] = c.a, [bx, by] = c.b, w = c.w || 76;
    const rect = svgEl('rect', { x: ax - w / 2, y: ay, width: w, height: by - ay, rx: 10, fill: '#EEF3FA', stroke: NAVY, 'stroke-width': 2.6 }, g);
    (c.lines || []).forEach((t, i, arr) => {
      const te = svgEl('text', { x: ax, y: (ay + by) / 2 + (i - (arr.length - 1) / 2) * 20 + 6, class: i === 0 ? 'nm small' : 'val small', 'text-anchor': 'middle' }, g);
      svgRich(te, t);
    });
    return {
      g, pins: { a: c.a, b: c.b }, path: [c.a, c.b], k: 0.7, hideInside: true, center: [ax, (ay + by) / 2],
      box: [ax - w / 2 - 6, ay - 6, w + 12, by - ay + 12],
      update(sol) {
        const st = sol.comp[c.id] || {};
        g.style.display = st.show === 'hidden' ? 'none' : '';
        g.style.opacity = st.show === 'disc' ? 0.35 : 1;
        rect.setAttribute('stroke-dasharray', st.show === 'disc' ? '6 5' : '');
      },
    };
  },
};
/* cor de aquecimento (h = 0 frio … 1 limite) */
function heatRGB(h) {
  h = clamp(h, 0, 1.2);
  if (h < 0.7) return [Math.round(lerp(31, 232, h / 0.7)), Math.round(lerp(45, 119, h / 0.7)), Math.round(lerp(77, 46, h / 0.7))];
  return [Math.round(lerp(232, 214, (h - 0.7) / 0.5)), Math.round(lerp(119, 40, (h - 0.7) / 0.5)), Math.round(lerp(46, 30, (h - 0.7) / 0.5))];
}

/* sprites das partículas (pré-renderizados para desempenho) */
function makeSprite(core, glow) {
  const s = document.createElement('canvas'); s.width = s.height = 48;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(24, 24, 2, 24, 24, 23);
  g.addColorStop(0, glow.replace('A', '0.75')); g.addColorStop(0.35, glow.replace('A', '0.35')); g.addColorStop(1, glow.replace('A', '0'));
  c.fillStyle = g; c.beginPath(); c.arc(24, 24, 23, 0, 7); c.fill();
  c.fillStyle = core; c.strokeStyle = 'rgba(31,45,77,0.65)'; c.lineWidth = 2.2;
  c.beginPath(); c.arc(24, 24, 8.5, 0, 7); c.fill(); c.stroke();
  return s;
}
const SPRITE = {
  conv: makeSprite('#FFE14D', 'rgba(255,200,40,A)'),
  elec: makeSprite('#39C8FF', 'rgba(40,170,255,A)'),
};

let SIM_UID = 0;
class Sim {
  constructor(stage, cfg, opts = {}) {
    this.uid = ++SIM_UID;
    this.cfg = cfg; this.el = stage;
    this.p = Object.assign({}, cfg.defaults, opts.params || {});
    this.power = opts.power !== undefined ? opts.power : true;
    this.paused = false; this.slow = false; this.electrons = false;
    this.view = 'sch'; this.vm = false; this.values = 'all'; this.highlights = [];
    this.damage = {}; this.failures = []; this.thermal = {};
    this.particles = []; this.relP = []; this.fx = []; this.relAcc = 0;
    this.ramp = this.power ? 1 : 0; this.t = 0;
    this.probes = [null, null]; this.listeners = [];
    this.buildDOM(); if (cfg.onBuild) cfg.onBuild(this); this.buildEdges(); this.solve(); this.warm(); this._built = true;
  }

  /* ================= construção do DOM ================= */
  buildDOM() {
    const [W, H] = this.cfg.viewBox, el = this.el;
    el.innerHTML = '';
    const svg = this.svg = svgEl('svg', { class: 'sch', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' }, el);
    this.defs = svgEl('defs', {}, svg);
    // gradiente da legenda de potencial
    const lg = svgEl('linearGradient', { id: 'vleg-' + this.uid }, this.defs);
    VMAP.forEach(([t, c]) => svgEl('stop', { offset: t, 'stop-color': rgb(c) }, lg));
    this.gWires = svgEl('g', {}, svg);
    this.gComps = svgEl('g', {}, svg);
    this.gDeco = svgEl('g', {}, svg);
    this.gVals = svgEl('g', {}, svg);
    this.gHi = svgEl('g', {}, svg);
    this.gMeter = svgEl('g', { class: 'meter-g' }, svg);
    this.gLegend = svgEl('g', { class: 'legend-g' }, svg);
    this.rsvg = svgEl('svg', { class: 'relevo', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' }, el);
    this.canvas = document.createElement('canvas'); el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    // dica de potencial ao passar o mouse
    this.tip = document.createElement('div'); this.tip.className = 'tip'; el.appendChild(this.tip);
    // caixa de falha
    this.failbox = document.createElement('div'); this.failbox.className = 'failbox'; el.appendChild(this.failbox);
    // botão grande "LIGAR A FONTE"
    this.cta = document.createElement('button'); this.cta.className = 'power-cta';
    this.cta.innerHTML = ICON.power + '<span>LIGAR A FONTE</span>';
    this.cta.addEventListener('click', () => { this.setPower(true); this.emit('cta'); });
    el.appendChild(this.cta);

    const cfg = this.cfg;
    // fios (cor = potencial do nó)
    this.wires = cfg.wires.map(w => {
      const d = 'M' + w.pts.map(p => p.join(',')).join('L');
      const path = svgEl('path', { d, fill: 'none', stroke: NAVY, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.gWires);
      return Object.assign({ el: path }, w);
    });
    // componentes
    this.comps = {};
    for (const id in cfg.comps) {
      const c = Object.assign({ id }, cfg.comps[id]);
      const fn = COMPS[c.type === 'zener' || c.type === 'led' ? 'diode' : c.type];
      if (c.type === 'zener' || c.type === 'led') c.kind = c.type;
      this.comps[id] = Object.assign(fn(c, this, this.gComps), { def: c });
    }
    // pontos de junção e terminais
    (cfg.dots || []).forEach(p => svgEl('circle', { cx: p[0], cy: p[1], r: 6.5, fill: NAVY }, this.gComps));
    (cfg.terms || []).forEach(p => svgEl('circle', { cx: p[0], cy: p[1], r: 8, fill: '#fff', stroke: NAVY, 'stroke-width': 3 }, this.gComps));
    // setas de corrente (referência, como na figura)
    (cfg.arrows || []).forEach(a => {
      const g = svgEl('g', {}, this.gDeco);
      svgEl('line', { x1: a.a[0], y1: a.a[1], x2: a.b[0], y2: a.b[1], stroke: ORANGE, 'stroke-width': 2.6 }, g);
      const ang = Math.atan2(a.b[1] - a.a[1], a.b[0] - a.a[0]), hp = s => [a.b[0] - 11 * Math.cos(ang + s), a.b[1] - 11 * Math.sin(ang + s)];
      svgEl('polygon', { points: [a.b, hp(0.42), hp(-0.42)].map(p => p.join(',')).join(' '), fill: ORANGE }, g);
      if (a.t) { const t = svgEl('text', { x: a.tx, y: a.ty, class: 'nm', 'text-anchor': a.anchor || 'middle' }, g); svgRich(t, a.t); }
    });
    // rótulos estáticos/dinâmicos
    this.labels = (cfg.labels || []).map(L => {
      const t = svgEl('text', { x: L.x, y: L.y, class: L.cls || 'val', 'text-anchor': L.anchor || 'start' }, this.gDeco);
      if (typeof L.t === 'string') svgRich(t, L.t);
      return Object.assign({ el: t }, L);
    });
    // pílulas de valor (correntes, tensões)
    this.vals = (cfg.values || []).map(V => {
      const g = svgEl('g', { class: 'vpill' }, this.gVals);
      const r = svgEl('rect', { rx: 9, height: 30, fill: '#fff', stroke: ORANGE, 'stroke-width': 2 }, g);
      const t = svgEl('text', { x: V.x, y: V.y, class: 'pv', 'text-anchor': V.anchor || 'middle' }, g);
      return Object.assign({ g, r, t }, V);
    });
    // pílulas de estado e barras P/Pmáx
    this.pills = (cfg.pills || []).map(P => {
      const g = svgEl('g', {}, this.gVals);
      const r = svgEl('rect', { rx: 12, height: 26, x: P.x, y: P.y - 19 }, g);
      const t = svgEl('text', { x: P.x + 10, y: P.y, class: 'pst' }, g);
      return Object.assign({ g, r, t }, P);
    });
    this.bars = (cfg.bars || []).map(B => {
      const g = svgEl('g', {}, this.gVals);
      const lab = svgEl('text', { x: B.x, y: B.y - 8, class: 'small strong' }, g); svgRich(lab, B.label);
      svgEl('rect', { x: B.x, y: B.y, width: B.w, height: 11, rx: 5.5, fill: '#E8EDF5' }, g);
      const f = svgEl('rect', { x: B.x, y: B.y, width: 0, height: 11, rx: 5.5 }, g);
      svgEl('line', { x1: B.x + B.w / 1.25, y1: B.y - 4, x2: B.x + B.w / 1.25, y2: B.y + 15, stroke: NAVY, 'stroke-width': 1.6 }, g);
      const t = svgEl('text', { x: B.x, y: B.y + 32, class: 'small' }, g);
      const tt = svgEl('text', { x: B.x, y: B.y + 54, class: 'small hot' }, g);
      return Object.assign({ g, f, t, tt }, B);
    });
    // desconexão: lacuna no fio
    this.discs = (cfg.discs || []).map(D => {
      const g = svgEl('g', { style: 'display:none' }, this.gVals);
      const [x, y] = D.at;
      svgEl('rect', { x: x - 14, y: y - 22, width: 28, height: 44, fill: '#fff' }, g);
      svgEl('rect', { x: x - 9, y: y - 22, width: 18, height: 10, rx: 2, fill: NAVY }, g);
      svgEl('rect', { x: x - 9, y: y + 12, width: 18, height: 10, rx: 2, fill: NAVY }, g);
      const t = svgEl('text', { x: x + 18, y: y + 6, class: 'small strong warnc' }, g); t.textContent = D.text || 'desconectado';
      return Object.assign({ g }, D);
    });
    // legenda (potencial + partículas)
    const LG = cfg.legendAt || [24, H - 30];
    const lt0 = svgEl('text', { x: LG[0], y: LG[1] + 6, class: 'small' }, this.gLegend); lt0.textContent = '0 V';
    svgEl('rect', { x: LG[0] + 34, y: LG[1] - 5, width: 150, height: 12, rx: 6, fill: `url(#vleg-${this.uid})` }, this.gLegend);
    this.legMax = svgEl('text', { x: LG[0] + 192, y: LG[1] + 6, class: 'small' }, this.gLegend);
    this.legDot = svgEl('circle', { cx: LG[0] + 268, cy: LG[1] + 1, r: 7, stroke: 'rgba(31,45,77,.6)', 'stroke-width': 1.5 }, this.gLegend);
    this.legTxt = svgEl('text', { x: LG[0] + 282, y: LG[1] + 6, class: 'small' }, this.gLegend);
    // multímetro virtual
    this.buildMeter();
    // interações
    this.bindPointer();
    this.resize();
  }

  buildMeter() {
    const [mx, my] = this.cfg.meterAt || [this.cfg.viewBox[0] - 210, this.cfg.viewBox[1] - 110];
    const g = this.gMeter; g.style.display = 'none';
    this.leadR = svgEl('path', { fill: 'none', stroke: '#E0342B', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g);
    this.leadK = svgEl('path', { fill: 'none', stroke: '#111', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g);
    svgEl('rect', { x: mx, y: my, width: 196, height: 96, rx: 14, fill: '#263354' }, g);
    svgEl('rect', { x: mx + 10, y: my + 10, width: 176, height: 46, rx: 6, fill: '#CFE3C8' }, g);
    this.lcd = svgEl('text', { x: mx + 178, y: my + 46, class: 'lcd', 'text-anchor': 'end' }, g);
    const tl = svgEl('text', { x: mx + 12, y: my + 80, class: 'small mtr' }, g); tl.textContent = 'V(vermelha) − V(preta)';
    this.jackR = [mx + 150, my + 96]; this.jackK = [mx + 176, my + 96];
    this.probeEls = [0, 1].map(i => {
      const pg = svgEl('g', { class: 'probe', style: 'display:none;cursor:grab' }, g);
      svgEl('circle', { r: 13, fill: i ? '#111' : '#E0342B', stroke: '#fff', 'stroke-width': 3 }, pg);
      const t = svgEl('text', { y: 5, class: 'ptxt', 'text-anchor': 'middle' }, pg); t.textContent = i ? '−' : '+';
      return pg;
    });
  }

  /* ================= arestas (ramos) e grafo de nós ================= */
  buildEdges() {
    this.edges = []; this.verts = {};
    for (const E of this.cfg.edges) {
      const pts = [], ks = [], vis = [], junctions = [];
      const push = (pt, k, v = true) => { const last = pts[pts.length - 1]; if (last && dist(last, pt) < 0.01) return; if (pts.length) { ks.push(k); vis.push(v); } pts.push(pt); };
      for (const it of E.path) {
        if (Array.isArray(it)) { push(it, 1); continue; }
        const c = this.comps[it.comp];
        const ip = c.path.slice(); if (it.rev) ip.reverse();
        ip.forEach((pt, i) => push(pt, i === 0 ? 1 : c.k, i === 0 ? true : !c.hideInside));
        if (c.junction) junctions.push({ comp: it.comp, pt: c.junction });
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
      const e = Object.assign({}, E, { pts, ks, vis, cum, len: cum[cum.length - 1], n0: ptKey(pts[0]), n1: ptKey(pts[pts.length - 1]), I: 0, Icur: 0, v: 0, acc: 0 });
      e.junctions = junctions.map(j => ({ comp: j.comp, s: this.projectS(e, j.pt) }));
      this.edges.push(e);
      for (const k of [e.n0, e.n1]) { (this.verts[k] = this.verts[k] || { edges: [], credit: {} }).edges.push(e); }
    }
    this.idle = this.cfg.wires.filter(w => w.idle).map(w => {
      const cum = [0]; for (let i = 1; i < w.pts.length; i++) cum.push(cum[i - 1] + dist(w.pts[i - 1], w.pts[i]));
      return Object.assign({ cum, len: cum[cum.length - 1] }, w);
    });
  }
  projectS(e, pt) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < e.pts.length - 1; i++) {
      const a = e.pts[i], b = e.pts[i + 1], L = e.cum[i + 1] - e.cum[i];
      const t = clamp(((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / (L * L || 1), 0, 1);
      const q = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], d = dist(q, pt);
      if (d < bd) { bd = d; best = e.cum[i] + t * L; }
    }
    return best;
  }
  posAt(e, s) {
    let i = 0; while (i < e.cum.length - 2 && s > e.cum[i + 1]) i++;
    const L = e.cum[i + 1] - e.cum[i] || 1, t = (s - e.cum[i]) / L, a = e.pts[i], b = e.pts[i + 1];
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), (b[0] - a[0]) / L, (b[1] - a[1]) / L, e.vis ? e.vis[i] !== false : true];
  }

  /* ================= solver e aplicação do resultado ================= */
  solve() {
    const p = Object.assign({}, this.p, { power: this.power, damage: this.damage });
    const srcWasZero = !this.edges.some(e => e.spawn && Math.abs(e.I) > 1e-9);
    this.sol = this.cfg.solve(p);
    this.applyCurrents();
    // o circuito estava sem corrente e voltou a conduzir: os portadores já estão
    // nos fios e começam a se mover juntos (não "chegam" a partir da fonte)
    if (srcWasZero && this.power && this.edges.some(e => e.spawn && Math.abs(e.I) > 1e-9) && this._built) this.warm();
    this.applySolution();
    this.checkInstant();
    this.emit('change');
  }
  applyCurrents(sol = this.sol) {
    for (const e of this.edges) {
      e.I = sol.I[e.cur] || 0;
      const dep = e.dep && sol.comp[e.dep];
      e.hidden = !!(dep && dep.show && dep.show !== 'on');
      if (e.ifHidden) e.hidden = !(sol.comp[e.ifHidden] && sol.comp[e.ifHidden].show === 'hidden');
      if (e.hidden) e.I = 0;
    }
  }
  on(fn) { this.listeners.push(fn); }
  emit(ev) { this.listeners.forEach(f => f(ev, this)); }
  set(params) { Object.assign(this.p, params); this.solve(); }

  applySolution() {
    const sol = this.sol, vmax = sol.vmax, on = this.power;
    for (const w of this.wires) {
      const v = sol.V[w.node] ?? 0;
      w.el.setAttribute('stroke', on ? vColor(v, vmax) : NAVY);
      const carry = w.cur ? Math.abs(sol.I[w.cur] || 0) > 1e-9 : false;
      w.el.setAttribute('opacity', !on ? 0.9 : (carry ? 1 : 0.38));
      const dep = w.dep && sol.comp[w.dep];
      let hide = dep && dep.show === 'hidden';
      if (w.ifHidden) hide = !(sol.comp[w.ifHidden] && sol.comp[w.ifHidden].show === 'hidden');
      if (w.when) hide = hide || !w.when(this.p, sol);
      w.el.style.display = hide ? 'none' : '';
    }
    for (const id in this.comps) this.comps[id].update(sol, this);
    for (const L of this.labels) {
      if (typeof L.t === 'function') svgRich(L.el, L.t(this.p, sol));
      if (L.when) L.el.style.display = L.when(this.p, sol) ? '' : 'none';
    }
    this.layoutValues();
    for (const P of this.pills) {
      const st = sol.comp[P.comp] && sol.comp[P.comp].pill;
      P.g.style.display = st && this.showVal(P.comp + ':pill') ? '' : 'none';
      if (!st) continue;
      svgRich(P.t, st.text);
      const pal = { on: ['#DDF1E5', '#1D7A45'], off: ['#FDECEA', '#B22E24'], warn: ['#FFF1D6', '#8F620A'], mute: ['#EEF1F6', '#5A6680'], bad: ['#C9362A', '#fff'] }[st.kind || 'mute'];
      P.r.setAttribute('fill', pal[0]); P.t.setAttribute('fill', pal[1]);
      const w = this.textW(P.t, st.text.length * 10);
      P.r.setAttribute('width', w + 20);
    }
    for (const B of this.bars) {
      const st = sol.comp[B.comp] || {};
      const show = (st.Pmax || st.bar) && this.showVal(B.comp + ':bar') && st.show !== 'hidden' && st.show !== 'ghost';
      B.g.style.display = show ? '' : 'none';
      if (!show) continue;
      const bv = st.bar ? st.bar.v : (st.P || 0), bm = st.bar ? st.bar.max : st.Pmax, bf = st.bar ? st.bar.fmt : fP;
      const r = on ? bv / bm : 0;
      B.f.setAttribute('width', Math.max(0, Math.min(r, 1.25) / 1.25 * B.w));
      B.f.setAttribute('fill', ratioColor(r));
      svgRich(B.t, `${bf(on ? bv : 0)} · ${fPct(r)}`);
    }
    for (const D of this.discs) D.g.style.display = (sol.comp[D.comp] && sol.comp[D.comp].show === 'disc') ? '' : 'none';
    // legenda
    this.legMax.textContent = fV(vmax, vmax < 10 ? 1 : 0).replace(',0 V', ' V');
    this.legDot.setAttribute('fill', this.electrons ? '#39C8FF' : '#FFE14D');
    this.legTxt.textContent = this.electrons ? 'fluxo de elétrons (− → +)' : 'sentido convencional (+ → −)';
    this.drawHighlights();
    if (this.cfg.onUpdate) this.cfg.onUpdate(this);
    this.updateMeter();
    if (this.view === 'relevo') this.drawRelevo();
  }
  showVal(id) {
    if (this.values === 'all') return true;
    if (this.values === 'none') return /:pill$/.test(id) ? false : false;
    return this.values.includes(id) || this.values.includes(id.split(':')[0] + ':*');
  }
  textW(t, fallback) { try { const w = t.getComputedTextLength(); return w > 0 ? w : fallback; } catch (e) { return fallback; } }
  layoutValues() {
    const sol = this.sol;
    for (const V of this.vals) {
      const show = this.power && this.showVal(V.id) && (!V.when || V.when(sol, this.p));
      V.g.style.display = show ? '' : 'none';
      if (!show) continue;
      const txt = V.fn(sol, this.p);
      svgRich(V.t, txt);
      const w = this.textW(V.t, txt.length * 11.5) + 18;
      const x0 = V.anchor === 'end' ? V.x - w + 9 : V.anchor === 'start' ? V.x - 9 : V.x - w / 2;
      V.r.setAttribute('x', x0); V.r.setAttribute('y', V.y - 21); V.r.setAttribute('width', w);
      const zero = V.cur && Math.abs(sol.I[V.cur] || 0) < 1e-9;
      V.r.setAttribute('stroke', zero ? '#B8C0D0' : ORANGE);
      V.t.setAttribute('fill', zero ? '#7D879E' : NAVY);
    }
  }
  drawHighlights() {
    this.gHi.innerHTML = '';
    for (const id of this.highlights) {
      const c = this.comps[id]; if (!c) continue;
      const [x, y, w, h] = c.box;
      svgEl('rect', { x: x - 8, y: y - 8, width: w + 16, height: h + 16, rx: 14, fill: 'rgba(232,119,46,.08)', stroke: ORANGE, 'stroke-width': 3, 'stroke-dasharray': '8 6', class: 'hi' }, this.gHi);
    }
  }

  /* ================= estado da cena (vindo das etapas) ================= */
  setScene(sc = {}) {
    if (sc.params) Object.assign(this.p, sc.params);
    if ('values' in sc) this.values = sc.values; else this.values = 'all';
    this.highlights = sc.highlight || [];
    if (sc.view) this.setView(sc.view);
    if ('power' in sc) { this.power = sc.power; this.ramp = sc.power ? Math.max(this.ramp, 0.0) : this.ramp; }
    if (sc.probes) { this.setVM(true); this.probes = sc.probes.map(n => n ? this.nodePoint(n) : null); }
    else if (sc.probes === null || sc.vm === false) { this.setVM(false); }
    if (sc.resetDamage !== false) { this.damage = {}; this.failures = []; this.thermalReset(); this.fx = []; this.showFail(); }
    this.el.classList.toggle('show-cta', !this.power && !!sc.cta);
    this.solve();
    this.syncTools();
  }
  nodePoint(node) {
    const pref = (this.cfg.probePoints || {})[node];
    if (pref) return { node, x: pref[0], y: pref[1] };
    const w = this.wires.find(w => w.node === node);
    const p = w.pts[w.pts.length - 1];
    return { node, x: p[0], y: p[1] };
  }

  /* ================= controles ================= */
  setPower(on) {
    this.power = on;
    if (on && !this.particles.length) this.warm();
    this.el.classList.toggle('show-cta', false);
    if (!on) { this.thermalReset(); }
    this.solve(); this.syncTools();
  }
  setView(v) {
    this.view = v; this.el.classList.toggle('view-relevo', v === 'relevo');
    this.el.classList.toggle('view-alt', !!(this.cfg.altViews && this.cfg.altViews[v]));
    this.relP = []; if (v === 'relevo') this.drawRelevo(); this.syncTools();
  }
  setVM(on) { this.vm = on; this.el.classList.toggle('vm', on); this.gMeter.style.display = on ? '' : 'none'; if (on && !this.probes[0]) { const n = this.cfg.meterDefault || []; this.probes = n.map(x => this.nodePoint(x)); } this.updateMeter(); this.syncTools(); }
  syncTools() { if (this.toolbar) this.toolbar.sync(); }
  thermalReset() { for (const k in this.thermal) { this.thermal[k].T = 25; this.thermal[k].h = 0; } }

  /* ================= multímetro ================= */
  updateMeter() {
    if (!this.vm) return;
    const sol = this.sol;
    this.probes.forEach((p, i) => {
      const el = this.probeEls[i];
      if (!p) { el.style.display = 'none'; return; }
      el.style.display = ''; el.setAttribute('transform', `translate(${p.x},${p.y})`);
      const j = i ? this.jackK : this.jackR, lead = i ? this.leadK : this.leadR;
      const my = Math.max(j[1], p.y) + 60;
      lead.setAttribute('d', `M${j[0]},${j[1]} C${j[0]},${my} ${p.x},${my} ${p.x},${p.y + 12}`);
    });
    if (!this.probes[1]) this.leadK.setAttribute('d', ''); if (!this.probes[0]) this.leadR.setAttribute('d', '');
    let txt = '— — —';
    if (this.probes[0] && this.probes[1]) {
      const v = this.power ? (sol.V[this.probes[0].node] ?? 0) - (sol.V[this.probes[1].node] ?? 0) : 0;
      txt = num(v, 2) + ' V';
    }
    this.lcd.textContent = txt;
  }
  nearestWire(pt, maxD = 26) {
    let best = null;
    const test = (w) => {
      for (let i = 0; i < w.pts.length - 1; i++) {
        const a = w.pts[i], b = w.pts[i + 1], L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
        const t = clamp(((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / L2, 0, 1);
        const q = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], d = dist(q, pt);
        if (d < maxD && (!best || d < best.d)) best = { node: w.node, x: q[0], y: q[1], d };
      }
    };
    this.wires.forEach(w => { if (w.el.style.display !== 'none') test(w); });
    return best;
  }
  toVB(ev) {
    const m = this.svg.getScreenCTM(); if (!m) return [0, 0];
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  bindPointer() {
    let drag = -1;
    const svg = this.svg;
    svg.addEventListener('pointerdown', ev => {
      if (!this.vm) return;
      const pt = this.toVB(ev);
      // arrastar uma ponteira existente?
      for (let i = 0; i < 2; i++) { const p = this.probes[i]; if (p && dist([p.x, p.y], pt) < 22) { drag = i; svg.setPointerCapture(ev.pointerId); ev.preventDefault(); return; } }
      const w = this.nearestWire(pt, 40); if (!w) return;
      let i = !this.probes[0] ? 0 : !this.probes[1] ? 1 : (dist([this.probes[0].x, this.probes[0].y], pt) < dist([this.probes[1].x, this.probes[1].y], pt) ? 0 : 1);
      this.probes[i] = w; this.updateMeter(); drag = i; svg.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    svg.addEventListener('pointermove', ev => {
      const pt = this.toVB(ev);
      if (drag >= 0) { const w = this.nearestWire(pt, 60); if (w) { this.probes[drag] = w; this.updateMeter(); } return; }
      const w = this.power ? this.nearestWire(pt, 14) : null;
      if (w && this.view === 'sch') {
        const r = this.el.getBoundingClientRect();
        this.tip.style.display = 'block';
        this.tip.style.left = (ev.clientX - r.left) + 'px'; this.tip.style.top = (ev.clientY - r.top) + 'px';
        this.tip.textContent = `V = ${fV(this.sol.V[w.node] ?? 0)}`;
      } else this.tip.style.display = 'none';
    });
    svg.addEventListener('pointerleave', () => { this.tip.style.display = 'none'; });
    const end = () => { drag = -1; };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  }

  /* ================= relevo de tensão ================= */
  drawRelevo() {
    const R = this.cfg.relevo; if (!R) return;
    const svg = this.rsvg, sol = this.sol, [W, H] = this.cfg.viewBox;
    svg.innerHTML = '';
    const defs = svgEl('defs', {}, svg);
    const vmax = sol.vmax, base = H - 110, top = 70, yv = v => base - (v / vmax) * (base - top);
    const gid = 'rg-' + this.uid;
    const gr = svgEl('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: yv(0), x2: 0, y2: yv(vmax) }, defs);
    VMAP.forEach(([t, c]) => svgEl('stop', { offset: t, 'stop-color': rgb(c) }, gr));
    const segs = R.segs(this.p, sol);
    const wts = { rise: 0.75, drop: 1.15, flat: 1.5 };
    const total = segs.reduce((s, g) => s + (g.w || wts[g.kind]), 0);
    const x0 = 70, x1 = W - 70;
    let x = x0, v = 0; const pts = [], ks = [], marks = [];
    pts.push([x, yv(0)]);
    for (const s of segs) {
      const w = (s.w || wts[s.kind]) / total * (x1 - x0);
      const v2 = s.kind === 'flat' ? v : s.to;
      const xa = x, xb = x + w;
      if (s.kind === 'flat') { pts.push([xb, yv(v)]); ks.push(1); }
      else { pts.push([xb, yv(v2)]); ks.push(0.55); }
      marks.push({ s, xa, xb, va: v, vb: v2 });
      x = xb; v = v2;
    }
    this.relPath = (() => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i])); return { pts, ks, cum, len: cum[cum.length - 1] }; })();
    // área preenchida e grade
    for (let gv = 0; gv <= vmax + 1e-9; gv += (vmax > 20 ? 5 : vmax > 8 ? 2 : 1)) {
      svgEl('line', { x1: x0 - 10, x2: x1, y1: yv(gv), y2: yv(gv), stroke: '#E8EDF5', 'stroke-width': 1.5 }, svg);
      const t = svgEl('text', { x: x0 - 16, y: yv(gv) + 6, class: 'small', 'text-anchor': 'end' }, svg); t.textContent = num(gv, 0) + ' V';
    }
    const area = 'M' + pts.map(p => p.join(',')).join('L') + `L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`;
    svgEl('path', { d: area, fill: `url(#${gid})`, opacity: 0.22 }, svg);
    svgEl('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: `url(#${gid})`, 'stroke-width': 9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    svgEl('line', { x1: x0, x2: x1, y1: base, y2: base, stroke: NAVY, 'stroke-width': 2 }, svg);
    // referência (ex.: V_Z)
    const refs = [].concat((R.ref && R.ref(this.p, sol)) || []);
    for (const ref of refs) {
      svgEl('line', { x1: x0, x2: x1, y1: yv(ref.v), y2: yv(ref.v), stroke: ORANGE, 'stroke-width': 3, 'stroke-dasharray': '12 8' }, svg);
      const t = svgEl('text', { x: x1, y: yv(ref.v) - 10, class: 'nm', 'text-anchor': 'end' }, svg); svgRich(t, ref.label);
    }
    // rótulos dos trechos
    for (const m of marks) {
      const xm = (m.xa + m.xb) / 2;
      if (m.s.kind === 'flat') {
        if (m.s.node) {
          const inside = m.va > 0.18 * vmax, low = m.va <= 0.02 * vmax;
          const t = svgEl('text', { x: xm, y: low ? yv(m.va) + 30 : inside ? yv(m.va) + 34 : yv(m.va) - 16, class: 'val strong', 'text-anchor': 'middle' }, svg);
          svgRich(t, (m.s.name ? m.s.name + ' = ' : '') + fV(m.va));
        }
      } else {
        const dv = Math.abs(m.vb - m.va);
        const ym = (yv(m.va) + yv(m.vb)) / 2;
        const g = svgEl('g', {}, svg);
        const t = svgEl('text', { x: xm + 16, y: ym + 8, class: 'nm', 'text-anchor': 'start' }, g);
        svgRich(t, m.s.kind === 'rise' ? `${m.s.label}: +${fV(dv)}` : `${m.s.label}: ${fV(dv)}`);
        if (m.s.kind === 'rise') { t.setAttribute('x', m.xb + 16); }
      }
    }
    const cap = svgEl('text', { x: x0, y: H - 40, class: 'small' }, svg);
    cap.textContent = R.caption ? R.caption(this.p, sol) : 'Altura = potencial em relação ao terra. A corrente (sentido convencional) desce o "morro" nos resistores e é elevada pela fonte.';
  }

  /* ================= falhas e aquecimento ================= */
  checkInstant() {
    const sol = this.sol;
    for (const id in sol.comp) {
      const st = sol.comp[id];
      if (st.instant && !this.damage[id] && this.power) this.fail(id, st.instant);
    }
  }
  thermalStep(dt) {
    const sol = this.sol;
    for (const id in sol.comp) {
      const st = sol.comp[id], def = this.comps[id] && this.comps[id].def;
      if (!(st.Pmax || st.ratio !== undefined) || !def) continue;
      const th = this.thermal[id] = this.thermal[id] || { T: 25, h: 0 };
      if (this.damage[id]) continue;
      if (th.jit === undefined) th.jit = 0.92 + Math.random() * 0.16;   // peças "iguais" nunca são idênticas
      const Tmax = def.Tmax || 175, tau = (def.tau || 1.3) * th.jit;
      const ratio = this.power ? (st.ratio !== undefined ? st.ratio : (st.P || 0) / st.Pmax) : 0;
      const Tss = 25 + (Tmax - 25) * ratio;
      th.T += (Tss - th.T) * (1 - Math.exp(-dt / tau));
      th.h = (th.T - 25) / (Tmax - 25);
      if (ratio > 1 && th.T >= Tmax - 0.01) { this.fail(id, st.failCause ? st.failCause : 'acima do limite'); return; }
      if (th.h > 0.9 && ratio > 1 && Math.random() < dt * 14 && !REDUCED) this.smoke(id, 0.6);
    }
  }
  fail(id, cause) {
    const c = this.comps[id], def = c.def, th = this.thermal[id];
    this.damage[id] = def.failMode || 'open';
    this.failures.push({ id, title: def.failTitle || 'Componente danificado', cause, T: th ? th.T : null });
    for (let i = 0; i < (REDUCED ? 0 : 40); i++) this.fx.push({ kind: 'spark', x: c.center[0], y: c.center[1], vx: (Math.random() - 0.5) * 520, vy: (Math.random() - 0.7) * 520, life: 0.6 + Math.random() * 0.4 });
    for (let i = 0; i < (REDUCED ? 3 : 16); i++) this.smoke(id, 1);
    this.solve();
    this.showFail();
  }
  smoke(id, k) {
    const c = this.comps[id];
    this.fx.push({ kind: 'smoke', x: c.center[0] + (Math.random() - 0.5) * 30, y: c.center[1] - 10, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 50, r: 8 + Math.random() * 8, life: 1.6 + Math.random() * k, max: 2.6 });
  }
  showFail() {
    const fb = this.failbox;
    if (!this.failures.length) { fb.classList.remove('on'); return; }
    fb.innerHTML = `<h4>${ICON.warn}<span>${this.failures.length > 1 ? 'Falhas (na ordem em que ocorreram)' : sub(this.failures[0].title)}</span></h4>` +
      this.failures.map(f => `<div>${this.failures.length > 1 ? '<b>' + sub(f.title) + '</b><br>' : ''}<div class="cause">${sub(f.cause)}</div>${f.T ? `<div>temperatura atingiu ≈ ${num(f.T, 0)} °C</div>` : ''}</div>`).join('') +
      `<button type="button">Voltar ao normal</button>`;
    fb.querySelector('button').addEventListener('click', () => { this.damage = {}; this.failures = []; this.thermalReset(); this.fx = []; fb.classList.remove('on'); this.solve(); this.emit('reset'); });
    fb.classList.add('on');
  }

  /* ================= partículas ================= */
  speedFor(I) { const Iref = this.cfg.Iref || 0.02; return 150 * Math.sqrt(Math.abs(I) / Iref); }
  fluxFor(I) { const Iref = this.cfg.Iref || 0.02; return (150 / 30) * Math.abs(I) / Iref; }
  updateEdgeKinematics() {
    const sgn = this.electrons ? -1 : 1;
    for (const e of this.edges) {
      e.Icur = this.power ? sgn * e.I : 0;
      e.v = this.speedFor(e.Icur);
    }
  }
  route(vk) {
    const V = this.verts[vk]; if (!V) return null;
    const c = [];
    for (const e of V.edges) {
      if (Math.abs(e.Icur) < 1e-9) { V.credit[e.id] = 0; continue; }
      if ((e.n0 === vk && e.Icur > 0) || (e.n1 === vk && e.Icur < 0)) c.push(e); else V.credit[e.id] = 0;
    }
    if (!c.length) return null;
    const tot = c.reduce((s, e) => s + Math.abs(e.Icur), 0);
    let best = null;
    for (const e of c) { V.credit[e.id] = (V.credit[e.id] || 0) + Math.abs(e.Icur) / tot; if (!best || V.credit[e.id] > V.credit[best.id]) best = e; }
    V.credit[best.id] -= 1;
    return best;
  }
  advance(p, dt) {
    let rem = dt, hops = 0;
    while (rem > 1e-7 && hops < 12) {
      const e = p.e, I = e.Icur;
      if (Math.abs(I) < 1e-9) return;
      const dir = I > 0 ? 1 : -1;
      let i = 0;
      if (dir > 0) { while (i < e.ks.length - 1 && p.s >= e.cum[i + 1] - 1e-9) i++; }
      else { i = e.ks.length - 1; while (i > 0 && p.s <= e.cum[i] + 1e-9) i--; }
      const v = e.v * e.ks[i] * this.ramp;
      if (v <= 1e-9) return;
      const end = dir > 0 ? e.cum[i + 1] : e.cum[i];
      const tNeed = Math.abs(end - p.s) / v;
      if (rem < tNeed) { p.s += dir * v * rem; return; }
      p.s = end; rem -= tNeed;
      const atEnd = dir > 0 ? i === e.ks.length - 1 : i === 0;
      if (atEnd) {
        const nx = this.route(dir > 0 ? e.n1 : e.n0);
        if (!nx || nx.spawn) { p.kill = true; return; }
        p.e = nx; p.s = nx.Icur > 0 ? 0 : nx.len; hops++;
      }
    }
  }
  stepParticles(dt) {
    this.updateEdgeKinematics();
    if (!this.power) return;
    for (const e of this.edges) {
      if (!e.spawn || Math.abs(e.Icur) < 1e-9) continue;
      const F = this.fluxFor(e.Icur) * this.ramp;
      e.acc += F * dt;
      let guard = 0;
      while (e.acc >= 1 && guard++ < 60) {
        e.acc -= 1;
        const p = { e, s: e.Icur > 0 ? 0 : e.len, a: 1 };
        this.advance(p, F > 0 ? e.acc / F : 0);
        if (!p.kill) this.particles.push(p);
      }
    }
    for (const p of this.particles) {
      if (Math.abs(p.e.Icur) < 1e-9 || p.e.hidden) { p.a -= dt / 0.35; continue; }
      if (p.a < 1) p.a = Math.min(1, p.a + dt / 0.3);
      this.advance(p, dt);
    }
    this.particles = this.particles.filter(p => !p.kill && p.a > 0);
    if (this.particles.length > 1500) this.particles.splice(0, this.particles.length - 1500);
  }
  /** pré-aquece: enche os fios como se o circuito já estivesse ligado */
  warm() {
    const keep = { power: this.power, ramp: this.ramp };
    const solOn = this.cfg.solve(Object.assign({}, this.p, { power: true, damage: this.damage }));
    this.applyCurrents(solOn);
    this.power = true; this.ramp = 1; this.particles = [];
    for (let k = 0; k < 360; k++) this.stepParticles(1 / 30);
    this.power = keep.power; this.ramp = keep.ramp;
    this.applyCurrents(this.sol);
  }

  /* ================= laço de animação ================= */
  resize() {
    const r = this.el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width < 2) return false;
    if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) {
      this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    }
    const [W, H] = this.cfg.viewBox, s = Math.min(r.width / W, r.height / H);
    this.xf = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr };
    if (this._lastW !== r.width && this.sol) { this._lastW = r.width; this.applySolution(); }
    return true;
  }
  frame(dtReal) {
    if (!this.resize()) return;
    const ts = this.paused ? 0 : (this.slow ? 0.18 : 1) * (REDUCED ? 0.45 : 1);
    const dt = Math.min(dtReal, 0.05) * ts;
    this.t += dt; this._dt = dt; this._dtReal = Math.min(dtReal, 0.05);
    // rampa de liga/desliga (todos os portadores começam a se mover juntos)
    const target = this.power ? 1 : 0;
    if (ts > 0) this.ramp += (target - this.ramp) * (1 - Math.exp(-dtReal / (this.power ? 0.35 : 0.12)));
    const alt = this.cfg.altViews && this.cfg.altViews[this.view];
    if (this.view === 'relevo') this.stepRelevo(dt); else if (!alt) this.stepParticles(dt);
    if (ts > 0) this.thermalStep(dt);
    this.stepFx(dt);
    this.draw();
  }
  stepFx(dt) {
    for (const f of this.fx) {
      f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.kind === 'spark') f.vy += 900 * dt; else { f.r += 14 * dt; f.vx *= 0.98; }
    }
    this.fx = this.fx.filter(f => f.life > 0);
  }
  stepRelevo(dt) {
    const R = this.relPath; if (!R || !this.power) return;
    const I = Math.abs(this.sol.I[this.cfg.relevo.cur] || 0);
    const v = this.speedFor(I) * this.ramp, F = this.fluxFor(I) * this.ramp;
    this.relAcc += F * dt;
    while (this.relAcc >= 1) { this.relAcc -= 1; this.relP.push({ s: F > 0 ? (this.relAcc / F) * v * 0.55 : 0 }); }
    for (const p of this.relP) {
      let i = 0; while (i < R.ks.length - 1 && p.s >= R.cum[i + 1]) i++;
      p.s += v * R.ks[i] * dt;
    }
    this.relP = this.relP.filter(p => p.s < R.len);
  }
  draw() {
    const ctx = this.ctx, { s, ox, oy, dpr } = this.xf;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const sprite = this.electrons ? SPRITE.elec : SPRITE.conv, R = 13;
    const alt = this.cfg.altViews && this.cfg.altViews[this.view];
    if (alt) { alt(ctx, this, this._dt || 0); return; }
    if (this.view === 'relevo') {
      const P = this.relPath; if (!P) return;
      for (const p of this.relP) {
        let i = 0; while (i < P.cum.length - 2 && p.s > P.cum[i + 1]) i++;
        const t = (p.s - P.cum[i]) / ((P.cum[i + 1] - P.cum[i]) || 1);
        const x = lerp(P.pts[i][0], P.pts[i + 1][0], t), y = lerp(P.pts[i][1], P.pts[i + 1][1], t) - 10;
        ctx.drawImage(SPRITE.conv, x - 17, y - 17, 34, 34);
      }
      return;
    }
    const sol = this.sol;
    // 1) brilho de potência / calor
    for (const id in sol.comp) {
      const st = sol.comp[id], c = this.comps[id]; if (!c || !st.Pmax || st.show === 'ghost' || st.show === 'hidden') continue;
      const th = this.thermal[id]; const h = th ? th.h : 0; if (h < 0.04 && !this.damage[id]) continue;
      const [x, y] = c.center, rad = 34 + 46 * Math.min(h, 1.3);
      const g = ctx.createRadialGradient(x, y, 4, x, y, rad);
      const col = this.damage[id] ? [60, 50, 45] : heatRGB(h);
      g.addColorStop(0, rgb(col, this.damage[id] ? 0.35 : 0.18 + 0.45 * Math.min(h, 1)));
      g.addColorStop(1, rgb(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    }
    const dim = !this.power;
    // 2) portadores parados em ramos sem corrente
    if (this.power) {
      ctx.globalAlpha = 0.38;
      for (const e of this.edges) {
        if (e.hidden || Math.abs(e.I) > 1e-9) continue;
        const blk = e.junctions.find(j => sol.comp[j.comp] && (sol.comp[j.comp].mode === 'off' || sol.comp[j.comp].mode === 'low'));
        for (let sp = 18; sp < e.len - 10; sp += 40) {
          if (blk && Math.abs(sp - blk.s) < 80) continue;
          const [x, y] = this.posAt(e, sp); ctx.drawImage(sprite, x - 10, y - 10, 20, 20);
        }
      }
      for (const w of this.idle) {
        for (let sp = 22; sp < w.len - 10; sp += 40) {
          let i = 0; while (i < w.cum.length - 2 && sp > w.cum[i + 1]) i++;
          const t = (sp - w.cum[i]) / ((w.cum[i + 1] - w.cum[i]) || 1);
          ctx.drawImage(sprite, lerp(w.pts[i][0], w.pts[i + 1][0], t) - 10, lerp(w.pts[i][1], w.pts[i + 1][1], t) - 10, 20, 20);
        }
      }
      ctx.globalAlpha = 1;
    }
    // 3) barreiras nas junções e acúmulo de cargas no bloqueio
    for (const e of this.edges) {
      for (const j of e.junctions) {
        const st = sol.comp[j.comp]; if (!st || e.hidden) continue;
        const [x, y, tx, ty] = this.posAt(e, j.s), nx = -ty, ny = tx;
        if ((st.mode === 'off' || st.mode === 'low') && this.power) {
          ctx.strokeStyle = 'rgba(201,54,42,.9)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - nx * 28, y - ny * 28); ctx.lineTo(x + nx * 28, y + ny * 28); ctx.stroke();
          // pilha de cargas do lado de onde a corrente "tentaria" vir
          const vAcross = st.vAcross !== undefined ? st.vAcross : 1;
          if (Math.abs(vAcross) > 0.02) {
            let side = (vAcross > 0 ? -1 : 1) * (this.electrons ? -1 : 1);
            for (let k = 0; k < 7; k++) {
              const sp = j.s + side * (16 + k * 9.5);
              if (sp < 4 || sp > e.len - 4) continue;
              const jit = REDUCED ? 0 : Math.sin(this.t * 9 + k * 1.7) * 1.8;
              const [px, py] = this.posAt(e, sp);
              ctx.drawImage(sprite, px - R + nx * jit + (k % 2 ? nx * 6 : -nx * 6) - 0, py - R + ny * jit + (k % 2 ? ny * 6 : -ny * 6), 2 * R, 2 * R);
            }
          }
        } else if (st.mode === 'bd' && this.power) {
          ctx.strokeStyle = 'rgba(212,145,20,.95)'; ctx.lineWidth = 6; ctx.setLineDash([7, 7]); ctx.lineDashOffset = -this.t * 30;
          ctx.beginPath(); ctx.moveTo(x - nx * 28, y - ny * 28); ctx.lineTo(x + nx * 28, y + ny * 28); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    // 4) partículas em movimento
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      const [x, y, , , vis] = this.posAt(p.e, p.s);
      if (!vis) continue;
      ctx.globalAlpha = (dim ? 0.35 : 1) * clamp(p.a, 0, 1);
      ctx.drawImage(sprite, x - R, y - R, 2 * R, 2 * R);
    }
    ctx.globalAlpha = 1;
    this.drawLEDs(ctx);
    // gancho para desenhos próprios de cada questão (antena, fótons, etc.)
    if (this.cfg.deco) { ctx.save(); this.cfg.deco(ctx, this); ctx.restore(); }
    // 5) efeitos: faíscas e fumaça
    for (const f of this.fx) {
      if (f.kind === 'spark') {
        ctx.strokeStyle = `rgba(255,${180 + Math.random() * 60 | 0},60,${clamp(f.life * 1.6, 0, 1)})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.02, f.y - f.vy * 0.02); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(90,90,96,${clamp(f.life / 2.6, 0, 1) * 0.45})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      }
    }
    // 6) temperatura sobre componentes quentes (rótulo nas barras)
    for (const B of this.bars) {
      const th = this.thermal[B.comp];
      const txt = th && th.h > 0.2 && this.power && B.g.style.display !== 'none' ? `T ≈ ${num(th.T, 0)} °C${th.h > 0.98 ? ' (limite)' : ''}` : '';
      if (B.tt.textContent !== txt) B.tt.textContent = txt;
    }
  }

  /* ================= LEDs: luz e fótons ================= */
  drawLEDs(ctx) {
    const sol = this.sol, dt = this._dt || 0;
    this.photons = this.photons || [];
    for (const id in this.comps) {
      const c = this.comps[id], def = c.def; if (def.type !== 'led') continue;
      const st = sol.comp[id] || {}; if (st.show === 'hidden' || st.show === 'ghost') continue;
      const I = this.power && !this.damage[id] ? Math.max(0, st.I || 0) : 0;
      const br = I / (def.Inom || 0.02);
      const [nx, ny] = c.normal, [x0, y0] = c.center, gx = x0 + nx * 30, gy = y0 + ny * 30;
      const th = this.thermal[id], over = th ? clamp((th.h - 0.6) / 0.4, 0, 1) : 0;
      if (br > 0.01) {
        const base = hexRGB(def.ledColor || '#E53935').map(v => Math.round(lerp(v, 255, over * 0.85)));
        const rad = (18 + 34 * Math.sqrt(Math.min(br, 2.2)) * (1 + over * 0.5)) * (def.glowScale || 1);
        const gr = ctx.createRadialGradient(gx, gy, 2, gx, gy, rad);
        gr.addColorStop(0, rgb(base, clamp(0.3 + 0.4 * Math.min(br, 1.6), 0, 0.85)));
        gr.addColorStop(0.5, rgb(base, clamp(0.12 + 0.2 * Math.min(br, 1.6), 0, 0.5)));
        gr.addColorStop(1, rgb(base, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, rad, 0, 7); ctx.fill();
        // fótons: taxa proporcional a I_F
        if (dt > 0 && !REDUCED) {
          c._ph = (c._ph || 0) + br * 5.5 * dt * (def.photonRate || 1);
          while (c._ph >= 1) {
            c._ph -= 1;
            const a = (Math.random() - 0.5) * 1.3, cs = Math.cos(a), sn = Math.sin(a);
            const vx = (nx * cs - ny * sn), vy = (nx * sn + ny * cs);
            const col = def.white ? (Math.random() < 0.5 ? '#3F63F2' : '#F2B91C') : (def.ledColor || '#E53935');
            this.photons.push({ x: gx, y: gy, vx: vx * 150, vy: vy * 150, life: 0.75, col, ph: Math.random() * 6 });
          }
        }
      }
      if (this.damage[id]) { ctx.fillStyle = 'rgba(70,70,70,.25)'; ctx.beginPath(); ctx.arc(x0, y0, 24, 0, 7); ctx.fill(); }
    }
    // fótons em voo (pequenas ondas)
    for (const f of this.photons) { f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; }
    this.photons = this.photons.filter(f => f.life > 0);
    if (this.photons.length > 600) this.photons.splice(0, this.photons.length - 600);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const f of this.photons) {
      const sp = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / sp, uy = f.vy / sp;
      ctx.strokeStyle = f.col; ctx.globalAlpha = clamp(f.life / 0.4, 0, 1);
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const d = i * 2.2, w = Math.sin(i * 1.3 + f.ph) * 3; const px = f.x - ux * d - uy * w, py = f.y - uy * d + ux * w; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ================= zoom na junção ================= */
  openZoom(id) { if (window.JZ) window.JZ.open(this, id || this.cfg.zoomComp); }
}

/* ---------- barra de ferramentas do circuito ---------- */
function makeToolbar(host, sim, opts = {}) {
  const defs = [
    ['power', 'Ligar/Desligar fonte', 'power', () => sim.setPower(!sim.power), () => sim.power, 'power'],
    ['pause', 'Pausar', 'pause', () => { sim.paused = !sim.paused; }, () => sim.paused],
    ['slow', 'Câmera lenta', 'slow', () => { sim.slow = !sim.slow; }, () => sim.slow],
    ['elec', 'Elétrons', 'swap', () => { sim.electrons = !sim.electrons; sim.particles.forEach(p => p.a = Math.min(p.a, 1)); sim.applySolution(); }, () => sim.electrons],
    ['relevo', 'Relevo de tensão', 'relief', () => sim.setView(sim.view === 'relevo' ? 'sch' : 'relevo'), () => sim.view === 'relevo'],
    ['vm', 'Voltímetro', 'meter', () => sim.setVM(!sim.vm), () => sim.vm],
    ['zoom', 'Zoom na junção', 'zoom', () => sim.openZoom(), () => false],
  ];
  const SHORT = { power: 'Fonte', pause: 'Pausar', slow: 'Lenta', elec: 'Convencional', relevo: 'Relevo', vm: 'Voltímetro', zoom: 'Junção' };
  host.innerHTML = '';
  const btns = defs.filter(d => !(opts.hide || []).includes(d[0])).map(([id, label, icon, act, st, cls]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tool' + (cls ? ' ' + cls : ''); b.dataset.tool = id;
    b.innerHTML = ICON[icon] + `<span class="lg">${label}</span><span class="sh">${SHORT[id]}</span>`; b.title = label;
    b.addEventListener('click', () => { act(); sync(); });
    host.appendChild(b);
    return [b, st, id];
  });
  function sync() {
    for (const [b, st, id] of btns) {
      if (id === 'zoom') continue;
      b.setAttribute('aria-pressed', st() ? 'true' : 'false');
      if (id === 'power') { b.querySelector('.lg').textContent = sim.power ? 'Fonte ligada' : 'Ligar fonte'; b.querySelector('.sh').textContent = sim.power ? 'Ligada' : 'Ligar'; }
      if (id === 'elec') { b.querySelector('.lg').textContent = sim.electrons ? 'Fluxo de elétrons' : 'Sentido convencional'; b.querySelector('.sh').textContent = sim.electrons ? 'Elétrons' : 'Convencional'; }
    }
  }
  sim.toolbar = { sync };
  sync();
  return sim.toolbar;
}

/* =====================================================================
   ZOOM NA JUNÇÃO — o que acontece dentro do cristal PN
   Modos (vêm do solver em sol.comp[id].mode):
     'off'  → polarização reversa abaixo da ruptura: barreira larga, nada atravessa
     'bd'   → ruptura (avalanche para V_Z > ~6 V; tunelamento para V_Z < ~5 V)
     'fwd'  → condução direta: elétrons e lacunas se encontram e recombinam
              (num LED, cada recombinação libera um fóton de energia ≈ V_F)
     'short'/'absent' → componente queimado ou fora do circuito
   ===================================================================== */
const JZ = (() => {
  let sim = null, id = null, ov, cv, ctx, cap, ttl, running = false, last = 0;
  const W = 1000, H = 444, X0 = 70, Y0 = 70, Y1 = 330;
  let X1 = 930, MID = 500, isLED = false;            // num LED a junção encolhe e abre espaço para o diagrama de bandas
  let holes = [], elecs = [], movers = [], flashes = [], photons = [], bandEv = [], acc = 0, Wd = 120, t = 0;

  function build() {
    ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'zoomOv';
    ov.innerHTML = `<div class="sheet zoom-sheet" role="dialog" aria-label="Zoom na junção">
      <h2><span id="jzT">Zoom na junção</span><button class="xbtn" type="button" aria-label="Fechar">Fechar (Esc)</button></h2>
      <canvas width="2000" height="888"></canvas><div class="zoom-cap" id="jzC"></div></div>`;
    document.body.appendChild(ov);
    cv = ov.querySelector('canvas'); ctx = cv.getContext('2d'); cap = ov.querySelector('#jzC'); ttl = ov.querySelector('#jzT');
    ov.querySelector('.xbtn').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  }
  function seed() {
    holes = []; elecs = []; movers = []; flashes = []; photons = []; bandEv = [];
    const n = isLED ? 28 : 46;
    for (let i = 0; i < n; i++) holes.push({ x: X0 + Math.random() * (MID - X0 - 80), y: Y0 + 14 + Math.random() * (Y1 - Y0 - 28), vx: 0, vy: 0 });
    for (let i = 0; i < n; i++) elecs.push({ x: MID + 80 + Math.random() * (X1 - MID - 80), y: Y0 + 14 + Math.random() * (Y1 - Y0 - 28), vx: 0, vy: 0 });
  }
  function open(s, compId) {
    if (!ov) build();
    sim = s; id = compId;
    const def = sim.comps[id] && sim.comps[id].def;
    isLED = !!(def && def.type === 'led'); X1 = isLED ? 610 : 930; MID = (X0 + X1) / 2;
    ttl.innerHTML = 'Zoom na junção — ' + sub(def && def.zoomName ? def.zoomName : id);
    seed(); ov.classList.add('on'); running = true; last = performance.now();
    requestAnimationFrame(loop);
  }
  function close() { if (ov) ov.classList.remove('on'); running = false; }
  function isOpen() { return running; }

  function state() {
    const st = (sim.sol.comp[id]) || {}, def = sim.comps[id].def;
    const power = sim.power;
    return { mode: power ? st.mode : 'eq', I: power ? Math.abs(st.I || 0) : 0, V: st.V || 0, Vz: def.Vz || 0, led: def.type === 'led', white: !!def.white, color: def.ledColor || '#E53935', Vf: def.Vf || 2, Inom: def.Inom || 0, dmg: sim.damage[id], show: st.show };
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000) * (sim.paused ? 0 : sim.slow ? 0.25 : 1); last = now; t += dt;
    const S = state();
    step(dt, S); draw(S);
    requestAnimationFrame(loop);
  }
  function step(dt, S) {
    // largura da região de depleção
    let target = 120;
    if (S.mode === 'off' || S.mode === 'bd') target = clamp(120 * Math.sqrt(1 + Math.min(S.V || S.Vz, 40) / 3), 150, 330);
    if (S.mode === 'fwd') target = 54;
    if (S.mode === 'low') target = 92;
    if (S.dmg || S.show === 'ghost') target = 120;
    Wd += (target - Wd) * (1 - Math.exp(-dt / 0.25));
    const L = MID - Wd / 2, R = MID + Wd / 2;
    // agitação térmica dos portadores majoritários (presos ao seu lado)
    const jig = (p, lo, hi) => {
      p.vx += (Math.random() - 0.5) * 300 * dt; p.vy += (Math.random() - 0.5) * 300 * dt;
      p.vx *= 0.92; p.vy *= 0.92; p.x += p.vx * dt * 4; p.y += p.vy * dt * 4;
      if (p.x < lo) { p.x = lo; p.vx = Math.abs(p.vx); } if (p.x > hi) { p.x = hi; p.vx = -Math.abs(p.vx); }
      if (p.y < Y0 + 10) { p.y = Y0 + 10; p.vy = Math.abs(p.vy); } if (p.y > Y1 - 10) { p.y = Y1 - 10; p.vy = -Math.abs(p.vy); }
    };
    holes.forEach(p => jig(p, X0 + 8, L - 8)); elecs.forEach(p => jig(p, R + 8, X1 - 8));
    const Iref = sim.cfg.Iref || 0.02;
    const rate = S.dmg ? 0 : S.Inom ? clamp(S.I / S.Inom * 9, 0, 30) : clamp(Math.sqrt(S.I / Iref) * 7, 0, 28);   // eventos por segundo
    if (S.mode === 'bd') {
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const y = Y0 + 20 + Math.random() * (Y1 - Y0 - 40);
        const tunnel = S.Vz < 4.5 || (S.Vz < 6.5 && Math.random() < (6.5 - S.Vz) / 2);
        if (tunnel) movers.push({ k: 'tun', x: L, y, t: 0 });              // tunelamento
        else movers.push({ k: 'e', x: L + 4, y, vx: 260, gen: 0 });       // avalanche: semente
      }
    } else if (S.mode === 'fwd') {
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const y = Y0 + 24 + Math.random() * (Y1 - Y0 - 48);
        movers.push({ k: 'ef', x: R + 30 + Math.random() * 40, y, vx: -220, meet: MID + (Math.random() - 0.5) * Wd * 0.8 });
        movers.push({ k: 'hf', x: L - 30 - Math.random() * 40, y: y + (Math.random() - 0.5) * 10, vx: 220, meet: 0 });
      }
    } else if (S.mode === 'off' && !S.dmg) {
      // fuga ínfima: de vez em quando um portador minoritário atravessa
      if (Math.random() < dt * 0.25) movers.push({ k: 'e', x: L + 4, y: Y0 + 30 + Math.random() * 200, vx: 200, gen: 9 });
    }
    // movimento dos portadores que atravessam
    for (const m of movers) {
      if (m.k === 'tun') { m.t += dt * 2.2; continue; }
      if (m.k === 'e' || m.k === 'h') {
        m.x += m.vx * dt;
        if (m.k === 'e' && m.gen < 3 && m.x > L + 20 && m.x < R - 20 && Math.random() < dt * 4.5) {
          // ionização por impacto: nasce um novo par elétron-lacuna
          m.gen++;
          movers.push({ k: 'e', x: m.x, y: m.y + 10, vx: 260, gen: m.gen });
          movers.push({ k: 'h', x: m.x, y: m.y - 10, vx: -200 });
          flashes.push({ x: m.x, y: m.y, life: 0.35, c: '255,210,80' });
        }
      }
      if (m.k === 'ef' || m.k === 'hf') m.x += m.vx * dt;
    }
    // recombinação em direta: elétron e lacuna se encontram perto da junção
    if (S.mode === 'fwd') {
      for (const e of movers) if (e.k === 'ef' && !e.dead && e.x <= e.meet) {
        const h = movers.find(h => h.k === 'hf' && !h.dead && h.x >= e.meet - 30);
        e.dead = true; if (h) h.dead = true;
        const pc = S.white ? (Math.random() < 0.5 ? '#3F63F2' : '#F2B91C') : S.color;
        flashes.push({ x: e.meet, y: e.y, life: 0.35, c: S.led ? hexToRgbStr(pc) : '255,170,90' });
        if (S.led) { photons.push({ x: e.meet, y: e.y, dir: Math.random() < 0.5 ? -1 : 1, life: 1.6, ph: Math.random() * 6, col: pc }); bandEv.push({ t: 0, col: pc, y: Math.random() }); }
      }
    }
    movers = movers.filter(m => !m.dead && (m.k === 'tun' ? m.t < 1 : m.x > X0 - 30 && m.x < X1 + 30));
    if (movers.length > 400) movers.splice(0, movers.length - 400);
    flashes.forEach(f => f.life -= dt); flashes = flashes.filter(f => f.life > 0);
    photons.forEach(p => { p.y += p.dir * 210 * dt; p.life -= dt; }); photons = photons.filter(p => p.life > 0);
    bandEv.forEach(b => b.t += dt * 0.9); bandEv = bandEv.filter(b => b.t < 1); if (bandEv.length > 14) bandEv.splice(0, bandEv.length - 14);
  }
  function hexToRgbStr(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; }
  function draw(S) {
    const k = cv.width / W; ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const L = MID - Wd / 2, R = MID + Wd / 2;
    // regiões P e N
    ctx.fillStyle = '#FBE3E1'; ctx.fillRect(X0, Y0, L - X0, Y1 - Y0);
    ctx.fillStyle = '#E1ECFB'; ctx.fillRect(R, Y0, X1 - R, Y1 - Y0);
    ctx.fillStyle = '#F7F7F2'; ctx.fillRect(L, Y0, R - L, Y1 - Y0);
    ctx.strokeStyle = '#1F2D4D'; ctx.lineWidth = 3; ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, Y0); ctx.lineTo(L, Y1); ctx.moveTo(R, Y0); ctx.lineTo(R, Y1); ctx.stroke(); ctx.setLineDash([]);
    // terminais
    ctx.fillStyle = '#1F2D4D'; ctx.fillRect(X0 - 46, (Y0 + Y1) / 2 - 4, 46, 8); ctx.fillRect(X1, (Y0 + Y1) / 2 - 4, 46, 8);
    ctx.font = '900 20px Lato, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#B22E24'; ctx.fillText('Lado P (anodo)', X0 + 8, Y0 - 14);
    ctx.textAlign = 'right'; ctx.fillStyle = '#2E5DAA'; ctx.fillText('Lado N (catodo)', X1 - 8, Y0 - 14);
    ctx.textAlign = 'center'; ctx.fillStyle = '#47536E'; ctx.font = '700 16px Lato, sans-serif'; ctx.fillText('região de depleção', MID, Y0 - 14);
    // íons fixos na depleção
    ctx.font = '700 13px Lato, sans-serif';
    for (let yy = Y0 + 22; yy < Y1 - 10; yy += 34) {
      for (let xx = L + 14; xx < MID - 4; xx += 26) { ctx.strokeStyle = '#B22E24'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(xx, yy, 8, 0, 7); ctx.stroke(); ctx.fillStyle = '#B22E24'; ctx.fillText('−', xx, yy + 5); }
      for (let xx = R - 14; xx > MID + 4; xx -= 26) { ctx.strokeStyle = '#2E5DAA'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(xx, yy, 8, 0, 7); ctx.stroke(); ctx.fillStyle = '#2E5DAA'; ctx.fillText('+', xx, yy + 5); }
    }
    // campo elétrico (N → P)
    if (S.mode !== 'fwd') {
      ctx.strokeStyle = 'rgba(31,45,77,.5)'; ctx.lineWidth = 2.5; const ya = Y1 - 18;
      ctx.beginPath(); ctx.moveTo(R - 10, ya); ctx.lineTo(L + 18, ya); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L + 10, ya); ctx.lineTo(L + 22, ya - 7); ctx.lineTo(L + 22, ya + 7); ctx.closePath(); ctx.fillStyle = 'rgba(31,45,77,.5)'; ctx.fill();
      ctx.fillStyle = '#1F2D4D'; ctx.font = 'italic 700 16px Lato, sans-serif'; ctx.fillText('campo E', MID, ya - 8);
    }
    // portadores majoritários
    for (const p of holes) { ctx.fillStyle = '#E25A50'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 12px Lato'; ctx.fillText('+', p.x, p.y + 4); }
    for (const p of elecs) { ctx.fillStyle = '#2E6BD6'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); }
    // portadores em trânsito
    for (const m of movers) {
      if (m.k === 'tun') {
        const x = lerp(L, R, m.t);
        ctx.strokeStyle = 'rgba(46,107,214,.35)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, m.y); ctx.quadraticCurveTo(MID, m.y - 40, R, m.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#2E6BD6'; ctx.beginPath(); ctx.arc(x, m.y - 40 * 4 * m.t * (1 - m.t) * 0.5, 6, 0, 7); ctx.fill();
      } else if (m.k === 'e' || m.k === 'ef') { ctx.fillStyle = '#2E6BD6'; ctx.beginPath(); ctx.arc(m.x, m.y, 6.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = '#E25A50'; ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, 7); ctx.fill(); }
    }
    for (const f of flashes) { const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 26); g.addColorStop(0, `rgba(${f.c},${f.life * 2.4})`); g.addColorStop(1, `rgba(${f.c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 26, 0, 7); ctx.fill(); }
    ctx.save(); ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
    for (const p of photons) {
      ctx.strokeStyle = p.col || S.color; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 26; i++) { const yy = p.y - p.dir * i * 1.5, xx = p.x + Math.sin(i * 0.7 + p.ph) * 6; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    ctx.restore();
    if (isLED) drawBands(S);
    // queimado
    if (S.dmg) { ctx.fillStyle = 'rgba(40,36,34,.55)'; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0); ctx.fillStyle = '#fff'; ctx.font = '900 34px Lato'; ctx.fillText(S.dmg === 'short' ? 'JUNÇÃO DESTRUÍDA — CURTO' : 'JUNÇÃO DESTRUÍDA — ABERTA', MID, (Y0 + Y1) / 2 + 12); }
    // leitura
    ctx.textAlign = 'left'; ctx.fillStyle = '#1F2D4D'; ctx.font = '900 22px "IBM Plex Mono", monospace';
    const st = sim.sol.comp[id] || {};
    ctx.fillText(`I = ${fI(sim.power ? Math.abs(st.I || 0) : 0)}`, X0, H - 52);
    ctx.fillText(`V = ${fV(sim.power ? Math.abs(st.V || 0) : 0)}`, X0 + (isLED ? 260 : 300), H - 52);
    ctx.font = '700 17px Lato, sans-serif'; ctx.fillStyle = '#47536E';
    ctx.fillText('● lacuna (P)   ● elétron (N)   ○ íons fixos da depleção', X0, H - 20);
    cap.innerHTML = caption(S);
  }
  /* diagrama de bandas: o elétron "cai" da banda de condução para a de valência
     e a diferença de energia (≈ q·V_F) sai como fóton */
  function drawBands(S) {
    const bx0 = 660, bx1 = 975, bm = (bx0 + bx1) / 2, yc = 150, gap = 110;
    const step = S.mode === 'fwd' ? 22 : S.mode === 'off' ? 95 : 60;          // degrau da barreira
    ctx.save();
    ctx.fillStyle = '#F7F8FB'; ctx.fillRect(bx0 - 10, Y0 - 34, bx1 - bx0 + 20, Y1 - Y0 + 70);
    ctx.fillStyle = '#1F2D4D'; ctx.font = '900 17px Lato, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Diagrama de bandas', bm, Y0 - 12);
    const band = (y0, lab) => {
      ctx.strokeStyle = '#1F2D4D'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(bx0, y0); ctx.lineTo(bm - 30, y0); ctx.bezierCurveTo(bm, y0, bm, y0 + step, bm + 30, y0 + step); ctx.lineTo(bx1, y0 + step); ctx.stroke();
      ctx.font = '700 13px Lato, sans-serif'; ctx.fillStyle = '#47536E'; ctx.textAlign = 'left'; ctx.fillText(lab, bx0, y0 - 8);
    };
    band(yc, 'banda de condução'); band(yc + gap, 'banda de valência');
    ctx.font = '700 13px Lato, sans-serif'; ctx.fillStyle = '#B22E24'; ctx.textAlign = 'left'; ctx.fillText('P', bx0, Y1 + 24);
    ctx.fillStyle = '#2E5DAA'; ctx.textAlign = 'right'; ctx.fillText('N', bx1, Y1 + 24);
    // elétrons na banda de condução do lado N e lacunas na de valência do lado P
    for (let k = 0; k < 6; k++) { ctx.fillStyle = '#2E6BD6'; ctx.beginPath(); ctx.arc(bm + 50 + k * 18 + Math.sin(t * 3 + k) * 3, yc + step - 9, 5.5, 0, 7); ctx.fill(); }
    for (let k = 0; k < 6; k++) { ctx.strokeStyle = '#E25A50'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx0 + 22 + k * 18 + Math.sin(t * 3 + k) * 3, yc + gap + 9, 5.5, 0, 7); ctx.stroke(); }
    // seta da energia do fóton
    ctx.strokeStyle = '#E8772E'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(bm - 4, yc + step / 2); ctx.lineTo(bm - 4, yc + gap + step / 2); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, 'E ≈ q·V_F', bm - 12, yc + gap / 2 + step / 2 - 4, { fs: 14, a: 'right', c: '#B4551A', w: 900 });
    txt(ctx, S.white ? '≈ 2,7 eV (azul)' : `≈ ${num(S.Vf, 1)} eV`, bm - 12, yc + gap / 2 + step / 2 + 14, { fs: 14, a: 'right', c: '#B4551A', w: 900 });
    // quedas em andamento
    for (const b of bandEv) {
      const x = bm + (b.y - 0.5) * 24, y = lerp(yc + step / 2, yc + gap + step / 2, Math.min(b.t * 2, 1));
      ctx.fillStyle = '#2E6BD6'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      if (b.t > 0.45) {
        const pr = (b.t - 0.45) / 0.55; ctx.strokeStyle = b.col; ctx.lineWidth = 3; ctx.globalAlpha = 1 - pr;
        ctx.beginPath(); for (let i = 0; i <= 22; i++) { const xx = x + 10 + pr * 70 + i * 2.6, yy = yc + gap / 2 + step / 2 + Math.sin(i * 0.9) * 6; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
  function caption(S) {
    if (S.show === 'ghost') return '<b>Componente fora do circuito.</b> Sem tensão aplicada, a junção fica em equilíbrio.';
    if (S.dmg) return S.dmg === 'short' ? '<b>Queimado.</b> O calor fundiu a junção: agora ela é um caminho de baixíssima resistência (curto).' : '<b>Queimado.</b> A junção se rompeu e abriu o circuito.';
    switch (S.mode) {
      case 'open': return '<b>Sem caminho para a corrente.</b> O pino do driver está em nível 1 (aberto): o catodo não chega ao terra, nenhuma corrente circula e a junção fica em equilíbrio. Nada de recombinação, nada de luz.';
      case 'low': return `<b>Tensão abaixo de V<sub>F</sub>.</b> A barreira diminui um pouco, mas ainda não deixa elétrons e lacunas se encontrarem: não há recombinação, não há fótons e o LED fica apagado.`;
      case 'off': if (S.led) return '<b>LED em polarização reversa.</b> A barreira aumenta e nada atravessa. O LED aguenta pouca tensão reversa (V<sub>R,máx</sub> de poucos volts): acima disso a junção rompe e é destruída.';
        return '<b>Bloqueio (polarização reversa abaixo da ruptura).</b> A tensão reversa alarga a região de depleção e reforça a barreira. Os portadores majoritários são afastados da junção; só uma corrente de fuga ínfima (µA) atravessa.';
      case 'bd': if (S.Vz >= 4.5 && S.Vz < 6.5) return `<b>Ruptura, V<sub>Z</sub> = ${fV(S.Vz, 1)}.</b> Nesta faixa (≈ 5 a 6 V) os dois mecanismos coexistem: parte dos elétrons <b>atravessa por tunelamento</b> a depleção fina e parte é acelerada e provoca <b>avalanche</b>. A tensão fica praticamente presa em V<sub>Z</sub>; a corrente é definida pelo resto do circuito.`;
        return S.Vz < 4.5
        ? `<b>Ruptura por efeito Zener (tunelamento), V<sub>Z</sub> = ${fV(S.Vz, 1)}.</b> A depleção é tão fina que o campo arranca elétrons diretamente das ligações do lado P e eles "atravessam" a barreira. A tensão fica presa em V<sub>Z</sub>; a corrente é definida pelo resto do circuito.`
        : `<b>Ruptura por avalanche, V<sub>Z</sub> = ${fV(S.Vz, 0)}.</b> O campo intenso acelera os poucos portadores minoritários; ao colidir com a rede cristalina eles arrancam novos pares elétron-lacuna, que também são acelerados. A corrente cresce em cascata, mas a tensão fica praticamente presa em V<sub>Z</sub>.`;
      case 'fwd': return S.led
        ? (S.white ? '<b>Condução direta (LED branco).</b> Elétrons do lado N e lacunas do lado P recombinam na junção de um chip <b>azul</b>; cada recombinação libera um fóton de ≈ 2,7 eV. Uma camada de <b>fósforo</b> converte parte da luz azul em amarela, e a mistura parece branca. Mais corrente, mais recombinações, mais luz.'
          : '<b>Condução direta.</b> A barreira diminui; elétrons do lado N e lacunas do lado P se encontram na junção e recombinam. Cada recombinação libera um fóton com energia ≈ q·V<sub>F</sub> (vermelho: 2,0 eV → λ ≈ 1240/2,0 ≈ 620 nm). Mais corrente, mais recombinações, mais luz.')
        : '<b>Condução direta (≈ 0,7 V).</b> A barreira diminui e os portadores atravessam a junção; elétrons e lacunas recombinam liberando calor.';
      default: return '<b>Equilíbrio (fonte desligada).</b> A região de depleção tem largura natural; difusão e campo interno se equilibram e não há corrente.';
    }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && running) close(); });
  return { open, close, isOpen };
})();
window.JZ = JZ;

/* =====================================================================
   GRÁFICOS SINCRONIZADOS (leem o estado do Sim a cada quadro)
   - iv     : curva I×V de cada Zener com o ponto de operação
   - ll     : reta de carga (Thévenin visto pelo Zener ou pelo par em série)
   - res    : resistência estática R = V/I e dinâmica r = dV/dI (log-log)
   - sankey : fluxo de energia com a eficiência η
   - vavi   : V_A e V_B em função de V_i (regulação de linha)
   - lsb    : lupa em mV da referência comparada a 1 LSB do A/D
   - win    : janela de corrente de carga permitida
   - rsrange: faixas de R_S possíveis (projeto possível ou impossível)
   Configuração: cfg.zener (um Zener) ou cfg.zeners (lista) + cfg.chart.
   ===================================================================== */
const CH = {
  ink: '#1F2D4D', ink2: '#47536E', ink3: '#7D879E', grid: '#DCE1EA', orange: '#E8772E',
  ok: '#23884F', bad: '#C9362A', warn: '#D49114', bg: '#F3F5F9', teal: '#2C8C8C', blue: '#2E5DAA',
};
function chartFont(w) { return clamp(w / 21, 11, 22); }
function setupCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (r.width < 4 || r.height < 4) return null;
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  return { ctx, w: r.width, h: r.height };
}
function txt(ctx, s, x, y, o = {}) {
  ctx.font = `${o.w || 700} ${o.fs}px Lato, "Segoe UI", sans-serif`;
  ctx.fillStyle = o.c || CH.ink2; ctx.textAlign = o.a || 'left'; ctx.textBaseline = o.b || 'alphabetic';
  const parts = String(s).split(/_(\{[^}]*\}|[A-Za-z0-9,]+)/);
  if (parts.length === 1) { ctx.fillText(s, x, y); return; }
  let total = 0; const segs = [];
  parts.forEach((p, i) => { const sb = i % 2 === 1; const t = p.replace(/[{}]/g, ''); ctx.font = `${o.w || 700} ${sb ? o.fs * 0.72 : o.fs}px Lato, sans-serif`; const w = ctx.measureText(t).width; segs.push({ t, sb, w }); total += w; });
  let cx = o.a === 'center' ? x - total / 2 : o.a === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  for (const sg of segs) { ctx.font = `${o.w || 700} ${sg.sb ? o.fs * 0.72 : o.fs}px Lato, sans-serif`; ctx.fillText(sg.t, cx, y + (sg.sb ? o.fs * 0.28 : 0)); cx += sg.w; }
}
function dot(ctx, x, y, r, col, pulse) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r * (2.6 + 0.6 * pulse));
  g.addColorStop(0, col.replace('A', '0.55')); g.addColorStop(1, col.replace('A', '0'));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * (2.6 + 0.6 * pulse), 0, 7); ctx.fill();
  ctx.fillStyle = col.replace('A', '1'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
}
/* Zeners da questão, seus modelos de desenho e os pontos de operação */
function zSet(sim) {
  if (!sim._zs) {
    const list = sim.cfg.zeners || [sim.cfg.zener];
    sim._zs = list.map((z, i) => Object.assign({ color: i ? CH.teal : CH.ink, dotc: i ? 'rgba(44,140,140,A)' : 'rgba(232,119,46,A)', name: 'D_Z' }, z, { M: makeZenerModel(z) }));
    sim._zopt = Object.assign({}, sim.cfg.zener || {}, sim.cfg.chart || {});
  }
  const ops = [].concat(sim.sol.zop || []);
  return { zs: sim._zs, O: sim._zopt, ops, ll: sim.sol.zll || ops[0] || {} };
}
const pulseOf = t => 0.5 + 0.5 * Math.sin(t * 5);

/* ---------- curva I×V ---------- */
function drawIV(ctx, w, h, sim, t) {
  const { zs, O, ops } = zSet(sim);
  const fs = chartFont(w), L = fs * 3.4, R = w - fs * 0.8, T = fs * 1.2, B = h - fs * 1.9;
  const VzMax = Math.max(...zs.map(z => z.Vz));
  const Vx = O.Vxmax || VzMax * 1.35, IzmMax = Math.max(...zs.map(z => z.Pzm / z.Vz));
  const Ir = O.Irmax || IzmMax * 1.25, If = Ir * 0.42;
  const xz = L + 0.76 * (R - L), yz = T + 0.3 * (B - T);
  const X = v => v <= 0 ? xz + (v / Vx) * (xz - L) : xz + (v / 1.1) * (R - xz);
  const Y = i => i >= 0 ? yz - (i / If) * (yz - T) : yz + (Math.min(-i, Ir * 1.05) / Ir) * (B - yz);
  // zona proibida (I > I_ZM), por Zener
  const zin = zs.filter(z => z.Pzm / z.Vz <= Ir);
  if (zin.length) {
    const lo = Math.min(...zin.map(z => z.Pzm / z.Vz));
    ctx.fillStyle = 'rgba(201,54,42,.10)'; ctx.fillRect(L, Y(-lo), xz - L, B - Y(-lo));
    zin.forEach(z => {
      const izm = z.Pzm / z.Vz;
      ctx.strokeStyle = 'rgba(201,54,42,.6)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(L, Y(-izm)); ctx.lineTo(xz, Y(-izm)); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, `I_ZM${zs.length > 1 ? ' (' + z.name + ')' : ''} = ${fI(izm)}`, L + 4, Y(-izm) + fs * 1.1, { fs: fs * 0.78, c: CH.bad });
    });
  } else txt(ctx, `I_ZM fora da escala (≥ ${fI(Math.min(...zs.map(z => z.Pzm / z.Vz)))})`, xz - 4, B - 4, { fs: fs * 0.7, a: 'right', c: CH.bad });
  // eixos
  ctx.strokeStyle = CH.ink3; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(L, yz); ctx.lineTo(R, yz); ctx.moveTo(xz, T); ctx.lineTo(xz, B); ctx.stroke();
  const stepV = Vx > 12 ? 5 : Vx > 5 ? 2 : 1;
  for (let v = stepV; v < Vx; v += stepV) { ctx.beginPath(); ctx.moveTo(X(-v), yz - 3); ctx.lineTo(X(-v), yz + 3); ctx.stroke(); txt(ctx, '−' + v, X(-v), yz + fs * 1.05, { fs: fs * 0.75, a: 'center', c: CH.ink3 }); }
  txt(ctx, '0,7', X(0.7), yz + fs * 1.05, { fs: fs * 0.75, a: 'center', c: CH.ink3 });
  txt(ctx, 'I', xz + 4, T + fs * 0.6, { fs: fs * 0.8, c: CH.ink3 });
  // curva direta (comum)
  ctx.strokeStyle = CH.ink; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let v = 0; v <= 0.95; v += 0.005) { const i = Math.min(If, 0.01 * Math.exp((v - 0.7) / 0.04) - 0.01 * Math.exp(-0.7 / 0.04)); const p = [X(v), Y(i)]; v ? ctx.lineTo(...p) : ctx.moveTo(...p); if (i >= If) break; }
  ctx.stroke();
  // curvas reversas
  zs.forEach((z, k) => {
    const izm = z.Pzm / z.Vz;
    ctx.strokeStyle = z.color; ctx.lineWidth = 2.6; ctx.beginPath(); let first = true, ik = null;
    for (const p of z.M.pts) { if (p.V > Vx || p.I > Ir) break; const q = [X(-p.V), Y(-p.I)]; first ? ctx.moveTo(...q) : ctx.lineTo(...q); first = false; if (!ik && p.I >= z.Izk) ik = q; }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(35,136,79,.33)'; ctx.lineWidth = 9; ctx.beginPath(); let st = false;
    for (const p of z.M.pts) { if (p.I < z.Izk) continue; if (p.I > Math.min(izm, Ir)) break; const q = [X(-p.V), Y(-p.I)]; st ? ctx.lineTo(...q) : ctx.moveTo(...q); st = true; }
    ctx.stroke();
    if (k === 0 && ik) txt(ctx, '← joelho (I_ZK)', ik[0] + 8, ik[1] + fs * 2.3, { fs: fs * 0.78, c: CH.ink2 });
    txt(ctx, zs.length > 1 ? z.name : 'ruptura em −V_Z', X(-z.Vz) + 6, Y(-Ir * (0.62 - 0.2 * k)), { fs: fs * 0.78, c: zs.length > 1 ? z.color : CH.ok, w: 900 });
  });
  txt(ctx, 'bloqueio: I ≈ 0', X(-Math.min(...zs.map(z => z.Vz)) * 0.45), yz - 6, { fs: fs * 0.78, a: 'center', c: CH.ink2 });
  txt(ctx, 'direta', X(0.45), T + fs * 1.6, { fs: fs * 0.78, a: 'right', c: CH.ink2 });
  // pontos de operação
  const pulse = pulseOf(t);
  ops.forEach((op, k) => {
    const z = zs[k] || zs[0];
    if (!sim.power || !op.state || ['absent', 'short', 'nopower'].includes(op.state)) return;
    const V = op.state === 'fwd' ? 0.7 : -op.V, I = op.state === 'fwd' ? Math.min(op.I, If) : -(op.state === 'off' ? 0 : op.I);
    dot(ctx, X(V), Y(I), fs * 0.42, op.state === 'off' ? 'rgba(201,54,42,A)' : z.dotc, pulse);
  });
  const st0 = ops[0] && ops[0].state;
  if (st0 === 'absent') txt(ctx, 'Zener fora do circuito', X(-zs[0].Vz * 0.45), yz + (B - yz) * 0.45, { fs: fs * 0.85, a: 'center', c: CH.ink3, w: 900 });
  if (ops.some(o => o.state === 'short')) txt(ctx, 'queimado: virou curto', X(-zs[0].Vz * 0.45), yz + (B - yz) * 0.45, { fs: fs * 0.85, a: 'center', c: CH.bad, w: 900 });
  if (O.note) txt(ctx, O.note, R, h - 4, { fs: fs * 0.62, a: 'right', c: CH.ink3, w: 400 });
}

/* ---------- reta de carga ---------- */
function drawLL(ctx, w, h, sim, t) {
  const { zs, O, ll } = zSet(sim);
  const fs = chartFont(w), L = fs * 3.2, R = w - fs * 0.8, T = fs * 1.2, B = h - fs * 1.9;
  const VzSum = zs.reduce((s, z) => s + z.Vz, 0), IzmMin = Math.min(...zs.map(z => z.Pzm / z.Vz));
  const Vx = O.LLVmax || VzSum * 1.6, Ymax = O.LLImax || IzmMin * 1.3;
  const X = v => L + (v / Vx) * (R - L), Y = i => B - (i / Ymax) * (B - T);
  ctx.save(); ctx.beginPath(); ctx.rect(L, T - 2, R - L + 2, B - T + 4); ctx.clip();
  if (IzmMin < Ymax) { ctx.fillStyle = 'rgba(201,54,42,.10)'; ctx.fillRect(L, T, R - L, Y(IzmMin) - T); }
  ctx.strokeStyle = CH.grid; ctx.lineWidth = 1;
  const stepV = Vx > 30 ? 10 : Vx > 12 ? 5 : 2;
  for (let v = stepV; v < Vx; v += stepV) { ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), B); ctx.stroke(); }
  // curva do Zener (ou soma dos Zeners em série: mesma corrente, tensões somadas)
  ctx.strokeStyle = CH.ink; ctx.lineWidth = 2.6; ctx.beginPath(); let f = true;
  for (let k = 0; k <= 400; k++) {
    const i = Ymax * 1.2 * Math.pow(k / 400, 2) + 1e-9;
    const V = zs.reduce((s, z) => s + z.M.atI(i).V, 0);
    const q = [X(V), Y(i)]; f ? ctx.moveTo(...q) : ctx.lineTo(...q); f = false;
  }
  ctx.stroke();
  const okLine = sim.power && ll.Vth !== undefined && ll.Rth > 0 && isFinite(ll.Rth);
  if (okLine) {
    const Isc = ll.Vth / ll.Rth;
    ctx.strokeStyle = CH.orange; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(X(0), Y(Isc)); ctx.lineTo(X(ll.Vth), Y(0)); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = CH.ink3; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
  for (let v = stepV; v < Vx; v += stepV) if (X(v) < R - fs * 4.2) txt(ctx, String(v), X(v), B + fs * 1.05, { fs: fs * 0.75, a: 'center', c: CH.ink3 });
  txt(ctx, zs.length > 1 ? 'V_Z1 + V_Z2' : 'V reversa', R, B + fs * 1.05, { fs: fs * 0.72, a: 'right', c: CH.ink3 });
  const stepI = Ymax > 0.25 ? 0.1 : Ymax > 0.05 ? 0.02 : 0.005;
  for (let i = stepI; i < Ymax; i += stepI) txt(ctx, String(Math.round(i * 1000)), L - 4, Y(i) + fs * 0.3, { fs: fs * 0.72, a: 'right', c: CH.ink3 });
  txt(ctx, 'mA', L - 4, T + fs * 0.2, { fs: fs * 0.72, a: 'right', c: CH.ink3 });
  if (IzmMin < Ymax) txt(ctx, `I_ZM`, R - 4, Y(IzmMin) - 4, { fs: fs * 0.8, a: 'right', c: CH.bad });
  if (okLine) {
    const Isc = ll.Vth / ll.Rth;
    if (Isc < Ymax) txt(ctx, `I_cc = ${fI(Isc)}`, L + 6, Y(Isc) < T + fs * 2.4 ? Y(Isc) + fs * 1.6 : Y(Isc) - 5, { fs: fs * 0.8, c: CH.orange });
    txt(ctx, `V_th = ${fV(ll.Vth)} · R_th = ${fR(ll.Rth)}`, L + 6, T + fs * 0.85, { fs: fs * 0.8, c: CH.orange, w: 900 });
    const pulse = pulseOf(t);
    if (ll.state === 'absent') {
      dot(ctx, X(ll.Vth), Y(0), fs * 0.42, 'rgba(46,93,170,A)', pulse);
      txt(ctx, 'tensão de teste', X(ll.Vth), Y(0) - fs * 0.9, { fs: fs * 0.8, a: 'center', c: CH.blue });
    } else if (ll.state === 'off' || ll.state === 'bd' || ll.state === 'fwd') {
      const I = ll.state === 'off' ? 0 : ll.I;
      dot(ctx, X(ll.V), Y(Math.min(I, Ymax)), fs * 0.42, ll.state === 'off' ? 'rgba(201,54,42,A)' : 'rgba(232,119,46,A)', pulse);
      txt(ctx, ll.state === 'off' ? 'não alcança o joelho' : 'ponto de operação', X(ll.V) - 8, Y(Math.min(I, Ymax)) - fs * 0.8, { fs: fs * 0.8, a: 'right', c: ll.state === 'off' ? CH.bad : CH.ink });
    }
  }
}

/* ---------- resistência estática e dinâmica (log-log) ---------- */
function drawRes(ctx, w, h, sim, t) {
  const { zs, O, ops } = zSet(sim);
  const fs = chartFont(w), L = fs * 3.1, R = w - fs * 0.8, T = fs * 2.6, B = h - fs * 1.9;
  const lx0 = -7, lx1 = Math.log10(O.resImax || 0.2), ly0 = 0, ly1 = 8;
  const X = i => L + ((Math.log10(Math.max(i, 1e-9)) - lx0) / (lx1 - lx0)) * (R - L);
  const Y = r => B - ((Math.log10(clamp(r, 1, 1e9)) - ly0) / (ly1 - ly0)) * (B - T);
  ctx.strokeStyle = CH.grid; ctx.lineWidth = 1;
  for (let d = ly0; d <= ly1; d += 2) { ctx.beginPath(); ctx.moveTo(L, Y(10 ** d)); ctx.lineTo(R, Y(10 ** d)); ctx.stroke(); }
  for (let d = -6; d <= lx1; d++) { ctx.beginPath(); ctx.moveTo(X(10 ** d), T); ctx.lineTo(X(10 ** d), B); ctx.stroke(); }
  ['1 Ω', '100 Ω', '10 kΩ', '1 MΩ', '100 MΩ'].forEach((s, k) => txt(ctx, s, L - 4, Y(10 ** (k * 2)) + fs * 0.3, { fs: fs * 0.7, a: 'right', c: CH.ink3 }));
  const xl = { '-6': '1 µA', '-4': '100 µA', '-2': '10 mA' };
  for (const d in xl) txt(ctx, xl[d], X(10 ** +d), B + fs * 1.05, { fs: fs * 0.72, a: 'center', c: CH.ink3 });
  txt(ctx, 'I_Z (log)', R, B - 4, { fs: fs * 0.7, a: 'right', c: CH.ink3 });
  const z0 = zs[0], Izm0 = z0.Pzm / z0.Vz;
  ctx.fillStyle = 'rgba(35,136,79,.09)'; ctx.fillRect(X(z0.Izk), T, Math.min(X(Izm0), R) - X(z0.Izk), B - T);
  if (X(Izm0) < R) { ctx.fillStyle = 'rgba(201,54,42,.10)'; ctx.fillRect(X(Izm0), T, R - X(Izm0), B - T); }
  zs.forEach((z, k) => {
    const plot = (key, col, wd, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash || []); ctx.beginPath(); let f = true;
      for (const p of z.M.pts) { if (p.I < 10 ** lx0 || p.I > 10 ** lx1) continue; const q = [X(p.I), Y(p[key])]; f ? ctx.moveTo(...q) : ctx.lineTo(...q); f = false; }
      ctx.stroke(); ctx.setLineDash([]);
    };
    plot('Rs', z.color, 2.4, k ? [6, 4] : null); plot('rd', k ? CH.warn : CH.orange, 2.2, k ? [6, 4] : null);
  });
  txt(ctx, 'R = V/I', X(2e-5), Y(z0.M.atI(2e-5).Rs) - 10, { fs: fs * 0.8, c: CH.ink });
  txt(ctx, 'r = ΔV/ΔI', X(1.5e-3), Y(z0.M.atI(1.5e-3).rd) - 8, { fs: fs * 0.8, c: CH.orange });
  const pulse = pulseOf(t);
  const msgs = [];
  ops.forEach((op, k) => {
    const z = zs[k] || z0, tag = zs.length > 1 ? z.name + ': ' : '';
    if (!sim.power) { msgs.push(['fonte desligada', CH.ink3]); return; }
    if (op.state === 'nopower') { msgs.push([tag + 'sem alimentação', CH.ink3]); return; }
    if (op.state === 'absent') { msgs.push([tag + 'fora do circuito (teste)', CH.ink3]); return; }
    if (op.state === 'short') { msgs.push([tag + 'queimado: curto (R ≈ 0)', CH.bad]); return; }
    if (op.state === 'fwd') { msgs.push([tag + 'invertido: conduz direto', CH.warn]); return; }
    const P = op.state === 'off' ? z.M.atV(Math.max(op.V, 1e-3)) : z.M.atI(Math.max(op.I, 1e-9));
    const Iop = op.state === 'off' ? P.I : op.I, Rst = op.state === 'off' ? P.Rs : op.V / Math.max(op.I, 1e-12);
    dot(ctx, X(Iop), Y(Rst), fs * 0.4, k ? 'rgba(44,140,140,A)' : 'rgba(31,45,77,A)', pulse);
    if (op.state !== 'off') dot(ctx, X(Iop), Y(z.rz || P.rd), fs * 0.28, 'rgba(232,119,46,A)', pulse);
    if (op.state === 'off') msgs.push([`${tag}bloqueado — R ≈ ∞ (${fR(Rst)})`, CH.bad]);
    else if (op.I < z.Izk * 4) msgs.push([`${tag}no joelho — R caindo (${fR(Rst)})`, CH.warn]);
    else msgs.push([zs.length > 1 ? `${tag}r_z = ${fR(z.rz || P.rd)}` : `regulando — R = ${fR(Rst)}; r_z ≈ ${fR(z.rz || P.rd)}`, CH.ok]);
  });
  const line = msgs.map(m => m[0]).join(' · '), col = msgs.length && msgs.every(m => m[1] === msgs[0][1]) ? msgs[0][1] : CH.ink;
  txt(ctx, line, L, T - fs * 0.9, { fs: fs * (line.length > 46 ? 0.72 : 0.88), c: col, w: 900 });
}

/* ---------- fluxo de energia (Sankey simples) ---------- */
function drawSankey(ctx, w, h, sim) {
  const sol = sim.sol, S = sim.cfg.sankey && sim.cfg.sankey(sol, sim.p);
  const fs = chartFont(w);
  if (!S || !sim.power || S.Pin <= 1e-9) { txt(ctx, sim.power ? 'sem potência fornecida' : 'fonte desligada', w / 2, h / 2, { fs, a: 'center', c: CH.ink3 }); return; }
  const T = fs * 2.4, B = h - fs * (S.foot ? 1.9 : 0.8), xs = fs * 0.8, bw = fs * 0.9, xr = w * 0.43;
  const Hmax = (B - T) * 0.82, k = Hmax / Math.max(S.Pref || S.Pin, S.Pin);
  const hin = S.Pin * k, yin = T + ((B - T) - hin) / 2;
  ctx.fillStyle = CH.ink; ctx.fillRect(xs, yin, bw, hin);
  if (S.etaNote) txt(ctx, S.etaNote, xs, T - fs * 0.95, { fs: fs * 0.82, c: CH.ink, w: 900 });
  else txt(ctx, `η = ${fPct(S.eta)}`, xs, T - fs * 0.95, { fs: fs * 1.05, c: CH.ink, w: 900 });
  txt(ctx, `fonte ${fP(S.Pin)}`, w - fs * 0.5, T - fs * 0.95, { fs: fs * 0.8, a: 'right', c: CH.ink2 });
  const sinks = S.sinks.filter(s => s.P > 1e-9);
  const gap = fs * 0.55, totH = sinks.reduce((a, s) => a + s.P * k, 0) + gap * (sinks.length - 1);
  let yr = T + ((B - T) - totH) / 2, yl = yin, ylab = -1e9;
  for (const s of sinks) {
    const hh = s.P * k;
    const yc = Math.max(yr + Math.max(hh, fs) / 2, ylab + fs * 1.85); ylab = yc;
    ctx.fillStyle = s.color.replace('A', '0.38');
    ctx.beginPath(); ctx.moveTo(xs + bw, yl); ctx.bezierCurveTo((xs + xr) / 2, yl, (xs + xr) / 2, yr, xr, yr);
    ctx.lineTo(xr, yr + hh); ctx.bezierCurveTo((xs + xr) / 2, yr + hh, (xs + xr) / 2, yl + hh, xs + bw, yl + hh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = s.color.replace('A', '1'); ctx.fillRect(xr, yr, bw * 0.7, Math.max(hh, 1.5));
    txt(ctx, s.label, xr + bw, yc - 1, { fs: fs * 0.78, c: CH.ink, w: 900 });
    txt(ctx, `${fP(s.P)} · ${fPct(s.P / S.Pin)}`, xr + bw, yc + fs * 0.82, { fs: fs * 0.74, c: CH.ink2 });
    yl += hh; yr += hh + gap;
  }
  if (S.foot) txt(ctx, S.foot, w - fs * 0.5, h - fs * 0.35, { fs: fs * 0.62, a: 'right', c: CH.ink3, w: 400 });
}

/* ---------- V_A e V_B × V_i (regulação de linha) ---------- */
function sweepVi(sim, from, to, n = 120) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const Vi = from + (to - from) * k / n;
    const s = sim.cfg.solve(Object.assign({}, sim.p, { Vi, power: true, damage: {} }));
    out.push({ Vi, s });
  }
  return out;
}
function drawVaVi(ctx, w, h, sim, t) {
  const C = sim.cfg.vavi, fs = chartFont(w), L = fs * 2.6, R = w - fs * 0.8, T = fs * 1.4, B = h - fs * 1.9;
  const [x0, x1] = C.range, ymax = C.ymax;
  const X = v => L + (v - x0) / (x1 - x0) * (R - L), Y = v => B - v / ymax * (B - T);
  const key = JSON.stringify([sim.p, x0, x1]);
  if (sim._vaviKey !== key) { sim._vaviKey = key; sim._vavi = sweepVi(sim, x0, x1); sim._vimin = C.vimin(sim.p); }
  const sw = sim._vavi;
  // faixa da fonte não regulada
  if (C.band) { ctx.fillStyle = 'rgba(232,119,46,.10)'; ctx.fillRect(X(C.band[0]), T, X(C.band[1]) - X(C.band[0]), B - T); txt(ctx, 'faixa da fonte', X((C.band[0] + C.band[1]) / 2), B - 6, { fs: fs * 0.72, a: 'center', c: CH.orange }); }
  ctx.strokeStyle = CH.grid; ctx.lineWidth = 1;
  for (let v = Math.ceil(x0 / 2) * 2; v <= x1; v += 2) { ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), B); ctx.stroke(); txt(ctx, String(v), X(v), B + fs * 1.05, { fs: fs * 0.72, a: 'center', c: CH.ink3 }); }
  for (let v = 2; v <= ymax; v += 2) txt(ctx, String(v), L - 4, Y(v) + fs * 0.3, { fs: fs * 0.72, a: 'right', c: CH.ink3 });
  txt(ctx, 'V_i (V)', R, B - 4, { fs: fs * 0.72, a: 'right', c: CH.ink3 });
  ctx.strokeStyle = CH.ink3; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
  // menor V_i que regula
  const vm = sim._vimin;
  if (vm > x0 && vm < x1) {
    ctx.strokeStyle = CH.bad; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X(vm), T); ctx.lineTo(X(vm), B); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, `I_R = I_ZK em ${fV(vm, 2)}`, X(vm) + 4, T + fs * 0.6, { fs: fs * 0.74, c: CH.bad, w: 900 });
  }
  C.lines.forEach(Ln => {
    ctx.strokeStyle = Ln.color; ctx.lineWidth = 2.6; ctx.beginPath();
    sw.forEach((p, k) => { const q = [X(p.Vi), Y(Ln.f(p.s))]; k ? ctx.lineTo(...q) : ctx.moveTo(...q); });
    ctx.stroke();
    const end = sw[sw.length - 1];
    txt(ctx, Ln.label, X(end.Vi) - 4, Y(Ln.f(end.s)) - 6, { fs: fs * 0.8, a: 'right', c: Ln.color, w: 900 });
    if (sim.power) dot(ctx, X(sim.p.Vi), Y(Ln.f(sim.sol)), fs * 0.36, Ln.dotc, pulseOf(t));
  });
}
/* ---------- lupa em mV contra o LSB do A/D ---------- */
function drawLSB(ctx, w, h, sim, t) {
  const C = sim.cfg.lsb, fs = chartFont(w), L = fs * 3.2, R = w - fs * 5.2, T = fs * 2.4, B = h - fs * 1.9;
  const [x0, x1] = C.range;
  const key = JSON.stringify([sim.p, 'lsb']);
  if (sim._lsbKey !== key) { sim._lsbKey = key; sim._lsb = sweepVi(sim, x0, x1, 60); }
  const sw = sim._lsb, dv = p => (C.f(p) - C.ref) * 1000;
  const lo = Math.min(...sw.map(p => dv(p.s))), hi = Math.max(...sw.map(p => dv(p.s)));
  const span = Math.max(Math.abs(lo), Math.abs(hi)) * 1.15 || 1;
  const X = v => L + (v - x0) / (x1 - x0) * (R - L), Y = mv => (T + B) / 2 - mv / span * (B - T) / 2;
  ctx.strokeStyle = CH.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(R, Y(0)); ctx.stroke();
  ctx.strokeStyle = CH.ink3; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
  for (let v = x0; v <= x1; v += 2) txt(ctx, String(v), X(v), B + fs * 1.05, { fs: fs * 0.72, a: 'center', c: CH.ink3 });
  txt(ctx, `+${num(span * 0.87, 0)} mV`, L - 4, Y(span * 0.87) + fs * 0.3, { fs: fs * 0.68, a: 'right', c: CH.ink3 });
  txt(ctx, `${C.label} − ${num(C.ref, 1)} V`, L - 4, Y(0) + fs * 0.3, { fs: fs * 0.62, a: 'right', c: CH.ink3 });
  txt(ctx, `−${num(span * 0.87, 0)} mV`, L - 4, Y(-span * 0.87) + fs * 0.3, { fs: fs * 0.68, a: 'right', c: CH.ink3 });
  ctx.strokeStyle = CH.teal; ctx.lineWidth = 2.6; ctx.beginPath();
  sw.forEach((p, k) => { const q = [X(p.Vi), Y(dv(p.s))]; k ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.stroke();
  if (sim.power && sim.p.Vi >= x0 && sim.p.Vi <= x1) dot(ctx, X(sim.p.Vi), Y(dv(sim.sol)), fs * 0.38, 'rgba(44,140,140,A)', pulseOf(t));
  // régua: cada risco = 1 LSB
  const lsb = C.vref / Math.pow(2, C.bits) * 1000, rx = R + fs * 1.4;
  ctx.fillStyle = '#fff'; ctx.fillRect(rx - 4, Y(hi), fs * 1.4, Y(lo) - Y(hi));
  ctx.strokeStyle = 'rgba(31,45,77,.55)'; ctx.lineWidth = 0.6; ctx.beginPath();
  for (let mv = lo; mv <= hi; mv += lsb) { const y = Y(mv); ctx.moveTo(rx - 4, y); ctx.lineTo(rx + fs * 1.0, y); }
  ctx.stroke();
  const n = (hi - lo) / lsb;
  txt(ctx, `variação: ${num(hi - lo, 0)} mV ≈ ${num(n, 0)} LSB`, L, T - fs * 1.0, { fs: fs * 0.86, c: CH.bad, w: 900 });
  txt(ctx, `1 LSB = ${num(lsb, 2)} mV (${C.bits} bits)`, L, T - fs * 0.05, { fs: fs * 0.72, c: CH.ink2 });
  txt(ctx, 'régua', rx + fs * 0.3, B + fs * 1.05, { fs: fs * 0.68, a: 'center', c: CH.ink3 });
}
/* ---------- janela de corrente de carga ---------- */
function drawWin(ctx, w, h, sim, t) {
  const C = sim.cfg.win(sim.sol, sim.p), fs = chartFont(w), L = fs * 1.2, R = w - fs * 1.2;
  const X = i => L + clamp(i / C.max, 0, 1) * (R - L);
  const yT = fs * 1.2, yL1 = h * 0.30, yL2 = yL1 + fs * 1.05, yb0 = h * 0.42, yb1 = h * 0.62, yAx = yb1 + fs * 1.3, yMk = h - fs * 0.6;
  txt(ctx, (C.title || 'corrente de carga') + ' (mA)', L, yT, { fs: fs * 0.82, c: CH.ink, w: 900 });
  ctx.fillStyle = 'rgba(201,54,42,.12)'; ctx.fillRect(L, yb0, R - L, yb1 - yb0);
  ctx.fillStyle = 'rgba(35,136,79,.30)'; ctx.fillRect(X(C.Imin), yb0, X(C.Imax) - X(C.Imin), yb1 - yb0);
  txt(ctx, 'janela de regulação', (X(C.Imin) + X(C.Imax)) / 2, (yb0 + yb1) / 2 + fs * 0.3, { fs: fs * 0.8, a: 'center', c: CH.ok, w: 900 });
  ctx.strokeStyle = CH.ink3; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L, yb1); ctx.lineTo(R, yb1); ctx.stroke();
  for (let i = 0; i <= C.max + 1e-9; i += C.step) { ctx.beginPath(); ctx.moveTo(X(i), yb1); ctx.lineTo(X(i), yb1 + fs * 0.35); ctx.stroke(); txt(ctx, String(Math.round(i * 1000)), X(i), yAx, { fs: fs * 0.7, a: 'center', c: CH.ink3 }); }
  const lbl = (I, a1, a2, anchor) => { txt(ctx, a1, X(I), yL1, { fs: fs * 0.76, a: anchor, c: CH.ok, w: 900 }); txt(ctx, a2, X(I), yL2, { fs: fs * 0.68, a: anchor, c: CH.ink2 }); ctx.strokeStyle = CH.ok; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(I), yL2 + fs * 0.3); ctx.lineTo(X(I), yb0); ctx.stroke(); };
  lbl(C.Imin, `I_L,mín = ${fI(C.Imin)}`, `R_L,máx = ${fR(C.Rmax)}`, X(C.Imin) < L + fs * 6 ? 'left' : 'center');
  lbl(C.Imax, `I_L,máx = ${fI(C.Imax)}`, `R_L,mín = ${fR(C.Rmin)}`, X(C.Imax) > R - fs * 6 ? 'right' : 'center');
  (C.marks || []).forEach(m => { ctx.strokeStyle = CH.blue; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(m.I), yb0); ctx.lineTo(X(m.I), yMk - fs * 0.9); ctx.stroke(); ctx.setLineDash([]); txt(ctx, m.label, X(m.I), yMk, { fs: fs * 0.72, a: 'center', c: CH.blue, w: 900 }); });
  if (sim.power && C.I !== null) dot(ctx, X(C.I), (yb0 + yb1) / 2, fs * 0.42, C.I >= C.Imin - 1e-6 && C.I <= C.Imax + 1e-6 ? 'rgba(35,136,79,A)' : 'rgba(201,54,42,A)', pulseOf(t));
}
/* ---------- faixas possíveis de R_S ---------- */
function drawRsRange(ctx, w, h, sim, t) {
  const C = sim.cfg.rsrange(sim.p), fs = chartFont(w), L = fs * 1.2, R = w - fs * 1.2;
  const X = r => L + (r - C.lo) / (C.hi - C.lo) * (R - L);
  const y1 = h * 0.30, y2 = h * 0.55, bh = fs * 1.5;
  ctx.fillStyle = 'rgba(35,136,79,.32)'; ctx.fillRect(X(C.lo), y1, X(C.regMax) - X(C.lo), bh);
  txt(ctx, `regula na TX: R_S ≤ ${num(C.regMax, 2)} Ω`, X(C.lo) + 4, y1 - 5, { fs: fs * 0.76, c: CH.ok, w: 900 });
  ctx.fillStyle = 'rgba(46,93,170,.30)'; ctx.fillRect(X(C.protMin), y2, X(C.hi) - X(C.protMin), bh);
  txt(ctx, `protege sem carga: R_S ≥ ${num(C.protMin, 2)} Ω`, X(C.hi) - 4, y2 + bh + fs * 1.0, { fs: fs * 0.76, a: 'right', c: CH.blue, w: 900 });
  const gap = C.protMin > C.regMax;
  if (gap) {
    ctx.fillStyle = 'rgba(201,54,42,.22)'; ctx.fillRect(X(C.regMax), y1, X(C.protMin) - X(C.regMax), y2 + bh - y1);
    txt(ctx, 'nenhum R_S atende os dois', (X(C.regMax) + X(C.protMin)) / 2, h - fs * 0.6, { fs: fs * 0.82, a: 'center', c: CH.bad, w: 900 });
  }
  ctx.strokeStyle = CH.ink3; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L, y2 + bh + fs * 2); ctx.lineTo(R, y2 + bh + fs * 2); ctx.stroke();
  for (let r = Math.ceil(C.lo); r <= C.hi; r += 1) if ((r - Math.ceil(C.lo)) % 2 === 0) txt(ctx, String(r), X(r), y2 + bh + fs * 3, { fs: fs * 0.68, a: 'center', c: CH.ink3 });
  if (C.cur >= C.lo && C.cur <= C.hi) {
    ctx.strokeStyle = CH.orange; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(C.cur), y1 - fs * 0.2); ctx.lineTo(X(C.cur), y2 + bh + fs * 2); ctx.stroke();
    txt(ctx, `R_S atual = ${num(C.cur, 2)} Ω`, X(C.cur) > w * 0.6 ? X(C.cur) - 4 : X(C.cur) + 4, fs * 1.1, { fs: fs * 0.76, a: X(C.cur) > w * 0.6 ? 'right' : 'left', c: CH.orange, w: 900 });
  }
  txt(ctx, 'R_S (Ω)', R, y2 + bh + fs * 4.1, { fs: fs * 0.72, a: 'right', c: CH.ink3 });
}

/* ---------- I_F × tensão da fonte (sensibilidade do LED) ---------- */
function drawIFV(ctx, w, h, sim, t) {
  const C = sim.cfg.ifv, fs = chartFont(w), L = fs * 2.8, R = w - fs * 0.8, T = fs * 2.4, B = h - fs * 1.9;
  const [x0, x1] = C.range, ym = C.ymax;
  const X = v => L + (v - x0) / (x1 - x0) * (R - L), Y = i => B - clamp(i / ym, 0, 1.02) * (B - T);
  if (C.band) { ctx.fillStyle = 'rgba(232,119,46,.14)'; ctx.fillRect(X(C.band[0]), T, X(C.band[1]) - X(C.band[0]), B - T); txt(ctx, C.bandLabel || '', X(C.band[1]), T + fs * 0.9, { fs: fs * 0.68, a: 'right', c: CH.orange, w: 900 }); }
  ctx.fillStyle = 'rgba(201,54,42,.10)'; ctx.fillRect(L, T, R - L, Y(C.Imax) - T);
  ctx.strokeStyle = CH.bad; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(L, Y(C.Imax)); ctx.lineTo(R, Y(C.Imax)); ctx.stroke(); ctx.setLineDash([]);
  txt(ctx, `I_F,máx = ${num(C.Imax * 1000, 0)} mA`, L + 4, Y(C.Imax) - 4, { fs: fs * 0.74, c: CH.bad, w: 900 });
  ctx.strokeStyle = CH.grid; ctx.lineWidth = 1;
  for (let v = Math.ceil(x0); v <= x1; v++) { ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), B); ctx.stroke(); if ((v - Math.ceil(x0)) % (x1 - x0 > 8 ? 2 : 1) === 0) txt(ctx, String(v), X(v), B + fs * 1.05, { fs: fs * 0.72, a: 'center', c: CH.ink3 }); }
  for (let i = 0.01; i < ym; i += 0.01) txt(ctx, String(Math.round(i * 1000)), L - 4, Y(i) + fs * 0.3, { fs: fs * 0.7, a: 'right', c: CH.ink3 });
  txt(ctx, 'mA', L - 4, T - fs * 0.2, { fs: fs * 0.7, a: 'right', c: CH.ink3 });
  ctx.strokeStyle = CH.ink3; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
  ctx.strokeStyle = CH.ink; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let k = 0; k <= 200; k++) { const v = x0 + (x1 - x0) * k / 200, q = [X(v), Y(C.f(v, sim.p))]; k ? ctx.lineTo(...q) : ctx.moveTo(...q); }
  ctx.stroke();
  (C.marks || []).forEach(m => { const i = C.f(m.v, sim.p); ctx.fillStyle = CH.blue; ctx.beginPath(); ctx.arc(X(m.v), Y(i), fs * 0.25, 0, 7); ctx.fill(); txt(ctx, m.label, X(m.v) - fs * 0.4, Y(i) - fs * 0.5, { fs: fs * 0.68, a: 'right', c: CH.blue, w: 900 }); });
  const cur = C.cur(sim.sol, sim.p);
  if (sim.power && cur) { dot(ctx, X(clamp(cur[0], x0, x1)), Y(cur[1]), fs * 0.4, cur[1] > C.Imax ? 'rgba(201,54,42,A)' : 'rgba(232,119,46,A)', pulseOf(t)); }
  txt(ctx, C.title(sim.sol, sim.p), L, T - fs * 1.0, { fs: fs * 0.82, c: CH.ink, w: 900 });
}
/* ---------- barras de corrente por ramo, com o limite ---------- */
function drawBars(ctx, w, h, sim, t) {
  const C = sim.cfg.barsChart(sim.sol, sim.p), fs = chartFont(w), L = fs * 2.8, R = w - fs * 0.8, T = fs * 2.4, B = h - fs * 1.9;
  const n = C.items.length, bw = (R - L) / n;
  const raw = C.max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), stepv = [1, 2, 2.5, 5, 10].map(m => m * mag).find(m => m >= raw);
  const ym = Math.ceil(C.max / stepv - 1e-9) * stepv, Y = v => B - clamp(v / ym, 0, 1.04) * (B - T);
  for (let v = 0; v <= ym + 1e-12; v += stepv) { ctx.strokeStyle = CH.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke(); txt(ctx, C.tick(v), L - 4, Y(v) + fs * 0.3, { fs: fs * 0.68, a: 'right', c: CH.ink3 }); }
  C.items.forEach((it, k) => {
    const x = L + k * bw + bw * 0.18, ww = bw * 0.64, v = sim.power ? it.v : 0, over = v > C.limit + 1e-12;
    ctx.fillStyle = it.dead ? '#9A9A9A' : over ? CH.bad : (it.color || CH.orange); ctx.fillRect(x, it.dead ? B - fs * 1.6 : Y(v), ww, it.dead ? fs * 1.6 : B - Y(v));
    if (v > ym) { ctx.fillStyle = CH.bad; txt(ctx, '↑', x + ww / 2, T - 2, { fs, a: 'center', c: CH.bad, w: 900 }); }
    txt(ctx, it.label, x + ww / 2, B + fs * 1.05, { fs: fs * (n > 6 ? 0.66 : 0.74), a: 'center', c: CH.ink2, w: 900 });
    if (it.dead) txt(ctx, n > 4 ? '✕' : 'queimado', x + ww / 2, B - 6, { fs: fs * (n > 4 ? 0.8 : 0.68), a: 'center', c: '#fff', w: 900 });
    else if (n <= 8 && v > 0) { const inside = B - Y(v) > fs * 1.5; txt(ctx, C.fmt(v), x + ww / 2, inside ? Y(v) + fs * 1.05 : Y(v) - 4, { fs: fs * (n > 4 ? 0.58 : 0.72), a: 'center', c: inside ? '#fff' : over ? CH.bad : CH.ink, w: 900 }); }
  });
  ctx.strokeStyle = CH.bad; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(L, Y(C.limit)); ctx.lineTo(R, Y(C.limit)); ctx.stroke(); ctx.setLineDash([]);
  if (C.ref !== undefined) { ctx.strokeStyle = CH.ok; ctx.lineWidth = 1.4; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(L, Y(C.ref)); ctx.lineTo(R, Y(C.ref)); ctx.stroke(); ctx.setLineDash([]); }
  txt(ctx, C.title, L, T - fs * 1.15, { fs: fs * 0.82, c: CH.ink, w: 900 });
  txt(ctx, '- - ' + C.limitLabel, R, T - fs * 1.15, { fs: fs * 0.68, a: 'right', c: CH.bad, w: 900 });
  if (C.ref !== undefined) txt(ctx, '· · ' + C.refLabel, R, T - fs * 0.15, { fs: fs * 0.68, a: 'right', c: CH.ok, w: 900 });
}
/* ---------- corrente de pico × média na multiplexação ---------- */
function drawMuxWave(ctx, w, h, sim, t) {
  const C = sim.cfg.muxwave(sim.sol, sim.p), fs = chartFont(w), L = fs * 2.8, R = w - fs * 0.8, T = fs * 2.4, B = h - fs * 1.9;
  const ym = C.ymax, Y = i => B - clamp(i / ym, 0, 1.02) * (B - T), cycles = 2, X = u => L + u / cycles * (R - L);
  for (let k = 0; k <= 4; k++) { const v = ym * k / 4; ctx.strokeStyle = CH.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke(); txt(ctx, String(Math.round(v * 1000)), L - 4, Y(v) + fs * 0.3, { fs: fs * 0.68, a: 'right', c: CH.ink3 }); }
  txt(ctx, 'mA', L - 4, T - fs * 1.0, { fs: fs * 0.68, a: 'right', c: CH.ink3 });
  const lim = (v, lab, col, dash) => { if (v > ym) return; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke(); ctx.setLineDash([]); txt(ctx, lab, R, Y(v) - 4, { fs: fs * 0.7, a: 'right', c: col, w: 900 }); };
  lim(C.IFP, `I_FP = ${num(C.IFP * 1000, 0)} mA (pulsada)`, CH.bad, [6, 4]); lim(C.IFmax, `I_F,máx = ${num(C.IFmax * 1000, 0)} mA (contínua)`, CH.warn, [6, 4]);
  // pulsos de um segmento do dígito 1
  ctx.fillStyle = 'rgba(232,119,46,.25)'; ctx.strokeStyle = CH.orange; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(0), B);
  for (let c = 0; c < cycles; c++) { ctx.lineTo(X(c), Y(C.Ipk)); ctx.lineTo(X(c + C.duty), Y(C.Ipk)); ctx.lineTo(X(c + C.duty), B); ctx.lineTo(X(c + 1), B); }
  ctx.stroke(); ctx.globalAlpha = 0.6;
  for (let c = 0; c < cycles; c++) ctx.fillRect(X(c), Y(C.Ipk), X(c + C.duty) - X(c), B - Y(C.Ipk));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = CH.ok; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(L, Y(C.Iavg)); ctx.lineTo(R, Y(C.Iavg)); ctx.stroke();
  txt(ctx, `média = ${num(C.Iavg * 1000, 2)} mA`, X(C.duty) + 6, Y(C.Iavg) - 5, { fs: fs * 0.76, c: CH.ok, w: 900 });
  txt(ctx, `pico = ${num(C.Ipk * 1000, 1)} mA`, X(C.duty) + 6, Y(C.Ipk) - 5, { fs: fs * 0.76, c: CH.orange, w: 900 });
  for (let c = 0; c < cycles; c++) for (let d = 0; d < 4; d++) txt(ctx, 'D' + (d + 1), X(c + (d + 0.5) / 4), B + fs * 1.05, { fs: fs * 0.62, a: 'center', c: d ? CH.ink3 : CH.orange, w: 900 });
  // cursor da varredura
  if (sim.power && C.phase !== undefined) { const u = C.phase % cycles; ctx.strokeStyle = CH.ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X(u), T); ctx.lineTo(X(u), B); ctx.stroke(); }
  txt(ctx, 'segmento do dígito 1 (D1 aceso 1/4 do tempo)', L, T - fs * 1.0, { fs: fs * 0.78, c: CH.ink, w: 900 });
}

const CHART_KINDS = {
  iv: { title: 'Curva I×V do Zener', fn: drawIV },
  ll: { title: 'Reta de carga', fn: drawLL },
  res: { title: 'Resistência do Zener', fn: drawRes },
  sankey: { title: 'Fluxo de energia', fn: drawSankey },
  vavi: { title: 'V_A e V_B × V_i', fn: drawVaVi },
  lsb: { title: 'Lupa em mV × 1 LSB', fn: drawLSB },
  win: { title: 'Janela de carga', fn: drawWin },
  rsrange: { title: 'R_S possíveis', fn: drawRsRange },
  ifv: { title: 'I_F × tensão da fonte', fn: drawIFV },
  bars: { title: 'Corrente por ramo', fn: drawBars },
  muxwave: { title: 'Pico × média', fn: drawMuxWave },
};
class ChartRow {
  constructor(host, sim, kinds, titles) {
    this.sim = sim; this.items = [];
    host.innerHTML = '';
    host.style.gridTemplateColumns = window.innerWidth > 860 ? `repeat(${kinds.length}, minmax(0, 1fr))` : '';
    for (const k of kinds) {
      const d = document.createElement('div'); d.className = 'chart'; d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', 'Ampliar: ' + CHART_KINDS[k].title);
      d.innerHTML = `<h5>${sub((titles || {})[k] || (sim.cfg.chartTitles || {})[k] || CHART_KINDS[k].title)}</h5><canvas></canvas>`;
      host.appendChild(d);
      const cv = d.querySelector('canvas');
      d.addEventListener('click', () => BigChart.open(sim, k));
      d.addEventListener('keydown', e => { if (e.key === 'Enter') BigChart.open(sim, k); });
      this.items.push({ k, cv });
    }
  }
  draw(t) { for (const it of this.items) { const c = setupCanvas(it.cv); if (c) CHART_KINDS[it.k].fn(c.ctx, c.w, c.h, this.sim, t); } }
}
/* gráfico ampliado (clique em um painel) */
const BigChart = (() => {
  let ov, cv, ttl, sim = null, kind = null, on = false;
  function build() {
    ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet chart-sheet"><h2><span></span><button class="xbtn" type="button">Fechar (Esc)</button></h2><canvas></canvas></div>`;
    document.body.appendChild(ov); cv = ov.querySelector('canvas'); ttl = ov.querySelector('h2 span');
    ov.querySelector('.xbtn').addEventListener('click', close); ov.addEventListener('click', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && on) close(); });
  }
  function open(s, k) { if (!ov) build(); sim = s; kind = k; ttl.innerHTML = sub(CHART_KINDS[k].title); ov.classList.add('on'); on = true; }
  function close() { ov.classList.remove('on'); on = false; }
  function draw(t) { if (!on) return; const c = setupCanvas(cv); if (c) CHART_KINDS[kind].fn(c.ctx, c.w, c.h, sim, t); }
  return { open, close, draw, isOpen: () => on };
})();

/* =====================================================================
   QUESTÃO 1 — Zener no barramento de 24 V do CLP
   R_S = 470 Ω, 1N4744A (V_Z = 15 V, P_ZM = 1 W, I_ZK ≈ 0,25 mA)
   Tudo o que aparece na tela (números, partículas, cores, gráficos)
   sai do solver abaixo, que segue o roteiro da página 1 da lista.
   ===================================================================== */

/* ---------- solver genérico do regulador Zener em paralelo ----------
   p: { power, Vi, RS, RL, load:'on'|'none', loadStyle:'R'|'module',
        zener:true|false, RSrating (W ou null), damage:{DZ,RS} }
   z: { Vz, Pzm, Izk }                                                  */
function solveShunt(p, z) {
  const dmg = p.damage || {};
  const Vi = p.power ? p.Vi : 0, RS = p.RS;
  const loadOn = p.load !== 'none', RL = loadOn ? p.RL : Infinity;
  const present = p.zener !== false;
  // Passo 2 do roteiro: retire o Zener e calcule a tensão de teste
  const Vtest = loadOn ? Vi * RL / (RS + RL) : Vi;
  const Rth = loadOn ? RS * RL / (RS + RL) : RS;            // Thévenin visto pelo Zener
  let VA, IR, IZ, IL, mode;
  if (dmg.RS) { mode = !present ? 'absent' : dmg.DZ ? 'short' : 'nopower'; VA = 0; IR = IZ = IL = 0; }
  else if (!present) { mode = 'absent'; VA = Vtest; IZ = 0; IR = IL = loadOn ? Vi / (RS + RL) : 0; }
  else if (dmg.DZ) { mode = 'short'; VA = 0; IL = 0; IR = Vi / RS; IZ = IR; }
  else if (Vi > 0 && Vtest >= z.Vz) {                        // Passo 3: V ≥ V_Z → ligado (fonte V_Z)
    mode = 'bd'; VA = z.Vz; IR = (Vi - VA) / RS; IL = loadOn ? VA / RL : 0; IZ = IR - IL;   // Passos 4 e 5
  } else { mode = 'off'; VA = Vtest; IZ = 0; IR = IL = loadOn ? Vi / (RS + RL) : 0; }       // desligado = aberto
  const PRS = (Vi - VA) * IR, PZ = mode === 'short' ? 0 : VA * IZ, PL = VA * IL, Pin = Vi * IR;
  const loadShow = (style) => p.loadStyle === style ? (loadOn ? 'on' : 'disc') : 'hidden';
  let pill;
  if (mode === 'nopower') pill = { text: 'SEM ALIMENTAÇÃO (R_S ABERTO)', kind: 'mute' };
  else if (mode === 'off') pill = { text: 'BLOQUEADO · V < V_Z', kind: 'off' };
  else if (mode === 'absent') pill = { text: 'REMOVIDO (TESTE)', kind: 'mute' };
  else if (mode === 'short') pill = { text: 'QUEIMADO · EM CURTO', kind: 'bad' };
  else if (PZ > z.Pzm) pill = { text: 'ACIMA DE P_ZM!', kind: 'bad' };
  else if (IZ < 4 * z.Izk) pill = { text: 'NO JOELHO · I_Z ≈ I_ZK', kind: 'warn' };
  else pill = { text: 'REGULANDO EM V_Z', kind: 'on' };
  return {
    V: { P: Vi, A: VA, G: 0 }, I: { IR, IZ, IL }, vmax: Math.max(p.Vi, 1),
    comp: {
      Vi: {},
      RS: { P: PRS, Pmax: p.RSrating || null, failCause: `P_RS = ${fP(PRS)} > ${fW(p.RSrating || 0)} (nominal)` },
      DZ: { mode, show: present ? 'on' : 'ghost', P: PZ, Pmax: z.Pzm, I: IZ, V: VA, vAcross: VA, pill, failCause: `P_Z = ${fP(PZ)} > P_ZM = ${fW(z.Pzm)}` },
      RL: { show: loadShow('R'), P: PL },
      MOD: { show: loadShow('module'), P: PL },
    },
    zop: dmg.RS ? { state: 'nopower' } : { state: mode, V: mode === 'off' || mode === 'absent' ? Vtest : VA, I: IZ, Vth: Vtest, Rth },
    ex: { Vtest, Rth, PRS, PZ, PL, Pin, eta: Pin > 0 ? PL / Pin : 0, mode },
  };
}

const Q1Z = { Vz: 15, Pzm: 1, Izk: 0.25e-3 };
const Q1 = {};
Q1.calc = (params) => solveShunt(Object.assign({ power: true, Vi: 24, RS: 470, RL: 2200, load: 'on', loadStyle: 'R', zener: true }, params), Q1Z);
Q1.RLmin = (RS = 470, Vi = 24) => RS * Q1Z.Vz / (Vi - Q1Z.Vz);           // = 783 Ω
Q1.RSnew = () => e12Below((24 - 15) / (0.022 + 0.005));                  // = 330 Ω (E12 abaixo)

/* ---------- esquemático (coordenadas no viewBox 1000 × 600) ---------- */
Q1.circuit = {
  viewBox: [1000, 600], Iref: 0.02,
  defaults: { Vi: 24, RS: 470, RL: 2200, load: 'on', loadStyle: 'R', zener: true, RSrating: null },
  solve: p => solveShunt(p, Q1Z),
  zoomComp: 'DZ',
  zener: { Vz: 15, Pzm: 1, Izk: 0.25e-3, rzDraw: 14, Zzk: 700, Vxmax: 20, LLVmax: 26, LLImax: 0.09, note: 'curva com r_z = 14 Ω (datasheet) · cálculos com Zener ideal' },
  meterAt: [784, 494], meterDefault: ['A', 'G'], legendAt: [24, 572],
  probePoints: { A: [800, 105], G: [800, 470], P: [180, 105] },
  comps: {
    Vi: { type: 'dc', x: 110, y: 288, r: 34, label: p => fV(p.Vi, Number.isInteger(p.Vi) ? 0 : 1).replace(/,0 V$/, ' V') },
    RS: { type: 'res', a: [250, 105], b: [360, 105], amp: 13, nodes: ['P', 'A'], Tmax: 155, failMode: 'open', failTitle: 'Resistor R_S queimado (abriu)' },
    DZ: { type: 'zener', a: [470, 306], k: [470, 270], w: 38, zoom: true, zoomName: 'D_Z · 1N4744A (15 V)', Vz: 15, Tmax: 200, failMode: 'short', failTitle: 'Zener queimado — virou curto' },
    RL: { type: 'res', a: [710, 240], b: [710, 336], amp: 14, variable: true, nodes: ['A', 'G'] },
    MOD: { type: 'module', a: [710, 240], b: [710, 336], w: 78, lines: ['Módulo', '15 V', '22 mA'] },
  },
  wires: [
    { node: 'P', cur: 'IR', pts: [[110, 254], [110, 105], [250, 105]] },
    { node: 'A', cur: 'IR', pts: [[360, 105], [470, 105]] },
    { node: 'A', cur: 'IL', pts: [[470, 105], [710, 105]] },
    { node: 'A', cur: 'IZ', pts: [[470, 105], [470, 270]] },
    { node: 'G', cur: 'IZ', pts: [[470, 306], [470, 470]] },
    { node: 'A', cur: 'IL', pts: [[710, 105], [710, 240]] },
    { node: 'G', cur: 'IL', pts: [[710, 336], [710, 470]] },
    { node: 'G', cur: 'IL', pts: [[710, 470], [470, 470]] },
    { node: 'G', cur: 'IR', pts: [[470, 470], [110, 470], [110, 322]] },
    { node: 'A', idle: true, pts: [[710, 105], [920, 105]] },
    { node: 'G', idle: true, pts: [[710, 470], [920, 470]] },
  ],
  edges: [
    { id: 'src', cur: 'IR', spawn: true, path: [[110, 470], [110, 322], { comp: 'Vi' }, [110, 254], [110, 105], [250, 105]] },
    { id: 'rs', cur: 'IR', path: [[250, 105], { comp: 'RS' }, [360, 105]] },
    { id: 'a1', cur: 'IR', path: [[360, 105], [470, 105]] },
    { id: 'z', cur: 'IZ', dep: 'DZ', path: [[470, 105], [470, 270], { comp: 'DZ', rev: true }, [470, 470]] },
    { id: 'ab', cur: 'IL', path: [[470, 105], [710, 105]] },
    { id: 'l', cur: 'IL', dep: 'RL', path: [[710, 105], [710, 240], { comp: 'RL' }, [710, 470]] },
    { id: 'lm', cur: 'IL', dep: 'MOD', path: [[710, 105], [710, 240], { comp: 'MOD' }, [710, 470]] },
    { id: 'bg', cur: 'IL', path: [[710, 470], [470, 470]] },
    { id: 'g', cur: 'IR', path: [[470, 470], [110, 470]] },
  ],
  dots: [[470, 105], [710, 105], [470, 470], [710, 470]],
  terms: [[920, 105], [920, 470]],
  arrows: [
    { a: [386, 80], b: [446, 80], t: 'I_R', tx: 458, ty: 87, anchor: 'start' },
    { a: [443, 262], b: [443, 316], t: 'I_Z', tx: 431, ty: 296, anchor: 'end' },
    { a: [655, 262], b: [655, 316], t: 'I_L', tx: 643, ty: 296, anchor: 'end' },
  ],
  labels: [
    { t: 'R_S', x: 305, y: 80, cls: 'nm', anchor: 'middle' },
    { t: p => fR(p.RS), x: 305, y: 148, cls: 'val', anchor: 'middle' },
    { t: 'D_Z', x: 494, y: 268, cls: 'nm' },
    { t: 'V_Z = 15 V', x: 494, y: 294, cls: 'val' },
    { t: 'P_ZM = 1 W', x: 494, y: 318, cls: 'val' },
    { t: 'R_L', x: 735, y: 282, cls: 'nm', when: p => p.loadStyle === 'R' },
    { t: p => fR(p.RL), x: 735, y: 308, cls: 'val', when: p => p.loadStyle === 'R' },
    { t: '+', x: 920, y: 150, cls: 'sym' },
    { t: 'V_L', x: 920, y: 300, cls: 'val strong', anchor: 'middle' },
    { t: '−', x: 920, y: 440, cls: 'sym' },
  ],
  values: [
    { id: 'IR', cur: 'IR', x: 416, y: 50, anchor: 'middle', fn: s => `I_R = ${fI(s.I.IR)}` },
    { id: 'IZ', cur: 'IZ', x: 455, y: 212, anchor: 'end', fn: s => `I_Z = ${fI(s.I.IZ)}`, when: s => s.comp.DZ.show === 'on' },
    { id: 'IL', cur: 'IL', x: 700, y: 212, anchor: 'end', fn: s => `I_L = ${fI(s.I.IL)}` },
    { id: 'VL', x: 920, y: 346, anchor: 'middle', fn: s => fV(s.V.A) },
  ],
  pills: [{ comp: 'DZ', x: 494, y: 352 }],
  bars: [
    { comp: 'DZ', x: 494, y: 390, w: 150, label: 'P_Z / P_ZM' },
    { comp: 'RS', x: 140, y: 182, w: 96, label: 'P_RS / P_nom' },
  ],
  discs: [{ comp: 'RL', at: [710, 172], text: 'carga desconectada' }, { comp: 'MOD', at: [710, 172], text: 'módulo desconectado' }],
  relevo: {
    cur: 'IR',
    segs: (p, s) => [
      { kind: 'rise', to: s.V.P, label: 'fonte' },
      { kind: 'flat', node: 'P' },
      { kind: 'drop', to: s.V.A, label: 'R_S' },
      { kind: 'flat', node: 'A', name: 'V_L' },
      { kind: 'drop', to: 0, label: s.comp.DZ.mode === 'bd' ? (p.load === 'none' ? 'D_Z' : 'D_Z ∥ carga') : (p.load === 'none' ? 'D_Z' : (s.comp.DZ.show === 'on' ? 'carga (Zener aberto)' : 'R_L')) },
      { kind: 'flat', node: 'G' },
    ],
    ref: () => ({ v: 15, label: 'V_Z = 15 V' }),
  },
  sankey: (s, p) => ({
    Pin: s.ex.Pin, eta: s.ex.eta, Pref: 0.65,
    sinks: [
      { label: 'calor em R_S', P: s.ex.PRS, color: 'rgba(232,119,46,A)' },
      { label: 'calor no Zener', P: s.ex.PZ, color: 'rgba(201,54,42,A)' },
      { label: 'útil na carga', P: s.ex.PL, color: 'rgba(35,136,79,A)' },
    ],
  }),
};

/* ---------- ilustração da situação real: CLP + regulador + sensor ---------- */
Q1.illus = `<svg viewBox="0 0 560 340" role="img" aria-label="Painel com CLP, regulador Zener e sensor">
  <rect x="8" y="8" width="544" height="324" rx="18" fill="#E8EDF5"/>
  <rect x="24" y="40" width="300" height="10" rx="3" fill="#9AA6BC"/>
  <rect x="24" y="150" width="300" height="12" rx="3" fill="#B6C0D2"/>
  <g>
    <rect x="34" y="62" width="88" height="186" rx="8" fill="#2B3A5E"/>
    <text x="78" y="92" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="14" text-anchor="middle">FONTE</text>
    <text x="78" y="112" fill="#FFD7B8" font-family="Lato,sans-serif" font-weight="700" font-size="13" text-anchor="middle">24 V CC</text>
    <circle cx="56" cy="134" r="6" fill="#53D18B"/><text x="68" y="139" fill="#C9D3E6" font-family="Lato,sans-serif" font-size="11">DC OK</text>
    <g fill="#C9D3E6"><circle cx="50" cy="228" r="7"/><circle cx="70" cy="228" r="7"/><circle cx="90" cy="228" r="7"/><circle cx="110" cy="228" r="7"/></g>
    <rect x="130" y="62" width="96" height="186" rx="8" fill="#34466F"/>
    <text x="178" y="92" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="14" text-anchor="middle">CLP</text>
    <circle cx="148" cy="118" r="5" fill="#53D18B"/><text x="158" y="122" fill="#C9D3E6" font-family="Lato,sans-serif" font-size="11">RUN</text>
    <circle cx="148" cy="136" r="5" fill="#6B7894"/><text x="158" y="140" fill="#C9D3E6" font-family="Lato,sans-serif" font-size="11">ERR</text>
    <rect x="146" y="190" width="64" height="30" rx="4" fill="#26324F"/>
    <rect x="234" y="62" width="80" height="186" rx="8" fill="#3E5381"/>
    <text x="274" y="92" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="14" text-anchor="middle">E/S</text>
    <g fill="#E8772E"><rect x="248" y="112" width="10" height="6" rx="2"/><rect x="248" y="126" width="10" height="6" rx="2"/><rect x="248" y="140" width="10" height="6" rx="2"/></g>
    <g fill="#C9D3E6"><circle cx="252" cy="228" r="6"/><circle cx="274" cy="228" r="6"/><circle cx="296" cy="228" r="6"/></g>
  </g>
  <path d="M70 235 C70 300, 300 300, 352 262" stroke="#D9452B" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M90 235 C90 312, 300 318, 352 290" stroke="#1F2D4D" stroke-width="5" fill="none" stroke-linecap="round"/>
  <text x="170" y="322" fill="#47536E" font-family="Lato,sans-serif" font-weight="700" font-size="13">barramento 24 V CC</text>
  <rect x="350" y="228" width="104" height="80" rx="8" fill="#2E7D5B"/>
  <rect x="364" y="248" width="40" height="12" rx="6" fill="#E9D7B3"/><rect x="372" y="248" width="4" height="12" fill="#7A4A1E"/><rect x="380" y="248" width="4" height="12" fill="#1F2D4D"/><rect x="390" y="248" width="4" height="12" fill="#7A4A1E"/>
  <rect x="368" y="276" width="30" height="12" rx="6" fill="#F3B07A"/><rect x="392" y="276" width="5" height="12" fill="#1F2D4D"/>
  <text x="402" y="300" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="11" text-anchor="middle">R_S + D_Z</text>
  <text x="402" y="222" fill="#1F2D4D" font-family="Lato,sans-serif" font-weight="900" font-size="13" text-anchor="middle">regulador</text>
  <path d="M454 268 C480 268, 470 196, 494 196" stroke="#2C9C9C" stroke-width="5" fill="none" stroke-linecap="round"/>
  <rect x="494" y="150" width="40" height="96" rx="10" fill="#9AA6BC"/>
  <rect x="490" y="168" width="48" height="14" rx="3" fill="#7D879E"/><rect x="490" y="208" width="48" height="14" rx="3" fill="#7D879E"/>
  <rect x="500" y="246" width="28" height="12" rx="4" fill="#E8772E"/>
  <text x="514" y="138" fill="#1F2D4D" font-family="Lato,sans-serif" font-weight="900" font-size="13" text-anchor="middle">sensor</text>
  <text x="474" y="186" fill="#2C9C9C" font-family="Lato,sans-serif" font-weight="900" font-size="13" text-anchor="end">15 V</text>
</svg>`;

/* ---------- etapas ---------- */
const baseQ1 = { Vi: 24, RS: 470, RL: 2200, load: 'on', loadStyle: 'R', zener: true, RSrating: null };
const P = (o) => Object.assign({}, baseQ1, o);

Q1.slides = [
  {
    type: 'context', hash: 'q1', q: 1, kind: 'Diodo Zener · ligado ou desligado?',
    title: 'Um sensor de 15 V no barramento de 24 V do CLP',
    story: 'O barramento de 24 V CC de um CLP precisa alimentar um módulo de sensor que exige <b>15 V estáveis</b>. Um técnico montou um regulador com um resistor série e um Zener.',
    chips: [['V_i = 24 V'], ['R_S = 470 Ω'], ['1N4744A', 'o'], ['V_Z = 15 V'], ['P_ZM = 1 W'], ['I_ZK ≈ 0,25 mA'], ['R_L = 680 Ω ou 2,2 kΩ', 'o']],
    items: [['A', 'a)', '“O Zener é de 15 V, então a carga sempre recebe 15 V”?'], ['B', 'b)', 'R_L = 680 Ω: estado, V_L, I_L, I_Z'], ['C', 'c)', 'R_L = 2,2 kΩ e o menor R_L que regula'], ['D', 'd)', 'Módulo de 22 mA: novo R_S (E12)']],
    trains: 'Treina: teste de estado (ligado/desligado), R_L,mín, reprojeto de R_S.',
    notes: { tempo: '3 min', perguntas: ['Quem já abriu um painel com CLP? Quais tensões aparecem lá?', 'Por que não alimentar o sensor direto em 24 V?'], erros: [], dica: 'Situe o problema: 24 V é o padrão industrial; muitos sensores e módulos pedem tensões menores e estáveis.' },
  },
  {
    type: 'circuit', hash: 'q1-circuito', q: 1, title: 'O circuito da Figura 1',
    circuit: Q1.circuit,
    steps: [
      { t: 'Antes de ligar', p: 'Identifique a <b>alimentação</b> (24 V do CLP), o <b>resistor série</b> $R_S$ e os dois ramos em paralelo no nó de saída: o <b>Zener</b> e a <b>carga</b> $R_L$.', eq: [() => 'V_i = 24\\,\\text{V},\\quad R_S = 470\\,\\Omega,\\quad V_Z = 15\\,\\text{V}'],
        scene: { params: P({ RL: 2200 }), power: false, cta: true, values: 'none', highlight: ['Vi'] } },
      { t: 'Ligue a fonte', p: 'Cada ponto amarelo é um "pacote" de carga no sentido convencional. <b>Velocidade e densidade crescem com a corrente.</b> No nó de saída as partículas se dividem entre o Zener e a carga.',
        callout: { k: 'dica', t: 'Dica do professor', x: 'Use <b>Câmera lenta</b> para contar as partículas que chegam ao nó e as que saem por cada ramo: a soma fecha (Lei dos Nós).' },
        scene: { params: P({ RL: 2200 }), power: true, values: 'none' } },
      { t: 'Cor do fio = potencial', p: 'Os fios mudam de cor conforme a tensão em relação ao terra: <b>azul-escuro em 0 V</b> até <b>vermelho em 24 V</b>. Passe o mouse sobre um fio para ler o potencial. Os valores numéricos aparecem nos itens.',
        callout: { k: 'atencao', t: 'Atenção', x: 'Os terminais de saída não têm corrente (fio mais apagado), mas <b>têm potencial</b>: tensão e corrente são grandezas diferentes.' },
        scene: { params: P({ RL: 2200 }), values: 'none' } },
    ],
    notes: { tempo: '4 min', perguntas: ['Qual o sentido de I_R? E de I_Z? (o Zener está em polarização reversa)', 'Onde a corrente se divide? Onde ela volta a se juntar?'], erros: ['Desenhar o Zener com o catodo para baixo (polarização direta): ele conduziria com 0,7 V e não regularia.'], dica: 'Deixe a turma prever o comportamento antes de clicar em LIGAR A FONTE.' },
  },
  {
    type: 'item', hash: 'q1-a', q: 1, level: 'A', letter: 'a', title: 'O Zener “sempre” entrega 15 V?',
    enun: '<b>a)</b> O técnico afirma: “o Zener é de 15 V, então a carga sempre recebe 15 V”. Explique por que a afirmação é falsa e qual teste precisa ser feito antes de substituir o Zener por uma fonte V<sub>Z</sub>.',
    circuit: Q1.circuit,
    steps: [
      { t: 'O Zener não é uma fonte', p: 'O Zener só mantém $V_Z$ quando está em <b>ruptura</b>. Para chegar lá, o restante do circuito precisa conseguir aplicar sobre ele <b>pelo menos</b> $V_Z$.', eq: [() => '\\text{Zener regula} \\iff V_{\\text{teste}} \\ge V_Z'],
        scene: { params: P({ RL: 2200 }), values: 'none', highlight: ['DZ'] } },
      { t: 'Passo 1: retire o Zener', p: 'Sem o Zener sobra um <b>divisor de tensão</b> entre $R_S$ e $R_L$. A tensão sobre a carga é a <b>tensão de teste</b> $V$. O voltímetro mede entre a saída e o terra.', eq: [() => 'V = V_i\\,\\dfrac{R_L}{R_S + R_L}'],
        scene: { params: P({ RL: 2200, zener: false }), values: [], probes: ['A', 'G'] } },
      { t: 'Teste no relevo: R_L = 2,2 kΩ', p: 'Com 2,2 kΩ o divisor entrega <b>mais que 15 V</b>: se o Zener estivesse lá, entraria em ruptura.', eq: [s => `V = 24\\cdot\\dfrac{2200}{470+2200} = ${tV(s.ex.Vtest)} \\ge 15\\,\\text{V}`],
        scene: { params: P({ RL: 2200, zener: false }), view: 'relevo' } },
      { t: 'Mesmo teste com R_L = 680 Ω', p: 'A carga de 680 Ω puxa mais corrente, a queda em $R_S$ aumenta e a tensão de teste fica <b>abaixo da linha de 15 V</b>.', eq: [s => `V = 24\\cdot\\dfrac{680}{470+680} = ${tV(s.ex.Vtest)} < 15\\,\\text{V}`],
        scene: { params: P({ RL: 680, zener: false }), view: 'relevo' } },
      { t: 'Recoloque o Zener (680 Ω)', p: 'O Zener continua <b>bloqueado</b>: as cargas se acumulam na barreira e nenhuma corrente passa por ele. A carga recebe 14,19 V, não 15 V.', eq: [s => `V_L = ${tV(s.V.A)} \\neq V_Z`],
        scene: { params: P({ RL: 680 }), view: 'sch', values: ['VL', 'IL', 'IR', 'IZ', 'DZ:pill'] } },
      { t: 'Conclusão: o teste de estado', p: 'Antes de trocar o Zener por uma fonte de 15 V, <b>retire o Zener e calcule V</b>. O modelo "fonte $V_Z$" só vale se $V \\ge V_Z$. Compare os dois casos:',
        eq: [() => '\\begin{cases} V \\ge V_Z & \\Rightarrow\\ \\text{ligado: } V_L = V_Z \\\\ V < V_Z & \\Rightarrow\\ \\text{desligado (aberto): } V_L = V \\end{cases}'],
        widget: { type: 'seg', param: 'RL', options: [[680, 'R_L = 680 Ω'], [2200, 'R_L = 2,2 kΩ']] },
        scene: { params: P({ RL: 2200 }), view: 'sch' },
        result: () => [['Afirmação', 'falsa: depende da carga'], ['Teste', 'retirar o Zener e calcular V'], ['R_L = 2,2 kΩ', `V = ${fV(Q1.calc({ RL: 2200 }).ex.Vtest)} → ligado`], ['R_L = 680 Ω', `V = ${fV(Q1.calc({ RL: 680 }).ex.Vtest)} → desligado`]] },
    ],
    notes: { tempo: '8 min', perguntas: ['Se eu tirar a carga, quanto vale a tensão de teste?', 'O que a barreira desenhada no Zener representa fisicamente?'], erros: ['Tratar o Zener como fonte de 15 V sem verificar o estado.', 'Achar que "Zener de 15 V" significa que ele fornece energia: ele só absorve corrente.'], dica: 'Mostre o relevo: a linha tracejada de 15 V é o "nível" que o divisor precisa alcançar.' },
  },
  {
    type: 'item', hash: 'q1-b', q: 1, level: 'B', letter: 'b', title: 'R_L = 680 Ω: o Zener liga?',
    enun: '<b>b)</b> Com R<sub>L</sub> = 680 Ω, determine o estado do Zener, V<sub>L</sub>, I<sub>L</sub> e I<sub>Z</sub>.',
    circuit: Q1.circuit,
    steps: [
      { t: 'Dados do circuito', p: 'Passo 1 do roteiro: identifique $V_i$, $R_S$, a carga e o Zener. O circuito ainda está desligado.', eq: [() => 'V_i = 24\\,\\text{V},\\ R_S = 470\\,\\Omega,\\ R_L = 680\\,\\Omega,\\ V_Z = 15\\,\\text{V}'],
        scene: { params: P({ RL: 680 }), power: false, values: 'none', highlight: ['RL'] } },
      { t: 'Retire o Zener e calcule V', p: 'Passo 2: com o Zener fora, $R_S$ e $R_L$ formam um divisor.', eq: [s => `V = 24\\cdot\\dfrac{680}{470+680} = ${tV(s.ex.Vtest)}`],
        scene: { params: P({ RL: 680, zener: false }), power: true, values: [], probes: ['A', 'G'] } },
      { t: 'Compare com V_Z', p: 'Passo 3: $14{,}19 < 15$ V. A tensão disponível não alcança a ruptura: <b>Zener desligado</b>, ou seja, um circuito aberto. Repare na barreira e nas cargas acumuladas.', eq: [s => `V = ${tV(s.ex.Vtest)} < V_Z = 15\\,\\text{V}`, () => `\\Rightarrow\\ \\text{Zener desligado (aberto)}`],
        scene: { params: P({ RL: 680 }), values: ['DZ:pill'] } },
      { t: 'E se eu supusesse “ligado”?', p: 'Suponha (errado) que $V_L = 15$ V e calcule as correntes:', eq: [() => `I_R = \\dfrac{9}{470} = ${tmA(9 / 470)}`, () => `I_L = \\dfrac{15}{680} = ${tmA(15 / 680)}`, () => `I_Z = I_R - I_L = ${tmA(9 / 470 - 15 / 680)} < 0`],
        callout: { k: 'erro', t: 'Erro comum', x: 'Corrente negativa no Zener é impossível: ele não fornece corrente reversa. O sinal negativo denuncia que a hipótese "ligado" estava errada.' },
        scene: { params: P({ RL: 680 }), values: ['DZ:pill'] } },
      { t: 'Calcule com o Zener aberto', p: 'Toda a corrente de $R_S$ vai para a carga ($I_R = I_L$).', eq: [s => `V_L = V = ${tV(s.V.A)}`, s => `I_L = \\dfrac{V_L}{R_L} = \\dfrac{${tn(s.V.A, 2)}}{680} = ${tmA(s.I.IL)}`, () => 'I_Z = 0'],
        scene: { params: P({ RL: 680 }) } },
      { t: 'Interprete', p: 'A carga recebe 14,2 V em vez de 15 V: o regulador <b>não regula</b>. Na reta de carga, $V_{th} = 14{,}19$ V termina antes do joelho e o ponto de operação fica na região de bloqueio.',
        scene: { params: P({ RL: 680 }) },
        result: s => [['Estado do Zener', '<span class="pill off">desligado</span>'], ['V_L', fV(s.V.A)], ['I_L', fI(s.I.IL)], ['I_Z', '0 mA']] },
    ],
    notes: { tempo: '8 min', perguntas: ['Por que todas as partículas seguem para a carga?', 'Na reta de carga, onde estaria o ponto se V_th fosse maior que 15 V?'], erros: ['Supor ligado e chegar a I_Z negativo sem desconfiar.', 'Calcular V_L = 15 V direto, sem o teste.'], dica: 'Abra a curva I×V ampliada (clique no gráfico) e mostre a bolinha parada no trecho horizontal.' },
  },
  {
    type: 'item', hash: 'q1-c', q: 1, level: 'C', letter: 'c', title: 'R_L = 2,2 kΩ e o menor R_L',
    enun: '<b>c)</b> Com R<sub>L</sub> = 2,2 kΩ, calcule V<sub>L</sub>, I<sub>L</sub>, I<sub>R</sub>, I<sub>Z</sub>, P<sub>Z</sub> e a potência em R<sub>S</sub>. Determine o menor R<sub>L</sub> que mantém a regulação e use-o para explicar o item b).',
    circuit: Q1.circuit,
    steps: [
      { t: 'Teste de estado', p: 'Retire o Zener: o divisor agora entrega mais que $V_Z$.', eq: [s => `V = 24\\cdot\\dfrac{2200}{470 + 2200} = ${tV(s.ex.Vtest)}`, () => `${tV(Q1.calc({ RL: 2200 }).ex.Vtest)} \\ge 15\\,\\text{V}\\ \\Rightarrow\\ \\text{ligado}`],
        scene: { params: P({ RL: 2200, zener: false }), values: [], probes: ['A', 'G'] } },
      { t: 'Zener → fonte de 15 V', p: 'Ligado, o Zener fixa a tensão do nó de saída.', eq: [() => 'V_L = V_Z = 15\\,\\text{V}', s => `I_L = \\dfrac{V_L}{R_L} = \\dfrac{15}{2200} = ${tmA(s.I.IL)}`],
        scene: { params: P({ RL: 2200 }), values: ['VL', 'IL', 'DZ:pill'] } },
      { t: 'Corrente em R_S', p: 'A tensão sobre $R_S$ é a sobra: $V_i - V_Z$.', eq: [s => `I_R = \\dfrac{V_i - V_Z}{R_S} = \\dfrac{24 - 15}{470} = ${tmA(s.I.IR)}`],
        scene: { params: P({ RL: 2200 }), values: ['VL', 'IL', 'IR', 'DZ:pill'], highlight: ['RS'] } },
      { t: 'Lei dos Nós', p: 'No nó de saída a corrente se divide: parte vai para o Zener, parte para a carga. Conte as partículas em câmera lenta.', eq: [s => `I_Z = I_R - I_L = ${tn(s.I.IR * 1e3, 2)} - ${tn(s.I.IL * 1e3, 2)} = ${tmA(s.I.IZ)}`, () => 'I_Z \\gg I_{ZK} = 0{,}25\\,\\text{mA}\\ \\checkmark'],
        scene: { params: P({ RL: 2200 }) } },
      { t: 'Potências', p: 'Barras ao lado do Zener mostram $P_Z/P_{ZM}$. O fluxo de energia mostra para onde vai a potência da fonte.', eq: [s => `P_Z = V_Z I_Z = 15 \\times ${tmA(s.I.IZ)}`, s => `P_Z = ${tmW(s.ex.PZ)} \\le P_{ZM} = 1\\,\\text{W}`, s => `P_{R_S} = (V_i - V_Z)\\,I_R = 9 \\times ${tmA(s.I.IR)}`, s => `P_{R_S} = ${tmW(s.ex.PRS)}`],
        scene: { params: P({ RL: 2200 }) } },
      { t: 'Menor R_L que regula', p: 'No limite, a tensão de teste é exatamente $V_Z$. Arraste $R_L$ e veja o Zener ligar e desligar no ponto calculado.', eq: [() => `V_i\\dfrac{R_L}{R_S+R_L} = V_Z\\ \\Rightarrow`, () => `R_{L,\\min} = \\dfrac{R_S V_Z}{V_i - V_Z} = \\dfrac{470\\cdot 15}{9} = ${tOhm(Math.round(Q1.RLmin()))}`],
        widget: { type: 'slider', param: 'RL', min: 400, max: 3000, step: 1, value: 1200, marks: [{ v: Q1.RLmin(), label: 'R_L,mín' }], fmt: v => fR(v) },
        live: (s, p) => `R<sub>L</sub> = ${fR(p.RL)} → ${s.comp.DZ.mode === 'bd' ? '<span class="pill on">ligado</span>' : '<span class="pill off">desligado</span>'}<br>V<sub>L</sub> = ${fV(s.V.A)} · I<sub>Z</sub> = ${fI(s.I.IZ)}`,
        scene: { params: P({ RL: 1200 }) } },
      { t: 'Explicando o item b)', p: 'Com 680 Ω a carga é "pesada" demais: exige mais corrente do que $R_S$ consegue entregar mantendo 15 V. Abaixo de $R_{L,\\min}$ o Zener desliga.', eq: [() => `R_L = 680\\,\\Omega < R_{L,\\min} = ${tOhm(Math.round(Q1.RLmin()))}`, () => `\\Rightarrow\\ \\text{Zener desligado}`],
        callout: { k: 'dica', t: 'Dica do professor', x: 'Na reta de carga, todas as retas passam pelo mesmo ponto $I_{cc} = V_i/R_S = 51$ mA: mudar $R_L$ só gira a reta em torno dele.' },
        scene: { params: P({ RL: 2200 }) },
        result: s => { const c = Q1.calc({ RL: 2200 }); return [['V_L', fV(c.V.A)], ['I_L', fI(c.I.IL)], ['I_R', fI(c.I.IR)], ['I_Z', fI(c.I.IZ)], ['P_Z', fP(c.ex.PZ)], ['P_RS', fP(c.ex.PRS)], ['R_L,mín', fR(Q1.RLmin())]]; } },
    ],
    notes: { tempo: '12 min', perguntas: ['O que acontece com I_Z quando R_L aumenta? E com P_Z?', 'Por que existe um R_L mínimo, mas não um máximo (neste circuito)?'], erros: ['Confundir R_L,mín com R_L,máx.', 'Calcular P_RS com V_i inteiro em vez de V_i − V_Z.'], dica: 'No passo do slider, peça para alguém prever o valor antes de arrastar. O gráfico de resistência mostra R despencando quando o Zener liga.' },
  },
  {
    type: 'item', hash: 'q1-d', q: 1, level: 'D', letter: 'd', title: 'Novo R_S para o módulo de 22 mA',
    enun: '<b>d)</b> O módulo real consome 22 mA em 15 V. Redimensione R<sub>S</sub> (série E12) para que o Zener regule com I<sub>Z</sub> ≥ 5 mA nessa carga, verifique se ele sobrevive com o módulo desconectado e especifique a potência do resistor.',
    circuit: Q1.circuit,
    steps: [
      { t: 'O módulo com R_S = 470 Ω', p: 'O módulo equivale a $R_L = 15/0{,}022 \\approx 682\\,\\Omega$, abaixo de $R_{L,\\min} = 783\\,\\Omega$. Com 470 Ω o Zener nem liga.', eq: [s => `V = 24\\cdot\\dfrac{682}{470 + 682} = ${tV(s.ex.Vtest)} < 15\\,\\text{V}`],
        scene: { params: P({ RL: 15 / 0.022, loadStyle: 'module' }), values: ['VL', 'IL', 'DZ:pill'] } },
      { t: 'Corrente necessária em R_S', p: 'Para regular com folga, $R_S$ precisa entregar a corrente da carga <b>mais</b> o mínimo do Zener.', eq: [() => 'I_R = I_L + I_{Z,\\min} = 22 + 5 = 27\\,\\text{mA}'],
        scene: { params: P({ RL: 15 / 0.022, loadStyle: 'module' }), values: ['VL', 'IL', 'DZ:pill'], highlight: ['RS'] } },
      { t: 'R_S máximo e valor E12', p: 'Aqui o valor comercial é o <b>imediatamente abaixo</b>: um $R_S$ maior entregaria menos corrente.', eq: [() => `R_S \\le \\dfrac{V_i - V_Z}{I_R} = \\dfrac{9}{27\\,\\text{mA}} = ${tOhm(Math.round(9 / 0.027))}`, () => `\\text{E12: } R_S = ${tOhm(Q1.RSnew())}`],
        callout: { k: 'erro', t: 'Erro comum', x: `Arredondar para cima (390 Ω): $I_R = ${tmA(9 / 390, 1)}$ e sobram só $${tmA(9 / 390 - 0.022, 1)}$ para o Zener.` },
        scene: { params: P({ RL: 15 / 0.022, loadStyle: 'module' }), values: ['VL', 'IL', 'DZ:pill'], highlight: ['RS'] } },
      { t: 'Verifique com 330 Ω', p: 'Troque o resistor: agora o Zener liga e a corrente se divide.', eq: [s => `I_R = \\dfrac{9}{330} = ${tmA(s.I.IR)}`, s => `I_Z = ${tn(s.I.IR * 1e3, 2)} - 22 = ${tmA(s.I.IZ)} \\ge 5\\,\\text{mA}\\ \\checkmark`],
        scene: { params: P({ RS: 330, RL: 15 / 0.022, loadStyle: 'module', RSrating: 0.5 }) } },
      { t: 'Desconecte o módulo', p: 'Sem carga, <b>toda</b> a corrente de $R_S$ desvia para o Zener. Use o botão para reconectar e comparar.', eq: [() => `I_Z = I_R = ${tmA(Q1.calc({ RS: 330, load: 'none' }).I.IZ)}`, () => `P_Z = 15 \\times ${tmA(Q1.calc({ RS: 330, load: 'none' }).I.IZ)} = ${tmW(Q1.calc({ RS: 330, load: 'none' }).ex.PZ)}`, () => `${tmW(Q1.calc({ RS: 330, load: 'none' }).ex.PZ)} < P_{ZM} = 1\\,\\text{W}\\ \\checkmark`],
        widget: { type: 'toggle', param: 'load', a: 'none', b: 'on', la: 'RECONECTAR O MÓDULO', lb: 'DESCONECTAR O MÓDULO' },
        scene: { params: P({ RS: 330, RL: 15 / 0.022, loadStyle: 'module', load: 'none', RSrating: 0.5 }) } },
      { t: 'Potência do resistor', p: 'Enquanto o Zener regula, $R_S$ sempre tem $V_i - V_Z = 9$ V: a potência nele <b>não depende da carga</b>. Especifique com o dobro, como no roteiro.', eq: [() => `P_{R_S} = \\dfrac{(V_i - V_Z)^2}{R_S} = \\dfrac{9^2}{330} = ${tmW(81 / 330)}`, () => `2 \\times ${tmW(81 / 330)} \\approx ${tmW(2 * 81 / 330)}`, () => `\\Rightarrow\\ \\text{resistor de } \\tfrac{1}{2}\\,\\text{W}`],
        scene: { params: P({ RS: 330, RL: 15 / 0.022, loadStyle: 'module', RSrating: 0.5 }), highlight: ['RS'] },
        result: () => { const a = Q1.calc({ RS: 330, RL: 15 / 0.022 }), b = Q1.calc({ RS: 330, load: 'none' }); return [['R_S', '330 Ω (E12)'], ['I_Z com módulo', fI(a.I.IZ)], ['P_Z sem módulo', `${fP(b.ex.PZ)} (${fPct(b.ex.PZ / 1)} de P_ZM)`], ['P_RS', `${fP(a.ex.PRS)} → resistor de 1/2 W`]]; } },
    ],
    notes: { tempo: '12 min', perguntas: ['Por que o pior caso para o Zener é sem carga?', 'Se o barramento subir para 26 V, o Zener ainda sobrevive sem carga?'], erros: ['Arredondar R_S para cima (E12 acima) quando a exigência é de corrente mínima.', 'Esquecer de verificar o Zener sem carga.', 'Especificar o resistor exatamente com a potência calculada, sem margem.'], dica: 'Clique em DESCONECTAR e mostre a migração das partículas para o Zener; depois abra o Sankey: a eficiência cai a zero, mas a potência da fonte não muda.' },
  },
  {
    type: 'play', hash: 'q1-mexa', q: 1, title: 'Mexa você: provoque uma falha',
    circuit: Q1.circuit,
    params: P({ RSrating: 0.5 }), resetLabel: 'Restaurar valores do item c)',
    controls: [
      { type: 'slider', param: 'Vi', label: 'V_i (barramento)', min: 0, max: 40, step: 0.5, fmt: v => fV(v, 1) },
      { type: 'e12', param: 'RS', label: 'R_S', min: 22, max: 4700, fmt: v => fR(v) },
      { type: 'e12', param: 'RL', label: 'R_L', min: 100, max: 22000, fmt: v => fR(v) },
      { type: 'seg', param: 'load', label: 'Carga', options: [['on', 'conectada'], ['none', 'desconectada']] },
      { type: 'seg', param: 'RSrating', label: 'Potência nominal de R_S', options: [[0.25, '1/4 W'], [0.5, '1/2 W'], [1, '1 W'], [2, '2 W']] },
      { type: 'seg', param: 'zener', label: 'Zener', options: [[true, 'no circuito'], [false, 'removido']] },
    ],
    live: (s, p) => `Estado: <b>${{ bd: 'ligado (regulando)', off: 'desligado (aberto)', absent: 'removido', short: 'queimado (curto)', nopower: 'sem alimentação (R_S aberto)' }[s.comp.DZ.mode]}</b><br>V<sub>L</sub> = ${fV(s.V.A)} · V<sub>teste</sub> = ${fV(s.ex.Vtest)}<br>I<sub>R</sub> = ${fI(s.I.IR)} · I<sub>Z</sub> = ${fI(s.I.IZ)} · I<sub>L</sub> = ${fI(s.I.IL)}<br>P<sub>Z</sub> = ${fP(s.ex.PZ)} · P<sub>RS</sub> = ${fP(s.ex.PRS)} · η = ${fPct(s.ex.eta)}<br>R<sub>L,mín</sub> = ${p.Vi > 15 ? fR(p.RS * 15 / (p.Vi - 15)) : '— (V_i ≤ V_Z)'}`,
    challenge: 'Desafios: (1) faça o Zener desligar mexendo só em R<sub>L</sub>. (2) Queime o Zener sem queimar R<sub>S</sub>: tire a carga, diminua R<sub>S</sub> e use um resistor de 2 W. (3) Com o Zener em curto, quanto R<sub>S</sub> passa a dissipar? Ele aguenta?',
    notes: { tempo: 'livre', perguntas: ['Qual combinação queima o Zener primeiro, sem queimar R_S?', 'Com o Zener em curto, quanto vale V_L?'], erros: ['Achar que a falha é aleatória: ela só acontece quando P passa do nominal.'], dica: 'Deixe a turma propor valores e calcular antes de mover o slider. As falhas usam um modelo térmico: quanto maior o excesso, mais rápido queima.' },
  },
];

/* ---------- tabela de conferência ---------- */
Q1.conf = () => {
  const a1 = Q1.calc({ RL: 2200, zener: false }), a2 = Q1.calc({ RL: 680, zener: false });
  const b = Q1.calc({ RL: 680 }), c = Q1.calc({ RL: 2200 });
  const d0 = Q1.calc({ RL: 15 / 0.022, loadStyle: 'module' }), d1 = Q1.calc({ RS: 330, RL: 15 / 0.022 }), d2 = Q1.calc({ RS: 330, load: 'none' });
  return [
    ['a', 'Tensão de teste com R_L = 2,2 kΩ', fV(a1.ex.Vtest), '≥ 15 V → ligado'],
    ['a', 'Tensão de teste com R_L = 680 Ω', fV(a2.ex.Vtest), '< 15 V → desligado'],
    ['b', 'Estado do Zener', 'desligado', 'V = 14,19 V < V_Z'],
    ['b', 'V_L', fV(b.V.A), ''],
    ['b', 'I_L (= I_R)', fI(b.I.IL), ''],
    ['b', 'I_Z', fI(b.I.IZ), 'supor ligado daria I_Z = ' + fI(9 / 470 - 15 / 680)],
    ['c', 'V_L', fV(c.V.A), 'ligado (V = ' + fV(c.ex.Vtest) + ')'],
    ['c', 'I_L', fI(c.I.IL), ''],
    ['c', 'I_R', fI(c.I.IR), ''],
    ['c', 'I_Z', fI(c.I.IZ), '≫ I_ZK'],
    ['c', 'P_Z', fP(c.ex.PZ), fPct(c.ex.PZ) + ' de P_ZM'],
    ['c', 'P_RS', fP(c.ex.PRS), ''],
    ['c', 'R_L,mín', fR(Q1.RLmin()), '680 Ω < R_L,mín explica o item b'],
    ['d', 'Módulo com R_S = 470 Ω', fV(d0.V.A), 'Zener desligado (R_L ≈ 682 Ω)'],
    ['d', 'R_S calculado', fR(9 / 0.027), 'E12 abaixo: ' + fR(Q1.RSnew())],
    ['d', 'I_R com 330 Ω', fI(d1.I.IR), ''],
    ['d', 'I_Z com módulo', fI(d1.I.IZ), '≥ 5 mA'],
    ['d', 'P_Z sem módulo', fP(d2.ex.PZ), fPct(d2.ex.PZ) + ' de P_ZM → sobrevive'],
    ['d', 'P_RS', fP(d1.ex.PRS), 'especificar 1/2 W'],
  ];
};

/* =====================================================================
   QUESTÃO 2 — Dois Zeners em série como referências de tensão
   15 V, R_S = 680 Ω, D_Z1 = 1N752 (5,6 V · 0,5 W · r_z = 11 Ω),
   D_Z2 = 1N746 (3,3 V · 0,5 W · r_z = 28 Ω), I_ZK = 1 mA.
   Itens a–c: Zener ideal (fonte V_Z; 0,7 V se invertido).
   Item d: modelo V_Z0 + r_z·I, com V_Z0 escolhido para dar exatamente
   V_Z nominal em V_i = 15 V (assim b) e d) concordam no ponto nominal).
   ===================================================================== */
const Q2Z = [{ Vz: 5.6, Pzm: 0.5, rz: 11 }, { Vz: 3.3, Pzm: 0.5, rz: 28 }];
const Q2IZK = 1e-3, Q2Inom = (15 - 8.9) / 680;

function solveQ2(p) {
  const dmg = p.damage || {};
  const Vi = p.power ? p.Vi : 0, RS = p.RS, present = p.zeners !== false;
  const burnt = [!!(dmg.DZ1 || dmg.DZ1i), !!(dmg.DZ2 || dmg.DZ2i)], inv = [!!p.inv1, !!p.inv2];
  // queda "fixa" e resistência de cada Zener no modelo escolhido
  const z = Q2Z.map((zz, k) => {
    if (burnt[k]) return { d: 0, r: 0 };                     // queimado = curto
    if (inv[k]) return { d: 0.7, r: 0 };                     // invertido = diodo direto
    return p.useRz ? { d: zz.Vz - zz.rz * Q2Inom, r: zz.rz } : { d: zz.Vz, r: 0 };
  });
  let IR = 0, VA, VB, state;
  if (dmg.RS) { state = 'nopower'; VA = 0; VB = 0; }
  else if (!present) { state = 'absent'; VA = Vi; VB = 0; }  // nó B fica solto
  else {
    const Vk = z[0].d + z[1].d, Rk = z[0].r + z[1].r;
    if (Vi > Vk) { state = 'on'; IR = (Vi - Vk) / (RS + Rk); VB = z[1].d + z[1].r * IR; VA = VB + z[0].d + z[0].r * IR; }
    else { state = 'off'; VA = Vi; VB = Vk > 0 ? Vi * z[1].d / Vk : 0; }   // sem corrente (divisão pela fuga)
  }
  const V1 = VA - VB, V2 = VB, PRS = (Vi - VA) * IR, P1 = burnt[0] ? 0 : V1 * IR, P2 = burnt[1] ? 0 : V2 * IR;
  const modeOf = k => state === 'nopower' ? 'nopower' : state === 'absent' ? 'absent' : burnt[k] ? 'short' : state === 'off' ? 'off' : inv[k] ? 'fwd' : 'bd';
  const pillOf = (k) => {
    const m = modeOf(k);
    if (m === 'nopower') return { text: 'SEM ALIMENTAÇÃO', kind: 'mute' };
    if (m === 'absent') return { text: 'REMOVIDO (TESTE)', kind: 'mute' };
    if (m === 'short') return { text: 'QUEIMADO · EM CURTO', kind: 'bad' };
    if (m === 'off') return { text: 'BLOQUEADO · SEM CORRENTE', kind: 'off' };
    if (m === 'fwd') return { text: 'INVERTIDO · DIRETO 0,7 V', kind: 'warn' };
    if ([P1, P2][k] > Q2Z[k].Pzm) return { text: 'ACIMA DE P_ZM!', kind: 'bad' };
    if (IR < Q2IZK) return { text: 'ABAIXO DE I_ZK · SEM REGULAÇÃO', kind: 'warn' };
    return { text: 'REGULANDO', kind: 'on' };
  };
  const zc = (k, inverted) => {
    const visible = present ? (inv[k] === inverted) : !inverted;
    const show = !present ? (inverted ? 'hidden' : 'ghost') : visible ? 'on' : 'hidden';
    const P = [P1, P2][k], V = [V1, V2][k];
    return Object.assign({ mode: modeOf(k), show, I: IR, V, vAcross: inverted ? -V : V, pill: pillOf(k) },
      show === 'on' ? { P, Pmax: Q2Z[k].Pzm, failCause: `P_Z${k + 1} = ${fP(P)} > P_ZM = ${fW(Q2Z[k].Pzm)}` } : {});
  };
  const overall = state === 'on' ? (inv[0] || inv[1] ? 'fwd' : 'bd') : state;
  return {
    V: { P: Vi, A: VA, B: VB, G: 0 }, I: { IR }, vmax: Math.max(p.Vi, 1),
    comp: {
      Vi: {}, RS: { P: PRS, Pmax: p.RSrating || null, failCause: `P_RS = ${fP(PRS)} > ${fW(p.RSrating || 0)} (nominal)` },
      DZ1: zc(0, false), DZ1i: zc(0, true), DZ2: zc(1, false), DZ2i: zc(1, true),
    },
    zop: [{ state: modeOf(0), V: V1, I: IR }, { state: modeOf(1), V: V2, I: IR }],
    zll: state === 'nopower' ? { state } : { state: overall === 'on' ? 'bd' : overall, Vth: Vi, Rth: RS, V: VA, I: IR },
    ex: { IR, VA, VB, V1, V2, PRS, P1, P2, Pin: Vi * IR, state },
  };
}

const Q2 = {};
const baseQ2 = { Vi: 15, RS: 680, inv1: false, inv2: false, zeners: true, useRz: false, precise: false, RSrating: null };
const P2 = (o) => Object.assign({}, baseQ2, o);
Q2.calc = (o) => solveQ2(Object.assign({ power: true }, baseQ2, o));
/** menor V_i que mantém I_R ≥ I_ZK (no modelo escolhido) */
Q2.viMin = (p) => {
  const Vk = p.useRz ? (5.6 - 11 * Q2Inom) + (3.3 - 28 * Q2Inom) : 8.9, Rk = p.useRz ? 39 : 0;
  return Vk + (p.RS + Rk) * Q2IZK;
};
const vfmt = (v, p) => fV(v, p.precise ? 3 : 2);

Q2.circuit = {
  viewBox: [1000, 640], Iref: 0.012,
  defaults: P2({}),
  solve: solveQ2,
  zoomComp: 'DZ2',
  zeners: [
    { id: 'DZ1', name: 'D_Z1', Vz: 5.6, Vdraw: 5.6 - 11 * Q2Inom, Pzm: 0.5, Izk: 1e-3, rz: 11, rzDraw: 11, Zzk: 400 },
    { id: 'DZ2', name: 'D_Z2', Vz: 3.3, Vdraw: 3.3 - 28 * Q2Inom, Pzm: 0.5, Izk: 1e-3, rz: 28, rzDraw: 28, Zzk: 700 },
  ],
  chart: { Vxmax: 7, Irmax: 0.03, LLVmax: 16, LLImax: 0.025, note: 'curvas com os r_z da lista' },
  meterAt: [640, 530], meterDefault: ['A', 'G'], legendAt: [24, 612],
  probePoints: { A: [720, 95], B: [720, 300], G: [720, 505], P: [180, 95] },
  comps: {
    Vi: { type: 'dc', x: 110, y: 300, r: 34, label: p => fV(p.Vi, Number.isInteger(p.Vi) ? 0 : 1).replace(/,0 V$/, ' V') },
    RS: { type: 'res', a: [250, 95], b: [360, 95], amp: 13, nodes: ['P', 'A'], Tmax: 155, failMode: 'open', failTitle: 'Resistor R_S queimado (abriu)' },
    DZ1: { type: 'zener', a: [500, 216], k: [500, 180], w: 38, zoom: true, zoomName: 'D_Z1 · 1N752 (5,6 V)', Vz: 5.6, Tmax: 200, failMode: 'short', failTitle: 'D_Z1 queimado — virou curto' },
    DZ1i: { type: 'zener', a: [500, 180], k: [500, 216], w: 38, zoom: true, zoomName: 'D_Z1 invertido (conduz direto)', Vz: 5.6, Tmax: 200, failMode: 'short', failTitle: 'D_Z1 queimado — virou curto' },
    DZ2: { type: 'zener', a: [500, 421], k: [500, 385], w: 38, zoom: true, zoomName: 'D_Z2 · 1N746 (3,3 V)', Vz: 3.3, Tmax: 200, failMode: 'short', failTitle: 'D_Z2 queimado — virou curto' },
    DZ2i: { type: 'zener', a: [500, 385], k: [500, 421], w: 38, zoom: true, zoomName: 'D_Z2 invertido (conduz direto)', Vz: 3.3, Tmax: 200, failMode: 'short', failTitle: 'D_Z2 queimado — virou curto' },
  },
  wires: [
    { node: 'P', cur: 'IR', pts: [[110, 266], [110, 95], [250, 95]] },
    { node: 'A', cur: 'IR', pts: [[360, 95], [500, 95]] },
    { node: 'A', cur: 'IR', pts: [[500, 95], [500, 180]] },
    { node: 'B', cur: 'IR', pts: [[500, 216], [500, 300]] },
    { node: 'B', cur: 'IR', pts: [[500, 300], [500, 385]] },
    { node: 'G', cur: 'IR', pts: [[500, 421], [500, 505]] },
    { node: 'G', cur: 'IR', pts: [[500, 505], [110, 505], [110, 334]] },
    { node: 'A', idle: true, pts: [[500, 95], [880, 95]] },
    { node: 'B', idle: true, pts: [[500, 300], [880, 300]] },
    { node: 'G', idle: true, pts: [[500, 505], [880, 505]] },
  ],
  edges: [
    { id: 'src', cur: 'IR', spawn: true, path: [[110, 505], [110, 334], { comp: 'Vi' }, [110, 266], [110, 95], [250, 95]] },
    { id: 'rs', cur: 'IR', path: [[250, 95], { comp: 'RS' }, [360, 95]] },
    { id: 'a1', cur: 'IR', path: [[360, 95], [500, 95]] },
    { id: 'z1', cur: 'IR', dep: 'DZ1', path: [[500, 95], [500, 180], { comp: 'DZ1', rev: true }, [500, 300]] },
    { id: 'z1i', cur: 'IR', dep: 'DZ1i', path: [[500, 95], [500, 180], { comp: 'DZ1i' }, [500, 300]] },
    { id: 'z2', cur: 'IR', dep: 'DZ2', path: [[500, 300], [500, 385], { comp: 'DZ2', rev: true }, [500, 505]] },
    { id: 'z2i', cur: 'IR', dep: 'DZ2i', path: [[500, 300], [500, 385], { comp: 'DZ2i' }, [500, 505]] },
    { id: 'g', cur: 'IR', path: [[500, 505], [110, 505]] },
  ],
  dots: [[500, 95], [500, 300], [500, 505]],
  terms: [[880, 95], [880, 300], [880, 505]],
  arrows: [{ a: [386, 72], b: [446, 72], t: 'I_R', tx: 458, ty: 79, anchor: 'start' }],
  labels: [
    { t: 'R_S', x: 305, y: 72, cls: 'nm', anchor: 'middle' },
    { t: p => fR(p.RS), x: 305, y: 140, cls: 'val', anchor: 'middle' },
    { t: 'D_Z1', x: 528, y: 182, cls: 'nm' },
    { t: '5,6 V · 1N752', x: 528, y: 207, cls: 'val' },
    { t: 'r_z = 11 Ω', x: 528, y: 231, cls: 'val' },
    { t: 'D_Z2', x: 528, y: 387, cls: 'nm' },
    { t: '3,3 V · 1N746', x: 528, y: 412, cls: 'val' },
    { t: 'r_z = 28 Ω', x: 528, y: 436, cls: 'val' },
    { t: 'A', x: 902, y: 103, cls: 'val strong' },
    { t: 'B', x: 902, y: 308, cls: 'val strong' },
    { t: '0 V', x: 902, y: 513, cls: 'val strong' },
    { t: 'V_A → comparador', x: 700, y: 80, cls: 'small' },
    { t: 'V_B → referência do A/D', x: 690, y: 285, cls: 'small' },
  ],
  values: [
    { id: 'IR', cur: 'IR', x: 416, y: 44, anchor: 'middle', fn: s => `I_R = ${fI(s.I.IR)}` },
    { id: 'VA', x: 880, y: 140, anchor: 'middle', fn: (s, p) => `V_A = ${vfmt(s.V.A, p)}` },
    { id: 'VB', x: 880, y: 345, anchor: 'middle', fn: (s, p) => `V_B = ${vfmt(s.V.B, p)}`, when: s => s.ex.state !== 'absent' },
  ],
  pills: [{ comp: 'DZ1', x: 528, y: 266 }, { comp: 'DZ1i', x: 528, y: 266 }, { comp: 'DZ2', x: 528, y: 470 }, { comp: 'DZ2i', x: 528, y: 470 }],
  bars: [
    { comp: 'DZ1', x: 300, y: 205, w: 150, label: 'P_Z1 / P_ZM' }, { comp: 'DZ1i', x: 300, y: 205, w: 150, label: 'P_Z1 / P_ZM' },
    { comp: 'DZ2', x: 300, y: 410, w: 150, label: 'P_Z2 / P_ZM' }, { comp: 'DZ2i', x: 300, y: 410, w: 150, label: 'P_Z2 / P_ZM' },
    { comp: 'RS', x: 150, y: 160, w: 90, label: 'P_RS' },
  ],
  relevo: {
    cur: 'IR',
    segs: (p, s) => [
      { kind: 'rise', to: s.V.P, label: 'fonte' },
      { kind: 'flat', node: 'P' },
      { kind: 'drop', to: s.V.A, label: 'R_S' },
      { kind: 'flat', node: 'A', name: 'V_A' },
      { kind: 'drop', to: s.V.B, label: p.inv1 ? 'D_Z1 direto' : 'D_Z1' },
      { kind: 'flat', node: 'B', name: 'V_B' },
      { kind: 'drop', to: 0, label: p.inv2 ? 'D_Z2 direto' : 'D_Z2' },
      { kind: 'flat', node: 'G' },
    ],
    caption: () => 'Uma só corrente desce a escada: a queda de cada Zener vira um degrau. V_A é a altura do degrau superior medida a partir do chão (0 V).',
  },
  sankey: (s) => ({
    Pin: s.ex.Pin, eta: 0, Pref: 0.16, etaNote: 'referência: não entrega potência',
    sinks: [
      { label: 'calor em R_S', P: s.ex.PRS, color: 'rgba(232,119,46,A)' },
      { label: 'calor em D_Z1', P: s.ex.P1, color: 'rgba(201,54,42,A)' },
      { label: 'calor em D_Z2', P: s.ex.P2, color: 'rgba(44,140,140,A)' },
    ],
  }),
  vavi: {
    range: [6, 18], ymax: 10, band: [12, 18], vimin: p => Q2.viMin(p),
    lines: [
      { label: 'V_A', color: '#1F2D4D', dotc: 'rgba(232,119,46,A)', f: s => s.V.A },
      { label: 'V_B', color: '#2C8C8C', dotc: 'rgba(44,140,140,A)', f: s => s.V.B },
    ],
  },
  lsb: { range: [12, 18], ref: 3.3, label: 'V_B', f: s => s.V.B, bits: 12, vref: 3.3 },
};

/* ---------- ilustração: placa de aquisição ---------- */
Q2.illus = `<svg viewBox="0 0 560 340" role="img" aria-label="Placa de aquisição com conversor A/D e comparador">
  <rect x="8" y="8" width="544" height="324" rx="18" fill="#E8EDF5"/>
  <rect x="40" y="46" width="480" height="250" rx="14" fill="#2E7D5B"/>
  <g fill="#3E9670"><rect x="60" y="66" width="440" height="3"/><rect x="60" y="270" width="440" height="3"/></g>
  <rect x="20" y="140" width="46" height="56" rx="6" fill="#1F2D4D"/><text x="43" y="128" fill="#1F2D4D" font-family="Lato,sans-serif" font-weight="900" font-size="12" text-anchor="middle">15 V</text>
  <text x="43" y="214" fill="#1F2D4D" font-family="Lato,sans-serif" font-weight="700" font-size="10" text-anchor="middle">não regulada</text>
  <rect x="96" y="150" width="40" height="12" rx="6" fill="#E9D7B3"/><rect x="104" y="150" width="4" height="12" fill="#3A6"/><rect x="112" y="150" width="4" height="12" fill="#1F2D4D"/>
  <rect x="150" y="128" width="28" height="12" rx="6" fill="#F3B07A"/><rect x="150" y="128" width="5" height="12" fill="#1F2D4D"/>
  <rect x="150" y="176" width="28" height="12" rx="6" fill="#F3B07A"/><rect x="150" y="176" width="5" height="12" fill="#1F2D4D"/>
  <circle cx="200" cy="134" r="7" fill="#FFD7B8"/><text x="212" y="120" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="13">8,9 V</text>
  <circle cx="200" cy="182" r="7" fill="#FFD7B8"/><text x="212" y="206" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="13">3,3 V</text>
  <path d="M207 134 H300 V110" stroke="#D9F0E2" stroke-width="3" fill="none"/>
  <path d="M207 182 H330 V200" stroke="#D9F0E2" stroke-width="3" fill="none"/>
  <rect x="270" y="78" width="70" height="34" rx="4" fill="#1C2333"/><text x="305" y="100" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="11" text-anchor="middle">comparador</text>
  <g fill="#C9D3E6"><rect x="276" y="72" width="4" height="6"/><rect x="290" y="72" width="4" height="6"/><rect x="304" y="72" width="4" height="6"/><rect x="318" y="72" width="4" height="6"/></g>
  <rect x="300" y="196" width="130" height="70" rx="5" fill="#1C2333"/><text x="365" y="228" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="15" text-anchor="middle">A/D 12 bits</text>
  <text x="365" y="248" fill="#9FB0CC" font-family="Lato,sans-serif" font-weight="700" font-size="11" text-anchor="middle">V_ref = 3,3 V</text>
  <g fill="#C9D3E6"><rect x="310" y="266" width="5" height="8"/><rect x="326" y="266" width="5" height="8"/><rect x="342" y="266" width="5" height="8"/><rect x="358" y="266" width="5" height="8"/><rect x="374" y="266" width="5" height="8"/><rect x="390" y="266" width="5" height="8"/><rect x="406" y="266" width="5" height="8"/></g>
  <rect x="470" y="110" width="66" height="120" rx="6" fill="#9AA6BC"/><text x="503" y="176" fill="#1F2D4D" font-family="Lato,sans-serif" font-weight="900" font-size="11" text-anchor="middle">sinais</text>
  <path d="M430 230 C450 230, 452 200, 470 200" stroke="#D9F0E2" stroke-width="3" fill="none"/>
</svg>`;

Q2.slides = [
  {
    type: 'context', hash: 'q2', q: 2, kind: 'Diodo Zener · referências em série',
    title: 'Duas referências para uma placa de aquisição',
    story: 'Uma placa de aquisição precisa de <b>3,3 V</b> para o conversor A/D e <b>8,9 V</b> para um comparador. As duas entradas têm impedância altíssima (corrente desprezível). O projetista usou dois Zeners em série alimentados por 15 V.',
    chips: [['V_i = 15 V'], ['R_S = 680 Ω'], ['D_Z1 = 1N752 · 5,6 V', 'o'], ['r_z1 = 11 Ω'], ['D_Z2 = 1N746 · 3,3 V', 'o'], ['r_z2 = 28 Ω'], ['P_ZM = 0,5 W'], ['I_ZK = 1 mA']],
    items: [['A', 'a)', 'Mesma corrente, V_A = V_Z1 + V_Z2 e orientação'], ['B', 'b)', 'V_A, V_B, I_R e potências'], ['C', 'c)', 'Zener soldado invertido: como diagnosticar'], ['D', 'd)', 'Fonte de 12 a 18 V: serve para um A/D de 12 bits?']],
    trains: 'Treina: Zeners em série, Zener invertido, regulação de linha com r_z.',
    notes: { tempo: '3 min', perguntas: ['O que é uma "referência de tensão" e por que o A/D precisa de uma?', 'Por que as entradas de alta impedância simplificam o problema?'], erros: [], dica: 'Lembre que a referência do A/D define o "tamanho" de cada degrau digital (LSB).' },
  },
  {
    type: 'circuit', hash: 'q2-circuito', q: 2, title: 'O circuito da Figura 2', circuit: Q2.circuit,
    steps: [
      { t: 'Antes de ligar', p: 'Identifique a fonte de 15 V, o resistor $R_S$ e os <b>dois Zeners em série</b>. Os nós A e B alimentam entradas de impedância altíssima: nenhuma corrente sai por eles.', eq: [() => 'V_i = 15\\,\\text{V},\\quad R_S = 680\\,\\Omega'],
        scene: { params: P2({}), power: false, cta: true, values: 'none', highlight: ['DZ1', 'DZ2'] } },
      { t: 'Ligue a fonte', p: 'Uma <b>única fila</b> de partículas atravessa $R_S$, $D_{Z1}$ e $D_{Z2}$. Os fios das saídas A e B ficam apagados: neles não há corrente, só potencial.',
        scene: { params: P2({}), power: true, values: 'none' } },
      { t: 'Três níveis de cor', p: 'Repare nas cores: o fio de cima (15 V), o nó A, o nó B e o terra. Cada Zener "segura" um degrau de tensão. Passe o mouse sobre os fios para ler cada potencial.',
        callout: { k: 'dica', t: 'Dica do professor', x: 'Ligue o <b>Relevo de tensão</b>: a escada mostra os dois degraus antes de qualquer conta.' },
        scene: { params: P2({}), values: 'none' } },
    ],
    notes: { tempo: '4 min', perguntas: ['Quantos caminhos a corrente tem neste circuito?', 'Qual é a orientação correta de cada Zener?'], erros: ['Achar que as saídas A e B "puxam" corrente.'], dica: 'Peça para alguém apontar onde está o catodo de cada Zener antes de ligar.' },
  },
  {
    type: 'item', hash: 'q2-a', q: 2, level: 'A', letter: 'a', title: 'Uma corrente, duas tensões',
    enun: '<b>a)</b> Por que os dois Zeners são percorridos pela mesma corrente? Por que V<sub>A</sub> vale V<sub>Z1</sub> + V<sub>Z2</sub>, e não apenas 5,6 V? Como deve ser a orientação (anodo/catodo) de cada Zener?',
    circuit: Q2.circuit,
    steps: [
      { t: 'Um único caminho', p: 'As entradas do comparador e do A/D não drenam corrente. Pela Lei dos Nós, tudo o que chega ao nó B pelo $D_{Z1}$ precisa sair pelo $D_{Z2}$: os dois estão em <b>série</b>.', eq: [() => 'I_{Z1} = I_{Z2} = I_R'],
        scene: { params: P2({}), values: ['IR', 'DZ1:pill', 'DZ2:pill'], highlight: ['DZ1', 'DZ2'] } },
      { t: 'As tensões se somam', p: 'Toda tensão de nó é medida em relação ao terra. Para ir de A até 0 V é preciso descer os <b>dois degraus</b>: o de $D_{Z1}$ e o de $D_{Z2}$.', eq: [() => 'V_A = V_{Z1} + V_{Z2} = 5{,}6 + 3{,}3 = 8{,}9\\,\\text{V}', () => 'V_B = V_{Z2} = 3{,}3\\,\\text{V}'],
        scene: { params: P2({}), view: 'relevo' } },
      { t: 'Onde aparecem os 5,6 V?', p: 'Os 5,6 V do $D_{Z1}$ estão <b>entre A e B</b>, não entre A e o terra. O voltímetro está com as ponteiras em A e B.', eq: [() => 'V_A - V_B = V_{Z1} = 5{,}6\\,\\text{V}'],
        scene: { params: P2({}), view: 'sch', probes: ['A', 'B'], values: ['IR', 'VA', 'VB'] } },
      { t: 'Orientação de cada Zener', p: 'Para regular, cada Zener precisa de polarização <b>reversa</b>: o catodo (lado da barra) vai para o ponto mais positivo. $D_{Z1}$: catodo em A, anodo em B. $D_{Z2}$: catodo em B, anodo no terra. Clique em um Zener para ver a junção.',
        eq: [() => '\\text{catodo} \\rightarrow \\text{potencial mais alto}'],
        callout: { k: 'erro', t: 'Erro comum', x: 'Montar o Zener "como diodo retificador" (anodo para cima): ele conduz direto com 0,7 V e a referência desaparece (item c).' },
        scene: { params: P2({}), probes: null, highlight: ['DZ1', 'DZ2'] },
        result: () => [['Corrente', 'a mesma nos dois (série)'], ['V_A', 'V_Z1 + V_Z2 = 8,9 V'], ['V_B', 'V_Z2 = 3,3 V'], ['Orientação', 'catodos para o lado positivo']] },
    ],
    notes: { tempo: '7 min', perguntas: ['Se trocássemos a ordem dos Zeners (3,3 V em cima), quanto valeriam V_A e V_B?', 'Por que não basta um Zener de 8,9 V?'], erros: ['Ler V_A como 5,6 V por confundir tensão de nó com tensão no componente.'], dica: 'Abra o zoom do D_Z2 (3,3 V): mostra o tunelamento, diferente da avalanche do Zener de 15 V da Questão 1.' },
  },
  {
    type: 'item', hash: 'q2-b', q: 2, level: 'B', letter: 'b', title: 'V_A, V_B, I_R e potências',
    enun: '<b>b)</b> Calcule V<sub>A</sub>, V<sub>B</sub>, I<sub>R</sub> e as potências em cada Zener e em R<sub>S</sub>.',
    circuit: Q2.circuit,
    steps: [
      { t: 'Teste de estado', p: 'Retire os dois Zeners: sem caminho para a corrente, o nó A fica com a tensão da fonte. Como $15 > 5{,}6 + 3{,}3$, os dois entram em ruptura.', eq: [() => 'V_{\\text{teste}} = 15\\,\\text{V} \\ge V_{Z1} + V_{Z2} = 8{,}9\\,\\text{V}'],
        scene: { params: P2({ zeners: false }), values: ['VA'], probes: ['A', 'G'] } },
      { t: 'Tensões dos nós', p: 'Com os dois ligados, cada Zener vira uma fonte de $V_Z$.', eq: [s => `V_B = V_{Z2} = ${tV(s.V.B)}`, s => `V_A = V_{Z1} + V_{Z2} = ${tV(s.V.A)}`],
        scene: { params: P2({}), values: ['VA', 'VB', 'DZ1:pill', 'DZ2:pill'], probes: ['A', 'G'] } },
      { t: 'Corrente em R_S', p: 'A tensão que sobra para $R_S$ é $V_i - V_A$.', eq: [s => `I_R = \\dfrac{V_i - V_A}{R_S} = \\dfrac{15 - 8{,}9}{680} = ${tmA(s.I.IR)}`, () => 'I_R \\ge I_{ZK} = 1\\,\\text{mA}\\ \\checkmark'],
        scene: { params: P2({}), values: ['VA', 'VB', 'IR', 'DZ1:pill', 'DZ2:pill'], highlight: ['RS'] } },
      { t: 'Potências', p: 'Mesma corrente nos três componentes; muda só a tensão de cada um.', eq: [s => `P_{Z1} = 5{,}6 \\times ${tmA(s.I.IR)} = ${tmW(s.ex.P1, 1)}`, s => `P_{Z2} = 3{,}3 \\times ${tmA(s.I.IR)} = ${tmW(s.ex.P2, 1)}`, s => `P_{R_S} = 6{,}1 \\times ${tmA(s.I.IR)} = ${tmW(s.ex.PRS, 1)}`],
        scene: { params: P2({}) } },
      { t: 'Interprete', p: 'Toda a potência da fonte vira calor: uma referência não alimenta carga. As barras mostram que os Zeners trabalham com cerca de 10 % e 6 % de $P_{ZM}$, uma folga grande.',
        scene: { params: P2({}) },
        result: s => [['V_A', fV(s.V.A)], ['V_B', fV(s.V.B)], ['I_R', fI(s.I.IR)], ['P_Z1', fP(s.ex.P1)], ['P_Z2', fP(s.ex.P2)], ['P_RS', fP(s.ex.PRS)]] },
    ],
    notes: { tempo: '8 min', perguntas: ['Qual componente dissipa mais? Por quê?', 'O que mudaria se R_S fosse 330 Ω?'], erros: ['Usar V_i inteiro na potência de R_S.', 'Esquecer que a corrente é a mesma nos dois Zeners.'], dica: 'O Sankey mostra η sem sentido aqui: o objetivo é uma tensão precisa, não transferir potência.' },
  },
  {
    type: 'item', hash: 'q2-c', q: 2, level: 'C', letter: 'c', title: 'Zener soldado invertido',
    enun: '<b>c)</b> Na montagem, D<sub>Z2</sub> foi soldado invertido. Determine os novos V<sub>A</sub>, V<sub>B</sub> e I<sub>R</sub>. E se o invertido fosse D<sub>Z1</sub>? Como identificar cada defeito com um multímetro?',
    circuit: Q2.circuit,
    steps: [
      { t: 'D_Z2 invertido', p: 'Invertido, o $D_{Z2}$ fica em polarização <b>direta</b>: a barreira some e ele conduz como um diodo comum, com 0,7 V. O degrau de 3,3 V vira um degrau de 0,7 V.', eq: [s => `V_B = 0{,}7\\,\\text{V}`, s => `V_A = 5{,}6 + 0{,}7 = ${tV(s.V.A)}`],
        widget: { type: 'seg', options: [[{ inv1: false, inv2: false }, 'montagem correta'], [{ inv1: false, inv2: true }, 'D_Z2 invertido']] },
        scene: { params: P2({ inv2: true }), probes: ['B', 'G'] } },
      { t: 'Nova corrente', p: 'Com $V_A$ menor, sobra mais tensão para $R_S$ e a corrente aumenta.', eq: [s => `I_R = \\dfrac{15 - ${tn(s.V.A, 1)}}{680} = ${tmA(s.I.IR)}`],
        scene: { params: P2({ inv2: true }), view: 'relevo' } },
      { t: 'E se fosse o D_Z1?', p: 'Agora o degrau de cima é que vira 0,7 V. $V_B$ continua 3,3 V, mas $V_A$ despenca.', eq: [() => 'V_B = 3{,}3\\,\\text{V}', s => `V_A = 3{,}3 + 0{,}7 = ${tV(s.V.A)}`, s => `I_R = \\dfrac{15 - 4{,}0}{680} = ${tmA(s.I.IR)}`],
        scene: { params: P2({ inv1: true }), view: 'sch', probes: ['A', 'B'] } },
      { t: 'Diagnóstico com o multímetro', p: 'Meça $V_B$ (ponteira preta no terra) e $V_A - V_B$. O Zener invertido aparece como uma leitura de <b>≈ 0,7 V</b> sobre ele. Troque os casos e arraste as ponteiras.',
        html: () => { const n = Q2.calc({}), a = Q2.calc({ inv2: true }), b = Q2.calc({ inv1: true }); const r = (t, s) => `<tr><td>${t}</td><td>${fV(s.V.A)}</td><td>${fV(s.V.B)}</td><td>${fV(s.V.A - s.V.B)}</td><td>${fI(s.I.IR)}</td></tr>`; return `<table><tr><th>montagem</th><th>V<sub>A</sub></th><th>V<sub>B</sub></th><th>V<sub>A</sub>−V<sub>B</sub></th><th>I<sub>R</sub></th></tr>${r('correta', n)}${r('D<sub>Z2</sub> invertido', a)}${r('D<sub>Z1</sub> invertido', b)}</table>`; },
        widget: { type: 'seg', options: [[{ inv1: false, inv2: false }, 'correta'], [{ inv1: false, inv2: true }, 'D_Z2 inv.'], [{ inv1: true, inv2: false }, 'D_Z1 inv.']] },
        scene: { params: P2({ inv2: true }), probes: ['B', 'G'] },
        result: () => { const a = Q2.calc({ inv2: true }), b = Q2.calc({ inv1: true }); return [['D_Z2 invertido', `V_A = ${fV(a.V.A)} · V_B = ${fV(a.V.B)} · I_R = ${fI(a.I.IR)}`], ['D_Z1 invertido', `V_A = ${fV(b.V.A)} · V_B = ${fV(b.V.B)} · I_R = ${fI(b.I.IR)}`], ['Diagnóstico', '≈ 0,7 V sobre o Zener invertido']]; } },
    ],
    notes: { tempo: '10 min', perguntas: ['Por que um Zener invertido não queima aqui?', 'Qual medição separa os dois defeitos com uma só leitura?'], erros: ['Achar que o Zener invertido "bloqueia" (ele conduz direto).', 'Medir só V_A e não localizar qual Zener está invertido.'], dica: 'Use o modo de diodo do multímetro como complemento: com o circuito desligado, o Zener mostra ≈ 0,7 V num sentido e "aberto" no outro (para V_Z maior que a tensão de teste do instrumento).' },
  },
  {
    type: 'item', hash: 'q2-d', q: 2, level: 'D', letter: 'd', title: 'Fonte de 12 a 18 V e o A/D de 12 bits',
    enun: '<b>d)</b> Os 15 V vêm de uma fonte não regulada que varia entre 12 V e 18 V. (i) Os Zeners permanecem acima de I<sub>ZK</sub>? (ii) Usando r<sub>z</sub>, estime a variação de V<sub>A</sub> e de V<sub>B</sub>. (iii) Qual o menor V<sub>i</sub> que ainda regula? Essa referência serve para um conversor A/D de 12 bits?',
    circuit: Q2.circuit, chartKinds: ['iv', 'll', 'vavi', 'lsb'],
    steps: [
      { t: '(i) Os extremos da fonte', p: 'Calcule $I_R$ nos dois extremos (modelo ideal) e compare com $I_{ZK} = 1$ mA.', eq: [() => `V_i = 12\\,\\text{V}:\\ I_R = \\dfrac{12 - 8{,}9}{680} = ${tmA(3.1 / 680)}`, () => `V_i = 18\\,\\text{V}:\\ I_R = \\dfrac{18 - 8{,}9}{680} = ${tmA(9.1 / 680)}`, () => 'I_R > I_{ZK}\\ \\text{nos dois casos}\\ \\checkmark'],
        widget: { type: 'seg', param: 'Vi', options: [[12, 'V_i = 12 V'], [15, '15 V'], [18, '18 V']] },
        scene: { params: P2({ Vi: 12 }), values: ['IR', 'VA', 'VB', 'DZ1:pill', 'DZ2:pill'] } },
      { t: '(ii) Quanto muda a corrente', p: 'Agora o Zener deixa de ser ideal: $V_Z = V_{Z0} + r_z I$. A variação de corrente é limitada por $R_S$ e pelos dois $r_z$ em série.', eq: [() => `\\Delta I = \\dfrac{\\Delta V_i}{R_S + r_{z1} + r_{z2}} = \\dfrac{6}{680 + 39} = ${tmA(6 / 719)}`],
        callout: { k: 'dica', t: 'Dica do professor', x: 'Como $r_z \\ll R_S$, a conta rápida $\\Delta V_i / R_S = 8{,}82$ mA dá quase o mesmo resultado.' },
        widget: { type: 'slider', param: 'Vi', label: 'Arraste V_i (fonte não regulada)', min: 12, max: 18, step: 0.05, fmt: v => fV(v, 2) },
        live: (s) => `I<sub>R</sub> = ${fI(s.I.IR)} · V<sub>A</sub> = ${fV(s.V.A, 3)} · V<sub>B</sub> = ${fV(s.V.B, 3)}`,
        scene: { params: P2({ Vi: 15, useRz: true, precise: true }) } },
      { t: '(ii) Quanto mudam V_A e V_B', p: 'Cada Zener varia $r_z \\, \\Delta I$. A lupa em mV (último gráfico) mostra $V_B$ "tremendo" com a fonte.', eq: [() => `\\Delta V_B = r_{z2}\\,\\Delta I = 28 \\times ${tmA(6 / 719)} = ${tmW(28 * 6 / 719).replace('mW', 'mV')}`, () => `\\Delta V_A = (r_{z1} + r_{z2})\\,\\Delta I = 39 \\times ${tmA(6 / 719)} = ${tmW(39 * 6 / 719).replace('mW', 'mV')}`],
        widget: { type: 'slider', param: 'Vi', label: 'Arraste V_i (fonte não regulada)', min: 12, max: 18, step: 0.05, fmt: v => fV(v, 2) },
        live: (s) => `V<sub>A</sub> = ${fV(s.V.A, 3)} · V<sub>B</sub> = ${fV(s.V.B, 3)}<br>V<sub>B</sub> − 3,3 V = ${num((s.V.B - 3.3) * 1000, 1)} mV`,
        scene: { params: P2({ Vi: 18, useRz: true, precise: true }) } },
      { t: '(iii) Menor V_i que regula', p: 'O limite é a corrente cair a $I_{ZK}$. No modelo ideal do roteiro:', eq: [() => `V_{i,\\min} = V_{Z1} + V_{Z2} + R_S I_{ZK} = 8{,}9 + 0{,}68 = ${tV(Q2.viMin({ RS: 680 }))}`, () => `\\text{com } r_z:\\ V_{i,\\min} \\approx ${tV(Q2.viMin({ RS: 680, useRz: true }))}`],
        widget: { type: 'slider', param: 'Vi', label: 'Arraste V_i (abaixo da faixa da fonte)', min: 6, max: 18, step: 0.05, fmt: v => fV(v, 2) },
        live: (s) => `I<sub>R</sub> = ${fI(s.I.IR)} → ${s.I.IR >= Q2IZK ? '<span class="pill on">regula</span>' : '<span class="pill off">abaixo de I<sub>ZK</sub></span>'}`,
        scene: { params: P2({ Vi: 10, useRz: true, precise: true }) } },
      { t: 'Serve para um A/D de 12 bits?', p: 'Com $V_{ref} = 3{,}3$ V, cada degrau do conversor vale 0,81 mV. A referência varia centenas de LSB com a fonte: <b>não serve</b>. Solução: alimentar o Zener por uma fonte de corrente ou, melhor, usar uma referência integrada (ex.: TL431, REF3033).',
        eq: [() => `1\\,\\text{LSB} = \\dfrac{3{,}3}{2^{12}} = ${tn(3.3 / 4096 * 1000, 2)}\\,\\text{mV}`, () => `\\dfrac{\\Delta V_B}{\\text{LSB}} = \\dfrac{${tn(28 * 6 / 719 * 1000, 0)}}{${tn(3.3 / 4096 * 1000, 2)}} \\approx ${tn(28 * 6 / 719 / (3.3 / 4096), 0)}\\ \\text{LSB}`],
        scene: { params: P2({ Vi: 15, useRz: true, precise: true }) },
        result: () => [['(i) I_R em 12 V e 18 V', `${fI(3.1 / 680)} e ${fI(9.1 / 680)} > I_ZK`], ['(ii) ΔV_B · ΔV_A', `${num(28 * 6 / 719 * 1000, 0)} mV · ${num(39 * 6 / 719 * 1000, 0)} mV`], ['(iii) V_i,mín', `${fV(Q2.viMin({ RS: 680 }))} (≈ ${fV(Q2.viMin({ RS: 680, useRz: true }), 1)} com r_z)`], ['A/D 12 bits', `não serve: ≈ ${num(28 * 6 / 719 / (3.3 / 4096), 0)} LSB de variação`]] },
    ],
    notes: { tempo: '12 min', perguntas: ['Quantos bits "úteis" sobram com essa referência? (log₂ da faixa / variação)', 'Por que aumentar R_S melhora a regulação de linha, mas tem um limite?'], erros: ['Achar que o Zener "segura" a tensão perfeitamente.', 'Comparar a variação com 1 % de 3,3 V em vez de 1 LSB.'], dica: 'Arraste V_i devagar com a lupa ampliada: cada risco da régua é 1 LSB.' },
  },
  {
    type: 'play', hash: 'q2-mexa', q: 2, title: 'Mexa você: referências em série',
    circuit: Q2.circuit, params: P2({ RSrating: 0.5, useRz: true, precise: true }), resetLabel: 'Restaurar valores do item b)',
    controls: [
      { type: 'slider', param: 'Vi', label: 'V_i (fonte)', min: 0, max: 24, step: 0.1, fmt: v => fV(v, 1) },
      { type: 'e12', param: 'RS', label: 'R_S', min: 82, max: 4700, fmt: v => fR(v) },
      { type: 'seg', param: 'inv1', label: 'D_Z1', options: [[false, 'correto'], [true, 'invertido']] },
      { type: 'seg', param: 'inv2', label: 'D_Z2', options: [[false, 'correto'], [true, 'invertido']] },
      { type: 'seg', param: 'useRz', label: 'Modelo do Zener', options: [[false, 'ideal'], [true, 'com r_z']] },
      { type: 'seg', param: 'RSrating', label: 'Potência nominal de R_S', options: [[0.25, '1/4 W'], [0.5, '1/2 W'], [1, '1 W'], [2, '2 W']] },
    ],
    live: (s) => `V<sub>A</sub> = ${fV(s.V.A, 3)} · V<sub>B</sub> = ${fV(s.V.B, 3)}<br>I<sub>R</sub> = ${fI(s.I.IR)} ${s.I.IR > 0 && s.I.IR < Q2IZK ? '(abaixo de I<sub>ZK</sub>)' : ''}<br>P<sub>Z1</sub> = ${fP(s.ex.P1)} · P<sub>Z2</sub> = ${fP(s.ex.P2)} · P<sub>RS</sub> = ${fP(s.ex.PRS)}`,
    challenge: 'Desafios: (1) encontre o menor V<sub>i</sub> que ainda regula. (2) Escolha R<sub>S</sub> para que a variação de V<sub>B</sub> entre 12 e 18 V caia pela metade. Qual o preço? (3) Queime um Zener: qual cai primeiro e por quê?',
    notes: { tempo: 'livre', perguntas: ['Com R_S = 100 Ω e 24 V, qual Zener esquenta mais?'], erros: [], dica: 'Com os dois invertidos, V_A = 1,4 V: um "Zener" invertido é só um diodo.' },
  },
];

Q2.conf = () => {
  const b = Q2.calc({}), c1 = Q2.calc({ inv2: true }), c2 = Q2.calc({ inv1: true });
  const dI = 6 / 719;
  return [
    ['a', 'Corrente nos Zeners', 'I_Z1 = I_Z2 = I_R', 'série: entradas de alta impedância'],
    ['a', 'V_A', '8,90 V', 'V_Z1 + V_Z2'],
    ['b', 'V_A', fV(b.V.A), ''], ['b', 'V_B', fV(b.V.B), ''],
    ['b', 'I_R', fI(b.I.IR), '≥ I_ZK'],
    ['b', 'P_Z1', fP(b.ex.P1), fPct(b.ex.P1 / 0.5) + ' de P_ZM'],
    ['b', 'P_Z2', fP(b.ex.P2), fPct(b.ex.P2 / 0.5) + ' de P_ZM'],
    ['b', 'P_RS', fP(b.ex.PRS), ''],
    ['c', 'D_Z2 invertido: V_A / V_B', `${fV(c1.V.A)} / ${fV(c1.V.B)}`, 'I_R = ' + fI(c1.I.IR)],
    ['c', 'D_Z1 invertido: V_A / V_B', `${fV(c2.V.A)} / ${fV(c2.V.B)}`, 'I_R = ' + fI(c2.I.IR)],
    ['d', 'I_R em 12 V / 18 V', `${fI(3.1 / 680)} / ${fI(9.1 / 680)}`, '> I_ZK = 1 mA'],
    ['d', 'ΔI (12 → 18 V)', fI(dI), 'ΔV_i/(R_S + r_z1 + r_z2); ≈ 8,82 mA sem r_z'],
    ['d', 'ΔV_B', num(28 * dI * 1000, 0) + ' mV', 'r_z2 · ΔI'],
    ['d', 'ΔV_A', num(39 * dI * 1000, 0) + ' mV', '(r_z1 + r_z2) · ΔI'],
    ['d', 'V_i,mín', fV(Q2.viMin({ RS: 680 })), 'ideal; ' + fV(Q2.viMin({ RS: 680, useRz: true })) + ' com r_z'],
    ['d', '1 LSB (12 bits, 3,3 V)', num(3.3 / 4096 * 1000, 3) + ' mV', `ΔV_B ≈ ${num(28 * dI / (3.3 / 4096), 0)} LSB → não serve`],
  ];
};

/* =====================================================================
   QUESTÃO 3 — Os limites do regulador: módulo de rádio de 30 a 180 mA
   9 V, R_S = 18 Ω, 1N4733A (5,1 V · 1 W), I_ZK ≈ 0 nos itens a) a c).
   Reaproveita o solver do regulador em paralelo da Questão 1.
   O módulo é modelado pela resistência equivalente R_L = 5,1 V / I_L.
   ===================================================================== */
const Q3Z = { Vz: 5.1, Pzm: 1, Izk: 0 };
const Q3 = {};
const RL_REP = 5.1 / 0.030, RL_TX = 5.1 / 0.180;              // 170 Ω e 28,3 Ω
const baseQ3 = { Vi: 9, RS: 18, RL: RL_REP, load: 'on', loadStyle: 'module', zener: true, RSrating: null };
const P3 = (o) => Object.assign({}, baseQ3, o);
Q3.calc = (o) => solveShunt(Object.assign({ power: true }, baseQ3, o), Q3Z);
Q3.IZM = 1 / 5.1;
Q3.IR = (9 - 5.1) / 18;
Q3.RLmin = 5.1 / Q3.IR;                                      // I_Z = I_ZK ≈ 0
Q3.RLmax = 5.1 / (Q3.IR - Q3.IZM);                           // I_Z = I_ZM
Q3.IZmin = 0.1 * Q3.IZM;
Q3.RSregMax = (9 - 5.1) / (0.180 + Q3.IZmin);                // regula na transmissão
Q3.RSprotMin = (9 - 5.1) / Q3.IZM;                           // protege sem carga
const modeTxt = (p, s) => p.load === 'none' ? 'desconectado' : Math.abs(p.RL - RL_REP) < 0.5 ? 'repouso · 30 mA' : Math.abs(p.RL - RL_TX) < 0.5 ? 'transmitindo · 180 mA' : `≡ R_L = ${fR(p.RL)}`;

Q3.circuit = {
  viewBox: [1000, 600], Iref: 0.2,
  defaults: P3({}),
  solve: p => solveShunt(p, Q3Z),
  zoomComp: 'DZ',
  zener: { Vz: 5.1, Pzm: 1, Izk: 1e-3, rzDraw: 7, Zzk: 550, Vxmax: 7, LLVmax: 10, LLImax: 0.3, resImax: 0.4, note: 'curva: r_z = 7 Ω e Z_ZK = 550 Ω (datasheet) · cálculos: Zener ideal, I_ZK ≈ 0' },
  meterAt: [784, 494], meterDefault: ['A', 'G'], legendAt: [24, 572],
  probePoints: { A: [800, 105], G: [800, 470], P: [180, 105] },
  comps: {
    Vi: { type: 'dc', x: 110, y: 288, r: 34, label: p => fV(p.Vi, Number.isInteger(p.Vi) ? 0 : 1).replace(/,0 V$/, ' V') },
    RS: { type: 'res', a: [250, 105], b: [360, 105], amp: 13, nodes: ['P', 'A'], Tmax: 155, failMode: 'open', failTitle: 'Resistor R_S queimado (abriu)' },
    DZ: { type: 'zener', a: [470, 306], k: [470, 270], w: 38, zoom: true, zoomName: 'D_Z · 1N4733A (5,1 V)', Vz: 5.1, Tmax: 200, failMode: 'short', failTitle: 'Zener queimado — virou curto' },
    RL: { type: 'res', a: [710, 240], b: [710, 336], amp: 14, variable: true, nodes: ['A', 'G'] },
    MOD: { type: 'module', a: [710, 240], b: [710, 336], w: 86, lines: ['Módulo', 'de rádio', '5,1 V'] },
  },
  wires: Q1.circuit.wires, edges: Q1.circuit.edges, dots: Q1.circuit.dots, terms: Q1.circuit.terms, discs: Q1.circuit.discs,
  arrows: [
    { a: [386, 80], b: [446, 80], t: 'I_R', tx: 458, ty: 87, anchor: 'start' },
    { a: [443, 262], b: [443, 316], t: 'I_Z', tx: 431, ty: 296, anchor: 'end' },
    { a: [650, 262], b: [650, 316], t: 'I_L', tx: 638, ty: 296, anchor: 'end' },
  ],
  labels: [
    { t: 'R_S', x: 305, y: 80, cls: 'nm', anchor: 'middle' },
    { t: p => fR(p.RS), x: 305, y: 148, cls: 'val', anchor: 'middle' },
    { t: 'D_Z', x: 494, y: 268, cls: 'nm' },
    { t: '5,1 V / 1 W', x: 494, y: 294, cls: 'val' },
    { t: '1N4733A', x: 494, y: 318, cls: 'val' },
    { t: (p, s) => modeTxt(p, s), x: 762, y: 230, cls: 'small strong' },
    { t: '+', x: 920, y: 150, cls: 'sym' },
    { t: 'V_L', x: 920, y: 300, cls: 'val strong', anchor: 'middle' },
    { t: '−', x: 920, y: 440, cls: 'sym' },
  ],
  values: [
    { id: 'IR', cur: 'IR', x: 416, y: 50, anchor: 'middle', fn: s => `I_R = ${fI(s.I.IR)}` },
    { id: 'IZ', cur: 'IZ', x: 455, y: 212, anchor: 'end', fn: s => `I_Z = ${fI(s.I.IZ)}`, when: s => s.comp.DZ.show === 'on' },
    { id: 'IL', cur: 'IL', x: 690, y: 212, anchor: 'end', fn: s => `I_L = ${fI(s.I.IL)}` },
    { id: 'VL', x: 920, y: 346, anchor: 'middle', fn: s => fV(s.V.A) },
  ],
  pills: [{ comp: 'DZ', x: 494, y: 352 }],
  bars: [
    { comp: 'DZ', x: 494, y: 390, w: 150, label: 'P_Z / P_ZM' },
    { comp: 'RS', x: 140, y: 182, w: 96, label: 'P_RS / P_nom' },
  ],
  relevo: {
    cur: 'IR',
    segs: (p, s) => [
      { kind: 'rise', to: s.V.P, label: 'fonte' },
      { kind: 'flat', node: 'P' },
      { kind: 'drop', to: s.V.A, label: 'R_S' },
      { kind: 'flat', node: 'A', name: 'V_L' },
      { kind: 'drop', to: 0, label: s.comp.DZ.mode === 'bd' ? (p.load === 'none' ? 'D_Z' : 'D_Z ∥ módulo') : 'módulo (Zener aberto)' },
      { kind: 'flat', node: 'G' },
    ],
    ref: () => ({ v: 5.1, label: 'V_Z = 5,1 V' }),
  },
  sankey: (s) => ({
    Pin: s.ex.Pin, eta: s.ex.eta, Pref: 2.0,
    sinks: [
      { label: 'calor em R_S', P: s.ex.PRS, color: 'rgba(232,119,46,A)' },
      { label: 'calor no Zener', P: s.ex.PZ, color: 'rgba(201,54,42,A)' },
      { label: 'útil no módulo', P: s.ex.PL, color: 'rgba(35,136,79,A)' },
    ],
  }),
  win: (s, p) => {
    const IR = p.Vi > 5.1 ? (p.Vi - 5.1) / p.RS : 0, Imin = Math.max(0, IR - Q3.IZM);
    return { title: 'corrente que o módulo pode puxar', Imin, Imax: IR, Rmin: 5.1 / Math.max(IR, 1e-9), Rmax: Imin > 0 ? 5.1 / Imin : Infinity, max: 0.25, step: 0.05, marks: [{ I: 0.03, label: 'repouso' }, { I: 0.18, label: 'TX' }], I: p.load === 'none' ? 0 : s.I.IL };
  },
  rsrange: (p) => ({ lo: 15, hi: 25, regMax: Q3.RSregMax, protMin: Q3.RSprotMin, cur: p.RS }),
  /* antena do módulo: ondas só durante a transmissão */
  deco: (ctx, sim) => {
    const st = sim.sol.comp.MOD; if (!st || st.show === 'hidden') return;
    const x = 742, y0 = 240, y1 = 196;
    ctx.globalAlpha = st.show === 'disc' ? 0.35 : 1;
    ctx.strokeStyle = '#1F2D4D'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.fillStyle = '#1F2D4D'; ctx.beginPath(); ctx.arc(x, y1, 4.5, 0, 7); ctx.fill();
    const tx = sim.power && sim.p.load !== 'none' && sim.sol.I.IL > 0.1 && sim.sol.V.A > 5;
    if (tx) for (let k = 0; k < 3; k++) {
      const f = ((sim.t * 0.9 + k / 3) % 1), r = 10 + f * 46;
      ctx.strokeStyle = `rgba(232,119,46,${(1 - f) * 0.9})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y1, r, -Math.PI * 0.42, Math.PI * 0.1 - Math.PI * 0.42 + 0.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y1, r, Math.PI * 1.42 - 0.6 - 0.1 + Math.PI * 0.1, Math.PI * 1.42); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

/* ---------- ilustração: módulo de rádio alimentado por 9 V ---------- */
Q3.illus = `<svg viewBox="0 0 560 340" role="img" aria-label="Módulo de rádio alimentado por regulador Zener">
  <rect x="8" y="8" width="544" height="324" rx="18" fill="#E8EDF5"/>
  <rect x="40" y="120" width="110" height="120" rx="12" fill="#2B3A5E"/>
  <text x="95" y="168" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="16" text-anchor="middle">9 V</text>
  <text x="95" y="190" fill="#C9D3E6" font-family="Lato,sans-serif" font-weight="700" font-size="12" text-anchor="middle">barramento</text>
  <path d="M150 160 H210" stroke="#D9452B" stroke-width="5"/><path d="M150 210 H210" stroke="#1F2D4D" stroke-width="5"/>
  <rect x="210" y="138" width="110" height="94" rx="8" fill="#2E7D5B"/>
  <rect x="224" y="158" width="40" height="12" rx="6" fill="#E9D7B3"/><rect x="232" y="158" width="4" height="12" fill="#7A4A1E"/><rect x="240" y="158" width="4" height="12" fill="#7A4A1E"/><rect x="248" y="158" width="4" height="12" fill="#1F2D4D"/>
  <rect x="230" y="190" width="30" height="12" rx="6" fill="#F3B07A"/><rect x="254" y="190" width="5" height="12" fill="#1F2D4D"/>
  <text x="265" y="222" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="11" text-anchor="middle">18 Ω + 5,1 V</text>
  <path d="M320 170 H372" stroke="#2C9C9C" stroke-width="5"/><path d="M320 205 H372" stroke="#1F2D4D" stroke-width="5"/>
  <rect x="372" y="120" width="150" height="130" rx="12" fill="#EEF3FA" stroke="#1F2D4D" stroke-width="3"/>
  <rect x="392" y="146" width="62" height="44" rx="4" fill="#1C2333"/><text x="423" y="173" fill="#fff" font-family="Lato,sans-serif" font-weight="900" font-size="11" text-anchor="middle">RF</text>
  <text x="447" y="222" fill="#1F2D4D" font-family="Lato,sans-serif" font-weight="900" font-size="13" text-anchor="middle">módulo sem fio</text>
  <text x="447" y="240" fill="#47536E" font-family="Lato,sans-serif" font-weight="700" font-size="11" text-anchor="middle">30 mA · 180 mA</text>
  <path d="M496 120 V70" stroke="#1F2D4D" stroke-width="4"/><circle cx="496" cy="68" r="5" fill="#1F2D4D"/>
  <path d="M512 56 a24 24 0 0 1 0 26" stroke="#E8772E" stroke-width="3" fill="none"/><path d="M522 46 a38 38 0 0 1 0 46" stroke="#E8772E" stroke-width="3" fill="none"/>
  <path d="M480 56 a24 24 0 0 0 0 26" stroke="#E8772E" stroke-width="3" fill="none"/><path d="M470 46 a38 38 0 0 0 0 46" stroke="#E8772E" stroke-width="3" fill="none"/>
</svg>`;

/* ---------- desenho da solução de engenharia (item d) ---------- */
Q3.solucao = () => {
  const etaLDO = 5.1 / 9;
  return `<svg viewBox="0 0 560 196" role="img" aria-label="Alternativas de regulador">
  <style>.t{font:900 13px Lato,sans-serif;fill:#1F2D4D}.s{font:700 11px Lato,sans-serif;fill:#47536E}.o{font:900 12px Lato,sans-serif;fill:#B4551A}</style>
  <rect x="6" y="10" width="72" height="44" rx="8" fill="#2B3A5E"/><text x="42" y="37" text-anchor="middle" style="font:900 13px Lato,sans-serif;fill:#fff">9 V</text>
  <path d="M78 32 H130" stroke="#1F2D4D" stroke-width="3"/><rect x="130" y="10" width="150" height="44" rx="8" fill="#DDF1E5" stroke="#23884F" stroke-width="2"/>
  <text x="205" y="30" text-anchor="middle" class="t">LDO 5,1 V</text><text x="205" y="46" text-anchor="middle" class="s">corrente sob demanda</text>
  <path d="M280 32 H320" stroke="#1F2D4D" stroke-width="3"/><rect x="320" y="10" width="100" height="44" rx="8" fill="#EEF3FA" stroke="#1F2D4D" stroke-width="2"/><text x="370" y="37" text-anchor="middle" class="t">módulo</text>
  <text x="432" y="38" class="o">η ≈ ${num(etaLDO * 100, 0)} %</text>
  <rect x="6" y="80" width="72" height="44" rx="8" fill="#2B3A5E"/><text x="42" y="107" text-anchor="middle" style="font:900 13px Lato,sans-serif;fill:#fff">9 V</text>
  <path d="M78 102 H130" stroke="#1F2D4D" stroke-width="3"/><rect x="130" y="80" width="150" height="44" rx="8" fill="#DDF1E5" stroke="#23884F" stroke-width="2"/>
  <text x="205" y="100" text-anchor="middle" class="t">conversor buck</text><text x="205" y="116" text-anchor="middle" class="s">chaveado</text>
  <path d="M280 102 H320" stroke="#1F2D4D" stroke-width="3"/><rect x="320" y="80" width="100" height="44" rx="8" fill="#EEF3FA" stroke="#1F2D4D" stroke-width="2"/><text x="370" y="107" text-anchor="middle" class="t">módulo</text>
  <text x="432" y="108" class="o">η ≈ 85–90 %</text>
  <text x="6" y="152" class="t">Zener + transistor (seguidor de emissor):</text>
  <text x="6" y="170" class="s">o Zener só fornece a base (poucos mA); a corrente da carga passa pelo transistor.</text>
  <text x="6" y="188" class="s">Os dois lineares (LDO e seguidor) têm η ≈ V_L/V_i nos dois modos, sem desperdício em repouso.</text>
</svg>`;
};

Q3.slides = [
  {
    type: 'context', hash: 'q3', q: 3, kind: 'Diodo Zener · os limites do regulador',
    title: 'Um módulo de rádio de 30 a 180 mA',
    story: 'Um módulo de comunicação sem fio exige <b>5,1 V</b> e consome <b>30 mA em repouso</b> e <b>180 mA durante a transmissão</b>. A proposta é alimentá-lo a partir de um barramento de 9 V com um Zener e um resistor série.',
    chips: [['V_i = 9 V'], ['R_S = 18 Ω'], ['1N4733A', 'o'], ['V_Z = 5,1 V'], ['P_ZM = 1 W'], ['I_ZK ≈ 0 (itens a–c)'], ['I_L = 30 a 180 mA', 'o']],
    items: [['A', 'a)', 'Por que existe R_L,mín e às vezes R_L,máx'], ['B', 'b)', 'I_ZM, I_R, P_RS e a janela de R_L'], ['C', 'c)', 'Repouso, transmissão e módulo desconectado'], ['D', 'd)', 'Projeto impossível, eficiência e solução']],
    trains: 'Treina: faixa de carga, P_ZM, projeto impossível, eficiência.',
    notes: { tempo: '3 min', perguntas: ['Por que um rádio consome muito mais ao transmitir?', 'O que acontece com a corrente de R_S quando o consumo do módulo muda?'], erros: [], dica: 'Antecipe a pergunta-chave: quem absorve a corrente que o módulo deixa de consumir?' },
  },
  {
    type: 'circuit', hash: 'q3-circuito', q: 3, title: 'O circuito da Figura 3', circuit: Q3.circuit,
    steps: [
      { t: 'Antes de ligar', p: 'Mesmo regulador da Questão 1, mas agora a carga é um <b>módulo de rádio</b> cujo consumo muda com o modo de operação. $R_S$ é pequeno (18 Ω): as correntes são da ordem de centenas de mA.', eq: [() => 'V_i = 9\\,\\text{V},\\quad R_S = 18\\,\\Omega,\\quad V_Z = 5{,}1\\,\\text{V}'],
        scene: { params: P3({}), power: false, cta: true, values: 'none', highlight: ['MOD'] } },
      { t: 'Ligue a fonte', p: 'Em repouso, quase toda a corrente de $R_S$ vai para o Zener: o ramo do Zener fica muito mais "movimentado" que o do módulo.',
        scene: { params: P3({}), power: true, values: 'none' } },
      { t: 'Agora transmita', p: 'Quando o módulo transmite, ele puxa 180 mA. A corrente de $R_S$ <b>não muda</b>: a parte que vai para o Zener diminui. Veja as ondas na antena.',
        widget: { type: 'seg', param: 'RL', options: [[RL_REP, 'repouso'], [RL_TX, 'transmitindo']] },
        scene: { params: P3({ RL: RL_TX }), values: 'none' } },
    ],
    notes: { tempo: '4 min', perguntas: ['Onde está o calor neste circuito em repouso?'], erros: ['Achar que o Zener "fornece" corrente ao módulo quando ele transmite.'], dica: 'Alterne repouso/transmissão em câmera lenta e acompanhe a divisão no nó.' },
  },
  {
    type: 'item', hash: 'q3-a', q: 3, level: 'A', letter: 'a', title: 'R_L mínimo e máximo',
    enun: '<b>a)</b> Explique por que um regulador Zener com V<sub>i</sub> fixo tem uma resistência de carga mínima e, em alguns casos, também uma máxima. O que acontece fisicamente em cada limite?',
    circuit: Q3.circuit,
    steps: [
      { t: 'R_S entrega uma corrente fixa', p: 'Enquanto o Zener regula, a tensão em $R_S$ é sempre $V_i - V_Z$: a corrente $I_R$ <b>não depende da carga</b>. Ela só se divide entre o Zener e o módulo.', eq: [s => `I_R = \\dfrac{V_i - V_Z}{R_S} = \\dfrac{3{,}9}{18} = ${tmA(Q3.IR, 1)}`, () => 'I_Z = I_R - I_L'],
        scene: { params: P3({}), values: ['IR', 'IZ', 'IL', 'VL', 'DZ:pill'] } },
      { t: 'Carga pesada demais', p: 'Se o módulo pede mais do que $I_R$, não sobra corrente para o Zener: ele <b>desliga</b> (barreira volta) e $V_L$ cai abaixo de 5,1 V. Arraste $R_L$ e encontre o ponto em que ele liga.', eq: [() => 'I_L \\to I_R\\ \\Rightarrow\\ I_Z \\to 0\\ \\Rightarrow\\ \\text{Zener desliga}', () => `R_{L,\\min} = \\dfrac{V_Z}{I_R} = ${tn(Q3.RLmin, 1)}\\,\\Omega`],
        widget: { type: 'slider', param: 'RL', label: 'Arraste R_L (equivalente do módulo)', min: 15, max: 400, step: 0.5, marks: [{ v: Q3.RLmin, label: 'R_L,mín' }, { v: Q3.RLmax, label: 'R_L,máx' }], fmt: v => fR(v), mfmt: v => num(v, 1) + ' Ω' },
        live: (s, p) => `R<sub>L</sub> = ${fR(p.RL)} → V<sub>L</sub> = ${fV(s.V.A)} · I<sub>Z</sub> = ${fI(s.I.IZ)} · P<sub>Z</sub> = ${fP(s.ex.PZ)}`,
        scene: { params: P3({ RL: 20 }) } },
      { t: 'Carga leve demais (ou ausente)', p: 'Sem o módulo, os 216,7 mA de $R_S$ vão todos para o Zener: $P_Z$ passa de 1 W. Observe a temperatura subir até a ruptura térmica.', eq: [() => `P_Z = 5{,}1 \\times ${tmA(Q3.IR, 1)} = ${tn(5.1 * Q3.IR, 3)}\\,\\text{W} > 1\\,\\text{W}`],
        callout: { k: 'atencao', t: 'Atenção', x: 'A queima não é decorativa: ela acontece porque o número calculado passa de $P_{ZM}$. Use "Voltar ao normal" para recomeçar.' },
        scene: { params: P3({ load: 'none' }), values: ['IR', 'IZ', 'VL', 'DZ:*'] } },
      { t: 'Por que "em alguns casos"?', p: '$R_{L,\\max}$ só existe se $R_S$ entrega mais corrente do que o Zener aguenta sozinho. Aqui $I_R = 216{,}7$ mA $> I_{ZM} = 196{,}1$ mA. Na Questão 1, $I_R = 19$ mA $< I_{ZM} = 66{,}7$ mA: sem carga o Zener sobrevive e não há $R_{L,\\max}$.', eq: [() => '\\exists\\,R_{L,\\max}\\iff I_R > I_{ZM}'],
        scene: { params: P3({}) },
        result: () => [['Limite inferior', 'R_L pequeno: Zener sem corrente, desliga'], ['Limite superior', 'R_L grande: Zener com corrente demais, aquece'], ['R_L,máx existe', 'só se I_R > I_ZM']] },
    ],
    notes: { tempo: '8 min', perguntas: ['Em qual limite o defeito é "silencioso" (o módulo só recebe menos tensão)?', 'Em qual limite o defeito destrói um componente?'], erros: ['Achar que mais corrente no Zener melhora a regulação sem limite.'], dica: 'No passo do slider, a bolinha da reta de carga sai do joelho no R_L,mín.' },
  },
  {
    type: 'item', hash: 'q3-b', q: 3, level: 'B', letter: 'b', title: 'A janela de carga',
    enun: '<b>b)</b> Calcule I<sub>ZM</sub>, I<sub>R</sub> e a potência em R<sub>S</sub>. Determine a faixa de R<sub>L</sub> (R<sub>L,mín</sub> e R<sub>L,máx</sub>) e a faixa de corrente de carga correspondente.',
    circuit: Q3.circuit, chartKinds: ['iv', 'll', 'win', 'sankey'],
    steps: [
      { t: 'Corrente máxima do Zener', p: 'A potência máxima do datasheet vira um limite de corrente.', eq: [() => `I_{ZM} = \\dfrac{P_{ZM}}{V_Z} = \\dfrac{1}{5{,}1} = ${tmA(Q3.IZM, 1)}`],
        scene: { params: P3({}), values: ['DZ:*'], highlight: ['DZ'] } },
      { t: 'I_R e a potência em R_S', p: 'Com o Zener regulando, $R_S$ tem sempre 3,9 V.', eq: [() => `I_R = \\dfrac{9 - 5{,}1}{18} = ${tmA(Q3.IR, 1)}`, () => `P_{R_S} = 3{,}9 \\times ${tmA(Q3.IR, 1)} = ${tmW(3.9 * Q3.IR)}`],
        callout: { k: 'atencao', t: 'Atenção', x: 'Com o dobro como margem, $R_S$ precisa ser de <b>2 W</b>: um resistor de 1/4 W queimaria.' },
        scene: { params: P3({}), values: ['IR', 'DZ:*'], highlight: ['RS'] } },
      { t: 'R_L,mín: Zener no limite de desligar', p: 'Com $I_{ZK} \\approx 0$, toda a corrente de $R_S$ pode ir para a carga.', eq: [() => `I_{L,\\max} = I_R - I_{ZK} \\approx ${tmA(Q3.IR, 1)}`, () => `R_{L,\\min} = \\dfrac{5{,}1}{${tn(Q3.IR * 1e3, 1)}\\,\\text{mA}} = ${tn(Q3.RLmin, 1)}\\,\\Omega`],
        scene: { params: P3({ RL: Q3.RLmin * 1.0001 }) } },
      { t: 'R_L,máx: Zener no limite de potência', p: 'A carga precisa consumir pelo menos o excesso que o Zener não aguenta.', eq: [() => `I_{L,\\min} = I_R - I_{ZM} = ${tmA(Q3.IR - Q3.IZM, 1)}`, () => `R_{L,\\max} = \\dfrac{5{,}1}{${tn((Q3.IR - Q3.IZM) * 1e3, 1)}\\,\\text{mA}} = ${tn(Q3.RLmax, 1)}\\,\\Omega`],
        scene: { params: P3({ RL: Q3.RLmax * 0.999 }) } },
      { t: 'A janela verde', p: 'Arraste $R_L$ e veja o ponto percorrer a janela de corrente (gráfico "Janela de carga"). Os dois modos do módulo, 30 e 180 mA, estão dentro dela.',
        widget: { type: 'slider', param: 'RL', label: 'Arraste R_L (equivalente do módulo)', min: 15, max: 400, step: 0.5, marks: [{ v: Q3.RLmin, label: 'R_L,mín' }, { v: Q3.RLmax, label: 'R_L,máx' }], fmt: v => fR(v), mfmt: v => num(v, 1) + ' Ω' },
        live: (s, p) => `I<sub>L</sub> = ${fI(s.I.IL)} · I<sub>Z</sub> = ${fI(s.I.IZ)} · P<sub>Z</sub> = ${fP(s.ex.PZ)}`,
        scene: { params: P3({ RL: 120 }) },
        result: () => [['I_ZM', fI(Q3.IZM)], ['I_R', fI(Q3.IR)], ['P_RS', fP(3.9 * Q3.IR) + ' → 2 W'], ['R_L', `${num(Q3.RLmin, 1)} Ω a ${num(Q3.RLmax, 1)} Ω`], ['I_L', `${fI(Q3.IR - Q3.IZM)} a ${fI(Q3.IR)}`]] },
    ],
    notes: { tempo: '10 min', perguntas: ['Por que R_L,mín corresponde a I_L,máx (e vice-versa)?', 'O que acontece com a janela se V_i subir para 10 V?'], erros: ['Inverter R_L,mín e R_L,máx.', 'Esquecer de especificar a potência de R_S.'], dica: 'No "Mexa você", mude V_i e veja a janela se deslocar.' },
  },
  {
    type: 'item', hash: 'q3-c', q: 3, level: 'C', letter: 'c', title: 'Repouso, transmissão e desconexão',
    enun: '<b>c)</b> Verifique o funcionamento nos dois modos do módulo. Analise o que acontece se o módulo for desconectado com o barramento ligado.',
    circuit: Q3.circuit,
    steps: [
      { t: 'Repouso: 30 mA', p: 'O Zener absorve quase toda a corrente: funciona, mas trabalhando a 95 % de $P_{ZM}$, sem folga.', eq: [s => `I_Z = ${tn(Q3.IR * 1e3, 1)} - 30 = ${tmA(s.I.IZ, 1)}`, s => `P_Z = 5{,}1 \\times ${tmA(s.I.IZ, 1)} = ${tmW(s.ex.PZ)}\\ (${tn(s.ex.PZ * 100, 0)}\\,\\%)`],
        widget: { type: 'seg', param: 'RL', options: [[RL_REP, 'REPOUSO'], [RL_TX, 'TRANSMITINDO']] },
        scene: { params: P3({ RL: RL_REP }) } },
      { t: 'Transmitindo: 180 mA', p: 'O módulo puxa mais e o Zener fica com menos corrente. A bolinha desce pela curva I×V, mas continua na ruptura.', eq: [s => `I_Z = ${tn(Q3.IR * 1e3, 1)} - 180 = ${tmA(s.I.IZ, 1)}`, s => `P_Z = ${tmW(s.ex.PZ)}`],
        widget: { type: 'seg', param: 'RL', options: [[RL_REP, 'REPOUSO'], [RL_TX, 'TRANSMITINDO']] },
        scene: { params: P3({ RL: RL_TX }) } },
      { t: 'Desconectar o módulo', p: 'Clique no botão. Toda a corrente de $R_S$ migra para o Zener; a potência passa de 1 W e o Zener esquenta até virar curto. A causa aparece em números.', eq: [() => `I_Z = I_R = ${tmA(Q3.IR, 1)}`, () => `P_Z = ${tn(5.1 * Q3.IR, 3)}\\,\\text{W} > P_{ZM} = 1\\,\\text{W}`],
        widget: { type: 'toggle', param: 'load', a: 'none', b: 'on', la: 'RECONECTAR O MÓDULO', lb: 'DESCONECTAR O MÓDULO' },
        scene: { params: P3({ RL: RL_REP }) } },
      { t: 'Depois da queima', p: 'O Zener queimado vira <b>curto</b>: $V_L = 0$ e o módulo não liga mais, mesmo reconectado. $R_S$ passa a ter os 9 V inteiros.', eq: [() => 'V_L = 0', () => `P_{R_S} = \\dfrac{9^2}{18} = ${tn(81 / 18, 1)}\\,\\text{W}`],
        widget: { type: 'action', label: 'Mostrar o Zener queimado', run: sim => { if (!sim.damage.DZ) sim.fail('DZ', `P_Z = ${fP(5.1 * Q3.IR)} > P_ZM = 1 W`); } },
        scene: { params: P3({ RL: RL_REP }), resetDamage: false },
        result: () => { const r = Q3.calc({ RL: RL_REP }), t = Q3.calc({ RL: RL_TX }), n = Q3.calc({ load: 'none' }); return [['Repouso', `I_Z = ${fI(r.I.IZ)} · P_Z = ${fP(r.ex.PZ)} (95 %)`], ['Transmitindo', `I_Z = ${fI(t.I.IZ)} · P_Z = ${fP(t.ex.PZ)}`], ['Desconectado', `P_Z = ${fP(n.ex.PZ)} > 1 W → queima (curto)`]]; } },
    ],
    notes: { tempo: '10 min', perguntas: ['Qual modo é o pior caso para o Zener? E para o módulo?', 'Um fusível resolveria? Onde?'], erros: ['Verificar só o modo de maior consumo.', 'Achar que o Zener queimado "abre" e o módulo fica protegido.'], dica: 'Antes de clicar em DESCONECTAR, peça uma previsão: queima ou não? Em quanto tempo?' },
  },
  {
    type: 'item', hash: 'q3-d', q: 3, level: 'D', letter: 'd', title: 'Um projeto impossível',
    enun: '<b>d)</b> (i) Adotando I<sub>Z,mín</sub> = 0,1·I<sub>ZM</sub>, mostre que não existe R<sub>S</sub> que proteja o Zener sem carga e mantenha a regulação durante a transmissão. (ii) Calcule a eficiência nos dois modos. (iii) Proponha uma solução de engenharia.',
    circuit: Q3.circuit, chartKinds: ['rsrange', 'sankey', 'iv', 'll'],
    steps: [
      { t: '(i) A corrente mínima do Zener', p: 'Para regular com segurança, o Zener precisa de pelo menos 10 % de $I_{ZM}$.', eq: [() => `I_{Z,\\min} = 0{,}1 \\times ${tmA(Q3.IZM, 1)} = ${tmA(Q3.IZmin, 1)}`],
        scene: { params: P3({ RL: RL_TX }) } },
      { t: 'Condição 1: regular transmitindo', p: '$R_S$ precisa entregar os 180 mA do módulo <b>mais</b> $I_{Z,\\min}$: isso exige $R_S$ pequeno.', eq: [() => `R_S \\le \\dfrac{3{,}9}{180 + ${tn(Q3.IZmin * 1e3, 1)}\\,\\text{mA}} = ${tn(Q3.RSregMax, 2)}\\,\\Omega`],
        scene: { params: P3({ RL: RL_TX }) } },
      { t: 'Condição 2: sobreviver sem carga', p: 'Sem o módulo, toda $I_R$ vai para o Zener: ela não pode passar de $I_{ZM}$. Isso exige $R_S$ grande.', eq: [() => `R_S \\ge \\dfrac{3{,}9}{${tn(Q3.IZM * 1e3, 1)}\\,\\text{mA}} = ${tn(Q3.RSprotMin, 2)}\\,\\Omega`, () => `${tn(Q3.RSprotMin, 2)} > ${tn(Q3.RSregMax, 2)}\\ \\Rightarrow\\ \\text{impossível}`],
        widget: { type: 'slider', param: 'RS', label: 'Experimente R_S', min: 15, max: 25, step: 0.01, marks: [{ v: Q3.RSregMax, label: 'máx. p/ TX' }, { v: Q3.RSprotMin, label: 'mín. s/ carga' }], fmt: v => num(v, 2) + ' Ω' },
        live: (s, p) => { const tx = Q3.calc({ RS: p.RS, RL: RL_TX }), nl = Q3.calc({ RS: p.RS, load: 'none' }); return `TX: I<sub>Z</sub> = ${fI(tx.I.IZ)} ${tx.I.IZ >= Q3.IZmin ? '<span class="pill on">ok</span>' : '<span class="pill off">&lt; I<sub>Z,mín</sub></span>'}<br>sem carga: P<sub>Z</sub> = ${fP(nl.ex.PZ)} ${nl.ex.PZ <= 1 ? '<span class="pill on">ok</span>' : '<span class="pill off">&gt; 1 W</span>'}`; },
        scene: { params: P3({ RL: RL_TX, RS: 19.7 }) } },
      { t: '(ii) Eficiência nos dois modos', p: 'A fonte entrega sempre a mesma potência ($9 \\times 216{,}7$ mA). O que muda é a fração que chega ao módulo.', eq: [() => `\\eta_{\\text{rep}} = \\dfrac{5{,}1 \\times 30\\,\\text{m}}{9 \\times ${tn(Q3.IR * 1e3, 1)}\\,\\text{m}} = ${tn(Q3.calc({ RL: RL_REP }).ex.eta * 100, 1)}\\,\\%`, () => `\\eta_{\\text{TX}} = \\dfrac{5{,}1 \\times 180\\,\\text{m}}{9 \\times ${tn(Q3.IR * 1e3, 1)}\\,\\text{m}} = ${tn(Q3.calc({ RL: RL_TX }).ex.eta * 100, 1)}\\,\\%`],
        widget: { type: 'seg', options: [[{ RL: RL_REP, RS: 18 }, 'repouso'], [{ RL: RL_TX, RS: 18 }, 'transmitindo']] },
        scene: { params: P3({ RL: RL_REP }) } },
      { t: '(iii) Solução de engenharia', p: 'O regulador Zener em paralelo consome a corrente máxima o tempo todo. A solução é um regulador que só puxa da fonte o que a carga pede:',
        html: () => Q3.solucao(),
        scene: { params: P3({ RL: RL_REP }) },
        result: () => [['I_Z,mín', fI(Q3.IZmin)], ['Regular na TX', `R_S ≤ ${num(Q3.RSregMax, 2)} Ω`], ['Proteger sem carga', `R_S ≥ ${num(Q3.RSprotMin, 2)} Ω`], ['η repouso / TX', `${fPct(Q3.calc({ RL: RL_REP }).ex.eta)} / ${fPct(Q3.calc({ RL: RL_TX }).ex.eta)}`], ['Solução', `LDO (η ≈ ${num(5.1 / 9 * 100, 0)} %) ou buck (≈ 85–90 %)`]] },
    ],
    notes: { tempo: '12 min', perguntas: ['Se o barramento fosse 6 V, o projeto ficaria possível?', 'Por que a eficiência de um LDO não depende do modo do módulo?'], erros: ['Achar que basta trocar o Zener por um de 5 W sem olhar a eficiência.', 'Confundir eficiência com potência dissipada.'], dica: 'No gráfico "R_S possíveis", arraste R_S para a faixa vermelha: nenhuma posição satisfaz as duas condições.' },
  },
  {
    type: 'play', hash: 'q3-mexa', q: 3, title: 'Mexa você: o regulador no limite',
    circuit: Q3.circuit, params: P3({ RSrating: 2 }), resetLabel: 'Restaurar valores do enunciado',
    controls: [
      { type: 'slider', param: 'Vi', label: 'V_i (barramento)', min: 0, max: 15, step: 0.1, fmt: v => fV(v, 1) },
      { type: 'e12', param: 'RS', label: 'R_S', min: 10, max: 120, fmt: v => fR(v) },
      { type: 'seg', label: 'Módulo', options: [[{ load: 'on', RL: RL_REP }, 'repouso'], [{ load: 'on', RL: RL_TX }, 'TX'], [{ load: 'none' }, 'desconectado']] },
      { type: 'e12', param: 'RL', label: 'R_L equivalente (consumo livre)', min: 10, max: 1000, fmt: v => fR(v) },
      { type: 'seg', param: 'RSrating', label: 'Potência nominal de R_S', options: [[1, '1 W'], [2, '2 W'], [5, '5 W']] },
    ],
    live: (s, p) => `Estado: <b>${{ bd: 'regulando', off: 'desligado (V_L caiu)', absent: 'removido', short: 'Zener em curto', nopower: 'sem alimentação' }[s.comp.DZ.mode]}</b><br>V<sub>L</sub> = ${fV(s.V.A)} · I<sub>R</sub> = ${fI(s.I.IR)}<br>I<sub>Z</sub> = ${fI(s.I.IZ)} · I<sub>L</sub> = ${fI(s.I.IL)}<br>P<sub>Z</sub> = ${fP(s.ex.PZ)} · P<sub>RS</sub> = ${fP(s.ex.PRS)} · η = ${fPct(s.ex.eta)}`,
    challenge: 'Desafios: (1) ache um V<sub>i</sub> que deixa o projeto seguro sem carga, mantendo R<sub>S</sub> = 18 Ω. Ele ainda regula na TX? (2) Qual o maior R<sub>S</sub> E12 que regula em TX? Ele protege o Zener? (3) Queime o Zener e depois o R<sub>S</sub> de 1 W.',
    notes: { tempo: 'livre', perguntas: ['Por que baixar V_i ajuda o Zener mas prejudica a TX?'], erros: [], dica: 'Com V_i ≈ 8,6 V e 18 Ω, sem carga, P_Z fica abaixo de 1 W — mas a TX deixa de regular.' },
  },
];

Q3.conf = () => {
  const r = Q3.calc({ RL: RL_REP }), t = Q3.calc({ RL: RL_TX }), n = Q3.calc({ load: 'none' });
  return [
    ['b', 'I_ZM', fI(Q3.IZM), 'P_ZM / V_Z'],
    ['b', 'I_R', fI(Q3.IR), '(9 − 5,1)/18'],
    ['b', 'P_RS', fP(3.9 * Q3.IR), 'especificar 2 W'],
    ['b', 'R_L,mín / R_L,máx', `${num(Q3.RLmin, 1)} Ω / ${num(Q3.RLmax, 1)} Ω`, ''],
    ['b', 'I_L,mín / I_L,máx', `${fI(Q3.IR - Q3.IZM)} / ${fI(Q3.IR)}`, ''],
    ['c', 'Repouso: I_Z / P_Z', `${fI(r.I.IZ)} / ${fP(r.ex.PZ)}`, fPct(r.ex.PZ) + ' de P_ZM'],
    ['c', 'TX: I_Z / P_Z', `${fI(t.I.IZ)} / ${fP(t.ex.PZ)}`, ''],
    ['c', 'Desconectado: P_Z', fP(n.ex.PZ), '> 1 W → queima (curto)'],
    ['c', 'P_RS com Zener em curto', fP(81 / 18), 'V_L = 0'],
    ['d', 'I_Z,mín', fI(Q3.IZmin), '0,1 · I_ZM'],
    ['d', 'R_S para regular em TX', '≤ ' + num(Q3.RSregMax, 2) + ' Ω', ''],
    ['d', 'R_S para proteger sem carga', '≥ ' + num(Q3.RSprotMin, 2) + ' Ω', 'faixas não se sobrepõem'],
    ['d', 'η repouso / TX', `${fPct(r.ex.eta)} / ${fPct(t.ex.eta)}`, 'P_fonte = ' + fP(9 * Q3.IR)],
    ['d', 'η com LDO', fPct(5.1 / 9), 'nos dois modos'],
  ];
};

/* =====================================================================
   QUESTÃO 4 — Fita de LED de 12 V
   Segmento = R + 3 LEDs brancos em série; 100 segmentos em paralelo
   (5 m × 60 LEDs/m = 300 LEDs). V_F = 3,0 V, I_F = 20 mA, I_F,máx = 30 mA.
   O esquemático mostra 3 dos 100 segmentos. A "vista da fita" resolve
   os 100 segmentos com a queda nas trilhas de cobre.
   Modelo: LED com V_F fixo (r_d só na comparação do item a).
   ===================================================================== */
const Q4L = { VF: 3.0, Inom: 0.02, Imax: 0.03 };
const Q4 = {};
const SEGX = [380, 600, 820];
const baseQ4 = { V: 12, n: 3, R: 150, VF: 3.0, vfSeg: null, rd: 0, shared: false, Rsh: 50, Rrating: null, ends: 'one', tol: false, seed: 7, drop: false, cc: false };
const P4 = (o) => Object.assign({}, baseQ4, o);

/* ---------- solver dos 3 segmentos desenhados ---------- */
function solveQ4(p) {
  const dmg = p.damage || {}, V = p.power ? p.V : 0, n = p.n, rd = p.rd || 0;
  const segs = [0, 1, 2].map(k => {
    const vf = p.vfSeg ? p.vfSeg[k] : p.VF;
    const deadLED = [1, 2, 3, 4].slice(0, n).find(i => dmg['L' + i + (k + 1)]);
    return { vf, Vk: n * vf, rk: n * rd, dead: !!(deadLED || (!p.shared && dmg['R' + (k + 1)])), deadLED };
  });
  const I = [0, 0, 0];
  let Vn = V;                                   // tensão no topo dos segmentos
  if (p.shared) {
    const alive = [0, 1, 2].filter(k => !segs[k].dead);
    if (dmg.RSH || !alive.length) Vn = dmg.RSH ? 0 : V;
    else if (rd > 0) {                          // com r_d: divisão desigual (bissecção no nó)
      const f = x => (V - x) / p.Rsh - alive.reduce((a, k) => a + Math.max(0, (x - segs[k].Vk) / segs[k].rk), 0);
      let lo = 0, hi = V; for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; f(m) > 0 ? lo = m : hi = m; }
      Vn = (lo + hi) / 2; alive.forEach(k => I[k] = Math.max(0, (Vn - segs[k].Vk) / segs[k].rk));
    } else {                                    // V_F fixo: o segmento de menor V_F leva tudo
      const vmin = Math.min(...alive.map(k => segs[k].Vk));
      if (V > vmin) { const It = (V - vmin) / p.Rsh, ties = alive.filter(k => Math.abs(segs[k].Vk - vmin) < 1e-9); ties.forEach(k => I[k] = It / ties.length); Vn = vmin; }
    }
  } else segs.forEach((s, k) => { if (!s.dead) I[k] = Math.max(0, (V - s.Vk) / (p.R + s.rk)); });
  const IT = I[0] + I[1] + I[2];
  const Vnodes = { P: V, T: p.shared ? Vn : V, G: 0 };
  const comp = { Vi: {}, RSH: { show: p.shared ? 'on' : 'hidden', P: p.shared ? (V - Vn) * IT : 0 } };
  let PR = comp.RSH.P, PL = 0;
  segs.forEach((s, k) => {
    const id = k + 1, Ik = I[k], Vtop = Vnodes.T;
    const M = p.shared ? Vtop : Vtop - Ik * p.R;
    const PRk = p.shared ? 0 : Ik * Ik * p.R; PR += PRk;
    comp['R' + id] = { show: p.shared ? 'hidden' : 'on', P: PRk, Pmax: p.Rrating || null, failCause: `P_R = ${fP(PRk)} > ${fW(p.Rrating || 0)} (nominal)` };
    // nós entre LEDs: com corrente, cada LED cai V_F + r_d·I; sem corrente, a tensão se divide igualmente
    // (ou fica toda sobre o LED aberto, se um deles queimou)
    let v = M;
    for (let i = 1; i <= 4; i++) {
      const lid = 'L' + i + id, show = i <= n ? 'on' : 'hidden';
      let drop;
      if (i > n) drop = 0;
      else if (Ik > 0) drop = s.vf + rd * Ik;
      else if (s.deadLED) drop = ('L' + i + id) === s.deadLED ? M : 0;
      else drop = M / n;
      const Vf = Math.max(0, Math.min(drop, v));
      const mode = i > n ? undefined : (dmg[lid] ? 'dead' : Ik > 0 ? 'fwd' : (V > 0 ? 'low' : 'eq'));
      comp[lid] = { show, mode, I: Ik, V: Vf, vAcross: 1, ratio: i <= n ? Ik / Q4L.Imax : undefined, bar: { v: Ik, max: Q4L.Imax, fmt: fI }, failCause: `I_F = ${num(Ik * 1000, 1)} mA > I_F,máx = 30 mA`, P: i <= n ? s.vf * Ik : 0 };
      PL += i <= n ? s.vf * Ik : 0;
      v -= Vf; if (i === 1) Vnodes['A' + id + '1'] = v; if (i === 2) Vnodes['A' + id + '2'] = v; if (i === 3) Vnodes['A' + id + '3'] = v;
      if (i === n) v = 0;
    }
    Vnodes['M' + id] = M;
  });
  return {
    V: Vnodes, I: { IT, I1: I[0], I2: I[1], I3: I[2], I23: I[1] + I[2] }, vmax: Math.max(p.V, 1),
    comp, ex: { I, IT, Pin: V * IT, PR, PL, Vn },
  };
}
Q4.calc = (o) => solveQ4(Object.assign({ power: true }, baseQ4, o));

/* ---------- a fita inteira: 100 segmentos com a resistência das trilhas ---------- */
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fitaSolve(o) {
  const N = 100, r = o.drop ? o.r : 0, rnd = mulberry(o.seed || 1);
  const vfs = []; for (let k = 0; k < N; k++) { let s = 0; for (let i = 0; i < 3; i++) s += o.tol ? 2.9 + 0.3 * rnd() : 3.0; vfs.push(s); }
  // cada segmento é linear por partes: apagado (I = 0), resistor (I = (V − nV_F)/R) ou,
  // com driver de corrente, fonte de corrente constante. Resolve a escada resistiva
  // das trilhas (sistema tridiagonal) e ajusta o estado de cada segmento até convergir.
  const Rs = o.cc ? 20 : 150, Icc = Q4L.Inom;
  const Iof = (Vk, k) => { const h = Vk - vfs[k]; if (h <= 0) return 0; return o.cc ? Math.min(Icc, h / Rs) : h / Rs; };
  let V = new Array(N).fill(o.V);
  if (r > 0) {
    let state = new Array(N).fill(1);                       // 0 apagado · 1 resistivo · 2 corrente constante
    for (let it = 0; it < 30; it++) {
      const a = [], b = [], c = [], d = [];
      for (let k = 0; k < N; k++) {
        const g = state[k] === 1 ? 1 / Rs : 0, Ik = state[k] === 2 ? Icc : 0;
        const right = k < N - 1 || o.ends === 'two';
        b[k] = 1 / r + (right ? 1 / r : 0) + g; a[k] = k > 0 ? -1 / r : 0; c[k] = k < N - 1 ? -1 / r : 0;
        d[k] = g * vfs[k] - Ik + (k === 0 ? o.V / r : 0) + (k === N - 1 && o.ends === 'two' ? o.V / r : 0);
      }
      for (let k = 1; k < N; k++) { const m = a[k] / b[k - 1]; b[k] -= m * c[k - 1]; d[k] -= m * d[k - 1]; }
      V[N - 1] = d[N - 1] / b[N - 1]; for (let k = N - 2; k >= 0; k--) V[k] = (d[k] - c[k] * V[k + 1]) / b[k];
      let changed = false;
      for (let k = 0; k < N; k++) { const h = V[k] - vfs[k]; const ns = h <= 0 ? 0 : (o.cc && h / Rs > Icc ? 2 : 1); if (ns !== state[k]) { state[k] = ns; changed = true; } }
      if (!changed) break;
    }
  }
  const I = V.map((v, k) => Iof(v, k));
  const IT = I.reduce((x, y) => x + y, 0);
  return { V, I, vfs, IT, P: o.V * IT, Imin: Math.min(...I), Imax: Math.max(...I), Vend: o.ends === 'two' ? Math.min(...V) : V[N - 1] };
}
/* resistência das trilhas (por segmento, + e GND somados) calibrada para 11,0 V na ponta */
Q4.rTrace = (() => { let lo = 1e-5, hi = 0.2; for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; fitaSolve({ V: 12, drop: true, r: m, ends: 'one' }).Vend > 11.0 ? lo = m : hi = m; } return (lo + hi) / 2; })();
Q4.fita = (p) => fitaSolve({ V: p.V, drop: p.drop, r: Q4.rTrace, ends: p.ends, tol: p.tol, seed: p.seed, cc: p.cc });

/* desenho da fita (vista alternativa do palco) */
function drawFita(ctx, sim) {
  const p = sim.p, key = JSON.stringify([p.V, p.drop, p.ends, p.tol, p.seed, p.cc]);
  if (sim._fitaKey !== key) { sim._fitaKey = key; sim._fita = Q4.fita(p); }
  const F = sim._fita, on = sim.power, t = sim.t;
  const rows = 4, perRow = 25, x0 = 90, x1 = 950, sw = (x1 - x0) / perRow, H = 62, ys = [100, 205, 310, 415];
  ctx.font = '900 22px Lato, sans-serif'; ctx.fillStyle = '#1F2D4D'; ctx.textAlign = 'left';
  ctx.fillText('A fita inteira: 100 segmentos em paralelo · 5 m · 300 LEDs', 40, 46);
  // conexões entre as fileiras (a fita é uma só, dobrada no desenho)
  ctx.strokeStyle = '#3A3F4B'; ctx.lineWidth = H;
  for (let r = 0; r < rows - 1; r++) { const xe = r % 2 === 0 ? x1 : x0, y = (ys[r] + ys[r + 1]) / 2 + H / 2; ctx.beginPath(); ctx.arc(xe, y, (ys[r + 1] - ys[r]) / 2, r % 2 === 0 ? -Math.PI / 2 : Math.PI / 2, r % 2 === 0 ? Math.PI / 2 : Math.PI * 1.5, false); ctx.stroke(); }
  // alimentação
  const feed = (x, y, lab) => { ctx.fillStyle = '#2B3A5E'; ctx.fillRect(x - 64, y + 8, 50, 46); ctx.fillStyle = '#fff'; ctx.font = '900 14px Lato, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, x - 39, y + 36); ctx.strokeStyle = '#D9452B'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 14, y + 16); ctx.lineTo(x, y + 16); ctx.stroke(); ctx.strokeStyle = '#1F2D4D'; ctx.beginPath(); ctx.moveTo(x - 14, y + 46); ctx.lineTo(x, y + 46); ctx.stroke(); };
  feed(x0, ys[0], fV(p.V, 1).replace(',0 V', ' V'));
  if (p.ends === 'two') feed(x0, ys[3], fV(p.V, 1).replace(',0 V', ' V'));
  for (let k = 0; k < 100; k++) {
    const r = Math.floor(k / perRow), j = k % perRow, dir = r % 2 === 0 ? 1 : -1;
    const sx = dir > 0 ? x0 + j * sw : x1 - (j + 1) * sw, y = ys[r];
    const Vk = F.V[k], Ik = on ? F.I[k] : 0, br = Ik / Q4L.Inom;
    ctx.fillStyle = '#2A2E38'; ctx.fillRect(sx, y, sw, H);
    ctx.fillStyle = on ? vColor(Vk, Math.max(p.V, 1)) : '#1F2D4D'; ctx.fillRect(sx, y, sw, 6);
    ctx.fillStyle = '#7D879E'; ctx.fillRect(sx, y + H - 5, sw, 5);
    ctx.strokeStyle = '#4A4F5C'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, y + 6); ctx.lineTo(sx, y + H - 5); ctx.stroke();
    // corrente nas trilhas: tracinhos andando com velocidade ∝ corrente local
    if (on && !REDUCED) {
      let Itr = 0; for (let m = k; m < 100; m++) Itr += F.I[m];
      if (p.ends === 'two') { let a = 0, b = 0; for (let m = 0; m <= k; m++) a += F.I[m]; for (let m = k; m < 100; m++) b += F.I[m]; Itr = Math.abs(b - a); }
      ctx.save(); ctx.strokeStyle = 'rgba(255,225,77,.95)'; ctx.lineWidth = 3; ctx.setLineDash([4, 8]); ctx.lineDashOffset = -dir * t * 60 * Itr / Math.max(F.IT, 1e-6) * 2;
      ctx.beginPath(); ctx.moveTo(sx, y + 3); ctx.lineTo(sx + sw, y + 3); ctx.stroke(); ctx.restore();
    }
    // 3 LEDs e o resistor
    for (let i = 0; i < 3; i++) {
      const lx = sx + sw * (0.2 + i * 0.28), ly = y + H * 0.48;
      if (br > 0.02) {
        const over = Ik > Q4L.Imax, col = over ? [255, 120, 90] : [255, 240, 200], rad = 3 + 15 * Math.min(br, 1.8);
        const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, rad); g.addColorStop(0, rgb(col, clamp(Math.pow(br, 1.6) * 0.9, 0.08, 0.95))); g.addColorStop(1, rgb(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, rad, 0, 7); ctx.fill();
      }
      const bb = clamp(Math.pow(br, 1.6), 0, 1);
      ctx.fillStyle = br > 0.02 ? `rgb(${Math.round(lerp(120, 255, bb))},${Math.round(lerp(110, 250, bb))},${Math.round(lerp(80, 225, bb))})` : '#6E6A5C';
      ctx.fillRect(lx - 4.5, ly - 4.5, 9, 9);
    }
    ctx.fillStyle = '#111'; ctx.fillRect(sx + sw * 0.35, y + H - 15, 9, 5);
  }
  // tensões nas pontas de cada fileira
  ctx.font = '500 15px "IBM Plex Mono", monospace'; ctx.fillStyle = '#47536E';
  for (let r = 0; r < rows; r++) {
    const kA = r * perRow, kB = r * perRow + perRow - 1, left = r % 2 === 0 ? kA : kB, right = r % 2 === 0 ? kB : kA;
    ctx.textAlign = 'left'; ctx.fillText(`${fV(F.V[left])} · ${fI(F.I[left])}`, x0, ys[r] + H + 16);
    ctx.textAlign = 'right'; ctx.fillText(`${fV(F.V[right])} · ${fI(F.I[right])}`, x1, ys[r] + H + 16);
  }
  // resumo
  const fonte = Math.ceil(F.IT * 1.25 * 2) / 2;
  ctx.fillStyle = '#1F2D4D'; ctx.font = '900 19px Lato, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Corrente total: ${fI(on ? F.IT : 0)} · potência da fonte: ${fP(on ? F.P : 0)}`, 40, 530);
  ctx.font = '700 16px Lato, sans-serif'; ctx.fillStyle = '#47536E';
  ctx.fillText(`segmentos: de ${fI(F.Imin)} a ${fI(F.Imax)}${F.Imax > Q4L.Imax ? '  (acima de I_F,máx!)' : ''} · ${p.drop ? 'com queda nas trilhas' : 'trilhas ideais'}${p.ends === 'two' ? ' · alimentada pelas duas pontas' : ''}${p.cc ? ' · driver de corrente' : ''}${p.tol ? ' · V_F sorteado (2,9 a 3,2 V)' : ''}`, 40, 556);
  ctx.fillText(`Fonte sugerida (corrente + 25 %): ${fV(p.V, 0)} / ${num(fonte, 1)} A`, 40, 580);
}

/* ---------- esquemático: 3 dos 100 segmentos ---------- */
const q4comps = {
  Vi: { type: 'dc', x: 100, y: 330, r: 34, label: p => fV(p.V, Number.isInteger(p.V) ? 0 : 1).replace(/,0 V$/, ' V') },
  RSH: { type: 'res', a: [150, 70], b: [260, 70], amp: 13, nodes: ['P', 'T'], Tmax: 155, tau: 2.4, failMode: 'open', failTitle: 'Resistor único queimado' },
};
const q4wires = [
  { node: 'P', cur: 'IT', pts: [[100, 296], [100, 70], [150, 70]] },
  { node: 'P', cur: 'IT', ifHidden: 'RSH', pts: [[150, 70], [260, 70]] },
  { node: 'T', cur: 'IT', pts: [[260, 70], [380, 70]] },
  { node: 'T', cur: 'I23', pts: [[380, 70], [600, 70]] },
  { node: 'T', cur: 'I3', pts: [[600, 70], [820, 70]] },
  { node: 'T', idle: true, pts: [[820, 70], [930, 70]] },
  { node: 'G', idle: true, pts: [[820, 560], [930, 560]] },
  { node: 'G', cur: 'I3', pts: [[820, 560], [600, 560]] },
  { node: 'G', cur: 'I23', pts: [[600, 560], [380, 560]] },
  { node: 'G', cur: 'IT', pts: [[380, 560], [100, 560], [100, 364]] },
];
const q4edges = [
  { id: 'src', cur: 'IT', spawn: true, path: [[100, 560], [100, 364], { comp: 'Vi' }, [100, 296], [100, 70], [150, 70]] },
  { id: 'rsh', cur: 'IT', dep: 'RSH', path: [[150, 70], { comp: 'RSH' }, [260, 70]] },
  { id: 'rshw', cur: 'IT', ifHidden: 'RSH', path: [[150, 70], [260, 70]] },
  { id: 't1', cur: 'IT', path: [[260, 70], [380, 70]] },
  { id: 't2', cur: 'I23', path: [[380, 70], [600, 70]] },
  { id: 't3', cur: 'I3', path: [[600, 70], [820, 70]] },
  { id: 'b3', cur: 'I3', path: [[820, 560], [600, 560]] },
  { id: 'b2', cur: 'I23', path: [[600, 560], [380, 560]] },
  { id: 'b1', cur: 'IT', path: [[380, 560], [100, 560]] },
];
const q4values = [{ id: 'IT', cur: 'IT', x: 205, y: 34, anchor: 'middle', fn: s => `I_fonte = ${fI(s.I.IT)}` }];
const q4labels = [
  { t: 'R_único', x: 205, y: 112, cls: 'nm', anchor: 'middle', when: p => p.shared },
  { t: p => fR(p.Rsh), x: 205, y: 136, cls: 'val', anchor: 'middle', when: p => p.shared },
  { t: '… × 100', x: 930, y: 300, cls: 'val strong', anchor: 'end' },
  { t: 'segmentos', x: 930, y: 324, cls: 'small', anchor: 'end' },
  { t: 'trilha +12 V', x: 930, y: 56, cls: 'small', anchor: 'end' },
  { t: 'trilha GND', x: 930, y: 590, cls: 'small', anchor: 'end' },
];
SEGX.forEach((x, k) => {
  const id = k + 1, L = (i, a) => ({ type: 'led', a: [x, a], k: [x, a + 36], w: 34, zoom: true, zoomName: `LED ${i} do segmento ${id} (branco, V_F = 3,0 V)`, ledColor: '#FFF1C9', white: true, Vf: 3.0, Inom: 0.02, Tmax: 125, tau: 0.9, failMode: 'open', failTitle: 'LED queimado (abriu): o segmento inteiro apaga' });
  q4comps['R' + id] = { type: 'res', a: [x, 100], b: [x, 180], amp: 13, nodes: ['T', 'M' + id], Tmax: 155, tau: 2.4, failMode: 'open', failTitle: `Resistor do segmento ${id} queimado` };
  [215, 290, 365, 440].forEach((a, i) => { q4comps['L' + (i + 1) + id] = L(i + 1, a); });
  const Ik = 'I' + id;
  q4wires.push(
    { node: 'T', cur: Ik, pts: [[x, 70], [x, 100]] },
    { node: 'T', cur: Ik, ifHidden: 'R' + id, pts: [[x, 100], [x, 180]] },
    { node: 'M' + id, cur: Ik, pts: [[x, 180], [x, 215]] },
    { node: 'A' + id + '1', cur: Ik, pts: [[x, 251], [x, 290]] },
    { node: 'A' + id + '2', cur: Ik, pts: [[x, 326], [x, 365]] },
    { node: 'A' + id + '3', cur: Ik, pts: [[x, 401], [x, 440]] },
    { node: 'A' + id + '3', cur: Ik, ifHidden: 'L4' + id, pts: [[x, 440], [x, 476]] },
    { node: 'G', cur: Ik, pts: [[x, 476], [x, 560]] },
  );
  q4edges.push(
    { id: 'r' + id, cur: Ik, dep: 'R' + id, path: [[x, 70], [x, 100], { comp: 'R' + id }, [x, 180]] },
    { id: 'rw' + id, cur: Ik, ifHidden: 'R' + id, path: [[x, 70], [x, 180]] },
    { id: 'l' + id, cur: Ik, path: [[x, 180], [x, 215], { comp: 'L1' + id }, [x, 290], { comp: 'L2' + id }, [x, 365], { comp: 'L3' + id }, [x, 440], { comp: 'L4' + id }, [x, 560]] },
  );
  q4labels.push({ t: p => fR(p.R), x: x - 22, y: 147, cls: 'val', anchor: 'end', when: p => !p.shared });
  q4labels.push({ t: `seg. ${id}`, x: x - 26, y: 515, cls: 'small', anchor: 'end' });
  q4values.push({ id: Ik, cur: Ik, x: x + 24, y: 147, anchor: 'start', fn: s => fI(s.I[Ik]) });
});

Q4.circuit = {
  viewBox: [1000, 640], Iref: 0.03,
  defaults: P4({}),
  solve: solveQ4, zoomComp: 'L11',
  comps: q4comps, wires: q4wires, edges: q4edges, values: q4values, labels: q4labels,
  dots: [[380, 70], [600, 70], [380, 560], [600, 560], [820, 70], [820, 560]],
  meterAt: [770, 600 - 96 - 10], meterDefault: ['M1', 'G'], legendAt: [24, 612],
  probePoints: { T: [300, 70], M1: [380, 198], A11: [380, 270], A12: [380, 345], A13: [380, 420], G: [300, 560], P: [100, 200] },
  bars: [
    { comp: 'L11', x: 150, y: 400, w: 150, label: 'seg. 1: I_F / I_F,máx' },
    { comp: 'R1', x: 150, y: 480, w: 150, label: 'seg. 1: P_R / P_nom' },
  ],
  charts: ['bars', 'ifv', 'sankey'],
  chartTitles: { bars: 'Corrente por segmento' },
  relevo: {
    cur: 'I1',
    segs: (p, s) => {
      const out = [{ kind: 'rise', to: s.V.P, label: 'fonte' }, { kind: 'flat', node: 'P' }];
      if (p.shared) out.push({ kind: 'drop', to: s.V.T, label: 'R único' }, { kind: 'flat', node: 'T' });
      else out.push({ kind: 'drop', to: s.V.M1, label: 'R' }, { kind: 'flat', node: 'M1' });
      const nodes = ['A11', 'A12', 'A13'];
      for (let i = 0; i < p.n; i++) { const to = i === p.n - 1 ? 0 : s.V[nodes[i]]; out.push({ kind: 'drop', to, label: 'LED ' + (i + 1), w: 0.8 }, { kind: 'flat', node: i === p.n - 1 ? 'G' : nodes[i], w: 0.5 }); }
      return out;
    },
    ref: (p) => ({ v: p.n * (p.vfSeg ? p.vfSeg[0] : p.VF), label: `n·V_F = ${fV(p.n * (p.vfSeg ? p.vfSeg[0] : p.VF), 1)}` }),
    caption: (p, s) => `Folga = V − n·V_F = ${fV(Math.max(0, s.V.P - p.n * (p.vfSeg ? p.vfSeg[0] : p.VF)))}: é ela que o resistor "consome" para fixar a corrente.`,
  },
  sankey: (s, p) => {
    const PLED = s.ex.PL, luz = 0.3 * PLED;
    return {
      Pin: s.ex.Pin, Pref: 1.0, etaNote: `η = n·V_F/V = ${fPct(s.ex.Pin > 0 ? PLED / s.ex.Pin : 0)}`,
      sinks: [
        { label: 'calor no(s) resistor(es)', P: s.ex.PR, color: 'rgba(232,119,46,A)' },
        { label: 'LEDs: calor', P: PLED - luz, color: 'rgba(201,54,42,A)' },
        { label: 'LEDs: luz*', P: luz, color: 'rgba(242,185,28,A)' },
      ],
      foot: '* ≈ 30 % da potência do LED branco (estimativa)',
    };
  },
  barsChart: (s) => ({
    title: 'segmentos (3 de 100)', max: Math.max(0.04, Math.max(...s.ex.I) * 1.15), limit: Q4L.Imax, limitLabel: 'I_F,máx = 30 mA', ref: Q4L.Inom, refLabel: 'nominal 20 mA',
    tick: v => num(v * 1000, 0), fmt: v => num(v * 1000, 1) + ' mA',
    items: [0, 1, 2].map(k => ({ label: 'seg. ' + (k + 1), v: s.ex.I[k], dead: [1, 2, 3, 4].some(i => s.comp['L' + i + (k + 1)] && s.comp['L' + i + (k + 1)].mode === 'dead'), color: '#F2B91C' })),
  }),
  ifv: {
    range: [8, 15], ymax: 0.045, Imax: Q4L.Imax, band: [13.8, 14.4], bandLabel: 'caminhonete',
    f: (V, p) => Math.max(0, (V - p.n * p.VF) / p.R),
    marks: [{ v: 12, label: '12 V' }],
    cur: (s, p) => p.shared ? null : [p.V, s.I.I1],
    title: (s, p) => {
      if (p.shared) return 'R único: a reta de um segmento não vale';
      const f = V => Math.max(0, (V - p.n * p.VF) / p.R), I0 = f(12), I = f(p.V);
      return I0 > 0 ? `ΔV/V = ${num((p.V - 12) / 12 * 100, 0)} % → ΔI/I = ${num((I - I0) / I0 * 100, 0)} %` : 'sem folga: corrente nula em 12 V';
    },
  },
  altViews: { fita: drawFita },
};

/* ---------- ilustração ---------- */
Q4.illus = `<svg viewBox="0 0 560 340" role="img" aria-label="Fita de LED de 12 V">
  <rect x="8" y="8" width="544" height="324" rx="18" fill="#E8EDF5"/>
  <path d="M40 110 H500 a40 40 0 0 1 0 80 H80 a40 40 0 0 0 0 80 H520" stroke="#D9D4C7" stroke-width="46" fill="none"/>
  <path d="M40 110 H500 a40 40 0 0 1 0 80 H80 a40 40 0 0 0 0 80 H520" stroke="#F4F1EA" stroke-width="38" fill="none"/>
  <g fill="#FFF3CF">${Array.from({ length: 13 }, (_, i) => `<rect x="${52 + i * 34}" y="104" width="12" height="12" rx="2"/>`).join('')}${Array.from({ length: 12 }, (_, i) => `<rect x="${92 + i * 34}" y="184" width="12" height="12" rx="2"/>`).join('')}${Array.from({ length: 13 }, (_, i) => `<rect x="${92 + i * 34}" y="264" width="12" height="12" rx="2"/>`).join('')}</g>
  <g opacity=".55">${Array.from({ length: 13 }, (_, i) => `<circle cx="${58 + i * 34}" cy="110" r="14" fill="#FFE9A8"/>`).join('')}</g>
  <rect x="14" y="88" width="28" height="44" rx="5" fill="#2B3A5E"/><text x="28" y="78" text-anchor="middle" font-family="Lato,sans-serif" font-weight="900" font-size="13" fill="#1F2D4D">12 V</text>
  <text x="280" y="44" text-anchor="middle" font-family="Lato,sans-serif" font-weight="900" font-size="15" fill="#1F2D4D">5 m · 60 LEDs/m · 100 segmentos</text>
  <text x="280" y="322" text-anchor="middle" font-family="Lato,sans-serif" font-weight="700" font-size="12" fill="#47536E">cada segmento: R + 3 LEDs brancos em série · pode ser cortado na marca</text>
</svg>`;


Q4.slides = [
  {
    type: 'context', hash: 'q4', q: 4, kind: 'LED · série + paralelo',
    title: 'Uma fita de LED de 12 V',
    story: 'Fitas de LED de 12 V são feitas de <b>segmentos repetidos</b>: cada segmento tem 3 LEDs brancos em série com um resistor, e os segmentos ficam em paralelo ao longo da fita. Uma fita de 5 m tem 60 LEDs/m.',
    chips: [['V = 12 V'], ['3 LEDs + R por segmento', 'o'], ['V_F = 3,0 V'], ['I_F = 20 mA'], ['I_F,máx = 30 mA'], ['5 m × 60 LEDs/m = 300 LEDs', 'o'], ['100 segmentos']],
    items: [['A', 'a)', 'Por que 3 LEDs e não 4? Por que um resistor por segmento?'], ['B', 'b)', 'R, potências, eficiência, corrente total e fonte'], ['C', 'c)', 'Fita ligada numa caminhonete (13,8 a 14,4 V)'], ['D', 'd)', 'Tolerâncias, queda nas trilhas e melhorias']],
    trains: 'Treina: série + paralelo, folga de tensão, tolerâncias e queda nas trilhas.',
    notes: { tempo: '3 min', perguntas: ['Alguém já cortou uma fita de LED? Onde fica a marca de corte?', 'Por que a fita é de 12 V e não de 3 V?'], erros: [], dica: 'Leve uma fita real para a sala: o resistor de cada segmento é visível a olho nu.' },
  },
  {
    type: 'circuit', hash: 'q4-circuito', q: 4, title: 'O circuito da Figura 4', circuit: Q4.circuit,
    steps: [
      { t: 'Antes de ligar', p: 'Três dos 100 segmentos. Em cada um: um resistor e 3 LEDs em <b>série</b> (mesma corrente). Os segmentos estão em <b>paralelo</b> entre a trilha de +12 V e a trilha GND.', eq: [() => '\\text{segmento: } R + 3\\times\\text{LED}\\quad|\\quad 100\\ \\text{segmentos em paralelo}'],
        scene: { params: P4({}), power: false, cta: true, values: 'none', highlight: ['R1', 'L11', 'L21', 'L31'] } },
      { t: 'Ligue a fonte', p: 'A corrente da fonte se divide igualmente entre os segmentos. Em cada LED, elétrons e lacunas se recombinam e saem <b>fótons</b>: azuis do chip e amarelos do fósforo, que juntos parecem brancos.',
        scene: { params: P4({}), power: true, values: 'none' } },
      { t: 'Clique em um LED', p: 'O zoom mostra a junção por dentro e o diagrama de bandas: o elétron "cai" da banda de condução para a de valência e a energia sai como luz.',
        callout: { k: 'dica', t: 'Dica do professor', x: 'Use <b>Câmera lenta</b>: o número de fótons por segundo acompanha a corrente.' },
        scene: { params: P4({}), values: ['IT', 'I1', 'I2', 'I3'] } },
    ],
    notes: { tempo: '4 min', perguntas: ['Se um LED de um segmento queimar aberto, o que acontece com os outros dois do mesmo segmento? E com os outros segmentos?'], erros: ['Achar que os 300 LEDs estão todos em série.'], dica: 'Abra o zoom de um LED e mostre o diagrama de bandas antes das contas.' },
  },
  {
    type: 'item', hash: 'q4-a', q: 4, level: 'A', letter: 'a', title: 'Por que 3 LEDs e um R por segmento',
    enun: '<b>a)</b> Por que o fabricante usa 3 LEDs por segmento, e não 4? Por que cada segmento tem seu próprio resistor, em vez de um único resistor para a fita toda?',
    circuit: Q4.circuit, chartKinds: ['bars', 'ifv', 'sankey'],
    steps: [
      { t: '3 LEDs: sobra uma folga', p: 'Com 3 LEDs, a soma das quedas é 9 V e <b>sobram 3 V</b> para o resistor. É essa folga que permite fixar a corrente.', eq: [() => 'V - n V_F = 12 - 3\\times 3{,}0 = 3\\,\\text{V}', () => 'I_F = \\dfrac{3\\,\\text{V}}{150\\,\\Omega} = 20\\,\\text{mA}'],
        scene: { params: P4({}), view: 'relevo' } },
      { t: '4 LEDs: a folga some', p: 'Com 4 LEDs a soma já é 12 V: não sobra nada para o resistor e a corrente cai a zero. Os elétrons param na frente das junções e os LEDs ficam apagados.', eq: [() => 'V - n V_F = 12 - 4\\times 3{,}0 = 0\\ \\Rightarrow\\ I_F = 0'],
        scene: { params: P4({ n: 4 }), view: 'sch' } },
      { t: 'E se o projetista reduzir R?', p: 'Com 4 LEDs e R = 10 Ω, a corrente passa a depender só da diferença entre 12 V e $4V_F$. Arraste o $V_F$ dentro da tolerância de fabricação (2,9 a 3,2 V).', eq: [() => 'I_F = \\dfrac{12 - 4V_F}{10\\,\\Omega}', () => 'V_F = 2{,}9\\,\\text{V} \\Rightarrow I_F = 40\\,\\text{mA};\\quad V_F \\ge 3{,}0\\,\\text{V} \\Rightarrow I_F = 0'],
        widget: { type: 'slider', param: 'VF', label: 'Arraste V_F (tolerância)', min: 2.9, max: 3.2, step: 0.005, fmt: v => fV(v, 3) },
        live: (s, p) => `4 × V<sub>F</sub> = ${fV(4 * p.VF, 2)} → I<sub>F</sub> = ${fI(s.I.I1)} ${s.I.I1 > Q4L.Imax ? '<span class="pill off">acima de I<sub>F,máx</sub></span>' : s.I.I1 === 0 ? '<span class="pill off">apagado</span>' : ''}`,
        scene: { params: P4({ n: 4, R: 10, VF: 3.0 }) } },
      { t: 'Um resistor para a fita toda?', p: 'Agora 3 segmentos com $V_F$ ligeiramente diferentes (2,9; 3,0 e 3,1 V por LED) dividem um resistor de 50 Ω. No modelo de $V_F$ fixo, o segmento de menor $V_F$ prende o nó em 8,7 V e <b>leva toda a corrente</b>.', eq: [() => 'I_{\\text{seg 1}} = \\dfrac{12 - 8{,}7}{50} = 66\\,\\text{mA} > 30\\,\\text{mA}'],
        callout: { k: 'atencao', t: 'Atenção', x: 'Quando o segmento 1 abre, o próximo de menor $V_F$ herda a corrente toda: a fita queima <b>em cadeia</b>.' },
        scene: { params: P4({ shared: true, vfSeg: [2.9, 3.0, 3.1] }) } },
      { t: 'Com resistência interna (mais realista)', p: 'Dando a cada LED uma pequena resistência interna ($r_d$ = 10 Ω), a divisão deixa de ser "tudo ou nada", mas continua muito desigual. Compare com um resistor por segmento.', eq: [() => '\\text{R único: } 26{,}7 / 16{,}7 / 6{,}7\\,\\text{mA}', () => '\\text{R por segmento: } 18{,}3 / 16{,}7 / 15{,}0\\,\\text{mA}'],
        widget: { type: 'seg', options: [[{ shared: true }, 'um R para todos'], [{ shared: false }, 'um R por segmento']] },
        scene: { params: P4({ shared: true, vfSeg: [2.9, 3.0, 3.1], rd: 10 }) },
        result: () => [['3 LEDs', 'folga de 3 V: R controla a corrente'], ['4 LEDs', 'folga nula: corrente 0 ou descontrolada'], ['R por segmento', 'cada segmento limita a própria corrente'], ['R único', 'menor V_F rouba a corrente (queima em cadeia)']] },
    ],
    notes: { tempo: '10 min', perguntas: ['Qual a relação entre "folga" e "estabilidade da corrente"?', 'Por que a fita pode ser cortada em qualquer marca de segmento?'], erros: ['Achar que 4 LEDs × 3 V = 12 V é o projeto "perfeito".', 'Achar que LEDs em paralelo dividem a corrente igualmente.'], dica: 'No passo do R único, deixe a cadeia de falhas acontecer: é a melhor forma de lembrar por que cada segmento tem o próprio resistor.' },
  },
  {
    type: 'item', hash: 'q4-b', q: 4, level: 'B', letter: 'b', title: 'R, potências e a fonte',
    enun: '<b>b)</b> Calcule R, a potência em cada resistor, a eficiência do segmento, a corrente total da fita e a potência da fonte. Especifique a fonte.',
    circuit: Q4.circuit,
    steps: [
      { t: 'Passo 1: há folga?', p: 'Antes de tudo, a tensão precisa ser maior que a soma das quedas.', eq: [() => 'V = 12\\,\\text{V} > nV_F = 9\\,\\text{V}\\quad(\\text{folga} = 3\\,\\text{V})\\ \\checkmark'],
        scene: { params: P4({}), view: 'relevo' } },
      { t: 'Passos 2 a 5: o resistor', p: 'Corrente nominal de 20 mA (abaixo dos 30 mA máximos).', eq: [() => 'R = \\dfrac{V - nV_F}{I_F} = \\dfrac{3}{20\\,\\text{mA}} = 150\\,\\Omega', () => '150\\,\\Omega\\ \\text{é E12}\\ \\Rightarrow\\ I_F = 20\\,\\text{mA}'],
        scene: { params: P4({}), view: 'sch', values: ['I1', 'I2', 'I3', 'IT'], highlight: ['R1', 'R2', 'R3'] } },
      { t: 'Passo 6: potências', p: 'Resistor especificado com o dobro da potência calculada, como no roteiro.', eq: [() => 'P_R = V_R I_F = 3 \\times 20\\,\\text{mA} = 60\\,\\text{mW}', () => '2\\times 60 = 120\\,\\text{mW} \\le 125\\,\\text{mW}\\ \\Rightarrow\\ \\tfrac{1}{8}\\,\\text{W}', () => 'P_{LED} = 3{,}0 \\times 20\\,\\text{mA} = 60\\,\\text{mW}'],
        scene: { params: P4({ Rrating: 0.125 }) } },
      { t: 'Passo 7: eficiência', p: 'Do que a fonte entrega a cada segmento, 75 % chega aos LEDs; 25 % vira calor no resistor. Só uma parte do que chega ao LED vira luz (gráfico de fluxo).', eq: [() => '\\eta = \\dfrac{nV_F}{V} = \\dfrac{9}{12} = 75\\,\\%'],
        scene: { params: P4({ Rrating: 0.125 }) } },
      { t: 'A fita inteira', p: 'São 100 segmentos iguais em paralelo (trilhas ideais por enquanto).', eq: [() => 'I_{\\text{total}} = 100 \\times 20\\,\\text{mA} = 2\\,\\text{A}', () => 'P_{\\text{fonte}} = 12 \\times 2 = 24\\,\\text{W}'],
        scene: { params: P4({}), view: 'fita' } },
      { t: 'Especifique a fonte', p: 'Fonte de 12 V <b>regulada</b> com folga de corrente (≈ 25 %) para não trabalhar no limite.', eq: [() => '2\\,\\text{A} \\times 1{,}25 = 2{,}5\\,\\text{A}\\ \\Rightarrow\\ \\text{fonte de } 12\\,\\text{V} / 3\\,\\text{A}\\ (36\\,\\text{W})'],
        scene: { params: P4({}), view: 'fita' },
        result: () => [['R', '150 Ω (E12) → I_F = 20 mA'], ['P_R', '60 mW → 1/8 W'], ['η do segmento', '75 %'], ['I total', '2 A'], ['P da fonte', '24 W'], ['Fonte', '12 V regulada, ≥ 2,5 A (ex.: 12 V / 3 A)']] },
    ],
    notes: { tempo: '9 min', perguntas: ['Se a fita tivesse 10 m numa única alimentação, o que mudaria na fonte? E nas trilhas?'], erros: ['Esquecer de multiplicar pelo número de segmentos.', 'Especificar a fonte exatamente em 2 A.'], dica: 'Na vista da fita, todas as luzes iguais: guarde essa imagem para comparar com o item d).' },
  },
  {
    type: 'item', hash: 'q4-c', q: 4, level: 'C', letter: 'c', title: 'A fita na caminhonete',
    enun: '<b>c)</b> Um cliente ligou a fita na instalação elétrica de uma caminhonete, que fornece de 13,8 V a 14,4 V com o motor ligado. Analise as consequências.',
    circuit: Q4.circuit,
    steps: [
      { t: 'A corrente com o motor ligado', p: 'O resistor continua com 150 Ω, mas a folga aumenta.', eq: [() => 'I_F(13{,}8) = \\dfrac{13{,}8 - 9}{150} = 32\\,\\text{mA}', () => 'I_F(14{,}4) = \\dfrac{14{,}4 - 9}{150} = 36\\,\\text{mA}'],
        widget: { type: 'slider', param: 'V', label: 'Arraste a tensão da caminhonete', min: 12, max: 14.4, step: 0.05, marks: [{ v: 13.5, text: 'I_F = 30 mA em 13,5 V' }], fmt: v => fV(v, 2) },
        live: (s, p) => `I<sub>F</sub> = ${fI(s.I.I1)} · P<sub>R</sub> = ${fP(s.comp.R1.P)} · P<sub>LED</sub> = ${fP(s.comp.L11.P)}`,
        scene: { params: P4({ V: 12, Rrating: 0.125 }), resetDamage: true } },
      { t: 'Sensibilidade', p: 'A tensão subiu 20 %, mas a corrente subiu 80 %: o resistor só "enxerga" a folga, e a folga cresceu de 3 para 5,4 V.', eq: [() => '\\dfrac{\\Delta I_F}{I_F} = \\dfrac{\\Delta V}{\\text{folga}} = \\dfrac{2{,}4}{3} = 80\\,\\%\\quad\\text{vs.}\\quad \\dfrac{\\Delta V}{V} = 20\\,\\%'],
        scene: { params: P4({ V: 14.4 }) } },
      { t: 'Sobrecorrente em 13,8 V', p: 'Já no início da faixa, $I_F$ passa de 30 mA e o resistor de 1/8 W passa a dissipar 154 mW. Observe o aquecimento: o primeiro LED que abre apaga o segmento inteiro.', eq: [() => 'I_F = 32\\,\\text{mA} > I_{F,\\max} = 30\\,\\text{mA}', () => 'P_R = 4{,}8 \\times 32\\,\\text{mA} = 154\\,\\text{mW} > 125\\,\\text{mW}'],
        scene: { params: P4({ V: 13.8, Rrating: 0.125 }) } },
      { t: 'A fita inteira em 14,4 V', p: 'A fonte (a bateria) entrega 80 % mais corrente; os LEDs envelhecem rápido ou queimam, e o calor extra pode descolar a fita.', eq: [() => 'I_{\\text{total}} = 100 \\times 36\\,\\text{mA} = 3{,}6\\,\\text{A}', () => 'P = 14{,}4 \\times 3{,}6 = 51{,}8\\,\\text{W}\\ (\\text{vs. } 24\\,\\text{W})'],
        scene: { params: P4({ V: 14.4 }), view: 'fita' },
        result: () => [['13,8 V', 'I_F = 32 mA > 30 mA · P_R = 154 mW > 1/8 W'], ['14,4 V', 'I_F = 36 mA (+80 %) · P_R = 194 mW'], ['Fita toda', '3,6 A e 51,8 W'], ['Solução', 'regulador/conversor 12 V ou fita com driver de corrente']] },
    ],
    notes: { tempo: '9 min', perguntas: ['Por que a mesma fita funciona bem numa fonte de 12 V e queima no carro?', 'Um fusível protegeria os LEDs?'], erros: ['Achar que +20 % de tensão dá +20 % de corrente.'], dica: 'O gráfico I_F × V mostra a reta: a inclinação 1/R é a mesma, mas ela começa em n·V_F, não em zero.' },
  },
  {
    type: 'item', hash: 'q4-d', q: 4, level: 'D', letter: 'd', title: 'Tolerâncias e queda nas trilhas',
    enun: '<b>d)</b> Considere as tolerâncias: fonte de 12 V ± 5 % e V<sub>F</sub> entre 2,9 V e 3,2 V. (i) Calcule a menor e a maior corrente possíveis num segmento. (ii) Na extremidade mais distante da fita, a queda nas trilhas faz a tensão chegar a 11,0 V: qual a corrente ali? (iii) Proponha melhorias.',
    circuit: Q4.circuit,
    steps: [
      { t: '(i) Os piores casos', p: 'A menor corrente combina fonte baixa com $V_F$ alto; a maior, fonte alta com $V_F$ baixo.', eq: [() => 'I_{\\min} = \\dfrac{11{,}4 - 3\\times 3{,}2}{150} = \\dfrac{1{,}8}{150} = 12\\,\\text{mA}', () => 'I_{\\max} = \\dfrac{12{,}6 - 3\\times 2{,}9}{150} = \\dfrac{3{,}9}{150} = 26\\,\\text{mA}'],
        widget: { type: 'seg', options: [[{ V: 11.4, VF: 3.2 }, 'mínimo'], [{ V: 12, VF: 3.0 }, 'nominal'], [{ V: 12.6, VF: 2.9 }, 'máximo']] },
        scene: { params: P4({ V: 11.4, VF: 3.2 }) } },
      { t: 'Sorteio de V_F na fita', p: 'Cada LED sai da fábrica com um $V_F$ diferente. Sorteando $V_F$ entre 2,9 e 3,2 V em cada LED, os segmentos ficam com brilhos diferentes.',
        widget: { type: 'action', label: 'Sortear de novo', run: sim => sim.set({ seed: (sim.p.seed * 7 + 13) % 997 }) },
        scene: { params: P4({ tol: true }), view: 'fita' } },
      { t: '(ii) Queda nas trilhas', p: 'As trilhas de cobre têm resistência. A corrente de todos os segmentos passa pelo começo da fita, então a tensão vai caindo ao longo dela (cores da trilha + e números nas pontas).', eq: [() => 'I_{\\text{ponta}} = \\dfrac{11{,}0 - 9}{150} = 13{,}3\\,\\text{mA}\\quad(-33\\,\\%)'],
        scene: { params: P4({ drop: true }), view: 'fita' } },
      { t: '(iii) Melhorias', p: 'Compare as soluções na vista da fita:', html: `<table><tr><th>melhoria</th><th>efeito</th></tr><tr><td>alimentar pelas duas pontas (ou injetar a cada 5 m)</td><td>queda máxima cai para ≈ 1/3</td></tr><tr><td>trilhas mais largas / cabo de injeção</td><td>menor resistência</td></tr><tr><td>fita de 24 V (6 LEDs por segmento)</td><td>metade da corrente, queda relativa menor</td></tr><tr><td>driver de corrente constante por segmento</td><td>I<sub>F</sub> independe de V e de V<sub>F</sub></td></tr></table>`,
        widget: { type: 'seg', options: [[{ ends: 'one', cc: false }, 'uma ponta'], [{ ends: 'two', cc: false }, 'duas pontas'], [{ ends: 'one', cc: true }, 'driver de corrente']] },
        scene: { params: P4({ drop: true, ends: 'two' }), view: 'fita' },
        result: () => { const one = Q4.fita(P4({ drop: true })), two = Q4.fita(P4({ drop: true, ends: 'two' })); return [['(i) I_mín · I_máx', '12 mA · 26 mA'], ['(ii) Na ponta (11,0 V)', '13,3 mA'], ['Uma ponta', `${fI(one.Imin)} a ${fI(one.Imax)}`], ['Duas pontas', `${fI(two.Imin)} a ${fI(two.Imax)}`]]; } },
    ],
    notes: { tempo: '10 min', perguntas: ['Por que a queda nas trilhas é maior no começo da fita (por metro) do que no fim?', 'O que muda ao alimentar pelas duas pontas?'], erros: ['Combinar os piores casos errados (fonte alta com V_F alto).'], dica: 'Peça para a turma prever a corrente no meio da fita alimentada pelas duas pontas antes de clicar.' },
  },
  {
    type: 'play', hash: 'q4-mexa', q: 4, title: 'Mexa você: monte seu segmento',
    circuit: Q4.circuit, params: P4({ Rrating: 0.125 }), resetLabel: 'Restaurar valores do item b)',
    controls: [
      { type: 'slider', param: 'V', label: 'V da fonte', min: 0, max: 16, step: 0.1, fmt: v => fV(v, 1) },
      { type: 'seg', param: 'n', label: 'LEDs por segmento', options: [[3, '3'], [4, '4']] },
      { type: 'e12', param: 'R', label: 'R de cada segmento', min: 10, max: 470, fmt: v => fR(v) },
      { type: 'slider', param: 'VF', label: 'V_F de cada LED', min: 2.8, max: 3.3, step: 0.01, fmt: v => fV(v, 2) },
      { type: 'seg', param: 'shared', label: 'Resistores', options: [[false, 'um por segmento'], [true, 'um único (50 Ω)']] },
      { type: 'seg', param: 'Rrating', label: 'Potência nominal do R', options: [[0.125, '1/8 W'], [0.25, '1/4 W'], [0.5, '1/2 W']] },
    ],
    live: (s, p) => `I<sub>F</sub> por segmento: ${s.ex.I.map(fI).join(' · ')}<br>folga = ${fV(Math.max(0, p.V - p.n * p.VF))} · P<sub>R</sub> = ${fP(s.comp.R1.P)} · I<sub>fonte</sub> = ${fI(s.I.IT)}`,
    challenge: 'Desafios: (1) qual a maior tensão que a fita aguenta sem passar de 30 mA? (2) Escolha R para que a fita funcione com segurança de 12 a 14,4 V. Quanto brilho você perde em 12 V? (3) Com 4 LEDs, encontre um R que funcione para qualquer V<sub>F</sub> entre 2,9 e 3,2 V.',
    notes: { tempo: 'livre', perguntas: ['Para a faixa 12–14,4 V, qual o menor R E12 seguro?'], erros: [], dica: 'Resposta do desafio 2: R ≥ (14,4 − 9)/30 mA = 180 Ω; em 12 V a corrente cai para 16,7 mA.' },
  },
];

Q4.conf = () => {
  const one = Q4.fita(P4({ drop: true })), two = Q4.fita(P4({ drop: true, ends: 'two' }));
  return [
    ['a', 'Folga com 3 / 4 LEDs', '3 V / 0 V', '4 LEDs: corrente nula ou descontrolada'],
    ['a', 'R único (50 Ω), V_F fixo', '66 mA no seg. de menor V_F', 'queima em cadeia'],
    ['a', 'R único com r_d = 10 Ω', '26,7 / 16,7 / 6,7 mA', 'R por segmento: 18,3 / 16,7 / 15,0 mA'],
    ['b', 'R', '150 Ω', 'E12 exato; I_F = 20 mA'],
    ['b', 'P_R', '60 mW', 'especificar 1/8 W'],
    ['b', 'P_LED', '60 mW', ''],
    ['b', 'η do segmento', '75 %', 'n·V_F/V'],
    ['b', 'I total / P fonte', '2 A / 24 W', 'fonte 12 V regulada, ≥ 2,5 A'],
    ['c', 'I_F em 13,8 V / 14,4 V', '32 mA / 36 mA', '> I_F,máx'],
    ['c', 'P_R em 13,8 V / 14,4 V', `${fP(4.8 * 0.032)} / ${fP(5.4 * 0.036)}`, '> 1/8 W'],
    ['c', 'Fita em 14,4 V', '3,6 A / 51,8 W', 'ΔI/I = 80 % para ΔV/V = 20 %'],
    ['d', 'I_mín / I_máx (tolerâncias)', '12 mA / 26 mA', ''],
    ['d', 'I na ponta (11,0 V)', fI(2 / 150), ''],
    ['d', 'Uma ponta (simulação)', `${fI(one.Imin)} a ${fI(one.Imax)}`, `I total ${fI(one.IT)}`],
    ['d', 'Duas pontas (simulação)', `${fI(two.Imin)} a ${fI(two.Imax)}`, `ponto mais baixo ${fV(two.Vend)}`],
  ];
};

/* =====================================================================
   QUESTÃO 5 — Display de sete segmentos, anodo comum, 5 V
   Cada segmento: LED vermelho V_F = 2,0 V, I_F,máx = 25 mA (contínua),
   I_FP = 100 mA (pulsada). Driver: pino em 0 liga o catodo ao terra.
   Itens b) e d): um resistor por segmento. Item c): um resistor único
   de 47 Ω no anodo comum.
   ===================================================================== */
const Q5L = { VF: 2.0, Inom: 0.01, Imax: 0.025, IFP: 0.1 };
const SEGN = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
const FONT7 = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '' };
/** pinos do driver para um caractere ("8." acende o ponto): 0 = aceso */
function pinsFor(ch) { const segs = FONT7[ch.replace('.', '')] || ''; return SEGN.map(n => (n === 'dp' ? ch.includes('.') : segs.includes(n)) ? 0 : 1); }
/** divide "13.85" em 4 dígitos com ponto */
function splitDigits(str) { const out = []; for (let i = 0; i < str.length; i++) { if (str[i] === '.') { if (out.length) out[out.length - 1] += '.'; continue; } out.push(str[i]); } while (out.length < 4) out.unshift(' '); return out.slice(-4); }

const Q5 = {};
const baseQ5 = { V: 5, R: 330, shared: false, Rsh: 47, VF: 2.0, pins: pinsFor('8.'), muxOn: false, mf: 0, mtext: '13.85', Rm: 82 };
const P5 = (o) => Object.assign({}, baseQ5, o);

function solveQ5(p) {
  const dmg = p.damage || {}, V = p.power ? p.V : 0;
  const on = p.pins.map((v, k) => v === 0 && !dmg['L' + k] && !(!p.shared && dmg['R' + k]));
  const n = on.filter(Boolean).length, I = new Array(8).fill(0);
  let A = V;
  if (p.shared) {
    if (dmg.RSH) A = 0;
    else if (n > 0 && V > p.VF) { const It = (V - p.VF) / p.Rsh; on.forEach((o, k) => { if (o) I[k] = It / n; }); A = p.VF; }
  } else on.forEach((o, k) => { if (o) I[k] = Math.max(0, (V - p.VF) / p.R); });
  const IT = I.reduce((a, b) => a + b, 0);
  const Vn = { P: V, A, G: 0 }, Ic = { IT };
  const comp = { Vi: {}, RSH: { show: p.shared ? 'on' : 'hidden', P: p.shared ? (V - A) * IT : 0 } };
  let PR = comp.RSH.P, PL = 0;
  for (let k = 0; k < 8; k++) {
    const closed = p.pins[k] === 0, Ik = I[k];
    let C, D;
    if (Ik > 0) { C = A - p.VF; D = 0; }
    else if (!closed) { C = A; D = A; }                        // pino aberto: tudo flutua no potencial do anodo
    else if (dmg['L' + k]) { C = 0; D = 0; }                  // LED aberto: a tensão fica toda sobre ele
    else { C = p.shared ? 0 : A * 0.5; D = 0; }
    Vn['C' + k] = C; Vn['D' + k] = D; Ic['I' + k] = Ik;
    let S = 0; for (let j = k; j < 8; j++) S += I[j]; Ic['S' + k] = S;
    const PRk = p.shared ? 0 : Ik * Ik * p.R; PR += PRk; PL += p.VF * Ik;
    comp['R' + k] = { show: p.shared ? 'hidden' : 'on', P: PRk };
    comp['L' + k] = { mode: dmg['L' + k] ? 'dead' : Ik > 0 ? 'fwd' : closed ? 'low' : 'open', I: Ik, V: Ik > 0 ? p.VF : 0, vAcross: 1, ratio: Ik / Q5L.Imax, bar: { v: Ik, max: Q5L.Imax, fmt: fI }, failCause: `I_F = ${num(Ik * 1000, 1)} mA > I_F,máx = 25 mA`, P: p.VF * Ik };
    comp['SW' + k] = { closed };
  }
  return { V: Vn, I: Ic, vmax: Math.max(p.V, 1), comp, ex: { I, IT, n, Pin: V * IT, PR, PL } };
}
Q5.calc = (o) => solveQ5(Object.assign({ power: true }, baseQ5, o));

/* ---------- geometria de um dígito de 7 segmentos ---------- */
function segPolys(x0, y0, w, h) {
  const T = w * 0.17, g = 2.5;
  const hz = (y) => { const xa = x0 + T * 0.55 + g, xb = x0 + w - T * 0.55 - g; return [[xa, y], [xa + T / 2, y - T / 2], [xb - T / 2, y - T / 2], [xb, y], [xb - T / 2, y + T / 2], [xa + T / 2, y + T / 2]]; };
  const vt = (x, ya, yb) => { ya += g; yb -= g; return [[x, ya + T * 0.1], [x + T / 2, ya + T * 0.6], [x + T / 2, yb - T * 0.6], [x, yb - T * 0.1], [x - T / 2, yb - T * 0.6], [x - T / 2, ya + T * 0.6]]; };
  const ym = y0 + h / 2;
  return {
    a: hz(y0 + T / 2), g: hz(ym), d: hz(y0 + h - T / 2),
    f: vt(x0 + T / 2, y0 + T / 2, ym), b: vt(x0 + w - T / 2, y0 + T / 2, ym),
    e: vt(x0 + T / 2, ym, y0 + h - T / 2), c: vt(x0 + w - T / 2, ym, y0 + h - T / 2),
    dp: { cx: x0 + w + T * 1.0, cy: y0 + h - T / 2, r: T * 0.55 },
  };
}
/** desenha um dígito; lv[k] = brilho relativo (1 = nominal), dead[k] = queimado */
function drawDigit(ctx, x0, y0, w, h, lv, dead) {
  const P = segPolys(x0, y0, w, h);
  SEGN.forEach((n, k) => {
    const l = lv[k] || 0, shape = P[n];
    const path = () => { ctx.beginPath(); if (n === 'dp') ctx.arc(shape.cx, shape.cy, shape.r, 0, 7); else { shape.forEach((q, i) => i ? ctx.lineTo(...q) : ctx.moveTo(...q)); ctx.closePath(); } };
    if (l > 0.02 && !(dead && dead[k])) {
      const c = n === 'dp' ? [shape.cx, shape.cy] : [shape.reduce((a, q) => a + q[0], 0) / 6, shape.reduce((a, q) => a + q[1], 0) / 6];
      const rad = w * (0.28 + 0.25 * Math.min(Math.sqrt(l), 2));
      const gr = ctx.createRadialGradient(c[0], c[1], 1, c[0], c[1], rad); gr.addColorStop(0, `rgba(255,70,60,${Math.min(0.55, 0.18 + 0.3 * l)})`); gr.addColorStop(1, 'rgba(255,70,60,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, 7); ctx.fill();
      const wht = clamp((l - 1.6) / 2.4, 0, 0.7);
      ctx.fillStyle = `rgb(${Math.round(lerp(229, 255, wht))},${Math.round(lerp(57, 225, wht) * Math.min(1, 0.4 + l))},${Math.round(lerp(53, 215, wht) * Math.min(1, 0.4 + l))})`;
      ctx.globalAlpha = clamp(0.3 + 0.7 * l, 0, 1); path(); ctx.fill(); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = dead && dead[k] ? '#6A6A6A' : '#2E3340'; path(); ctx.fill();
      ctx.strokeStyle = dead && dead[k] ? '#8A8A8A' : '#3C4252'; ctx.lineWidth = 1.2; ctx.stroke();
    }
  });
}

/* ---------- esquemático ---------- */
const X5 = k => 250 + 56 * k;
const q5comps = {
  Vi: { type: 'dc', x: 70, y: 330, r: 32, label: p => fV(p.V, Number.isInteger(p.V) ? 0 : 1).replace(/,0 V$/, ' V') },
  RSH: { type: 'res', a: [100, 80], b: [190, 80], amp: 12, nodes: ['P', 'A'], Tmax: 155, tau: 2.4, failMode: 'open', failTitle: 'Resistor do anodo queimado' },
};
const q5wires = [
  { node: 'P', cur: 'IT', pts: [[70, 298], [70, 80], [100, 80]] },
  { node: 'P', cur: 'IT', ifHidden: 'RSH', pts: [[100, 80], [190, 80]] },
  { node: 'A', cur: 'IT', pts: [[190, 80], [250, 80]] },
  { node: 'G', cur: 'IT', pts: [[250, 560], [70, 560], [70, 362]] },
];
const q5edges = [
  { id: 'src', cur: 'IT', spawn: true, path: [[70, 560], [70, 362], { comp: 'Vi' }, [70, 298], [70, 80], [100, 80]] },
  { id: 'rsh', cur: 'IT', dep: 'RSH', path: [[100, 80], { comp: 'RSH' }, [190, 80]] },
  { id: 'rshw', cur: 'IT', ifHidden: 'RSH', path: [[100, 80], [190, 80]] },
  { id: 'bus0', cur: 'IT', path: [[190, 80], [250, 80]] },
  { id: 'gnd0', cur: 'IT', path: [[250, 560], [70, 560]] },
];
const q5labels = [
  { t: 'anodo comum', x: 446, y: 60, cls: 'small strong', anchor: 'middle' },
  { t: 'R_anodo', x: 145, y: 122, cls: 'nm', anchor: 'middle', when: p => p.shared },
  { t: p => fR(p.Rsh), x: 145, y: 146, cls: 'val', anchor: 'middle', when: p => p.shared },
  { t: 'DRIVER', x: 664, y: 398, cls: 'small strong', anchor: 'end' },
  { t: 'pino do driver em 0 liga o catodo ao terra', x: 664, y: 590, cls: 'small strong', anchor: 'end' },
  { t: 'o dígito', x: 830, y: 120, cls: 'small strong', anchor: 'middle' },
  { t: 'R', x: 230, y: 214, cls: 'nm', anchor: 'end', when: p => !p.shared },
  { t: p => fR(p.R), x: 230, y: 240, cls: 'val', anchor: 'end', when: p => !p.shared },
];
for (let k = 0; k < 8; k++) {
  const x = X5(k), Ik = 'I' + k;
  q5comps['L' + k] = { type: 'led', a: [x, 112], k: [x, 148], w: 28, zoom: true, zoomName: `segmento ${SEGN[k]} (LED vermelho, V_F = 2,0 V)`, ledColor: '#E53935', Vf: 2.0, Inom: 0.01, photonRate: 0.7, glowScale: 0.55, Tmax: 125, tau: 0.9, failMode: 'open', failTitle: `Segmento ${SEGN[k]} queimado (abriu)` };
  q5comps['R' + k] = { type: 'res', a: [x, 190], b: [x, 262], amp: 10, nodes: ['C' + k, 'D' + k] };
  q5comps['SW' + k] = { type: 'switch', a: [x, 328], b: [x, 372], onClick: sim => q5Toggle(sim, k) };
  q5wires.push(
    { node: 'A', cur: Ik, pts: [[x, 80], [x, 112]] },
    { node: 'C' + k, cur: Ik, pts: [[x, 148], [x, 190]] },
    { node: 'C' + k, cur: Ik, ifHidden: 'R' + k, pts: [[x, 190], [x, 262]] },
    { node: 'D' + k, cur: Ik, pts: [[x, 262], [x, 328]] },
    { node: 'G', cur: Ik, pts: [[x, 372], [x, 560]] },
  );
  if (k < 7) q5wires.push({ node: 'A', cur: 'S' + (k + 1), pts: [[x, 80], [X5(k + 1), 80]] }, { node: 'G', cur: 'S' + (k + 1), pts: [[X5(k + 1), 560], [x, 560]] });
  q5edges.push(
    { id: 'l' + k, cur: Ik, path: [[x, 80], [x, 112], { comp: 'L' + k }, [x, 190]] },
    { id: 'r' + k, cur: Ik, dep: 'R' + k, path: [[x, 190], { comp: 'R' + k }, [x, 262]] },
    { id: 'rw' + k, cur: Ik, ifHidden: 'R' + k, path: [[x, 190], [x, 262]] },
    { id: 's' + k, cur: Ik, path: [[x, 262], [x, 328], { comp: 'SW' + k }, [x, 372], [x, 560]] },
  );
  if (k < 7) q5edges.push({ id: 'bus' + (k + 1), cur: 'S' + (k + 1), path: [[x, 80], [X5(k + 1), 80]] }, { id: 'gnd' + (k + 1), cur: 'S' + (k + 1), path: [[X5(k + 1), 560], [x, 560]] });
  q5labels.push({ t: SEGN[k], x: x + 19, y: 138, cls: 'small strong' });
}
function q5Toggle(sim, k) { const a = sim.p.pins.slice(); a[k] = a[k] ? 0 : 1; sim.set({ pins: a }); }

const DIG = { x: 760, y: 150, w: 130, h: 260 };
Q5.circuit = {
  viewBox: [1000, 640], Iref: 0.012,
  defaults: P5({}),
  solve: solveQ5, zoomComp: 'L0',
  comps: q5comps, wires: q5wires, edges: q5edges, labels: q5labels,
  dots: Array.from({ length: 7 }, (_, k) => [X5(k), 80]).concat(Array.from({ length: 7 }, (_, k) => [X5(k), 560])),
  values: [
    { id: 'IA', cur: 'IT', x: 230, y: 34, anchor: 'middle', fn: s => `I_anodo = ${fI(s.I.IT)}` },
    { id: 'IS', cur: 'IT', x: 830, y: 505, anchor: 'middle', fn: s => s.ex.n ? `${s.ex.n} aceso(s) · ${fI(Math.max(...s.ex.I))} por segmento` : 'nenhum segmento aceso' },
  ],
  meterAt: [770, 600 - 96 - 10], meterDefault: ['A', 'G'], legendAt: [24, 612],
  probePoints: { A: [420, 80], G: [420, 560], P: [70, 200] },
  charts: ['bars', 'sankey'],
  chartTitles: { bars: 'Corrente por segmento' },
  /* caixa do driver, níveis dos pinos e o dígito clicável */
  onBuild(sim) {
    const box = svgEl('rect', { x: 222, y: 306, width: 448, height: 96, rx: 10, fill: '#EEF3FA', stroke: NAVY, 'stroke-width': 2.2 });
    sim.gWires.insertBefore(box, sim.gWires.firstChild);
    sim._pinTxt = [];
    for (let k = 0; k < 8; k++) {
      const x = X5(k), g = svgEl('g', { style: 'cursor:pointer' }, sim.gVals);
      const r = svgEl('rect', { x: x + 6, y: 278, width: 22, height: 22, rx: 5, stroke: NAVY, 'stroke-width': 1.6 }, g);
      const t = svgEl('text', { x: x + 17, y: 295, class: 'small strong', 'text-anchor': 'middle' }, g);
      g.addEventListener('click', () => { if (!sim.vm) q5Toggle(sim, k); });
      sim._pinTxt.push([r, t]);
    }
    const P = segPolys(DIG.x, DIG.y, DIG.w, DIG.h);
    SEGN.forEach((n, k) => {
      const el = n === 'dp' ? svgEl('circle', { cx: P.dp.cx, cy: P.dp.cy, r: P.dp.r + 4, fill: 'transparent', style: 'cursor:pointer' }, sim.gVals)
        : svgEl('polygon', { points: P[n].map(q => q.join(',')).join(' '), fill: 'transparent', style: 'cursor:pointer' }, sim.gVals);
      el.addEventListener('click', () => { if (!sim.vm) q5Toggle(sim, k); });
    });
    svgEl('rect', { x: DIG.x - 30, y: DIG.y - 24, width: DIG.w + 90, height: DIG.h + 48, rx: 14, fill: '#1B1F2A' }, sim.gWires);
  },
  onUpdate(sim) {
    (sim._pinTxt || []).forEach(([r, t], k) => { const v = sim.p.pins[k]; t.textContent = v; r.setAttribute('fill', v === 0 ? '#FCE8D8' : '#fff'); t.setAttribute('fill', v === 0 ? '#B4551A' : '#47536E'); });
  },
  deco(ctx, sim) {
    const s = sim.sol, lv = s.ex.I.map(i => sim.power ? i / Q5L.Inom : 0), dead = SEGN.map((n, k) => !!sim.damage['L' + k]);
    drawDigit(ctx, DIG.x, DIG.y, DIG.w, DIG.h, lv, dead);
    ctx.fillStyle = '#9FB0CC'; ctx.font = '700 14px Lato, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('clique nos segmentos', DIG.x + DIG.w / 2 + 15, DIG.y + DIG.h + 46);
  },
  relevo: {
    cur: 'I0',
    segs: (p, s) => p.shared
      ? [{ kind: 'rise', to: s.V.P, label: 'fonte' }, { kind: 'flat', node: 'P' }, { kind: 'drop', to: s.V.A, label: 'R anodo' }, { kind: 'flat', node: 'A', name: 'anodo' }, { kind: 'drop', to: 0, label: 'LED a' }, { kind: 'flat', node: 'G' }]
      : [{ kind: 'rise', to: s.V.P, label: 'fonte' }, { kind: 'flat', node: 'A', name: 'anodo' }, { kind: 'drop', to: s.V.C0, label: 'LED a' }, { kind: 'flat', node: 'C0', name: 'catodo' }, { kind: 'drop', to: 0, label: 'R' }, { kind: 'flat', node: 'G' }],
    caption: () => 'Segmento "a": a corrente entra pelo anodo comum (5 V), desce 2,0 V no LED e o restante no resistor, até o pino do driver em 0 (terra).',
  },
  sankey: (s) => {
    const luz = 0.2 * s.ex.PL;
    return {
      Pin: s.ex.Pin, Pref: 0.4, etaNote: `η = V_F/V = ${fPct(s.ex.Pin > 0 ? s.ex.PL / s.ex.Pin : 0)}`,
      sinks: [
        { label: 'calor nos resistores', P: s.ex.PR, color: 'rgba(232,119,46,A)' },
        { label: 'LEDs: calor', P: s.ex.PL - luz, color: 'rgba(201,54,42,A)' },
        { label: 'LEDs: luz*', P: luz, color: 'rgba(229,57,53,A)' },
      ],
      foot: '* ≈ 20 % da potência do LED vermelho (estimativa)',
    };
  },
  barsChart: (s, p) => {
    if (p.muxOn) {
      const Ipk = (p.V - p.VF) / p.Rm, ds = splitDigits(p.mtext);
      return { title: 'pico no anodo de cada dígito', max: 0.35, limit: 0.02, limitLabel: 'pino do µC ≈ 20 mA', tick: v => num(v * 1000, 0), fmt: v => num(v * 1000, 0) + ' mA', items: ds.map((d, i) => ({ label: 'D' + (i + 1) + ' "' + d.trim() + '"', v: pinsFor(d).filter(x => x === 0).length * Ipk, color: '#E8772E' })) };
    }
    const mx = Math.max(...s.ex.I);
    return { title: `${s.ex.n} segmento(s) aceso(s)`, max: Math.max(0.03, Math.ceil(mx * 1.3 / 0.01) * 0.01), limit: Q5L.Imax, limitLabel: 'I_F,máx = 25 mA', ref: Q5L.Inom, refLabel: 'desejado ≈ 10 mA', tick: v => num(v * 1000, 0), fmt: v => num(v * 1000, 1), items: SEGN.map((n, k) => ({ label: n, v: s.ex.I[k], dead: s.comp['L' + k].mode === 'dead', color: '#E53935' })) };
  },
  muxwave: (s, p) => { const Ipk = (p.V - p.VF) / p.Rm; return { Ipk, Iavg: Ipk / 4, IFmax: Q5L.Imax, IFP: Q5L.IFP, duty: 0.25, ymax: 0.12, phase: s._muxPhase }; },
  altViews: { mux: drawMux },
};

/* ---------- vista da multiplexação ---------- */
function drawMux(ctx, sim) {
  const p = sim.p, f = Math.pow(10, p.mf), Ipk = (p.V - p.VF) / p.Rm, ds = splitDigits(p.mtext);
  const st = sim._mux = sim._mux || { phase: 0, perc: [0, 1, 2, 3].map(() => new Array(8).fill(0)), tt: 0 };
  const dtR = (sim._dtReal || 0) * (sim.paused ? 0 : 1) * (sim.slow ? 0.25 : 1);
  st.phase += f * dtR; st.tt += dtR; sim.sol._muxPhase = (st.phase % 2 + 2) % 2;
  const active = Math.floor(st.phase * 4) % 4, slot = 1 / (4 * f), avgMode = slot < 2 / 60;
  const flick = f < 50 ? 1 + 0.18 * Math.sin(2 * Math.PI * 7 * st.tt) * (1 - f / 50) : 1;
  ds.forEach((d, i) => {
    const pins = pinsFor(d);
    for (let k = 0; k < 8; k++) {
      const lit = pins[k] === 0 && sim.power;
      if (avgMode) st.perc[i][k] = lit ? 0.25 * flick : 0;
      else { const inst = lit && i === active ? 1 : 0; st.perc[i][k] += (inst - st.perc[i][k]) * (1 - Math.exp(-dtR / 0.045)); }
    }
  });
  ctx.fillStyle = '#1F2D4D'; ctx.font = '900 22px Lato, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('4 dígitos multiplexados: cada dígito aceso 1/4 do tempo', 40, 40);
  ctx.fillStyle = '#1B1F2A'; ctx.beginPath(); ctx.roundRect(80, 70, 840, 290, 18); ctx.fill();
  ds.forEach((d, i) => {
    const x0 = 140 + i * 200, nOn = pinsFor(d).filter(v => v === 0).length;
    const lv = st.perc[i].map(v => v * Ipk / (3 / 330));
    drawDigit(ctx, x0, 100, 110, 220, lv);
    const act = sim.power && i === active && !avgMode;
    ctx.fillStyle = act ? '#E8772E' : '#3A4158'; ctx.beginPath(); ctx.roundRect(x0 - 10, 330, 140, 22, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 13px Lato, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`D${i + 1} · anodo ${avgMode ? 'pico ' : ''}${act || avgMode ? num(nOn * Ipk * 1000, 0) : '0'} mA`, x0 + 60, 346);
  });
  // linha do tempo da varredura
  const tx0 = 100, tx1 = 900, ty = 392;
  for (let i = 0; i < 4; i++) {
    const on = sim.power && (avgMode || i === active);
    ctx.fillStyle = on && !avgMode ? '#E8772E' : avgMode ? '#F5C3A0' : '#E8EDF5'; ctx.fillRect(tx0 + i * (tx1 - tx0) / 4 + 2, ty, (tx1 - tx0) / 4 - 4, 26);
    ctx.fillStyle = on && !avgMode ? '#fff' : '#47536E'; ctx.font = '900 14px Lato, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`D${i + 1}`, tx0 + (i + 0.5) * (tx1 - tx0) / 4, ty + 18);
  }
  if (!avgMode && sim.power) { const u = (st.phase % 1 + 1) % 1, x = tx0 + u * (tx1 - tx0); ctx.fillStyle = '#1F2D4D'; ctx.fillRect(x - 1.5, ty - 6, 3, 38); }
  ctx.fillStyle = '#1F2D4D'; ctx.font = '700 17px Lato, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`varredura completa: ${num(f, f < 10 ? 1 : 0)} Hz → cada dígito fica ${num(slot * 1000, slot < 0.01 ? 2 : 0)} ms aceso a cada ${num(1000 / f, f > 100 ? 1 : 0)} ms`, 100, 448);
  ctx.fillStyle = avgMode && f >= 50 ? '#23884F' : '#C9362A'; ctx.font = '900 17px Lato, sans-serif';
  ctx.fillText(f >= 50 ? 'Persistência da visão: o olho integra os pulsos e vê os 4 dígitos acesos ao mesmo tempo.' : f >= 8 ? 'Rápido, mas ainda abaixo de ≈ 50 Hz: aparece cintilação.' : 'Câmera lenta: dá para ver um dígito de cada vez.', 100, 474);
  // pinos economizados
  ctx.fillStyle = '#47536E'; ctx.font = '700 15px Lato, sans-serif';
  ctx.fillText('estático: 4 × 8 = 32 pinos', 100, 512); ctx.fillText('multiplexado: 8 + 4 = 12 pinos', 100, 560);
  for (let i = 0; i < 32; i++) { ctx.fillStyle = '#C9D0DC'; ctx.fillRect(330 + i * 17, 498, 12, 18); }
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i < 8 ? '#E53935' : '#E8772E'; ctx.fillRect(330 + i * 17, 546, 12, 18); }
  ctx.fillStyle = '#23884F'; ctx.font = '900 17px Lato, sans-serif'; ctx.fillText('economia: 20 pinos', 560, 560);
}

/* ---------- ilustração ---------- */
Q5.illus = `<svg viewBox="0 0 560 340" role="img" aria-label="Medidor de painel com display de sete segmentos">
  <rect x="8" y="8" width="544" height="324" rx="18" fill="#E8EDF5"/>
  <rect x="70" y="60" width="420" height="220" rx="16" fill="#3E5381"/>
  <rect x="96" y="84" width="368" height="130" rx="8" fill="#1B1F2A"/>
  <g fill="#FF4A3D">
    <rect x="128" y="102" width="44" height="9" rx="3"/><rect x="170" y="110" width="9" height="40" rx="3"/><rect x="170" y="156" width="9" height="40" rx="3"/><rect x="128" y="194" width="44" height="9" rx="3" opacity=".15"/><rect x="121" y="156" width="9" height="40" rx="3" opacity=".15"/><rect x="121" y="110" width="9" height="40" rx="3"/><rect x="128" y="148" width="44" height="9" rx="3"/>
    <rect x="218" y="102" width="44" height="9" rx="3"/><rect x="260" y="110" width="9" height="40" rx="3"/><rect x="260" y="156" width="9" height="40" rx="3"/><rect x="218" y="194" width="44" height="9" rx="3"/><rect x="211" y="156" width="9" height="40" rx="3" opacity=".15"/><rect x="211" y="110" width="9" height="40" rx="3" opacity=".15"/><rect x="218" y="148" width="44" height="9" rx="3"/>
    <circle cx="283" cy="199" r="5"/>
    <rect x="308" y="102" width="44" height="9" rx="3"/><rect x="350" y="110" width="9" height="40" rx="3"/><rect x="350" y="156" width="9" height="40" rx="3"/><rect x="308" y="194" width="44" height="9" rx="3"/><rect x="301" y="156" width="9" height="40" rx="3"/><rect x="301" y="110" width="9" height="40" rx="3"/><rect x="308" y="148" width="44" height="9" rx="3"/>
    <rect x="398" y="102" width="44" height="9" rx="3"/><rect x="440" y="110" width="9" height="40" rx="3" opacity=".15"/><rect x="440" y="156" width="9" height="40" rx="3"/><rect x="398" y="194" width="44" height="9" rx="3"/><rect x="391" y="156" width="9" height="40" rx="3" opacity=".15"/><rect x="391" y="110" width="9" height="40" rx="3"/><rect x="398" y="148" width="44" height="9" rx="3"/>
  </g>
  <text x="280" y="248" text-anchor="middle" font-family="Lato,sans-serif" font-weight="900" font-size="16" fill="#fff">MEDIDOR DE PAINEL · V</text>
  <text x="280" y="310" text-anchor="middle" font-family="Lato,sans-serif" font-weight="700" font-size="13" fill="#47536E">display vermelho de anodo comum · 5 V</text>
</svg>`;

const DIG_OPTS = ['8.', '8', '7', '1', '0', '2', '5'].map(c => [{ pins: pinsFor(c) }, '“' + c + '”']);
Q5.slides = [
  {
    type: 'context', hash: 'q5', q: 5, kind: 'LED · anodo comum e multiplexação',
    title: 'O display de um medidor de painel',
    story: 'Um medidor de painel usa um display de sete segmentos <b>vermelho, anodo comum</b>, alimentado em 5 V. Os catodos vão a um driver que, em nível baixo, liga o segmento ao terra. Deseja-se cerca de <b>10 mA por segmento</b>.',
    chips: [['V = 5 V'], ['V_F = 2,0 V'], ['I_F ≈ 10 mA (desejado)', 'o'], ['I_F,máx = 25 mA (contínua)'], ['I_FP = 100 mA (pulsada)'], ['8 segmentos: a–g + dp', 'o']],
    items: [['A', 'a)', 'Anodo comum: pino em 0 ou em 1 acende?'], ['B', 'b)', 'R (E12), corrente em "8." e "1", potência'], ['C', 'c)', 'Um único resistor de 47 Ω no anodo'], ['D', 'd)', '4 dígitos multiplexados']],
    trains: 'Treina: anodo comum, resistor único × individual, multiplexação e I_FP.',
    notes: { tempo: '3 min', perguntas: ['Onde vocês já viram displays de sete segmentos?', 'Quantos LEDs tem um dígito?'], erros: [], dica: 'Desenhe um dígito no quadro e nomeie os segmentos a–g no sentido horário, com g no meio.' },
  },
  {
    type: 'circuit', hash: 'q5-circuito', q: 5, title: 'O circuito da Figura 5', circuit: Q5.circuit,
    steps: [
      { t: 'Antes de ligar', p: 'Os 8 anodos estão ligados juntos no +5 V (<b>anodo comum</b>). Cada catodo passa por um resistor e chega a um pino do driver.', eq: [() => '\\text{pino em 0} \\Rightarrow \\text{catodo no terra} \\Rightarrow \\text{segmento aceso}'],
        scene: { params: P5({}), power: false, cta: true, values: 'none', highlight: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] } },
      { t: 'Ligue a fonte', p: 'Com todos os pinos em 0, o dígito mostra "8.". A corrente entra pelo anodo comum e se divide pelos 8 segmentos.',
        scene: { params: P5({}), power: true, values: ['IA'] } },
      { t: 'Clique nos pinos', p: 'Clique nos quadradinhos 0/1 acima do driver, nas chaves ou direto no dígito. Veja as partículas pararem nos segmentos cujo pino vai a 1.',
        scene: { params: P5({ pins: pinsFor('2') }), values: ['IA', 'IS'] } },
    ],
    notes: { tempo: '4 min', perguntas: ['Por que o driver liga o catodo ao terra, e não o anodo à fonte?'], erros: ['Confundir anodo comum (pino em 0 acende) com catodo comum (pino em 1 acende).'], dica: 'Peça para alguém "escrever" o número 4 clicando nos pinos.' },
  },
  {
    type: 'item', hash: 'q5-a', q: 5, level: 'A', letter: 'a', title: 'O que é anodo comum',
    enun: '<b>a)</b> O que significa “anodo comum”? Para acender o segmento a, o pino do driver deve ficar em nível alto ou baixo? Por que cada segmento tem seu próprio resistor?',
    circuit: Q5.circuit,
    steps: [
      { t: 'Todos os anodos juntos', p: 'Os 8 LEDs têm o <b>anodo ligado no mesmo ponto</b>, o +5 V. Com todos os pinos em 1 (abertos), nenhum catodo chega ao terra: não há caminho e nada acende.',
        scene: { params: P5({ pins: [1, 1, 1, 1, 1, 1, 1, 1] }), values: ['IA'], highlight: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] } },
      { t: 'Pino a em nível baixo', p: 'Com o pino de "a" em 0, o catodo vai ao terra através do resistor: o LED fica com polarização direta e acende. Nível <b>baixo</b> acende.', eq: [() => 'V_{LED} = 5 - V_R\\ \\Rightarrow\\ \\text{acende com pino em 0}'],
        scene: { params: P5({ pins: [0, 1, 1, 1, 1, 1, 1, 1] }), values: ['IA', 'IS'], highlight: ['SW0'] } },
      { t: 'Escreva números', p: 'Escolha um número ou clique nos pinos. A corrente no anodo comum cresce com o número de segmentos acesos.',
        widget: { type: 'seg', options: DIG_OPTS },
        live: (s) => `acesos: <b>${SEGN.filter((n, k) => s.ex.I[k] > 0).join(' ') || 'nenhum'}</b> · I<sub>anodo</sub> = ${fI(s.I.IT)}`,
        scene: { params: P5({ pins: pinsFor('7') }), values: ['IA', 'IS'] } },
      { t: 'Por que um resistor em cada segmento?', p: 'Com um resistor por segmento, cada corrente depende só de (5 − V<sub>F</sub>)/R, e não de quantos outros segmentos estão acesos. O item c) mostra o que acontece sem isso.', eq: [() => 'I_F = \\dfrac{5 - V_F}{R}\\quad\\text{(igual para "1" e para "8.")}'],
        widget: { type: 'seg', options: [[{ pins: pinsFor('1') }, '“1”'], [{ pins: pinsFor('8.') }, '“8.”']] },
        scene: { params: P5({ pins: pinsFor('1') }), values: ['IA', 'IS'] },
        result: () => [['Anodo comum', 'os anodos de todos os segmentos ligados ao +5 V'], ['Para acender "a"', 'pino em nível baixo (0)'], ['Um R por segmento', 'brilho igual qualquer que seja o número exibido']] },
    ],
    notes: { tempo: '7 min', perguntas: ['Num display de catodo comum, como seria o driver?'], erros: ['Achar que nível alto "liga" o segmento.'], dica: 'Mostre que trocar "1" por "8." não muda o brilho de b e c: só muda a corrente no anodo.' },
  },
  {
    type: 'item', hash: 'q5-b', q: 5, level: 'B', letter: 'b', title: 'R, corrente e potência',
    enun: '<b>b)</b> Calcule R (E12), a corrente real de cada segmento e a corrente no terminal de anodo comum ao exibir “8.” (sete segmentos e o ponto) e “1”. Qual a potência total consumida em “8.”?',
    circuit: Q5.circuit,
    steps: [
      { t: 'O resistor', p: 'Pelo roteiro: folga = 5 − 2 = 3 V; valor comercial imediatamente acima.', eq: [() => 'R = \\dfrac{5 - 2}{10\\,\\text{mA}} = 300\\,\\Omega\\ \\Rightarrow\\ \\text{E12: } 330\\,\\Omega', () => 'I_F = \\dfrac{3}{330} = 9{,}09\\,\\text{mA}'],
        scene: { params: P5({ pins: pinsFor('8.') }), values: ['IS'], highlight: ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'] } },
      { t: 'Exibindo "8."', p: 'Os 8 segmentos acesos: o anodo comum leva a soma das correntes.', eq: [() => 'I_{\\text{anodo}} = 8 \\times 9{,}09 = 72{,}7\\,\\text{mA}'],
        widget: { type: 'seg', options: [[{ pins: pinsFor('8.') }, '“8.”'], [{ pins: pinsFor('1') }, '“1”']] },
        scene: { params: P5({ pins: pinsFor('8.') }), values: ['IA', 'IS'] } },
      { t: 'Exibindo "1"', p: 'Só b e c acesos: cada segmento continua com 9,09 mA.', eq: [() => 'I_{\\text{anodo}} = 2 \\times 9{,}09 = 18{,}2\\,\\text{mA}'],
        widget: { type: 'seg', options: [[{ pins: pinsFor('8.') }, '“8.”'], [{ pins: pinsFor('1') }, '“1”']] },
        scene: { params: P5({ pins: pinsFor('1') }), values: ['IA', 'IS'] } },
      { t: 'Potência em "8."', p: 'A fonte entrega 5 V × 72,7 mA. Mais da metade vira calor nos resistores.', eq: [() => 'P = 5 \\times 72{,}7\\,\\text{mA} = 364\\,\\text{mW}', () => 'P_{LEDs} = 8 \\times 2 \\times 9{,}09\\,\\text{m} = 145\\,\\text{mW};\\quad P_R = 218\\,\\text{mW}'],
        scene: { params: P5({ pins: pinsFor('8.') }), values: ['IA', 'IS'] },
        result: () => [['R', '330 Ω (E12)'], ['I_F', '9,09 mA por segmento'], ['I_anodo em "8."', '72,7 mA'], ['I_anodo em "1"', '18,2 mA'], ['P em "8."', '364 mW']] },
    ],
    notes: { tempo: '8 min', perguntas: ['O resistor pode ser de 1/8 W? (P_R = 27 mW)'], erros: ['Usar o valor E12 abaixo (270 Ω) e passar de 10 mA sem justificativa.'], dica: 'O gráfico de barras mostra todos os segmentos na mesma altura, com qualquer número.' },
  },
  {
    type: 'item', hash: 'q5-c', q: 5, level: 'C', letter: 'c', title: 'Um resistor só, no anodo',
    enun: '<b>c)</b> Para economizar componentes, um projetista colocou um único resistor de 47 Ω no anodo comum e ligou os catodos direto ao driver. Calcule a corrente por segmento ao exibir “8”, “7” e “1” e analise o resultado.',
    circuit: Q5.circuit,
    steps: [
      { t: 'Exibindo "8"', p: 'Agora a corrente total é fixada pelo resistor do anodo e <b>dividida</b> entre os segmentos acesos.', eq: [() => 'I_{\\text{total}} = \\dfrac{5 - 2}{47} = 63{,}8\\,\\text{mA}', () => '\\text{"8"} (7\\ \\text{seg.}):\\ I_F = \\dfrac{63{,}8}{7} = 9{,}1\\,\\text{mA}'],
        widget: { type: 'seg', resetDamage: true, options: [[{ pins: pinsFor('8') }, '“8”'], [{ pins: pinsFor('7') }, '“7”'], [{ pins: pinsFor('1') }, '“1”']] },
        scene: { params: P5({ shared: true, pins: pinsFor('8') }), values: ['IA', 'IS'] } },
      { t: 'Exibindo "7"', p: 'Com 3 segmentos, cada um recebe muito mais: o "7" brilha mais que o "8".', eq: [() => '\\text{"7"} (3\\ \\text{seg.}):\\ I_F = \\dfrac{63{,}8}{3} = 21{,}3\\,\\text{mA}'],
        scene: { params: P5({ shared: true, pins: pinsFor('7') }), values: ['IA', 'IS'] } },
      { t: 'Exibindo "1"', p: 'Com só 2 segmentos, a corrente passa do máximo contínuo. Observe o aquecimento: quando um segmento abre, o outro herda os 63,8 mA.', eq: [() => '\\text{"1"} (2\\ \\text{seg.}):\\ I_F = \\dfrac{63{,}8}{2} = 31{,}9\\,\\text{mA} > 25\\,\\text{mA}'],
        scene: { params: P5({ shared: true, pins: pinsFor('1') }), values: ['IA', 'IS'] } },
      { t: 'Análise', p: 'O brilho passa a depender do número exibido, os segmentos de dígitos "magros" sobrecarregam e um segmento queimado aumenta a corrente dos outros. A economia de 7 resistores não compensa.',
        scene: { params: P5({ shared: true, pins: pinsFor('7') }) },
        result: () => [['"8"', '9,1 mA por segmento'], ['"7"', '21,3 mA (≈ 2,3× mais brilho)'], ['"1"', '31,9 mA > 25 mA → queima'], ['Conclusão', 'um resistor por segmento']] },
    ],
    notes: { tempo: '8 min', perguntas: ['Qual dígito tem menos segmentos? E mais?', 'Por que a falha se propaga?'], erros: ['Calcular 63,8 mA por segmento (esquecer de dividir).'], dica: 'Mostre o gráfico de barras ao trocar entre "8", "7" e "1": a altura muda com o número de barras.' },
  },
  {
    type: 'item', hash: 'q5-d', q: 5, level: 'D', letter: 'd', title: 'Quatro dígitos multiplexados',
    enun: '<b>d)</b> O produto passa a ter 4 dígitos multiplexados: cada dígito fica aceso 1/4 do tempo. (i) Que corrente de pico mantém o brilho médio do item b)? Ela é admissível? (ii) Recalcule R. (iii) Qual a corrente de pico no anodo de um dígito exibindo “8.”? Um pino de microcontrolador (≈ 20 mA) pode fornecê-la? (iv) Quantos pinos são economizados em relação ao acionamento estático?',
    circuit: Q5.circuit, chartKinds: ['muxwave', 'bars'], chartTitles: { bars: 'Corrente no anodo de cada dígito' },
    steps: [
      { t: '(i) A corrente de pico', p: 'Para o mesmo brilho médio de 9,09 mA com o dígito aceso só 1/4 do tempo, o pico precisa ser 4 vezes maior. Em câmera lenta, cada dígito pisca forte e apaga.', eq: [() => 'I_{pk} = 4 \\times 9{,}09 = 36{,}4\\,\\text{mA}', () => '36{,}4\\,\\text{mA} < I_{FP} = 100\\,\\text{mA}\\ \\checkmark\\quad(\\text{média } 9{,}1 < 25\\,\\text{mA})'],
        callout: { k: 'atencao', t: 'Atenção', x: 'Um ciclo de 25 % não é exatamente "baixo": confira a curva de corrente de pico × ciclo de trabalho no datasheet.' },
        scene: { params: P5({ muxOn: true, mf: 0, Rm: 82 }), view: 'mux' } },
      { t: 'Persistência da visão', p: 'Aumente a frequência de varredura. Abaixo de ≈ 50 Hz o olho percebe a cintilação; acima disso, os 4 dígitos parecem acesos ao mesmo tempo.',
        widget: { type: 'slider', param: 'mf', label: 'Frequência de varredura (escala log)', min: -0.3, max: 2.4, step: 0.01, fmt: v => num(Math.pow(10, v), Math.pow(10, v) < 10 ? 1 : 0) + ' Hz', marks: [{ v: Math.log10(50), label: '≈ 50 Hz' }], mfmt: () => 'limite da cintilação' },
        scene: { params: P5({ muxOn: true, mf: 0.3, Rm: 82 }), view: 'mux' } },
      { t: '(ii) Novo resistor', p: 'A regra do roteiro manda o valor E12 imediatamente acima (100 Ω), mas isso dá 30 mA e brilho ≈ 17 % menor. Aqui se justifica o valor abaixo: 82 Ω.', eq: [() => 'R = \\dfrac{3}{36{,}4\\,\\text{mA}} = 82{,}5\\,\\Omega', () => '82\\,\\Omega:\\ I_{pk} = 36{,}6\\,\\text{mA}\\quad|\\quad 100\\,\\Omega:\\ I_{pk} = 30\\,\\text{mA}'],
        callout: { k: 'dica', t: 'Exceção à regra', x: 'Arredondar para baixo é aceitável porque 36,6 mA continua muito abaixo de I<sub>FP</sub> = 100 mA e a média (9,15 mA) fica abaixo de 25 mA.' },
        widget: { type: 'seg', param: 'Rm', options: [[82, '82 Ω'], [100, '100 Ω']] },
        scene: { params: P5({ muxOn: true, mf: 2.2, Rm: 82 }), view: 'mux' } },
      { t: '(iii) O anodo de um dígito', p: 'Quando o dígito "8." está aceso, o anodo dele fornece os 8 segmentos de uma vez.', eq: [() => 'I_{\\text{anodo}} = 8 \\times 36{,}6 = 293\\,\\text{mA} \\gg 20\\,\\text{mA}'],
        callout: { k: 'erro', t: 'Erro comum', x: 'Ligar o anodo direto num pino do microcontrolador. É preciso um transistor por dígito (PNP ou MOSFET canal P) chaveando o +5 V.' },
        widget: { type: 'seg', param: 'mtext', options: [['13.85', '“13.85”'], ['8.8.8.8.', '“8.8.8.8.”']] },
        scene: { params: P5({ muxOn: true, mf: 0.3, Rm: 82, mtext: '8.8.8.8.' }), view: 'mux' } },
      { t: '(iv) Pinos economizados', p: 'No acionamento estático, cada segmento de cada dígito precisa de um pino. Multiplexando, os 8 segmentos são compartilhados e só os 4 anodos são individuais.', eq: [() => '\\text{estático: } 4\\times 8 = 32\\qquad\\text{mux: } 8 + 4 = 12', () => '\\text{economia: } 20\\ \\text{pinos}'],
        scene: { params: P5({ muxOn: true, mf: 2.2, Rm: 82 }), view: 'mux' },
        result: () => [['(i) I_pk', '36,4 mA < I_FP = 100 mA'], ['(ii) R', '82 Ω (82,5 Ω calculado) → 36,6 mA'], ['(iii) Anodo de "8."', '≈ 293 mA: precisa de transistor'], ['(iv) Pinos', '32 → 12: economia de 20']] },
    ],
    notes: { tempo: '12 min', perguntas: ['Por que o brilho médio depende do pico × ciclo de trabalho?', 'O que limita o número de dígitos multiplexados?'], erros: ['Esquecer que a corrente de anodo soma os 8 segmentos.', 'Manter R = 330 Ω na multiplexação (brilho 4× menor).'], dica: 'Comece em 1 Hz e suba devagar até 60 Hz: a turma "vê" a persistência da visão acontecer.' },
  },
  {
    type: 'play', hash: 'q5-mexa', q: 5, title: 'Mexa você: o display',
    circuit: Q5.circuit, params: P5({}), resetLabel: 'Restaurar valores do item b)',
    controls: [
      { type: 'seg', label: 'Número', options: DIG_OPTS },
      { type: 'slider', param: 'V', label: 'V da fonte', min: 0, max: 9, step: 0.1, fmt: v => fV(v, 1) },
      { type: 'seg', param: 'shared', label: 'Resistores', options: [[false, 'um por segmento'], [true, 'um único no anodo']] },
      { type: 'e12', param: 'R', label: 'R de cada segmento', min: 47, max: 1000, fmt: v => fR(v) },
      { type: 'e12', param: 'Rsh', label: 'R único do anodo', min: 22, max: 470, fmt: v => fR(v) },
    ],
    live: (s) => `acesos: ${s.ex.n} · I<sub>anodo</sub> = ${fI(s.I.IT)}<br>I<sub>F</sub> por segmento: ${s.ex.n ? fI(Math.max(...s.ex.I)) : '—'} · P = ${fP(s.ex.Pin)}`,
    challenge: 'Desafios: (1) com o resistor único, ache o menor R que permite exibir "1" sem passar de 25 mA. Como fica o brilho do "8"? (2) Qual o menor R individual E12 que respeita os 25 mA? (3) Clique nos pinos e escreva a letra "A".',
    notes: { tempo: 'livre', perguntas: ['Com resistor único, existe algum R que dê o mesmo brilho para "1" e "8"?'], erros: [], dica: 'Desafio 1: R ≥ 3/(2 × 25 mA) = 60 Ω → E12 68 Ω; o "8" fica com 6,3 mA por segmento.' },
  },
];

Q5.conf = () => [
  ['a', 'Para acender "a"', 'pino em 0', 'anodo comum no +5 V'],
  ['b', 'R', '330 Ω', '300 Ω calculado; E12 acima'],
  ['b', 'I_F por segmento', fI(3 / 330), ''],
  ['b', 'I_anodo em "8." / "1"', `${fI(8 * 3 / 330)} / ${fI(2 * 3 / 330)}`, ''],
  ['b', 'P em "8."', fP(5 * 8 * 3 / 330), `LEDs ${fP(8 * 2 * 3 / 330)} · R ${fP(8 * 3 * 3 / 330)}`],
  ['c', 'I_total com 47 Ω', fI(3 / 47), ''],
  ['c', '"8" / "7" / "1"', `${fI(3 / 47 / 7)} / ${fI(3 / 47 / 3)} / ${fI(3 / 47 / 2)}`, '"1" passa de 25 mA'],
  ['d', 'I_pk (i)', fI(4 * 3 / 330), '< I_FP = 100 mA'],
  ['d', 'R (ii)', '82 Ω', `82,5 Ω calculado; I_pk = ${fI(3 / 82)} (100 Ω daria ${fI(3 / 100)})`],
  ['d', 'Anodo de "8." (iii)', fI(8 * 3 / 82), '≫ 20 mA: transistor por dígito'],
  ['d', 'Pinos (iv)', '32 → 12', 'economia de 20'],
];

/* =====================================================================
   APRESENTAÇÃO — slides, etapas navegáveis, menu, notas e laço de animação
   ===================================================================== */
const QUESTIONS = [
  { n: 1, kind: 'Zener', title: 'Sensor no barramento de 24 V de um CLP', desc: 'Teste de estado, R_L,mín, reprojeto de R_S' },
  { n: 2, kind: 'Zener', title: 'Duas referências para uma placa de aquisição', desc: 'Zeners em série, Zener invertido, regulação de linha com r_z' },
  { n: 3, kind: 'Zener', title: 'Módulo de rádio de 30 a 180 mA', desc: 'Faixa de carga, P_ZM, projeto impossível, eficiência' },
  { n: 4, kind: 'LED', title: 'Fita de LED de 12 V', desc: 'Série + paralelo, folga, tolerâncias e queda nas trilhas' },
  { n: 5, kind: 'LED', title: 'Display de sete segmentos', desc: 'Anodo comum, resistor único × individual, multiplexação' },
  { n: 6, kind: 'LED', title: 'Lâmpada-piloto na rede de 127 V', desc: 'Tensão reversa, antiparalelo, potência em CA, fonte capacitiva' },
];
const LEVEL = { A: 'A · Conceitual', B: 'B · Cálculo', C: 'C · Análise', D: 'D · Desafio' };

/* ---------- texto: subscritos HTML, KaTeX inline/display ---------- */
function sub(s) { return String(s).replace(/_(\{[^}]*\}|[A-Za-z0-9áéíóúãõâêôç,]+)/g, (_, x) => `<sub>${x.replace(/[{}]/g, '')}</sub>`); }
function katexHTML(tex, display) {
  if (window.katex) { try { return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false }); } catch (e) { /* cai no texto */ } }
  return `<code>${tex.replace(/</g, '&lt;')}</code>`;
}
function md(s) { return String(s).replace(/\$([^$]+)\$/g, (_, t) => katexHTML(t, false)); }

const DECK = { slides: [], i: 0, el: null, ignoreHash: false };

/* ---------- construção dos slides ---------- */
function headHTML(spec) {
  const q = QUESTIONS[spec.q - 1];
  return `<div class="slide-head"><span class="qtag">Questão ${spec.q} · ${q.kind}</span><h1>${sub(spec.title)}</h1>${spec.level ? `<span class="lvl lvl-${spec.level}">${LEVEL[spec.level]}</span>` : ''}</div>`;
}
function buildSlide(spec) {
  const sec = document.createElement('section'); sec.className = 'slide'; spec.el = sec;
  if (spec.type === 'cover') {
    sec.innerHTML = `<div class="cover"><div>
      <div class="kicker">Lista de exercícios · Capítulo 6</div>
      <h1>Diodo Zener e LED por dentro do circuito</h1>
      <p class="lead">Seis circuitos reais com a corrente, a tensão, o calor e a luz visíveis. Cada número na tela vem do mesmo roteiro de cálculo da lista.</p>
      <div class="keys"><span><kbd>→</kbd><kbd>espaço</kbd>avança</span><span><kbd>←</kbd>volta</span><span><kbd>M</kbd>menu</span><span><kbd>N</kbd>notas do professor</span><span><kbd>Esc</kbd>fecha</span></div>
    </div><div class="qcards">${QUESTIONS.map(q => `<button class="qcard" type="button" data-q="${q.n}" ${DECK.slides.some(s => s.q === q.n) ? '' : 'disabled'}><span class="qk">Questão ${q.n} · ${q.kind}</span><span class="qn">${q.title}</span><span class="qd">${sub(q.desc)}</span></button>`).join('')}</div></div>`;
    sec.querySelectorAll('.qcard:not([disabled])').forEach(b => b.addEventListener('click', () => gotoHash('q' + b.dataset.q)));
  } else if (spec.type === 'context') {
    sec.innerHTML = headHTML(spec) + `<div class="context"><div class="illus">${spec.illus || QMOD[spec.q].illus}</div><div>
      <div class="qtag">${spec.kind}</div>
      <p class="story">${spec.story}</p>
      <div class="chips">${spec.chips.map(([t, c]) => `<span class="chip ${c || ''}">${sub(t)}</span>`).join('')}</div>
      <div class="roadmap">${spec.items.map(([lv, l, t]) => `<div><span class="lvl lvl-${lv}">${LEVEL[lv]}</span><span><b>${l}</b> ${sub(t)}</span></div>`).join('')}</div>
      <div class="trains">${sub(spec.trains)}</div></div></div>`;
  } else if (spec.type === 'item' || spec.type === 'circuit' || spec.type === 'play') {
    sec.innerHTML = headHTML(spec) + `<div class="item-grid"><div class="stage-col"><div class="toolbar"></div><div class="stage"></div><div class="charts"></div></div><aside class="side-col"></aside></div>`;
  } else if (spec.type === 'table') {
    sec.innerHTML = `<div class="slide-head"><span class="qtag">Para o professor</span><h1>Tabela de conferência</h1></div><div class="tablewrap"></div>`;
  }
  DECK.el.appendChild(sec);
}

/* inicializa o simulador do slide só quando ele aparece (precisa de tamanho real) */
function ensureSim(spec) {
  if (spec.sim || !spec.circuit) return;
  const stage = spec.el.querySelector('.stage');
  const first = spec.steps ? spec.steps[0].scene || {} : {};
  spec.sim = new Sim(stage, spec.circuit, { params: Object.assign({}, spec.circuit.defaults, spec.params || first.params || {}), power: spec.type === 'circuit' ? false : true });
  makeToolbar(spec.el.querySelector('.toolbar'), spec.sim, { hide: spec.circuit.zoomComp ? [] : ['zoom'] });
  const kinds = spec.chartKinds || spec.circuit.charts || ((spec.circuit.zener || spec.circuit.zeners) ? ['iv', 'll', 'res', 'sankey'] : ['sankey']);
  spec.charts = new ChartRow(spec.el.querySelector('.charts'), spec.sim, kinds, spec.chartTitles);
  spec.sim.on((ev) => { refreshLive(spec); if (ev === 'cta' && spec.type === 'circuit' && spec.step === 0) next(); });
  if (spec.type === 'play') buildPlay(spec);
}

/* ---------- etapas ---------- */
function renderStep(spec) {
  const side = spec.el.querySelector('.side-col'), st = spec.steps[spec.step], sim = spec.sim;
  sim.setScene(st.scene || {});
  const n = spec.steps.length;
  let h = '';
  if (spec.enun) h += `<div class="enun">${spec.enun}</div>`;
  h += `<div class="stepnav"><span>Etapa ${spec.step + 1} de ${n}</span><div class="dots">${spec.steps.map((_, k) => `<i class="${k < spec.step ? 'done' : k === spec.step ? 'cur' : ''}" data-k="${k}" title="Etapa ${k + 1}"></i>`).join('')}</div></div>`;
  h += `<div class="step"><h3>${sub(st.t)}</h3>${st.p ? `<p>${md(st.p)}</p>` : ''}<div class="eqs"></div>`;
  if (st.callout) h += `<div class="callout ${st.callout.k}"><span class="ct">${st.callout.t}</span>${md(st.callout.x)}</div>`;
  if (st.html) h += `<div class="xhtml">${typeof st.html === 'function' ? st.html() : st.html}</div>`;
  if (st.widget) h += `<div class="widget"></div>`;
  if (st.live) h += `<div class="live"></div>`;
  h += `</div>`;
  if (st.result) h += `<div class="result"><h4>Resultado</h4><dl></dl></div>`;
  side.innerHTML = h;
  side.querySelectorAll('.dots i').forEach(d => d.addEventListener('click', () => { spec.step = +d.dataset.k; renderStep(spec); updateChrome(); }));
  if (st.widget) buildWidget(side.querySelector('.widget'), st.widget, spec);
  refreshLive(spec, true);
  side.scrollTop = 0;
}
function refreshLive(spec, full) {
  if (!spec.steps && spec.type !== 'play') return;
  const side = spec.el.querySelector('.side-col'), sim = spec.sim;
  if (spec.type === 'play') { const lv = side.querySelector('.live'); if (lv) lv.innerHTML = spec.live(sim.sol, sim.p); syncControls(spec); return; }
  const st = spec.steps[spec.step]; if (!st) return;
  if (full || st.live || st.widget) {
    const eq = side.querySelector('.eqs');
    if (eq) { eq.innerHTML = (st.eq || []).map(f => `<div>${katexHTML(f(sim.sol, sim.p, sim), true)}</div>`).join(''); fitEqs(eq); }
  }
  const lv = side.querySelector('.live'); if (lv && st.live) lv.innerHTML = st.live(sim.sol, sim.p);
  const rs = side.querySelector('.result dl');
  if (rs && st.result) rs.innerHTML = st.result(sim.sol, sim.p).map(([k, v]) => `<dt>${sub(k)}</dt><dd${String(v).replace(/<[^>]+>/g, '').length > 24 ? ' class="long"' : ''}>${sub(v)}</dd>`).join('');
  side.querySelectorAll('[data-sync]').forEach(f => f._sync && f._sync());
}
function buildWidget(host, w, spec) {
  const sim = spec.sim;
  if (w.type === 'seg') {
    // opção = [valor, rótulo]; sem w.param, o valor é um objeto com vários parâmetros
    host.innerHTML = (w.label ? `<label><span>${sub(w.label)}</span></label>` : '') + `<div class="seg">${w.options.map(([v, l], k) => `<button type="button" data-k="${k}">${sub(l)}</button>`).join('')}</div>`;
    const asObj = v => w.param ? { [w.param]: v } : v;
    const isOn = v => { const o = asObj(v); return Object.keys(o).every(k => same(sim.p[k], o[k])); };
    const sync = () => host.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', isOn(w.options[+b.dataset.k][0]) ? 'true' : 'false'));
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (w.resetDamage) { sim.damage = {}; sim.failures = []; sim.thermalReset(); sim.showFail(); } sim.set(asObj(w.options[+b.dataset.k][0])); sync(); }));
    host.dataset.sync = 1; host._sync = sync; sync();
  } else if (w.type === 'slider') {
    const id = 'w-' + spec.hash + '-' + w.param;
    host.innerHTML = `<label for="${id}"><span>${sub(w.label || 'Arraste ' + (w.param === 'RL' ? 'R_L' : w.param))}</span><output></output></label><input type="range" id="${id}" min="${w.min}" max="${w.max}" step="${w.step}">${marksHTML(w)}`;
    const inp = host.querySelector('input'), out = host.querySelector('output');
    inp.value = sim.p[w.param]; out.textContent = w.fmt(+inp.value);
    inp.addEventListener('input', () => { out.textContent = w.fmt(+inp.value); sim.set({ [w.param]: +inp.value }); });
    host.dataset.sync = 1; host._sync = () => { if (document.activeElement !== inp) { inp.value = sim.p[w.param]; out.textContent = w.fmt(+sim.p[w.param]); } };
  } else if (w.type === 'action') {
    host.innerHTML = `<button type="button" class="bigbtn">${sub(w.label)}</button>`;
    host.querySelector('button').addEventListener('click', () => w.run(sim));
  } else if (w.type === 'toggle') {
    host.innerHTML = `<button type="button" class="bigbtn"></button>`;
    const b = host.querySelector('button');
    const sync = () => { const isA = sim.p[w.param] === w.a; b.textContent = isA ? w.la : w.lb; b.setAttribute('aria-pressed', isA ? 'true' : 'false'); };
    b.addEventListener('click', () => { sim.set({ [w.param]: sim.p[w.param] === w.a ? w.b : w.a }); sync(); });
    host.dataset.sync = 1; host._sync = sync; sync();
  }
}

/* marcas sob o slider: duas marcas próximas ficam "de costas" (uma termina e a outra
   começa no próprio risco); as das pontas não vazam do controle */
function marksHTML(w) {
  const ms = (w.marks || []).map(m => ({ m, pos: (m.v - w.min) / (w.max - w.min) * 100 })).sort((a, b) => a.pos - b.pos);
  ms.forEach((x, k) => { x.cls = x.pos < 14 ? 'l' : x.pos > 86 ? 'r' : ''; });
  for (let k = 1; k < ms.length; k++) if (ms[k].pos - ms[k - 1].pos < 26) { ms[k - 1].cls = 'r'; ms[k].cls = 'l'; }
  const spans = ms.map(({ m, pos, cls }) => `<span class="${cls}" style="left:${pos}%">${m.text ? sub(m.text) : sub(m.label) + ' = ' + (w.mfmt || w.fmt)(m.v)}</span>`);
  return `<div class="marks">${spans.join('')}</div>`;
}

/* equação mais larga que a coluna: reduz a fonte só daquela linha */
function fitEqs(host, again) {
  const floor = window.innerWidth < 600 ? 0.5 : 0.62;
  host.querySelectorAll(':scope > div').forEach(d => {
    d.style.fontSize = '';
    const k = d.clientWidth / (d.scrollWidth || 1);
    if (k < 0.995) d.style.fontSize = Math.max(floor, k * 0.98) * 100 + '%';
  });
  // as fontes do KaTeX podem terminar de carregar depois: confere de novo
  if (!again) setTimeout(() => fitEqs(host, true), 350);
}
window.addEventListener('resize', () => { const s = DECK.slides[DECK.i]; if (s && s.el) s.el.querySelectorAll('.eqs').forEach(fitEqs); });

/* comparação que também funciona para listas (ex.: estado dos pinos do driver) */
function same(a, b) { return a === b || (typeof a === 'object' && a && JSON.stringify(a) === JSON.stringify(b)); }
/* opção de um seletor: valor simples (com c.param) ou objeto com vários parâmetros */
function optObj(c, v) { return c.param ? { [c.param]: v } : v; }

/* ---------- slide "Mexa você" ---------- */
function buildPlay(spec) {
  const side = spec.el.querySelector('.side-col'), sim = spec.sim;
  sim.setScene({ params: spec.params });
  let h = `<div class="enun">${spec.challenge}</div><div class="live"></div>`;
  spec.controls.forEach((c, k) => {
    const id = `pl-${spec.hash}-${k}`;
    if (c.type === 'slider' || c.type === 'e12') h += `<div class="widget"><label for="${id}"><span>${sub(c.label)}</span><output></output></label><input type="range" id="${id}" data-k="${k}"></div>`;
    else h += `<div class="widget"><label><span>${sub(c.label)}</span></label><div class="seg" data-k="${k}">${c.options.map(([v, l], j) => `<button type="button" data-j="${j}">${sub(l)}</button>`).join('')}</div></div>`;
  });
  h += `<button type="button" class="bigbtn" id="pl-reset-${spec.hash}">${spec.resetLabel || 'Restaurar valores iniciais'}</button>`;
  side.innerHTML = h;
  spec.controls.forEach((c, k) => {
    if (c.type === 'slider' || c.type === 'e12') {
      const inp = side.querySelector(`input[data-k="${k}"]`);
      if (c.type === 'e12') { c.list = e12List(c.min, c.max); inp.min = 0; inp.max = c.list.length - 1; inp.step = 1; }
      else { inp.min = c.min; inp.max = c.max; inp.step = c.step; }
      inp.addEventListener('input', () => { const v = c.type === 'e12' ? c.list[+inp.value] : +inp.value; sim.set({ [c.param]: v }); });
    } else {
      side.querySelectorAll(`.seg[data-k="${k}"] button`).forEach(b => b.addEventListener('click', () => sim.set(optObj(c, c.options[+b.dataset.j][0]))));
    }
  });
  side.querySelector('.bigbtn').addEventListener('click', () => { sim.damage = {}; sim.failures = []; sim.thermalReset(); sim.showFail(); sim.set(Object.assign({}, spec.params)); });
  syncControls(spec);
}
function syncControls(spec) {
  const side = spec.el.querySelector('.side-col'), sim = spec.sim;
  spec.controls.forEach((c, k) => {
    if (c.type === 'slider' || c.type === 'e12') {
      const inp = side.querySelector(`input[data-k="${k}"]`); if (!inp) return;
      const v = sim.p[c.param];
      if (document.activeElement !== inp) inp.value = c.type === 'e12' ? Math.max(0, c.list.findIndex(x => x >= v * 0.999)) : v;
      inp.closest('.widget').querySelector('output').textContent = c.fmt(v);
    } else side.querySelectorAll(`.seg[data-k="${k}"] button`).forEach(b => { const o = optObj(c, c.options[+b.dataset.j][0]); b.setAttribute('aria-pressed', Object.keys(o).every(q => same(sim.p[q], o[q])) ? 'true' : 'false'); });
  });
}

/* ---------- tabela de conferência ---------- */
function buildTable(spec) {
  const host = spec.el.querySelector('.tablewrap');
  let h = `<table class="conf"><thead><tr><th>Item</th><th>Grandeza</th><th>Valor calculado</th><th>Observação</th></tr></thead><tbody>`;
  for (const q of QUESTIONS) {
    const mod = QMOD[q.n]; if (!mod || !mod.conf) continue;
    h += `<tr class="qrow"><td colspan="4">Questão ${q.n} · ${q.title}</td></tr>`;
    h += mod.conf().map(([it, k, v, o]) => `<tr><td>${it})</td><td>${sub(k)}</td><td class="v">${sub(v)}</td><td>${sub(o)}</td></tr>`).join('');
  }
  h += `</tbody></table><p class="refs"><b>Modelos:</b> Zener ideal (fonte V<sub>Z</sub>; r<sub>z</sub> só quando indicado; 0,7 V em direta), LED com V<sub>F</sub> fixo, resistores da série E12. Os valores são calculados pelo mesmo código que move as animações.<br><b>Referências:</b> Boylestad &amp; Nashelsky, <i>Dispositivos Eletrônicos e Teoria de Circuitos</i>, 11ª ed. — Cap. 1, Seções 1.15 (Diodos Zener) e 1.16 (LEDs); Cap. 2, Seção 2.11 (regulador Zener). R. Kerschbaumer, <i>Apostila de Eletrônica Básica</i> (IFC Luzerna) — Aula 6, Seções 6.7 a 6.9. Material de apoio <i>Eletrônica Analógica</i>, v. 2 — Cap. 11, Seção 11.2. Dados de catálogo do 1N4744A (V<sub>Z</sub> = 15 V, Z<sub>ZT</sub> = 14 Ω, Z<sub>ZK</sub> = 700 Ω @ 0,25 mA).</p>`;
  host.innerHTML = h;
}

/* ---------- navegação ---------- */
function activate(i, step = 0, fromHash) {
  const old = DECK.slides[DECK.i];
  if (old && old.el) old.el.classList.remove('active');
  DECK.i = clamp(i, 0, DECK.slides.length - 1);
  const spec = DECK.slides[DECK.i];
  spec.el.classList.add('active');
  ensureSim(spec);
  if (spec.steps) { spec.step = step < 0 ? spec.steps.length - 1 : Math.min(step, spec.steps.length - 1); renderStep(spec); }
  if (spec.type === 'table') buildTable(spec);
  if (spec.type === 'play') { syncControls(spec); refreshLive(spec); }
  if (!fromHash && spec.hash && location.hash !== '#' + spec.hash) { DECK.ignoreHash = true; location.hash = spec.hash; }
  updateChrome(); renderNotes(); MENU.sync();
  if (spec.sim) spec.sim._lastW = 0;
}
function next() {
  const s = DECK.slides[DECK.i];
  if (s.steps && s.step < s.steps.length - 1) { s.step++; renderStep(s); updateChrome(); return; }
  if (DECK.i < DECK.slides.length - 1) activate(DECK.i + 1, 0);
}
function prev() {
  const s = DECK.slides[DECK.i];
  if (s.steps && s.step > 0) { s.step--; renderStep(s); updateChrome(); return; }
  if (DECK.i > 0) activate(DECK.i - 1, -1);
}
function gotoHash(h) { const k = DECK.slides.findIndex(s => s.hash === h); if (k >= 0) activate(k, 0, false); }
function updateChrome() {
  const s = DECK.slides[DECK.i];
  let where = 'Capa';
  if (s.q) where = `Questão ${s.q} · ` + (s.type === 'context' ? 'situação real' : s.type === 'circuit' ? 'circuito' : s.type === 'play' ? 'mexa você' : `item ${s.letter})`) + (s.steps ? ` · etapa ${s.step + 1}/${s.steps.length}` : '');
  if (s.type === 'table') where = 'Tabela de conferência';
  document.getElementById('where').textContent = where;
  const tot = DECK.slides.length, frac = s.steps ? s.step / s.steps.length : 0;
  document.getElementById('prog').style.width = ((DECK.i + frac) / (tot - 1 || 1) * 100) + '%';
}

/* ---------- menu (tecla M) ---------- */
const MENU = (() => {
  let ov;
  function build() {
    ov = document.getElementById('menuOv');
    const grid = ov.querySelector('.menu-grid');
    grid.innerHTML = QUESTIONS.map(q => {
      const sl = DECK.slides.map((s, k) => [s, k]).filter(([s]) => s.q === q.n);
      const label = s => s.type === 'context' ? 'Situação real' : s.type === 'circuit' ? 'Circuito' : s.type === 'play' ? 'Mexa você' : `${s.letter}) ${LEVEL[s.level].split(' · ')[1]}`;
      const rows = sl.length ? sl.map(([s, k]) => `<button type="button" data-k="${k}">${label(s)}</button>`).join('')
        : ['Situação real', 'Circuito', 'a) Conceitual', 'b) Cálculo', 'c) Análise', 'd) Desafio', 'Mexa você'].map(t => `<button type="button" disabled>${t}</button>`).join('');
      return `<div class="menu-q"><h3>Questão ${q.n} · ${q.kind}${sl.length ? '' : ' <small>(em construção)</small>'}</h3>${rows}</div>`;
    }).join('') + `<div class="menu-q"><h3>Geral</h3><button type="button" data-k="0">Capa</button><button type="button" data-k="${DECK.slides.length - 1}">Tabela de conferência</button></div>`;
    grid.querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', () => { activate(+b.dataset.k, 0); close(); }));
    ov.querySelector('.xbtn').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  }
  function toggle() { if (!ov) build(); ov.classList.toggle('on'); sync(); }
  function close() { if (ov) ov.classList.remove('on'); }
  function sync() { if (!ov) return; ov.querySelectorAll('button[data-k]').forEach(b => b.classList.toggle('cur', +b.dataset.k === DECK.i)); }
  return { toggle, close, sync, isOpen: () => ov && ov.classList.contains('on') };
})();

/* ---------- notas do professor (tecla N) ---------- */
function renderNotes() {
  const box = document.getElementById('notes'), s = DECK.slides[DECK.i], n = s.notes;
  if (!n) { box.innerHTML = '<b>Notas do professor</b><p>Use → para avançar etapa por etapa. Cada etapa reconfigura o circuito à esquerda.</p>'; return; }
  box.innerHTML = `<b>Notas do professor</b> · <span class="time">tempo sugerido: ${n.tempo}</span>` +
    (n.perguntas && n.perguntas.length ? `<h4>Perguntas para a turma</h4><ul>${n.perguntas.map(x => `<li>${sub(x)}</li>`).join('')}</ul>` : '') +
    (n.erros && n.erros.length ? `<h4>Erros comuns</h4><ul>${n.erros.map(x => `<li>${sub(x)}</li>`).join('')}</ul>` : '') +
    (n.dica ? `<h4>Dica</h4><p>${sub(n.dica)}</p>` : '');
}
function toggleNotes() { document.getElementById('notes').classList.toggle('on'); }

/* ---------- teclado ---------- */
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tg = e.target, tag = tg && tg.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.key === 'Escape') tg.blur(); return; }
  if (JZ.isOpen() || BigChart.isOpen()) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); if (tag === 'BUTTON') tg.blur(); next(); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
  else if (k === 'm' || k === 'M') MENU.toggle();
  else if (k === 'n' || k === 'N') toggleNotes();
  else if (k === 'Escape') { MENU.close(); document.getElementById('notes').classList.remove('on'); }
  else if (k === 'Home') activate(0);
});
window.addEventListener('hashchange', () => {
  if (DECK.ignoreHash) { DECK.ignoreHash = false; return; }
  const h = location.hash.slice(1); const k = DECK.slides.findIndex(s => s.hash === h);
  if (k >= 0 && k !== DECK.i) activate(k, 0, true);
});

/* ---------- laço de animação (só o slide visível trabalha) ---------- */
let lastNow = performance.now();
function loop(now) {
  const dt = (now - lastNow) / 1000; lastNow = now;
  const s = DECK.slides[DECK.i];
  if (s && s.sim && !document.hidden) { s.sim.frame(dt); s.charts.draw(now / 1000); }
  BigChart.draw(now / 1000);
  requestAnimationFrame(loop);
}

/* ---------- módulos de questões registrados ---------- */
const QMOD = {};
function boot() {
  DECK.el = document.getElementById('deck');
  [typeof Q1 !== 'undefined' && Q1, typeof Q2 !== 'undefined' && Q2, typeof Q3 !== 'undefined' && Q3, typeof Q4 !== 'undefined' && Q4, typeof Q5 !== 'undefined' && Q5, typeof Q6 !== 'undefined' && Q6]
    .forEach((m, i) => { if (m) QMOD[i + 1] = m; });
  DECK.slides = [{ type: 'cover', hash: 'capa' }];
  for (const n of Object.keys(QMOD)) DECK.slides.push(...QMOD[n].slides);
  DECK.slides.push({ type: 'table', hash: 'conferencia' });
  DECK.slides.forEach(buildSlide);
  document.getElementById('bPrev').addEventListener('click', prev);
  document.getElementById('bNext').addEventListener('click', next);
  document.getElementById('bMenu').addEventListener('click', MENU.toggle);
  document.getElementById('bNotes').addEventListener('click', toggleNotes);
  const h = location.hash.slice(1); const k = DECK.slides.findIndex(s => s.hash === h);
  activate(k >= 0 ? k : 0, 0, true);
  requestAnimationFrame(loop);
}

boot();
