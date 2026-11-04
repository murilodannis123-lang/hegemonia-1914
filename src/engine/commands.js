// Ações (jogador e IA). Todas retornam { ok, msg }.
import { UNITS, BUILDINGS, MELEE_RANGE } from './defs.js';
import { addStack, stackDomain, news, event, rngNext } from './state.js';
import { findPath, canAfford, pay, refund, buildCost, buildTime, unitTime, unitUnlocked, buildUnlocked, relKey, rel, hostile, nname, stackRange, stackPos, leaveCoalition, day, stackHP, stackPower, embargoed, tradeBlocked, startBuild } from './sim.js';
export { embargoed, tradeBlocked };
import { aiAnswer } from './ai.js';

const ok = (msg = '') => ({ ok: true, msg });
const no = msg => ({ ok: false, msg });

export const BUILD_QUEUE_MAX = 3;
export function build(S, M, nat, pid, type) {
  const sp = S.provinces[pid]; if (!sp || sp.owner !== nat) return no('Província não é sua.');
  if (sp.build) {
    // já constrói algo: vai para a fila (paga quando começar)
    sp.bq = sp.bq || []; if (sp.bq.length >= BUILD_QUEUE_MAX) return no(`A fila de construção está cheia (${BUILD_QUEUE_MAX}).`);
    const b = BUILDINGS[type]; const planned = (sp.b[type] || 0) + (sp.build.type === type ? 1 : 0) + sp.bq.filter(t => t === type).length;
    if (planned >= b.max) return no('Esse edifício já vai chegar ao nível máximo.');
    sp.bq.push(type); return ok(`${b.name} adicionado à fila (${sp.bq.length}/${BUILD_QUEUE_MAX}).`);
  }
  return startBuild(S, M, pid, type);
}
export function unqueueBuild(S, M, nat, pid, idx) { const sp = S.provinces[pid]; if (!sp || sp.owner !== nat || !sp.bq || !sp.bq[idx]) return no('Nada na fila.'); sp.bq.splice(idx, 1); return ok('Removido da fila.'); }
export function cancelBuild(S, M, nat, pid) {
  const sp = S.provinces[pid]; if (!sp || sp.owner !== nat || !sp.build) return no('Nada para cancelar.');
  refund(S.nations[nat], sp.build.cost, 1); sp.build = null; return ok('Construção cancelada e recursos devolvidos.');
}
export function produce(S, M, nat, pid, u, count = 1) {
  const sp = S.provinces[pid]; if (!sp || sp.owner !== nat) return no('Província não é sua.');
  const un = unitUnlocked(S, M, pid, u); if (!un.ok) return no(un.why);
  const n = S.nations[nat]; let made = 0;
  for (let i = 0; i < count; i++) {
    if (sp.queue.length >= 8) { if (!made) return no('Fila de produção cheia (8).'); break; }
    if (!canAfford(n, UNITS[u].cost)) { if (!made) return no('Recursos insuficientes.'); break; }
    pay(n, UNITS[u].cost);
    const t = unitTime(S, pid, u);
    sp.queue.push({ u, left: t, total: t, cost: UNITS[u].cost }); made++;
  }
  return ok(`${made}× ${UNITS[u].name} na fila.`);
}
export function cancelProduce(S, M, nat, pid, idx) {
  const sp = S.provinces[pid]; if (!sp || sp.owner !== nat || !sp.queue[idx]) return no('Nada para cancelar.');
  const q = sp.queue.splice(idx, 1)[0]; refund(S.nations[nat], q.cost, 1);
  if (idx === 0 && sp.queue[0]) sp.queue[0].left = sp.queue[0].total = unitTime(S, pid, sp.queue[0].u);
  return ok('Produção cancelada.');
}
export function speedUp(S, M, nat, pid, what) {
  // acelera usando dinheiro (substitui a moeda premium)
  const sp = S.provinces[pid]; if (!sp || sp.owner !== nat) return no('Província não é sua.');
  const item = what === 'build' ? sp.build : sp.queue[0]; if (!item) return no('Nada para acelerar.');
  const cost = Math.ceil(item.left * 900); const n = S.nations[nat];
  if (n.res.dinheiro < cost) return no(`Precisa de ${cost.toLocaleString('pt-BR')} de dinheiro.`);
  n.res.dinheiro -= cost; item.left = 0.01; return ok('Acelerado!');
}
export const speedUpCost = item => Math.ceil(item.left * 900);

export function getStack(S, id) { return S.stacks.find(s => s.id === id); }
export function move(S, M, nat, id, target) {
  const st = getStack(S, id); if (!st || st.nat !== nat) return no('Tropa inválida.');
  const dom = stackDomain(st);
  if (dom === 'air') return no('Use as missões aéreas.');
  if (dom === 'sea' && M.isLand(target)) { const seas = M.seaNbrs[target]; if (!seas.length) return no('Navios não chegam aí.'); target = seas.reduce((a, b) => M.dist(st.node, a) < M.dist(st.node, b) ? a : b); }
  if (M.isLand(target) && dom === 'land') { const ow = S.provinces[target].owner; if (ow !== nat && rel(S, nat, ow) === 'paz') return no(`Você está em paz com ${nname(ow)}. Declare guerra ou peça direito de passagem.`); }
  // se está no meio de uma aresta, recalcula a partir do próximo nó ou volta
  let from = st;
  if (st.prog > 0 && st.path.length) {
    const nxt = st.path[0]; const L = M.edgeLen(st.node, nxt);
    const tmp = { ...st, node: nxt, path: [], prog: 0 };
    const p1 = findPath(S, M, tmp, target);
    const tmp2 = { ...st, path: [], prog: 0 }; const p2 = findPath(S, M, tmp2, target);
    if (p1 && (!p2 || (L - st.prog) <= st.prog)) { st.path = [nxt, ...p1]; st.target = null; return ok('Em marcha.'); }
    if (p2) { // inverte o sentido
      const prevNode = st.node; st.node = nxt; st.prog = L - st.prog; st.path = [prevNode, ...p2]; st.target = null; return ok('Em marcha.');
    }
    return no('Sem caminho até lá.');
  }
  const p = findPath(S, M, from, target); if (!p) return no('Sem caminho até lá.');
  st.path = p; st.target = null; if (!p.length) return ok('Já está aí.');
  return ok('Em marcha.');
}
export function stop(S, M, nat, id) {
  const st = getStack(S, id); if (!st || st.nat !== nat) return no('Tropa inválida.');
  if (stackDomain(st) === 'air') { if (st.mission) st.mission = { type: 'return' }; return ok('Retornando à base.'); }
  if (st.prog > 0 && st.path.length) { const L = M.edgeLen(st.node, st.path[0]); if (st.prog > L / 2) st.path = [st.path[0]]; else { const nxt = st.path[0]; const prev = st.node; st.node = nxt; st.prog = L - st.prog; st.path = [prev]; } }
  else st.path = [];
  st.target = null; return ok('Parando.');
}
export function attack(S, M, nat, id, targetId) {
  const st = getStack(S, id), t = getStack(S, targetId);
  if (!st || st.nat !== nat || !t) return no('Alvo inválido.');
  if (!hostile(S, nat, t.nat)) return no(`Você não está em guerra com ${nname(t.nat)}.`);
  const dom = stackDomain(st);
  if (dom === 'air') return airMission(S, M, nat, id, 'strike', t.x, t.y);
  let rng = 0; for (const u of Object.keys(st.units)) rng = Math.max(rng, UNITS[u].rng || 0);
  const p = stackPos(M, st);
  if (rng && st.prog === 0 && Math.hypot(t.x - p.x, t.y - p.y) <= rng) { st.path = []; st.target = t.id; return ok('Bombardeando.'); }
  return move(S, M, nat, id, stackDomain(t) === 'air' ? M.nodeAt(t.x, t.y) : t.node);
}
export function airMission(S, M, nat, id, type, x, y, prov) {
  const st = getStack(S, id); if (!st || st.nat !== nat || stackDomain(st) !== 'air') return no('Selecione aviões.');
  const base = M.nodes[st.base]; const range = stackRange(st);
  if (type === 'rebase') {
    const sp = S.provinces[prov]; if (!sp || sp.owner !== nat || !sp.b.aerodromo) return no('Escolha uma província sua com aeródromo.');
    if (Math.hypot(M.nodes[prov].x - st.x, M.nodes[prov].y - st.y) > range * 1.5) return no(`Fora de alcance (${range} km).`);
    st.mission = { type: 'rebase', prov, x: M.nodes[prov].x, y: M.nodes[prov].y }; return ok('Transferindo base.');
  }
  if (Math.hypot(x - base.x, y - base.y) > range) return no(`Fora do alcance (${range} km da base).`);
  if (Object.keys(st.units).every(u => u === 'balao') && type === 'strike') type = 'patrol';
  st.mission = { type, x, y }; return ok(type === 'patrol' ? 'Patrulhando.' : 'Atacando.');
}
export function split(S, M, nat, id, units) {
  const st = getStack(S, id); if (!st || st.nat !== nat) return no('Tropa inválida.');
  if (st.prog > 0 || (st.mission && stackDomain(st) === 'air')) return no('Só dá para dividir tropas paradas.');
  const take = {}; let total = 0, left = 0;
  for (const [u, e] of Object.entries(st.units)) { const k = Math.max(0, Math.min(e.n, units[u] || 0)); if (k) { take[u] = k; total += k; } left += e.n - k; }
  if (!total || !left) return no('Escolha parte das unidades.');
  const ns = addStack(S, M, nat, st.node, {}); ns.x = st.x; ns.y = st.y; if (st.base != null) ns.base = st.base;
  for (const [u, k] of Object.entries(take)) { const e = st.units[u]; const hpPer = e.hp / e.n; ns.units[u] = { n: k, hp: hpPer * k }; e.n -= k; e.hp -= hpPer * k; if (!e.n) delete st.units[u]; }
  return { ok: true, msg: 'Tropa dividida.', id: ns.id };
}
export function merge(S, M, nat, ids) {
  const list = ids.map(i => getStack(S, i)).filter(s => s && s.nat === nat);
  if (list.length < 2) return no('Selecione duas ou mais tropas.');
  const a = list[0]; const dom = stackDomain(a);
  for (const b of list.slice(1)) {
    if (stackDomain(b) !== dom) return no('Não dá para juntar tropas de terra, mar e ar.');
    const same = dom === 'air' ? (!a.mission && !b.mission && a.base === b.base) : (a.node === b.node && a.prog === 0 && b.prog === 0);
    if (!same) return no('As tropas precisam estar paradas no mesmo lugar.');
  }
  for (const b of list.slice(1)) { for (const [u, e] of Object.entries(b.units)) { const t = a.units[u] || (a.units[u] = { n: 0, hp: 0 }); t.n += e.n; t.hp += e.hp; } b.dead = true; }
  S.stacks = S.stacks.filter(s => !s.dead); a.path = [];
  return ok('Tropas reunidas.');
}
export function setStance(S, M, nat, id, stance) { const st = getStack(S, id); if (!st || st.nat !== nat) return no('Tropa inválida.'); st.stance = stance; return ok(); }
export function rename(S, nat, id, name) { const st = getStack(S, id); if (!st || st.nat !== nat) return no(''); st.name = name.slice(0, 30); return ok(); }

// ---------------- diplomacia
export function setRel(S, a, b, r) { if (r === 'paz') delete S.rel[relKey(a, b)]; else S.rel[relKey(a, b)] = r; }
export function declareWar(S, M, a, b) {
  if (a === b || !S.nations[b] || !S.nations[b].alive) return no('Inválido.');
  if (rel(S, a, b) === 'guerra') return no('Já estão em guerra.');
  if (rel(S, a, b) === 'aliado') return no('Não dá para declarar guerra a um aliado da coligação.');
  if (!S.opts.unlockAll && day(S) < 2 && a === S.opts.player) { /* permitido, só aviso */ }
  setRel(S, a, b, 'guerra');
  S.warStart = S.warStart || {}; S.warStart[relKey(a, b)] = S.hour;
  opinion(S, b, a, -60);
  news(S, `As tropas de ${nname(a)} cruzam a fronteira. ${nname(b)} mobiliza seus exércitos.`, 'guerra', { title: `${nname(a)} declara guerra a ${nname(b)}!`, nats: [a, b] });
  communique(S, a, 'guerra', b); communique(S, b, 'atacado', a);
  event(S, b, `${nname(a)} declarou guerra contra nós!`, 'alerta');
  event(S, a, `Declaramos guerra a ${nname(b)}.`, 'info');
  // aliados de b ficam irritados
  return ok(`Guerra declarada a ${nname(b)}.`);
}
export function opinion(S, of, about, delta) { const n = S.nations[of]; if (!n || !n.opinion) return; n.opinion[about] = Math.max(-100, Math.min(100, (n.opinion[about] || 0) + delta)); }
export function propose(S, M, from, to, type) {
  if (!S.nations[to] || !S.nations[to].alive) return no('Inválido.');
  const r = rel(S, from, to);
  if (type === 'paz' && r !== 'guerra') return no('Vocês não estão em guerra.');
  if (type === 'passagem' && r !== 'paz') return no('Só é possível pedir passagem estando em paz.');
  if (type === 'aliado') return no('Use as coligações para alianças.');
  if (type === 'mapa' && (r === 'guerra' || sharesMap(S, from, to))) return no(r === 'guerra' ? 'Não dá para compartilhar mapa com inimigo.' : 'Vocês já compartilham o mapa.');
  const tn = S.nations[to];
  if (tn.ai) {
    const ans = aiAnswer(S, M, to, from, type);
    if (ans.accept && type === 'mapa') { S.sharedMap = S.sharedMap || {}; S.sharedMap[relKey(from, to)] = true; event(S, from, `${nname(to)} aceitou compartilhar o mapa.`, 'diplomacia'); return { ok: true, accept: true, msg: ans.text }; }
    if (!ans.accept && type === 'mapa') { event(S, from, `${nname(to)} recusou compartilhar o mapa.`, 'diplomacia'); return { ok: true, accept: false, msg: ans.text }; }
    if (ans.accept) {
      setRel(S, from, to, type === 'paz' ? 'paz' : 'passagem');
      if (type === 'paz') news(S, `Os diplomatas de ${nname(from)} e ${nname(to)} assinam um tratado de paz.`, 'paz', { title: `Paz entre ${nname(from)} e ${nname(to)}`, nats: [from, to] });
      event(S, from, `${nname(to)} aceitou: ${type === 'paz' ? 'paz assinada' : 'direito de passagem concedido'}.`, 'diplomacia');
    } else event(S, from, `${nname(to)} recusou ${type === 'paz' ? 'a paz' : 'o direito de passagem'}.`, 'diplomacia');
    return { ok: true, accept: ans.accept, msg: ans.text };
  }
  if (S.proposals.some(p => p.from === from && p.to === to && p.type === type)) return no('Proposta já enviada.');
  S.proposals.push({ id: S.hour * 100 + S.proposals.length, from, to, type, h: S.hour });
  event(S, to, `${nname(from)} propõe ${type === 'paz' ? 'a paz' : type === 'passagem' ? 'direito de passagem' : type === 'coligacao' ? 'entrar na coligação' : type}.`, 'diplomacia');
  return ok('Proposta enviada.');
}
export function answerProposal(S, M, nat, pid, accept) {
  const p = S.proposals.find(x => x.id === pid && x.to === nat); if (!p) return no('Proposta expirada.');
  S.proposals = S.proposals.filter(x => x !== p);
  if (!accept) { opinion(S, p.from, nat, -10); return ok('Recusada.'); }
  if (p.type === 'paz') { setRel(S, p.from, nat, 'paz'); news(S, `Os diplomatas de ${nname(p.from)} e ${nname(nat)} assinam um tratado de paz.`, 'paz', { title: `Paz entre ${nname(p.from)} e ${nname(nat)}`, nats: [p.from, nat] }); }
  else if (p.type === 'passagem') setRel(S, p.from, nat, 'passagem');
  else if (p.type === 'mapa') { S.sharedMap = S.sharedMap || {}; S.sharedMap[relKey(p.from, nat)] = true; }
  else if (p.type === 'coligacao') { const c = S.coalitions[p.coal]; if (!c) return no('Coligação não existe mais.'); return joinCoalition(S, M, nat, c.id); }
  else if (p.type === 'entrar') { const c = S.coalitions[p.coal]; if (!c) return no('Coligação não existe mais.'); return joinCoalition(S, M, p.from, c.id); }
  else if (p.type === 'alianca') { const r = createCoalition(S, M, nat, 'Aliança ' + nname(nat).split(' ')[0] + '-' + nname(p.from).split(' ')[0]); if (!r.ok) return r; return joinCoalition(S, M, p.from, S.nations[nat].coalition); }
  opinion(S, p.from, nat, 15);
  return ok('Aceita.');
}
export function revokePassage(S, M, a, b) { if (rel(S, a, b) !== 'passagem') return no('Não há direito de passagem.'); setRel(S, a, b, 'paz'); return ok('Direito de passagem revogado.'); }

// ---------------- coligações
export function createCoalition(S, M, nat, name) {
  const n = S.nations[nat]; if (n.coalition) return no('Você já está em uma coligação.');
  const id = S.nextCoal++; S.coalitions[id] = { id, name: (name || `Entente ${id}`).slice(0, 32), members: [nat], founder: nat, h: S.hour };
  n.coalition = id; news(S, `${nname(nat)} funda a coligação "${S.coalitions[id].name}".`, 'coligacao', { title: `Nasce a ${S.coalitions[id].name}`, nats: [nat] });
  return ok('Coligação criada.');
}
export function joinCoalition(S, M, nat, cid) {
  const c = S.coalitions[cid], n = S.nations[nat]; if (!c) return no('Coligação inexistente.');
  if (n.coalition) leaveCoalition(S, nat);
  if (c.members.length >= 4) return no('Coligação cheia (máx. 4).');
  if (c.members.some(m => rel(S, m, nat) === 'guerra')) { for (const m of c.members) setRel(S, m, nat, 'paz'); }
  c.members.push(nat); n.coalition = cid; news(S, `${nname(nat)} entra na coligação "${c.name}", que agora reúne ${c.members.map(nname).join(', ')}.`, 'coligacao', { title: `${nname(nat)} adere à ${c.name}`, nats: [...c.members] });
  communique(S, nat, 'coligacao', null, c.name);
  return ok('Entrou na coligação.');
}
export function inviteCoalition(S, M, from, to) {
  const n = S.nations[from]; const c = S.coalitions[n.coalition]; if (!c) return no('Crie uma coligação antes.');
  if (c.members.includes(to)) return no('Já é membro.');
  if (c.members.length >= 4) return no('Coligação cheia (máx. 4).');
  const t = S.nations[to];
  if (t.ai) { const a = aiAnswer(S, M, to, from, 'coligacao'); if (a.accept) { joinCoalition(S, M, to, c.id); event(S, from, `${nname(to)} entrou na coligação!`, 'diplomacia'); } return { ok: true, accept: a.accept, msg: a.text }; }
  S.proposals.push({ id: S.hour * 100 + S.proposals.length, from, to, type: 'coligacao', coal: c.id, h: S.hour });
  event(S, to, `${nname(from)} convida para a coligação "${c.name}".`, 'diplomacia');
  return ok('Convite enviado.');
}
export function quitCoalition(S, M, nat) { if (!S.nations[nat].coalition) return no('Você não está em coligação.'); leaveCoalition(S, nat); return ok('Você saiu da coligação.'); }

// ---------------- espionagem
export const SPY = {
  info: { name: 'Espionagem', cost: 6000, days: 3, desc: 'Revela todas as tropas e províncias da nação alvo por 3 dias.' },
  sabotagem: { name: 'Sabotagem', cost: 9000, days: 0, desc: 'Tenta danificar um edifício de uma província inimiga.' },
  moral: { name: 'Propaganda', cost: 7000, days: 0, desc: 'Derruba a moral de 3 províncias da nação alvo.' },
  militar: { name: 'Sabotagem militar', cost: 9000, days: 0, desc: 'Fere o maior exército terrestre da nação alvo (−20% de vida).' },
  economica: { name: 'Sabotagem econômica', cost: 8000, days: 0, desc: 'Destrói 25% do estoque de um recurso da nação alvo.' },
  contra: { name: 'Contraespionagem', cost: 5000, days: 3, self: true, desc: 'Por 3 dias, espiões inimigos são pegos com muito mais frequência (60%).' },
};
export function spy(S, M, nat, target, kind) {
  const k = SPY[kind]; const n = S.nations[nat]; if (!k) return no('Inválido.');
  if (k.self) { if (n.res.dinheiro < k.cost) return no('Dinheiro insuficiente.'); n.res.dinheiro -= k.cost; n.counterUntil = S.hour + 72; return ok('Contraespionagem ativa por 3 dias.'); }
  if (!S.nations[target] || target === nat) return no('Inválido.');
  if (n.res.dinheiro < k.cost) return no('Dinheiro insuficiente.');
  n.res.dinheiro -= k.cost;
  const provs = S.provinces.map((p, i) => [p, i]).filter(([p]) => p.owner === target);
  if (kind === 'info') { n.spies.push({ target, kind, until: S.hour + 72 }); return ok(`Espiões infiltrados em ${nname(target)} por 3 dias.`); }
  const caught = rngNext(S) < ((S.nations[target].counterUntil || 0) > S.hour ? 0.6 : 0.25);
  if (caught) { opinion(S, target, nat, -25); event(S, target, `Capturamos um espião de ${nname(nat)}!`, 'alerta'); return ok('O espião foi capturado. A operação falhou.'); }
  if (kind === 'sabotagem') {
    const withB = provs.filter(([p]) => Object.keys(p.b).length); if (!withB.length) return ok('Nada para sabotar.');
    const [p, i] = withB[(rngNext(S) * withB.length) | 0]; const keys = Object.keys(p.b); const b = keys[(rngNext(S) * keys.length) | 0];
    p.b[b]--; if (!p.b[b]) delete p.b[b];
    event(S, target, `Sabotagem! ${BUILDINGS[b].name} danificado em ${M.provinces[i].name}.`, 'alerta', i);
    return ok(`Sabotagem: ${BUILDINGS[b].name} danificado em ${M.provinces[i].name}.`);
  }
  if (kind === 'militar') {
    const land = S.stacks.filter(o => !o.dead && o.nat === target && stackDomain(o) === 'land'); if (!land.length) return ok('Nenhum exército encontrado.');
    const big = land.reduce((a, b) => stackHP(b).hp > stackHP(a).hp ? b : a);
    for (const e of Object.values(big.units)) e.hp *= 0.8;
    const where = M.nodes[big.node].name; event(S, target, `Sabotagem no exército em ${where}: depósitos de munição explodiram.`, 'alerta', big.node);
    return ok(`Sabotagem militar: o exército de ${nname(target)} em ${where} perdeu 20% da vida.`);
  }
  if (kind === 'economica') {
    const t = S.nations[target]; const rs = ['graos', 'peixe', 'ferro', 'madeira', 'carvao', 'petroleo', 'gas'].filter(r => t.res[r] > 0);
    if (!rs.length) return ok('Os depósitos estavam vazios.');
    const r = rs.reduce((a, b) => t.res[b] > t.res[a] ? b : a); const lost = Math.floor(t.res[r] * 0.25); t.res[r] -= lost;
    event(S, target, `Sabotagem econômica: perdemos ${lost.toLocaleString('pt-BR')} de ${r}.`, 'alerta');
    return ok(`Sabotagem econômica: ${nname(target)} perdeu ${lost.toLocaleString('pt-BR')} de ${r}.`);
  }
  if (kind === 'moral') { for (let j = 0; j < 3 && provs.length; j++) { const [p] = provs[(rngNext(S) * provs.length) | 0]; p.morale = Math.max(5, p.morale - 15); } return ok('Propaganda espalhada: moral inimiga em queda.'); }
  return no('?');
}

// ---------------- embargo comercial e mapa compartilhado (vale para os dois lados)
export function setEmbargo(S, M, a, b, on) {
  if (!S.nations[b] || a === b) return no('Inválido.');
  S.embargo = S.embargo || {}; const k = relKey(a, b);
  if (on) { if (S.embargo[k]) return no('Já existe embargo.'); S.embargo[k] = true; opinion(S, b, a, -15); news(S, `${nname(a)} proíbe o comércio com ${nname(b)}. Navios mercantes voltam aos portos.`, 'guerra', { title: `Embargo contra ${nname(b)}`, nats: [a, b] }); event(S, b, `${nname(a)} decretou embargo comercial contra nós.`, 'diplomacia'); return ok(`Embargo comercial contra ${nname(b)}.`); }
  if (!S.embargo[k]) return no('Não há embargo.'); delete S.embargo[k]; opinion(S, b, a, 5); return ok(`Embargo com ${nname(b)} suspenso.`);
}
export const sharesMap = (S, a, b) => !!(S.sharedMap && S.sharedMap[relKey(a, b)]);
export function stopSharing(S, a, b) { if (!sharesMap(S, a, b)) return no('Vocês não compartilham o mapa.'); delete S.sharedMap[relKey(a, b)]; opinion(S, b, a, -5); return ok('Mapa deixou de ser compartilhado.'); }

// ---------------- mudar a capital (12 h de mudança)
export const CAPITAL_COST = 15000, CAPITAL_HOURS = 12;
export function moveCapital(S, M, nat, pid) {
  const n = S.nations[nat], sp = S.provinces[pid];
  if (!sp || sp.owner !== nat) return no('A província não é sua.');
  if (!M.provinces[pid].city) return no('A capital precisa ser uma cidade.');
  if (n.capital === pid) return no('Esta já é a capital.');
  if (n.capMove) return no('Já há uma mudança de capital em andamento.');
  if (n.res.dinheiro < CAPITAL_COST) return no('Dinheiro insuficiente.');
  n.res.dinheiro -= CAPITAL_COST; n.capMove = { to: pid, at: S.hour + CAPITAL_HOURS };
  return ok(`O governo começa a mudança para ${M.provinces[pid].name} (${CAPITAL_HOURS} h).`);
}

// ---------------- relações diretas: visitas e presentes
export const VISIT_COST = 5000;
export function visit(S, M, from, to) {
  const n = S.nations[from], t = S.nations[to]; if (!t || !t.alive || from === to) return no('Inválido.');
  if (rel(S, from, to) === 'guerra') return no('Não dá para visitar um país com o qual estamos em guerra.');
  n.visits = n.visits || {}; const last = n.visits[to] ?? -999;
  if (S.hour - last < 48) return no(`Uma nova visita só daqui a ${Math.ceil((48 - (S.hour - last)) / 24 * 24)} h.`);
  if (n.res.dinheiro < VISIT_COST) return no('Dinheiro insuficiente.');
  n.res.dinheiro -= VISIT_COST; n.visits[to] = S.hour;
  const gain = 8 + Math.round(rngNext(S) * 8) + (t.personality === 'defensivo' ? 3 : 0);
  opinion(S, to, from, gain);
  const cap = t.capital >= 0 ? M.provinces[t.capital].name : nname(to);
  news(S, `Uma delegação de ${nname(from)} foi recebida com honras em ${cap}. Banquetes, desfiles e conversas a portas fechadas.`, 'visita', { title: `Visita oficial a ${cap}`, nats: [from, to] });
  return ok(`Visita oficial a ${cap}: relações +${gain}.`);
}
export function gift(S, M, from, to, r, amt) {
  const n = S.nations[from], t = S.nations[to]; amt = Math.floor(amt); if (!t || !t.alive || from === to || !(amt > 0)) return no('Inválido.');
  if (rel(S, from, to) === 'guerra') return no('Não se envia presentes ao inimigo.');
  if (embargoed(S, from, to)) return no('Há um embargo comercial entre vocês.');
  if (n.res[r] < amt) return no('Estoque insuficiente.');
  n.res[r] -= amt; t.res[r] += amt;
  const val = r === 'dinheiro' ? amt : amt * (S.market.price[r] || 1.5);
  const gain = Math.min(25, Math.round(val / 1500));
  opinion(S, to, from, gain);
  return ok(`${nname(to)} agradece o presente. Relações +${gain}.`);
}
export const relLabel = v => v >= 60 ? 'Excelente' : v >= 30 ? 'Amistosa' : v >= 10 ? 'Cordial' : v > -10 ? 'Neutra' : v > -40 ? 'Tensa' : 'Hostil';

// ---------------- comunicados oficiais (IA e jogador)
const COMM = {
  guerra: ['Nossas tropas marcham contra {B}. A vitória será rápida.', 'A paciência acabou. {B} pagará por suas provocações.', 'Declaramos guerra a {B}. Que a história julgue quem começou.', 'Soldados! A pátria chama. Avante contra {B}!'],
  atacado: ['{B} nos apunhalou pelas costas. Resistiremos até o último homem!', 'Covardes! {B} atacou sem motivo. Nossa resposta virá.', 'A nação está unida contra o agressor {B}.'],
  paz: ['Assinamos a paz com {B}. É hora de reconstruir.', 'A guerra contra {B} terminou. Honra aos que tombaram.'],
  coligacao: ['Orgulhosos de integrar a {C}. Juntos somos invencíveis.', 'Selamos aliança na {C}. Que nossos inimigos tremam.'],
  vitoria: ['{P} é nossa! Nenhuma força nos deterá.', 'A bandeira tremula sobre {P}. Glória aos bravos!'],
  provocacao: ['Nossos estoques estão cheios e nossas fábricas não param. Quem se atreve?', 'Vizinhos, observem bem nossas fronteiras. Estamos prontos.', 'A economia cresce, o exército cresce. O futuro é nosso.', 'Rumores de fraqueza são exagerados. Venham conferir.', 'Nenhum palmo de terra será entregue.'],
};
export function communique(S, nat, kind, other, extra) {
  const n = S.nations[nat]; if (!n || !n.ai || n.rebel) return;
  if (kind !== 'guerra' && kind !== 'atacado' && rngNext(S) > 0.6) return;
  const list = COMM[kind]; const t = list[(rngNext(S) * list.length) | 0].replace('{B}', other ? nname(other) : '').replace('{C}', extra || '').replace('{P}', extra || '');
  news(S, t, 'comunicado', { title: t.split(/[.!]/)[0].slice(0, 70), nats: [nat, ...(other ? [other] : [])], from: nat });
}
export function writeArticle(S, nat, title, text, photo) {
  title = String(title || '').trim().slice(0, 80); text = String(text || '').trim().slice(0, 1200);
  if (!title) return no('Escreva um título.');
  news(S, text, 'comunicado', { title, nats: [nat], from: nat, photo: photo || null });
  return ok('Artigo publicado no jornal.');
}
