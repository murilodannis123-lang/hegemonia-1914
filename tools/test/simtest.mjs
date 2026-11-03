// Partida inteira IA x IA, sem interface. Uso: node tools/test/simtest.mjs [dias] [seed] [opções json]
import fs from 'fs';
import { prepareMap } from '../../src/engine/world.js';
import { newGame } from '../../src/engine/state.js';
import { step, scores, nname, nationIncome } from '../../src/engine/sim.js';
import { RES } from '../../src/engine/defs.js';
const days = +(process.argv[2] || 30), seed = +(process.argv[3] || 7);
const extra = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const M = prepareMap(JSON.parse(fs.readFileSync('assets/map.json')));
const S = newGame(M, { player: 'fra', spectate: true, seed, ...extra });
const t0 = Date.now(); let errs = 0;
const origErr = console.error; console.error = (...a) => { errs++; if (errs < 5) origErr(...a); };
for (let h = 0; h < days * 24 && !S.winner; h++) {
  step(S, M);
  if (h % 24 === 23) {
    // checagens de sanidade
    for (const n of Object.values(S.nations)) for (const r of RES) if (!Number.isFinite(n.res[r])) throw new Error(`NaN em ${n.id}.${r} no dia ${h / 24 | 0}`);
    for (const st of S.stacks) { for (const [u, e] of Object.entries(st.units)) if (!(e.n > 0) || !Number.isFinite(e.hp)) throw new Error('unidade inválida ' + JSON.stringify(st)); if (!Number.isFinite(st.x)) throw new Error('posição inválida ' + st.id); }
    if (process.env.V) { const sc = scores(S, M); console.log('dia', (h + 1) / 24, 'pilhas', S.stacks.length, 'guerras', Object.values(S.rel).filter(r => r === 'guerra').length, 'top', Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ':' + v).join(' ')); }
  }
}
const ms = Date.now() - t0;
const sc = scores(S, M);
const units = {}; for (const st of S.stacks) for (const [u, e] of Object.entries(st.units)) units[u] = (units[u] || 0) + e.n;
const builds = {}; S.provinces.forEach(p => { for (const [b, l] of Object.entries(p.b)) builds[b] = (builds[b] || 0) + 1; });
console.log(JSON.stringify({ dias: S.hour / 24, ms, msPorHora: +(ms / S.hour).toFixed(2), erros: errs, vencedor: S.winner, vivos: Object.values(S.nations).filter(n => n.alive && !n.rebel).length,
  guerras: Object.values(S.rel).filter(r => r === 'guerra').length, coligacoes: Object.values(S.coalitions).map(c => c.name + ':' + c.members.join(',')),
  placar: Object.entries(sc).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '), unidades: units, edificios: builds, noticias: S.news.length,
  capturas: S.news.filter(n => n.type === 'conquista').length, rebelioes: S.news.filter(n => n.type === 'rebeliao').length,
  dinheiroMedio: Math.round(Object.values(S.nations).filter(n => n.alive && !n.rebel).reduce((s, n) => s + n.res.dinheiro, 0) / 31),
  moralMedia: Math.round(S.provinces.reduce((s, p) => s + p.morale, 0) / S.provinces.length) }, null, 1));
fs.writeFileSync('/tmp/claude-0/news.txt', S.news.map(n => `D${Math.floor(n.h / 24) + 1} ${n.text}`).join('\n'));
