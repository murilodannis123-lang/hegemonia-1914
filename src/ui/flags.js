import { NATION_BY_ID } from '../data/nations.js';
// Bandeiras simplificadas (30x20) a partir da especificação em nations.js.
export function flagSVG(id, cls = 'flag') {
  if (id === 'reb') return `<svg class="${cls}" viewBox="0 0 30 20"><rect width="30" height="20" fill="#2a2a2a"/><path d="M0 20L30 0" stroke="#b33" stroke-width="4"/></svg>`;
  const n = NATION_BY_ID[id]; if (!n) return '';
  const { t, c } = n.flag; let b = '';
  const h = (cols, w = cols.map(() => 1)) => { const T = w.reduce((a, x) => a + x, 0); let y = 0; return cols.map((k, i) => { const r = `<rect y="${y}" width="30" height="${20 * w[i] / T + 0.2}" fill="${k}"/>`; y += 20 * w[i] / T; return r; }).join(''); };
  const v = (cols, w = cols.map(() => 1)) => { const T = w.reduce((a, x) => a + x, 0); let x = 0; return cols.map((k, i) => { const r = `<rect x="${x}" width="${30 * w[i] / T + 0.2}" height="20" fill="${k}"/>`; x += 30 * w[i] / T; return r; }).join(''); };
  const cres = (bg, fg, cx = 13) => `<circle cx="${cx}" cy="10" r="5" fill="${fg}"/><circle cx="${cx + 1.7}" cy="10" r="4" fill="${bg}"/><path d="M${cx + 5.5} 10l3-1-2 2.4v-2.8l2 2.4z" fill="${fg}"/>`;
  if (t === 'h2' || t === 'h3') b = h(c);
  else if (t === 'h3w') b = h(c, [1, 2, 1]);
  else if (t === 'v3') b = v(c);
  else if (t === 'v2r') b = v(c, [2, 3]);
  else if (t === 'nordic') b = `<rect width="30" height="20" fill="${c[0]}"/><path d="M0 10h30M11 0v20" stroke="${c[1]}" stroke-width="${c[2] ? 5 : 4}"/>${c[2] ? `<path d="M0 10h30M11 0v20" stroke="${c[2]}" stroke-width="2.4"/>` : ''}`;
  else if (t === 'cres') b = `<rect width="30" height="20" fill="${c[0]}"/>${cres(c[0], c[1])}`;
  else if (t === 'uk') b = `<rect width="30" height="20" fill="${c[0]}"/><path d="M0 0l30 20M30 0L0 20" stroke="${c[1]}" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="${c[2]}" stroke-width="1.4"/><path d="M15 0v20M0 10h30" stroke="${c[1]}" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="${c[2]}" stroke-width="3.4"/>`;
  else if (t === 'greece') b = Array.from({ length: 9 }, (_, i) => `<rect y="${i * 20 / 9}" width="30" height="${20 / 9 + 0.1}" fill="${i % 2 ? c[1] : c[0]}"/>`).join('') + `<rect width="11" height="11.1" fill="${c[0]}"/><path d="M5.5 0v11M0 5.5h11" stroke="${c[1]}" stroke-width="2.2"/>`;
  else if (t === 'tri') b = h(c.slice(0, 3)) + `<path d="M0 0l10 10L0 20z" fill="${c[3]}"/>`;
  else if (t === 'v2c') b = v(c.slice(0, 2)) + cres(c[1], c[2], 14);
  else if (t === 'star') b = `<rect width="30" height="20" fill="${c[0]}"/><path d="M15 4.5l1.6 4.6h4.8l-3.9 2.9 1.5 4.6-4-2.9-4 2.9 1.5-4.6-3.9-2.9h4.8z" fill="none" stroke="${c[1]}" stroke-width="1.1"/>`;
  return `<svg class="${cls}" viewBox="0 0 30 20" preserveAspectRatio="none">${b}</svg>`;
}
// imagem (para desenhar no canvas)
const cache = {};
export function flagImage(id) {
  if (cache[id]) return cache[id];
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSVG(id).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" '));
  return (cache[id] = img);
}
