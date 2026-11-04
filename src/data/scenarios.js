// Cenários do mapa: a geometria é a mesma, só muda quem é dono de cada província.
// "historico" junta as nações como eram em 1914; "dividido" é o mapa original com 31 nações.
// Para voltar ao mapa de 31 nações como padrão, troque DEFAULT_SCENARIO para 'dividido'.
import { NATIONS } from './nations.js';

export const SCENARIOS = {
  historico: {
    name: '1914 histórico',
    merge: { rss: 'rus', vol: 'rus', ucr: 'rus', liv: 'rus', fin: 'rus', pol: 'rus', cau: 'rus', ana: 'tur', sir: 'tur', mes: 'tur', hun: 'aus' },
    rename: { aus: { name: 'Áustria-Hungria', adj: 'austro-húngaro' } },
  },
  dividido: { name: '31 nações', merge: {}, rename: {} },
};
export const DEFAULT_SCENARIO = 'historico';
// partidas salvas antes dos cenários existirem eram todas no mapa de 31 nações
export const LEGACY_SCENARIO = 'dividido';

const ALL = NATIONS.slice();
const ORIG = Object.fromEntries(ALL.map(n => [n.id, { name: n.name, adj: n.adj }]));
export let currentScenario = null;

// Aplica o cenário: NATIONS passa a listar só as nações do cenário (mesmo array, alterado no lugar)
// e as províncias recebem dono, capital e pontos de vitória do cenário.
export function setScenario(M, id) {
  const sc = SCENARIOS[id] || SCENARIOS[LEGACY_SCENARIO];
  NATIONS.length = 0; for (const n of ALL) if (!sc.merge[n.id]) NATIONS.push(n);
  for (const n of ALL) Object.assign(n, ORIG[n.id], sc.rename[n.id] || {});
  for (const p of M.provinces) {
    if (p._o === undefined) { p._o = p.owner; p._c = !!p.capital; }
    p.owner = sc.merge[p._o] || p._o; p.capital = p._c && !sc.merge[p._o];
    p.vp = p.capital ? 5 : p.city ? 2 : 1;
  }
  M.totalVP = M.provinces.reduce((s, p) => s + p.vp, 0);
  currentScenario = SCENARIOS[id] ? id : LEGACY_SCENARIO;
}
