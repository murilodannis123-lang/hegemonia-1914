// Unidades ilustradas e coloridas (desenho próprio). Cor do uniforme/pintura varia por nação.
import { NATION_BY_ID } from '../data/nations.js';

// cor de uniforme por nação (aproximações históricas)
const UNIFORM = { ale: '#6f735c', aus: '#8d969b', hun: '#8d969b', fra: '#7f94ad', gbr: '#8b7b4e', rus: '#8c8a5c', rss: '#8c8a5c', vol: '#8c8a5c', ucr: '#8c8a5c', ita: '#7a7f68', tur: '#8e7c56', ana: '#8e7c56', ser: '#7d7f62', bul: '#7f7d64', rom: '#7d8a8c', gre: '#8a7b55', esp: '#7a8a8f', por: '#7f8a90' };
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
export const uniformOf = nat => UNIFORM[nat] || '#86794f';

const OUT = '#20180f';
const W = (s) => `<g stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${s}</g>`;
const wheel = (cx, cy, r, c = '#3a3128') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="#6b5a45" stroke-width="1.2"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${cx} ${cy}l${(r * 0.62 * Math.cos(i * Math.PI / 3)).toFixed(1)} ${(r * 0.62 * Math.sin(i * Math.PI / 3)).toFixed(1)}" stroke="#6b5a45" stroke-width="1"/>`).join('')}<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="#8a7a62" stroke="none"/>`;

function soldier(u, d, extra, opts = {}) {
  const helm = opts.helm || '#6d7068', skin = '#d8b48c', pack = '#6b4c2e';
  return W(`
    <path d="M47.5 44l-5.5 7.5-4 5" fill="none" stroke="${OUT}" stroke-width="7"/><path d="M47.5 44l-5.5 7.5-4 5" fill="none" stroke="${d}" stroke-width="4.6"/>
    <path d="M56 44l4.6 6.8 6 4.8" fill="none" stroke="${OUT}" stroke-width="7"/><path d="M56 44l4.6 6.8 6 4.8" fill="none" stroke="${d}" stroke-width="4.6"/>
    <path d="M33 57.6h8.4l.4-3h-7z" fill="#1c1510"/><path d="M64.6 56.6l7.6 1.6.6-2.8-6.8-1.6z" fill="#1c1510"/>
    <rect x="37" y="22" width="9.5" height="13.5" rx="2.4" fill="${pack}"/><path d="M38 26h8" stroke="#4a331d" fill="none"/>
    <path d="M45.5 21.5h12l3.2 15.5-2.4 8.2H43.6l-1.6-8.4z" fill="${u}"/><path d="M45.5 21.5h4l-1.5 23.7h-4.4l-1.6-8.4z" fill="${shade(u, -0.18)}" stroke="none"/>
    <path d="M44 33h16" stroke="#5a4428" stroke-width="2.4"/>
    <circle cx="51.5" cy="16.6" r="4.4" fill="${skin}"/>${opts.mask ? `<circle cx="51.8" cy="17.4" r="4.6" fill="#59604a"/><circle cx="53.6" cy="16.2" r="1.4" fill="#cfd8d0" stroke="none"/><circle cx="57" cy="19.4" r="2.6" fill="#3f4536"/>` : ''}
    <path d="M40 12.5c.8-5.5 5-8.5 10.5-8.5s9.6 3 10.4 8.5z" fill="${helm}"/><path d="M37 12.6h27.5" stroke-width="3.6"/><path d="M37 12.6h27.5" stroke="${shade(helm, -0.15)}" stroke-width="2"/>
    <path d="M44 9c2-2.6 4.4-3.6 7-3.6" fill="none" stroke="${shade(helm, 0.45)}" stroke-width="1.4"/>${extra}`);
}
const RIFLE = `<path d="M29 44L79 15" stroke-width="4"/><path d="M29 44L79 15" stroke="#7a5230" stroke-width="2.4"/><path d="M58 27L79 15" stroke="#4d4d4d" stroke-width="1.8"/><path d="M79 15l8.5-5" stroke="#c9c9c9" stroke-width="1.4"/>`;
const armsRifle = u => `<path d="M55 24.5l6 7.5 7.5-6" fill="none" stroke="${OUT}" stroke-width="6.2"/><path d="M55 24.5l6 7.5 7.5-6" fill="none" stroke="${u}" stroke-width="4"/><path d="M47.5 25l-.8 9.5 9.8 1.5" fill="none" stroke="${OUT}" stroke-width="6.2"/><path d="M47.5 25l-.8 9.5 9.8 1.5" fill="none" stroke="${u}" stroke-width="4"/>`;

const DRAW = {
  infantaria: (u, d) => soldier(u, d, RIFLE + armsRifle(u)),
  choque: (u, d) => soldier(u, d, `<path d="M55 24l9-9 5-7" fill="none" stroke="${OUT}" stroke-width="6.2"/><path d="M55 24l9-9 5-7" fill="none" stroke="${u}" stroke-width="4"/><path d="M68 9l3.5-6" stroke="#7a5230" stroke-width="2.4"/><ellipse cx="72.5" cy="3.8" rx="2.8" ry="3.8" fill="#55594a"/>
    <path d="M47.5 25l-1 10 8 4" fill="none" stroke="${OUT}" stroke-width="6.2"/><path d="M47.5 25l-1 10 8 4" fill="none" stroke="${u}" stroke-width="4"/>`, { mask: true }),
  cavalaria: (u, d) => W(`<path d="M30 40l-6 9-2 8" fill="none" stroke="${OUT}" stroke-width="5.4"/><path d="M30 40l-6 9-2 8" fill="none" stroke="#6b4426" stroke-width="3.4"/><path d="M38 41l3 8-3 8" fill="none" stroke="${OUT}" stroke-width="5.4"/><path d="M38 41l3 8-3 8" fill="none" stroke="#5a381f" stroke-width="3.4"/>
    <path d="M60 40l6 7 7 4" fill="none" stroke="${OUT}" stroke-width="5.4"/><path d="M60 40l6 7 7 4" fill="none" stroke="#6b4426" stroke-width="3.4"/><path d="M66 39l2 9-2 8" fill="none" stroke="${OUT}" stroke-width="5.4"/><path d="M66 39l2 9-2 8" fill="none" stroke="#5a381f" stroke-width="3.4"/>
    <path d="M24 31c-6-2-10 2-13 9" fill="none" stroke="#2b1c10" stroke-width="3.4"/>
    <path d="M24 31c2-7 10-10 22-10h18l7-8 5-4 6 2 4 6-3 2-6-2-4 6 1 9c0 4-3 6-7 6l-24 1c-6 0-10-1-14-3z" fill="#7b4f2c"/><path d="M30 25c6-3 14-4 24-4" fill="none" stroke="#a87444" stroke-width="2"/>
    <path d="M44 22l14-1 1 10H45z" fill="#4a3a2a"/>
    <path d="M47 21l-2-9 8-1 2 9z" fill="${u}"/><path d="M47 22l1 10" fill="none" stroke="${shade(u, -0.25)}" stroke-width="4"/><circle cx="50" cy="7.6" r="3.6" fill="#d8b48c"/><path d="M45.5 5h9" stroke-width="2.6"/><path d="M46.5 5c.5-2.6 2-3.6 3.6-3.6s3 1 3.5 3.6z" fill="${shade(u, -0.2)}"/>
    <path d="M54 13l12-9 6-3" fill="none" stroke="#d6d6d6" stroke-width="1.6"/>`),
  blindado: (u) => { const m = '#5f6450'; return W(`<path d="M8 40V31l10-3h8l6-6h34l5 6h14l7 5v7z" fill="${m}"/><path d="M26 28h4l6-6h30" fill="none" stroke="${shade(m, 0.35)}" stroke-width="1.4"/>
    <rect x="38" y="13" width="18" height="9" rx="2" fill="${shade(m, -0.1)}"/><path d="M56 16.5h18" stroke-width="3"/><path d="M56 16.5h18" stroke="#3b3b3b" stroke-width="1.6"/>
    <path d="M14 40h80" stroke-width="2.4"/>${wheel(24, 45, 9)}${wheel(76, 45, 9)}<path d="M84 31h8" stroke="#e8d27a" stroke-width="2"/>`); },
  artleve: () => { const m = '#5c6248'; return W(`<path d="M54 40l34 15" stroke-width="6.4"/><path d="M54 40l34 15" stroke="#5a4a32" stroke-width="4"/><path d="M18 23L84 9" stroke-width="5"/><path d="M18 23L84 9" stroke="#4a4f40" stroke-width="3.2"/>
    <path d="M40 13v22l14-2V11z" fill="${m}"/><path d="M42 15v17" stroke="${shade(m, 0.3)}" stroke-width="1.2"/>${wheel(47, 41, 13)}`); },
  antiaereo: () => { const m = '#5f6450'; return W(`<path d="M10 42h66l8-6h8v10H10z" fill="#6a5b3e"/><path d="M20 42v-8h22l4 8" fill="${m}"/><path d="M34 34L66 4" stroke-width="5.4"/><path d="M34 34L66 4" stroke="#4a4f40" stroke-width="3.6"/>
    <rect x="26" y="26" width="14" height="9" rx="1.5" fill="${shade(m, -0.15)}"/>${wheel(22, 50, 7)}${wheel(48, 50, 7)}${wheel(78, 50, 7)}`); },
  artilharia: () => { const m = '#565c45'; return W(`<path d="M52 42l38 13" stroke-width="7.4"/><path d="M52 42l38 13" stroke="#5a4a32" stroke-width="5"/><path d="M22 31L74 6" stroke-width="10"/><path d="M22 31L74 6" stroke="#4b5040" stroke-width="7.6"/><path d="M26 27L72 5" stroke="#7c826c" stroke-width="1.6"/>
    <path d="M34 22l16-8 6 10-16 8z" fill="${m}"/>${wheel(46, 40, 15)}`); },
  tanqueleve: () => { const m = '#6a6b4c'; return W(`<path d="M10 40c0-6 4-10 10-10h52c8 0 14 4 14 10s-5 11-12 11H20c-6 0-10-5-10-11z" fill="#2f2a22"/>
    <path d="M26 30l5-10h26l6 10z" fill="${m}"/><path d="M34 20l2-9h16l2 9z" fill="${shade(m, -0.08)}"/><path d="M52 15h18" stroke-width="3.6"/><path d="M52 15h18" stroke="#3b3b3b" stroke-width="2"/><path d="M33 22h22" stroke="${shade(m, 0.35)}" stroke-width="1.2"/>
    <path d="M86 42l10 6" stroke-width="3.4"/>${[21, 32, 42, 52, 62, 74].map((x, i) => `<circle cx="${x}" cy="${i === 0 || i === 5 ? 41 : 43}" r="${i === 0 || i === 5 ? 4.4 : 3.6}" fill="#5c5446" stroke-width="1"/>`).join('')}`); },
  tanquepesado: () => { const m = '#7a6e4c'; return W(`<path d="M4 34L18 10h64l14 24-10 18H14z" fill="${m}"/><path d="M18 10h64l3 5H15z" fill="${shade(m, 0.25)}" stroke="none"/><path d="M14 18h72" stroke="${shade(m, -0.3)}" stroke-width="1.6"/>
    <rect x="34" y="26" width="22" height="14" rx="2" fill="${shade(m, -0.22)}"/><path d="M40 32H20" stroke-width="4"/><path d="M40 32H20" stroke="#3b3b3b" stroke-width="2.4"/><rect x="38" y="4" width="16" height="7" rx="1.5" fill="${shade(m, -0.1)}"/>
    ${[24, 34, 44, 54, 64, 74].map(x => `<circle cx="${x}" cy="45.5" r="2.8" fill="${shade(m, -0.4)}" stroke-width="1"/>`).join('')}`); },
  ferroviario: () => { const m = '#545a46'; return W(`<path d="M2 54h96" stroke-width="3"/><path d="M8 57h4M24 57h4M40 57h4M56 57h4M72 57h4M88 57h4" stroke="#5a4028" stroke-width="2.4"/>
    <path d="M6 30L70 10" stroke-width="8"/><path d="M6 30L70 10" stroke="#4b5040" stroke-width="5.6"/><path d="M70 10l14-4" stroke-width="5"/><path d="M44 18h22l6 16H38z" fill="${m}"/>
    <rect x="10" y="34" width="82" height="9" rx="2" fill="#3e3a30"/>${wheel(18, 47, 5)}${wheel(30, 47, 5)}${wheel(72, 47, 5)}${wheel(84, 47, 5)}`); },
  balao: () => W(`<path d="M30 29l12 14M58 29l-12 14" fill="none" stroke-width="1"/><path d="M40 43h12l-2 7h-8z" fill="#7a5230"/>
    <path d="M14 12l-8-6M14 24l-8 6M12 18H2" stroke-width="4"/><path d="M14 12l-8-6M14 24l-8 6M12 18H2" stroke="#cdbf9a" stroke-width="2.4"/>
    <path d="M12 18c0-8 14-12 34-12s34 4 38 12c-4 8-18 12-38 12S12 26 12 18z" fill="#d9ccaa"/><path d="M22 12c8-3 18-4 28-4" fill="none" stroke="#fff8e6" stroke-width="2"/><path d="M14 22c10 5 30 6 50 3" fill="none" stroke="#a89a78" stroke-width="2"/>`),
  caca: (u, d, nc) => W(`<path d="M54 34l-4 12M62 34l4 12" fill="none" stroke-width="1.6"/>${wheel(50, 48, 4)}${wheel(66, 48, 4)}
    <path d="M28 36h48" stroke-width="5"/><path d="M28 36h48" stroke="#cbbb8f" stroke-width="3"/>
    <path d="M24 26l50-3c6 0 10 2 12 5-2 3-6 5-12 5l-50-2-14 4V22z" fill="#a8996c"/><path d="M10 22l-4-6h8l6 7" fill="#a8996c"/><path d="M74 23c6 0 10 2 12 5" fill="none" stroke="#6f6a5c" stroke-width="3"/>
    <path d="M38 14l-2 22M64 14l2 22" fill="none" stroke-width="1.6"/><path d="M30 13h44" stroke-width="5"/><path d="M30 13h44" stroke="#d8c99c" stroke-width="3"/>
    <circle cx="50" cy="13" r="3.4" fill="${nc}" stroke-width="1"/><path d="M88 16v24" stroke-width="2.8"/><path d="M88 16v24" stroke="#6b4a2c" stroke-width="1.4"/><path d="M58 23l-2-6h-6" fill="none" stroke-width="1.8"/>`),
  bombardeiro: (u, d, nc) => W(`<path d="M44 38l-3 10M62 38l3 10" fill="none" stroke-width="1.6"/>${wheel(40, 50, 4)}${wheel(66, 50, 4)}
    <path d="M12 39h80" stroke-width="5"/><path d="M12 39h80" stroke="#c5b689" stroke-width="3"/>
    <path d="M20 27l56-3c7 0 11 2 13 5-2 3-6 5-13 5l-56-2-14 4V23z" fill="#a39469"/><path d="M6 23l-4-7h9l7 8" fill="#a39469"/>
    <path d="M26 12l-2 26M48 12v26M70 12l2 26" fill="none" stroke-width="1.6"/><path d="M14 11h76" stroke-width="5"/><path d="M14 11h76" stroke="#d6c79a" stroke-width="3"/>
    <rect x="40" y="18" width="12" height="7" rx="2" fill="#555a4a"/><rect x="62" y="18" width="12" height="7" rx="2" fill="#555a4a"/><path d="M53 15v14M75 15v14" stroke-width="2"/>
    <circle cx="30" cy="11" r="3.2" fill="${nc}" stroke-width="1"/><circle cx="82" cy="11" r="3.2" fill="${nc}" stroke-width="1"/>`),
  zepelim: () => W(`<path d="M38 41h16l-2 6H40z" fill="#6f6a58"/><path d="M66 40h8l-1 4h-6z" fill="#6f6a58"/>
    <path d="M14 18l-10-10h12l8 8M14 34l-10 10h12l8-8" fill="#9c9478"/>
    <path d="M6 26C6 16 30 10 52 10s44 6 44 16-22 16-44 16S6 36 6 26z" fill="#b9b39b"/><path d="M14 20c10-6 30-8 44-8" fill="none" stroke="#efe9d6" stroke-width="2.4"/><path d="M12 32c16 6 46 7 70 0" fill="none" stroke="#8d866d" stroke-width="2.4"/>
    <g stroke="#7f7861" stroke-width="1.2" fill="none"><path d="M26 13v26M40 11v30M54 10v32M68 11v30M82 14v24"/></g>`),
  submarino: () => W(`<path d="M0 46h100" stroke="#5f8691" stroke-width="1.4"/><path d="M50 21V8M50 8h4" fill="none" stroke-width="2.4"/>
    <path d="M2 38c10-6 30-8 50-8s38 2 46 8c-8 6-26 8-46 8S12 44 2 38z" fill="#4c5258"/><path d="M8 37c10-4 26-5 44-5" fill="none" stroke="#7d858c" stroke-width="1.6"/>
    <path d="M40 31l3-10h14l3 10z" fill="#5b6268"/><path d="M28 31v-4h6" fill="none" stroke-width="2"/>`),
  cruzador: () => W(`<path d="M28 30V6M66 30V10" fill="none" stroke-width="1.8"/><path d="M2 36h96l-8 12H10z" fill="#6c737a"/><path d="M6 42h88" stroke="#9b3b2e" stroke-width="3"/>
    <path d="M16 30h60v6H16z" fill="#848b92"/><path d="M34 22h24v8H34z" fill="#959ca2"/><path d="M38 22l2-12h5l-1 12M50 22l1-10h5l-1 10" fill="#3f3f3f"/>
    <path d="M76 32l14-3M16 32L4 30" stroke-width="3"/>`),
  couracado: () => W(`<path d="M24 29V2M70 29V6" fill="none" stroke-width="1.8"/><path d="M1 36h98l-9 13H9z" fill="#5f666d"/><path d="M5 43h90" stroke="#9b3b2e" stroke-width="3"/>
    <path d="M12 29h70v7H12z" fill="#7b828a"/><path d="M30 20h32v9H30z" fill="#8b9299"/><path d="M38 20V12h14v8" fill="#959ca2"/><path d="M34 20l2-12h5l-1 12M48 12l1-8h5l-1 8" fill="#3a3a3a"/>
    <rect x="76" y="27" width="10" height="5" rx="1" fill="#6c737a"/><path d="M84 29l14-3M84 31l14-2" stroke-width="2.4"/><rect x="8" y="27" width="10" height="5" rx="1" fill="#6c737a"/><path d="M10 29L-2 26" stroke-width="2.4"/>`),
  transporte: () => W(`<path d="M48 36V8M48 12l-10 12" fill="none" stroke-width="1.8"/><path d="M4 36h92l-8 12H12z" fill="#3e3b38"/><path d="M8 42h84" stroke="#9b3b2e" stroke-width="3"/>
    <rect x="14" y="24" width="30" height="12" fill="#e2d8c2"/><rect x="54" y="26" width="26" height="10" fill="#8a6a46"/><path d="M30 24V12h7v12" fill="#a33a2a"/>`),
};
const cache = {};
export function unitArtSVG(u, nat, size = '') {
  const key = u + nat + size; if (cache[key]) return cache[key];
  const uni = uniformOf(nat); const nc = NATION_BY_ID[nat] ? NATION_BY_ID[nat].color : '#8a8a8a';
  const f = DRAW[u] || DRAW.infantaria;
  return (cache[key] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 64" ${size}>${f(uni, shade(uni, -0.25), nc)}</svg>`);
}

// sprites pintados (gerados para o jogo) — quando existem, substituem o desenho vetorial
export const UNIT_PNG = new Set(['infantaria', 'cavalaria', 'choque', 'blindado', 'artleve', 'artilharia', 'tanqueleve', 'tanquepesado', 'caca', 'bombardeiro', 'zepelim', 'couracado']);
export const unitPngUrl = u => `assets/units/${u}.png`;
export function unitHTML(u, nat, cls = 'ic unit') { return UNIT_PNG.has(u) ? `<img class="${cls} spr" src="${unitPngUrl(u)}" alt="">` : unitArtSVG(u, nat, `class="${cls}"`); }
