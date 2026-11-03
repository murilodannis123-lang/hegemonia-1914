// Bolsa de valores: ofertas de compra/venda entre nações + banco (sempre disponível, preço pior).
import { RES } from './defs.js';
import { rngNext } from './state.js';
import { nationIncome, nname } from './sim.js';

const TRADABLE = RES.filter(r => r !== 'dinheiro');
export const BASE_PRICE = { graos: 1.2, peixe: 1.2, ferro: 1.6, madeira: 1.2, carvao: 1.5, petroleo: 2.2, gas: 1.8 };
export const bankBuyPrice = (S, r) => +(S.market.price[r] * 1.3).toFixed(2);
export const bankSellPrice = (S, r) => +(S.market.price[r] * 0.7).toFixed(2);

function pushPrice(S, r, dir, amt) { const p = S.market.price; p[r] = Math.max(BASE_PRICE[r] * 0.4, Math.min(BASE_PRICE[r] * 3, p[r] * (1 + dir * Math.min(0.08, amt / 200000)))); }

export function bankTrade(S, nat, side, r, amt) {
  const n = S.nations[nat]; amt = Math.floor(amt); if (!TRADABLE.includes(r) || amt <= 0) return { ok: false, msg: 'Quantidade inválida.' };
  if (side === 'buy') { const cost = Math.ceil(amt * bankBuyPrice(S, r)); if (n.res.dinheiro < cost) return { ok: false, msg: 'Dinheiro insuficiente.' }; n.res.dinheiro -= cost; n.res[r] += amt; pushPrice(S, r, 1, amt); return { ok: true, msg: `Comprou ${amt.toLocaleString('pt-BR')} por ${cost.toLocaleString('pt-BR')}.` }; }
  if (n.res[r] < amt) return { ok: false, msg: 'Estoque insuficiente.' };
  const gain = Math.floor(amt * bankSellPrice(S, r)); n.res[r] -= amt; n.res.dinheiro += gain; pushPrice(S, r, -1, amt);
  return { ok: true, msg: `Vendeu ${amt.toLocaleString('pt-BR')} por ${gain.toLocaleString('pt-BR')}.` };
}
export function postOffer(S, nat, side, r, amt, price) {
  const n = S.nations[nat]; amt = Math.floor(amt); price = +(+price).toFixed(2);
  if (!TRADABLE.includes(r) || amt <= 0 || !(price > 0)) return { ok: false, msg: 'Oferta inválida.' };
  if (side === 'sell') { if (n.res[r] < amt) return { ok: false, msg: 'Estoque insuficiente.' }; n.res[r] -= amt; }
  else { const c = Math.ceil(amt * price); if (n.res.dinheiro < c) return { ok: false, msg: 'Dinheiro insuficiente.' }; n.res.dinheiro -= c; }
  S.market.offers.push({ id: S.market.nextOffer++, nat, side, res: r, amt, price, h: S.hour });
  return { ok: true, msg: 'Oferta publicada.' };
}
export function cancelOffer(S, nat, id) {
  const o = S.market.offers.find(x => x.id === id && x.nat === nat); if (!o) return { ok: false, msg: 'Oferta não encontrada.' };
  returnOffer(S, o); S.market.offers = S.market.offers.filter(x => x !== o); return { ok: true, msg: 'Oferta retirada.' };
}
function returnOffer(S, o) { const n = S.nations[o.nat]; if (!n) return; if (o.side === 'sell') n.res[o.res] += o.amt; else n.res.dinheiro += Math.ceil(o.amt * o.price); }
// aceitar oferta de outra nação
export function takeOffer(S, nat, id, amt) {
  const o = S.market.offers.find(x => x.id === id); if (!o || o.nat === nat) return { ok: false, msg: 'Oferta indisponível.' };
  const n = S.nations[nat], other = S.nations[o.nat]; amt = Math.min(Math.floor(amt), o.amt); if (amt <= 0) return { ok: false, msg: 'Quantidade inválida.' };
  const val = Math.ceil(amt * o.price);
  if (o.side === 'sell') { if (n.res.dinheiro < val) return { ok: false, msg: 'Dinheiro insuficiente.' }; n.res.dinheiro -= val; n.res[o.res] += amt; other.res.dinheiro += val; }
  else { if (n.res[o.res] < amt) return { ok: false, msg: 'Estoque insuficiente.' }; n.res[o.res] -= amt; n.res.dinheiro += val; other.res[o.res] += amt; }
  o.amt -= amt; if (o.amt <= 0) S.market.offers = S.market.offers.filter(x => x !== o);
  S.market.price[o.res] = S.market.price[o.res] * 0.8 + o.price * 0.2;
  S.market.hist.push({ h: S.hour, res: o.res, amt, price: o.price, a: nat, b: o.nat });
  if (S.market.hist.length > 200) S.market.hist.shift();
  return { ok: true, msg: `Negócio fechado com ${nname(o.nat)}: ${amt.toLocaleString('pt-BR')} a ${o.price.toFixed(2)}.` };
}

export function marketDaily(S, M) {
  const mk = S.market;
  // expira ofertas antigas
  mk.offers = mk.offers.filter(o => { if (S.hour - o.h > 96 && S.nations[o.nat].ai) { returnOffer(S, o); return false; } return true; });
  // IA publica ofertas conforme sobra/falta
  for (const n of Object.values(S.nations)) {
    if (!n.ai || !n.alive || n.rebel) continue;
    if (rngNext(S) < 0.4) continue;
    const inc = nationIncome(S, M, n.id);
    for (const r of TRADABLE) {
      const net = inc.prod[r] - inc.cons[r];
      const mine = mk.offers.filter(o => o.nat === n.id && o.res === r);
      if (mine.length) continue;
      if (n.res[r] > 12000 && net > -200) { const amt = Math.floor(Math.min(n.res[r] * 0.3, 15000) / 100) * 100; if (amt >= 500) postOffer(S, n.id, 'sell', r, amt, mk.price[r] * (0.92 + rngNext(S) * 0.25)); }
      else if (n.res[r] < 2500 && n.res.dinheiro > 20000) { const amt = Math.floor(Math.min(6000, n.res.dinheiro / mk.price[r] / 4) / 100) * 100; if (amt >= 500) postOffer(S, n.id, 'buy', r, amt, mk.price[r] * (0.85 + rngNext(S) * 0.25)); }
    }
  }
  // IA cruza ofertas entre si
  const sells = mk.offers.filter(o => o.side === 'sell'), buys = mk.offers.filter(o => o.side === 'buy');
  for (const b of buys) for (const s of sells) {
    if (b.res !== s.res || b.nat === s.nat || s.amt <= 0 || b.amt <= 0 || s.price > b.price) continue;
    if (!S.nations[b.nat].ai || !S.nations[s.nat].ai) continue;
    const amt = Math.min(b.amt, s.amt), price = (s.price + b.price) / 2;
    S.nations[b.nat].res[b.res] += amt; S.nations[s.nat].res.dinheiro += Math.floor(amt * price);
    S.nations[b.nat].res.dinheiro += Math.floor(amt * (b.price - price)); // troco
    b.amt -= amt; s.amt -= amt; mk.price[b.res] = mk.price[b.res] * 0.85 + price * 0.15;
  }
  mk.offers = mk.offers.filter(o => o.amt > 0);
  // IA compra ofertas do jogador se o preço for bom
  for (const o of mk.offers.filter(o => !S.nations[o.nat].ai)) {
    for (const n of Object.values(S.nations)) {
      if (!n.ai || !n.alive || n.rebel || o.amt <= 0) continue;
      if (o.side === 'sell' && o.price <= mk.price[o.res] * 1.08 && n.res[o.res] < 6000 && n.res.dinheiro > o.price * 1000 + 15000) { const amt = Math.min(o.amt, Math.floor((n.res.dinheiro - 15000) / o.price / 2)); if (amt > 0) { takeOffer(S, n.id, o.id, amt); } }
      else if (o.side === 'buy' && o.price >= mk.price[o.res] * 0.92 && n.res[o.res] > 9000) { const amt = Math.min(o.amt, Math.floor(n.res[o.res] - 6000)); if (amt > 0) takeOffer(S, n.id, o.id, amt); }
    }
  }
  // preços voltam lentamente à base
  for (const r of TRADABLE) mk.price[r] = mk.price[r] * 0.95 + BASE_PRICE[r] * 0.05;
}
