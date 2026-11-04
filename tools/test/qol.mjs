// Facilidades: setas entre províncias/tropas, fila de construção, ações em massa na administração das províncias.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs';
const OUT = process.env.OUT || '/tmp/claude-0/ui';
const srv = await serve(); const url = `http://localhost:${srv.address().port}/`;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fail = 0; const check = (n, ok, x = '') => { console.log((ok ? 'OK    ' : 'FALHOU ') + n, x); if (!ok) fail++; };
await p.goto(url); await p.waitForSelector('.mbtn'); await p.click('text=Novo jogo'); await p.waitForSelector('.natrow'); await p.click('.natrow[data-n="fra"]');
await p.click('.seg[data-k="resources"] button[data-v="abundante"]'); await p.click('text=Começar a guerra'); await p.waitForTimeout(600);
await p.evaluate(() => { window.__game.setSpeed(0); window.__game.S.opts.unlockAll = true; });
// setas no painel da província
await p.evaluate(() => { const g = window.__game; g.selectProv(g.S.nations.fra.capital); }); await p.waitForTimeout(400);
const p0 = await p.evaluate(() => document.querySelector('#panel .ph .t').textContent);
await p.click('#panel [data-p="pstep"][data-d="1"]'); await p.waitForTimeout(300);
const p1 = await p.evaluate(() => document.querySelector('#panel .ph .t').textContent);
check('seta do painel troca de província', p0 !== p1, `${p0} → ${p1}`);
// setas no painel da tropa
await p.evaluate(() => { const g = window.__game; const st = g.S.stacks.find(s => s.nat === 'fra'); g.select(st.id); }); await p.waitForTimeout(400);
const s0 = await p.evaluate(() => window.__game.view.sel);
await p.click('#panel [data-p="sstep"][data-d="1"]'); await p.waitForTimeout(300);
const s1 = await p.evaluate(() => window.__game.view.sel);
check('seta do painel troca de tropa', s0 !== s1);
// fila de construção
const cap = await p.evaluate(() => window.__game.S.nations.fra.capital);
await p.evaluate(cap => window.__game.openWin('provincia', { prov: cap, tab: 'edificios' }), cap); await p.waitForTimeout(300);
await p.click('.item [data-act="build"][data-b="oficina"]'); await p.waitForTimeout(200);
await p.click('.item [data-act="build"][data-b="aerodromo"]'); await p.waitForTimeout(200);
const q = await p.evaluate(cap => { const sp = window.__game.S.provinces[cap]; return { build: sp.build && sp.build.type, bq: sp.bq }; }, cap);
check('segundo edifício vai para a fila', q.build === 'oficina' && q.bq && q.bq[0] === 'aerodromo', JSON.stringify(q));
await p.evaluate(() => window.__game.step(80)); await p.waitForTimeout(200);
const q2 = await p.evaluate(cap => { const sp = window.__game.S.provinces[cap]; return { b: sp.b, build: sp.build && sp.build.type }; }, cap);
check('fila começa sozinha ao terminar', q2.b.oficina >= 1 && (q2.build === 'aerodromo' || q2.b.aerodromo >= 1), JSON.stringify(q2));
// administração: marcar todas e construir em massa
await p.evaluate(() => { window.__game.closeWin(); window.__game.openWin('provincias'); }); await p.waitForTimeout(300);
await p.click('[data-act="pselAll"]'); await p.waitForTimeout(200);
await p.selectOption('#mBld', 'quartel'); await p.click('[data-act="massBuild"]'); await p.waitForTimeout(300);
const nb = await p.evaluate(() => window.__game.S.provinces.filter(sp => sp.owner === 'fra' && ((sp.build && sp.build.type === 'quartel') || (sp.bq || []).includes('quartel'))).length);
check('construir em todas as marcadas', nb >= 5, `${nb} províncias`);
await p.selectOption('#mUnit', 'infantaria'); await p.fill('#mQty', '2'); await p.click('[data-act="massProd"]'); await p.waitForTimeout(300);
const np = await p.evaluate(() => window.__game.S.provinces.filter(sp => sp.owner === 'fra' && sp.queue.length >= 2).length);
check('produzir em todas as marcadas', np >= 5, `${np} províncias`);
await p.click('[data-act="psort"][data-k="nome"]'); await p.waitForTimeout(200);
const names = await p.evaluate(() => [...document.querySelectorAll('.t tr td:nth-child(2) b')].map(x => x.textContent));
check('ordenar por nome', names.join() === [...names].sort((a, b) => a.localeCompare(b)).join());
await p.screenshot({ path: `${OUT}/qol-provincias.png` });
check('sem erros na página', !errs.length, errs.join(' | '));
await b.close(); srv.close(); if (fail) process.exit(1); else console.log('ERROS: nenhum');
