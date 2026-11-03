import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs';
const srv = await serve(); const b = await chromium.launch(); const errs = [];
for (const dev of ['iPhone 13', 'iPhone 13 landscape', 'Galaxy S9+', 'iPad Mini']) {
  const ctx = await b.newContext({ ...devices[dev] }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(dev + ': ' + e.message));
  await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('.mbtn');
  await p.tap('text=Novo jogo'); await p.waitForSelector('.natrow'); await p.tap('.natrow[data-n="gre"]');
  await p.tap('text=Começar a guerra', { timeout: 5000 }).catch(e => errs.push(dev + ': botão começar inacessível'));
  await p.waitForTimeout(500); const ok = await p.evaluate(() => !!(window.__game.S && window.__game.S.opts.player === 'gre'));
  console.log(dev, ok ? 'OK' : 'FALHOU'); if (dev === 'iPhone 13 landscape') { await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('.mbtn'); await p.tap('text=Novo jogo'); await p.waitForTimeout(400); await p.screenshot({ path: '/tmp/claude-0/setup-land.png' }); }
  await ctx.close();
}
console.log('erros:', errs); await b.close(); srv.close();
