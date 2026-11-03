import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const svg = fs.readFileSync('assets/icon.svg', 'utf8');
const b = await chromium.launch();
for (const s of [192, 512]) { const p = await b.newPage({ viewport: { width: s, height: s } }); await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`); await p.screenshot({ path: `assets/icon-${s}.png` }); }
await b.close();
