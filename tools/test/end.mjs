import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs';
const srv = await serve(); const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('.mbtn');
const r = await p.evaluate(async () => {
  const g = window.__game; g.newGame({ player: 'fra', seed: 1, victory: 0.5 }); const S = g.S;
  S.provinces.forEach((pr, i) => { if (i % 3) pr.owner = 'fra'; }); for (let i = 0; i < 30 && !S.winner; i++) g.step(1);
  await new Promise(r => setTimeout(r, 300));
  const win = S.winner && S.winner.type; const modal = document.querySelector('#modal .win h2')?.textContent;
  // derrota
  g.newGame({ player: 'por', seed: 1 }); const S2 = g.S; S2.provinces.forEach(pr => { if (pr.owner === 'por') pr.owner = 'esp'; }); S2.stacks = S2.stacks.filter(s => s.nat !== 'por');
  S2.nations.por.alive = false; for (let i = 0; i < 24 && !S2.winner; i++) g.step(1); await new Promise(r => setTimeout(r, 300));
  return { win, modal, lose: S2.winner && S2.winner.type, modal2: document.querySelector('#modal .win h2')?.textContent };
});
console.log(JSON.stringify(r), 'erros:', errs);
await b.close(); srv.close();
