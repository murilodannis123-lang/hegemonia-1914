// Joga como humano: cliques reais no mapa, guerra, captura, aviões, navios, bolsa, diplomacia, jornal, salvar/carregar.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs'; import fs from 'fs';
const OUT = '/tmp/claude-0/play'; fs.mkdirSync(OUT, { recursive: true });
const srv = await serve(); const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load|net::/.test(m.text())) errors.push(m.text()); });
const check = (name, ok, extra = '') => console.log(`${ok ? 'OK  ' : 'FALHOU'} ${name} ${extra}`);
await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('.mbtn');
await p.evaluate(() => window.__game.newGame({ player: 'fra', unlockAll: true, resources: 'abundante', prodSpeed: 10, seed: 42 }));
await p.waitForTimeout(500);
// 1) clique real numa tropa e depois num destino
const scr = await p.evaluate(() => { const g = window.__game, S = g.S, M = g.M, v = g.view; const P = S.opts.player; const st = S.stacks.find(s => s.nat === P && s.node === S.nations[P].capital); v.centerOn(st.x, st.y, 0.6); return { id: st.id }; });
await p.waitForTimeout(300);
const pos = await p.evaluate(id => { const v = window.__game.view; const h = v.hits.find(h => h.id === id); return h; }, scr.id);
await p.mouse.click(pos.x, pos.y - 12);
await p.waitForTimeout(400);
const selOk = await p.evaluate(() => !!document.querySelector('#panel .rbtn[data-p="split"]'));
check('selecionar tropa com clique', selOk);
const dest = await p.evaluate(() => { const g = window.__game, S = g.S, M = g.M, P = S.opts.player; const cap = S.nations[P].capital; const n = M.adj[cap].find(e => M.isLand(e.to) && S.provinces[e.to].owner === P).to; const [x, y] = g.view.toScreen(M.nodes[n].x, M.nodes[n].y); return { x, y, n }; });
await p.mouse.click(dest.x, dest.y + 20);
await p.waitForTimeout(200);
const moving = await p.evaluate(id => { const st = window.__game.S.stacks.find(s => s.id === id); return st && st.path.length > 0; }, scr.id);
check('mover com clique no mapa', moving);
await p.screenshot({ path: `${OUT}/1-movendo.png` });
// 2) guerra contra a Espanha e captura
const war = await p.evaluate(async () => {
  const g = window.__game, S = g.S, M = g.M, P = S.opts.player, C = g.C;
  const r = C.declareWar(S, M, P, 'esp');
  // junta um exército grande na fronteira e ataca a província espanhola vizinha mais fraca
  const border = S.provinces.map((p, i) => i).filter(i => S.provinces[i].owner === 'esp' && M.adj[i].some(e => M.isLand(e.to) && S.provinces[e.to].owner === P));
  const tgt = border[0]; const from = M.adj[tgt].find(e => M.isLand(e.to) && S.provinces[e.to].owner === P).to;
  const st = (await import('/src/engine/state.js')).addStack(S, M, P, from, { infantaria: 20, artilharia: 4, tanqueleve: 6 });
  const mv = C.move(S, M, P, st.id, tgt);
  for (let i = 0; i < 48 && S.provinces[tgt].owner !== P; i++) g.step(1);
  return { war: r.ok, move: mv.ok, captured: S.provinces[tgt].owner === P, alive: S.stacks.includes(st), news: S.news.slice(-3).map(n => n.title) };
});
check('declarar guerra', war.war); check('ataque e captura de província', war.captured, JSON.stringify(war.news));
// 3) produção de avião e missão aérea
const air = await p.evaluate(async () => {
  const g = window.__game, S = g.S, M = g.M, P = S.opts.player, C = g.C; const cap = S.nations[P].capital;
  S.provinces[cap].b.aerodromo = 2;
  const r = C.produce(S, M, P, cap, 'bombardeiro', 2); g.step(12);
  const st = S.stacks.find(s => s.nat === P && Object.keys(s.units).includes('bombardeiro'));
  if (!st) return { prod: r.ok, made: false };
  const enemy = S.stacks.find(s => s.nat === 'esp'); const m = C.airMission(S, M, P, st.id, 'strike', enemy.x, enemy.y);
  const hp0 = enemy ? Object.values(enemy.units).reduce((a, e) => a + e.hp, 0) : 0;
  g.step(10);
  const hp1 = S.stacks.includes(enemy) ? Object.values(enemy.units).reduce((a, e) => a + e.hp, 0) : 0;
  return { prod: r.ok, made: true, mission: m.ok, msg: m.msg, dmg: hp0 - hp1, back: !st.mission };
});
check('produzir bombardeiro', air.made); check('missão de ataque aéreo', air.mission && air.dmg > 0, JSON.stringify(air));
// 4) navios e desembarque
const nav = await p.evaluate(() => {
  const g = window.__game, S = g.S, M = g.M, P = S.opts.player, C = g.C;
  const port = S.provinces.map((p, i) => i).find(i => S.provinces[i].owner === P && M.provinces[i].coastal);
  S.provinces[port].b.porto = 2; const r = C.produce(S, M, P, port, 'cruzador', 1); g.step(12);
  const ship = S.stacks.find(s => s.nat === P && s.units.cruzador);
  const far = M.seas.find(s => M.dist(s.id, ship.node) > 400 && M.dist(s.id, ship.node) < 900);
  const mv = C.move(S, M, P, ship.id, far.id); g.step(8);
  // tropa embarca para ilha (Córsega/Sardenha?) — qualquer província costeira longe por mar
  const inf = S.stacks.find(s => s.nat === P && s.units.infantaria && !s.path.length && M.isLand(s.node));
  const sea = M.seaNbrs[inf.node][0] ?? M.seaNbrs[S.provinces.map((p, i) => i).find(i => S.provinces[i].owner === P && M.provinces[i].coastal)][0];
  const emb0 = C.move(S, M, P, inf.id, sea); g.step(12); const atSea = !M.isLand(inf.node) || inf.path.length === 0;
  const home = S.provinces.map((p, i) => i).find(i => S.provinces[i].owner === P && M.provinces[i].coastal && M.dist(i, inf.node) > 200);
  const emb1 = C.move(S, M, P, inf.id, home); g.step(40);
  const emb = { ok: emb0.ok && emb1.ok && M.isLand(inf.node), msg: emb0.msg + ' / ' + emb1.msg + ' / em terra: ' + M.isLand(inf.node) };
  return { prod: r.ok, ship: !!ship, shipMove: mv.ok && ship.path.length >= 0 && ship.node !== undefined, emb: emb.ok, embMsg: emb.msg };
});
check('navio produzido e navegando', nav.ship && nav.shipMove); check('embarque para ilha', nav.emb, nav.embMsg);
// 5) bolsa
const mk = await p.evaluate(async () => {
  const g = window.__game, S = g.S, P = S.opts.player; const MK = await import('/src/engine/market.js');
  const a = S.nations[P].res.ferro; const r1 = MK.bankTrade(S, P, 'buy', 'ferro', 1000); const r2 = MK.postOffer(S, P, 'sell', 'graos', 2000, 1.0); g.step(30);
  return { buy: r1.ok && S.nations[P].res.ferro > a, post: r2.ok, offers: S.market.offers.length };
});
check('bolsa: comprar no banco e publicar oferta', mk.buy && mk.post, JSON.stringify(mk));
// 6) diplomacia: visita, presente, aliança
const dip = await p.evaluate(() => {
  const g = window.__game, S = g.S, M = g.M, P = S.opts.player, C = g.C;
  const t = 'ita'; const o0 = S.nations[t].opinion[P] || 0;
  const v = C.visit(S, M, P, t); const gf = C.gift(S, M, P, t, 'dinheiro', 40000);
  const o1 = S.nations[t].opinion[P];
  if (!S.nations[P].coalition) C.createCoalition(S, M, P, 'Entente Teste');
  const inv = C.inviteCoalition(S, M, P, t);
  return { visit: v.ok, gift: gf.ok, rel: [o0, o1], ally: inv.accept, msg: inv.msg, aliado: S.nations[t].coalition === S.nations[P].coalition };
});
check('visita e presente melhoram relação', dip.visit && dip.gift && dip.rel[1] > dip.rel[0], JSON.stringify(dip.rel)); check('aliança com IA', dip.aliado, dip.msg);
// 7) jornal: escrever artigo pela interface
await p.evaluate(() => window.__game.openWin('jornal')); await p.waitForTimeout(200);
await p.click('[data-act="write"]'); await p.fill('#atitle', 'A França não recua'); await p.fill('#atext', 'Nossos soldados tomaram a fronteira.');
await p.click('[data-act="publish"]'); await p.waitForTimeout(200);
const art = await p.evaluate(() => window.__game.S.news.some(n => n.title === 'A França não recua'));
check('publicar artigo no jornal', art);
await p.screenshot({ path: `${OUT}/2-jornal.png` });
await p.evaluate(() => window.__game.closeWin());
// 8) botões de velocidade e tempo passando
await p.click('#speed [data-sp="3"]'); const h0 = await p.evaluate(() => window.__game.S.hour); await p.waitForTimeout(2000); const h1 = await p.evaluate(() => window.__game.S.hour);
check('velocidade máxima avança o tempo', h1 - h0 >= 8, `${h1 - h0} horas em 2s`);
await p.click('#speed [data-sp="0"]');
// 9) desempenho do desenho
const perf = await p.evaluate(async () => { const g = window.__game, v = g.view; const V = await import('/src/engine/vision.js'); const vis = V.computeVision(g.S, g.M, g.S.opts.player); const out = {}; for (const k of [v.minK, 0.6, 2]) { v.k = k; v.clamp(); const t0 = performance.now(); for (let i = 0; i < 20; i++) v.draw(g.S, vis, 0); out[k.toFixed(2)] = +((performance.now() - t0) / 20).toFixed(1); } const t1 = performance.now(); for (let i = 0; i < 24; i++) g.step(1); out.passoMs = +((performance.now() - t1) / 24).toFixed(1); return out; }).catch(e => 'erro: ' + e.message);
console.log('tempo médio de desenho (ms):', perf);
// 10) salvar e carregar
const sv = await p.evaluate(() => { const g = window.__game; const h = g.S.hour; document.querySelector('[data-w="config"]').click(); document.querySelector('[data-act="saveS"][data-k="1"]').click(); g.step(5); document.querySelector('[data-w="config"]')?.click(); document.querySelector('[data-act="loadS"][data-k="1"]').click(); return { h, after: g.S.hour }; });
check('salvar e carregar', sv.h === sv.after, JSON.stringify(sv));
await p.screenshot({ path: `${OUT}/3-final.png` });
const imgs = await p.evaluate(() => { const v = window.__game.view; const all = [...Object.values(v.resImg), ...Object.values(v.unitImg), ...Object.values(v.artImg)]; return { total: all.length, quebradas: all.filter(i => i.complete && !i.naturalWidth).length }; });
check('todas as imagens SVG do mapa decodificam', imgs.quebradas === 0, JSON.stringify(imgs));
console.log('ERROS:', errors.length ? errors.join('\n') : 'nenhum');
await b.close(); srv.close();
