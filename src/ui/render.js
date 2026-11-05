// Renderizador do mapa (canvas 2D).
import { NATIONS, NATION_BY_ID } from '../data/nations.js';
import { UNITS } from '../engine/defs.js';
import { stackDomain } from '../engine/state.js';
import { rel, stackCount, stackHP, stackSpeed, stackPos } from '../engine/sim.js';
import { stackVisible } from '../engine/vision.js';
import { UNIT_ICON, RES_ICON } from './icons.js';
import { unitArtSVG, UNIT_PNG, unitPngUrl } from './unitart.js';
import { flagImage } from './flags.js';

const RES_COLOR = { graos: '#d8c06a', peixe: '#7fa9bd', ferro: '#8e939b', madeira: '#8d6a43', carvao: '#4a4a4a', petroleo: '#6b3b2a', gas: '#c8645a' };
// mistura duas cores #rrggbb (t = peso da segunda)
const mix = (a, b, t) => '#' + [1, 3, 5].map(j => Math.round(parseInt(a.substr(j, 2), 16) * (1 - t) + parseInt(b.substr(j, 2), 16) * t).toString(16).padStart(2, '0')).join('');
export class MapView {
  constructor(canvas, M) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.M = M;
    this.k = 0.2; this.ox = 0; this.oy = 0; this.dpr = Math.min(1.5, window.devicePixelRatio || 1); this.lastZoom = 0;
    this.mode = 'padrao'; this.sel = null; this.selProv = -1; this.hover = -1; this.preview = null; this.airMode = null;
    this.paths = M.provinces.map(p => { const P = new Path2D(); for (const poly of p.poly) for (const r of poly) { P.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) P.lineTo(r[i], r[i + 1]); P.closePath(); } return P; });
    this.allLand = new Path2D(); this.paths.forEach(p => this.allLand.addPath(p));
    this.buildEdges(); this.buildRoads();
    this.glyphs = this.makeGlyphs();
    this.stamp = {}; for (const k of ['montanha', 'colina', 'floresta', 'deserto', 'vila', 'cidade', 'capital']) { const i = new Image(); i.src = `assets/map/${k}.png`; i.onload = () => { this.cacheKey = this.vcKey = null; }; this.stamp[k] = i; }
    this.resImg = {}; for (const r of Object.keys(RES_ICON)) { const i = new Image(); i.src = `assets/res/${r}.png`; this.resImg[r] = i; }
    this.tex = {}; for (const t of ['papel', 'mar']) { const i = new Image(); i.src = `assets/map/${t}.jpg`; i.onload = () => { this.tex[t] = this.g.createPattern(i, 'repeat'); this.halo = null; this.cacheKey = this.vcKey = null; }; }
    this.noise = this.makeNoise(); this.wood = this.makeWood();
    this.artImg = {};
    this.unitImg = {}; for (const [u, s] of Object.entries(UNIT_ICON)) { const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace(' xmlns="http://www.w3.org/2000/svg"', '').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" color="#f3ead6" ').replace(/currentColor/g, '#f3ead6')); this.unitImg[u] = i; }
    this.resize();
  }
  // arestas compartilhadas entre províncias (para fronteiras de nação)
  buildEdges() {
    const key = (x, y) => Math.round(x * 2) + ',' + Math.round(y * 2);
    const map = new Map();
    this.M.provinces.forEach((p, id) => { for (const poly of p.poly) for (const r of poly) for (let i = 0; i + 3 < r.length; i += 2) {
      const a = key(r[i], r[i + 1]), b = key(r[i + 2], r[i + 3]); const k = a < b ? a + '|' + b : b + '|' + a;
      const e = map.get(k); if (e) { if (e.p2 === undefined && e.p1 !== id) e.p2 = id; } else map.set(k, { p1: id, x1: r[i], y1: r[i + 1], x2: r[i + 2], y2: r[i + 3] });
    } });
    this.edges = [...map.values()].filter(e => e.p2 !== undefined);
  }
  // estradas = arestas terra-terra do grafo de movimento (só onde o meio do trecho é terra)
  buildRoads() {
    const M = this.M; this.roads = new Path2D(); this.roadEdges = [];
    for (let a = 0; a < M.nL; a++) for (const { to: b } of M.adj[a]) {
      if (b <= a || !M.isLand(b)) continue; const A = M.nodes[a], B = M.nodes[b];
      if (!M.isLand(M.nodeAt((A.x + B.x) / 2, (A.y + B.y) / 2))) continue;
      this.roadEdges.push([a, b]); this.roads.moveTo(A.x, A.y); this.roads.lineTo(B.x, B.y);
    }
  }
  // mesa de madeira em volta do mapa (textura gerada na hora: veios horizontais com ruído)
  makeWood() {
    const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const d = g.createImageData(W, H);
    let seed = 3; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rows = Array.from({ length: H }, () => rnd()); const sm = rows.map((_, y) => (rows[(y + H - 1) % H] + rows[y] * 2 + rows[(y + 1) % H]) / 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const grain = Math.sin((y + Math.sin(x / 61) * 6 + Math.sin(x / 13) * 1.2) * 0.42) * 0.5 + 0.5;
      const v = 0.55 + sm[y] * 0.25 + grain * 0.18 + (rnd() - 0.5) * 0.06; const i = (y * W + x) * 4;
      d.data[i] = 120 * v + 20; d.data[i + 1] = 78 * v + 12; d.data[i + 2] = 44 * v + 6; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    // tábuas
    g.strokeStyle = 'rgba(30,18,8,.55)'; g.lineWidth = 2; for (let y = 0; y < H; y += 64) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
    return this.g.createPattern(c, 'repeat');
  }
  makeNoise() {
    // textura de aquarela (ruído fractal que se repete sem emenda)
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const d = g.createImageData(N, N);
    let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const oct = [[8, 0.5], [16, 0.25], [32, 0.15], [64, 0.1]].map(([n, w]) => ({ n, w, v: Array.from({ length: n * n }, rnd) }));
    const val = (o, x, y) => { const fx = x / N * o.n, fy = y / N * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; const at = (i, j) => o.v[((j % o.n) * o.n) + (i % o.n)]; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (const o of oct) v += val(o, x, y) * o.w; v = 165 + v * 90 + (rnd() - 0.5) * 14; const i = (y * N + x) * 4; d.data[i] = v; d.data[i + 1] = v * 0.94; d.data[i + 2] = v * 0.82; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); const pat = this.g.createPattern(c, 'repeat'); pat.setTransform && pat.setTransform(new DOMMatrix().scale(3.5)); return pat;
  }
  resize() {
    this.vcKey = null;
    const r = this.c.getBoundingClientRect(); this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * this.dpr); this.c.height = Math.round(r.height * this.dpr);
    this.minK = Math.min(this.w / this.M.W, this.h / this.M.H) * 0.9;
    this.clamp();
  }
  clamp() {
    this.k = Math.max(this.minK, Math.min(4, this.k));
    const mw = this.M.W * this.k, mh = this.M.H * this.k;
    this.ox = mw < this.w ? (this.w - mw) / 2 : Math.min(0, Math.max(this.w - mw, this.ox));
    this.oy = mh < this.h ? (this.h - mh) / 2 : Math.min(0, Math.max(this.h - mh, this.oy));
  }
  toWorld(sx, sy) { return [(sx - this.ox) / this.k, (sy - this.oy) / this.k]; }
  toScreen(x, y) { return [x * this.k + this.ox, y * this.k + this.oy]; }
  zoomAt(sx, sy, f) { const [x, y] = this.toWorld(sx, sy); this.k *= f; this.lastZoom = performance.now(); this.clamp(); this.ox = sx - x * this.k; this.oy = sy - y * this.k; this.clamp(); }
  centerOn(x, y, k) { if (k) this.k = k; this.clamp(); this.ox = this.w / 2 - x * this.k; this.oy = this.h / 2 - y * this.k; this.clamp(); }

  provColor(S, i, vis) {
    const sp = S.provinces[i], P = S.opts.player, o = sp.owner;
    if (this.mode === 'politico') return o === 'reb' ? '#6b6258' : NATION_BY_ID[o].color;
    if (this.mode === 'recursos') return RES_COLOR[this.M.provinces[i].res];
    if (this.mode === 'moral') { if (o !== P) return '#a9a190'; const m = sp.morale / 100; return `hsl(${Math.round(m * 110)},45%,${42 + m * 18}%)`; }
    if (o === P) return '#dfe9d3';
    if (o === 'reb') return '#7a6d60';
    const r = rel(S, P, o);
    if (r === 'guerra') return '#cf9a8f';
    // zoom afastado: cada nação com a sua cor (suavizada), como num mapa político
    if (this.far) return mix(NATION_BY_ID[o].color, '#e6dcc4', 0.45);
    if (r === 'aliado') return '#a9bfd2';
    if (r === 'passagem') return '#c6c7a6';
    return '#c7c3b6';
  }

  draw(S, vis, frac = 0) {
    const g = this.g, M = this.M, k = this.k, P = S.opts.player;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // mar
    g.fillStyle = this.wood; g.fillRect(0, 0, this.w, this.h);
    g.setTransform(this.dpr * k, 0, 0, this.dpr * k, this.dpr * this.ox, this.dpr * this.oy);
    // o mapa é uma folha sobre a mesa: sombra e mar de fundo
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 24 * this.dpr; g.shadowOffsetY = 6 * this.dpr; g.fillStyle = '#4b7d8a'; g.fillRect(0, 0, M.W, M.H); g.restore();
    this.far = k < 0.3;
    const key = (this.far ? 'F' : 'N') + this.mode + '|' + P + '|' + S.provinces.map(p => this.mode === 'moral' ? Math.round(p.morale / 5) : p.owner).join(',') + '|' + (S.opts.fog ? vis.nodes.size + ':' + [...vis.nodes].reduce((a, b) => a + b * 7, 0) : '') + '|' + Object.entries(S.rel).join() + '|' + S.nations[P].coalition + '|' + S.provinces.reduce((a, p) => a + (p.b.ferrovia ? 1 : 0), 0);
    if (key !== this.groupKey) this.buildGroups(S, vis, key);
    if (k < 0.42) {
      // zoom afastado: usa um bitmap em cache da camada estática
      if (key !== this.cacheKey) {
        const CK = 0.42; if (!this.cache) { this.cache = document.createElement('canvas'); this.cache.width = Math.ceil(this.M.W * CK); this.cache.height = Math.ceil(this.M.H * CK); }
        const cg = this.cache.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, this.cache.width, this.cache.height); cg.setTransform(CK, 0, 0, CK, 0, 0);
        if (this.tex.mar) { cg.fillStyle = this.tex.mar; cg.fillRect(0, 0, M.W, M.H); }
        this.drawBase(cg, CK, S, vis); this.cacheKey = key;
      }
      g.drawImage(this.cache, 0, 0, M.W, M.H);
    } else {
      // zoom aproximado: a camada estática é desenhada num bitmap do tamanho da tela (+ margem) e só é refeita
      // quando a vista sai da margem, o zoom assenta num valor novo ou o estado do mapa muda
      const mw = this.w * 0.3, mh = this.h * 0.3, d = this.dpr;
      const [vx0, vy0] = this.toWorld(0, 0), [vx1, vy1] = this.toWorld(this.w, this.h);
      const c = this.vc, inside = c && vx0 >= c.x0 && vy0 >= c.y0 && vx1 <= c.x1 && vy1 <= c.y1;
      const zoomSettled = performance.now() - this.lastZoom > 160;
      if (key !== this.vcKey || !inside && (zoomSettled || !c) || c.k !== k && zoomSettled) {
        if (!this.vcCanvas) this.vcCanvas = document.createElement('canvas');
        const cv = this.vcCanvas, W = Math.ceil((this.w + 2 * mw) * d), H = Math.ceil((this.h + 2 * mh) * d);
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        const cg = cv.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, H);
        cg.setTransform(d * k, 0, 0, d * k, d * (this.ox + mw), d * (this.oy + mh));
        if (this.tex.mar) { cg.fillStyle = this.tex.mar; cg.fillRect(0, 0, M.W, M.H); }
        this.drawBase(cg, k, S, vis);
        const [x0, y0] = this.toWorld(-mw, -mh), [x1, y1] = this.toWorld(this.w + mw, this.h + mh);
        this.vc = { k, x0, y0, x1, y1 }; this.vcKey = key;
      }
      const v = this.vc; g.drawImage(this.vcCanvas, v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    }
    // província selecionada / hover
    if (this.hover >= 0 && this.hover < M.provinces.length) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(this.paths[this.hover], 'evenodd'); }
    if (this.selProv >= 0) { g.strokeStyle = '#f1c255'; g.lineWidth = 3 / k; g.stroke(this.paths[this.selProv]); }
    // raio de artilharia/alcance aéreo do selecionado
    const sel = this.sel && S.stacks.find(s => s.id === this.sel);
    if (sel && stackDomain(sel) === 'air') {
      const b = M.nodes[sel.base]; let r = 1e9; for (const u of Object.keys(sel.units)) r = Math.min(r, UNITS[u].range || 1e9);
      g.setLineDash([8 / k, 6 / k]); g.strokeStyle = 'rgba(255,240,200,.7)'; g.lineWidth = 1.5 / k; g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    // névoa: tudo fora do alcance de visão escurece; em volta das suas tropas e províncias fica um círculo claro de borda suave
    if (S.opts.fog && this.mode === 'padrao' && vis && vis.eyes) {
      // camada em meia resolução e só refeita quando a vista, a hora ou o que se vê muda (é borrada mesmo)
      const W = Math.ceil(this.c.width / 2), H = Math.ceil(this.c.height / 2); if (!this.fogC) this.fogC = document.createElement('canvas');
      const fc = this.fogC; if (fc.width !== W || fc.height !== H) { fc.width = W; fc.height = H; this.fogKey = null; }
      const fkey = this.ox.toFixed(1) + '|' + this.oy.toFixed(1) + '|' + k.toFixed(4) + '|' + S.hour + '|' + this.groupKey;
      if (fkey !== this.fogKey) { this.fogKey = fkey;
      const fg = fc.getContext('2d'); fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalCompositeOperation = 'source-over'; fg.clearRect(0, 0, W, H);
      fg.fillStyle = 'rgba(28,30,32,.34)'; fg.fillRect(0, 0, W, H); fg.globalCompositeOperation = 'destination-out';
      const d = this.dpr / 2;
      // províncias que você vê ficam totalmente claras; os círculos clareiam além delas (alcance das tropas)
      fg.save(); fg.setTransform(d * k, 0, 0, d * k, d * this.ox, d * this.oy); fg.fillStyle = '#000'; fg.fill(this.seenPath, 'evenodd'); fg.restore();
      for (const e of vis.eyes) {
        const [ex, ey] = this.toScreen(e.x, e.y), r = e.r * k * d * 1.15, x = ex * d, y = ey * d;
        if (x + r < 0 || y + r < 0 || x - r > W || y - r > H) continue;
        const gr = fg.createRadialGradient(x, y, r * 0.55, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        fg.fillStyle = gr; fg.beginPath(); fg.arc(x, y, r, 0, Math.PI * 2); fg.fill();
      }
      }
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fc, 0, 0, this.c.width, this.c.height); g.restore();
    }
    this.drawLabels(S, vis);
    if (!this.noStacks) this.drawStacks(S, vis, frac, sel);
    // prévia de rota
    if (this.preview && this.preview.length > 1) {
      g.setLineDash([10 / k, 7 / k]); g.strokeStyle = 'rgba(255,230,140,.95)'; g.lineWidth = 2.5 / k; g.beginPath();
      this.preview.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
    }
  }
  makeGlyphs() {
    const M = this.M; let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const out = [];
    for (const p of M.provinces) {
      const t = p.terrain; const n = { floresta: 3, montanha: 3, colina: 2, deserto: 2 }[t]; if (!n) continue;
      for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
        const a = rnd() * Math.PI * 2, r = 28 + rnd() * 50; const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (M.nodeAt(x, y) !== p.id) continue; out.push([t, x, y, 0.8 + rnd() * 0.5]); i++;
      }
    }
    return out;
  }
  drawStamps(g, k, clipView) {
    let x0 = -1e9, y0 = -1e9, x1 = 1e9, y1 = 1e9;
    if (clipView) { [x0, y0] = this.toWorld(-60, -60); [x1, y1] = this.toWorld(this.w + 60, this.h + 60); }
    const SZ = { montanha: 44, colina: 34, floresta: 36, deserto: 36 };
    for (const [t, x, y, s0] of (k > 1.2 ? this.glyphs : [])) { // terreno só bem de perto
      if (x < x0 || x > x1 || y < y0 || y > y1) continue; const im = this.stamp[t]; if (!im || !im.complete || !im.naturalWidth) continue;
      const w = SZ[t] * s0, h = w * im.naturalHeight / im.naturalWidth; g.drawImage(im, x - w / 2, y - h * 0.8, w, h);
    }
    for (const p of this.M.provinces) {
      if (!p.city || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const im = this.stamp[p.capital ? 'capital' : p.pop > 900000 ? 'cidade' : 'vila']; if (!im || !im.complete || !im.naturalWidth) continue;
      const w = (p.capital ? 26 : p.pop > 900000 ? 22 : 18) / Math.max(k, 0.45), h = w * im.naturalHeight / im.naturalWidth; g.drawImage(im, p.x + 10 / Math.max(k, 0.45), p.y - h * 0.75, w, h);
    }
  }
  drawTerrain(g, k) {
    if (!this.tp) {
      const tp = this.tp = { tree: new Path2D(), trunk: new Path2D(), mount: new Path2D(), hill: new Path2D(), dune: new Path2D() };
      for (const [t, x, y, s0] of this.glyphs) {
        const s = 7 * s0;
        if (t === 'floresta') { tp.tree.moveTo(x, y - s); tp.tree.lineTo(x + s * 0.6, y + s * 0.4); tp.tree.lineTo(x - s * 0.6, y + s * 0.4); tp.tree.closePath(); tp.trunk.moveTo(x, y + s * 0.4); tp.trunk.lineTo(x, y + s * 0.8); }
        else if (t === 'montanha') { tp.mount.moveTo(x - s * 1.1, y + s * 0.6); tp.mount.lineTo(x - s * 0.2, y - s * 0.9); tp.mount.lineTo(x + s * 0.4, y); tp.mount.lineTo(x + s * 0.7, y - s * 0.4); tp.mount.lineTo(x + s * 1.3, y + s * 0.6); }
        else if (t === 'colina') { tp.hill.moveTo(x - s * 0.8 * Math.cos(0.3), y + s * 0.4 - s * 0.8 * Math.sin(0.3)); tp.hill.arc(x, y + s * 0.4, s * 0.8, Math.PI * 1.1, Math.PI * 1.9); }
        else if (t === 'deserto') { for (let i = 0; i < 4; i++) { const cx = x + (i % 2) * s * 0.7, cy = y + (i >> 1) * s * 0.6; tp.dune.moveTo(cx + s * 0.12, cy); tp.dune.arc(cx, cy, s * 0.12, 0, Math.PI * 2); } }
      }
    }
    const tp = this.tp; g.save(); g.lineWidth = 1.1 / k * Math.min(1, k * 2.5); g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = 'rgba(70,90,55,.42)'; g.fill(tp.tree); g.strokeStyle = 'rgba(70,55,40,.4)'; g.stroke(tp.trunk);
    g.fillStyle = 'rgba(255,250,240,.25)'; g.fill(tp.mount); g.strokeStyle = 'rgba(80,60,40,.55)'; g.stroke(tp.mount);
    g.strokeStyle = 'rgba(90,70,45,.45)'; g.stroke(tp.hill); g.fillStyle = 'rgba(120,90,50,.35)'; g.fill(tp.dune);
    g.restore();
  }
  buildGroups(S, vis, key) {
    const M = this.M, P = S.opts.player; const groups = new Map(); const fog = new Path2D(), seen = new Path2D();
    for (let i = 0; i < M.provinces.length; i++) {
      const c = this.provColor(S, i, vis); if (!groups.has(c)) groups.set(c, new Path2D()); groups.get(c).addPath(this.paths[i]);
      if (vis && !vis.nodes.has(i)) fog.addPath(this.paths[i]); else seen.addPath(this.paths[i]);
    }
    const nb = new Path2D(), mb = new Path2D();
    for (const e of this.edges) { const a = S.provinces[e.p1].owner, b = S.provinces[e.p2].owner; if (a !== b) { nb.moveTo(e.x1, e.y1); nb.lineTo(e.x2, e.y2); if (a === P || b === P) { mb.moveTo(e.x1, e.y1); mb.lineTo(e.x2, e.y2); } } }
    const rails = new Path2D(); let nr = 0;
    for (const [a, b] of this.roadEdges) if (S.provinces[a].b.ferrovia && S.provinces[b].b.ferrovia) { const A = M.nodes[a], B = M.nodes[b]; rails.moveTo(A.x, A.y); rails.lineTo(B.x, B.y); nr++; }
    this.rails = nr ? rails : null;
    this.groups = groups; this.fogPath = fog; this.seenPath = seen; this.natBorder = nb; this.myBorder = mb; this.groupKey = key;
  }
  // mapa limpo: cores chapadas, linhas finas claras entre províncias, borda de nação discreta, mar liso com brilho na costa
  drawBase(g, k, S, vis) {
    const M = this.M;
    if (!this.halo) {
      const HK = 0.42, c = document.createElement('canvas'); c.width = Math.ceil(M.W * HK); c.height = Math.ceil(M.H * HK);
      const hg = c.getContext('2d'); hg.setTransform(HK, 0, 0, HK, 0, 0); hg.lineJoin = 'round';
      for (const [w, a] of [[46, .05], [28, .07], [14, .1]]) { hg.strokeStyle = `rgba(150,205,215,${a})`; hg.lineWidth = w / HK; hg.stroke(this.allLand); }
      this.halo = c;
    }
    g.fillStyle = '#2f5d69'; g.fillRect(0, 0, M.W, M.H);
    g.drawImage(this.halo, 0, 0, M.W, M.H);
    const fog = S.opts.fog && this.mode === 'padrao';
    for (const [c, path] of this.groups) { g.fillStyle = c; g.fill(path, 'evenodd'); }
    g.strokeStyle = this.far ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.55)'; g.lineWidth = 0.9 / k; g.stroke(this.allLand);
    if (this.rails && !this.far) { g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 1.2 / k; g.setLineDash([3 / k, 3 / k]); g.stroke(this.rails); g.setLineDash([]); }
    if (!this.far) this.drawStamps(g, k, g === this.g);
    g.strokeStyle = 'rgba(55,50,45,.75)'; g.lineWidth = 1.8 / k; g.stroke(this.natBorder);
    g.strokeStyle = 'rgba(60,110,50,.9)'; g.lineWidth = 2.4 / k; g.stroke(this.myBorder);
    g.strokeStyle = 'rgba(30,45,50,.55)'; g.lineWidth = 1 / k; g.stroke(this.allLand);
  }
  drawLabels(S, vis) {
    const g = this.g, M = this.M, k = this.k, P = S.opts.player;
    // nomes das nações (centro das províncias)
    if (!this.natCenters || this.natCentersH !== S.hour) {
      const acc = {}; S.provinces.forEach((sp, i) => { const a = acc[sp.owner] || (acc[sp.owner] = { x: 0, y: 0, n: 0, x0: 1e9, x1: -1e9 }); const nd = M.nodes[i]; a.x += nd.x; a.y += nd.y; a.n++; a.x0 = Math.min(a.x0, nd.x); a.x1 = Math.max(a.x1, nd.x); });
      this.natCenters = acc; this.natCentersH = S.hour;
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // zoom afastado: nome grande da nação sobre o território (some aos poucos ao aproximar)
    const fade = Math.max(0, Math.min(1, (0.45 - k) / 0.1));
    if (fade > 0) { g.save(); g.globalAlpha = fade; g.lineJoin = 'round';
      const placed = []; // retângulos já usados (evita nomes encavalados; maiores primeiro)
      for (const [id, a] of Object.entries(this.natCenters).sort((p, q) => (q[0] === P) - (p[0] === P) || q[1].n - p[1].n)) {
        if (id === 'reb' || a.n < 2) continue;
        const name = NATION_BY_ID[id].name.toUpperCase().split('').join(String.fromCharCode(8202));
        let px = Math.min(30, 11 + Math.sqrt(a.n) * 3) * Math.max(0.65, Math.min(1, k / 0.25));
        g.font = `700 ${px / k}px "IM Fell English SC", Georgia, serif`;
        const span = Math.max(a.x1 - a.x0 + 120, 260); let tw = g.measureText(name).width;
        if (tw > span) { px = Math.max(10, px * span / tw); g.font = `700 ${px / k}px "IM Fell English SC", Georgia, serif`; tw = g.measureText(name).width; }
        const x = a.x / a.n, y = a.y / a.n + 22 / k, hw = tw / 2 + 4 / k, hh = px * 0.6 / k;
        if (placed.some(r => Math.abs(r.x - x) < r.hw + hw && Math.abs(r.y - y) < r.hh + hh)) continue;
        placed.push({ x, y, hw, hh });
        g.strokeStyle = 'rgba(250,244,228,.8)'; g.lineWidth = 3.5 / k; g.strokeText(name, x, y);
        g.fillStyle = id === P ? 'rgba(30,62,26,.92)' : 'rgba(52,36,22,.85)'; g.fillText(name, x, y);
      }
      g.restore(); }
    // placas nas capitais (bandeira + nome)
    const sx = 1 / k;
    for (const n of Object.values(S.nations)) {
      if (!n.alive || n.rebel || n.capital < 0) continue;
      const nd = M.nodes[n.capital]; const fs = 11 * sx;
      if (k < 0.12) continue;
      g.font = `600 ${fs}px Oswald, sans-serif`;
      const label = NATION_BY_ID[n.id].name.toUpperCase(); const tw = g.measureText(label).width;
      const x = nd.x, y = nd.y + 26 * sx;
      if (k >= 0.4) { g.fillStyle = 'rgba(28,24,20,.82)'; g.fillRect(x - tw / 2 - 6 * sx, y - 8 * sx, tw + 12 * sx, 16 * sx);
        g.fillStyle = n.id === P ? '#cfe6b8' : '#efe6d2'; g.fillText(label, x, y + 0.5 * sx); }
      // bandeira redonda: em cima da capital no zoom afastado, ao lado da placa quando aproxima (não cobre as tropas)
      const fx = k >= 0.4 ? x - tw / 2 - 15 * sx : x, fy = k >= 0.4 ? y : y - 22 * sx;
      const fi = flagImage(n.id); if (fi.complete && fi.naturalWidth) { g.save(); g.beginPath(); g.arc(fx, fy, 9 * sx, 0, Math.PI * 2); g.closePath(); g.fillStyle = '#1c1814'; g.fill(); g.clip(); g.drawImage(fi, fx - 13 * sx, fy - 8.5 * sx, 26 * sx, 17 * sx); g.restore(); g.strokeStyle = '#1c1814'; g.lineWidth = 2 * sx; g.beginPath(); g.arc(fx, fy, 9 * sx, 0, Math.PI * 2); g.stroke(); }
    }
    // cidades e nomes de províncias
    if (k > 0.35) {
      g.font = `${10.5 * sx}px "Source Sans 3", sans-serif`;
      for (const p of M.provinces) {
        const nd = M.nodes[p.id];
        g.fillStyle = p.city ? 'rgba(40,30,20,.85)' : 'rgba(40,30,20,.55)';
        g.beginPath(); g.arc(nd.x, nd.y, (p.city ? 3 : 2) * sx, 0, Math.PI * 2); g.fill();
        if (k > 0.55 || p.city) { const ly = nd.y + 14 * sx; g.fillStyle = 'rgba(35,28,20,.8)'; g.fillText(p.name, nd.x, ly);
          // pontos de vitória da província (selo ao lado do nome)
          if (p.vp >= 2) { const bx = nd.x + g.measureText(p.name).width / 2 + 9 * sx, r = 6.5 * sx;
          g.fillStyle = p.vp >= 5 ? '#b8902c' : '#7a5a2a'; g.beginPath(); g.arc(bx, ly, r, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#f6ecd2'; g.font = `700 ${9 * sx}px Oswald, sans-serif`; g.fillText(p.vp, bx, ly + 0.5 * sx); g.font = `${10.5 * sx}px "Source Sans 3", sans-serif`; } }
        if (k > 0.5) { const ri = this.resImg[p.res]; if (ri && ri.complete && ri.naturalWidth) { const z = (p.double ? 17 : 13) * sx; g.drawImage(ri, nd.x + 16 * sx, nd.y + 8 * sx, z, z); if (p.double) g.drawImage(ri, nd.x + 26 * sx, nd.y + 8 * sx, z, z); } }
      }
    }
    // batalhas
    for (const b of Object.values(S.battles)) {
      const r = (12 + 3 * Math.sin(performance.now() / 150)) * sx;
      g.fillStyle = 'rgba(200,60,30,.25)'; g.beginPath(); g.arc(b.x, b.y, r * 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffdd99'; g.lineWidth = 2.5 * sx; g.beginPath(); g.moveTo(b.x - r * .6, b.y - r * .6); g.lineTo(b.x + r * .6, b.y + r * .6); g.moveTo(b.x + r * .6, b.y - r * .6); g.lineTo(b.x - r * .6, b.y + r * .6); g.stroke();
    }
    for (const f of S.flash) { g.strokeStyle = 'rgba(255,200,120,.55)'; g.lineWidth = 1.5 * sx; g.setLineDash([3 * sx, 4 * sx]); g.beginPath(); g.moveTo(...f.from); g.lineTo(...f.to); g.stroke(); g.setLineDash([]); }
  }
  // posição na tela de cada pilha (para cliques)
  drawStacks(S, vis, frac, sel) {
    const g = this.g, M = this.M, k = this.k, sx = 1 / k, P = S.opts.player;
    this.hits = [];
    const fr = vis.fr;
    // agrupa pilhas no mesmo nó para não sobrepor
    const slots = new Map();
    for (const st of S.stacks) {
      if (!stackVisible(S, M, vis, st)) continue;
      const dom = stackDomain(st);
      let p;
      if (dom === 'air') p = { x: st.x, y: st.y };
      else p = st.path.length && st.prog >= 0 ? stackPos(M, st, Math.min(frac, 1) * stackSpeed(S, st) * (M.isLand(st.node) && M.isLand(st.path[0]) ? 1 : 0.6)) : { x: st.x, y: st.y };
      const key = dom === 'air' ? 'a' + st.id : (st.path.length || st.prog > 0 ? 'm' + st.id : 'n' + st.node);
      // rota
      if (st.path.length && dom !== 'air') {
        // seta da marcha: sua = verde, aliada = azul, inimiga = vermelha, outras = escura. Inimigos só mostram o próximo trecho.
        const r = st.nat === P ? 'self' : rel(S, P, st.nat);
        const col = r === 'self' ? '#3f7d32' : r === 'aliado' ? '#3f6fa6' : r === 'guerra' ? '#b8382a' : '#3a3128';
        const pts = [[p.x, p.y], ...(fr.has(st.nat) || st.id === this.sel ? st.path : st.path.slice(0, 1)).map(nd => [M.nodes[nd].x, M.nodes[nd].y])];
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = 'rgba(250,244,228,.75)'; g.lineWidth = 4.2 * sx; g.setLineDash([9 * sx, 6 * sx]); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
        g.strokeStyle = col; g.lineWidth = 2.2 * sx; g.stroke(); g.setLineDash([]);
        const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2]; const an = Math.atan2(ay - by, ax - bx), L = 11 * sx;
        g.fillStyle = col; g.strokeStyle = 'rgba(250,244,228,.85)'; g.lineWidth = 1.2 * sx; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax - L * Math.cos(an - 0.45), ay - L * Math.sin(an - 0.45)); g.lineTo(ax - L * Math.cos(an + 0.45), ay - L * Math.sin(an + 0.45)); g.closePath(); g.fill(); g.stroke();
      }
      if (dom === 'air' && st.mission && st.mission.type === 'patrol' && st.nat === P) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([4 * sx, 4 * sx]); g.beginPath(); g.arc(st.mission.x, st.mission.y, 70, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      // tropas paradas do mesmo país na mesma província viram UMA figura com o total (a maior é a que responde ao clique)
      const gk = key[0] === 'n' ? key + st.nat + dom : key, grp = slots.get(gk);
      if (grp) { grp.list.push(st); continue; }
      slots.set(gk, { list: [st], x: p.x, y: p.y, node: key[0] === 'n' ? st.node : null });
    }
    if (this.far) { for (const b of slots.values()) { const n = b.list.reduce((a, o) => a + stackCount(o), 0), rep = b.list.reduce((a, o) => stackCount(o) > stackCount(a) ? o : a); this.drawBadge(S, rep, b.x, b.y, n, b.list.some(o => o.id === this.sel)); const [scx, scy] = this.toScreen(b.x, b.y); this.hits.push({ id: b.list.some(o => o.id === this.sel) ? this.sel : rep.id, x: scx, y: scy + 14 }); } return; }
    // nações diferentes no mesmo lugar ficam lado a lado
    const per = new Map();
    for (const b of slots.values()) {
      const i = b.node == null ? 0 : (per.get(b.node) || 0); if (b.node != null) per.set(b.node, i + 1);
      const ox = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 26 * sx;
      const selIn = b.list.find(o => o.id === this.sel), rep = selIn || b.list.reduce((a, o) => stackCount(o) > stackCount(a) ? o : a);
      let show = rep;
      if (b.list.length > 1) { const units = {}; for (const o of b.list) for (const [u, e] of Object.entries(o.units)) { const t = units[u] || (units[u] = { n: 0, hp: 0 }); t.n += e.n; t.hp += e.hp; } show = { ...rep, units, fighting: b.list.some(o => o.fighting) }; }
      this.drawToken(S, show, b.x + ox, b.y, !!selIn, b.list.length);
      const [scx, scy] = this.toScreen(b.x + ox, b.y); this.hits.push({ id: rep.id, x: scx, y: scy, group: b.list.map(o => o.id) });
    }
  }
  // selo compacto (zoom afastado): círculo na cor da nação com borda pela relação e o total de unidades
  drawBadge(S, st, x, y, n, selected) {
    const g = this.g, sx = 1 / this.k, P = S.opts.player;
    const r = st.nat === P ? 'self' : rel(S, P, st.nat);
    const rim = selected ? '#ffd35a' : r === 'self' ? '#f4ecd2' : r === 'guerra' ? '#e0573e' : r === 'aliado' ? '#7fb3e6' : '#3a3128';
    const nc = st.nat === 'reb' ? '#3c3530' : NATION_BY_ID[st.nat].color;
    const label = n > 999 ? '1k+' : String(n), R = (label.length > 2 ? 9 : 7.5) * sx;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + 1 * sx, y + 1.5 * sx, R, 0, Math.PI * 2); g.fill();
    g.fillStyle = mix(nc, '#1c1814', 0.45); g.strokeStyle = rim; g.lineWidth = (selected ? 2.4 : 1.6) * sx;
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.stroke();
    g.font = `600 ${(label.length > 2 ? 8 : 9) * sx}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f6efe0'; g.fillText(label, x, y + 0.5 * sx);
  }
  art(u, nat) { const k = UNIT_PNG.has(u) ? u : u + nat; let i = this.artImg[k]; if (!i) { i = new Image(); i.src = UNIT_PNG.has(u) ? unitPngUrl(u) : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(unitArtSVG(u, nat, 'width="208" height="128"')); this.artImg[k] = i; } return i; }
  // zoom médio: escudo pequeno na cor da nação com a silhueta da unidade principal e o total (desenho próprio)
  drawShield(S, st, x, y, selected) {
    const g = this.g, sx = 1 / this.k, P = S.opts.player;
    let top = null, best = -1; for (const [u, e] of Object.entries(st.units)) { const v = e.n * UNITS[u].hp; if (v > best) { best = v; top = u; } }
    const r = st.nat === P ? 'self' : rel(S, P, st.nat);
    const rim = selected ? '#ffd35a' : r === 'self' ? '#f4ecd2' : r === 'guerra' ? '#e0573e' : r === 'aliado' ? '#7fb3e6' : '#2b241d';
    const nc = st.nat === 'reb' ? '#3c3530' : NATION_BY_ID[st.nat].color;
    const w = 15 * sx, h = 19 * sx, yy = y - h - 2 * sx;
    g.save(); g.translate(x, yy);
    const path = new Path2D(); path.moveTo(-w / 2, 0); path.lineTo(w / 2, 0); path.lineTo(w / 2, h * 0.55); path.quadraticCurveTo(w / 2, h * 0.85, 0, h); path.quadraticCurveTo(-w / 2, h * 0.85, -w / 2, h * 0.55); path.closePath();
    g.fillStyle = 'rgba(0,0,0,.35)'; g.translate(1 * sx, 1.5 * sx); g.fill(path); g.translate(-1 * sx, -1.5 * sx);
    g.fillStyle = mix(nc, '#1c1814', 0.35); g.fill(path); g.lineWidth = (selected ? 2.2 : 1.3) * sx; g.strokeStyle = rim; g.stroke(path);
    const ic = this.unitImg[top]; if (ic && ic.complete && ic.naturalWidth) g.drawImage(ic, -w * 0.42, h * 0.08, w * 0.84, w * 0.5);
    const n = stackCount(st), label = n > 999 ? '1k+' : String(n);
    g.font = `600 ${8 * sx}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f6efe0'; g.fillText(label, 0, h * 0.68);
    if (st.fighting) { g.fillStyle = '#e0573e'; g.beginPath(); g.arc(w / 2, 0, 2.6 * sx, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // sombra projetada da figura: silhueta escura e borrada, feita uma vez por imagem
  shadowOf(img) {
    this.shadows = this.shadows || new Map(); let c = this.shadows.get(img); if (c) return c;
    const W = img.naturalWidth, H = img.naturalHeight, pad = 8; c = document.createElement('canvas'); c.width = W + pad * 2; c.height = H + pad * 2;
    const g = c.getContext('2d'); try { g.filter = 'blur(3px)'; } catch { /* sem filtro: sombra dura */ }
    g.drawImage(img, pad, pad); g.filter = 'none'; g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    c.pad = pad; this.shadows.set(img, c); return c;
  }
  // tropa no mapa: figura pequena (tamanho fixo na tela) com uma etiqueta do país e o total em cima
  drawToken(S, st, x, y, selected, armies = 1) {
    const g = this.g, P = S.opts.player, s = 1 / this.k * (this.k < 0.45 ? 0.85 : 1);
    const dom = stackDomain(st);
    let top = null, best = -1; for (const [u, e] of Object.entries(st.units)) { const v = e.n * UNITS[u].hp; if (v > best) { best = v; top = u; } }
    const embarked = dom === 'land' && (!this.M.isLand(st.node) || (st.prog > 0 && st.path.length && !this.M.isLand(st.path[0])));
    const icon = embarked ? 'transporte' : top;
    const r = st.nat === P ? 'self' : rel(S, P, st.nat);
    const rim = selected ? '#ffd35a' : r === 'self' ? '#f4ecd2' : r === 'guerra' ? '#e0573e' : r === 'aliado' ? '#7fb3e6' : '#2b241d';
    const nc = st.nat === 'reb' ? '#3c3530' : NATION_BY_ID[st.nat].color;
    g.save(); g.translate(x, y);
    if (selected) { g.fillStyle = 'rgba(255,211,90,.5)'; g.beginPath(); g.ellipse(0, -1 * s, 13 * s, 4.5 * s, 0, 0, Math.PI * 2); g.fill(); }
    const img = this.art(icon, st.nat === 'reb' ? 'xx' : st.nat); let fh = 22 * s;
    if (img.complete && img.naturalWidth) {
      const veh = !(dom === 'land' && !embarked && (UNITS[icon]?.cls === 'inf')), bw = (veh ? 34 : 22) * s, bh = (veh ? 24 : 22) * s, f = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
      const w = img.naturalWidth * f; fh = img.naturalHeight * f;
      // contato com o chão: mancha escura logo abaixo (mais larga em veículos)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.55); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.scale(1, 0.32); g.fillStyle = gr; g.beginPath(); g.arc(0, -2 * s / 0.32, w * 0.55, 0, Math.PI * 2); g.fill(); g.restore();
      // sombra projetada para trás e para a direita (luz vindo da frente-esquerda), achatada no chão
      if (dom !== 'air') { const sh = this.shadowOf(img), pf = sh.pad * f; g.save(); g.globalAlpha = 0.3; g.transform(1, 0, -0.85, 0.36, 0, -1.5 * s); g.drawImage(sh, -w / 2 - pf, -fh - pf, w + pf * 2, fh + pf * 2); g.restore(); }
      // figura com a base (rodas/pés) encostada no ponto
      g.drawImage(img, -w / 2, -fh + 1 * s, w, fh);
    }
    // etiqueta: faixa da cor do país + número, borda pela relação
    const n = stackCount(st), label = n > 999 ? '1k+' : String(n);
    g.font = `600 ${8.5 * s}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.max(15 * s, g.measureText(label).width + 9 * s), ty = -fh - 13 * s;
    g.fillStyle = '#f4efe2'; g.strokeStyle = rim === '#f4ecd2' ? '#2b241d' : rim; g.lineWidth = (selected ? 2 : 1.1) * s;
    g.beginPath(); g.roundRect(-tw / 2, ty, tw, 11 * s, 2 * s); g.fill(); g.stroke();
    g.fillStyle = nc; g.fillRect(-tw / 2 + 1 * s, ty + 1 * s, 3 * s, 9 * s);
    g.fillStyle = '#1c1814'; g.fillText(label, 1.5 * s, ty + 5.7 * s);
    const hp = stackHP(st); const f = hp.max ? hp.hp / hp.max : 0;
    if (f < 0.999) { g.fillStyle = '#111'; g.fillRect(-tw / 2, ty + 11.5 * s, tw, 2 * s); g.fillStyle = f > 0.6 ? '#7cc26a' : f > 0.3 ? '#e2b84a' : '#d9533c'; g.fillRect(-tw / 2, ty + 11.5 * s, tw * f, 2 * s); }
    if (st.fighting) { g.fillStyle = '#e0573e'; g.beginPath(); g.arc(tw / 2 + 2 * s, ty + 1 * s, 2.8 * s, 0, Math.PI * 2); g.fill(); }
    if (armies > 1) { g.font = `600 ${7 * s}px Oswald, sans-serif`; const t2 = '×' + armies; g.fillStyle = 'rgba(28,24,20,.85)'; const w2 = g.measureText(t2).width + 5 * s; g.beginPath(); g.roundRect(-tw / 2 - w2 - 1 * s, ty + 1.5 * s, w2, 8 * s, 2 * s); g.fill(); g.fillStyle = '#f4efe2'; g.fillText(t2, -tw / 2 - w2 / 2 - 1 * s, ty + 5.6 * s); }
    g.restore();
  }
  // clique: pilha mais próxima em raio de 20px
  hitStack(sx, sy) { let best = null, bd = 22; for (const h of this.hits || []) { const d = Math.hypot(h.x - sx, h.y - (sy + 14)); if (d < bd) { bd = d; best = h.id; } } return best; }
}
