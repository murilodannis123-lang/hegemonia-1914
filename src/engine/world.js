// Prepara o mapa estático (nós, arestas, distâncias) a partir de assets/map.json.
export function prepareMap(raw) {
  const nL = raw.provinces.length;
  const nodes = [];
  raw.provinces.forEach(p => nodes.push({ id: p.id, x: p.x, y: p.y, land: true, name: p.name, terrain: p.terrain, coastal: p.coastal }));
  raw.seas.forEach(s => nodes.push({ id: s.id, x: s.x, y: s.y, land: false, name: s.name, terrain: 'mar' }));
  const adj = raw.adj.map((a, i) => a.map(j => ({ to: j, len: Math.max(20, Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)) })));
  // pontos de vitória
  raw.provinces.forEach(p => { p.vp = p.capital ? 5 : p.city ? 2 : 1; p.filler = !p.pop; });
  // grade de rótulos (para clique)
  const g = raw.grid; const cells = new Int32Array(g.w * g.h); let k = 0;
  for (let i = 0; i < g.rle.length; i += 2) { const v = g.rle[i], n = g.rle[i + 1]; for (let j = 0; j < n; j++) cells[k++] = v; }
  const M = { W: raw.W, H: raw.H, R: raw.R, nL, provinces: raw.provinces, seas: raw.seas, nodes, adj, grid: { w: g.w, h: g.h, cells }, proj: raw.proj };
  M.nodeAt = (x, y) => { const c = Math.floor(x / M.R), r = Math.floor(y / M.R); if (c < 0 || r < 0 || c >= g.w || r >= g.h) return -1; return cells[r * g.w + c]; };
  M.isLand = id => id >= 0 && id < nL;
  M.dist = (a, b) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
  M.edgeLen = (a, b) => { const e = adj[a].find(e => e.to === b); return e ? e.len : M.dist(a, b); };
  // províncias costeiras: zonas marítimas vizinhas
  M.seaNbrs = raw.provinces.map(p => raw.adj[p.id].filter(j => j >= nL));
  M.totalVP = raw.provinces.reduce((s, p) => s + p.vp, 0);
  return M;
}
