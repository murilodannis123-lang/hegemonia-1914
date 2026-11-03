// IA das nações.
import { UNITS, BUILDINGS, RES } from './defs.js';
import { rngNext, stackDomain, news, event } from './state.js';
import { rel, hostile, nname, day, stackPower, stackHP, canAfford, buildCost, unitUnlocked, buildUnlocked, nationIncome, relKey, findPath, stackRange, isEmbarked } from './sim.js';
import * as C from './commands.js';
import { bankTrade } from './market.js';
import { DIFFICULTY } from './state.js';

const diff = S => DIFFICULTY[S.opts.difficulty] || DIFFICULTY.normal;
export function nationPower(S, nat) { let p = 0; for (const st of S.stacks) if (st.nat === nat) p += stackPower(st); return p; }
function provsOf(S, nat) { const out = []; S.provinces.forEach((p, i) => { if (p.owner === nat) out.push(i); }); return out; }
function wars(S, nat) { return Object.keys(S.nations).filter(o => o !== nat && o !== 'reb' && S.nations[o].alive && rel(S, nat, o) === 'guerra'); }

export function aiTick(S, M) {
  for (const n of Object.values(S.nations)) {
    if (!n.ai || !n.alive || n.rebel) continue;
    if (S.hour < n.aiS.nextThink) continue;
    n.aiS.nextThink = S.hour + 3 + ((rngNext(S) * 3) | 0);
    try { thinkEconomy(S, M, n); thinkMilitary(S, M, n); thinkAir(S, M, n); thinkNavy(S, M, n); }
    catch (e) { if (typeof console !== 'undefined') console.error('IA', n.id, e); }
  }
}

// ---------------- economia
function thinkEconomy(S, M, n) {
  const nat = n.id; const provs = provsOf(S, nat); if (!provs.length) return;
  const d = day(S); const D = diff(S);
  const cap = n.capital >= 0 ? n.capital : provs[0];
  const reserve = 6000;
  const myWars = wars(S, nat);
  // ---- comércio de emergência
  for (const r of RES) if (r !== 'dinheiro' && n.res[r] < 1200 && n.res.dinheiro > 25000) bankTrade(S, nat, 'buy', r, 2500);
  if (n.res.dinheiro < 4000) for (const r of RES) if (r !== 'dinheiro' && n.res[r] > 20000) bankTrade(S, nat, 'sell', r, 5000);
  // ---- construções
  const rank = provs.slice().sort((a, b) => (M.provinces[b].vp * 3 + S.provinces[b].morale / 20 + (b === cap ? 10 : 0)) - (M.provinces[a].vp * 3 + S.provinces[a].morale / 20 + (a === cap ? 10 : 0)));
  const wants = [];
  const lvl = (p, b) => S.provinces[p].b[b] || 0;
  const count = b => provs.filter(p => lvl(p, b) > 0).length;
  if (count('recrutamento') < Math.min(6, 2 + provs.length / 4)) { const p = rank.find(p => !lvl(p, 'recrutamento')); if (p != null) wants.push([p, 'recrutamento', 9]); }
  if (lvl(cap, 'quartel') < 1) wants.push([cap, 'quartel', 8]);
  if (d >= 2 && count('oficina') < 1) wants.push([rank[0], 'oficina', 8]);
  if (d >= 4 && lvl(rank[0], 'oficina') === 1) wants.push([rank[0], 'oficina', 6]);
  if (d >= 4 && count('fabrica') < Math.min(3, 1 + provs.length / 8)) { const p = rank.find(p => !lvl(p, 'fabrica')); if (p != null) wants.push([p, 'fabrica', 6]); }
  if (d >= 9 && lvl(rank[0], 'fabrica') === 1) wants.push([rank[0], 'fabrica', 5]);
  if (d >= 5 && lvl(cap, 'quartel') === 1) wants.push([cap, 'quartel', 4]);
  if (d >= 3 && count('aerodromo') < 1) wants.push([rank[0], 'aerodromo', 4]);
  if (d >= 8 && count('aerodromo') >= 1) { const p = provs.find(p => lvl(p, 'aerodromo') === 1); if (p != null) wants.push([p, 'aerodromo', 3]); }
  if (d >= 4 && n.res.dinheiro > 60000) { const p = rank.find(p => !lvl(p, 'ferrovia')); if (p != null) wants.push([p, 'ferrovia', 3]); }
  if (d >= 6 && n.res.dinheiro > 90000 && count('fabrica') < provs.length / 3) { const p = rank.find(p => lvl(p, 'fabrica') < 1); if (p != null) wants.push([p, 'fabrica', 2]); }
  const coastal = provs.filter(p => M.provinces[p].coastal);
  if (coastal.length >= provs.length * 0.35 && count('porto') < 1) { const p = rank.find(p => M.provinces[p].coastal); if (p != null) wants.push([p, 'porto', 3]); }
  if (d >= 7 && count('porto') >= 1 && n.res.dinheiro > 40000) { const p = provs.find(p => lvl(p, 'porto') === 1); if (p != null) wants.push([p, 'porto', 2]); }
  // fortes em fronteiras ameaçadas
  if (myWars.length) for (const p of provs) {
    const th = threatAt(S, M, nat, p, 260);
    if (th > 12 && lvl(p, 'forte') < (p === cap ? 4 : 2)) wants.push([p, 'forte', 5 + Math.min(4, th / 10)]);
  }
  wants.sort((a, b) => b[2] - a[2]);
  let builds = 0;
  for (const [p, b] of wants) {
    if (builds >= 3) break;
    if (S.provinces[p].build) continue;
    const u = buildUnlocked(S, M, p, b); if (!u.ok) continue;
    const cost = buildCost(b, u.level);
    if (!canAffordReserve(n, cost, reserve)) continue;
    const r = C.build(S, M, nat, p, b); if (r.ok) builds++;
  }
  // ---- produção de tropas
  let units = 0; for (const st of S.stacks) if (st.nat === nat) for (const e of Object.values(st.units)) units += e.n;
  let queued = 0; for (const p of provs) queued += S.provinces[p].queue.length;
  const aggro = { agressivo: 1.3, equilibrado: 1.0, defensivo: 0.9, oportunista: 1.1 }[n.personality] * D.aiAggro;
  const target = Math.round((provs.length * 1.7 + d * 0.9 + 8) * aggro * (myWars.length ? 1.25 : 1));
  if (units + queued < target) {
    const mix = unitMix(S, M, n, provs);
    let made = 0;
    for (const p of rank) {
      if (made >= 4) break;
      const sp = S.provinces[p]; if (sp.queue.length >= 2) continue;
      // escolhe unidade pela mistura desejada, entre as disponíveis
      const opts = mix.filter(([u]) => unitUnlocked(S, M, p, u).ok);
      if (!opts.length) continue;
      const tot = opts.reduce((s, o) => s + o[1], 0); let r = rngNext(S) * tot; let pick = opts[0][0];
      for (const [u, w] of opts) { r -= w; if (r <= 0) { pick = u; break; } }
      if (!canAffordReserve(n, UNITS[pick].cost, reserve * 0.5) && n.res.dinheiro > 30000) {
        // compra no banco o que faltar
        for (const [r, v] of Object.entries(UNITS[pick].cost)) if (r !== 'dinheiro' && n.res[r] < v + 300) bankTrade(S, nat, 'buy', r, Math.ceil(v + 600 - n.res[r]));
      }
      if (!canAffordReserve(n, UNITS[pick].cost, reserve * 0.5)) { if (canAffordReserve(n, UNITS.infantaria.cost, 0) && unitUnlocked(S, M, p, 'infantaria').ok) pick = 'infantaria'; else continue; }
      const r2 = C.produce(S, M, nat, p, pick, 1); if (r2.ok) made++;
    }
  }
}
function canAffordReserve(n, cost, reserve) { for (const [r, v] of Object.entries(cost)) if (n.res[r] - v < (r === 'dinheiro' ? reserve : 300)) return false; return true; }
function unitMix(S, M, n, provs) {
  const d = day(S); const navalNeed = provs.filter(p => M.provinces[p].coastal).length / provs.length;
  const m = [['infantaria', 30], ['cavalaria', 8], ['artleve', 9], ['blindado', 9], ['artilharia', 10], ['choque', 9], ['tanqueleve', 12], ['tanquepesado', 8], ['antiaereo', 4], ['caca', 6], ['bombardeiro', 5], ['zepelim', 1], ['ferroviario', 1], ['cruzador', 6 * navalNeed], ['submarino', 4 * navalNeed], ['couracado', 3 * navalNeed], ['balao', 1]];
  if (d < 5) m[0][1] = 45;
  return m;
}

// ameaça: poder inimigo terrestre perto da província
function threatAt(S, M, nat, pid, R) {
  const p = M.nodes[pid]; let t = 0;
  for (const st of S.stacks) { if (!hostile(S, nat, st.nat) || stackDomain(st) === 'air') continue; const d = Math.hypot(st.x - p.x, st.y - p.y); if (d < R) t += stackPower(st) * (1 - d / R * 0.5); }
  return t;
}
function powerAt(S, nat, node) { let t = 0; for (const st of S.stacks) if (st.node === node && st.prog === 0 && stackDomain(st) !== 'air' && st.nat === nat) t += stackPower(st); return t; }
function hostilePowerAt(S, nat, node) { let t = 0; for (const st of S.stacks) if (st.node === node && st.prog === 0 && stackDomain(st) !== 'air' && hostile(S, nat, st.nat)) t += stackPower(st); return t; }

// ---------------- militar terrestre
function thinkMilitary(S, M, n) {
  const nat = n.id; const D = diff(S);
  const provs = provsOf(S, nat); if (!provs.length) return;
  const my = S.stacks.filter(s => s.nat === nat && stackDomain(s) === 'land');
  const aiS = n.aiS; aiS.targets = aiS.targets || {};
  // limpa alvos de pilhas mortas / alvos já tomados
  for (const id of Object.keys(aiS.targets)) { const st = my.find(s => s.id === +id); const t = aiS.targets[id]; if (!st || (M.isLand(t) && S.provinces[t].owner === nat) || (!st.path.length && st.node === t)) delete aiS.targets[id]; }
  // junta pilhas paradas no mesmo nó
  const idleBy = new Map();
  for (const st of my) if (!st.path.length && st.prog === 0 && !aiS.targets[st.id]) { const k = st.node; if (!idleBy.has(k)) idleBy.set(k, []); idleBy.get(k).push(st); }
  for (const [k, list] of idleBy) if (list.length > 1) { C.merge(S, M, nat, list.map(s => s.id)); }
  const idle = S.stacks.filter(s => s.nat === nat && stackDomain(s) === 'land' && !s.path.length && s.prog === 0 && !aiS.targets[s.id] && M.isLand(s.node));
  // tropas encalhadas em mar sem rumo: voltam para casa
  for (const st of S.stacks) if (st.nat === nat && stackDomain(st) === 'land' && !M.isLand(st.node) && !st.path.length) { const home = nearest(M, st.node, provs); if (home != null) C.move(S, M, nat, st.id, home); }
  const myWars = wars(S, nat);
  const enemiesInside = S.stacks.filter(s => s.prog === 0 && M.isLand(s.node) && S.provinces[s.node].owner === nat && hostile(S, nat, s.nat));
  // 1) rebeldes e invasores dentro do território: contra-ataque
  const used = new Set();
  for (const e of enemiesInside) {
    const need = stackPower(e) * 1.3;
    const group = gather(S, M, idle.filter(s => !used.has(s.id)), e.node, need, 900);
    if (group) for (const s of group) { if (C.move(S, M, nat, s.id, e.node).ok) { used.add(s.id); aiS.targets[s.id] = e.node; } }
  }
  // províncias tomadas por rebeldes
  const rebProvs = S.provinces.map((p, i) => [p, i]).filter(([p, i]) => p.owner === 'reb' && M.adj[i].some(e => M.isLand(e.to) && S.provinces[e.to].owner === nat)).map(([, i]) => i);
  for (const t of rebProvs) {
    const need = hostilePowerAt(S, nat, t) * 1.3 + 1; const group = gather(S, M, idle.filter(s => !used.has(s.id)), t, need, 700);
    if (group) for (const s of group) if (C.move(S, M, nat, s.id, t).ok) { used.add(s.id); aiS.targets[s.id] = t; }
  }
  // 2) defesa: fronteiras ameaçadas recebem reforço
  const free = () => idle.filter(s => !used.has(s.id));
  const border = provs.filter(p => M.adj[p].some(e => M.isLand(e.to) && S.provinces[e.to].owner !== nat));
  const threatened = border.map(p => [p, threatAt(S, M, nat, p, 220) - powerAt(S, nat, p)]).filter(x => x[1] > 2).sort((a, b) => b[1] - a[1]);
  for (const [p, deficit] of threatened.slice(0, 3)) {
    const group = gather(S, M, free(), p, deficit * 0.8, 500, true);
    if (group) for (const s of group) { if (s.node === p) { used.add(s.id); continue; } if (C.move(S, M, nat, s.id, p).ok) { used.add(s.id); aiS.targets[s.id] = p; } }
  }
  // guarda mínima na capital
  const cap = n.capital; if (cap >= 0) { const g = idle.find(s => s.node === cap); if (g) used.add(g.id); }
  if (!myWars.length) {
    // em paz: distribui tropas pelas fronteiras
    for (const s of free()) { if (border.includes(s.node) || rngNext(S) < 0.6) continue; const b = border.length ? border[(rngNext(S) * border.length) | 0] : null; if (b != null) C.move(S, M, nat, s.id, b); }
    return;
  }
  // 3) ofensiva
  const smart = D.aiSmart;
  const cands = [];
  for (let i = 0; i < S.provinces.length; i++) {
    const sp = S.provinces[i]; if (!hostile(S, nat, sp.owner)) continue;
    // perto do território
    let near = 1e9; for (const p of border.length ? border : provs) { const d = M.dist(p, i); if (d < near) near = d; }
    if (near > 650) continue;
    const def = hostilePowerAt(S, nat, i) + (S.provinces[i].b.forte || 0) * 3;
    const val = M.provinces[i].vp * 4 + (S.nations[sp.owner].capital === i ? 6 : 0) + (def < 1 ? 6 : 0) - near / 120 - def * 0.25 * smart;
    cands.push([i, val, def]);
  }
  cands.sort((a, b) => b[1] - a[1]);
  const maxOps = Math.max(1, Math.min(4, Math.round(provs.length / 6)));
  let ops = Object.values(aiS.targets).filter((t, i, a) => a.indexOf(t) === i).length;
  const aggroF = ({ agressivo: 1.15, equilibrado: 1.35, defensivo: 1.6, oportunista: 1.3 }[n.personality]) / Math.max(0.6, D.aiAggro);
  for (const [t, , def] of cands) {
    if (ops >= maxOps) break;
    const need = Math.max(1, def * aggroF + 1);
    const group = gather(S, M, free(), t, need, 750);
    if (!group) continue;
    let sent = 0;
    for (const s of group) if (C.move(S, M, nat, s.id, t).ok) { used.add(s.id); aiS.targets[s.id] = t; sent++; }
    if (sent) ops++;
  }
}
function nearest(M, from, list) { let b = null, bd = 1e9; for (const p of list) { const d = M.dist(from, p); if (d < bd) { bd = d; b = p; } } return b; }
// junta pilhas próximas até somar 'need' de poder; deixa 1 unidade de guarda se a pilha estiver numa fronteira
function gather(S, M, pool, target, need, maxDist, partialOk = false) {
  const list = pool.map(s => [s, M.dist(s.node, target)]).filter(x => x[1] <= maxDist).sort((a, b) => a[1] - b[1]);
  const out = []; let pw = 0;
  for (const [s] of list) { if (pw >= need) break; out.push(s); pw += stackPower(s); }
  if (pw >= need || (partialOk && pw > 0)) return out;
  return null;
}

// ---------------- aviação
function thinkAir(S, M, n) {
  const nat = n.id; const air = S.stacks.filter(s => s.nat === nat && stackDomain(s) === 'air' && !s.mission);
  if (!air.length) return;
  const myWars = wars(S, nat); if (!myWars.length) return;
  for (const st of air) {
    const base = M.nodes[st.base]; const range = stackRange(st);
    const types = Object.keys(st.units);
    const fighter = types.includes('caca') || types.includes('balao');
    // alvo: pilha inimiga mais forte dentro do alcance (bombardeiros) ou fronteira ameaçada (caças)
    let best = null, bv = 0;
    for (const o of S.stacks) {
      if (!hostile(S, nat, o.nat)) continue; const d = Math.hypot(o.x - base.x, o.y - base.y); if (d > range * 0.9) continue;
      const v = (stackDomain(o) === 'air' ? (fighter ? 3 : 0.2) : 1) * stackPower(o) / (1 + d / 400);
      if (v > bv) { bv = v; best = o; }
    }
    if (!best) continue;
    const hp = stackHP(st); if (hp.hp / hp.max < 0.5) continue;
    if (fighter) C.airMission(S, M, nat, st.id, 'patrol', best.x, best.y);
    else C.airMission(S, M, nat, st.id, 'strike', best.x, best.y);
  }
}
// ---------------- marinha
function thinkNavy(S, M, n) {
  const nat = n.id; const ships = S.stacks.filter(s => s.nat === nat && stackDomain(s) === 'sea' && !s.path.length);
  if (!ships.length) return;
  for (const st of ships) {
    let best = null, bd = 1e9;
    for (const o of S.stacks) { if (!hostile(S, nat, o.nat) || stackDomain(o) === 'air') continue; if (M.isLand(o.node) && o.prog === 0) continue; const d = Math.hypot(o.x - st.x, o.y - st.y); if (d < bd && d < 900) { bd = d; best = o; } }
    if (best && stackPower(st) > stackPower(best) * 0.8) { const target = best.prog > 0 && best.path.length && !M.isLand(best.path[0]) ? best.path[0] : best.node; if (!M.isLand(target)) C.move(S, M, nat, st.id, target); continue; }
    // bombardeio costeiro: vai para perto de província inimiga
    if (wars(S, nat).length && rngNext(S) < 0.3) {
      const coast = S.provinces.map((p, i) => i).filter(i => hostile(S, nat, S.provinces[i].owner) && M.seaNbrs[i].length);
      const t = nearest(M, st.node, coast); if (t != null && M.dist(t, st.node) < 1200) { const sea = M.seaNbrs[t][0]; C.move(S, M, nat, st.id, sea); }
    }
  }
}

// ---------------- diplomacia diária
export function aiDaily(S, M) {
  const d = day(S); const D = diff(S);
  S.warStart = S.warStart || {};
  const alive = Object.values(S.nations).filter(n => n.alive && !n.rebel);
  const power = {}; for (const n of alive) power[n.id] = nationPower(S, n.id) + provsOf(S, n.id).length * 1.5;
  const neigh = {}; // nações vizinhas por terra ou mar curto
  for (const n of alive) neigh[n.id] = new Set();
  S.provinces.forEach((sp, i) => { for (const e of M.adj[i]) { if (!M.isLand(e.to)) continue; const o = S.provinces[e.to].owner; if (o !== sp.owner && o !== 'reb' && sp.owner !== 'reb') { neigh[sp.owner]?.add(o); } } });
  // vizinhos por mar (costas a menos de 350 km)
  for (const n of alive) for (const m of alive) if (n !== m && !neigh[n.id].has(m.id)) {
    const a = S.nations[n.id].capital, b = S.nations[m.id].capital; if (a >= 0 && b >= 0 && M.dist(a, b) < 700) neigh[n.id].add(m.id);
  }
  const P = S.opts.player;
  for (const n of alive) {
    if (!n.ai) continue;
    const nat = n.id; const my = power[nat];
    const ws = wars(S, nat);
    // opinião deriva para neutra
    for (const k of Object.keys(n.opinion)) n.opinion[k] *= 0.97;
    // ---- paz se estiver perdendo
    for (const w of ws) {
      const ratio = my / Math.max(1, power[w]); const k = relKey(nat, w); if (S.warStart[k] == null) S.warStart[k] = S.hour;
      const len = (S.hour - S.warStart[k]) / 24;
      if ((ratio < 0.55 && len > 2) || (len > 12 && ratio < 1.1 && rngNext(S) < 0.08)) {
        if (S.nations[w].ai) { const a = aiAnswer(S, M, w, nat, 'paz'); if (a.accept) { C.setRel(S, nat, w, 'paz'); news(S, `${nname(nat)} e ${nname(w)} assinam a paz.`, 'paz', { title: `Paz entre ${nname(nat)} e ${nname(w)}`, nats: [nat, w] }); C.communique(S, nat, 'paz', w); } }
        else if (!S.proposals.some(p => p.from === nat && p.to === w && p.type === 'paz') && rngNext(S) < 0.35) C.propose(S, M, nat, w, 'paz');
      }
    }
    // ---- declarar guerra
    const maxWars = { agressivo: 2, equilibrado: 1, defensivo: 1, oportunista: 2 }[n.personality];
    const minDay = n.aiS.warDay + (S.opts.difficulty === 'facil' ? 3 : 0);
    if (d >= minDay && ws.length < maxWars && rngNext(S) < 0.25 * D.aiAggro) {
      const thr = { agressivo: 1.0, equilibrado: 1.25, defensivo: 1.6, oportunista: 1.3 }[n.personality] / D.aiAggro * (d < 8 ? 1.15 : 1);
      let best = null, bs = 0;
      for (const o of neigh[nat]) {
        if (!S.nations[o]?.alive || rel(S, nat, o) !== 'paz' && rel(S, nat, o) !== 'passagem') continue;
        const r = my / Math.max(1, power[o]);
        // oportunista prefere quem já está em guerra
        const busy = wars(S, o).length;
        let sc = r * (1 + busy * (n.personality === 'oportunista' ? 0.5 : 0.2)) - (n.opinion[o] || 0) / 100;
        if (o === S.opts.player && S.opts.difficulty === 'facil') sc *= 0.7;
        if (r >= thr && sc > bs) { bs = sc; best = o; }
      }
      if (best) { C.declareWar(S, M, nat, best); S.warStart[relKey(nat, best)] = S.hour; }
    }
    // ---- coligações: quem tem inimigo comum se junta
    if (!n.coalition && d >= 3 && rngNext(S) < 0.07) {
      for (const o of neigh[nat]) {
        const on = S.nations[o]; if (!on?.alive || !on.ai || rel(S, nat, o) === 'guerra') continue;
        const common = ws.some(w => rel(S, o, w) === 'guerra');
        if (!common && (n.opinion[o] || 0) < 30) continue;
        if (on.coalition) { const c = S.coalitions[on.coalition]; if (c && c.members.length < 4 && !c.members.includes(S.opts.player)) { C.joinCoalition(S, M, nat, c.id); break; } }
        else { C.createCoalition(S, M, nat, coalName(S)); C.joinCoalition(S, M, o, n.coalition); break; }
      }
    }
    // ---- convite ao jogador (quando têm inimigo comum)
    if (n.coalition && S.nations[P] && S.nations[P].alive && !S.nations[P].coalition && rngNext(S) < 0.05) {
      const c = S.coalitions[n.coalition];
      if (c && c.members.length < 4 && ws.some(w => rel(S, P, w) === 'guerra') && rel(S, nat, P) !== 'guerra' && !S.proposals.some(p => p.type === 'coligacao' && p.to === P)) C.inviteCoalition(S, M, nat, P);
    }
    // ---- aliados de coligação entram nas guerras dos parceiros
    if (n.coalition && S.coalitions[n.coalition] && ws.length < 3 && rngNext(S) < 0.25) {
      for (const m of S.coalitions[n.coalition].members) if (m !== nat) for (const w of wars(S, m)) {
        if (rel(S, nat, w) === 'paz' && power[nat] > power[w] * 0.5 && (neigh[nat].has(w) || rngNext(S) < 0.3)) { C.declareWar(S, M, nat, w); break; }
      }
    }
    // ---- IA que gosta do jogador propõe aliança
    if (S.nations[P]?.alive && !n.coalition && (n.opinion[P] || 0) >= 45 && rel(S, nat, P) !== 'guerra' && rngNext(S) < 0.12 && !S.proposals.some(p => p.from === nat && p.to === P)) {
      if (S.nations[P].coalition) { const c = S.coalitions[S.nations[P].coalition]; if (c && c.members.length < 4) S.proposals.push({ id: S.hour * 100 + S.proposals.length, from: nat, to: P, type: 'entrar', coal: c.id, h: S.hour }), event(S, P, `${nname(nat)} quer entrar na sua coligação "${c.name}".`, 'diplomacia'); }
      else { S.proposals.push({ id: S.hour * 100 + S.proposals.length, from: nat, to: P, type: 'alianca', h: S.hour }); event(S, P, `${nname(nat)} propõe uma aliança (nova coligação).`, 'diplomacia'); }
    }
    if (rngNext(S) < 0.04) C.communique(S, nat, 'provocacao');
    // opinião: vizinhos em paz melhoram aos poucos
    for (const o of neigh[nat]) if (rel(S, nat, o) === 'paz') C.opinion(S, nat, o, 1);
  }
  // propostas antigas expiram (2 dias)
  S.proposals = S.proposals.filter(p => S.hour - p.h < 48);
}
const COAL_NAMES = ['Tríplice Aliança', 'Entente Cordial', 'Liga do Norte', 'Pacto do Danúbio', 'União Balcânica', 'Liga Mediterrânea', 'Aliança Oriental', 'Pacto Báltico', 'Liga Ibérica', 'Concerto das Nações'];
function coalName(S) { const used = new Set(Object.values(S.coalitions).map(c => c.name)); return COAL_NAMES.find(n => !used.has(n)) || 'Liga ' + S.nextCoal; }

// resposta da IA a propostas
export function aiAnswer(S, M, ai, from, type) {
  const n = S.nations[ai]; const op = n.opinion[from] || 0;
  const pw = nationPower(S, ai) + provsOf(S, ai).length * 1.5, pf = nationPower(S, from) + provsOf(S, from).length * 1.5;
  const ratio = pw / Math.max(1, pf);
  S.warStart = S.warStart || {};
  const len = (S.hour - (S.warStart[relKey(ai, from)] ?? S.hour)) / 24;
  const name = nname(ai);
  if (type === 'paz') {
    const accept = ratio < 0.8 || (len > 4 && ratio < 1.3 && rngNext(S) < 0.5) || (n.personality === 'defensivo' && len > 2 && ratio < 1.6) || op > 30;
    return { accept, text: accept ? `${name}: "Aceitamos a paz. Que as armas se calem."` : `${name}: "${ratio > 1.5 ? 'Paz? Estamos vencendo esta guerra.' : 'Ainda não é hora de paz.'}"` };
  }
  if (type === 'passagem') {
    const accept = op >= 15 || (ratio < 0.5 && op > -20);
    return { accept, text: accept ? `${name}: "Suas tropas podem atravessar nosso território."` : `${name}: "Não permitiremos tropas estrangeiras em nosso solo."` };
  }
  if (type === 'coligacao') {
    const common = wars(S, from).some(w => rel(S, ai, w) === 'guerra');
    const accept = rel(S, ai, from) !== 'guerra' && (common || op >= 25) && !n.coalition;
    return { accept, text: accept ? `${name}: "Juntos venceremos. Contem conosco."` : `${name}: "Não vemos vantagem nessa aliança."` };
  }
  return { accept: false, text: `${name} não respondeu.` };
}
