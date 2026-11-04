// Ícones e silhuetas desenhados à mão (SVG próprio).
const svg = (vb, body, cls = '') => `<svg class="ic ${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

export const RES_ICON = {
  dinheiro: svg('0 0 24 24', `<ellipse cx="12" cy="17" rx="8" ry="3" fill="#8f7a45"/><rect x="4" y="12" width="16" height="5" fill="#b89b55"/><ellipse cx="12" cy="12" rx="8" ry="3" fill="#e2c675"/><ellipse cx="12" cy="12" rx="5" ry="1.7" fill="none" stroke="#a88a40" stroke-width="1"/><rect x="6" y="7" width="12" height="5" fill="#c9ad62"/><ellipse cx="12" cy="7" rx="6" ry="2.3" fill="#f0d78a"/>`),
  graos: svg('0 0 24 24', `<path d="M12 22V6" stroke="#c9a03c" stroke-width="1.6"/><g fill="#e8c35a"><ellipse cx="9.3" cy="9" rx="1.8" ry="3" transform="rotate(-30 9.3 9)"/><ellipse cx="14.7" cy="9" rx="1.8" ry="3" transform="rotate(30 14.7 9)"/><ellipse cx="9.3" cy="13.5" rx="1.8" ry="3" transform="rotate(-30 9.3 13.5)"/><ellipse cx="14.7" cy="13.5" rx="1.8" ry="3" transform="rotate(30 14.7 13.5)"/><ellipse cx="12" cy="4.5" rx="1.7" ry="3"/></g>`),
  peixe: svg('0 0 24 24', `<path d="M3 12c4-6 11-6 15 0-4 6-11 6-15 0z" fill="#9fb8c4"/><path d="M17 12l5-4v8z" fill="#7f9aa8"/><circle cx="7.5" cy="11" r="1.1" fill="#1d2a30"/><path d="M10 9c1 2 1 4 0 6" stroke="#6c8794" fill="none"/>`),
  ferro: svg('0 0 24 24', `<path d="M4 16l3-6h10l3 6z" fill="#8a8f96"/><path d="M7 10l2-3h6l2 3z" fill="#b5bac0"/><path d="M4 16h16v3H4z" fill="#5d6268"/>`),
  madeira: svg('0 0 24 24', `<rect x="3" y="7" width="15" height="5" rx="2.5" fill="#9a6a3c"/><rect x="6" y="13" width="15" height="5" rx="2.5" fill="#86592f"/><circle cx="18" cy="9.5" r="2.4" fill="#d9b07a"/><circle cx="18" cy="9.5" r="1" fill="none" stroke="#9a6a3c"/><circle cx="21" cy="15.5" r="2.4" fill="#c99d66"/>`),
  carvao: svg('0 0 24 24', `<path d="M3 18l3-7 5-2 3 3 5-1 2 7z" fill="#7a7a7a"/><path d="M6 11l5-2 1 4-4 2z" fill="#a0a0a0"/><path d="M14 12l5-1 1 4-5 1z" fill="#8c8c8c"/>`),
  petroleo: svg('0 0 24 24', `<rect x="6" y="4" width="12" height="17" rx="2" fill="#6b3b2a"/><rect x="6" y="8" width="12" height="1.5" fill="#3f2218"/><rect x="6" y="15" width="12" height="1.5" fill="#3f2218"/><path d="M12 10.5c1.5 2 1.5 3 0 3.5-1.5-.5-1.5-1.5 0-3.5z" fill="#d8c27a"/>`),
  gas: svg('0 0 24 24', `<rect x="7" y="6" width="10" height="15" rx="4" fill="#c8483c"/><rect x="10" y="3" width="4" height="4" fill="#8f2f27"/><rect x="9" y="11" width="6" height="4" rx="1" fill="#f1e5c8"/>`),
};

// ícones de recursos pintados (PNG); o SVG acima fica de reserva se a imagem falhar
for (const r of Object.keys(RES_ICON)) RES_ICON[r] = `<img class="ic res" src="assets/res/${r}.png" alt="" draggable="false">`;

// silhuetas das unidades (viewBox 100x60, cor = currentColor)
const U = (body) => svg('0 0 100 60', `<g fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</g>`, 'unit');
const wheel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="0"/><circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="#000" fill-opacity=".35" stroke-width="0"/>`;
const soldier = (extra = '', mask = false) => `
  <path d="M40 12.5c.8-5.5 5-8.5 10.5-8.5s9.6 3 10.4 8.5z" stroke-width="1"/><path d="M37 12.6h27.5" stroke-width="2.6" fill="none"/>
  <circle cx="51.5" cy="16.6" r="4.3" stroke-width="0"/>${mask ? '<circle cx="56.5" cy="18.5" r="2.6" stroke-width="0"/><path d="M57 21l-3 5" stroke-width="1.6" fill="none"/>' : ''}
  <path d="M45.5 21.5h12l3.2 15.5-2.4 8.2H43.6l-1.6-8.4z" stroke-width="1"/>
  <rect x="37.5" y="22" width="8.5" height="13" rx="2.2" stroke-width="0"/>
  <path d="M47.5 44l-5.5 7.5-4 5" stroke-width="5.4" fill="none"/><path d="M56 44l4.6 6.8 6 4.8" stroke-width="5.4" fill="none"/>
  <path d="M33.5 57.5h7.2" stroke-width="3.6" fill="none"/><path d="M64.5 56.2l7 1.2" stroke-width="3.6" fill="none"/>${extra}`;
export const UNIT_ICON = {
  infantaria: U(soldier(`<path d="M29 44L79 15" stroke-width="2.8" fill="none"/><path d="M79 15l8.5-5" stroke-width="1.3" fill="none"/>
    <path d="M55 24.5l6 7.5 7.5-6" stroke-width="4.6" fill="none"/><path d="M47.5 25l-.8 9.5 9.8 1.5" stroke-width="4.6" fill="none"/>`)),
  choque: U(soldier(`<path d="M55 24l9-9 5-7" stroke-width="4.6" fill="none"/><path d="M68 9l3.5-6" stroke-width="2" fill="none"/><ellipse cx="72.5" cy="3.8" rx="2.6" ry="3.6" stroke-width="0"/>
    <path d="M47.5 25l-1 10 8 4" stroke-width="4.6" fill="none"/><path d="M40 38l-8 6" stroke-width="2.2" fill="none"/>`, true)),
  cavalaria: U(`<path d="M24 31c2-7 10-10 22-10h18l7-8 5-4 6 2 4 6-3 2-6-2-4 6 1 9c0 4-3 6-7 6l-24 1c-6 0-10-1-14-3z" stroke-width="1"/>
    <path d="M69 13l1-6" stroke-width="2.4" fill="none"/>
    <path d="M30 40l-6 9-2 8" stroke-width="3.8" fill="none"/><path d="M38 41l3 8-3 8" stroke-width="3.8" fill="none"/><path d="M60 40l6 7 7 4" stroke-width="3.8" fill="none"/><path d="M66 39l2 9-2 8" stroke-width="3.8" fill="none"/>
    <path d="M24 31c-6-2-10 2-13 9" stroke-width="3" fill="none"/>
    <path d="M47 21l-2-9 8-1 2 9" stroke-width="1"/><circle cx="50" cy="7.6" r="3.6" stroke-width="0"/><path d="M45.5 5h9" stroke-width="2" fill="none"/>
    <path d="M54 13l12-9 6-3" stroke-width="2.2" fill="none"/><path d="M47 22l1 9" stroke-width="3.6" fill="none"/>`),
  blindado: U(`<path d="M8 40V31l10-3h8l6-6h34l5 6h14l7 5v7z" stroke-width="1"/><rect x="38" y="13" width="18" height="9" rx="2" stroke-width="0"/><path d="M56 16.5h18" stroke-width="2.6" fill="none"/>
    <path d="M14 40h80" stroke-width="2" fill="none"/>${wheel(24, 45, 9)}${wheel(76, 45, 9)}<path d="M28 33h4M36 33h4M44 33h4" stroke="#000" stroke-opacity=".3" stroke-width="2" fill="none"/>`),
  artleve: U(`<path d="M18 23L84 9" stroke-width="3.6" fill="none"/><path d="M84 9l6-1.2" stroke-width="2.2" fill="none"/><path d="M40 13v22l14-2V11z" stroke-width="1"/>
    ${wheel(47, 41, 13)}<path d="M54 40l34 15" stroke-width="5" fill="none"/><path d="M86 56h8" stroke-width="3" fill="none"/>`),
  antiaereo: U(`<path d="M10 42h66l8-6h8v10H10z" stroke-width="1"/><path d="M20 42v-8h22l4 8" stroke-width="1"/><path d="M34 34L66 4" stroke-width="4" fill="none"/><path d="M66 4l4-3.5" stroke-width="2.2" fill="none"/>
    <rect x="26" y="26" width="14" height="9" rx="1.5" stroke-width="0"/>${wheel(22, 50, 7)}${wheel(48, 50, 7)}${wheel(78, 50, 7)}`),
  artilharia: U(`<path d="M22 31L74 6" stroke-width="7.5" fill="none"/><path d="M74 6l6-3" stroke-width="5" fill="none"/><path d="M34 22l16-8 6 10-16 8z" stroke-width="1"/>
    ${wheel(46, 40, 15)}<path d="M52 42l38 13" stroke-width="6" fill="none"/><path d="M88 56h9" stroke-width="3.5" fill="none"/><path d="M28 30l-8 2" stroke-width="5" fill="none"/>`),
  tanqueleve: U(`<path d="M10 40c0-6 4-10 10-10h52c8 0 14 4 14 10s-5 11-12 11H20c-6 0-10-5-10-11z" stroke-width="1"/>
    <path d="M26 30l5-10h26l6 10z" stroke-width="1"/><path d="M34 20l2-9h16l2 9z" stroke-width="1"/><path d="M52 15h18" stroke-width="3" fill="none"/>
    <path d="M86 42l10 6" stroke-width="3" fill="none"/><g fill="#000" fill-opacity=".35" stroke-width="0"><circle cx="21" cy="41" r="4"/><circle cx="32" cy="43" r="3.4"/><circle cx="42" cy="43" r="3.4"/><circle cx="52" cy="43" r="3.4"/><circle cx="62" cy="43" r="3.4"/><circle cx="74" cy="41" r="4"/></g>`),
  tanquepesado: U(`<path d="M4 34L18 10h64l14 24-10 18H14z" stroke-width="1"/><path d="M14 18h72" stroke="#000" stroke-opacity=".3" stroke-width="2" fill="none"/>
    <rect x="34" y="26" width="22" height="14" rx="2" stroke-width="0" fill="#000" fill-opacity=".28"/><path d="M40 32H22" stroke-width="3.2" fill="none"/><rect x="38" y="4" width="16" height="7" rx="1.5" stroke-width="0"/>
    <g fill="#000" fill-opacity=".3" stroke-width="0"><circle cx="24" cy="45" r="3"/><circle cx="34" cy="46" r="3"/><circle cx="44" cy="46" r="3"/><circle cx="54" cy="46" r="3"/><circle cx="64" cy="46" r="3"/><circle cx="74" cy="45" r="3"/></g>`),
  ferroviario: U(`<path d="M6 30L70 10" stroke-width="6" fill="none"/><path d="M70 10l14-4" stroke-width="4" fill="none"/><path d="M44 18h22l6 16H38z" stroke-width="1"/>
    <rect x="10" y="34" width="82" height="9" rx="2" stroke-width="0"/>${wheel(18, 47, 5)}${wheel(30, 47, 5)}${wheel(72, 47, 5)}${wheel(84, 47, 5)}<path d="M2 54h96" stroke-width="2.4" fill="none"/>
    <path d="M8 57h4M24 57h4M40 57h4M56 57h4M72 57h4M88 57h4" stroke-width="2" fill="none"/>`),
  balao: U(`<path d="M12 18c0-8 14-12 34-12s34 4 38 12c-4 8-18 12-38 12S12 26 12 18z" stroke-width="1"/><path d="M14 12l-8-6M14 24l-8 6M12 18H2" stroke-width="3" fill="none"/>
    <path d="M30 29l12 14M58 29l-12 14" stroke-width="1" fill="none"/><path d="M40 43h12l-2 7h-8z" stroke-width="1"/><path d="M46 50v10" stroke-width="1" fill="none"/>`),
  caca: U(`<path d="M24 26l50-3c6 0 10 2 12 5-2 3-6 5-12 5l-50-2-14 4V22z" stroke-width="1"/><path d="M10 22l-4-6h8l6 7" stroke-width="1"/>
    <path d="M30 13h44" stroke-width="3.4" fill="none"/><path d="M28 36h48" stroke-width="3.4" fill="none"/><path d="M38 14l-2 22M64 14l2 22" stroke-width="1.6" fill="none"/>
    <path d="M88 18v20" stroke-width="2.4" fill="none"/><path d="M58 23l-2-6h-6" stroke-width="1.8" fill="none"/>
    <path d="M54 34l-4 12M62 34l4 12" stroke-width="1.6" fill="none"/>${wheel(50, 48, 4)}${wheel(66, 48, 4)}`),
  bombardeiro: U(`<path d="M20 27l56-3c7 0 11 2 13 5-2 3-6 5-13 5l-56-2-14 4V23z" stroke-width="1"/><path d="M6 23l-4-7h9l7 8" stroke-width="1"/>
    <path d="M14 11h76" stroke-width="3.6" fill="none"/><path d="M12 39h80" stroke-width="3.6" fill="none"/><path d="M26 12l-2 26M48 12v26M70 12l2 26" stroke-width="1.6" fill="none"/>
    <rect x="40" y="18" width="12" height="7" rx="2" stroke-width="0"/><rect x="62" y="18" width="12" height="7" rx="2" stroke-width="0"/><path d="M53 15v14M75 15v14" stroke-width="2" fill="none"/>
    <path d="M44 38l-3 10M62 38l3 10" stroke-width="1.6" fill="none"/>${wheel(40, 50, 4)}${wheel(66, 50, 4)}`),
  zepelim: U(`<path d="M6 26C6 16 30 10 52 10s44 6 44 16-22 16-44 16S6 36 6 26z" stroke-width="1"/><path d="M14 18l-10-10h12l8 8M14 34l-10 10h12l8-8" stroke-width="1"/>
    <g stroke="#000" stroke-opacity=".25" stroke-width="1.4" fill="none"><path d="M26 13v26M40 11v30M54 10v32M68 11v30M82 14v24"/></g>
    <path d="M38 41h16l-2 6H40z" stroke-width="1"/><path d="M66 40h8l-1 4h-6z" stroke-width="1"/>`),
  submarino: U(`<path d="M2 38c10-6 30-8 50-8s38 2 46 8c-8 6-26 8-46 8S12 44 2 38z" stroke-width="1"/><path d="M40 31l3-10h14l3 10z" stroke-width="1"/>
    <path d="M50 21V8M50 8h4" stroke-width="2" fill="none"/><path d="M28 31v-4h6" stroke-width="2" fill="none"/><path d="M0 46h100" stroke-width="1.2" stroke-opacity=".5" fill="none"/>`),
  cruzador: U(`<path d="M2 36h96l-8 12H10z" stroke-width="1"/><path d="M16 30h60v6H16z" stroke-width="1"/><path d="M34 22h24v8H34z" stroke-width="1"/>
    <path d="M38 22l2-12h5l-1 12M50 22l1-10h5l-1 10" stroke-width="1"/><path d="M28 30V6M66 30V10" stroke-width="1.6" fill="none"/>
    <path d="M76 32l14-3M16 32L4 30" stroke-width="2.4" fill="none"/>`),
  couracado: U(`<path d="M1 36h98l-9 13H9z" stroke-width="1"/><path d="M12 29h70v7H12z" stroke-width="1"/><path d="M30 20h32v9H30z" stroke-width="1"/><path d="M38 20V12h14v8" stroke-width="1"/>
    <path d="M34 20l2-12h5l-1 12M48 12l1-8h5l-1 8" stroke-width="1"/><path d="M24 29V2M70 29V6" stroke-width="1.6" fill="none"/>
    <rect x="76" y="27" width="10" height="5" rx="1" stroke-width="0"/><path d="M84 29l14-3M84 31l14-2" stroke-width="2" fill="none"/><rect x="8" y="27" width="10" height="5" rx="1" stroke-width="0"/><path d="M10 29L-2 26" stroke-width="2" fill="none"/>`),
  transporte: U(`<path d="M4 36h92l-8 12H12z" stroke-width="1"/><rect x="14" y="24" width="30" height="12" stroke-width="0"/><rect x="54" y="26" width="26" height="10" stroke-width="0"/>
    <path d="M30 24V12h7v12" stroke-width="1"/><path d="M48 36V8M48 12l-10 12" stroke-width="1.6" fill="none"/>`),
};

const S = (b) => svg('0 0 24 24', b, 'side');
export const UI_ICON = {
  jornal: S(`<path d="M4 4h13v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M17 8h3v11a2 2 0 0 1-4 0" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 8h7M7 11h7M7 14h5" stroke="currentColor" stroke-width="1.5"/>`),
  diplomacia: S(`<path d="M3 13c3-1 5-4 9-4 2 0 3 2 2 3l-3 2M21 12l-4 3-5 4c-1 1-3 0-3-1l-1-1-2 1-3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 10l3-1 4 3" fill="none" stroke="currentColor" stroke-width="1.6"/>`),
  recursos: S(`<path d="M12 21V8" stroke="currentColor" stroke-width="1.6"/><g fill="currentColor"><ellipse cx="9.5" cy="10" rx="1.6" ry="2.8" transform="rotate(-30 9.5 10)"/><ellipse cx="14.5" cy="10" rx="1.6" ry="2.8" transform="rotate(30 14.5 10)"/><ellipse cx="9.5" cy="14.5" rx="1.6" ry="2.8" transform="rotate(-30 9.5 14.5)"/><ellipse cx="14.5" cy="14.5" rx="1.6" ry="2.8" transform="rotate(30 14.5 14.5)"/><ellipse cx="12" cy="5.5" rx="1.5" ry="2.8"/></g>`),
  bolsa: S(`<path d="M12 4v16M6 20h12M4 8h16" stroke="currentColor" stroke-width="1.6"/><path d="M4 8l-2.5 6h5zM20 8l-2.5 6h5z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 14a2.5 2 0 0 0 5 0M17.5 14a2.5 2 0 0 0 5 0" fill="currentColor"/>`),
  coligacoes: S(`<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="1.7"/>`),
  espionagem: S(`<path d="M3 11h18M6 11l2-6h8l2 6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 16h2" stroke="currentColor" stroke-width="1.6"/>`),
  provincias: S(`<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>`),
  exercitos: S(`<path d="M4 14c0-5 3.5-8 8-8s8 3 8 8z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 14h20l-2 3H4z" fill="currentColor"/><path d="M12 6v-2" stroke="currentColor" stroke-width="1.6"/>`),
  config: S(`<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.6"/>`),
  alerta: S(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v6" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="16.5" r="1.2" fill="currentColor"/>`),
  mapa: S(`<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`),
  martelo: S(`<path d="M4 20l9-9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M11 5l4-2 6 6-2 4-3-3-2 2-4-4 2-2z" fill="currentColor"/>`),
  capacete: S(`<path d="M3 15c0-6 4-9 9-9s9 3 9 9z" fill="currentColor"/><path d="M1 15h22v2.2H1z" fill="currentColor"/>`),
  ampulheta: S(`<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" fill="none" stroke="currentColor" stroke-width="1.6"/>`),
  info: S(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/>`),
  fechar: S(`<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2"/>`),
  setaE: S(`<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2"/>`),
  setaD: S(`<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/>`),
  pausa: S(`<rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/>`),
  play: S(`<path d="M7 5l12 7-12 7z" fill="currentColor"/>`),
  rapido: S(`<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z" fill="currentColor"/>`),
  turbo: S(`<path d="M1 6l7 6-7 6zM8 6l7 6-7 6zM15 6l7 6-7 6z" fill="currentColor"/>`),
  espadas: S(`<path d="M4 4l11 11M20 4L9 15" stroke="currentColor" stroke-width="2"/><path d="M13 17l4-4 2 2-4 4zM11 17l-4-4-2 2 4 4z" fill="currentColor"/>`),
  mover: S(`<path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/>`),
  parar: S(`<rect x="6" y="6" width="12" height="12" fill="currentColor"/>`),
  dividir: S(`<path d="M12 3v7M12 10l-6 6v5M12 10l6 6v5" fill="none" stroke="currentColor" stroke-width="2"/>`),
  juntar: S(`<path d="M6 3v5l6 6v7M18 3v5l-6 6" fill="none" stroke="currentColor" stroke-width="2"/>`),
  alvo: S(`<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="1.6"/>`),
  patrulha: S(`<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M12 8l3 6h-6z" fill="currentColor"/>`),
  base: S(`<path d="M3 20V10l9-5 9 5v10z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.6"/>`),
  estrela: S(`<path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z" fill="currentColor"/>`),
  moral: S(`<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z" fill="currentColor"/>`),
  escudo: S(`<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" fill="currentColor"/>`),
  raio: S(`<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>`),
  vida: S(`<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 15s-4-2.4-4-5a2.2 2.2 0 0 1 4-1.3A2.2 2.2 0 0 1 16 10c0 2.6-4 5-4 5z" fill="currentColor"/>`),
  velocidade: S(`<path d="M3 12h9M5 8h8M5 16h8" stroke="currentColor" stroke-width="1.6"/><path d="M13 5l8 7-8 7z" fill="currentColor"/>`),
  olho: S(`<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/>`),
  mira: S(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="1.2"/>`),
  salvar: S(`<path d="M5 3h11l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v6h8V3M8 21v-7h8v7" fill="none" stroke="currentColor" stroke-width="1.6"/>`),
  som: S(`<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8c2 2 2 6 0 8M18.5 5.5c3.5 3.5 3.5 9.5 0 13" fill="none" stroke="currentColor" stroke-width="1.6"/>`),
  semsom: S(`<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="1.8"/>`),
  menu: S(`<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2"/>`),
  check: S(`<path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4"/>`),
  mais: S(`<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4"/>`),
};

export const BUILD_ICON = {
  recrutamento: S(`<path d="M4 21V9h16v12z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9V3h1v6M9 3l6 2-6 2" fill="currentColor" stroke="currentColor" stroke-width="1"/><path d="M8 21v-5h3v5M14 13h3v3h-3z" fill="currentColor"/>`),
  quartel: S(`<path d="M2 21V11l10-5 10 5v10z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 14h3v3H6zM10.5 14h3v3h-3zM15 14h3v3h-3z" fill="currentColor"/>`),
  oficina: S(`<path d="M2 21V12l5-3v3l5-3v3l5-3v3l5-3v12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="16.5" r="2.5" fill="currentColor"/>`),
  fabrica: S(`<path d="M2 21V12l6 3v-3l6 3V5h3v-2h2v2h1v16z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 17h2v2H5zM10 17h2v2h-2zM15 17h2v2h-2z" fill="currentColor"/>`),
  ferrovia: S(`<path d="M7 3l-4 18M17 3l4 18" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 7h13M4.8 11h14.4M4 15h16M3.2 19h17.6" stroke="currentColor" stroke-width="1.4"/>`),
  porto: S(`<path d="M12 3v15M8 7h8" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 13c0 5 4 7 8 7s8-2 8-7" fill="none" stroke="currentColor" stroke-width="1.8"/>`),
  aerodromo: S(`<path d="M2 21c0-6 4-10 10-10s10 4 10 10z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 6h14M11 4h2v5h-2z" fill="currentColor" stroke="currentColor" stroke-width="1.2"/>`),
  forte: S(`<path d="M3 21V8h3v2h3V8h6v2h3V8h3v13z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 21v-5h4v5" fill="currentColor"/>`),
};
