// Renderizador do mapa (canvas 2D).
import { NATIONS, NATION_BY_ID } from '../data/nations.js';
import { UNITS } from '../engine/defs.js';
import { stackDomain } from '../engine/state.js';
import { rel, stackCount, stackHP, stackSpeed, stackPos } from '../engine/sim.js';
import { stackVisible } from '../engine/vision.js';
import { UNIT_ICON } from './icons.js';
import { flagImage } from './flags.js';

const RES_COLOR = { graos: '#d8c06a', peixe: '#7fa9bd', ferro: '#8e939b', madeira: '#8d6a43', carvao: '#4a4a4a', petroleo: '#6b3b2a', gas: '#c8645a' };
export class MapView {
  constructor(canvas, M) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.M = M;
    this.k = 0.2; this.ox = 0; this.oy = 0; this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mode = 'padrao'; this.sel = null; this.selProv = -1; this.hover = -1; this.preview = null; this.airMode = null;
    this.paths = M.provinces.map(p => { const P = new Path2D(); for (const poly of p.poly) for (const r of poly) { P.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) P.lineTo(r[i], r[i + 1]); P.closePath(); } return P; });
    this.allLand = new Path2D(); this.paths.forEach(p => this.allLand.addPath(p));
    this.buildEdges();
    this.noise = this.makeNoise();
    this.unitImg = {}; for (const [u, s] of Object.entries(UNIT_ICON)) { const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40" color="#f3ead6" ').replace(/currentColor/g, '#f3ead6')); this.unitImg[u] = i; }
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
  makeNoise() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = 120 + Math.random() * 135; d.data[i] = v; d.data[i + 1] = v * 0.95; d.data[i + 2] = v * 0.85; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return this.g.createPattern(c, 'repeat');
  }
  resize() {
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
  zoomAt(sx, sy, f) { const [x, y] = this.toWorld(sx, sy); this.k *= f; this.clamp(); this.ox = sx - x * this.k; this.oy = sy - y * this.k; this.clamp(); }
  centerOn(x, y, k) { if (k) this.k = k; this.clamp(); this.ox = this.w / 2 - x * this.k; this.oy = this.h / 2 - y * this.k; this.clamp(); }

  provColor(S, i, vis) {
    const sp = S.provinces[i], P = S.opts.player, o = sp.owner;
    if (this.mode === 'politico') return o === 'reb' ? '#6b6258' : NATION_BY_ID[o].color;
    if (this.mode === 'recursos') return RES_COLOR[this.M.provinces[i].res];
    if (this.mode === 'moral') { if (o !== P) return '#a9a190'; const m = sp.morale / 100; return `hsl(${Math.round(m * 110)},45%,${42 + m * 18}%)`; }
    if (o === P) return '#e9ecdc';
    if (o === 'reb') return '#7a6d60';
    const r = rel(S, P, o);
    if (r === 'guerra') return '#c98e82';
    if (r === 'aliado') return '#a9bfd2';
    if (r === 'passagem') return '#c6c7a6';
    return '#cbc1a6';
  }

  draw(S, vis, frac = 0) {
    const g = this.g, M = this.M, k = this.k, P = S.opts.player;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // mar
    const grad = g.createLinearGradient(0, 0, 0, this.h); grad.addColorStop(0, '#5e8a93'); grad.addColorStop(1, '#4d7781');
    g.fillStyle = grad; g.fillRect(0, 0, this.w, this.h);
    g.setTransform(this.dpr * k, 0, 0, this.dpr * k, this.dpr * this.ox, this.dpr * this.oy);
    if (k < 0.42) {
      // zoom afastado: usa um bitmap em cache da camada estática
      const key = this.mode + '|' + P + '|' + S.provinces.map(p => p.owner).join(',') + '|' + (S.opts.fog ? vis.nodes.size + ':' + [...vis.nodes].reduce((a, b) => a + b * 7, 0) : '') + '|' + Object.entries(S.rel).join() + '|' + S.nations[P].coalition;
      if (key !== this.cacheKey) {
        const CK = 0.42; if (!this.cache) { this.cache = document.createElement('canvas'); this.cache.width = Math.ceil(this.M.W * CK); this.cache.height = Math.ceil(this.M.H * CK); }
        const cg = this.cache.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, this.cache.width, this.cache.height); cg.setTransform(CK, 0, 0, CK, 0, 0);
        this.drawBase(cg, CK, S, vis); this.cacheKey = key;
      }
      g.drawImage(this.cache, 0, 0, M.W, M.H);
    } else this.drawBase(g, k, S, vis);
    // província selecionada / hover
    if (this.hover >= 0 && this.hover < M.provinces.length) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(this.paths[this.hover], 'evenodd'); }
    if (this.selProv >= 0) { g.strokeStyle = '#f1c255'; g.lineWidth = 3 / k; g.stroke(this.paths[this.selProv]); }
    // raio de artilharia/alcance aéreo do selecionado
    const sel = this.sel && S.stacks.find(s => s.id === this.sel);
    if (sel && stackDomain(sel) === 'air') {
      const b = M.nodes[sel.base]; let r = 1e9; for (const u of Object.keys(sel.units)) r = Math.min(r, UNITS[u].range || 1e9);
      g.setLineDash([8 / k, 6 / k]); g.strokeStyle = 'rgba(255,240,200,.7)'; g.lineWidth = 1.5 / k; g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    this.drawLabels(S, vis);
    this.drawStacks(S, vis, frac, sel);
    // prévia de rota
    if (this.preview && this.preview.length > 1) {
      g.setLineDash([10 / k, 7 / k]); g.strokeStyle = 'rgba(255,230,140,.95)'; g.lineWidth = 2.5 / k; g.beginPath();
      this.preview.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
    }
  }
  drawBase(g, k, S, vis) {
    const M = this.M, P = S.opts.player;
    // bordas do mapa
    g.strokeStyle = 'rgba(20,30,30,.5)'; g.lineWidth = 3 / k; g.strokeRect(0, 0, M.W, M.H);
    // halo costeiro
    g.strokeStyle = 'rgba(210,230,225,.22)'; g.lineWidth = 9 / k; g.lineJoin = 'round'; g.stroke(this.allLand);
    g.strokeStyle = 'rgba(210,230,225,.18)'; g.lineWidth = 4 / k; g.stroke(this.allLand);
    // províncias
    const fog = S.opts.fog && this.mode === 'padrao';
    for (let i = 0; i < M.provinces.length; i++) {
      g.fillStyle = this.provColor(S, i, vis); g.fill(this.paths[i], 'evenodd');
    }
    // textura de papel
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.16; g.fillStyle = this.noise; g.fill(this.allLand, 'evenodd'); g.restore();
    // névoa
    if (fog) { g.fillStyle = 'rgba(45,40,30,.17)'; for (let i = 0; i < M.provinces.length; i++) if (!vis.nodes.has(i)) g.fill(this.paths[i], 'evenodd'); }
    // linhas de província
    g.strokeStyle = 'rgba(70,55,40,.35)'; g.lineWidth = 0.8 / k;
    for (let i = 0; i < M.provinces.length; i++) g.stroke(this.paths[i]);
    // fronteiras de nação
    g.beginPath();
    for (const e of this.edges) if (S.provinces[e.p1].owner !== S.provinces[e.p2].owner) { g.moveTo(e.x1, e.y1); g.lineTo(e.x2, e.y2); }
    g.strokeStyle = 'rgba(250,245,232,.85)'; g.lineWidth = 2.6 / k; g.stroke();
    g.strokeStyle = 'rgba(60,45,30,.55)'; g.lineWidth = 1 / k; g.stroke();
    // contorno do jogador
    g.beginPath(); for (const e of this.edges) { const a = S.provinces[e.p1].owner === P, b = S.provinces[e.p2].owner === P; if (a !== b) { g.moveTo(e.x1, e.y1); g.lineTo(e.x2, e.y2); } }
    g.strokeStyle = 'rgba(70,120,60,.9)'; g.lineWidth = 2.2 / k; g.stroke();
    // costa
    g.strokeStyle = 'rgba(40,50,45,.6)'; g.lineWidth = 1 / k; g.stroke(this.allLand);
  }
  drawLabels(S, vis) {
    const g = this.g, M = this.M, k = this.k, P = S.opts.player;
    // nomes das nações (centro das províncias)
    if (!this.natCenters || this.natCentersH !== S.hour) {
      const acc = {}; S.provinces.forEach((sp, i) => { const a = acc[sp.owner] || (acc[sp.owner] = { x: 0, y: 0, n: 0 }); a.x += M.nodes[i].x; a.y += M.nodes[i].y; a.n++; });
      this.natCenters = acc; this.natCentersH = S.hour;
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (k < 0.45) for (const [id, a] of Object.entries(this.natCenters)) {
      if (id === 'reb' || a.n < 2) continue;
      const size = Math.min(70, 16 + Math.sqrt(a.n) * 7) / Math.max(k, 0.12) * 0.13;
      g.font = `${size}px "IM Fell English SC", Georgia, serif`;
      g.fillStyle = id === P ? 'rgba(40,70,35,.55)' : 'rgba(55,40,25,.42)';
      const name = NATION_BY_ID[id].name.toUpperCase().split('').join(String.fromCharCode(8202));
      g.fillText(name, a.x / a.n, a.y / a.n);
    }
    // placas nas capitais (bandeira + nome)
    const sx = 1 / k;
    for (const n of Object.values(S.nations)) {
      if (!n.alive || n.rebel || n.capital < 0) continue;
      const nd = M.nodes[n.capital]; const fs = 11 * sx;
      if (k < 0.12) continue;
      g.font = `600 ${fs}px Oswald, sans-serif`;
      const label = NATION_BY_ID[n.id].name.toUpperCase(); const tw = g.measureText(label).width;
      const x = nd.x, y = nd.y + 26 * sx;
      g.fillStyle = 'rgba(28,24,20,.82)'; g.fillRect(x - tw / 2 - 6 * sx, y - 8 * sx, tw + 12 * sx, 16 * sx);
      g.fillStyle = n.id === P ? '#cfe6b8' : '#efe6d2'; g.fillText(label, x, y + 0.5 * sx);
      const fi = flagImage(n.id); if (fi.complete) { g.save(); g.beginPath(); g.arc(x, y - 22 * sx, 9 * sx, 0, Math.PI * 2); g.closePath(); g.fillStyle = '#1c1814'; g.fill(); g.clip(); g.drawImage(fi, x - 13 * sx, y - 30.5 * sx, 26 * sx, 17 * sx); g.restore(); g.strokeStyle = '#1c1814'; g.lineWidth = 2 * sx; g.beginPath(); g.arc(x, y - 22 * sx, 9 * sx, 0, Math.PI * 2); g.stroke(); }
    }
    // cidades e nomes de províncias
    if (k > 0.35) {
      g.font = `${10.5 * sx}px "Source Sans 3", sans-serif`;
      for (const p of M.provinces) {
        const nd = M.nodes[p.id];
        g.fillStyle = p.city ? 'rgba(40,30,20,.85)' : 'rgba(40,30,20,.55)';
        g.beginPath(); g.arc(nd.x, nd.y, (p.city ? 3 : 2) * sx, 0, Math.PI * 2); g.fill();
        if (k > 0.55 || p.city) { g.fillStyle = 'rgba(35,28,20,.8)'; g.fillText(p.name, nd.x, nd.y - 10 * sx); }
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
      const n = slots.get(key) || 0; slots.set(key, n + 1);
      const ox = n * 14 * sx, oy = -n * 6 * sx;
      // rota
      if (st.path.length && (fr.has(st.nat) || st.id === this.sel)) {
        g.setLineDash([6 * sx, 5 * sx]); g.strokeStyle = st.nat === P ? 'rgba(255,240,190,.75)' : 'rgba(255,190,170,.6)'; g.lineWidth = 1.6 * sx; g.beginPath(); g.moveTo(p.x, p.y);
        for (const nd of st.path) g.lineTo(M.nodes[nd].x, M.nodes[nd].y); g.stroke(); g.setLineDash([]);
        const last = M.nodes[st.path[st.path.length - 1]]; g.fillStyle = 'rgba(255,240,190,.8)'; g.beginPath(); g.arc(last.x, last.y, 3 * sx, 0, Math.PI * 2); g.fill();
      }
      if (dom === 'air' && st.mission && st.mission.type === 'patrol' && st.nat === P) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([4 * sx, 4 * sx]); g.beginPath(); g.arc(st.mission.x, st.mission.y, 70, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      this.drawToken(S, st, p.x + ox, p.y + oy, st.id === this.sel);
      const [scx, scy] = this.toScreen(p.x + ox, p.y + oy); this.hits.push({ id: st.id, x: scx, y: scy });
    }
  }
  drawToken(S, st, x, y, selected) {
    const g = this.g, sx = 1 / this.k, P = S.opts.player;
    const scale = Math.max(0.75, Math.min(1.25, this.k * 2.2));
    const s = sx * scale; const w = 34 * s, h = 26 * s;
    const dom = stackDomain(st);
    let top = null, best = -1; for (const [u, e] of Object.entries(st.units)) { const v = e.n * UNITS[u].hp; if (v > best) { best = v; top = u; } }
    const embarked = dom === 'land' && (!this.M.isLand(st.node) || (st.prog > 0 && st.path.length && !this.M.isLand(st.path[0])));
    const icon = embarked ? 'transporte' : top;
    const r = st.nat === P ? 'self' : rel(S, P, st.nat);
    const rim = r === 'self' ? '#e8d9a8' : r === 'guerra' ? '#e0573e' : r === 'aliado' ? '#7fb3e6' : '#b8ad92';
    const fill = st.nat === 'reb' ? '#3c3530' : NATION_BY_ID[st.nat].color;
    g.save(); g.translate(x, y - 14 * s);
    // sombra
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, h / 2 + 3 * s, w / 2, 4 * s, 0, 0, Math.PI * 2); g.fill();
    // escudo
    g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(w / 2, h / 4); g.lineTo(0, h / 2 + 4 * s); g.lineTo(-w / 2, h / 4); g.closePath();
    g.fillStyle = '#2b2620'; g.fill(); g.lineWidth = (selected ? 3 : 1.6) * s; g.strokeStyle = selected ? '#ffd35a' : rim; g.stroke();
    g.fillStyle = fill; g.fillRect(-w / 2 + 2 * s, -h / 2 + 2 * s, w - 4 * s, 4 * s);
    const img = this.unitImg[icon]; if (img && img.complete) g.drawImage(img, -14 * s, -7 * s, 28 * s, 17.5 * s);
    // contador
    const n = stackCount(st); g.font = `700 ${9 * s}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#1c1814'; g.beginPath(); g.arc(w / 2 - 1 * s, -h / 2, 7 * s, 0, Math.PI * 2); g.fill(); g.strokeStyle = rim; g.lineWidth = 1 * s; g.stroke();
    g.fillStyle = '#fff'; g.fillText(n > 99 ? '99+' : String(n), w / 2 - 1 * s, -h / 2 + 0.5 * s);
    // vida
    const hp = stackHP(st); const f = hp.max ? hp.hp / hp.max : 0;
    g.fillStyle = '#111'; g.fillRect(-w / 2 + 3 * s, h / 4 - 1 * s, w - 6 * s, 3 * s);
    g.fillStyle = f > 0.6 ? '#7cc26a' : f > 0.3 ? '#e2b84a' : '#d9533c'; g.fillRect(-w / 2 + 3 * s, h / 4 - 1 * s, (w - 6 * s) * f, 3 * s);
    if (st.fighting) { g.fillStyle = '#e0573e'; g.beginPath(); g.arc(-w / 2 + 1 * s, -h / 2, 4 * s, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // clique: pilha mais próxima em raio de 20px
  hitStack(sx, sy) { let best = null, bd = 22; for (const h of this.hits || []) { const d = Math.hypot(h.x - sx, h.y - (sy + 10)); if (d < bd) { bd = d; best = h.id; } } return best; }
}
