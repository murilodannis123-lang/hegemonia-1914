// Simulação: um passo = 1 hora de jogo.
import { UNITS, BUILDINGS, TERRAIN, FORT_REDUCTION, CATS, NEED_PER_PROV, BASE_MONEY, BASE_RES, RES, TRANSPORT_SPEED, EMBARK_DEF, MELEE_RANGE, PATROL_RADIUS } from './defs.js';
import { rngNext, addStack, addUnitsAt, stackDomain, news, event } from './state.js';
import { NATION_BY_ID } from '../data/nations.js';

// ---------------- relações
export const relKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export function rel(S, a, b) {
  if (a === b) return 'self';
  if (a === 'reb' || b === 'reb') return 'guerra';
  const na = S.nations[a], nb = S.nations[b];
  if (na && nb && na.coalition && na.coalition === nb.coalition) return 'aliado';
  return S.rel[relKey(a, b)] || 'paz';
}
export const hostile = (S, a, b) => a !== b && rel(S, a, b) === 'guerra';
export function canEnter(S, nat, owner) { if (owner === nat) return true; const r = rel(S, nat, owner); return r === 'guerra' || r === 'aliado' || r === 'passagem'; }
export const nname = id => id === 'reb' ? 'Rebeldes' : (NATION_BY_ID[id] ? NATION_BY_ID[id].name : id);
export const day = S => Math.floor(S.hour / 24) + 1;

// ---------------- stacks
export function stackHP(st) { let h = 0, m = 0; for (const [u, e] of Object.entries(st.units)) { h += e.hp; m += e.n * UNITS[u].hp; } return { hp: h, max: m }; }
export function stackCount(st) { let n = 0; for (const e of Object.values(st.units)) n += e.n; return n; }
export function stackSpeed(S, st) { let s = 1e9; for (const u of Object.keys(st.units)) s = Math.min(s, UNITS[u].spd); return s === 1e9 ? 30 : s; }
export function stackRange(st) { let r = 1e9; for (const u of Object.keys(st.units)) if (UNITS[u].range) r = Math.min(r, UNITS[u].range); return r === 1e9 ? 0 : r; }
export function stackView(st) { let v = 0; for (const u of Object.keys(st.units)) v = Math.max(v, UNITS[u].view); return v; }
export function isEmbarked(M, st) { return stackDomain(st) === 'land' && (!M.isLand(st.node) || (st.prog > 0 && st.path.length && !M.isLand(st.path[0]))); }
export function stackPos(M, st, extra = 0) {
  if (stackDomain(st) === 'air') return { x: st.x, y: st.y };
  const a = M.nodes[st.node];
  if (!st.path.length || st.prog <= 0 && !extra) return { x: a.x, y: a.y };
  const b = M.nodes[st.path[0]]; const L = M.edgeLen(st.node, st.path[0]); const t = Math.min(1, (st.prog + extra) / L);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
// força aproximada (para IA e UI)
export function stackPower(st) { let p = 0; for (const [u, e] of Object.entries(st.units)) { const d = UNITS[u]; const hpF = e.hp / (e.n * d.hp); p += e.n * hpF * (d.atk.inf + d.atk.arm + d.def.inf + d.def.arm) * 0.25 * Math.sqrt(d.hp / 15); } return p; }

// ---------------- caminhos
function nodeSpeedFactor(S, M, nat, node, land) {
  if (!land) return 1;
  const n = M.nodes[node]; let f = TERRAIN[n.terrain].move;
  const sp = S.provinces[node];
  if (sp && sp.owner === nat && sp.b.ferrovia) f *= 1.6;
  return f;
}
export function findPath(S, M, st, target) {
  const dom = stackDomain(st), nat = st.nat;
  const start = st.node;
  if (start === target) return [];
  const spd = stackSpeed(S, st);
  const allowed = j => {
    if (dom === 'sea') return !M.isLand(j);
    if (!M.isLand(j)) return true;
    return canEnter(S, nat, S.provinces[j].owner);
  };
  if (!allowed(target)) return null;
  const dist = new Map([[start, 0]]); const prev = new Map(); const done = new Set();
  const heap = [[0, start]];
  const hpush = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const hpop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, a] = hpop();
    if (done.has(a)) continue; done.add(a);
    if (a === target) break;
    for (const e of M.adj[a]) {
      const b = e.to; if (done.has(b) || !allowed(b)) continue;
      const landB = M.isLand(b), landA = M.isLand(a);
      let v = dom === 'land' && (!landB || !landA) ? TRANSPORT_SPEED : spd * nodeSpeedFactor(S, M, nat, b, landB);
      let cost = e.len / v;
      if (dom === 'land' && landA !== landB) cost += 3; // embarque/desembarque
      const nd = d + cost;
      if (nd < (dist.has(b) ? dist.get(b) : 1e18)) { dist.set(b, nd); prev.set(b, a); hpush([nd, b]); }
    }
  }
  if (!prev.has(target)) return null;
  const path = []; let c = target; while (c !== start) { path.unshift(c); c = prev.get(c); }
  return path;
}

// ---------------- economia
export function provIncome(S, M, pid) {
  const p = M.provinces[pid], sp = S.provinces[pid];
  if (sp.owner === 'reb') return { money: 0, res: 0 };
  let mult = sp.morale / 100;
  if (sp.owner !== sp.core) mult *= 0.6;
  if (p.filler || p.terrain === 'deserto') mult *= 0.65;
  let bonus = 1 + (sp.b.fabrica || 0) * 0.15 + (sp.b.ferrovia ? 0.25 : 0) + (sp.b.porto ? 0.1 : 0);
  const moneyM = p.capital && S.nations[sp.owner].capital === pid ? 1.8 : p.city ? 1.35 : 1;
  return { money: BASE_MONEY * mult * moneyM * bonus, res: BASE_RES * mult * (p.double ? 2 : 1) * bonus, type: p.res };
}
export function nationIncome(S, M, nat) {
  const out = Object.fromEntries(RES.map(r => [r, 0]));
  S.provinces.forEach((sp, i) => { if (sp.owner !== nat) return; const inc = provIncome(S, M, i); out.dinheiro += inc.money; out[inc.type] += inc.res; });
  const nProv = S.provinces.filter(sp => sp.owner === nat).length;
  // consumo diário estimado
  const cons = Object.fromEntries(RES.map(r => [r, 0]));
  for (const [cat, list] of Object.entries(CATS)) { const need = NEED_PER_PROV[cat] * nProv; const n = S.nations[nat]; const tot = list.reduce((s, r) => s + n.res[r] + out[r], 0) || 1; for (const r of list) cons[r] += need * (n.res[r] + out[r]) / tot; }
  let up = 0; for (const st of S.stacks) if (st.nat === nat) for (const [u, e] of Object.entries(st.units)) up += UNITS[u].upkeep * e.n;
  cons.dinheiro += up;
  return { prod: out, cons, nProv };
}
export function canAfford(n, cost, mult = 1) { for (const [r, v] of Object.entries(cost)) if (n.res[r] < v * mult - 1e-6) return false; return true; }
export function pay(n, cost, mult = 1) { for (const [r, v] of Object.entries(cost)) n.res[r] -= v * mult; }
export function refund(n, cost, frac = 1) { for (const [r, v] of Object.entries(cost)) n.res[r] += v * frac; }

export function buildCost(type, level) { const b = BUILDINGS[type]; const m = level; return Object.fromEntries(Object.entries(b.cost).map(([r, v]) => [r, Math.round(v * m)])); }
export function buildTime(S, pid, type, level) { const sp = S.provinces[pid]; return BUILDINGS[type].time * level * (1 + (1 - sp.morale / 100) * 0.5) / S.opts.prodSpeed; }
export function unitTime(S, pid, u) {
  const sp = S.provinces[pid], d = UNITS[u]; let t = d.time;
  if (d.cls === 'inf' && d.dom === 'land') t *= 1 - 0.2 * (sp.b.quartel || 0);
  if (d.cls === 'arm' || ['artleve', 'artilharia', 'antiaereo'].includes(u)) t *= 1 - 0.15 * Math.max(0, (sp.b.oficina || 0) - 1);
  t *= 1 + (1 - sp.morale / 100) * 0.5;
  const n = S.nations[sp.owner]; if (n && n.ai) t /= aiProdMult(S);
  return Math.max(0.5, t / S.opts.prodSpeed);
}
export function aiProdMult(S) { return { facil: 0.8, normal: 1.0, dificil: 1.25 }[S.opts.difficulty] || 1; }
export function unitUnlocked(S, M, pid, u) {
  const d = UNITS[u], sp = S.provinces[pid];
  if (!S.opts.unlockAll && day(S) < d.day) return { ok: false, why: `Disponível no dia ${d.day}` };
  const [b, l] = d.req; if ((sp.b[b] || 0) < l) return { ok: false, why: `Requer ${BUILDINGS[b].name}${BUILDINGS[b].max > 1 ? ' nível ' + l : ''}` };
  if (d.req2) { const [b2, l2] = d.req2; if ((sp.b[b2] || 0) < l2) return { ok: false, why: `Requer ${BUILDINGS[b2].name}` }; }
  if (d.dom === 'sea' && !M.provinces[pid].coastal) return { ok: false, why: 'Província sem costa' };
  return { ok: true };
}
export function buildUnlocked(S, M, pid, type) {
  const b = BUILDINGS[type], sp = S.provinces[pid]; const lvl = (sp.b[type] || 0) + 1;
  if (lvl > b.max) return { ok: false, why: 'Nível máximo', max: true };
  if (b.coastal && !M.provinces[pid].coastal) return { ok: false, why: 'Província sem costa' };
  if (!S.opts.unlockAll && day(S) < b.day) return { ok: false, why: `Disponível no dia ${b.day}` };
  return { ok: true, level: lvl };
}

function hourlyEconomy(S, M) {
  for (let i = 0; i < S.provinces.length; i++) {
    const sp = S.provinces[i]; if (sp.owner === 'reb') continue;
    const n = S.nations[sp.owner]; const inc = provIncome(S, M, i);
    n.res.dinheiro += inc.money / 24; n.res[inc.type] += inc.res / 24;
  }
}

function dailyEconomy(S, M) {
  const counts = {}; S.provinces.forEach(sp => counts[sp.owner] = (counts[sp.owner] || 0) + 1);
  const up = {}; for (const st of S.stacks) for (const [u, e] of Object.entries(st.units)) up[st.nat] = (up[st.nat] || 0) + UNITS[u].upkeep * e.n;
  for (const n of Object.values(S.nations)) {
    if (!n.alive || n.rebel) continue;
    const np = counts[n.id] || 0;
    for (const [cat, list] of Object.entries(CATS)) {
      let need = NEED_PER_PROV[cat] * np; const have = list.reduce((s, r) => s + Math.max(0, n.res[r]), 0);
      const take = Math.min(need, have); n.lastFulfil[cat] = need ? take / need : 1;
      // consome proporcional ao estoque
      for (const r of list) { const share = have ? Math.max(0, n.res[r]) / have : 0; n.res[r] -= take * share; }
    }
    n.res.dinheiro -= up[n.id] || 0;
    n.lastFulfil.dinheiro = n.res.dinheiro >= 0 ? 1 : 0;
    if (n.res.dinheiro < 0) n.res.dinheiro = 0;
    if (S.opts.resources === 'infinito' && !n.ai) RES.forEach(r => n.res[r] = Math.max(n.res[r], 9e8));
  }
}

function capitalDist(S, M, pid) {
  const n = S.nations[S.provinces[pid].owner]; if (!n || n.capital < 0) return 2000;
  return M.dist(pid, n.capital);
}
export function moraleTarget(S, M, pid) {
  const sp = S.provinces[pid], n = S.nations[sp.owner]; if (!n || n.rebel) return 50;
  let t = sp.owner === sp.core ? 72 : 48;
  t += 26 * Math.max(0, 1 - capitalDist(S, M, pid) / 1300);
  if (n.capital === pid) t += 10;
  const wars = Object.keys(S.nations).filter(o => o !== n.id && o !== 'reb' && S.nations[o].alive && rel(S, n.id, o) === 'guerra').length;
  t -= Math.min(15, wars * 4);
  for (const cat of Object.keys(CATS)) t -= (1 - (n.lastFulfil[cat] ?? 1)) * 22;
  if (n.lastFulfil.dinheiro === 0) t -= 10;
  if (S.hour - sp.lastCapture < 72) t -= 10;
  return Math.max(5, Math.min(100, t));
}
function dailyMorale(S, M) {
  for (let i = 0; i < S.provinces.length; i++) {
    const sp = S.provinces[i]; if (sp.owner === 'reb') continue;
    const t = moraleTarget(S, M, i); const d = t - sp.morale; sp.morale += Math.sign(d) * Math.min(Math.abs(d), 7);
    // rebelião
    if (sp.morale < 25 && S.nations[sp.owner].capital !== i && rngNext(S) < (25 - sp.morale) / 45) {
      const n = 2 + ((rngNext(S) * 3) | 0);
      addStack(S, M, 'reb', i, { infantaria: n });
      event(S, sp.owner, `Rebelião em ${M.provinces[i].name}! A moral baixa levou ${n} batalhões de rebeldes às ruas.`, 'alerta', i);
      news(S, `Revolta em ${M.provinces[i].name} (${nname(sp.owner)}).`, 'rebeliao');
    }
  }
}
function dailyHeal(S, M) {
  for (const st of S.stacks) {
    if (st.nat === 'reb') continue;
    let own = false; if (stackDomain(st) === 'air') own = !st.mission; else if (M.isLand(st.node)) own = S.provinces[st.node].owner === st.nat;
    const f = own ? 0.12 : 0.03;
    for (const [u, e] of Object.entries(st.units)) e.hp = Math.min(e.n * UNITS[u].hp, e.hp + e.n * UNITS[u].hp * f);
  }
}

// ---------------- produção e construção
function hourlyProduction(S, M) {
  for (let i = 0; i < S.provinces.length; i++) {
    const sp = S.provinces[i]; if (sp.owner === 'reb') continue;
    if (sp.build) {
      sp.build.left -= 1;
      if (sp.build.left <= 0) {
        sp.b[sp.build.type] = sp.build.level;
        event(S, sp.owner, `${BUILDINGS[sp.build.type].name}${BUILDINGS[sp.build.type].max > 1 ? ' nível ' + sp.build.level : ''} concluído em ${M.provinces[i].name}.`, 'construcao', i);
        sp.build = null;
      }
    }
    if (sp.queue.length) {
      const q = sp.queue[0]; q.left -= 1;
      if (q.left <= 0) {
        sp.queue.shift();
        spawnUnit(S, M, sp.owner, i, q.u);
        event(S, sp.owner, `${UNITS[q.u].name} pronta em ${M.provinces[i].name}.`, 'producao', i);
        if (sp.queue[0]) sp.queue[0].left = sp.queue[0].total = unitTime(S, i, sp.queue[0].u);
      }
    }
  }
}
export function spawnUnit(S, M, nat, pid, u) {
  const d = UNITS[u];
  if (d.dom === 'sea') {
    const seas = M.seaNbrs[pid]; if (!seas.length) return;
    const sea = seas.find(s => !S.stacks.some(o => o.node === s && hostile(S, nat, o.nat))) ?? seas[0];
    return addUnitsAt(S, M, nat, sea, { [u]: 1 });
  }
  return addUnitsAt(S, M, nat, pid, { [u]: 1 });
}

// ---------------- movimento
function moveStacks(S, M) {
  for (const st of S.stacks) {
    if (st.dead) continue;
    const dom = stackDomain(st);
    if (dom === 'air') { moveAir(S, M, st); continue; }
    if (!st.path.length) { st.prog = 0; continue; }
    if (st.fighting && st.prog === 0) { /* parado em combate: só sai se mandaram recuar */ }
    let budget = 1; // hora
    let guard = 0;
    while (budget > 1e-6 && st.path.length && guard++ < 20) {
      const a = st.node, b = st.path[0];
      // entrada em território que ficou proibido (paz)
      if (dom === 'land' && M.isLand(b) && !canEnter(S, st.nat, S.provinces[b].owner)) { st.path = []; st.prog = 0; event(S, st.nat, `Tropas pararam: não há permissão para entrar em ${M.nodes[b].name}.`, 'info', a); break; }
      const L = M.edgeLen(a, b);
      const landA = M.isLand(a), landB = M.isLand(b);
      const v = dom === 'land' && (!landA || !landB) ? TRANSPORT_SPEED : stackSpeed(S, st) * nodeSpeedFactor(S, M, st.nat, b, landB);
      const need = (L - st.prog) / v;
      if (need <= budget) {
        budget -= need; st.node = b; st.path.shift(); st.prog = 0;
        if (arrive(S, M, st)) break;
      } else { st.prog += v * budget; budget = 0; }
    }
    const p = stackPos(M, st); st.x = p.x; st.y = p.y;
  }
}
// retorna true se a pilha deve parar
function arrive(S, M, st) {
  const node = st.node;
  const enemies = S.stacks.some(o => !o.dead && o !== st && o.node === node && o.prog === 0 && stackDomain(o) !== 'air' && hostile(S, st.nat, o.nat));
  if (enemies) { st.path = []; return true; }
  if (M.isLand(node) && stackDomain(st) === 'land') tryCapture(S, M, st.nat, node);
  return false;
}
export function tryCapture(S, M, nat, node) {
  const sp = S.provinces[node];
  if (sp.owner === nat || !hostile(S, nat, sp.owner)) return false;
  const defenders = S.stacks.some(o => !o.dead && o.node === node && o.prog === 0 && stackDomain(o) === 'land' && (o.nat === sp.owner || rel(S, o.nat, sp.owner) === 'aliado') && hostile(S, nat, o.nat));
  if (defenders) return false;
  const old = sp.owner; sp.owner = nat; sp.lastCapture = S.hour; sp.queue = []; sp.build = null;
  sp.morale = Math.min(sp.morale, sp.core === nat ? 60 : 35);
  if (sp.b.forte) sp.b.forte = Math.max(0, sp.b.forte - 1) || undefined;
  if (!sp.b.forte) delete sp.b.forte;
  // aviões baseados ali são destruídos
  for (const o of S.stacks) if (!o.dead && o.nat === old && stackDomain(o) === 'air' && o.base === node) { o.dead = true; }
  const pname = M.provinces[node].name;
  event(S, nat, `Conquistamos ${pname}!`, 'vitoria', node);
  event(S, old, `Perdemos ${pname} para ${nname(nat)}.`, 'derrota', node);
  if (M.provinces[node].city || M.provinces[node].capital) news(S, `${nname(nat)} toma ${pname} de ${nname(old)}.`, 'conquista');
  if (old !== 'reb') {
    const on = S.nations[old];
    if (on.capital === node) {
      // muda a capital
      let best = -1, bv = -1; S.provinces.forEach((q, i) => { if (q.owner === old) { const v = M.provinces[i].vp * 10 + q.morale; if (v > bv) { bv = v; best = i; } } });
      on.capital = best;
      news(S, `A capital de ${nname(old)}, ${pname}, caiu! ${best >= 0 ? 'O governo foge para ' + M.provinces[best].name + '.' : ''}`, 'capital');
    }
    if (!S.provinces.some(q => q.owner === old)) eliminate(S, M, old, nat);
  }
  if (nat !== 'reb') { const n = S.nations[nat]; if (n.capital < 0) n.capital = node; }
  return true;
}
function eliminate(S, M, nat, by) {
  const n = S.nations[nat]; if (!n.alive) return;
  n.alive = false; for (const o of S.stacks) if (o.nat === nat) o.dead = true;
  if (n.coalition) leaveCoalition(S, nat);
  news(S, `${nname(nat)} foi eliminada por ${nname(by)}.`, 'eliminacao');
  event(S, S.opts.player, `${nname(nat)} foi eliminada da guerra.`, 'info');
}
export function leaveCoalition(S, nat) {
  const n = S.nations[nat]; const c = S.coalitions[n.coalition]; n.coalition = null;
  if (c) { c.members = c.members.filter(m => m !== nat); if (!c.members.length) delete S.coalitions[c.id]; }
}

function moveAir(S, M, st) {
  const m = st.mission; if (!m) { const b = M.nodes[st.base]; st.x = b.x; st.y = b.y; return; }
  const spd = stackSpeed(S, st);
  let tx, ty;
  if (m.type === 'return') { tx = M.nodes[st.base].x; ty = M.nodes[st.base].y; }
  else { tx = m.x; ty = m.y; }
  const d = Math.hypot(tx - st.x, ty - st.y);
  if (d <= spd) {
    st.x = tx; st.y = ty;
    if (m.type === 'return' || m.type === 'rebase') { if (m.type === 'rebase') st.base = m.prov; st.mission = null; st.node = st.base; }
    else if (m.type === 'strike') { m.arrived = true; }
    else if (m.type === 'patrol') { m.arrived = true; }
  } else { st.x += (tx - st.x) / d * spd; st.y += (ty - st.y) / d * spd; }
  st.heading = Math.atan2(ty - st.y, tx - st.x);
}

// ---------------- combate
const neff = n => n <= 10 ? n : 10 + (n - 10) * 0.55;
function targetShares(st, embarked) {
  const sh = { inf: 0, arm: 0, air: 0, nav: 0 }; let tot = 0;
  for (const [u, e] of Object.entries(st.units)) { const c = embarked ? 'nav' : UNITS[u].cls; sh[c] += e.hp; tot += e.hp; }
  if (tot) for (const k in sh) sh[k] /= tot;
  return sh;
}
// dano de 'from' contra 'to'. mode: 'atk' | 'def'. onlyRanged: só unidades de alcance.
function damage(S, M, from, to, mode, opt = {}) {
  const sh = targetShares(to, opt.toEmbarked);
  let dmg = 0, bld = 0;
  const terr = opt.terrain ? TERRAIN[opt.terrain] : null;
  for (const [u, e] of Object.entries(from.units)) {
    const d = UNITS[u];
    if (opt.onlyRanged && !d.rng) continue;
    if (opt.fromEmbarked) continue; // embarcados não atacam
    const stats = mode === 'atk' ? d.atk : d.def;
    let w = 0; for (const c in sh) w += sh[c] * (stats[c] || 0);
    const hpF = 0.4 + 0.6 * e.hp / (e.n * d.hp);
    let x = neff(e.n) * hpF * w;
    if (terr && d.cls === 'arm' && mode === 'atk') x *= terr.armAtk;
    dmg += x; bld += neff(e.n) * hpF * (d.atk.bld || 0);
  }
  const r = 0.88 + rngNext(S) * 0.24;
  return { dmg: dmg * r * (opt.mult || 1), bld: bld * r };
}
function applyDamage(S, M, st, dmg, by) {
  if (dmg <= 0) return 0;
  let tot = 0; for (const e of Object.values(st.units)) tot += e.hp;
  if (tot <= 0) return 0;
  let killed = 0;
  for (const [u, e] of Object.entries(st.units)) {
    const share = dmg * e.hp / tot; e.hp -= share;
    const max = UNITS[u].hp; const n2 = e.hp <= 0.01 ? 0 : Math.ceil(e.hp / max - 1e-6);
    killed += e.n - n2; e.n = n2;
    if (e.n <= 0) delete st.units[u];
  }
  if (killed) { S.nations[st.nat] && (S.nations[st.nat].losses += killed); if (by && S.nations[by]) S.nations[by].kills += killed; }
  if (!Object.keys(st.units).length) st.dead = true;
  return killed;
}
function damageBuildings(S, M, pid, bld) {
  const sp = S.provinces[pid]; sp.bdmg += bld;
  while (sp.bdmg >= 90) {
    sp.bdmg -= 90;
    const keys = Object.keys(sp.b).filter(k => sp.b[k] > 0); if (!keys.length) { sp.bdmg = 0; break; }
    const k = sp.b.forte ? 'forte' : keys[(rngNext(S) * keys.length) | 0];
    sp.b[k]--; if (!sp.b[k]) delete sp.b[k];
    event(S, sp.owner, `${BUILDINGS[k].name} danificado em ${M.provinces[pid].name}.`, 'alerta', pid);
  }
}
function battleMark(S, M, node, x, y, sides) { S.battles[node] = { h: S.hour, x, y, sides }; }

function combat(S, M) {
  // agrupa pilhas paradas por nó
  const byNode = new Map();
  for (const st of S.stacks) { if (st.dead || stackDomain(st) === 'air' || st.prog > 0) continue; if (!byNode.has(st.node)) byNode.set(st.node, []); byNode.get(st.node).push(st); }
  const dealt = []; // [target, dmg, by]
  for (const st of S.stacks) st.fighting = false;
  for (const [node, list] of byNode) {
    if (list.length < 2) continue;
    const land = M.isLand(node);
    const owner = land ? S.provinces[node].owner : null;
    for (const a of list) {
      const foes = list.filter(b => hostile(S, a.nat, b.nat));
      if (!foes.length) continue;
      a.fighting = true;
      const aEmb = isEmbarked(M, a);
      const aDefending = land && (a.nat === owner || rel(S, a.nat, owner) === 'aliado');
      const mode = aDefending ? 'def' : 'atk';
      const totHP = foes.reduce((s, f) => s + stackHP(f).hp, 0) || 1;
      for (const f of foes) {
        const fEmb = isEmbarked(M, f);
        const res = damage(S, M, a, f, mode, { terrain: land ? M.nodes[node].terrain : null, toEmbarked: fEmb, fromEmbarked: aEmb });
        let dmg = res.dmg * stackHP(f).hp / totHP;
        const fDefending = land && (f.nat === owner || rel(S, f.nat, owner) === 'aliado');
        if (fDefending) { dmg /= TERRAIN[M.nodes[node].terrain].def; dmg *= 1 - FORT_REDUCTION[S.provinces[node].b.forte || 0]; }
        if (fEmb) dmg /= EMBARK_DEF;
        dealt.push([f, dmg, a.nat]);
        if (land && !aDefending && fDefending) damageBuildings(S, M, node, res.bld * 0.25 * stackHP(f).hp / totHP);
      }
      const n = M.nodes[node]; battleMark(S, M, node, n.x, n.y, [a.nat, foes[0].nat]);
    }
  }
  // fogo de alcance (artilharia, navios): pilhas não engajadas em corpo a corpo
  for (const st of S.stacks) {
    if (st.dead || st.fighting || stackDomain(st) === 'air' || st.prog > 0 || st.stance === 'passivo') continue;
    let rng = 0; for (const u of Object.keys(st.units)) rng = Math.max(rng, UNITS[u].rng || 0);
    if (!rng || isEmbarked(M, st)) continue;
    const me = M.nodes[st.node];
    let best = null, bd = 1e9;
    for (const o of S.stacks) {
      if (o.dead || stackDomain(o) === 'air' || !hostile(S, st.nat, o.nat)) continue;
      if (st.target && o.id !== st.target) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d <= rng && d < bd) { bd = d; best = o; }
    }
    if (!best) { st.target = null; continue; }
    const tland = best.prog === 0 && M.isLand(best.node);
    const res = damage(S, M, st, best, 'atk', { onlyRanged: true, toEmbarked: isEmbarked(M, best), terrain: tland ? M.nodes[best.node].terrain : null });
    let dmg = res.dmg;
    if (tland && S.provinces[best.node].owner === best.nat) { dmg /= TERRAIN[M.nodes[best.node].terrain].def; dmg *= 1 - FORT_REDUCTION[S.provinces[best.node].b.forte || 0]; damageBuildings(S, M, best.node, res.bld * 0.15); }
    dealt.push([best, dmg, st.nat]);
    // contra-bateria
    let rr = 0; for (const u of Object.keys(best.units)) rr = Math.max(rr, UNITS[u].rng || 0);
    if (rr >= bd) { const back = damage(S, M, best, st, 'atk', { onlyRanged: true }); dealt.push([st, back.dmg, best.nat]); }
    S.flash.push({ h: S.hour, from: [me.x, me.y], to: [best.x, best.y], kind: 'art' });
  }
  // aviação
  for (const st of S.stacks) {
    if (st.dead || stackDomain(st) !== 'air' || !st.mission || !st.mission.arrived) continue;
    const m = st.mission;
    if (m.type === 'patrol' || m.type === 'strike') {
      const R = m.type === 'patrol' ? PATROL_RADIUS : MELEE_RANGE * 3;
      const foes = S.stacks.filter(o => !o.dead && o !== st && hostile(S, st.nat, o.nat) && Math.hypot(o.x - st.x, o.y - st.y) <= R && (m.type === 'patrol' || stackDomain(o) !== 'air' || !o.mission));
      const airFoes = foes.filter(o => stackDomain(o) === 'air');
      const targets = airFoes.length ? airFoes : foes;
      const mult = m.type === 'patrol' ? 0.5 : 1;
      if (targets.length) {
        const tot = targets.reduce((s, f) => s + stackHP(f).hp, 0) || 1;
        for (const f of targets) {
          const res = damage(S, M, st, f, 'atk', { toEmbarked: isEmbarked(M, f), mult });
          let dmg = res.dmg * stackHP(f).hp / tot;
          if (stackDomain(f) !== 'air' && f.prog === 0 && M.isLand(f.node) && S.provinces[f.node].owner === f.nat) dmg *= 1 - FORT_REDUCTION[S.provinces[f.node].b.forte || 0] * 0.5;
          dealt.push([f, dmg, st.nat]);
          // antiaérea responde
          const back = damage(S, M, f, st, stackDomain(f) === 'air' ? 'atk' : 'def', { mult: 1 });
          dealt.push([st, back.dmg, f.nat]);
        }
        battleMark(S, M, 'air' + st.id, st.x, st.y, [st.nat, targets[0].nat]);
      }
      if (m.type === 'strike') {
        // dano a edifícios na província alvo
        const node = M.nodeAt(st.x, st.y);
        if (M.isLand(node) && hostile(S, st.nat, S.provinces[node].owner)) {
          let bld = 0; for (const [u, e] of Object.entries(st.units)) bld += neff(e.n) * UNITS[u].atk.bld;
          if (bld > 0) { damageBuildings(S, M, node, bld * 3); S.provinces[node].morale = Math.max(5, S.provinces[node].morale - bld * 0.15); }
          // antiaérea de províncias com forte
          const f = S.provinces[node].b.forte || 0; if (f) dealt.push([st, f * 3, S.provinces[node].owner]);
        }
        st.mission = { type: 'return' };
      }
    }
  }
  for (const [t, dmg, by] of dealt) if (!t.dead) {
    const k = applyDamage(S, M, t, dmg, by);
    if (t.dead) {
      event(S, t.nat, `Uma de nossas tropas foi destruída${M.nodes[t.node] ? ' em ' + M.nodes[t.node].name : ''}.`, 'derrota', t.node);
      event(S, by, `Destruímos tropas de ${nname(t.nat)}${M.nodes[t.node] ? ' em ' + M.nodes[t.node].name : ''}.`, 'vitoria', t.node);
    }
  }
  S.stacks = S.stacks.filter(s => !s.dead);
  // capturas após combate: atacantes sobreviventes em província sem defensores
  for (const st of S.stacks) if (stackDomain(st) === 'land' && st.prog === 0 && M.isLand(st.node) && !st.path.length) tryCapture(S, M, st.nat, st.node);
}

// ---------------- vitória
export function scores(S, M) {
  const sc = {}; S.provinces.forEach((sp, i) => sc[sp.owner] = (sc[sp.owner] || 0) + M.provinces[i].vp);
  return sc;
}
function checkVictory(S, M) {
  if (S.winner) return;
  const sc = scores(S, M); const tot = M.totalVP;
  const P = S.opts.player; const pn = S.nations[P];
  if (pn && !pn.alive && !S.opts.spectate) { S.winner = { type: 'derrota', h: S.hour, text: 'Sua nação foi eliminada.' }; return; }
  // coligações somam
  const groups = {};
  for (const [nat, v] of Object.entries(sc)) { if (nat === 'reb') continue; const n = S.nations[nat]; const g = n.coalition ? 'c' + n.coalition : nat; groups[g] = (groups[g] || 0) + v; }
  for (const [g, v] of Object.entries(groups)) if (v / tot >= S.opts.victory) {
    const members = g.startsWith('c') ? S.coalitions[g.slice(1)].members : [g];
    const won = members.includes(P);
    S.winner = { type: won ? 'vitoria' : 'derrota', h: S.hour, members, text: won ? 'Sua nação conquistou a hegemonia da Europa!' : `${members.map(nname).join(', ')} conquistou a hegemonia da Europa.` };
    news(S, `Fim da guerra: ${members.map(nname).join(', ')} domina a Europa.`, 'fim');
    return;
  }
  const alive = Object.values(S.nations).filter(n => n.alive && !n.rebel);
  if (alive.length === 1) { const w = alive[0].id; S.winner = { type: w === P ? 'vitoria' : 'derrota', h: S.hour, members: [w], text: `${nname(w)} é a última nação de pé.` }; }
}

// ---------------- passo principal
import { aiTick, aiDaily } from './ai.js';
import { marketDaily } from './market.js';
export function step(S, M) {
  S.hour++;
  hourlyEconomy(S, M);
  hourlyProduction(S, M);
  moveStacks(S, M);
  combat(S, M);
  aiTick(S, M);
  if (S.hour % 24 === 0) {
    dailyEconomy(S, M); dailyMorale(S, M); dailyHeal(S, M); marketDaily(S, M); aiDaily(S, M);
    for (const n of Object.values(S.nations)) n.spies = (n.spies || []).filter(s => s.until > S.hour);
    checkVictory(S, M);
  }
  // limpeza visual
  for (const k of Object.keys(S.battles)) if (S.hour - S.battles[k].h > 1) delete S.battles[k];
  S.flash = S.flash.filter(f => S.hour - f.h < 1);
}
