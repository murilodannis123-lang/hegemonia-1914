import { NATIONS } from '../data/nations.js';
import { RES } from './defs.js';

export const DIFFICULTY = {
  facil: { name: 'Fácil', aiProd: 0.75, aiAggro: 0.6, aiSmart: 0.6 },
  normal: { name: 'Normal', aiProd: 1.0, aiAggro: 1.0, aiSmart: 0.85 },
  dificil: { name: 'Difícil', aiProd: 1.3, aiAggro: 1.3, aiSmart: 1.0 },
};
export const START_RES = {
  normal: { dinheiro: 25000, outros: 6000 },
  abundante: { dinheiro: 120000, outros: 30000 },
  infinito: { dinheiro: 9e8, outros: 9e8 },
};
const PERSONALITIES = ['agressivo', 'equilibrado', 'defensivo', 'oportunista'];

export function rngNext(S) {
  let t = (S.rng = (S.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function newGame(M, opts) {
  const o = Object.assign({ player: 'fra', difficulty: 'normal', prodSpeed: 1, resources: 'normal', fog: true, unlockAll: false, victory: 0.6, seed: (Math.random() * 1e9) | 0, spectate: false }, opts);
  const S = {
    v: 1, rng: o.seed >>> 0, hour: 0, opts: o, nations: {}, provinces: [], stacks: [], nextStack: 1, rel: {},
    market: { price: { graos: 1.2, peixe: 1.2, ferro: 1.6, madeira: 1.2, carvao: 1.5, petroleo: 2.2, gas: 1.8 }, offers: [], nextOffer: 1, hist: [] },
    coalitions: {}, nextCoal: 1, news: [], events: [], proposals: [], battles: {}, winner: null, flash: [],
  };
  const sr = START_RES[o.resources] || START_RES.normal;
  for (const n of NATIONS) {
    const res = {}; RES.forEach(r => res[r] = r === 'dinheiro' ? sr.dinheiro : sr.outros);
    const isPlayer = n.id === o.player && !o.spectate;
    S.nations[n.id] = {
      id: n.id, alive: true, ai: !isPlayer, res, capital: -1, coalition: null, opinion: {},
      personality: PERSONALITIES[(rngNext(S) * PERSONALITIES.length) | 0], spies: [], kills: 0, losses: 0,
      aiS: { nextThink: (rngNext(S) * 6) | 0, warDay: 2 + ((rngNext(S) * 5) | 0), targets: {} },
      trade: { bought: 0, sold: 0 }, lastFulfil: { comida: 1, materiais: 1, energia: 1 },
    };
  }
  S.nations.reb = { id: 'reb', alive: true, ai: false, rebel: true, res: Object.fromEntries(RES.map(r => [r, 0])), capital: -1, coalition: null, opinion: {}, spies: [], kills: 0, losses: 0, aiS: {}, trade: {}, lastFulfil: {} };
  for (const p of M.provinces) {
    S.provinces.push({ owner: p.owner, core: p.owner, morale: p.capital ? 95 : 80, b: {}, build: null, queue: [], bdmg: 0, lastCapture: -999 });
    if (p.capital) S.nations[p.owner].capital = p.id;
  }
  // edifícios iniciais e guarnições
  for (const p of M.provinces) {
    const sp = S.provinces[p.id];
    if (p.capital) { sp.b.recrutamento = 1; sp.b.quartel = 1; sp.b.forte = 1; }
    else if (p.city) sp.b.recrutamento = 1;
    const n = p.capital ? 6 : p.city ? 3 : 2;
    addStack(S, M, p.owner, p.id, { infantaria: n });
  }
  // algumas províncias com cavalaria/artilharia leve na capital
  for (const n of NATIONS) { const c = S.nations[n.id].capital; if (c >= 0) addUnitsAt(S, M, n.id, c, { cavalaria: 2 }); }
  news(S, `Começa a Grande Guerra! ${NATIONS.length} nações disputam a hegemonia da Europa.`, 'geral');
  return S;
}

export function addStack(S, M, nat, node, units) {
  const st = { id: S.nextStack++, nat, units: {}, node, path: [], prog: 0, stance: 'agressivo', mission: null };
  for (const [u, n] of Object.entries(units)) if (n > 0) st.units[u] = { n, hp: n * UNITS_HP(u) };
  const nd = M.nodes[node]; st.x = nd.x; st.y = nd.y;
  S.stacks.push(st);
  return st;
}
import { UNITS } from './defs.js';
const UNITS_HP = u => UNITS[u].hp;

export function addUnitsAt(S, M, nat, node, units) {
  const dom = UNITS[Object.keys(units)[0]].dom;
  const existing = S.stacks.find(s => s.nat === nat && s.node === node && !s.path.length && s.prog === 0 && !s.mission && stackDomain(s) === dom && (dom !== 'air' || s.base === node));
  if (existing) {
    for (const [u, n] of Object.entries(units)) { const e = existing.units[u] || (existing.units[u] = { n: 0, hp: 0 }); e.n += n; e.hp += n * UNITS[u].hp; }
    return existing;
  }
  const st = addStack(S, M, nat, node, units);
  if (dom === 'air') st.base = node;
  return st;
}

export function stackDomain(st) { const k = Object.keys(st.units)[0]; return k ? UNITS[k].dom : 'land'; }

export function news(S, text, type = 'geral', extra = {}) { S.news.push({ h: S.hour, text, type, ...extra }); if (S.news.length > 400) S.news.splice(0, S.news.length - 400); }
export function event(S, nat, text, type = 'info', node = null) {
  if (nat !== S.opts.player) return;
  S.events.push({ h: S.hour, text, type, node, id: S.hour * 1000 + S.events.length });
  if (S.events.length > 300) S.events.splice(0, S.events.length - 300);
}
