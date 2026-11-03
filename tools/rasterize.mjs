// Converte os SVGs pintados (unidades extras e símbolos do mapa) em PNG transparente.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const { EXTRA_UNITS, STAMPS } = await import('../src/ui/stamps.js');
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
fs.mkdirSync('assets/map', { recursive: true });
const jobs = [...Object.entries(EXTRA_UNITS).map(([k, s]) => [`assets/units/${k}.png`, s]), ...Object.entries(STAMPS).map(([k, s]) => [`assets/map/${k}.png`, s])];
for (const [file, svg] of jobs) {
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const el = await p.$('svg'); await el.screenshot({ path: file, omitBackground: true }); console.log(file);
}
await b.close();
