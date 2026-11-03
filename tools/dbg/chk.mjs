import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from '../test/serve.mjs';
const srv = await serve(); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('console', m.text()));
await p.goto(`http://localhost:${srv.address().port}/tools/dbg/units.html`); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => document.body.children.length));
await p.screenshot({ path: '/tmp/claude-0/units2.png', fullPage: true }); await b.close(); srv.close();
