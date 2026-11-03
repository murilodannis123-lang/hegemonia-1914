import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from '../test/serve.mjs';
const srv = await serve(); const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('.mbtn');
await p.evaluate(() => { window.__game.newGame({ player: 'fra', seed: 5, fog: true }); });
await p.evaluate(() => { const g = window.__game; g.step(24 * 6); g.setSpeed(0); const S = g.S, M = g.M; const c = S.nations.fra.capital; g.view.centerOn(M.nodes[c].x + 150, M.nodes[c].y, 0.75); g.selectProv(c); });
await p.waitForTimeout(800); await p.screenshot({ path: process.argv[2] || '/tmp/claude-0/zoom.png' });
await b.close(); srv.close();
