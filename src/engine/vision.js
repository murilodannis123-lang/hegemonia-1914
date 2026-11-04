// Névoa de guerra.
import { UNITS } from './defs.js';
import { stackDomain } from './state.js';
import { rel } from './sim.js';

export function friends(S, nat) {
  const set = new Set([nat]); const n = S.nations[nat];
  if (n && n.coalition && S.coalitions[n.coalition]) S.coalitions[n.coalition].members.forEach(m => set.add(m));
  return set;
}
export function computeVision(S, M, nat) {
  const fr = friends(S, nat);
  // nações que compartilham o mapa com a gente entram como "olhos" (sem virar aliadas)
  const eyesOf = new Set(fr); for (const k of Object.keys(S.sharedMap || {})) { const [a, b] = k.split('|'); if (a === nat) eyesOf.add(b); if (b === nat) eyesOf.add(a); }
  const spied = new Set((S.nations[nat]?.spies || []).filter(s => s.kind === 'info' && s.until > S.hour).map(s => s.target));
  const nodes = new Set(); const eyes = [];
  S.provinces.forEach((sp, i) => {
    if (eyesOf.has(sp.owner) || spied.has(sp.owner)) { nodes.add(i); for (const e of M.adj[i]) nodes.add(e.to); eyes.push({ x: M.nodes[i].x, y: M.nodes[i].y, r: 80 }); }
  });
  for (const st of S.stacks) if (eyesOf.has(st.nat)) {
    let v = 0; for (const u of Object.keys(st.units)) v = Math.max(v, UNITS[u].view);
    eyes.push({ x: st.x, y: st.y, r: v + 25 });
    if (stackDomain(st) !== 'air') { nodes.add(st.node); if (st.path.length) nodes.add(st.path[0]); }
  }
  // nós dentro do raio de algum olho
  for (const nd of M.nodes) if (!nodes.has(nd.id)) for (const e of eyes) { if (Math.hypot(nd.x - e.x, nd.y - e.y) <= e.r) { nodes.add(nd.id); break; } }
  return { nat, fr, spied, nodes, eyes };
}
export function stackVisible(S, M, vis, st) {
  if (!S.opts.fog) return true;
  if (vis.fr.has(st.nat) || vis.spied.has(st.nat)) return true;
  const stealth = Object.keys(st.units).every(u => UNITS[u].stealth);
  for (const e of vis.eyes) { const d = Math.hypot(st.x - e.x, st.y - e.y); if (d <= (stealth ? Math.min(e.r, 30) : e.r)) return true; }
  if (!stealth && stackDomain(st) !== 'air' && vis.nodes.has(st.node) && st.prog === 0) return true;
  return false;
}
