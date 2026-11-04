// Testes das mecânicas: embargo, mapa compartilhado, mudança de capital, espionagem, recrutamento automático, corrupção, moral no combate.
import fs from 'fs';
import { prepareMap } from '../../src/engine/world.js';
import { newGame } from '../../src/engine/state.js';
import { step, corruption, fightFactor, rel } from '../../src/engine/sim.js';
import * as C from '../../src/engine/commands.js';
import { postOffer, takeOffer } from '../../src/engine/market.js';
import { computeVision } from '../../src/engine/vision.js';

const M = prepareMap(JSON.parse(fs.readFileSync('assets/map.json')));
let fail = 0; const check = (name, ok, extra = '') => { console.log((ok ? 'OK    ' : 'FALHOU ') + name, extra); if (!ok) fail++; };

for (const scenario of ['historico', 'dividido']) {
  const S = newGame(M, { player: 'fra', scenario, seed: 3 }); const P = 'fra';
  console.log('— cenário', scenario);
  // embargo bloqueia a bolsa e presentes
  S.nations.ale.res.ferro = 50000; postOffer(S, 'ale', 'sell', 'ferro', 1000, 1.5);
  const off = S.market.offers.find(o => o.nat === 'ale');
  check('embargo decretado', C.setEmbargo(S, M, P, 'ale', true).ok);
  check('embargo bloqueia compra na bolsa', !takeOffer(S, P, off.id, 100).ok);
  check('embargo bloqueia presente', !C.gift(S, M, P, 'ale', 'dinheiro', 1000).ok);
  C.setEmbargo(S, M, P, 'ale', false);
  check('sem embargo a compra funciona', takeOffer(S, P, off.id, 100).ok);
  // mapa compartilhado: aceita com boa relação e passa a ver as províncias do outro
  S.nations.esp.opinion[P] = 40;
  const before = computeVision(S, M, P).nodes.size;
  const r = C.propose(S, M, P, 'esp', 'mapa');
  const after = computeVision(S, M, P).nodes.size;
  check('mapa compartilhado amplia a visão', r.accept && after > before, `${before} → ${after}`);
  // mudança de capital leva 12 h
  const city = M.provinces.find(p => S.provinces[p.id].owner === P && p.city && S.nations[P].capital !== p.id);
  const mc = C.moveCapital(S, M, P, city.id);
  for (let i = 0; i < 11; i++) step(S, M);
  const mid = S.nations[P].capital !== city.id;
  for (let i = 0; i < 2; i++) step(S, M);
  check('capital muda depois de 12 h', mc.ok && mid && S.nations[P].capital === city.id);
  // espionagem nova
  S.nations[P].res.dinheiro = 1e6;
  check('contraespionagem ativa', C.spy(S, M, P, null, 'contra').ok && S.nations[P].counterUntil > S.hour);
  check('sabotagem militar executa', C.spy(S, M, P, 'ale', 'militar').ok);
  check('sabotagem econômica executa', C.spy(S, M, P, 'ale', 'economica').ok);
  // recrutamento automático: em 3 dias aparece infantaria nova
  const inf = () => S.stacks.filter(s => s.nat === P).reduce((a, s) => a + (s.units.infantaria?.n || 0), 0);
  const i0 = inf(); for (let i = 0; i < 72; i++) step(S, M);
  check('escritórios alistam infantaria sozinhos', inf() > i0, `${i0} → ${inf()}`);
  // corrupção só pesa em império grande
  const big = Object.values(S.nations).reduce((a, b) => (b.nProv || 0) > (a.nProv || 0) ? b : a);
  check('corrupção cresce com o tamanho', corruption(S, big.id) >= corruption(S, P) && corruption(S, big.id) <= 0.25, `${big.id}:${big.nProv} → ${Math.round(corruption(S, big.id) * 100)}%`);
  // moral e falta de recursos reduzem a força
  const st = S.stacks.find(s => s.nat === P && s.node === S.nations[P].capital);
  const f1 = fightFactor(S, M, st); S.provinces[st.node].morale = 30; S.nations[P].lastFulfil.comida = 0;
  const f2 = fightFactor(S, M, st);
  check('moral baixa e fome enfraquecem as tropas', f2 < f1 && f2 >= 0.55 * 0.7 - 1e-9, `${f1.toFixed(2)} → ${f2.toFixed(2)}`);
  check('relações continuam válidas', rel(S, P, 'ale') !== undefined);
}
if (fail) { console.log(fail + ' falha(s)'); process.exit(1); } else console.log('ERROS: nenhum');
