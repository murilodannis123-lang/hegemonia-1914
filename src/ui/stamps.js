// Símbolos pintados do mapa (desenho próprio, SVG com luz e sombra).
const OUT = '#3b2a1a';
const sv = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}">${body}</svg>`;
const grad = (id, a, b, x2 = 1, y2 = 0) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

export const STAMPS = {
  montanha: sv(60, 40, `<defs>${grad('ml', '#efe4cf', '#c9b48f')}${grad('ms', '#9b8466', '#6f5a43')}</defs>
    <g stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round">
    <path d="M30 38 L42 12 L58 38z" fill="url(#ms)"/><path d="M42 12 L46 22 L44 38 L30 38z" fill="url(#ml)" stroke="none"/><path d="M42 12 L39 18 L42 17 L45 20z" fill="#fbf8f0" stroke="none"/>
    <path d="M2 38 L22 4 L44 38z" fill="url(#ms)"/><path d="M22 4 L28 18 L24 38 L2 38z" fill="url(#ml)" stroke="none"/><path d="M22 4 L18 12 L22 10 L26 14z" fill="#ffffff" stroke="none"/>
    <path d="M2 38 L22 4 L44 38" fill="none"/><path d="M30 38 L42 12 L58 38" fill="none"/></g>
    <path d="M10 30l5-6M14 34l4-5" stroke="#7d6850" stroke-width=".8" fill="none"/>`),
  colina: sv(56, 26, `<defs>${grad('hl', '#d9c9a3', '#a99572', 0, 1)}</defs>
    <g stroke="${OUT}" stroke-width="1" stroke-linejoin="round"><path d="M2 24c4-14 14-20 22-20s14 8 16 20z" fill="url(#hl)"/><path d="M24 24c3-10 10-14 16-14s12 6 14 14z" fill="url(#hl)"/></g>
    <path d="M8 20c4-8 9-12 15-13" stroke="#f3ead6" stroke-width="1.6" fill="none" opacity=".7"/><path d="M30 20c3-5 6-7 10-8" stroke="#f3ead6" stroke-width="1.4" fill="none" opacity=".7"/>
    <path d="M12 23l1-3 1 3M40 23l1-3 1 3" stroke="#6f7a45" stroke-width=".9" fill="none"/>`),
  floresta: sv(56, 40, `<defs>${grad('tg', '#7e9a5a', '#3f5a2e')}${grad('tg2', '#6f8d4e', '#34502a')}</defs>
    ${[[12, 26, 1], [28, 20, 1.15], [44, 27, 0.95], [21, 33, 0.9], [36, 34, 0.85]].map(([x, y, s], i) => `<g transform="translate(${x} ${y}) scale(${s})" stroke="${OUT}" stroke-width="1" stroke-linejoin="round">
      <ellipse cx="0" cy="9" rx="7" ry="2" fill="#000" opacity=".18" stroke="none"/><rect x="-1.2" y="3" width="2.4" height="6" fill="#5b3b22"/>
      <path d="M0 -16 L9 2 L-9 2z" fill="url(#${i % 2 ? 'tg2' : 'tg'})"/><path d="M0 -10 L10 6 L-10 6z" fill="url(#${i % 2 ? 'tg' : 'tg2'})"/>
      <path d="M0 -16 L-5 -5 M0 -10 L-6 2" stroke="#b6c98c" stroke-width=".9" fill="none"/></g>`).join('')}`),
  deserto: sv(60, 22, `<defs>${grad('dg', '#ecd39c', '#c9a463', 0, 1)}</defs>
    <g stroke="#9a7440" stroke-width="1" stroke-linejoin="round"><path d="M2 20c6-10 14-14 22-14 6 0 10 6 14 14z" fill="url(#dg)"/><path d="M26 20c5-7 11-10 18-10 6 0 10 4 14 10z" fill="url(#dg)"/></g>
    <path d="M10 16c5-5 9-7 13-7M33 17c4-3 7-5 11-5" stroke="#fff3d6" stroke-width="1.3" fill="none" opacity=".8"/>`),
  cidade: sv(40, 30, `<g stroke="${OUT}" stroke-width="1" stroke-linejoin="round">
    <ellipse cx="20" cy="27" rx="17" ry="3" fill="#000" opacity=".2" stroke="none"/>
    <path d="M4 26V15l6-5 6 5v11z" fill="#efe3c8"/><path d="M3 15.5l7-6 7 6" fill="none"/><path d="M4 15l6-5 6 5z" fill="#b5523a"/>
    <path d="M22 26V12h12v14z" fill="#e5d7b8"/><path d="M21 12.5l7-6 7 6z" fill="#a94a33"/>
    <path d="M13 26V19h10v7z" fill="#f4ead3"/><path d="M12 19.5l6-4 6 4z" fill="#c2603f"/>
    <path d="M6 18h2v2H6zM25 15h2v2h-2zM29 15h2v2h-2zM25 20h2v2h-2zM29 20h2v2h-2zM16 21h2v2h-2z" fill="#4a3a28" stroke="none"/></g>`),
  capital: sv(52, 40, `<g stroke="${OUT}" stroke-width="1" stroke-linejoin="round">
    <ellipse cx="26" cy="37" rx="23" ry="3.2" fill="#000" opacity=".22" stroke="none"/>
    <path d="M3 36V24l6-5 6 5v12z" fill="#efe3c8"/><path d="M3 24l6-5 6 5z" fill="#b5523a"/>
    <path d="M37 36V22l6-5 6 5v14z" fill="#e8dcc0"/><path d="M37 22l6-5 6 5z" fill="#a94a33"/>
    <path d="M14 36V20h24v16z" fill="#f2e8d2"/><path d="M12 20h28l-2-3H14z" fill="#d8c8a6"/>
    <path d="M18 17c0-6 4-9 8-9s8 3 8 9z" fill="#7f9aa0"/><path d="M21 15c1-3 3-5 5-5" stroke="#d7e6e6" stroke-width="1.2" fill="none"/>
    <path d="M26 8V1" stroke-width="1.2"/><path d="M26 1h6l-1.5 2 1.5 2h-6z" fill="#c8202e" stroke-width=".8"/>
    <path d="M17 23h3v8h-3zM24.5 23h3v8h-3zM32 23h3v8h-3z" fill="#5a4a36" stroke="none"/><path d="M14 36h24" stroke-width="1.4"/></g>`),
};

// Unidades que faltavam, no mesmo estilo pintado das miniaturas
const g2 = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const metal = `<defs>${g2('mo', '#8b9070', '#4f553e')}${g2('mg', '#a3a9ad', '#5c646b')}${g2('mw', '#8a5a34', '#5a371c')}${g2('mc', '#e6dcc0', '#a99c78')}${g2('mh', '#5f666d', '#2f353a')}</defs>`;
const wheel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#mw)" stroke="${OUT}" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="${r * .55}" fill="none" stroke="#3a2412" stroke-width="1"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${cx} ${cy}l${(r * .9 * Math.cos(i * 1.047)).toFixed(1)} ${(r * .9 * Math.sin(i * 1.047)).toFixed(1)}" stroke="#3a2412" stroke-width="1.1"/>`).join('')}<circle cx="${cx}" cy="${cy}" r="${r * .2}" fill="#3a2a1a"/>`;
const U = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 64" width="240" height="154">${metal}<g stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
export const EXTRA_UNITS = {
  antiaereo: U(`<path d="M8 44h64l10-7h10v12H8z" fill="url(#mo)"/><path d="M12 44h70" stroke="#c4c8a8" stroke-width="1" opacity=".6"/>
    <path d="M18 44v-9h24l5 9z" fill="url(#mo)"/><path d="M36 34L68 4" stroke-width="6.5"/><path d="M36 34L68 4" stroke="url(#mg)" stroke-width="4.4"/><path d="M68 4l4-3.5" stroke-width="3"/>
    <rect x="24" y="25" width="16" height="10" rx="2" fill="url(#mo)"/>${wheel(22, 51, 7)}${wheel(48, 51, 7)}${wheel(78, 51, 7)}`),
  ferroviario: U(`<path d="M2 58h96" stroke-width="3"/><path d="M6 61h5M22 61h5M38 61h5M54 61h5M70 61h5M86 61h5" stroke="#5a3a20" stroke-width="2.6"/>
    <rect x="8" y="38" width="84" height="10" rx="2" fill="url(#mh)"/>${wheel(18, 52, 5)}${wheel(30, 52, 5)}${wheel(70, 52, 5)}${wheel(82, 52, 5)}
    <path d="M6 32L72 10" stroke-width="9"/><path d="M6 32L72 10" stroke="url(#mo)" stroke-width="6.6"/><path d="M10 29L70 9" stroke="#c4c8a8" stroke-width="1" opacity=".6"/><path d="M72 10l14-4" stroke-width="5.5"/>
    <path d="M42 20h24l7 18H36z" fill="url(#mo)"/>`),
  balao: U(`<path d="M32 33l12 15M60 33l-12 15" fill="none" stroke-width="1"/><path d="M40 47h14l-2 8H42z" fill="url(#mw)"/>
    <path d="M14 15l-9-8M14 29l-9 8M12 22H1" stroke-width="5"/><path d="M14 15l-9-8M14 29l-9 8M12 22H1" stroke="#cfc19c" stroke-width="3"/>
    <path d="M12 22c0-10 15-15 36-15s36 5 40 15c-4 10-19 15-40 15S12 32 12 22z" fill="url(#mc)"/><path d="M22 15c9-4 20-5 31-5" stroke="#fffaf0" stroke-width="2.4" fill="none"/><path d="M30 8v28M48 7v30M66 8v28" stroke="#9c8f6d" stroke-width="1" fill="none"/>`),
  submarino: U(`<path d="M0 50h100" stroke="#6b97a3" stroke-width="1.6" opacity=".7"/>
    <path d="M2 42c10-7 30-9 50-9s38 2 46 9c-8 7-26 9-46 9S12 49 2 42z" fill="url(#mh)"/><path d="M8 40c12-5 28-6 44-6" stroke="#9aa4ab" stroke-width="1.6" fill="none"/>
    <path d="M40 34l3-12h15l3 12z" fill="url(#mg)"/><path d="M50 22V8h4" fill="none" stroke-width="2.4"/><path d="M28 34v-5h7" fill="none" stroke-width="2"/>`),
  cruzador: U(`<path d="M28 31V6M66 31V10" fill="none" stroke-width="1.8"/>
    <path d="M2 38h96l-9 13H11z" fill="url(#mg)"/><path d="M6 45h88" stroke="#8f3326" stroke-width="3.2"/><path d="M8 40h84" stroke="#d3d8db" stroke-width="1" opacity=".6"/>
    <path d="M16 31h60v7H16z" fill="url(#mg)"/><path d="M34 22h24v9H34z" fill="url(#mg)"/><path d="M38 22l2-12h5l-1 12M50 22l1-10h5l-1 10" fill="#3d3d3d"/>
    <path d="M76 33l15-3M16 33L3 31" stroke-width="3.2"/><path d="M40 8c4-4 2-6 6-8" stroke="#bbb" stroke-width="2" fill="none" opacity=".7"/>`),
  transporte: U(`<path d="M48 38V8M48 12l-11 13" fill="none" stroke-width="1.8"/>
    <path d="M3 38h94l-9 13H12z" fill="url(#mh)"/><path d="M7 45h86" stroke="#8f3326" stroke-width="3.2"/>
    <rect x="14" y="25" width="30" height="13" fill="url(#mc)"/><rect x="54" y="27" width="27" height="11" fill="url(#mw)"/><path d="M29 25V12h8v13" fill="#9c3424"/><path d="M29 15h8" stroke="#1d1d1d" stroke-width="2"/>
    <path d="M18 29h3v3h-3zM24 29h3v3h-3zM30 29h3v3h-3zM36 29h3v3h-3z" fill="#4a3a28" stroke="none"/>`),
};
