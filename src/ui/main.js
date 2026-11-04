// Interface do jogo.
import { NATIONS, NATION_BY_ID } from '../data/nations.js';
import { UNITS, BUILDINGS, RES, RES_INFO, CATS, CAT_NAMES, NEED_PER_PROV, BUILD_ORDER, UNIT_TABS, TERRAIN, FORT_REDUCTION } from '../engine/defs.js';
import { prepareMap } from '../engine/world.js';
import { setScenario, DEFAULT_SCENARIO, LEGACY_SCENARIO, currentScenario } from '../data/scenarios.js';
import { newGame, stackDomain, DIFFICULTY } from '../engine/state.js';
import { step, rel, hostile, nname, day, stackHP, stackCount, stackSpeed, stackRange, stackPower, provIncome, nationIncome, buildCost, buildTime, unitTime, unitUnlocked, buildUnlocked, canAfford, findPath, moraleTarget, scores, isEmbarked, stackPos, corruption } from '../engine/sim.js';
import * as C from '../engine/commands.js';
import * as MK from '../engine/market.js';
import { computeVision } from '../engine/vision.js';
import { nationPower } from '../engine/ai.js';
import { MapView } from './render.js';
import { RES_ICON, UNIT_ICON, UI_ICON, BUILD_ICON } from './icons.js';
import { flagSVG } from './flags.js';
import { unitArtSVG, unitHTML } from './unitart.js';
const UA = (u, nat) => unitHTML(u, nat || (S && S.opts.player) || 'fra');
import { photoFor, photoUrl, ALL_PHOTOS, PHOTO_CATS, NEWS_PHOTO } from '../data/photos.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => { n = Math.round(n); const a = Math.abs(n); return a >= 1e8 ? '∞' : a >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : a >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : n.toLocaleString('pt-BR'); };
const hrs = h => { h = Math.max(0, h); if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min'; const d = Math.floor(h / 24), r = Math.round(h % 24); return d ? `${d}d ${r}h` : `${Math.round(h * 10) / 10}h`.replace('.', ','); };
const SPEEDS = [0, 1800, 600, 140];   // ms reais por hora de jogo
const UNIT_PHOTO = { infantaria: 'infantaria', cavalaria: 'cavalaria', choque: 'gas', blindado: 'tanque', artleve: 'artilharia', antiaereo: 'artilharia', artilharia: 'artilharia', tanqueleve: 'tanque', tanquepesado: 'tanque', ferroviario: 'artilharia', balao: 'zepelim', caca: 'aviao', bombardeiro: 'aviao', zepelim: 'zepelim', submarino: 'submarino', cruzador: 'navio', couracado: 'navio' };
const BUILD_PHOTO = { recrutamento: 'multidao', quartel: 'infantaria', oficina: 'fabrica', fabrica: 'fabrica', ferrovia: 'trem', porto: 'navio', aerodromo: 'aviao', forte: 'trincheira' };
const banner = (cat, i = 0) => `url(&quot;${photoFor(cat, i)}&quot;)`;

let newsUnread = false;
let M, S = null, view, vis = null, speed = 1, acc = 0, lastT = 0, seenEvents = 0, unread = 0;
let pending = null; // ordem esperando confirmação: { id, node, attack, path, eta }
let selStack = null, selProv = -1, airMode = 'patrol', win = null, lastUi = 0, lastWin = 0, previewKey = '';

// ================= inicialização
async function boot() {
  const raw = await (await fetch('assets/map.json')).json();
  M = prepareMap(raw); setScenario(M, DEFAULT_SCENARIO);
  view = new MapView($('#map'), M);
  setupInput();
  window.addEventListener('resize', () => view.resize());
  document.addEventListener('keydown', onKey);
  mainMenu();
  requestAnimationFrame(loop);
}

// ================= laço
function loop(t) {
  const dt = Math.min(250, t - (lastT || t)); lastT = t;
  if (S && !S.winner && speed > 0 && !$('#menu').innerHTML) {
    acc += dt; const per = SPEEDS[speed]; let n = 0;
    while (acc >= per && n < 12) { step(S, M); acc -= per; n++; afterStep(); }
    if (n >= 12) acc = 0;
  }
  if (S && !$('#menu').innerHTML) {
    view.selProv = selProv; view.sel = selStack;
    try { view.draw(S, vis, speed ? acc / SPEEDS[speed] : 0); } catch (e) { if (!loop.warned) { console.error(e); loop.warned = true; } }
    if (t - lastUi > 300) { lastUi = t; try { renderTop(); renderPanel(); } catch (e) { console.error(e); } }
    if (win && win.live && t - lastWin > 1000) { lastWin = t; renderWin(true); }
  }
  requestAnimationFrame(loop);
}
function afterStep() {
  vis = computeVision(S, M, S.opts.player);
  // novos eventos -> avisos
  const ev = S.events; const fresh = ev.filter(e => e.id > seenEvents);
  if (fresh.length) { seenEvents = Math.max(...fresh.map(e => e.id)); unread += fresh.length; renderSide(); fresh.slice(-4).forEach(e => toast(e.text, e.type, e.node)); }
  if (selStack && !S.stacks.some(s => s.id === selStack)) selStack = null;
  if (S.hour % 24 === 0) { save('auto'); newsUnread = true; renderSide(); }
  if (S.winner) { save('auto'); showEnd(); }
}

// ================= salvar/carregar
const SLOT = k => 'hegemonia1914_' + k;
function save(slot) { try { localStorage.setItem(SLOT(slot), JSON.stringify({ t: Date.now(), S })); return true; } catch (e) { toast('Não foi possível salvar (armazenamento cheio).', 'alerta'); return false; } }
function loadSlot(slot) { try { const d = JSON.parse(localStorage.getItem(SLOT(slot)) || 'null'); return d; } catch { return null; } }
function slotInfo(slot) { const d = loadSlot(slot); if (!d) return null; return { t: d.t, nat: d.S.opts.player, day: Math.floor(d.S.hour / 24) + 1 }; }
function startGame(state) {
  setScenario(M, state.opts.scenario || LEGACY_SCENARIO); view.natCenters = null;
  S = state; selStack = null; selProv = -1; win = null; speed = 1; acc = 0; unread = 0;
  seenEvents = S.events.length ? S.events[S.events.length - 1].id : 0;
  vis = computeVision(S, M, S.opts.player);
  $('#menu').innerHTML = ''; $('#menu').classList.add('hidden'); $('#modal').classList.add('hidden');
  const cap = S.nations[S.opts.player].capital; const nd = M.nodes[cap >= 0 ? cap : 0];
  view.resize(); view.mode = 'padrao'; view.centerOn(nd.x, nd.y, 0.32);
  renderSide(); renderSpeed(); renderTop(); renderPanel();
}

// ================= menus
function mainMenu() {
  S = null; const m = $('#menu'); m.classList.remove('hidden');
  const auto = slotInfo('auto');
  m.innerHTML = `<div class="menubg" style="--banner:url(&quot;assets/menu.jpg&quot;)"></div><div class="menuc">
    <div class="logo">Hegemonia<span>1914</span></div>
    <div class="tagline">Comande uma nação na Grande Guerra. Construa, produza, negocie, faça alianças e conquiste a Europa contra 30 nações controladas pelo computador.</div>
    ${auto ? `<button class="mbtn" data-a="cont">Continuar<small>${esc(nname(auto.nat))} · Dia ${auto.day}</small></button>` : ''}
    <button class="mbtn" data-a="novo">Novo jogo<small>Escolha sua nação e as regras da partida</small></button>
    <button class="mbtn" data-a="carregar">Carregar<small>Partidas salvas neste aparelho</small></button>
    <button class="mbtn" data-a="ajuda">Como jogar<small>O básico em 1 minuto</small></button>
    <div class="credits">Mapa: Natural Earth e GeoNames. Fotografias históricas: Wikimedia Commons (domínio público). Ilustrações geradas com Gemini. Jogo pessoal, sem fins comerciais.</div></div>`;
  m.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'cont') { const d = loadSlot('auto'); if (d) startGame(d.S); }
    if (a === 'novo') setupMenu();
    if (a === 'carregar') loadMenu();
    if (a === 'ajuda') openWin('ajuda'); };
}
function loadMenu() {
  const m = $('#menu');
  const rows = ['auto', '1', '2', '3'].map(k => { const i = slotInfo(k); return `<button class="mbtn" data-s="${k}" ${i ? '' : 'disabled style="opacity:.4"'}>${k === 'auto' ? 'Salvamento automático' : 'Espaço ' + k}<small>${i ? esc(nname(i.nat)) + ' · Dia ' + i.day + ' · ' + new Date(i.t).toLocaleString('pt-BR') : 'Vazio'}</small></button>`; }).join('');
  m.innerHTML = `<div class="menubg" style="--banner:${banner('generais', 0)}"></div><div class="menuc"><div class="logo" style="font-size:40px">Carregar</div><div style="height:20px"></div>${rows}<button class="mbtn" data-s="voltar">Voltar</button></div>`;
  m.onclick = e => { const s = e.target.closest('[data-s]')?.dataset.s; if (!s) return; if (s === 'voltar') return mainMenu(); const d = loadSlot(s); if (d) startGame(d.S); };
}
function setupMenu() {
  const m = $('#menu');
  const o = { scenario: currentScenario || DEFAULT_SCENARIO, player: 'fra', difficulty: 'normal', prodSpeed: 2, resources: 'normal', fog: true, unlockAll: false, victory: 0.6 };
  setScenario(M, o.scenario); let preview = newGame(M, { player: o.player, seed: 1 });
  m.innerHTML = `<div class="setup"><div class="mapside"><canvas id="pick"></canvas><div class="hint" style="position:absolute;top:10px">Toque no mapa ou na lista para escolher sua nação</div></div>
   <div class="opts"><div class="ph"><div class="t">Escolha um país</div></div><div class="natlist"></div>
   <div style="border-top:1px solid var(--line);padding:6px 0">
   ${seg('scenario', 'Mapa', [['historico', '1914 histórico'], ['dividido', '31 nações']])}
   ${seg('difficulty', 'Dificuldade da IA', [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']])}
   ${seg('prodSpeed', 'Velocidade de produção', [[1, '1×'], [2, '2×'], [5, '5×'], [10, '10×']])}
   ${seg('resources', 'Recursos iniciais', [['normal', 'Normal'], ['abundante', 'Ricos'], ['infinito', 'Infinitos']])}
   ${seg('fog', 'Névoa de guerra', [[true, 'Sim'], [false, 'Não']])}
   ${seg('unlockAll', 'Tudo liberado desde o dia 1', [[false, 'Não'], [true, 'Sim']])}
   ${seg('victory', 'Vitória com', [[0.5, '50%'], [0.6, '60%'], [0.8, '80%']])}
   <div class="row" style="padding:8px 12px;gap:8px"><button class="btn" data-a="voltar">Voltar</button><button class="btn pri grow" data-a="ir">Começar a guerra</button></div></div></div></div>`;
  function seg(k, label, opts) { return `<div class="field"><span>${label}</span><div class="seg" data-k="${k}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(o[k]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div></div>`; }
  const list = m.querySelector('.natlist');
  let provCount = {}; const countProv = () => { provCount = {}; M.provinces.forEach(p => provCount[p.owner] = (provCount[p.owner] || 0) + 1); }; countProv();
  const drawList = () => { list.innerHTML = NATIONS.slice().sort((a, b) => a.name.localeCompare(b.name)).map(n => `<div class="natrow ${n.id === o.player ? 'on' : ''}" data-n="${n.id}">${flagSVG(n.id)}${esc(n.name)}<small>${provCount[n.id]} prov.</small></div>`).join(''); };
  drawList();
  const cv = m.querySelector('#pick'); const pv = new MapView(cv, M); pv.noStacks = true;
  const draw = () => { preview.opts.player = o.player; pv.resize(); pv.mode = 'padrao'; pv.k = pv.minK; pv.clamp(); pv.draw(preview, computeVision(preview, M, o.player), 0); };
  setTimeout(draw, 50); window.addEventListener('resize', draw, { once: true });
  cv.onclick = e => { const r = cv.getBoundingClientRect(); const [x, y] = pv.toWorld(e.clientX - r.left, e.clientY - r.top); const n = M.nodeAt(x, y); if (n >= 0 && n < M.nL) { o.player = M.provinces[n].owner; drawList(); draw(); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); } };
  m.onclick = e => {
    const nr = e.target.closest('[data-n]'); if (nr) { o.player = nr.dataset.n; drawList(); draw(); return; }
    const sb = e.target.closest('.seg button'); if (sb) { const k = sb.parentElement.dataset.k; let v = sb.dataset.v; v = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; o[k] = v; sb.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === sb));
      if (k === 'scenario') { setScenario(M, v); countProv(); if (!NATIONS.some(n => n.id === o.player)) o.player = 'fra'; preview = newGame(M, { player: o.player, seed: 1 }); drawList(); draw(); }
      return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'voltar') mainMenu();
    if (a === 'ir') { startGame(newGame(M, o)); toast(`Você governa ${nname(o.player)}. Toque numa província para construir e produzir, e nas tropas para movê-las.`, 'info'); }
  };
}

// ================= barra superior, lateral, velocidade
// só reescreve o HTML quando mudou: evita botões sumindo debaixo do dedo, imagens recarregando e lag nos cliques
function put(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; }
function renderTop() {
  if (!S) return; const P = S.opts.player, n = S.nations[P]; const inc = nationIncome(S, M, P);
  const sc = scores(S, M); const rank = Object.entries(sc).filter(([k]) => k !== 'reb').sort((a, b) => b[1] - a[1]).findIndex(([k]) => k === P) + 1;
  const h = S.hour % 24, d = day(S);
  put($('#top'), `<div class="me" data-w="diplomacia">${flagSVG(P, 'flag round')}<div class="who"><div class="nm">${esc(NATION_BY_ID[P].name)}</div><div class="sub">${n.alive ? 'Seu governo' : 'Derrotado'}</div></div></div>
  <div class="rank">${rank}º<b>${sc[P] || 0}</b></div>
  <div id="res">${RES.map(r => { const net = (inc.prod[r] - inc.cons[r]) / 24; return `<div class="rs" data-w="recursos" title="${RES_INFO[r].name}">${RES_ICON[r]}<div><div class="v">${fmt(n.res[r])}</div><div class="d ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmt(net)}/h</div></div></div>`; }).join('')}</div>
  <div class="clock">Dia <b>${d}</b><br>${String(h).padStart(2, '0')}:00</div>
  <button class="tbtn" data-w="config" title="Menu">${UI_ICON.menu}</button>`);
}
const SIDE = [['jornal', 'Jornal'], ['diplomacia', 'Diplomacia'], ['recursos', 'Recursos'], ['bolsa', 'Bolsa de valores'], ['coligacoes', 'Coligações'], ['espionagem', 'Espionagem'], ['provincias', 'Províncias'], ['exercitos', 'Exércitos'], ['eventos', 'Avisos']];
function renderSide() {
  const props = S ? S.proposals.filter(p => p.to === S.opts.player).length : 0;
  put($('#side'), SIDE.map(([k, t]) => `<button data-w="${k}">${UI_ICON[k === 'eventos' ? 'alerta' : k]}<span class="tip">${t}</span>${k === 'jornal' && newsUnread ? '<span class="badge">!</span>' : ''}${k === 'eventos' && unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : ''}${k === 'diplomacia' && props ? `<span class="badge">${props}</span>` : ''}</button>`).join(''));
}
function renderSpeed() {
  const modes = { padrao: 'Mapa', politico: 'Político', recursos: 'Recursos', moral: 'Moral' };
  $('#speed').innerHTML = [['pausa', 0], ['play', 1], ['rapido', 2], ['turbo', 3]].map(([i, v]) => `<button data-sp="${v}" class="${speed === v ? 'on' : ''}" title="${['Pausar', 'Normal', 'Rápido', 'Muito rápido'][v]}">${UI_ICON[i]}</button>`).join('') + `<button class="mode" data-mode="1">${modes[view.mode]}</button>`;
}
document.addEventListener('click', e => {
  const w = e.target.closest('[data-w]'); if (w && S && !e.target.closest('#modal')) { if (w.dataset.w === 'eventos') { unread = 0; renderSide(); } if (w.dataset.w === 'jornal') { newsUnread = false; renderSide(); } openWin(w.dataset.w); return; }
  const sp = e.target.closest('[data-sp]'); if (sp) { speed = +sp.dataset.sp; acc = 0; renderSpeed(); return; }
  if (e.target.closest('[data-mode]')) { const ms = ['padrao', 'politico', 'recursos', 'moral']; view.mode = ms[(ms.indexOf(view.mode) + 1) % ms.length]; renderSpeed(); }
});

// ================= avisos
function toast(text, type = 'info', node = null) {
  const box = $('#toasts'); const d = document.createElement('div'); d.className = 'toast ' + type; d.textContent = text;
  d.onclick = () => { if (node != null && node >= 0 && M.nodes[node]) { view.centerOn(M.nodes[node].x, M.nodes[node].y, Math.max(view.k, 0.5)); if (node < M.nL) { selProv = node; selStack = null; } } d.remove(); };
  box.appendChild(d); while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 6000);
}
function hint(text) { let h = $('.hint.live'); if (!text) { h && h.remove(); return; } if (!h) { h = document.createElement('div'); h.className = 'hint live'; $('#app').appendChild(h); } h.textContent = text; }

// ================= entrada (mouse/toque)
function setupInput() {
  const cv = $('#map'); const pts = new Map(); let drag = null, pinch = null, moved = false;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false;
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag = null; } });
  cv.addEventListener('pointermove', e => {
    if (!S) return;
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const f = (pinch.k * d / pinch.d) / view.k; view.zoomAt(pinch.cx, pinch.cy, f); moved = true; return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; if (moved) { view.ox = drag.ox + dx; view.oy = drag.oy + dy; view.clamp(); } return; }
    if (e.pointerType === 'mouse') onHover(e.clientX, e.clientY);
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 0) { if (drag && !moved && S) onTap(e.clientX, e.clientY); drag = null; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); if (S) view.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); if (S && selStack) orderAt(e.clientX, e.clientY); });
}
function onHover(sx, sy) {
  const [x, y] = view.toWorld(sx, sy); const n = M.nodeAt(x, y); view.hover = n < M.nL ? n : -1;
  const st = selStack && S.stacks.find(s => s.id === selStack);
  if (pending) return;
  if (st && st.nat === S.opts.player && stackDomain(st) !== 'air' && n >= 0) {
    const key = st.id + ':' + n + ':' + st.node; if (key === previewKey) return; previewKey = key;
    let target = n; if (stackDomain(st) === 'sea' && M.isLand(n)) { const seas = M.seaNbrs[n]; target = seas.length ? seas[0] : -1; }
    const from = st.prog > 0 && st.path.length ? { ...st, node: st.path[0], prog: 0, path: [] } : st;
    const p = target >= 0 ? findPath(S, M, from, target) : null;
    const pos = stackPos(M, st);
    view.preview = p ? [[pos.x, pos.y], ...(from !== st ? [[M.nodes[from.node].x, M.nodes[from.node].y]] : []), ...p.map(i => [M.nodes[i].x, M.nodes[i].y])] : null;
  } else { view.preview = null; previewKey = ''; }
}
function onTap(sx, sy) {
  const hit = view.hitStack(sx, sy);
  const st = selStack && S.stacks.find(s => s.id === selStack);
  if (st && st.nat === S.opts.player) {
    if (hit === st.id) { selStack = null; clearPending(); hint(); return; }
    if (stackDomain(st) === 'air') return orderAt(sx, sy);
    // tropa terrestre/naval: o toque marca o destino e mostra a rota; a ordem só sai ao confirmar
    // (botão Confirmar no painel ou tocar de novo no mesmo destino)
    const t = hit && S.stacks.find(s => s.id === hit);
    const attack = !!(t && t.nat !== S.opts.player && hostile(S, S.opts.player, t.nat));
    let node; if (t && stackDomain(t) !== 'air' && !t.path.length && t.prog === 0) node = t.node; else { const [x, y] = view.toWorld(sx, sy); node = M.nodeAt(x, y); }
    if (node < 0) return;
    if (pending && pending.id === st.id && pending.node === node) return confirmOrder();
    return planOrder(st, node, attack ? t.id : null);
  }
  clearPending();
  if (hit) { selStack = hit; selProv = -1; return; }
  const [x, y] = view.toWorld(sx, sy); const n = M.nodeAt(x, y);
  selStack = null; selProv = n >= 0 && n < M.nL ? n : -1; view.preview = null;
}
function clearPending() { pending = null; view.preview = null; previewKey = ''; }
function planOrder(st, node, attackId) {
  let target = node; if (stackDomain(st) === 'sea' && M.isLand(node)) { const seas = M.seaNbrs[node]; if (!seas.length) { toast('Navios não chegam aí.', 'alerta'); return; } target = seas.reduce((a, b) => M.dist(st.node, a) < M.dist(st.node, b) ? a : b); }
  const from = st.prog > 0 && st.path.length ? { ...st, node: st.path[0], prog: 0, path: [] } : st;
  const p = findPath(S, M, from, target);
  if (!p || (!p.length && from === st)) { if (target === st.node) { toast('A tropa já está aí.'); return; } toast('Não há caminho até lá.', 'alerta'); return; }
  const pos = stackPos(M, st); const pts = [[pos.x, pos.y], ...(from !== st ? [[M.nodes[from.node].x, M.nodes[from.node].y]] : []), ...p.map(i => [M.nodes[i].x, M.nodes[i].y])];
  let km = 0; for (let i = 1; i < pts.length; i++) km += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  pending = { id: st.id, node, attack: attackId, eta: km / Math.max(1, stackSpeed(S, st)) };
  view.preview = pts; previewKey = 'pending';
}
function confirmOrder() {
  if (!pending) return; const P = S.opts.player, o = pending; clearPending();
  const r = o.attack ? C.attack(S, M, P, o.id, o.attack) : C.move(S, M, P, o.id, o.node);
  toast(r.msg, r.ok ? 'info' : 'alerta');
}
function orderAt(sx, sy) {
  const st = S.stacks.find(s => s.id === selStack); if (!st) return;
  const [x, y] = view.toWorld(sx, sy); const n = M.nodeAt(x, y); const P = S.opts.player;
  let r;
  if (stackDomain(st) === 'air') {
    if (airMode === 'rebase') r = C.airMission(S, M, P, st.id, 'rebase', 0, 0, n);
    else r = C.airMission(S, M, P, st.id, airMode, x, y);
  } else { if (n < 0) return; r = C.move(S, M, P, st.id, n); }
  if (!r.ok) toast(r.msg, 'alerta'); view.preview = null; previewKey = '';
}
function onKey(e) {
  if (e.target.matches('input,textarea')) return;
  if (e.key === 'Escape') { if (win) closeWin(); else if (pending) clearPending(); else { selStack = null; selProv = -1; view.preview = null; } }
  if (e.key === 'Enter' && pending && !win) confirmOrder();
  if (win && win.name === 'provincia' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); provStep(e.key === 'ArrowLeft' ? -1 : 1); }
  if (e.key === ' ' && S) { e.preventDefault(); speed = speed ? 0 : 1; renderSpeed(); }
}

// ================= painel inferior
function renderPanel() {
  const el = $('#panel');
  if (!S) { el.classList.add('hidden'); return; }
  const st = selStack && S.stacks.find(s => s.id === selStack);
  if (st) { el.classList.remove('hidden'); put(el, stackPanel(st)); return; }
  if (selProv >= 0) { el.classList.remove('hidden'); put(el, provPanel(selProv)); return; }
  el.classList.add('hidden'); put(el, '');
}
function relTag(o) { const P = S.opts.player; const r = o === P ? 'self' : rel(S, P, o); const t = { self: 'Você', guerra: 'Guerra', paz: 'Paz', aliado: 'Aliado', passagem: 'Passagem' }[r]; return `<span class="tag ${r}">${t}</span>`; }
function provPanel(i) {
  const p = M.provinces[i], sp = S.provinces[i], P = S.opts.player, own = sp.owner === P;
  const inc = provIncome(S, M, i); const vis2 = !S.opts.fog || vis.nodes.has(i) || own;
  const cls = own ? '' : hostile(S, P, sp.owner) ? 'enemy' : 'foreign';
  const garrison = S.stacks.filter(s => s.node === i && s.prog === 0 && stackDomain(s) !== 'sea' && (own || vis2));
  const blds = Object.entries(sp.b).map(([b, l]) => `<span class="chip" title="${BUILDINGS[b].name}">${BUILD_ICON[b]} ${BUILDINGS[b].max > 1 ? l : ''}</span>`).join('') || '<span class="muted small">Nenhum edifício</span>';
  return `<div class="ph ${cls}">${own ? '<button class="pa" data-p="pstep" data-d="-1" title="Província anterior">‹</button>' : ''}${flagSVG(sp.owner)}<div class="t">${esc(p.name)}</div>${relTag(sp.owner)}${own ? '<button class="pa" data-p="pstep" data-d="1" title="Próxima província">›</button>' : ''}<button class="x" data-p="close">${UI_ICON.fechar}</button></div>
  <div class="pb">
    <div style="min-width:170px"><div class="lbl">Produção diária</div>
      <div class="row">${RES_ICON.dinheiro}<b>${fmt(inc.money)}</b> ${RES_ICON[p.res]}<b>${fmt(inc.res)}</b></div>
      <div class="small muted" style="margin-top:4px">${TERRAIN[p.terrain].name}${p.double ? ' · recurso duplo' : ''}${p.city ? ' · cidade' : ''}${S.nations[sp.owner]?.capital === i ? ' · capital' : ''} · ${p.vp} pts</div>
      <div class="lbl" style="margin-top:8px">Moral ${Math.round(sp.morale)}% <span class="muted">→ ${Math.round(moraleTarget(S, M, i))}%</span></div><div class="bar"><i style="width:${sp.morale}%;background:hsl(${sp.morale * 1.1},45%,48%)"></i></div></div>
    <div class="grow"><div class="lbl">Edifícios</div><div class="chips">${blds}</div>
      ${own && sp.build ? `<div class="lbl" style="margin-top:8px">Construindo</div><div class="prog"><i style="width:${100 * (1 - sp.build.left / sp.build.total)}%"></i><span>${BUILDINGS[sp.build.type].name} · ${hrs(sp.build.left)}</span></div>` : ''}
      ${own && sp.queue.length ? `<div class="lbl" style="margin-top:8px">Produzindo (${sp.queue.length}/8)</div><div class="prog"><i style="width:${100 * (1 - sp.queue[0].left / sp.queue[0].total)}%"></i><span>${UNITS[sp.queue[0].u].name} · ${hrs(sp.queue[0].left)}</span></div>` : ''}
      ${!own ? `<div class="small muted" style="margin-top:8px">${esc(nname(sp.owner))}${sp.owner !== 'reb' ? ' · relação ' + Math.round(S.nations[sp.owner].opinion[P] || 0) : ''}</div>` : ''}</div>
    ${own ? `<div class="row" style="gap:10px;flex-wrap:wrap"><button class="bigbtn" data-p="build">${UI_ICON.martelo}<small>Construir</small></button><button class="bigbtn" data-p="units">${UI_ICON.capacete}<small>Produzir</small></button>${p.city && S.nations[P].capital !== i ? (S.nations[P].capMove ? `<span class="small muted" style="max-width:120px">Mudando a capital para ${esc(M.provinces[S.nations[P].capMove.to].name)} · ${hrs(S.nations[P].capMove.at - S.hour)}</span>` : `<button class="btn" data-p="capital" title="12 h de mudança">Tornar capital · ${fmt(C.CAPITAL_COST)}</button>`) : ''}</div>`
      : `<div class="row"><button class="btn" data-p="diplo" data-n="${sp.owner}">Diplomacia</button></div>`}
    <div style="min-width:150px"><div class="lbl">Tropas aqui</div><div class="chips">${garrison.length ? garrison.map(s => `<span class="chip" data-p="sel" data-id="${s.id}">${flagSVG(s.nat)} ${stackCount(s)}</span>`).join('') : `<span class="muted small">${vis2 ? 'Nenhuma' : 'Desconhecido'}</span>`}</div></div>
  </div>`;
}
function stackPanel(st) {
  const P = S.opts.player, own = st.nat === P, dom = stackDomain(st);
  const hp = stackHP(st); const f = hp.max ? hp.hp / hp.max : 0;
  let atk = 0, def = 0; for (const [u, e] of Object.entries(st.units)) { atk += e.n * (UNITS[u].atk.inf + UNITS[u].atk.arm) / 2; def += e.n * (UNITS[u].def.inf + UNITS[u].def.arm) / 2; }
  const where = dom === 'air' ? (st.mission ? { patrol: 'Patrulhando', strike: 'Atacando', return: 'Voltando à base', rebase: 'Trocando de base' }[st.mission.type] : 'Na base: ' + M.nodes[st.base].name)
    : (st.path.length ? `Rumo a ${M.nodes[st.path[st.path.length - 1]].name}` : st.fighting ? 'Em combate em ' + M.nodes[st.node].name : 'Parado em ' + M.nodes[st.node].name) + (isEmbarked(M, st) ? ' (embarcado)' : '');
  let eta = ''; if (st.path.length) { let d = M.edgeLen(st.node, st.path[0]) - st.prog; for (let i = 1; i < st.path.length; i++) d += M.edgeLen(st.path[i - 1], st.path[i]); eta = ' · chega em ~' + hrs(d / stackSpeed(S, st)); }
  const cls = own ? '' : hostile(S, P, st.nat) ? 'enemy' : 'foreign';
  const top = Object.keys(st.units).sort((a, b) => st.units[b].hp - st.units[a].hp)[0];
  const others = S.stacks.filter(o => o !== st && o.nat === P && stackDomain(o) === dom && (dom === 'air' ? !o.mission && !st.mission && o.base === st.base : o.node === st.node && o.prog === 0 && st.prog === 0));
  return `<div class="ph ${cls}">${own ? '<button class="pa" data-p="sstep" data-d="-1" title="Tropa anterior">‹</button>' : ''}${flagSVG(st.nat)}<div class="t">${esc(st.name || (UNITS[top]?.name || 'Tropa') + ' · ' + (st.nat === 'reb' ? 'Rebeldes' : NATION_BY_ID[st.nat].adj))}</div>${relTag(st.nat)}${own ? '<button class="pa" data-p="sstep" data-d="1" title="Próxima tropa">›</button>' : ''}<button class="x" data-p="close">${UI_ICON.fechar}</button></div>
  <div class="pb">
    <div style="width:150px;padding:0;position:relative"><div class="vign">${top ? unitHTML(top, st.nat, 'ic') : ''}<img src="${photoFor(UNIT_PHOTO[top] || 'infantaria', st.id)}" alt="" onerror="this.remove()"></div></div>
    <div style="min-width:170px"><div class="lbl">Pontos de vida</div><div class="row"><div class="bar grow"><i style="width:${f * 100}%;background:${f > .6 ? 'var(--good)' : f > .3 ? '#e2b84a' : 'var(--bad)'}"></i></div><b class="small">${Math.round(hp.hp)}/${Math.round(hp.max)}</b></div>
      <div class="stats" style="margin-top:8px"><span>${UI_ICON.raio} <b>${atk.toFixed(0)}</b></span><span>${UI_ICON.escudo} <b>${def.toFixed(0)}</b></span><span>${UI_ICON.velocidade} <b>${stackSpeed(S, st)}</b> km/h</span>${dom === 'air' ? `<span>alcance <b>${stackRange(st)}</b> km</span>` : ''}</div>
      <div class="small" style="margin-top:6px">${esc(where)}${eta}</div></div>
    <div class="grow"><div class="lbl">Unidades</div><div class="chips">${Object.entries(st.units).map(([u, e]) => `<span class="uchip" title="${UNITS[u].name}">${UA(u, st.nat)}<b>${e.n}×</b><small>${UNITS[u].name}</small></span>`).join('')}</div>
      ${own && pending && pending.id === st.id ? `<div class="gobar"><span>${pending.attack ? 'Atacar em' : 'Ir para'} <b>${esc(M.nodes[pending.node].name)}</b> · chega em ~${hrs(pending.eta)}</span><button class="btn pri" data-p="go">Confirmar</button><button class="btn" data-p="nogo">Cancelar</button></div>` : ''}
      ${own && dom !== 'air' && !(pending && pending.id === st.id) ? `<div class="small muted" style="margin-top:8px"><b>Mover/atacar:</b> toque no destino e confirme · <b>Soltar:</b> toque de novo nesta tropa</div>` : ''}
      ${own && dom === 'air' ? `<div class="small muted" style="margin-top:8px">Escolha a missão e toque no mapa (dentro do círculo de alcance)</div>` : ''}</div>
    ${own ? `<div class="acts2">
      ${dom === 'air' ? `<button class="abtn ${airMode === 'patrol' ? 'on' : ''}" data-p="air" data-m="patrol" title="Patrulhar uma área">${UI_ICON.patrulha}Patrulhar</button><button class="abtn ${airMode === 'strike' ? 'on' : ''}" data-p="air" data-m="strike" title="Atacar um alvo">${UI_ICON.alvo}Atacar</button><button class="abtn ${airMode === 'rebase' ? 'on' : ''}" data-p="air" data-m="rebase" title="Mudar para outro aeródromo">${UI_ICON.base}Nova base</button>` : ''}
      <button class="abtn" data-p="stop" title="${dom === 'air' ? 'Voltar à base' : 'Parar onde está'}">${UI_ICON.parar}${dom === 'air' ? 'Voltar' : 'Parar'}</button>
      <button class="abtn" data-p="split" title="Separar parte das unidades" ${stackCount(st) < 2 ? 'disabled' : ''}>${UI_ICON.dividir}Dividir</button>
      <button class="abtn" data-p="merge" title="Juntar com tropas no mesmo lugar" ${others.length ? '' : 'disabled'}>${UI_ICON.juntar}Juntar</button>
      ${dom !== 'air' ? `<button class="abtn ${st.stance === 'passivo' ? '' : 'on'}" data-p="stance" title="Artilharia e navios disparam sozinhos em inimigos ao alcance">${UI_ICON.mira}Fogo ${st.stance === 'passivo' ? 'desl.' : 'livre'}</button>` : ''}
      <button class="abtn" data-p="rename" title="Dar um nome a esta tropa"><span class="ic" style="font-size:20px;line-height:1">✎</span>Nome</button></div>` : `<div class="row"><button class="btn" data-p="diplo" data-n="${st.nat}">Diplomacia</button></div>`}
  </div>`;
}
$('#panel').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return; const a = b.dataset.p, P = S.opts.player;
  const st = selStack && S.stacks.find(s => s.id === selStack);
  if (a === 'close') { selStack = null; selProv = -1; clearPending(); }
  if (a === 'go') { confirmOrder(); renderPanel(); return; }
  if (a === 'nogo') { clearPending(); renderPanel(); return; }
  if (a === 'build') openWin('provincia', { prov: selProv, tab: 'edificios' });
  if (a === 'units') openWin('provincia', { prov: selProv, tab: 'terra' });
  if (a === 'sel') { selStack = +b.dataset.id; selProv = -1; }
  if (a === 'pstep') { const mine = myProvs(); const k = mine.indexOf(selProv); selProv = mine[(k + +b.dataset.d + mine.length) % mine.length]; const nd = M.nodes[selProv]; view.centerOn(nd.x, nd.y, view.k); renderPanel(); return; }
  if (a === 'sstep') { const mine = S.stacks.filter(o => o.nat === P && !o.dead).sort((x, y) => stackCount(y) - stackCount(x) || x.id - y.id); const k = mine.findIndex(o => o.id === selStack); const o = mine[(k + +b.dataset.d + mine.length) % mine.length]; clearPending(); selStack = o.id; selProv = -1; view.centerOn(o.x, o.y, view.k); renderPanel(); return; }
  if (a === 'diplo') openWin('diplomacia', { nat: b.dataset.n });
  if (a === 'capital') { const r = C.moveCapital(S, M, P, selProv); toast(r.msg, r.ok ? 'info' : 'alerta'); }
  if (!st) { renderPanel(); return; }
  if (a === 'stop') { const r = C.stop(S, M, P, st.id); toast(r.msg); }
  if (a === 'air') { airMode = b.dataset.m; }
  if (a === 'stance') st.stance = st.stance === 'passivo' ? 'agressivo' : 'passivo';
  if (a === 'merge') { const others = S.stacks.filter(o => o.nat === P && stackDomain(o) === stackDomain(st) && (stackDomain(st) === 'air' ? o.base === st.base && !o.mission : o.node === st.node && o.prog === 0)); const r = C.merge(S, M, P, others.map(o => o.id)); toast(r.msg, r.ok ? 'info' : 'alerta'); }
  if (a === 'split') openWin('dividir', { id: st.id });
  if (a === 'rename') { const nm = prompt('Nome da tropa:', st.name || ''); if (nm != null) C.rename(S, P, st.id, nm); }
  renderPanel();
});

// ================= janelas
// suas províncias na ordem da navegação: capital, cidades e o resto, cada grupo em ordem alfabética
function myProvs() { const P = S.opts.player, cap = S.nations[P].capital; return S.provinces.map((sp, i) => i).filter(i => S.provinces[i].owner === P).sort((a, b) => (b === cap) - (a === cap) || (M.provinces[b].city ? 1 : 0) - (M.provinces[a].city ? 1 : 0) || M.provinces[a].name.localeCompare(M.provinces[b].name)); }
function provStep(d, free) {
  if (!win || win.name !== 'provincia') return; const mine = myProvs(); if (!mine.length) return;
  let pos = mine.indexOf(win.prov); const tab = win.tab || 'edificios';
  const busy = i => tab === 'edificios' ? !!S.provinces[i].build : S.provinces[i].queue.length > 0;
  for (let k = 0; k < mine.length; k++) { pos = (pos + d + mine.length) % mine.length; if (!free || !busy(mine[pos])) break; }
  if (free && busy(mine[pos])) { toast(tab === 'edificios' ? 'Todas as províncias já estão construindo.' : 'Todas as filas de produção estão ocupadas.'); return; }
  win.prov = mine[pos]; selProv = win.prov; selStack = null; const nd = M.nodes[win.prov]; view.centerOn(nd.x, nd.y, Math.max(view.k, 0.45)); renderWin();
}
function openWin(name, opts = {}) { win = { name, ...opts }; $('#modal').classList.remove('hidden'); renderWin(); }
function closeWin() { win = null; $('#modal').classList.add('hidden'); put($('#modal'), ''); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-x]')) closeWin(); });
function frame({ title, tabs, tab, body, wide, cat = 'trincheira', live, nav }) {
  return `<div class="win ${wide ? 'wide' : ''}"><div class="wh" style="--banner:${banner(cat, title.length)}"><h2>${title}</h2>${nav || ''}<button class="x" data-x>${UI_ICON.fechar}</button>
    ${tabs ? `<div class="tabs">${tabs.map(([k, t]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</div>` : '<div style="height:6px"></div>'}</div><div class="wb">${body}</div></div>`;
}
function renderWin(isLive) {
  if (!win) return; const m = $('#modal'); const wb = m.querySelector('.wb'); const scroll = wb ? wb.scrollTop : 0;
  if (isLive && m.querySelector('input:focus,textarea:focus,select:focus')) return;
  const f = WINS[win.name]; if (!f) return closeWin();
  if (!put(m, f(win)) && isLive) return;
  const wb2 = m.querySelector('.wb'); if (wb2) wb2.scrollTop = scroll;
  const after = WIN_AFTER[win.name]; if (after) after(win);
}
$('#modal').addEventListener('click', e => {
  if (!win) return;
  const t = e.target.closest('[data-tab]'); if (t) { win.tab = t.dataset.tab; renderWin(); return; }
  const a = e.target.closest('[data-act]'); if (a) { const fn = ACTS[a.dataset.act]; if (fn) { fn(a, win); if (win) renderWin(); } }
});
$('#modal').addEventListener('change', e => { const a = e.target.closest('[data-chg]'); if (a && win) { const fn = ACTS[a.dataset.chg]; if (fn) { fn(a, win); renderWin(); } } });
function res(r, v, have) { return `<span class="cost ${have != null && have < v ? 'no' : ''}">${RES_ICON[r]}${fmt(v)}</span>`; }
function art(unitOrBuild, cat, seed) { return `<div class="vign">${UNITS[unitOrBuild] ? unitHTML(unitOrBuild, S.opts.player, 'ic') : BUILDINGS[unitOrBuild] ? `<img class="ic spr" src="assets/buildings/${unitOrBuild}.png" alt="">` : ''}<img loading="lazy" src="${photoFor(cat, seed)}" alt="" onerror="this.remove()"></div>`; }

const WINS = {
  provincia(w) {
    const mine = myProvs(); const pos = mine.indexOf(w.prov);
    const nav = mine.length > 1 && pos >= 0 ? `<div class="pnav"><button data-act="provNav" data-d="-1" title="Província anterior (←)">‹</button><span>${pos + 1}/${mine.length}</span><button data-act="provNav" data-d="1" title="Próxima província (→)">›</button><button class="free" data-act="provFree" title="Pula para a próxima província ${w.tab === 'edificios' || !w.tab ? 'sem construção em andamento' : 'com a fila de produção vazia'}">Próxima livre ›</button></div>` : '';
    const i = w.prov, p = M.provinces[i], sp = S.provinces[i], P = S.opts.player, n = S.nations[P]; w.live = true;
    if (!sp || sp.owner !== P) return frame({ title: p.name, body: '<div class="pad">Esta província não é mais sua.</div>' });
    const tab = w.tab || 'edificios';
    const q = sp.queue;
    const qbar = `<div class="qbar"><div><div class="lbl">Construção atual</div>${sp.build ? `<div class="prog"><i style="width:${100 * (1 - sp.build.left / sp.build.total)}%"></i><span>${BUILDINGS[sp.build.type].name} · ${hrs(sp.build.left)}</span></div><div class="row" style="margin-top:6px"><button class="btn" data-act="cancelBuild">Cancelar</button><button class="btn" data-act="rushBuild">Acelerar · ${fmt(C.speedUpCost(sp.build))}</button></div>${(sp.bq || []).length ? `<div class="small" style="margin-top:6px">Na fila: ${sp.bq.map((t, k) => `<span class="chip" style="display:inline-flex" data-act="unqueue" data-i="${k}" title="Tirar da fila">${k + 1}. ${BUILDINGS[t].name} ✕</span>`).join(' ')}</div>` : ''}` : '<span class="muted small">Nada em construção</span>'}</div>
      <div><div class="lbl">Produção atual</div>${q[0] ? `<div class="prog"><i style="width:${100 * (1 - q[0].left / q[0].total)}%"></i><span>${UNITS[q[0].u].name} · ${hrs(q[0].left)}</span></div><div class="row" style="margin-top:6px"><button class="btn" data-act="rushUnit">Acelerar · ${fmt(C.speedUpCost(q[0]))}</button></div>` : '<span class="muted small">Nada sendo produzido</span>'}</div>
      <div><div class="lbl">Fila de produção (${q.length}/8) · toque para cancelar</div><div class="qdots">${Array.from({ length: 8 }, (_, k) => q[k] ? `<span class="qdot" data-act="cancelQ" data-i="${k}" title="${UNITS[q[k].u].name}">${UA(q[k].u)}</span>` : '<span class="qdot empty"></span>').join('')}</div></div></div>`;
    let rows = '';
    if (tab === 'edificios') rows = BUILD_ORDER.map(b => {
      const B = BUILDINGS[b]; const u = buildUnlocked(S, M, i, b); const cur = sp.b[b] || 0; const lvl = Math.min(cur + 1, B.max);
      const cost = buildCost(b, lvl); const can = u.ok && !sp.build && canAfford(n, cost);
      const planned = cur + (sp.build && sp.build.type === b ? 1 : 0) + (sp.bq || []).filter(t => t === b).length;
      const canQ = !!sp.build && u.ok && (sp.bq || []).length < C.BUILD_QUEUE_MAX && planned < B.max;
      return `<div class="item ${u.ok ? '' : 'locked'}"><div class="art">${art(b, BUILD_PHOTO[b], b.length)}</div>
        <div><div class="nm">${B.name}</div><div class="lvl">${B.max > 1 ? `Nível atual ${cur} de ${B.max}` : cur ? 'Construído' : 'Não construído'}</div><div class="small muted">${B.desc}</div>${u.max ? '' : `<div class="costs" style="margin-top:4px">${Object.entries(cost).map(([r, v]) => res(r, v, n.res[r])).join('')}</div>`}</div>
        <div class="tm">${u.max ? 'Nível máximo' : u.ok ? hrs(buildTime(S, i, b, lvl)) : `<span class="why">${u.why}</span>`}${u.ok && sp.morale < 90 ? `<div class="small muted">moral +${hrs(buildTime(S, i, b, lvl) - B.time * lvl / S.opts.prodSpeed)}</div>` : ''}</div>
        <div class="acts">${sp.build ? `<button class="btn" data-act="build" data-b="${b}" ${canQ ? '' : 'disabled'} title="Começa quando a construção atual terminar (paga na hora de começar)">+ Fila</button>` : `<button class="rbtn" data-act="build" data-b="${b}" ${can ? '' : 'disabled'} title="Construir">${UI_ICON.martelo}</button>`}</div></div>`;
    }).join('');
    else rows = UNIT_TABS[tab].map(u => {
      const D = UNITS[u]; const un = unitUnlocked(S, M, i, u); const can = un.ok && q.length < 8 && canAfford(n, D.cost);
      const t = unitTime(S, i, u);
      return `<div class="item ${un.ok ? '' : 'locked'}"><div class="art">${art(u, UNIT_PHOTO[u], u.length)}</div>
        <div><div class="nm">${D.name}</div><div class="stats"><span>${UI_ICON.vida} <b>${D.hp}</b></span><span>${UI_ICON.raio} <b>${D.atk.inf}</b>/<b>${D.atk.arm}</b>/<b>${D.atk.air}</b></span><span>${UI_ICON.escudo} <b>${D.def.inf}</b>/<b>${D.def.arm}</b>/<b>${D.def.air}</b></span><span>${UI_ICON.velocidade} <b>${D.spd}</b></span>${D.rng ? `<span>alcance <b>${D.rng}</b></span>` : ''}${D.range ? `<span>raio <b>${D.range}</b> km</span>` : ''}</div>
          <div class="small muted">ataque/defesa contra infantaria / blindados / aviões</div><div class="costs" style="margin-top:4px">${Object.entries(D.cost).map(([r, v]) => res(r, v, n.res[r])).join('')}</div></div>
        <div class="tm">${un.ok ? hrs(t) : `<span class="why">${un.why}</span>`}</div>
        <div class="acts"><button class="rbtn" data-act="prod" data-u="${u}" ${can ? '' : 'disabled'} title="Produzir 1">${UI_ICON.capacete}</button><button class="rbtn" data-act="prod5" data-u="${u}" ${can ? '' : 'disabled'} title="Produzir 5">×5</button></div></div>`;
    }).join('');
    return frame({ title: p.name + (S.nations[P].capital === i ? ' ★' : ''), nav, cat: tab === 'edificios' ? 'fabrica' : 'infantaria', tabs: [['edificios', 'Edifícios'], ['terra', 'Terra'], ['aereo', 'Aéreo'], ['naval', 'Naval']], tab, body: qbar + rows });
  },
  dividir(w) {
    const st = S.stacks.find(s => s.id === w.id); if (!st) return frame({ title: 'Dividir', body: '<div class="pad">Tropa não existe mais.</div>' });
    w.take = w.take || Object.fromEntries(Object.entries(st.units).map(([u, e]) => [u, Math.floor(e.n / 2)]));
    return frame({ title: 'Dividir tropa', body: `<div class="pad"><p class="muted">Escolha quantas unidades formarão a nova tropa.</p>${Object.entries(st.units).map(([u, e]) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)">${UA(u)}<span class="grow">${UNITS[u].name}</span><button class="btn" data-act="spl" data-u="${u}" data-d="-1">−</button><b style="width:60px;text-align:center">${w.take[u] || 0} / ${e.n}</b><button class="btn" data-act="spl" data-u="${u}" data-d="1">+</button></div>`).join('')}
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn pri" data-act="doSplit">Dividir</button></div></div>` });
  },
  recursos() {
    const P = S.opts.player, n = S.nations[P]; const inc = nationIncome(S, M, P);
    const cats = Object.entries(CATS).map(([c, list]) => { const need = NEED_PER_PROV[c] * inc.nProv; const prod = list.reduce((s, r) => s + inc.prod[r], 0); const stock = list.reduce((s, r) => s + n.res[r], 0);
      return `<div class="card"><div class="lbl">${CAT_NAMES[c]} · consumo da população ${fmt(need)}/dia</div><div class="small">Produção ${fmt(prod)}/dia · estoque ${fmt(stock)} · ${Math.round((n.lastFulfil[c] ?? 1) * 100)}% atendido ontem</div>${stock < need ? '<div class="small neg">Estoque baixo: a moral vai cair se faltar!</div>' : ''}</div>`; }).join('');
    return frame({ title: 'Recursos', cat: 'fabrica', body: `<table class="t"><tr><th>Recurso</th><th>Estoque</th><th>Produção/dia</th><th>Consumo/dia</th><th>Saldo/dia</th></tr>${RES.map(r => { const s = inc.prod[r] - inc.cons[r]; return `<tr><td class="row">${RES_ICON[r]} ${RES_INFO[r].name}</td><td>${fmt(n.res[r])}</td><td>${fmt(inc.prod[r])}</td><td>${fmt(inc.cons[r])}</td><td class="${s >= 0 ? 'pos' : 'neg'}">${s >= 0 ? '+' : ''}${fmt(s)}</td></tr>`; }).join('')}</table>
      <div class="pad grid2">${cats}</div><div class="pad small muted">A população de cada província consome comida, materiais e energia todo dia. Se faltar, a moral cai e a produção diminui. O consumo de dinheiro inclui a manutenção das tropas. Compre e venda na Bolsa de Valores.</div>
      <div class="pad small">Corrupção (império com ${inc.nProv} províncias): <b class="${corruption(S, P) ? 'neg' : ''}">−${Math.round(corruption(S, P) * 100)}%</b> de produção em cada província · Força das tropas por falta de comida/energia: <b>${Math.round((0.7 + 0.3 * Math.min(n.lastFulfil.comida ?? 1, n.lastFulfil.energia ?? 1)) * 100)}%</b> · Escritórios de recrutamento alistam 1 infantaria a cada 3 dias.</div>` });
  },
  bolsa(w) {
    w.res = w.res || 'graos'; w.amt = w.amt || 1000; const r = w.res; const P = S.opts.player, n = S.nations[P];
    const offers = S.market.offers.filter(o => o.res === r && o.nat !== P);
    const sells = offers.filter(o => o.side === 'sell').sort((a, b) => a.price - b.price), buys = offers.filter(o => o.side === 'buy').sort((a, b) => b.price - a.price);
    const mine = S.market.offers.filter(o => o.nat === P);
    const list = (arr, side) => arr.length ? arr.slice(0, 8).map(o => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)">${flagSVG(o.nat)}<span class="grow small">${esc(nname(o.nat))}</span><b>${fmt(o.amt)}</b><span class="muted">@ ${o.price.toFixed(2)}</span><button class="btn ${side === 'sell' ? 'green' : ''}" data-act="take" data-id="${o.id}">${side === 'sell' ? 'Comprar' : 'Vender'}</button></div>`).join('') : '<div class="muted small" style="padding:6px 0">Nenhuma oferta agora.</div>';
    return frame({ title: 'Bolsa de valores', cat: 'multidao', wide: true, tabs: RES.filter(x => x !== 'dinheiro').map(x => [x, RES_INFO[x].name]), tab: r, body: `<div class="pad">
      <div class="row" style="margin-bottom:10px;flex-wrap:wrap">${RES_ICON[r]}<b>${RES_INFO[r].name}</b><span class="muted">Estoque ${fmt(n.res[r])} · Dinheiro ${fmt(n.res.dinheiro)} · Preço de mercado ${S.market.price[r].toFixed(2)}</span>
      <span class="grow"></span><span class="small">Quantidade</span><input type="number" id="amt" min="100" step="100" value="${w.amt}" style="width:110px" data-chg="amt"></div>
      <div class="grid2"><div class="card"><div class="lbl">Comprar ${RES_INFO[r].name.toLowerCase()} (ofertas de venda)</div>${list(sells, 'sell')}</div>
      <div class="card"><div class="lbl">Vender ${RES_INFO[r].name.toLowerCase()} (ofertas de compra)</div>${list(buys, 'buy')}</div></div>
      <div class="card" style="margin-top:12px"><div class="lbl">Banco central (sempre disponível)</div><div class="row" style="flex-wrap:wrap"><button class="btn green" data-act="bank" data-s="buy">Comprar ${fmt(w.amt)} por ${fmt(w.amt * MK.bankBuyPrice(S, r))}</button><button class="btn" data-act="bank" data-s="sell">Vender ${fmt(w.amt)} por ${fmt(w.amt * MK.bankSellPrice(S, r))}</button></div></div>
      <div class="card" style="margin-top:12px"><div class="lbl">Publicar minha oferta</div><div class="row" style="flex-wrap:wrap"><span class="small">Preço por unidade</span><input type="number" id="price" step="0.05" value="${S.market.price[r].toFixed(2)}" style="width:90px"><button class="btn" data-act="post" data-s="sell">Oferecer venda</button><button class="btn" data-act="post" data-s="buy">Oferecer compra</button></div><div class="small muted" style="margin-top:4px">As outras nações aceitam se o preço for bom (verificado uma vez por dia).</div></div>
      ${mine.length ? `<div class="card" style="margin-top:12px"><div class="lbl">Minhas ofertas</div>${mine.map(o => `<div class="row" style="padding:5px 0">${RES_ICON[o.res]}<span class="grow">${o.side === 'sell' ? 'Vendendo' : 'Comprando'} ${fmt(o.amt)} @ ${o.price.toFixed(2)}</span><button class="btn red" data-act="cancelOffer" data-id="${o.id}">Retirar</button></div>`).join('')}</div>` : ''}</div>` });
  },
  diplomacia(w) {
    const P = S.opts.player; w.live = true; const sc = scores(S, M);
    const props = S.proposals.filter(p => p.to === P);
    const pTxt = { mapa: 'quer compartilhar o mapa', paz: 'propõe a paz', passagem: 'pede direito de passagem', coligacao: 'convida para a coligação', entrar: 'quer entrar na sua coligação', alianca: 'propõe uma aliança' };
    const nats = Object.values(S.nations).filter(n => n.alive && !n.rebel && n.id !== P).sort((a, b) => (sc[b.id] || 0) - (sc[a.id] || 0));
    const sel = w.nat && S.nations[w.nat] && w.nat !== P ? w.nat : null;
    let detail = '';
    if (sel) {
      const t = S.nations[sel], r = rel(S, P, sel), op = Math.round(t.opinion[P] || 0); const myC = S.nations[P].coalition;
      const lastV = (S.nations[P].visits || {})[sel]; const vcd = lastV != null && S.hour - lastV < 48;
      detail = `<div class="card" style="margin-bottom:12px"><div class="row">${flagSVG(sel, 'flag round')}<div class="grow"><div class="h" style="font-size:20px">${esc(nname(sel))}</div><div class="small muted">${M.provinces.filter((p, i) => S.provinces[i].owner === sel).length} províncias · ${sc[sel] || 0} pontos · ${t.personality}${t.coalition ? ' · ' + esc(S.coalitions[t.coalition].name) : ''}</div></div>${relTag(sel)}</div>
        <div class="row" style="margin:10px 0"><span class="small">Relação com você</span><div class="relbar"><i style="left:${(op + 100) / 2}%"></i></div><b>${op}</b><span class="small muted">${C.relLabel(op)}</span></div>
        <div class="row" style="flex-wrap:wrap;gap:6px">
          ${r === 'guerra' ? `<button class="btn green" data-act="prop" data-t="paz">Propor paz</button>` : `<button class="btn red" data-act="war">Declarar guerra</button>`}
          ${r === 'paz' ? `<button class="btn" data-act="prop" data-t="passagem">Pedir passagem</button>` : ''}${r === 'passagem' ? `<button class="btn" data-act="revoke">Revogar passagem</button>` : ''}
          ${r !== 'guerra' ? `<button class="btn" data-act="visit" ${vcd ? 'disabled' : ''}>Visita oficial · ${fmt(C.VISIT_COST)}</button>` : ''}
          ${r !== 'guerra' && r !== 'aliado' ? `<button class="btn pri" data-act="ally">${myC ? 'Convidar para a coligação' : 'Propor aliança'}</button>` : ''}
          ${r !== 'guerra' ? (C.sharesMap(S, P, sel) ? `<button class="btn" data-act="unshare">Parar de compartilhar mapa</button>` : `<button class="btn" data-act="prop" data-t="mapa">Compartilhar mapa</button>`) : ''}
          ${r !== 'guerra' ? (C.embargoed(S, P, sel) ? `<button class="btn" data-act="embargo" data-on="0">Suspender embargo</button>` : `<button class="btn red" data-act="embargo" data-on="1">Embargo comercial</button>`) : ''}
          <button class="btn" data-act="spyGo">Espionar</button></div>
        ${r !== 'guerra' ? `<div class="row" style="margin-top:10px;flex-wrap:wrap"><span class="small">Enviar presente</span><select id="gres">${RES.map(x => `<option value="${x}">${RES_INFO[x].name}</option>`).join('')}</select><input type="number" id="gamt" value="5000" step="500" style="width:100px"><button class="btn" data-act="gift">Enviar</button></div>` : ''}
        <div class="small muted" style="margin-top:8px">Visitas e presentes melhoram a relação. Com relação Amistosa ou um inimigo em comum, a nação aceita aliança. Aliados entram nas suas guerras.</div></div>`;
    }
    const body = `<div class="pad">${props.length ? `<div class="card" style="margin-bottom:12px"><div class="lbl">Propostas recebidas</div>${props.map(p => `<div class="row" style="padding:6px 0">${flagSVG(p.from)}<span class="grow"><b>${esc(nname(p.from))}</b> ${pTxt[p.type] || p.type}</span><button class="btn green" data-act="ans" data-id="${p.id}" data-y="1">Aceitar</button><button class="btn red" data-act="ans" data-id="${p.id}" data-y="0">Recusar</button></div>`).join('')}</div>` : ''}${detail}
      <table class="t"><tr><th></th><th>Nação</th><th>Prov.</th><th>Pontos</th><th>Relação</th><th>Situação</th></tr>${nats.map(n => `<tr class="click" data-act="pick" data-n="${n.id}"><td>${flagSVG(n.id)}</td><td><b>${esc(nname(n.id))}</b></td><td>${S.provinces.filter(p => p.owner === n.id).length}</td><td>${sc[n.id] || 0}</td><td>${Math.round(n.opinion[P] || 0)} <span class="muted small">${C.relLabel(n.opinion[P] || 0)}</span></td><td>${relTag(n.id)}</td></tr>`).join('')}</table></div>`;
    return frame({ title: 'Diplomacia', cat: 'diplomacia', wide: true, body });
  },
  coligacoes(w) {
    const P = S.opts.player, my = S.nations[P].coalition; const sc = scores(S, M);
    const cs = Object.values(S.coalitions);
    return frame({ title: 'Coligações', cat: 'diplomacia', body: `<div class="pad">${my ? `<div class="card" style="margin-bottom:12px"><div class="lbl">Sua coligação</div><div class="h" style="font-size:20px">${esc(S.coalitions[my].name)}</div><div class="row" style="margin:8px 0;flex-wrap:wrap">${S.coalitions[my].members.map(m => `${flagSVG(m)} ${esc(nname(m))}`).join(' · ')}</div><div class="row"><button class="btn red" data-act="leaveC">Sair da coligação</button><span class="small muted">Para convidar alguém, use a Diplomacia.</span></div></div>`
      : `<div class="card" style="margin-bottom:12px"><div class="lbl">Fundar coligação</div><div class="row"><input type="text" id="cname" placeholder="Nome da coligação" maxlength="32" class="grow"><button class="btn pri" data-act="newC">Fundar</button></div><div class="small muted" style="margin-top:6px">Membros compartilham visão do mapa, não podem guerrear entre si e vencem juntos. Máximo de 4 nações.</div></div>`}
      <table class="t"><tr><th>Coligação</th><th>Membros</th><th>Províncias</th><th>Pontos</th></tr>${cs.length ? cs.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.members.map(m => flagSVG(m)).join(' ')}</td><td>${S.provinces.filter(p => c.members.includes(p.owner)).length}</td><td>${c.members.reduce((s, m) => s + (sc[m] || 0), 0)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">Nenhuma coligação formada ainda.</td></tr>'}</table></div>` });
  },
  espionagem(w) {
    const P = S.opts.player; const n = S.nations[P]; w.target = w.target && S.nations[w.target]?.alive ? w.target : Object.keys(S.nations).find(k => k !== P && k !== 'reb' && S.nations[k].alive);
    const act = n.spies.filter(s => s.until > S.hour);
    return frame({ title: 'Espionagem', cat: 'generais', body: `<div class="pad"><div class="row" style="margin-bottom:12px"><span>Nação alvo</span><select id="spyT" data-chg="spyT">${Object.values(S.nations).filter(x => x.alive && !x.rebel && x.id !== P).map(x => `<option value="${x.id}" ${x.id === w.target ? 'selected' : ''}>${esc(nname(x.id))}</option>`).join('')}</select></div>
      ${Object.entries(C.SPY).map(([k, v]) => `<div class="item"><div class="art">${art('', { info: 'generais', sabotagem: 'explosao', militar: 'artilharia', economica: 'fabrica', contra: 'prisioneiros' }[k] || 'multidao', k.length)}</div><div><div class="nm">${v.name}${v.self ? ' <span class="small muted">(no seu país)</span>' : ''}</div><div class="small muted">${v.desc}</div><div class="costs" style="margin-top:4px">${res('dinheiro', v.cost, n.res.dinheiro)}</div></div><div class="tm">${v.days ? v.days + ' dias' : 'imediato'}<div class="small muted">${v.days ? '' : ((S.nations[w.target]?.counterUntil || 0) > S.hour ? '60%' : '25%') + ' de risco'}</div></div><div class="acts"><button class="btn pri" data-act="spy" data-k="${k}">Enviar</button></div></div>`).join('')}
      <div class="card" style="margin-top:12px"><div class="lbl">Operações ativas</div>${(n.counterUntil || 0) > S.hour ? `<div>Contraespionagem · termina em ${hrs(n.counterUntil - S.hour)}</div>` : ''}${act.length ? act.map(s => `<div>${flagSVG(s.target)} ${esc(nname(s.target))} · termina em ${hrs(s.until - S.hour)}</div>`).join('') : (n.counterUntil || 0) > S.hour ? '' : '<span class="muted small">Nenhuma</span>'}</div></div>` });
  },
  provincias(w) {
    const P = S.opts.player; w.live = true; w.sel = w.sel || []; w.sort = w.sort || 'pts';
    let list = S.provinces.map((sp, i) => [sp, i]).filter(([sp]) => sp.owner === P);
    const key = { nome: ([, i]) => M.provinces[i].name, pts: ([, i]) => -M.provinces[i].vp, moral: ([sp]) => -sp.morale, prod: ([, i]) => -provIncome(S, M, i).money, obra: ([sp]) => sp.build ? 1 : 0, fila: ([sp]) => sp.queue.length }[w.sort];
    list.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) || M.provinces[a[1]].name.localeCompare(M.provinces[b[1]].name); });
    w.sel = w.sel.filter(i => S.provinces[i].owner === P);
    const all = list.length && w.sel.length === list.length;
    const th = (k, t) => `<th class="click" data-act="psort" data-k="${k}" title="Ordenar">${t}${w.sort === k ? ' ▾' : ''}</th>`;
    const bar = `<div class="massbar"><b>${w.sel.length ? w.sel.length + ' marcada(s)' : 'Marque províncias para agir em todas de uma vez'}</b>
      <span class="row"><select id="mBld">${BUILD_ORDER.map(b => `<option value="${b}" ${w.mb === b ? 'selected' : ''}>${BUILDINGS[b].name}</option>`).join('')}</select><button class="btn pri" data-act="massBuild" ${w.sel.length ? '' : 'disabled'}>Construir nas marcadas</button></span>
      <span class="row"><select id="mUnit">${Object.values(UNIT_TABS).flat().map(u => `<option value="${u}" ${w.mu === u ? 'selected' : ''}>${UNITS[u].name}</option>`).join('')}</select><input type="number" id="mQty" value="${w.mq || 1}" min="1" max="8" style="width:56px"><button class="btn pri" data-act="massProd" ${w.sel.length ? '' : 'disabled'}>Produzir nas marcadas</button></span></div>`;
    return frame({ title: 'Administração das províncias', cat: 'fabrica', wide: true, body: bar + `<table class="t"><tr><th><input type="checkbox" data-act="pselAll" ${all ? 'checked' : ''} title="Marcar todas"></th>${th('nome', 'Província')}${th('pts', 'Pts')}${th('moral', 'Moral')}${th('prod', 'Produz/dia')}<th>Edifícios</th>${th('obra', 'Construção')}${th('fila', 'Fila')}<th></th></tr>${list.map(([sp, i]) => { const inc = provIncome(S, M, i); const p = M.provinces[i]; return `<tr><td><input type="checkbox" data-act="psel" data-i="${i}" ${w.sel.includes(i) ? 'checked' : ''}></td><td><b class="click" data-act="goto" data-i="${i}" style="cursor:pointer">${esc(p.name)}</b>${S.nations[P].capital === i ? ' ★' : ''}</td><td>${p.vp}</td><td><span style="color:hsl(${sp.morale * 1.1},55%,60%)">${Math.round(sp.morale)}%</span></td><td>${RES_ICON.dinheiro}${fmt(inc.money)} ${RES_ICON[p.res]}${fmt(inc.res)}</td><td>${Object.entries(sp.b).map(([b, l]) => `<span title="${BUILDINGS[b].name}">${BUILD_ICON[b]}${BUILDINGS[b].max > 1 ? l : ''}</span>`).join(' ')}</td><td class="small">${sp.build ? BUILDINGS[sp.build.type].name + ' · ' + hrs(sp.build.left) + ((sp.bq || []).length ? ` (+${sp.bq.length})` : '') : '—'}</td><td class="small">${sp.queue.length ? sp.queue.length + ' · ' + UNITS[sp.queue[0].u].name : '—'}</td><td style="white-space:nowrap"><button class="btn" data-act="openProv" data-i="${i}" data-t="edificios">Construir</button> <button class="btn" data-act="openProv" data-i="${i}" data-t="terra">Produzir</button></td></tr>`; }).join('')}</table>` });
  },

  exercitos(w) {
    const P = S.opts.player; w.live = true; const list = S.stacks.filter(s => s.nat === P);
    return frame({ title: 'Exércitos', cat: 'infantaria', wide: true, body: `<table class="t"><tr><th>Tropa</th><th>Unidades</th><th>Vida</th><th>Local</th><th>Situação</th></tr>${list.map(s => { const hp = stackHP(s); const dom = stackDomain(s); const loc = dom === 'air' ? M.nodes[s.base].name : M.nodes[s.node].name; const sit = dom === 'air' ? (s.mission ? s.mission.type === 'patrol' ? 'Patrulha' : s.mission.type === 'strike' ? 'Ataque' : 'Retornando' : 'Na base') : s.fighting ? 'Em combate' : s.path.length ? 'Em marcha → ' + M.nodes[s.path[s.path.length - 1]].name : 'Parado';
      return `<tr class="click" data-act="selS" data-id="${s.id}"><td><b>${esc(s.name || UNITS[Object.keys(s.units)[0]].name)}</b></td><td>${Object.entries(s.units).map(([u, e]) => `<span class="chip" style="display:inline-flex">${UA(u)}${e.n}</span>`).join(' ')}</td><td>${Math.round(100 * hp.hp / hp.max)}%</td><td>${esc(loc)}</td><td class="small">${esc(sit)}</td></tr>`; }).join('')}</table>` });
  },
  eventos() {
    const ev = S.events.slice().reverse().slice(0, 120);
    return frame({ title: 'Avisos', cat: 'generais', body: `<div class="pad">${ev.length ? ev.map(e => `<div class="row click" data-act="evGo" data-n="${e.node ?? ''}" style="padding:7px 0;border-bottom:1px solid var(--line);cursor:pointer"><span class="small muted" style="width:70px">Dia ${Math.floor(e.h / 24) + 1} ${String(e.h % 24).padStart(2, '0')}h</span><span class="${e.type === 'derrota' || e.type === 'alerta' ? 'neg' : e.type === 'vitoria' ? 'pos' : ''}">${esc(e.text)}</span></div>`).join('') : '<span class="muted">Nada por enquanto.</span>'}</div>` });
  },
  config() {
    return frame({ title: 'Menu', cat: 'generais', body: `<div class="pad col">${['1', '2', '3'].map(k => { const i = slotInfo(k); return `<div class="row"><span class="grow">Espaço ${k}: <span class="muted">${i ? esc(nname(i.nat)) + ' · Dia ' + i.day : 'vazio'}</span></span><button class="btn" data-act="saveS" data-k="${k}">Salvar aqui</button><button class="btn" data-act="loadS" data-k="${k}" ${i ? '' : 'disabled'}>Carregar</button></div>`; }).join('')}
      <div class="row" style="margin-top:10px"><button class="btn" data-act="help">Como jogar</button><button class="btn red" data-act="quit">Sair para o menu</button></div>
      <div class="small muted">O jogo salva sozinho a cada dia de jogo. Atalhos: espaço pausa, Esc fecha janelas, botão direito move a tropa selecionada.</div></div>` });
  },
  ajuda() {
    const items = [['Objetivo', `Controlar ${'60%'} dos pontos de vitória do mapa (sozinho ou com sua coligação). Capitais valem 5 pontos, cidades 2 e as demais províncias 1.`],
      ['Economia', 'Cada província produz dinheiro e um recurso, proporcional à moral. A população consome comida, materiais e energia; se faltar, a moral cai. Use a Bolsa para comprar o que faltar.'],
      ['Construir e produzir', 'Toque numa província sua e use Construir (martelo) ou Produzir (capacete). Edifícios liberam unidades: Recrutamento → Infantaria, Quartel → Cavalaria, Oficina → Blindados e Artilharia, Fábrica → Tanques, Aeródromo → Aviões, Porto → Navios.'],
      ['Mover e atacar', 'Toque numa tropa e depois no destino. Para atacar, toque na tropa inimiga ou mande sua tropa para a província dela. Tropas que vão para o mar embarcam sozinhas (e ficam vulneráveis). Artilharia e navios disparam de longe.'],
      ['Aviação', 'Selecione os aviões, escolha Patrulhar, Atacar ou Trocar base e toque no mapa dentro do círculo de alcance.'],
      ['Diplomacia', 'Declare guerra, proponha paz, peça passagem. Faça visitas oficiais e mande presentes para melhorar a relação e formar alianças com as nações do computador.'],
      ['Moral', 'Fica alta perto da capital e cai com guerras, falta de recursos e conquistas recentes. Moral muito baixa gera rebeliões.'],
      ['Tempo', 'Use os botões de velocidade (canto superior direito) para pausar ou acelerar. O botão Mapa troca o modo de visualização.']];
    return frame({ title: 'Como jogar', cat: 'generais', body: `<div class="pad">${items.map(([t, d]) => `<div class="card" style="margin-bottom:8px"><div class="lbl">${t}</div>${d}</div>`).join('')}</div>` });
  },
  jornal(w) { return jornal(w); },
};
const WIN_AFTER = { jornal: w => drawMiniMap(w) };

const ACTS = {
  build: (b, w) => { const r = C.build(S, M, S.opts.player, w.prov, b.dataset.b); if (!r.ok || /fila/.test(r.msg)) toast(r.msg, r.ok ? 'info' : 'alerta'); },
  prod: (b, w) => { const r = C.produce(S, M, S.opts.player, w.prov, b.dataset.u, 1); if (!r.ok) toast(r.msg, 'alerta'); },
  prod5: (b, w) => { const r = C.produce(S, M, S.opts.player, w.prov, b.dataset.u, 5); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  cancelBuild: (b, w) => toast(C.cancelBuild(S, M, S.opts.player, w.prov).msg),
  cancelQ: (b, w) => toast(C.cancelProduce(S, M, S.opts.player, w.prov, +b.dataset.i).msg),
  rushBuild: (b, w) => { const r = C.speedUp(S, M, S.opts.player, w.prov, 'build'); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  rushUnit: (b, w) => { const r = C.speedUp(S, M, S.opts.player, w.prov, 'unit'); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  spl: (b, w) => { const st = S.stacks.find(s => s.id === w.id); const u = b.dataset.u; w.take[u] = Math.max(0, Math.min(st.units[u].n, (w.take[u] || 0) + +b.dataset.d)); },
  doSplit: (b, w) => { const r = C.split(S, M, S.opts.player, w.id, w.take); toast(r.msg, r.ok ? 'info' : 'alerta'); if (r.ok) { selStack = r.id; closeWin(); } },
  amt: (el, w) => { w.amt = Math.max(1, Math.floor(+el.value || 0)); },
  take: (b, w) => { const r = MK.takeOffer(S, S.opts.player, +b.dataset.id, w.amt); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  bank: (b, w) => { const r = MK.bankTrade(S, S.opts.player, b.dataset.s, w.res, w.amt); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  post: (b, w) => { const pr = +$('#price').value; const r = MK.postOffer(S, S.opts.player, b.dataset.s, w.res, w.amt, pr); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  cancelOffer: (b) => toast(MK.cancelOffer(S, S.opts.player, +b.dataset.id).msg),
  pick: (b, w) => { w.nat = b.dataset.n; $('#modal .wb') && ($('#modal .wb').scrollTop = 0); },
  war: (b, w) => { if (confirm(`Declarar guerra a ${nname(w.nat)}?`)) toast(C.declareWar(S, M, S.opts.player, w.nat).msg, 'alerta'); },
  prop: (b, w) => { const r = C.propose(S, M, S.opts.player, w.nat, b.dataset.t); toast(r.msg, r.accept === false ? 'alerta' : 'diplomacia'); },
  revoke: (b, w) => toast(C.revokePassage(S, M, S.opts.player, w.nat).msg),
  embargo: (b, w) => { const r = C.setEmbargo(S, M, S.opts.player, w.nat, b.dataset.on === '1'); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  unshare: (b, w) => toast(C.stopSharing(S, S.opts.player, w.nat).msg),
  visit: (b, w) => { const r = C.visit(S, M, S.opts.player, w.nat); toast(r.msg, r.ok ? 'diplomacia' : 'alerta'); },
  gift: (b, w) => { const r = C.gift(S, M, S.opts.player, w.nat, $('#gres').value, +$('#gamt').value); toast(r.msg, r.ok ? 'diplomacia' : 'alerta'); },
  ally: (b, w) => { const P = S.opts.player; if (!S.nations[P].coalition) { const r0 = C.createCoalition(S, M, P, 'Aliança ' + nname(P)); if (!r0.ok) return toast(r0.msg, 'alerta'); }
    const r = C.inviteCoalition(S, M, P, w.nat); if (r.accept === false && S.coalitions[S.nations[P].coalition]?.members.length === 1) C.quitCoalition(S, M, P); toast(r.msg, r.accept === false ? 'alerta' : 'diplomacia'); },
  spyGo: (b, w) => { win = { name: 'espionagem', target: w.nat }; },
  ans: (b) => { const r = C.answerProposal(S, M, S.opts.player, +b.dataset.id, b.dataset.y === '1'); toast(r.msg, 'diplomacia'); renderSide(); },
  leaveC: () => toast(C.quitCoalition(S, M, S.opts.player).msg),
  newC: () => toast(C.createCoalition(S, M, S.opts.player, $('#cname').value.trim()).msg),
  spyT: (el, w) => { w.target = el.value; },
  spy: (b, w) => { const r = C.spy(S, M, S.opts.player, w.target, b.dataset.k); toast(r.msg, r.ok ? 'info' : 'alerta'); },
  goto: (b) => { const i = +b.dataset.i; view.centerOn(M.nodes[i].x, M.nodes[i].y, Math.max(view.k, 0.5)); selProv = i; selStack = null; closeWin(); },
  provNav: (b, w) => provStep(+b.dataset.d),
  psort: (b, w) => { w.sort = b.dataset.k; },
  psel: (b, w) => { const i = +b.dataset.i; w.sel = w.sel.includes(i) ? w.sel.filter(x => x !== i) : [...w.sel, i]; },
  pselAll: (b, w) => { const mine = S.provinces.map((sp, i) => i).filter(i => S.provinces[i].owner === S.opts.player); w.sel = w.sel.length === mine.length ? [] : mine; },
  massBuild: (b, w) => { const t = $('#mBld').value; w.mb = t; let ok = 0, q = 0, fail = 0; for (const i of w.sel) { const r = C.build(S, M, S.opts.player, i, t); if (r.ok) /fila/.test(r.msg) ? q++ : ok++; else fail++; } toast(`${BUILDINGS[t].name}: ${ok} iniciada(s)${q ? `, ${q} na fila` : ''}${fail ? `, ${fail} não deu (nível, dia ou recursos)` : ''}.`, ok + q ? 'info' : 'alerta'); },
  massProd: (b, w) => { const u = $('#mUnit').value, n = Math.max(1, Math.min(8, +$('#mQty').value || 1)); w.mu = u; w.mq = n; let ok = 0, fail = 0; for (const i of w.sel) { const r = C.produce(S, M, S.opts.player, i, u, n); if (r.ok) ok++; else fail++; } toast(`${UNITS[u].name}: produção em ${ok} província(s)${fail ? `, ${fail} não deu (requisito, fila ou recursos)` : ''}.`, ok ? 'info' : 'alerta'); },
  unqueue: (b, w) => toast(C.unqueueBuild(S, M, S.opts.player, w.prov, +b.dataset.i).msg),
  provFree: (b, w) => provStep(1, true),
  openProv: (b) => { const i = +b.dataset.i; selProv = i; win = { name: 'provincia', prov: i, tab: b.dataset.t || 'edificios' }; },
  selS: (b) => { const st = S.stacks.find(s => s.id === +b.dataset.id); if (st) { selStack = st.id; selProv = -1; view.centerOn(st.x, st.y, Math.max(view.k, 0.5)); } closeWin(); },
  evGo: (b) => { const n = b.dataset.n; if (n !== '') { const i = +n; view.centerOn(M.nodes[i].x, M.nodes[i].y, Math.max(view.k, 0.5)); if (i < M.nL) { selProv = i; selStack = null; } } closeWin(); },
  saveS: (b) => { if (save(b.dataset.k)) toast('Jogo salvo no espaço ' + b.dataset.k + '.'); },
  loadS: (b) => { const d = loadSlot(b.dataset.k); if (d) { closeWin(); startGame(d.S); } },
  help: () => { win = { name: 'ajuda' }; },
  quit: () => { save('auto'); closeWin(); $('#panel').classList.add('hidden'); mainMenu(); },
  // jornal
  dayPrev: (b, w) => { w.day = Math.max(1, (w.day || day(S)) - 1); },
  dayNext: (b, w) => { w.day = Math.min(day(S), (w.day || day(S)) + 1); },
  jtab: (b, w) => { w.jtab = b.dataset.k; },
  jfil: (b, w) => { w.fil = b.dataset.k; },
  showAll: (b, w) => { w.all = !w.all; },
  write: (b, w) => { w.writing = !w.writing; },
  pickPhoto: (b, w) => { w.photo = b.dataset.u; },
  publish: (b, w) => { const r = C.writeArticle(S, S.opts.player, $('#atitle').value, $('#atext').value, w.photo); toast(r.msg, r.ok ? 'info' : 'alerta'); if (r.ok) { w.writing = false; w.photo = null; w.day = day(S); } },
};
// upload de foto para o artigo (reduzida para caber no salvamento)
document.addEventListener('change', e => {
  if (e.target.id !== 'aphoto' || !win) return; const f = e.target.files[0]; if (!f) return;
  const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 520 / img.width); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); win.photo = c.toDataURL('image/jpeg', 0.72); renderWin(); };
  img.src = URL.createObjectURL(f);
});

// ================= jornal
const POLLS = [
  ['temidas', 'Nações mais temidas', 'Uma sondagem revela quais exércitos mais assustam a opinião pública.', (n) => nationPower(S, n)],
  ['economias', 'Maiores economias', 'Os bancos centrais divulgam a produção diária de cada nação.', (n) => { const i = nationIncome(S, M, n); return Object.values(i.prod).reduce((a, b) => a + b, 0); }],
  ['imperios', 'Maiores impérios', 'O instituto de geografia publica a extensão de cada nação.', (n) => S.provinces.filter(p => p.owner === n).length],
  ['vitoriosas', 'Exércitos mais vitoriosos', 'Correspondentes de guerra contam as unidades inimigas destruídas.', (n) => S.nations[n].kills],
  ['industria', 'Potências industriais', 'Engenheiros listam as nações com mais fábricas, oficinas e ferrovias.', (n) => S.provinces.reduce((s, p) => p.owner === n ? s + (p.b.fabrica || 0) * 3 + (p.b.oficina || 0) * 2 + (p.b.ferrovia || 0) * 2 : s, 0)],
];
function jornal(w) {
  const P = S.opts.player; const today = day(S); const d = w.day = Math.min(w.day || today, today); w.live = d === today;
  const sc = scores(S, M); const rank = Object.entries(sc).filter(([k]) => k !== 'reb').sort((a, b) => b[1] - a[1]);
  const jtab = w.jtab || 'nacoes', fil = w.fil || 'todos';
  const myRank = rank.findIndex(([k]) => k === P);
  const shown = w.all ? rank : rank.slice(Math.max(0, Math.min(myRank - 2, rank.length - 5)), Math.max(0, Math.min(myRank - 2, rank.length - 5)) + 5);
  let topLeft = '';
  if (jtab === 'nacoes') topLeft = shown.map(([k, v]) => `<div class="rk"><span class="n">${rank.findIndex(x => x[0] === k) + 1}</span>${flagSVG(k, 'flag round')}<span>${esc(nname(k))}</span><span class="p">${v}</span></div>`).join('') + `<div style="text-align:center;padding:8px"><button class="btn" data-act="showAll">${w.all ? 'Mostrar menos' : 'Mostrar todos'}</button></div>`;
  if (jtab === 'coligacoes') { const cs = Object.values(S.coalitions); topLeft = cs.length ? cs.map(c => `<div class="rk">${c.members.map(m => flagSVG(m)).join('')}<span>${esc(c.name)}</span><span class="p">${c.members.reduce((s, m) => s + (sc[m] || 0), 0)}</span></div>`).join('') : '<p>Nenhuma coligação ainda.</p>'; }
  let poll = '';
  {
    const [, title, sub, f] = POLLS[(d - 1) % POLLS.length];
    const vals = Object.values(S.nations).filter(n => n.alive && !n.rebel).map(n => [n.id, f(n.id)]).sort((a, b) => b[1] - a[1]); const tot = vals.reduce((s, x) => s + Math.max(0, x[1]), 0) || 1;
    poll = `<div class="poll"><h3>${title}</h3><div class="small" style="margin-bottom:4px">${sub}</div>${vals.slice(0, 6).map(([k, v], i) => `<div class="pl"><b style="width:18px">${i + 1}º</b>${flagSVG(k)}<span style="width:120px">${esc(nname(k))}</span><span class="pb2"><i style="width:${100 * v / vals[0][1] || 0}%"></i></span><b>${(100 * Math.max(0, v) / tot).toFixed(1)}%</b></div>`).join('')}</div>`;
  }
  if (jtab === 'estatisticas') topLeft = poll;
  if (jtab === 'info') topLeft = `<div style="font:15px/1.45 Georgia,serif"><p><b>Partida:</b> ${NATIONS.length} nações · dificuldade ${DIFFICULTY[S.opts.difficulty].name} · produção ${S.opts.prodSpeed}× · névoa ${S.opts.fog ? 'ligada' : 'desligada'}.</p><p><b>Vitória:</b> controlar ${Math.round(S.opts.victory * 100)}% dos ${M.totalVP} pontos do mapa (coligações somam pontos).</p><p><b>Você:</b> ${esc(nname(P))}, ${sc[P] || 0} pontos, ${myRank + 1}º lugar.</p></div>`;
  // artigos do dia
  const fr = new Set([P, ...(S.nations[P].coalition ? S.coalitions[S.nations[P].coalition].members : [])]);
  let arts = S.news.filter(n => Math.floor(n.h / 24) + 1 === d);
  if (fil === 'eu') arts = arts.filter(n => (n.nats || []).includes(P) || n.from === P);
  if (fil === 'aliados') arts = arts.filter(n => (n.nats || []).some(x => x !== P && fr.has(x)));
  if (fil === 'inimigos') arts = arts.filter(n => (n.nats || []).some(x => hostile(S, P, x)));
  if (fil === 'politica') arts = arts.filter(n => ['guerra', 'paz', 'coligacao', 'comunicado', 'visita'].includes(n.type));
  arts = arts.slice().reverse();
  const hhmm = h => String(h % 24).padStart(2, '0') + ':' + String((h * 37) % 60).padStart(2, '0');
  const artHtml = arts.length ? arts.map((n, i) => {
    const from = n.from || (n.type === 'comunicado' ? n.nats?.[0] : null);
    const by = from ? `${flagSVG(from)}<span><b>${esc(nname(from))}</b>: Comunicado oficial do governo, ${hhmm(n.h)}</span>` : `<span><b>Agência Hegemonia</b>, ${hhmm(n.h)}</span>`;
    const photo = n.photo || (n.type !== 'comunicado' || i % 2 === 0 ? photoFor(NEWS_PHOTO[n.type] || (n.type === 'comunicado' ? 'multidao' : 'trincheira'), n.h + i) : null);
    return `<div class="art ${i === 0 ? 'big' : ''}"><h4>${esc(n.title || n.text.slice(0, 60))}</h4><div class="by">${by}</div>${photo ? `<img class="ph2" loading="lazy" src="${photo.startsWith('data:') || photo.startsWith('http') ? photo : photoUrl(photo)}" alt="" onerror="this.remove()">` : ''}<p>${esc(n.text)}</p></div>`;
  }).join('') : '<p style="font-family:Georgia,serif">Nenhuma notícia nesta edição.</p>';
  const write = w.writing ? `<div class="write"><div class="row" style="margin-bottom:6px"><input id="atitle" maxlength="80" placeholder="Manchete"></div><textarea id="atext" rows="4" maxlength="1200" placeholder="Texto do comunicado oficial do seu governo"></textarea>
    <div class="row" style="margin-top:6px;flex-wrap:wrap"><span class="small">Foto:</span>${w.photo ? `<img src="${w.photo.startsWith('data:') || w.photo.startsWith('http') ? w.photo : photoUrl(w.photo, 200)}" style="height:50px;border:1px solid #8b7d62">` : '<span class="small">nenhuma</span>'}<label class="btn" style="cursor:pointer">Enviar do aparelho<input type="file" id="aphoto" accept="image/*" hidden></label><span class="grow"></span><button class="btn pri" data-act="publish">Publicar</button></div>
    <div class="photopick">${Object.entries(ALL_PHOTOS).map(([c, l]) => l.map(t => `<img loading="lazy" src="${photoUrl(t, 200)}" title="${PHOTO_CATS[c]}" data-act="pickPhoto" data-u="${esc(t)}" class="${w.photo === t ? 'on' : ''}" onerror="this.remove()">`).join('')).join('')}</div></div>` : '';
  const date = new Date(1914, 7, 1 + d - 1).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="win wide news"><div class="mast" style="--banner:${banner('ruinas', d)}"><small>O Ilustrado</small><div class="title">Diário da Hegemonia</div><button class="x" data-x>${UI_ICON.fechar}</button></div>
    <div class="ed"><span>Edição ${d}</span><span class="nav"><button class="arr" data-act="dayPrev" ${d <= 1 ? 'disabled' : ''}>‹</button>${date} · Dia ${d}<button class="arr" data-act="dayNext" ${d >= today ? 'disabled' : ''}>›</button></span><button class="btn" data-act="write">${w.writing ? 'Cancelar' : 'Escrever artigo'}</button></div>
    <div class="tabs">${[['nacoes', 'Nações'], ['coligacoes', 'Coligações'], ['estatisticas', 'Estatísticas'], ['info', 'Informações do jogo']].map(([k, t]) => `<button data-act="jtab" data-k="${k}" class="${jtab === k ? 'on' : ''}">${t}</button>`).join('')}<span style="margin-left:auto;align-self:center;font:500 12px Oswald;color:#5b4f3d;padding-right:8px">Próximo dia em ${24 - (S.hour % 24)}h</span></div>
    <div class="wb">${write}<div class="top"><div>${topLeft}</div><div>${jtab === 'estatisticas' ? `<canvas class="minimap" id="mini" width="586" height="466"></canvas>` : poll + `<canvas class="minimap" id="mini" width="586" height="466" style="margin-top:8px"></canvas>`}</div></div>
    <div class="filters">${[['todos', 'Todos'], ['eu', 'Eu mesmo'], ['aliados', 'Aliados'], ['inimigos', 'Inimigos'], ['politica', 'Política']].map(([k, t]) => `<button data-act="jfil" data-k="${k}" class="${fil === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="arts">${artHtml}</div></div></div>`;
}
function drawMiniMap(w) {
  const cv = $('#mini'); if (!cv) return; const g = cv.getContext('2d'); const s = cv.width / M.W;
  g.fillStyle = '#d9cfb6'; g.fillRect(0, 0, cv.width, cv.height); g.setTransform(s, 0, 0, s, 0, 0);
  M.provinces.forEach((p, i) => { const o = S.provinces[i].owner; g.fillStyle = o === 'reb' ? '#6b6258' : NATION_BY_ID[o].color; g.globalAlpha = 0.75; g.fill(view.paths[i], 'evenodd'); });
  g.globalAlpha = 1; g.strokeStyle = 'rgba(60,45,30,.6)'; g.lineWidth = 4; g.stroke(view.allLand);
  // batalhas recentes = chamas
  const d = w.day; const evs = S.news.filter(n => Math.floor(n.h / 24) + 1 === d && n.node != null);
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const n of evs) { const nd = M.nodes[n.node]; const x = nd.x * s, y = nd.y * s; g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(x, y - 9); g.quadraticCurveTo(x + 6, y - 2, x, y + 3); g.quadraticCurveTo(x - 6, y - 2, x, y - 9); g.fill(); }
}

// ================= fim de jogo
function showEnd() {
  speed = 0; renderSpeed();
  const wv = S.winner; win = { name: '_end' }; $('#modal').classList.remove('hidden');
  put($('#modal'), `<div class="win"><div class="wh" style="--banner:${banner(wv.type === 'vitoria' ? 'desfile' : 'ruinas', 1)};min-height:180px"><h2 style="margin-top:110px;font-size:34px">${wv.type === 'vitoria' ? 'Vitória!' : 'Derrota'}</h2></div><div class="pad"><p style="font-size:17px">${esc(wv.text)}</p><p class="muted">A guerra durou ${day(S)} dias.</p><div class="row"><button class="btn" data-act2="keep">Continuar olhando o mapa</button><button class="btn pri" data-act2="menu">Menu principal</button></div></div></div>`);
  $('#modal').onclick = e => { const a = e.target.closest('[data-act2]')?.dataset.act2; if (a === 'keep') { win = null; $('#modal').classList.add('hidden'); $('#modal').onclick = null; } if (a === 'menu') { $('#modal').onclick = null; closeWin(); mainMenu(); } };
}

window.__game = { get S() { return S; }, get M() { return M; }, get view() { return view; }, startGame, newGame: o => startGame(newGame(M, o)), step: n => { for (let i = 0; i < n; i++) { step(S, M); afterStep(); } }, openWin, closeWin, select: (id) => { selStack = id; selProv = -1; }, selectProv: i => { selProv = i; selStack = null; }, setSpeed: v => { speed = v; renderSpeed(); }, tap: onTap, C };
boot();
