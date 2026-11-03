// Teste de interface: abre o jogo num navegador real, executa as ações principais e tira prints.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs';
const OUT = process.env.OUT || '/tmp/claude-0/ui'; import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const srv = await serve(); const url = `http://localhost:${srv.address().port}/`;
const b = await chromium.launch();
const errors = [];
async function run(name, vp, mobile) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`[${name}] console: ${m.text()}`); });
  await p.goto(url); await p.waitForSelector('.mbtn'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}-1-menu.png` });
  await p.click('text=Novo jogo'); await p.waitForSelector('.natrow'); await p.waitForTimeout(300);
  await p.click('.natrow[data-n="ale"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/${name}-2-setup.png` });
  await p.click('text=Começar a guerra'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${name}-3-jogo.png` });
  const r = await p.evaluate(async () => {
    const g = window.__game, S = g.S, M = g.M, P = S.opts.player; const out = {};
    const cap = S.nations[P].capital; g.selectProv(cap);
    await new Promise(r => setTimeout(r, 400));
    out.panel = !!document.querySelector('#panel:not(.hidden) .bigbtn');
    g.openWin('provincia', { prov: cap, tab: 'edificios' }); await new Promise(r => setTimeout(r, 200));
    out.rows = document.querySelectorAll('.item').length;
    document.querySelector('[data-act="build"][data-b="oficina"]')?.click();
    out.build = !!S.provinces[cap].build;
    return out;
  });
  await p.screenshot({ path: `${OUT}/${name}-4-provincia.png` });
  const r2 = await p.evaluate(async () => {
    const g = window.__game, S = g.S, P = S.opts.player, cap = S.nations[P].capital; const out = {};
    g.openWin('provincia', { prov: cap, tab: 'terra' }); await new Promise(r => setTimeout(r, 200));
    document.querySelector('[data-act="prod"][data-u="infantaria"]')?.click();
    out.queue = S.provinces[cap].queue.length;
    return out;
  });
  await p.screenshot({ path: `${OUT}/${name}-5-producao.png` });
  // mover tropa e acelerar o tempo
  const r3 = await p.evaluate(async () => {
    const g = window.__game, S = g.S, M = g.M, P = S.opts.player; g.closeWin();
    const st = S.stacks.find(s => s.nat === P && s.node === S.nations[P].capital);
    const target = M.adj[st.node].find(e => M.isLand(e.to) && S.provinces[e.to].owner === P).to;
    const r = g.C.move(S, M, P, st.id, target); g.select(st.id);
    g.step(30);
    return { move: r.ok, moved: st.node === target || st.path.length === 0, day: Math.floor(S.hour / 24) + 1 };
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${name}-6-tropa.png` });
  for (const w of ['jornal', 'diplomacia', 'recursos', 'bolsa', 'coligacoes', 'espionagem', 'provincias', 'exercitos', 'eventos', 'config', 'ajuda']) {
    await p.evaluate(w => window.__game.openWin(w), w); await p.waitForTimeout(150);
    if (['jornal', 'diplomacia', 'bolsa'].includes(w)) await p.screenshot({ path: `${OUT}/${name}-w-${w}.png` });
  }
  await p.evaluate(() => window.__game.closeWin());
  await ctx.close();
  return { ...r, ...r2, ...r3 };
}
console.log('desktop', JSON.stringify(await run('desk', { width: 1366, height: 768 })));
if (!process.env.NOMOBILE) console.log('celular', JSON.stringify(await run('cel', { width: 844, height: 390 }, true)));
console.log('ERROS:', errors.length ? errors.join('\n') : 'nenhum');
await b.close(); srv.close();
