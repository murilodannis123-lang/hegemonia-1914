// Definições de jogo: recursos, terrenos, edifícios e unidades (valores próprios).
export const RES = ['dinheiro', 'graos', 'peixe', 'ferro', 'madeira', 'carvao', 'petroleo', 'gas'];
export const RES_INFO = {
  dinheiro: { name: 'Dinheiro', cat: 'dinheiro' },
  graos: { name: 'Grãos', cat: 'comida' },
  peixe: { name: 'Peixe', cat: 'comida' },
  ferro: { name: 'Minério de ferro', cat: 'materiais' },
  madeira: { name: 'Madeira', cat: 'materiais' },
  carvao: { name: 'Carvão', cat: 'energia' },
  petroleo: { name: 'Petróleo', cat: 'energia' },
  gas: { name: 'Gás', cat: 'energia' },
};
export const CATS = { comida: ['graos', 'peixe'], materiais: ['ferro', 'madeira'], energia: ['carvao', 'petroleo', 'gas'] };
export const CAT_NAMES = { comida: 'Comida', materiais: 'Materiais', energia: 'Energia' };
// consumo diário da população por província, por categoria
export const NEED_PER_PROV = { comida: 380, materiais: 260, energia: 220 };

export const TERRAIN = {
  planicie: { name: 'Planície', move: 1.0, def: 1.0, armAtk: 1.0 },
  floresta: { name: 'Floresta', move: 0.8, def: 1.2, armAtk: 0.8 },
  colina: { name: 'Colinas', move: 0.8, def: 1.25, armAtk: 0.9 },
  montanha: { name: 'Montanhas', move: 0.6, def: 1.5, armAtk: 0.7 },
  urbano: { name: 'Urbano', move: 0.9, def: 1.35, armAtk: 0.8 },
  deserto: { name: 'Deserto', move: 0.85, def: 1.0, armAtk: 1.0 },
  mar: { name: 'Mar', move: 1.0, def: 1.0, armAtk: 1.0 },
};

// produção base diária
export const BASE_MONEY = 1600;
export const BASE_RES = 2200;

// Edifícios. cost/time por nível (multiplicados pelo nível alvo).
export const BUILDINGS = {
  recrutamento: { name: 'Escritório de Recrutamento', max: 1, day: 1, cost: { dinheiro: 1000, graos: 250, madeira: 250 }, time: 2,
    desc: 'Permite recrutar Infantaria na província.' },
  quartel: { name: 'Quartel', max: 3, day: 1, cost: { dinheiro: 4000, graos: 1500, madeira: 1500 }, time: 20,
    desc: 'Nível 1 libera Cavalaria; nível 2 libera Tropas de Choque. Cada nível acelera em 20% o treino de tropas.' },
  oficina: { name: 'Oficina', max: 3, day: 2, cost: { dinheiro: 6000, ferro: 2000, madeira: 1000, carvao: 1000 }, time: 26,
    desc: 'Nível 1 libera Carro Blindado, Artilharia Leve e Canhão Antiaéreo; nível 2 libera Artilharia. Acelera em 15% por nível a produção de veículos.' },
  fabrica: { name: 'Fábrica', max: 3, day: 4, cost: { dinheiro: 10000, ferro: 2500, madeira: 2500, carvao: 2500 }, time: 40,
    desc: 'Nível 1 libera Tanque Leve; nível 2, Tanque Pesado; nível 3 (com ferrovia), Canhão Ferroviário. +15% de produção de recursos por nível.' },
  ferrovia: { name: 'Caminho de Ferro', max: 1, day: 3, cost: { dinheiro: 10000, ferro: 3000, madeira: 5000, carvao: 1000 }, time: 36,
    desc: '+25% de produção na província e tropas andam 60% mais rápido em território próprio com ferrovia.' },
  porto: { name: 'Porto', max: 2, day: 1, coastal: true, cost: { dinheiro: 5000, ferro: 1500, madeira: 1500 }, time: 22,
    desc: 'Só em províncias costeiras. Nível 1 libera Cruzador e Submarino; nível 2 libera Couraçado. +10% de produção.' },
  aerodromo: { name: 'Aeródromo', max: 2, day: 3, cost: { dinheiro: 5000, ferro: 2000, petroleo: 2000 }, time: 26,
    desc: 'Base aérea. Nível 1 libera Balão e Caça; nível 2 libera Bombardeiro e Zepelim.' },
  forte: { name: 'Forte', max: 5, day: 1, cost: { dinheiro: 4000, ferro: 2000 }, time: 9,
    desc: 'Reduz o dano sofrido pelas tropas que defendem a província.' },
};
export const FORT_REDUCTION = [0, 0.25, 0.4, 0.52, 0.62, 0.7];
export const BUILD_ORDER = ['recrutamento', 'quartel', 'oficina', 'fabrica', 'ferrovia', 'porto', 'aerodromo', 'forte'];

// Unidades.
// cls: classe para dano (inf, arm, air, nav). atk/def contra classes e 'bld' (edifícios).
export const UNITS = {
  infantaria: { name: 'Infantaria', dom: 'land', cls: 'inf', hp: 15, spd: 30, rng: 0, view: 40,
    atk: { inf: 2.0, arm: 0.7, air: 0.3, nav: 0.4, bld: 0.4 }, def: { inf: 3.0, arm: 1.2, air: 0.5, nav: 0.6 },
    cost: { dinheiro: 1500, graos: 600, madeira: 300 }, time: 6, req: ['recrutamento', 1], day: 1, upkeep: 40 },
  cavalaria: { name: 'Cavalaria', dom: 'land', cls: 'inf', hp: 15, spd: 55, rng: 0, view: 60,
    atk: { inf: 3.0, arm: 0.9, air: 0.2, nav: 0.3, bld: 0.4 }, def: { inf: 2.0, arm: 0.8, air: 0.3, nav: 0.4 },
    cost: { dinheiro: 2500, graos: 1000, ferro: 300 }, time: 10, req: ['quartel', 1], day: 1, upkeep: 60 },
  choque: { name: 'Tropas de Choque', dom: 'land', cls: 'inf', hp: 18, spd: 30, rng: 0, view: 40,
    atk: { inf: 4.2, arm: 2.0, air: 0.4, nav: 0.5, bld: 1.4 }, def: { inf: 2.6, arm: 1.6, air: 0.5, nav: 0.6 },
    cost: { dinheiro: 4000, graos: 800, ferro: 500, gas: 500 }, time: 12, req: ['quartel', 2], day: 5, upkeep: 80 },
  blindado: { name: 'Carro Blindado', dom: 'land', cls: 'arm', hp: 18, spd: 70, rng: 0, view: 60,
    atk: { inf: 3.0, arm: 1.2, air: 0.6, nav: 0.3, bld: 0.6 }, def: { inf: 2.0, arm: 1.5, air: 0.8, nav: 0.4 },
    cost: { dinheiro: 4500, ferro: 1200, petroleo: 600 }, time: 14, req: ['oficina', 1], day: 2, upkeep: 90 },
  artleve: { name: 'Artilharia Leve', dom: 'land', cls: 'inf', hp: 12, spd: 32, rng: 30, view: 40,
    atk: { inf: 3.5, arm: 2.4, air: 0.2, nav: 1.0, bld: 1.6 }, def: { inf: 1.0, arm: 1.0, air: 0.3, nav: 0.5 },
    cost: { dinheiro: 4000, ferro: 900, carvao: 600 }, time: 16, req: ['oficina', 1], day: 2, upkeep: 70 },
  antiaereo: { name: 'Canhão Antiaéreo', dom: 'land', cls: 'inf', hp: 14, spd: 30, rng: 0, view: 60,
    atk: { inf: 1.0, arm: 0.8, air: 4.5, nav: 0.2, bld: 0.2 }, def: { inf: 1.2, arm: 1.0, air: 5.0, nav: 0.3 },
    cost: { dinheiro: 4000, ferro: 1000, carvao: 500 }, time: 14, req: ['oficina', 1], day: 4, upkeep: 60 },
  artilharia: { name: 'Artilharia', dom: 'land', cls: 'inf', hp: 15, spd: 25, rng: 55, view: 40,
    atk: { inf: 5.0, arm: 4.0, air: 0.3, nav: 2.0, bld: 3.0 }, def: { inf: 1.0, arm: 1.0, air: 0.3, nav: 0.5 },
    cost: { dinheiro: 7000, ferro: 1800, carvao: 1200 }, time: 28, req: ['oficina', 2], day: 4, upkeep: 110 },
  tanqueleve: { name: 'Tanque Leve', dom: 'land', cls: 'arm', hp: 25, spd: 45, rng: 0, view: 50,
    atk: { inf: 5.0, arm: 3.0, air: 0.5, nav: 0.5, bld: 1.0 }, def: { inf: 4.0, arm: 3.0, air: 0.8, nav: 0.6 },
    cost: { dinheiro: 9000, ferro: 2500, petroleo: 1500 }, time: 30, req: ['fabrica', 1], day: 6, upkeep: 150 },
  tanquepesado: { name: 'Tanque Pesado', dom: 'land', cls: 'arm', hp: 40, spd: 25, rng: 0, view: 40,
    atk: { inf: 7.0, arm: 6.0, air: 0.5, nav: 0.8, bld: 2.5 }, def: { inf: 7.0, arm: 6.0, air: 1.0, nav: 0.8 },
    cost: { dinheiro: 15000, ferro: 4000, petroleo: 2500 }, time: 44, req: ['fabrica', 2], day: 9, upkeep: 220 },
  ferroviario: { name: 'Canhão Ferroviário', dom: 'land', cls: 'arm', hp: 30, spd: 20, rng: 130, view: 40,
    atk: { inf: 8.0, arm: 7.0, air: 0.0, nav: 4.0, bld: 8.0 }, def: { inf: 1.0, arm: 1.0, air: 0.3, nav: 0.5 },
    cost: { dinheiro: 30000, ferro: 8000, carvao: 6000 }, time: 70, req: ['fabrica', 3], req2: ['ferrovia', 1], day: 12, upkeep: 400 },
  balao: { name: 'Balão de Observação', dom: 'air', cls: 'air', hp: 10, spd: 25, rng: 0, view: 160, range: 260,
    atk: { inf: 0, arm: 0, air: 0, nav: 0, bld: 0 }, def: { inf: 0, arm: 0, air: 0.5, nav: 0 },
    cost: { dinheiro: 2500, madeira: 600, gas: 600 }, time: 10, req: ['aerodromo', 1], day: 1, upkeep: 40 },
  caca: { name: 'Caça', dom: 'air', cls: 'air', hp: 15, spd: 190, rng: 0, view: 80, range: 520,
    atk: { inf: 1.5, arm: 0.8, air: 5.0, nav: 0.5, bld: 0.3 }, def: { inf: 0.5, arm: 0.5, air: 4.0, nav: 0.3 },
    cost: { dinheiro: 8000, madeira: 1500, petroleo: 1500 }, time: 24, req: ['aerodromo', 1], day: 4, upkeep: 120 },
  bombardeiro: { name: 'Bombardeiro', dom: 'air', cls: 'air', hp: 18, spd: 140, rng: 0, view: 80, range: 820,
    atk: { inf: 3.0, arm: 3.0, air: 0.5, nav: 3.0, bld: 5.0 }, def: { inf: 0.3, arm: 0.3, air: 1.5, nav: 0.3 },
    cost: { dinheiro: 14000, ferro: 1500, petroleo: 2500 }, time: 34, req: ['aerodromo', 2], day: 8, upkeep: 180 },
  zepelim: { name: 'Zepelim', dom: 'air', cls: 'air', hp: 35, spd: 70, rng: 0, view: 140, range: 1400,
    atk: { inf: 2.0, arm: 1.5, air: 0.3, nav: 1.0, bld: 6.0 }, def: { inf: 0.2, arm: 0.2, air: 1.0, nav: 0.2 },
    cost: { dinheiro: 16000, ferro: 1500, gas: 4000 }, time: 44, req: ['aerodromo', 2], day: 10, upkeep: 200 },
  submarino: { name: 'Submarino', dom: 'sea', cls: 'nav', hp: 18, spd: 35, rng: 0, view: 40, stealth: true,
    atk: { inf: 0.3, arm: 0.3, air: 0, nav: 5.0, bld: 0 }, def: { inf: 0.2, arm: 0.2, air: 0.5, nav: 2.0 },
    cost: { dinheiro: 7000, ferro: 2000, petroleo: 1000 }, time: 28, req: ['porto', 1], day: 3, upkeep: 120 },
  cruzador: { name: 'Cruzador', dom: 'sea', cls: 'nav', hp: 30, spd: 45, rng: 40, view: 80,
    atk: { inf: 2.0, arm: 2.0, air: 2.0, nav: 4.0, bld: 1.5 }, def: { inf: 2.0, arm: 2.0, air: 2.5, nav: 4.0 },
    cost: { dinheiro: 10000, ferro: 3000, carvao: 1500 }, time: 34, req: ['porto', 1], day: 2, upkeep: 160 },
  couracado: { name: 'Couraçado', dom: 'sea', cls: 'nav', hp: 60, spd: 30, rng: 80, view: 80,
    atk: { inf: 4.0, arm: 4.0, air: 1.0, nav: 7.0, bld: 4.0 }, def: { inf: 3.0, arm: 3.0, air: 2.0, nav: 7.0 },
    cost: { dinheiro: 22000, ferro: 6000, carvao: 3000 }, time: 56, req: ['porto', 2], day: 7, upkeep: 300 },
};
export const UNIT_ORDER = Object.keys(UNITS);
export const UNIT_TABS = { terra: ['infantaria', 'cavalaria', 'choque', 'blindado', 'artleve', 'antiaereo', 'artilharia', 'tanqueleve', 'tanquepesado', 'ferroviario'], aereo: ['balao', 'caca', 'bombardeiro', 'zepelim'], naval: ['submarino', 'cruzador', 'couracado'] };
export const TRANSPORT_SPEED = 32;     // km/h de tropas embarcadas
export const EMBARK_DEF = 0.3;         // fator de defesa embarcado
export const MELEE_RANGE = 8;          // km
export const PATROL_RADIUS = 70;       // km

export const RELATIONS = { guerra: 'Guerra', paz: 'Paz', passagem: 'Direito de passagem', aliado: 'Aliado' };
