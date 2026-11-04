// Regressão: com tropa selecionada, o 1º toque no destino (mesmo em cima da guarnição amiga) só marca a rota; o 2º toque confirma. Perto, longe e no celular.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs';
const srv = await serve(); const url = `http://localhost:${srv.address().port}/`;
const b = await chromium.launch(); let fail = false;
for (const [nm, vp, mob, K] of [['desk', { width: 1400, height: 820 }, false, 0.32], ['desk-far', { width: 1400, height: 820 }, false, 0.2], ['cel', { width: 390, height: 844 }, true, 0.32]]) {
  const p = await (await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForSelector('.mbtn'); await p.click('text=Novo jogo'); await p.waitForSelector('.natrow'); await p.click('.natrow[data-n="fra"]'); await p.click('text=Começar a guerra'); await p.waitForTimeout(800);
  const info = await p.evaluate((K) => { const g = window.__game, S = g.S, M = g.M; const cap = S.nations.fra.capital; const n = M.nodes[cap]; g.view.centerOn(n.x, n.y, K);
    const st = S.stacks.find(s => s.node === cap && s.nat === 'fra'); const to = M.adj[cap].map(e => e.to).find(j => j < M.nL && S.provinces[j].owner === 'fra');
    return { st: st.id, a: g.view.toScreen(n.x, n.y), b: g.view.toScreen(M.nodes[to].x, M.nodes[to].y), to, k: g.view.k }; }, K);
  await p.waitForTimeout(600);
  const tap = async (x, y) => mob ? p.touchscreen.tap(x, y) : p.mouse.click(x, y);
  await tap(info.a[0], info.a[1] - 15); await p.waitForTimeout(400);
  const selected = await p.evaluate(() => document.querySelector('#panel .ph .t')?.textContent);
  // destino: um pouco ao lado do nó para não clicar na tropa de lá
  await tap(info.b[0], info.b[1] - 12); await p.waitForTimeout(400);
  const before = await p.evaluate((id) => window.__game.S.stacks.find(s => s.id === id).path.length, info.st);
  await tap(info.b[0], info.b[1] - 12); await p.waitForTimeout(400); // segundo toque no mesmo destino confirma
  const r = await p.evaluate((id) => { const st = window.__game.S.stacks.find(s => s.id === id); return { path: st.path, node: st.node, toasts: [...document.querySelectorAll('#toasts > *')].map(t => t.textContent).slice(-3) }; }, info.st);
  const ok = before === 0 && r.path.length > 0 && !errs.some(e => !/Failed to load resource/.test(e)); if (!ok) fail = true;
  console.log(ok ? 'OK  ' : 'FALHA', nm, JSON.stringify({ k: info.k, selected, path: r.path }));
}
await b.close(); srv.close(); if (fail) process.exit(1);
