// Gera assets/map.json: províncias (Voronoi de cidades reais recortado na costa real),
// zonas marítimas, adjacências, terreno, recursos e dono inicial.
// Dados: Natural Earth (world-atlas, domínio público) e GeoNames (all-the-cities, CC BY 4.0).
import fs from 'fs';
import { createRequire } from 'module';
import { geoConicConformal } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import * as topojson from 'topojson-client';
import pc from 'polygon-clipping';
import { NATIONS } from '../src/data/nations.js';
const require = createRequire(import.meta.url);
const cities = require('all-the-cities');

const D = +process.env.SPACING || 150;   // distância mínima entre sedes de província (km)
const R = 2.5;                            // resolução do raster (km/pixel)
const SEA_R = 230;                        // raio alvo das zonas marítimas (km)

// ---------- RNG determinístico
let seed = 1914;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---------- projeção (unidades = km)
const proj = geoConicConformal().parallels([38, 62]).rotate([-20, 0]).center([0, 49]).scale(6371).translate([0, 0]);
const P = (lon, lat) => proj([lon, lat]);
// retângulo do mapa definido por pontos-chave
const pts = [P(-11.5, 38.5), P(-10, 54), P(52, 50), P(20, 70.5), P(15, 28.5), P(50, 32), P(-11, 30)];
let X0 = Math.min(...pts.map(p => p[0])), X1 = Math.max(...pts.map(p => p[0]));
let Y0 = Math.min(P(20, 70.5)[1], P(52, 62)[1]), Y1 = Math.max(P(15, 28.5)[1], P(-10, 30)[1]);
X0 = Math.min(X0, P(-11.5, 51)[0]); X1 = Math.max(X1, P(52.5, 36)[0]);
const W = X1 - X0, H = Y1 - Y0;
const proj2 = (lon, lat) => { const p = P(lon, lat); return [p[0] - X0, p[1] - Y0]; };
console.log('mapa km', Math.round(W), Math.round(H));

// ---------- terra
const land50 = JSON.parse(fs.readFileSync('node_modules/world-atlas/land-50m.json'));
const landFC = topojson.feature(land50, land50.objects.land);
const geoms = landFC.type === 'FeatureCollection' ? landFC.features.map(f => f.geometry) : [landFC.geometry];
let polys = [];
for (const g of geoms) {
  if (g.type === 'Polygon') polys.push(g.coordinates);
  else if (g.type === 'MultiPolygon') polys.push(...g.coordinates);
}
polys = polys.filter(p => p[0].some(([x, y]) => x > -30 && x < 75 && y > 18 && y < 78));
// desfaz o salto do antimeridiano (Eurásia vai até Chukotka)
polys = polys.map(poly => poly[0].some(([x]) => x > 100) ? poly.map(r => r.map(([x, y]) => [x < -100 ? x + 360 : x, y])) : poly);
// recorte de anel por polígono convexo (Sutherland–Hodgman) — robusto, sem bibliotecas
function clipConvex(ring, clip) {
  let ccw = 0; for (let i = 0, j = clip.length - 1; i < clip.length; j = i++) ccw += (clip[j][0] - clip[i][0]) * (clip[j][1] + clip[i][1]);
  const sgn = ccw > 0 ? 1 : -1; let out = ring;
  for (let i = 0; i < clip.length && out.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length]; const inp = out; out = [];
    const side = P => sgn * ((B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0])) >= 0;
    const inter = (P, Q) => { const x1 = P[0], y1 = P[1], x2 = Q[0], y2 = Q[1]; const dxc = B[0] - A[0], dyc = B[1] - A[1]; const den = (x2 - x1) * dyc - (y2 - y1) * dxc; const t = ((A[0] - x1) * dyc - (A[1] - y1) * dxc) / den; return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]; };
    for (let k = 0; k < inp.length; k++) { const P = inp[k], Q = inp[(k + 1) % inp.length]; const pin = side(P), qin = side(Q);
      if (pin) { out.push(P); if (!qin) out.push(inter(P, Q)); } else if (qin) out.push(inter(P, Q)); }
  }
  if (out.length >= 3) out.push(out[0]);
  return out;
}
// projeta, densificando segmentos longos
function projRing(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    if (i > 0) {
      const [l0, a0] = ring[i - 1];
      const steps = Math.ceil(Math.max(Math.abs(lon - l0), Math.abs(lat - a0)) / 0.5);
      for (let s = 1; s < steps; s++) out.push(proj2(l0 + (lon - l0) * s / steps, a0 + (lat - a0) * s / steps));
    }
    out.push(proj2(lon, lat));
  }
  return out;
}
const geoBox = [[-35, 15], [90, 15], [90, 80], [-35, 80]];
let landProj = polys.map(poly => poly.map(r => clipConvex(r.slice(0, -1), geoBox)).filter(r => r.length >= 4).map(r => projRing(r.slice(0, -1)))).filter(p => p.length);
const rect = [[[0, 0], [W, 0], [W, H], [0, H], [0, 0]]];
const rectC = [[0, 0], [W, 0], [W, H], [0, H]];
landProj = landProj.map(poly => poly.map(r => clipConvex(r, rectC)).filter(r => r.length >= 4)).filter(p => p.length);

// Douglas-Peucker
function dp(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  let far = 1, fd = -1; for (let i = 1; i < pts.length - 1; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  keep[far] = 1; const st = [[0, far], [far, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };
landProj = landProj.map(poly => poly.map(r => dp(r, 1.2)).filter(r => r.length >= 4 && Math.abs(ringArea(r)) > 25))
  .filter(poly => poly.length && Math.abs(ringArea(poly[0])) > 60);
let nv = 0; landProj.forEach(p => p.forEach(r => nv += r.length));
console.log('polígonos de terra', landProj.length, 'vértices', nv);

// ---------- raster de terra (scanline)
const GW = Math.ceil(W / R), GH = Math.ceil(H / R);
const land = new Uint8Array(GW * GH);
{
  const rows = Array.from({ length: GH }, () => []);
  for (const poly of landProj) for (const r of poly) for (let i = 0; i < r.length - 1; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[i + 1]; if (y1 === y2) continue;
    const ya = Math.min(y1, y2), yb = Math.max(y1, y2);
    const r0 = Math.max(0, Math.ceil(ya / R - 0.5)), r1 = Math.min(GH - 1, Math.floor(yb / R - 0.5));
    for (let row = r0; row <= r1; row++) rows[row].push([x1, y1, x2, y2]);
  }
  for (let row = 0; row < GH; row++) {
    const y = (row + 0.5) * R; const xs = [];
    for (const [x1, y1, x2, y2] of rows[row]) { if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(xs[k] / R - 0.5)), c1 = Math.min(GW - 1, Math.floor(xs[k + 1] / R - 0.5));
      for (let c = c0; c <= c1; c++) land[row * GW + c] = 1;
    }
  }
}
const isLandXY = (x, y) => { const c = Math.floor(x / R), r = Math.floor(y / R); return c >= 0 && r >= 0 && c < GW && r < GH && land[r * GW + c] === 1; };

// ---------- sedes de província (cidades)
const PT_NAMES = { London: 'Londres', Paris: 'Paris', Berlin: 'Berlim', Vienna: 'Viena', Rome: 'Roma', Madrid: 'Madri', Lisbon: 'Lisboa', Moscow: 'Moscou', 'Saint Petersburg': 'São Petersburgo', Istanbul: 'Constantinopla', Ankara: 'Ancara', Stockholm: 'Estocolmo', Oslo: 'Cristiânia', Helsinki: 'Helsinque', Riga: 'Riga', Warsaw: 'Varsóvia', Budapest: 'Budapeste', Bucharest: 'Bucareste', Belgrade: 'Belgrado', Sofia: 'Sófia', Athens: 'Atenas', Kyiv: 'Kiev', Kazan: 'Kazan', Tbilisi: 'Tíflis', Damascus: 'Damasco', Baghdad: 'Bagdá', Tehran: 'Teerã', Cairo: 'Cairo', Tripoli: 'Trípoli', Algiers: 'Argel', Rabat: 'Rabat', Munich: 'Munique', Hamburg: 'Hamburgo', Cologne: 'Colônia', Frankfurt: 'Frankfurt', 'Frankfurt am Main': 'Frankfurt', Milan: 'Milão', Naples: 'Nápoles', Turin: 'Turim', Venice: 'Veneza', Florence: 'Florença', Genoa: 'Gênova', Seville: 'Sevilha', Saragossa: 'Saragoça', Zaragoza: 'Saragoça', Barcelona: 'Barcelona', Valencia: 'Valência', Marseille: 'Marselha', Lyon: 'Lyon', Bordeaux: 'Bordéus', Toulouse: 'Toulouse', Nice: 'Nice', Strasbourg: 'Estrasburgo', Brussels: 'Bruxelas', Antwerpen: 'Antuérpia', Antwerp: 'Antuérpia', Amsterdam: 'Amsterdã', 'The Hague': 'Haia', Rotterdam: 'Roterdã', Copenhagen: 'Copenhague', Prague: 'Praga', Krakow: 'Cracóvia', Kraków: 'Cracóvia', Wrocław: 'Breslávia', Gdańsk: 'Danzigue', Poznań: 'Posnânia', Lviv: 'Lemberg', Odesa: 'Odessa', Kharkiv: 'Carcóvia', Dnipro: 'Ekaterinoslav', Minsk: 'Minsk', Vilnius: 'Vilna', Kaunas: 'Kovna', Tallinn: 'Reval', 'Nizhniy Novgorod': 'Níjni Novgorod', Volgograd: 'Tsaritsyn', Samara: 'Samara', Saratov: 'Saratov', Rostov: 'Rostov', 'Rostov-na-Donu': 'Rostov', Voronezh: 'Voronej', Smolensk: 'Smolensk', Yaroslavl: 'Iaroslavl', Arkhangelsk: 'Arcangel', Murmansk: 'Murmansk', Baku: 'Baku', Yerevan: 'Erevan', Izmir: 'Esmirna', Bursa: 'Bursa', Trabzon: 'Trebizonda', Erzurum: 'Erzurum', Aleppo: 'Alepo', Beirut: 'Beirute', Jerusalem: 'Jerusalém', Amman: 'Amã', Mosul: 'Mossul', Basrah: 'Baçorá', Basra: 'Baçorá', Alexandria: 'Alexandria', Benghazi: 'Bengasi', Tunis: 'Túnis', Oran: 'Orã', Casablanca: 'Casablanca', Fès: 'Fez', Marrakesh: 'Marraquexe', Tangier: 'Tânger', Thessaloniki: 'Salônica', Dublin: 'Dublin', Edinburgh: 'Edimburgo', Glasgow: 'Glasgow', Manchester: 'Manchester', Birmingham: 'Birmingham', Liverpool: 'Liverpool', Belfast: 'Belfast', Bergen: 'Bergen', Gothenburg: 'Gotemburgo', 'Göteborg': 'Gotemburgo', Zürich: 'Zurique', Zurich: 'Zurique', Geneva: 'Genebra', Bern: 'Berna', Nuremberg: 'Nuremberg', Leipzig: 'Leipzig', Dresden: 'Dresden', Königsberg: 'Königsberg', Kaliningrad: 'Königsberg', Chisinau: 'Chișinău', Sarajevo: 'Sarajevo', Zagreb: 'Zagreb', Ljubljana: 'Liubliana', Bratislava: 'Presburgo', Tirana: 'Tirana', Skopje: 'Escópia', Palermo: 'Palermo', Bari: 'Bari', Valletta: 'Valeta', Nicosia: 'Nicósia', Tabriz: 'Tabriz', Isfahan: 'Isfahan', Astrakhan: 'Astracã', Perm: 'Perm', Ufa: 'Ufa', Orenburg: 'Oremburgo', Tula: 'Tula', Kursk: 'Kursk', Bryansk: 'Briansk', Pskov: 'Pskov', Tver: 'Tver', Kirov: 'Viatka', Vologda: 'Vologda', Petrozavodsk: 'Petrozavodsk', Sevastopol: 'Sebastopol', Simferopol: 'Simferopol', Krasnodar: 'Ekaterinodar', Makhachkala: 'Petrovsk', Porto: 'Porto', Bilbao: 'Bilbau', Coruña: 'Corunha', 'A Coruña': 'Corunha', Málaga: 'Málaga' };
const capByNation = {};
for (const n of NATIONS) {
  const c = cities.filter(x => (x.name === n.cap || x.altName === n.cap) && x.country === n.cc).sort((a, b) => b.population - a.population)[0];
  if (!c) throw new Error('capital não encontrada ' + n.cap);
  capByNation[n.id] = c;
}
const inRect = (x, y) => x > 3 && y > 3 && x < W - 3 && y < H - 3;
let cand = cities.filter(c => c.population >= 12000).map(c => { const [lon, lat] = c.loc.coordinates; const [x, y] = proj2(lon, lat); return { c, x, y, lon, lat }; })
  .filter(o => inRect(o.x, o.y) && isLandXY(o.x, o.y));
cand.sort((a, b) => b.c.population - a.c.population);
const seeds = [];
// fator de espaçamento: regiões periféricas/esparsas têm províncias maiores
const fD = (lon, lat) => {
  let f = 1;
  if (lon > 40) f = Math.max(f, 1 + (lon - 40) / 14);
  if (lat > 61) f = Math.max(f, 1 + (lat - 61) / 7);
  if (lat < 33.5 && (lon < 29 || lon > 33.5)) f = Math.max(f, 1 + (33.5 - lat) / 3.5);
  return Math.min(f, 1.9);
};
const grid = new Map(); const GC = D;
const key = (x, y) => Math.floor(x / GC) + ',' + Math.floor(y / GC);
function nearestSeedDist(x, y) {
  let best = 1e9; const gx = Math.floor(x / GC), gy = Math.floor(y / GC);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const a = grid.get((gx + i) + ',' + (gy + j)); if (a) for (const s of a) best = Math.min(best, Math.hypot(s.x - x, s.y - y)); }
  return best;
}
function addSeed(s) { seeds.push(s); const k = key(s.x, s.y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
// capitais primeiro
for (const n of NATIONS) { const c = capByNation[n.id]; const [lon, lat] = c.loc.coordinates; const [x, y] = proj2(lon, lat); addSeed({ x, y, lon, lat, name: c.name, cc: c.country, pop: c.population, capitalOf: n.id }); }
for (const o of cand) if (nearestSeedDist(o.x, o.y) >= D * fD(o.lon, o.lat)) addSeed({ x: o.x, y: o.y, lon: o.lon, lat: o.lat, name: o.c.name, cc: o.c.country, pop: o.c.population });
// preenchimento em áreas sem cidades grandes
const smallCities = cities.filter(c => c.population >= 500).map(c => { const [lon, lat] = c.loc.coordinates; const [x, y] = proj2(lon, lat); return { c, x, y, lon, lat }; }).filter(o => inRect(o.x, o.y) && isLandXY(o.x, o.y));
const smallGrid = new Map(); for (const o of smallCities) { const k = Math.floor(o.x / 50) + ',' + Math.floor(o.y / 50); if (!smallGrid.has(k)) smallGrid.set(k, []); smallGrid.get(k).push(o); }
function bestSmallNear(x, y, rad) {
  let best = null; const gx = Math.floor(x / 50), gy = Math.floor(y / 50), k = Math.ceil(rad / 50);
  for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) { const a = smallGrid.get((gx + i) + ',' + (gy + j)); if (a) for (const o of a) { const d = Math.hypot(o.x - x, o.y - y); if (d <= rad && (!best || o.c.population > best.c.population)) best = o; } }
  return best;
}
const step = D * 0.45;
let added = 1;
while (added) {
  added = 0;
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
    if (!isLandXY(x, y)) continue;
    const ll = proj.invert([x + X0, y + Y0]); const DL = D * fD(ll[0], ll[1]);
    if (nearestSeedDist(x, y) < DL * 0.92) continue;
    // não criar províncias em ilhotas minúsculas: exige terra em volta
    let ln = 0; for (let a = 0; a < 8; a++) if (isLandXY(x + Math.cos(a) * 30, y + Math.sin(a) * 30)) ln++;
    if (ln < 6) continue;
    const o = bestSmallNear(x, y, DL * 0.4);
    if (o && nearestSeedDist(o.x, o.y) > DL * 0.6) addSeed({ x: o.x, y: o.y, lon: o.lon, lat: o.lat, name: o.c.name, cc: o.c.country, pop: o.c.population });
    else { const inv = proj.invert([x + X0, y + Y0]); const near = bestSmallNear(x, y, 400); addSeed({ x, y, lon: inv[0], lat: inv[1], name: near ? near.c.name : 'Ermo', cc: near ? near.c.country : 'XX', pop: 0, filler: true }); }
    added++;
  }
}
console.log('sedes', seeds.length);

// ---------- rótulos de terra (Voronoi euclidiano)
const landDel = Delaunay.from(seeds.map(s => [s.x, s.y]));
const SEA_BASE = 10000;
const label = new Int32Array(GW * GH).fill(-1);
{
  let hint = 0;
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
    const i = r * GW + c; if (!land[i]) continue;
    hint = landDel.find((c + 0.5) * R, (r + 0.5) * R, hint); label[i] = hint;
  }
}
// ---------- mar: componentes, distância à costa, sementes por amostragem do ponto mais distante
const comp = new Int32Array(GW * GH).fill(-1);
const compSize = [];
{
  const q = new Int32Array(GW * GH);
  let id = 0;
  for (let i = 0; i < GW * GH; i++) {
    if (land[i] || comp[i] >= 0) continue;
    let h = 0, t = 0; q[t++] = i; comp[i] = id; let n = 0;
    while (h < t) { const k = q[h++]; n++; const r = (k / GW) | 0, c = k % GW;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= GH || cc >= GW) continue; const kk = rr * GW + cc; if (!land[kk] && comp[kk] < 0) { comp[kk] = id; q[t++] = kk; } } }
    compSize.push(n); id++;
  }
}
const keepPts = [[-20, 45], [34, 43], [50.5, 41], [28, 40.75], [36.5, 46], [19, 57], [38, 65.5]];
const keepComp = new Set();
for (const [lon, lat] of keepPts) { const [x, y] = proj2(lon, lat); const c = Math.floor(x / R), r = Math.floor(y / R); if (c >= 0 && r >= 0 && c < GW && r < GH && !land[r * GW + c]) keepComp.add(comp[r * GW + c]); }
// componentes grandes também ficam
compSize.forEach((n, i) => { if (n * R * R > 60000) keepComp.add(i); });
const isSea = i => !land[i] && keepComp.has(comp[i]);
// distância à costa (BFS)
const coastDist = new Float32Array(GW * GH).fill(1e9);
{
  const q = new Int32Array(GW * GH); let h = 0, t = 0;
  for (let i = 0; i < GW * GH; i++) if (land[i]) { coastDist[i] = 0; q[t++] = i; }
  while (h < t) { const k = q[h++]; const r = (k / GW) | 0, c = k % GW;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= GH || cc >= GW) continue; const kk = rr * GW + cc; if (coastDist[kk] > coastDist[k] + 1) { coastDist[kk] = coastDist[k] + 1; q[t++] = kk; } } }
}
// geodésico (Dijkstra aproximado com 8 vizinhos)
const seaDist = new Float32Array(GW * GH).fill(1e9);
const seaLab = new Int32Array(GW * GH).fill(-1);
const seaSeeds = [];
function relaxFrom(src, id) {
  // BFS ponderado simples com fila de baldes
  const buckets = new Map(); const push = (k, d) => { const b = Math.floor(d * 2); if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(k); };
  seaDist[src] = 0; seaLab[src] = id; push(src, 0);
  let cur = 0; let maxB = 0;
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (true) {
    while (!buckets.has(cur) && cur <= maxB + 1) cur++;
    if (!buckets.has(cur)) break;
    const arr = buckets.get(cur); buckets.delete(cur);
    for (const k of arr) {
      const d = seaDist[k]; if (seaLab[k] !== id) continue;
      const r = (k / GW) | 0, c = k % GW;
      for (const [dr, dc, w] of N8) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= GH || cc >= GW) continue; const kk = rr * GW + cc; if (!isSea(kk)) continue;
        const nd = d + w; if (nd < seaDist[kk]) { seaDist[kk] = nd; seaLab[kk] = id; const b = Math.floor(nd * 2); if (b > maxB) maxB = b; push(kk, nd); } }
    }
  }
}
// primeira semente: ponto mais distante da costa em cada componente mantida
for (const cid of keepComp) {
  let best = -1, bd = -1; for (let i = 0; i < GW * GH; i++) if (comp[i] === cid && coastDist[i] > bd) { bd = coastDist[i]; best = i; }
  if (best >= 0) { seaSeeds.push(best); relaxFrom(best, seaSeeds.length - 1); }
}
const thr = SEA_R / R;
for (let it = 0; it < 400; it++) {
  // pixel mais distante (prefere longe da costa)
  let best = -1, bd = -1; for (let i = 0; i < GW * GH; i++) if (isSea(i)) { const s = seaDist[i] + Math.min(coastDist[i], 6) * 0.5; if (s > bd) { bd = s; best = i; } }
  if (seaDist[best] < thr) break;
  // desloca para dentro do mar: busca na vizinhança o pixel com maior distância da costa
  let b2 = best, cd = coastDist[best]; const r0 = (best / GW) | 0, c0 = best % GW; const rad = Math.round(thr * 0.35);
  for (let dr = -rad; dr <= rad; dr += 2) for (let dc = -rad; dc <= rad; dc += 2) { const rr = r0 + dr, cc = c0 + dc; if (rr < 0 || cc < 0 || rr >= GH || cc >= GW) continue; const kk = rr * GW + cc; if (isSea(kk) && comp[kk] === comp[best] && coastDist[kk] > cd && seaDist[kk] > thr * 0.5) { cd = coastDist[kk]; b2 = kk; } }
  seaSeeds.push(b2); relaxFrom(b2, seaSeeds.length - 1);
}
console.log('zonas marítimas', seaSeeds.length);
for (let i = 0; i < GW * GH; i++) if (isSea(i)) label[i] = SEA_BASE + seaLab[i];

// ---------- adjacências pelo raster
const nL = seeds.length, nS = seaSeeds.length;
const nodeId = l => l >= SEA_BASE ? nL + (l - SEA_BASE) : l;
const pairCount = new Map();
for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
  const a = label[r * GW + c]; if (a < 0) continue;
  for (const [dr, dc] of [[0, 1], [1, 0]]) { const rr = r + dr, cc = c + dc; if (rr >= GH || cc >= GW) continue; const b = label[rr * GW + cc]; if (b < 0 || b === a) continue;
    const A = nodeId(a), B = nodeId(b); const k = A < B ? A + ',' + B : B + ',' + A; pairCount.set(k, (pairCount.get(k) || 0) + 1); }
}
const adj = Array.from({ length: nL + nS }, () => new Set());
for (const [k, n] of pairCount) { const [a, b] = k.split(',').map(Number); if (n >= 2) { adj[a].add(b); adj[b].add(a); } }
// estreitos manuais (mar-mar)
const straits = [[[29.12, 41.3], [28.9, 40.85]], [[26.0, 39.9], [27.2, 40.55]], [[12.6, 56.2], [12.9, 55.4]], [[36.6, 45.55], [36.55, 45.0]], [[-5.8, 35.95], [-5.2, 36.0]], [[10.9, 57.6], [11.6, 57.2]]];
function seaNear(lon, lat) {
  const [x, y] = proj2(lon, lat); const c0 = Math.floor(x / R), r0 = Math.floor(y / R); let best = -1, bd = 1e9;
  for (let dr = -12; dr <= 12; dr++) for (let dc = -12; dc <= 12; dc++) { const rr = r0 + dr, cc = c0 + dc; if (rr < 0 || cc < 0 || rr >= GH || cc >= GW) continue; const l = label[rr * GW + cc]; if (l >= SEA_BASE) { const d = dr * dr + dc * dc; if (d < bd) { bd = d; best = l; } } }
  return best >= 0 ? nodeId(best) : -1;
}
for (const [p, q] of straits) { const a = seaNear(...p), b = seaNear(...q); if (a >= 0 && b >= 0 && a !== b) { adj[a].add(b); adj[b].add(a); } }

// ---------- polígonos das províncias (célula ∩ terra)
const vor = landDel.voronoi([0, 0, W, H]);
const landBoxes = landProj.map(poly => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; });
const provinces = [];
for (let i = 0; i < nL; i++) {
  const cell = vor.cellPolygon(i); if (!cell) { provinces.push(null); continue; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of cell) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const near = landProj.filter((p, k) => { const b = landBoxes[k]; return !(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1); });
  const cellC = cell.slice(0, -1);
  let inter = near.map(poly => poly.map(r => clipConvex(r.slice(0, -1), cellC)).filter(r => r.length >= 4)).filter(p => p.length);
  inter = inter.map(poly => poly.map(r => r.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]))).filter(poly => Math.abs(ringArea(poly[0])) > 15);
  // bordas internas (arestas de Voronoi) ficam irregulares, de forma idêntica nos dois vizinhos
  inter = inter.map(poly => poly.map(r => jitterRing(r, cellC)));
  provinces.push(inter);
}

// ---------- bordas irregulares
function onCellEdge(P, Q, cell) {
  for (let i = 0; i < cell.length; i++) {
    const A = cell[i], B = cell[(i + 1) % cell.length]; const dx = B[0] - A[0], dy = B[1] - A[1]; const L = Math.hypot(dx, dy) || 1;
    const d1 = Math.abs((P[0] - A[0]) * dy - (P[1] - A[1]) * dx) / L, d2 = Math.abs((Q[0] - A[0]) * dy - (Q[1] - A[1]) * dx) / L;
    if (d1 < 0.25 && d2 < 0.25) return true;
  }
  return false;
}
function hashRng(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function wiggle(P, Q) {
  // canônico: sempre do menor para o maior ponto, para os dois vizinhos gerarem a mesma linha
  const kP = P.join(','), kQ = Q.join(','); const flip = kP > kQ; const [A, B] = flip ? [Q, P] : [P, Q];
  const rnd = hashRng(kP < kQ ? kP + '|' + kQ : kQ + '|' + kP);
  let pts = [A, B];
  for (let depth = 0; depth < 6; depth++) {
    const out = [pts[0]]; let changed = false;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy);
      if (L > 7) { const off = (rnd() - 0.5) * L * 0.38; out.push([Math.round(((a[0] + b[0]) / 2 - dy / L * off) * 10) / 10, Math.round(((a[1] + b[1]) / 2 + dx / L * off) * 10) / 10]); changed = true; }
      out.push(b);
    }
    pts = out; if (!changed) break;
  }
  if (flip) pts.reverse();
  return pts;
}
function jitterRing(r, cell) {
  const out = [r[0]];
  for (let i = 1; i < r.length; i++) {
    const P = r[i - 1], Q = r[i];
    if (Math.hypot(Q[0] - P[0], Q[1] - P[1]) > 7 && onCellEdge(P, Q, cell)) out.push(...wiggle(P, Q).slice(1)); else out.push(Q);
  }
  return out;
}
// ---------- terreno
const MOUNTAINS = [
  [5.5, 44.0, 16.0, 47.6], [-1.8, 42.2, 3.2, 43.2], [22.0, 45.2, 26.8, 49.6], [18.4, 41.0, 23.5, 44.6], [5.0, 59.0, 13.5, 69.5],
  [39.5, 41.2, 48.5, 43.8], [28.5, 36.2, 44.5, 40.8], [42.0, 33.0, 50.0, 38.5], [-7.0, 30.5, -2.0, 33.5], [8.0, 42.0, 9.6, 43.1],
  [-5.3, 40.0, -2.0, 41.2], [-4.5, 42.6, -0.5, 43.2], [13.5, 37.6, 16.5, 41.5], [20.5, 37.0, 23.0, 40.5], [-5.5, 56.3, -3.0, 58.6], [56.0, 50.0, 60.0, 62.0]
];
const inBox = (lon, lat, b) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
function terrainFor(s, i) {
  const { lon, lat } = s;
  if (MOUNTAINS.some(b => inBox(lon, lat, b))) return rnd() < 0.7 ? 'montanha' : 'colina';
  if ((lat < 31.5 && lon > -2 && lon < 32 && !(lon > 29 && lon < 32.5 && lat > 29.5)) || (lat < 33 && lon > 36 && lon < 48 && !(lon > 43 && lon < 46.5)) || (lat < 31 && lon > 3) ) return 'deserto';
  if (s.pop > 600000) return 'urbano';
  if (lat > 58 || (lat > 54 && lon > 25 && rnd() < 0.5) || rnd() < 0.15) return 'floresta';
  if (rnd() < 0.18) return 'colina';
  return 'planicie';
}
// ---------- dono inicial (Voronoi ponderado com preferência por "núcleo")
const natIdx = Object.fromEntries(NATIONS.map((n, i) => [n.id, i]));
const caps = NATIONS.map(n => seeds.findIndex(s => s.capitalOf === n.id));
const owner = new Int32Array(nL).fill(-1);
const WEIGHT = { ale: 1.45, fra: 1.35, gbr: 1.25, rus: 1.3, aus: 1.15, ita: 1.2, tur: 1.1, esp: 1.1, hun: 1.0, por: 0.8, ser: 0.8, bul: 0.85, gre: 0.85, nor: 0.8, fin: 0.85, liv: 0.85 };
{
  const size = new Array(NATIONS.length).fill(1);
  caps.forEach((c, k) => owner[c] = k);
  // vizinhança por mar: províncias costeiras que tocam a mesma zona marítima
  const seaNb = Array.from({ length: nL }, () => new Set());
  for (let s = nL; s < adj.length; s++) { const coast = [...adj[s]].filter(b => b < nL); for (const a of coast) for (const b of coast) if (a !== b) seaNb[a].add(b); }
  let left = nL - caps.length; const stuck = new Set();
  while (left > 0) {
    let k = -1, bestRatio = 1e9;
    NATIONS.forEach((n, i) => { if (stuck.has(i)) return; const r = size[i] / (WEIGHT[n.id] || 1); if (r < bestRatio) { bestRatio = r; k = i; } });
    if (k < 0) break;
    const n = NATIONS[k], c = seeds[caps[k]];
    let best = -1, bs = 1e18;
    for (let i = 0; i < nL; i++) if (owner[i] === k) {
      for (const b of adj[i]) if (b < nL && owner[b] < 0) { const s = seeds[b]; const sc = Math.hypot(c.x - s.x, c.y - s.y) * (n.cores.includes(s.cc) ? 1 : 2.2); if (sc < bs) { bs = sc; best = b; } }
      for (const b of seaNb[i]) if (owner[b] < 0) { const s = seeds[b]; const sc = Math.hypot(c.x - s.x, c.y - s.y) * (n.cores.includes(s.cc) ? 1.6 : 3.5); if (sc < bs) { bs = sc; best = b; } }
    }
    if (best < 0) { stuck.add(k); continue; }
    owner[best] = k; size[k]++; left--;
  }
  // sobras (inalcançáveis): nação mais próxima
  for (let i = 0; i < nL; i++) if (owner[i] < 0) { let b = 0, bd = 1e18; caps.forEach((c, k) => { const d = Math.hypot(seeds[c].x - seeds[i].x, seeds[c].y - seeds[i].y); if (d < bd) { bd = d; b = k; } }); owner[i] = b; }
}
// corrige enclaves: província sem caminho terrestre até a capital vai para o vizinho mais comum
for (let pass = 0; pass < 8; pass++) {
  let changed = 0;
  NATIONS.forEach((n, k) => {
    const seen = new Set([caps[k]]); const q = [caps[k]];
    while (q.length) { const a = q.pop(); for (const b of adj[a]) if (b < nL && owner[b] === k && !seen.has(b)) { seen.add(b); q.push(b); } }
    for (let i = 0; i < nL; i++) if (owner[i] === k && !seen.has(i)) {
      const landNb = [...adj[i]].filter(b => b < nL);
      if (!landNb.length) continue; // ilha: mantém
      // se o componente inteiro é uma ilha (sem vizinho terrestre de outra nação), mantém
      const cnt = {}; landNb.forEach(b => { if (owner[b] !== k) cnt[owner[b]] = (cnt[owner[b]] || 0) + 1; });
      const e = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      if (e) { owner[i] = +e[0]; changed++; }
    }
  });
  if (!changed) break;
}
// ---------- recursos
const OIL = [[44.5, 39.5, 50.5, 41.5], [25.0, 44.5, 26.5, 45.5], [43.5, 42.8, 46.5, 44.0], [39.0, 44.0, 40.6, 45.0], [42.0, 34.5, 45.5, 36.8], [23.0, 49.0, 24.5, 49.6], [47.5, 29.5, 49.5, 31.5]];
const COAL = [[6.3, 50.8, 8.0, 51.8], [18.0, 49.7, 19.5, 50.6], [37.0, 47.5, 40.5, 49.0], [-3.8, 51.4, -2.8, 51.8], [-2.5, 53.2, -1.0, 54.0], [2.5, 50.2, 4.5, 50.7]];
const provOut = [];
const coastalSet = new Set();
for (let i = 0; i < nL; i++) if ([...adj[i]].some(b => b >= nL)) coastalSet.add(i);
for (let i = 0; i < nL; i++) {
  const s = seeds[i]; const terrain = terrainFor(s, i);
  let res;
  if (OIL.some(b => inBox(s.lon, s.lat, b))) res = 'petroleo';
  else if (COAL.some(b => inBox(s.lon, s.lat, b))) res = 'carvao';
  else {
    const w = { graos: 1, peixe: 0, ferro: 0.5, madeira: 0.6, carvao: 0.5, petroleo: 0.12, gas: 0.35 };
    if (terrain === 'planicie') w.graos += 1.4;
    if (terrain === 'floresta') w.madeira += 2;
    if (terrain === 'colina') { w.ferro += 1; w.carvao += 0.8; }
    if (terrain === 'montanha') { w.ferro += 1.5; w.carvao += 0.6; w.graos = 0.2; }
    if (terrain === 'deserto') { w.petroleo += 0.4; w.gas += 0.6; w.graos = 0.3; w.madeira = 0.05; }
    if (coastalSet.has(i)) w.peixe += 1.3;
    const tot = Object.values(w).reduce((a, b) => a + b, 0); let r = rnd() * tot; res = 'graos';
    for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) { res = k; break; } }
  }
  const name = PT_NAMES[s.name] || s.name;
  provOut.push({
    id: i, name, x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, cc: s.cc, pop: s.pop,
    city: s.pop > 250000 || !!s.capitalOf, capital: s.capitalOf || null,
    terrain, res, double: rnd() < 0.12, coastal: coastalSet.has(i), owner: NATIONS[owner[i]].id,
    poly: provinces[i] ? provinces[i].map(poly => poly.map(r => r.flat())) : [],
  });
}
// ---------- nomes dos mares
const SEA_NAMES = [
  ['Mar Cáspio', 45.5, 36, 56, 48], ['Mar de Azov', 34.5, 45.2, 39.5, 47.5], ['Mar de Mármara', 26.6, 40.2, 30, 41.2], ['Mar Negro', 27, 40.8, 42, 47],
  ['Mar Branco', 32, 63.5, 45, 67.5], ['Mar de Barents', 25, 68, 60, 80], ['Golfo de Bótnia', 16.5, 60.3, 26, 66.5], ['Golfo da Finlândia', 22, 59, 31, 60.8],
  ['Golfo de Riga', 21, 56.8, 24.8, 59], ['Mar Báltico', 9.5, 53.5, 22.5, 60.5], ['Kattegat', 9.5, 55.5, 12.9, 58], ['Escagerraque', 6.5, 57, 11, 59.5],
  ['Mar da Noruega', -10, 61.5, 20, 72], ['Mar do Norte', -4, 51, 9, 61.5], ['Canal da Mancha', -6, 48.5, 2, 51.2], ['Mar da Irlanda', -7, 51.5, -2.8, 55.5],
  ['Mar Celta', -12, 48, -5, 51.8], ['Golfo da Biscaia', -10, 43, -1, 48.5], ['Mar das Hébridas', -12, 55.5, -5, 60], ['Mar de Alborão', -6, 35, -1, 37.5],
  ['Mar Balear', -1, 37.5, 4.5, 42.5], ['Mar da Ligúria', 7, 42.5, 10.5, 44.5], ['Mar Tirreno', 9.5, 37.5, 16.5, 42.5], ['Mar Adriático', 12, 40, 20, 46],
  ['Mar Jônico', 15, 34.5, 22.5, 40.5], ['Mar Egeu', 22.5, 35.2, 28.5, 41], ['Mar de Creta', 22, 34.5, 28, 36.3], ['Mar de Levante', 28, 30, 37, 37.5],
  ['Golfo de Sidra', 14, 30, 22, 34], ['Mar da Sardenha', 4, 36.5, 9.5, 42], ['Canal da Sicília', 9.5, 35, 15.5, 37.6], ['Golfo Pérsico', 46, 26, 56, 31],
  ['Mar Mediterrâneo', -6, 30, 37, 45], ['Oceano Atlântico', -40, 25, 0, 75],
];
const seaOut = seaSeeds.map((k, j) => {
  const x = (k % GW + 0.5) * R, y = (((k / GW) | 0) + 0.5) * R; const [lon, lat] = proj.invert([x + X0, y + Y0]);
  const e = SEA_NAMES.find(([, a, b, c, d]) => lon >= a && lon <= c && lat >= b && lat <= d);
  return { id: nL + j, name: e ? e[0] : 'Mar Aberto', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
});
const cntName = {}; seaOut.forEach(s => cntName[s.name] = (cntName[s.name] || 0) + 1);
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const used = {}; seaOut.forEach(s => { if (cntName[s.name] > 1) { used[s.name] = (used[s.name] || 0) + 1; s.name += ' ' + (roman[used[s.name] - 1] || used[s.name]); } });

// ---------- raster de rótulos reduzido (10 km) p/ clique, RLE
const LR = 4; const LW = Math.ceil(GW / LR), LH = Math.ceil(GH / LR);
const small = new Int32Array(LW * LH).fill(-1);
for (let r = 0; r < LH; r++) for (let c = 0; c < LW; c++) { const rr = Math.min(GH - 1, r * LR + 2), cc = Math.min(GW - 1, c * LR + 2); const l = label[rr * GW + cc]; small[r * LW + c] = l < 0 ? -1 : nodeId(l); }
const rle = []; for (let i = 0; i < small.length;) { let j = i; while (j < small.length && small[j] === small[i]) j++; rle.push(small[i], j - i); i = j; }

// remove províncias sem polígono (não deve ocorrer)
const bad = provOut.filter(p => !p.poly.length).map(p => p.id); if (bad.length) console.log('sem polígono:', bad.map(i => provOut[i].name));
const out = {
  version: 1, W: Math.round(W), H: Math.round(H), R: R * LR,
  proj: { parallels: [38, 62], rotate: [-20, 0], center: [0, 49], scale: 6371, X0, Y0 },
  provinces: provOut, seas: seaOut, adj: adj.map(s => [...s]),
  grid: { w: LW, h: LH, rle },
};
fs.writeFileSync('assets/map.json', JSON.stringify(out));
const per = {}; provOut.forEach(p => per[p.owner] = (per[p.owner] || 0) + 1);
console.log('províncias por nação', per);
console.log('tamanho', (fs.statSync('assets/map.json').size / 1024).toFixed(0), 'KB');
const isolated = provOut.filter(p => adj[p.id].size === 0).map(p => p.name); console.log('isoladas', isolated);
console.log('mares sem vizinho mar', seaOut.filter(s => ![...adj[s.id]].some(b => b >= nL)).map(s => s.name));
