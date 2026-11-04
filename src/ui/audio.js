// Som do jogo, todo sintetizado na hora (Web Audio): música ambiente original gerada por acaso + efeitos.
// Nada de arquivo de áudio: zero download e nenhuma música de terceiros.
let ctx = null, master, musicBus, sfxBus, noiseBuf, timer = null, nextBar = 0, bar = 0;
const st = { music: true, sfx: true, vol: 0.7 };
try { Object.assign(st, JSON.parse(localStorage.getItem('hegemonia1914_som') || '{}')); } catch { /* sem armazenamento */ }
const persist = () => { try { localStorage.setItem('hegemonia1914_som', JSON.stringify(st)); } catch { /* ok */ } };

export const sound = st;
// o navegador só libera áudio depois de um toque/clique do jogador
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = st.vol; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = st.music ? 0.33 : 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = st.sfx ? 0.9 : 0; sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}
export function setSound(k, v) {
  st[k] = v; persist(); if (!ctx) return;
  if (k === 'music') musicBus.gain.setTargetAtTime(v ? 0.33 : 0, ctx.currentTime, 0.3);
  if (k === 'sfx') sfxBus.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.05);
  if (k === 'vol') master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

// ---------- blocos básicos
function tone(freq, t, dur, { type = 'sine', vol = 0.3, attack = 0.01, bus = sfxBus, slide = 0, filter = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o; if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, { vol = 0.3, freq = 1200, type = 'lowpass', q = 0.7, bus = sfxBus, attack = 0.005 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const ok = () => ctx && st.sfx && ctx.state === 'running';

// ---------- efeitos
export const sfx = {
  click() { if (!ok()) return; const t = ctx.currentTime; tone(1300, t, 0.035, { type: 'triangle', vol: 0.12 }); noise(t, 0.02, { vol: 0.05, freq: 4000, type: 'highpass' }); },
  confirm() { if (!ok()) return; const t = ctx.currentTime; tone(520, t, 0.09, { type: 'triangle', vol: 0.16 }); tone(780, t + 0.07, 0.14, { type: 'triangle', vol: 0.16 }); },
  march() { if (!ok()) return; const t = ctx.currentTime; for (let i = 0; i < 4; i++) noise(t + i * 0.13, 0.06, { vol: 0.12 - i * 0.02, freq: 700 }); },
  build() { if (!ok()) return; const t = ctx.currentTime; [0, 0.16, 0.32].forEach((d, i) => { noise(t + d, 0.05, { vol: 0.18, freq: 2500, type: 'bandpass', q: 3 }); tone(220 + i * 30, t + d, 0.08, { type: 'square', vol: 0.05, filter: 900 }); }); tone(880, t + 0.5, 0.6, { type: 'sine', vol: 0.12 }); tone(1320, t + 0.5, 0.5, { type: 'sine', vol: 0.06 }); },
  unit() { if (!ok()) return; const t = ctx.currentTime; [[392, 0], [523, 0.14], [659, 0.28], [784, 0.42]].forEach(([f, d]) => tone(f, t + d, d === 0.42 ? 0.45 : 0.16, { type: 'sawtooth', vol: 0.07, filter: 1800, attack: 0.02 })); },
  alert() { if (!ok()) return; const t = ctx.currentTime; tone(740, t, 0.18, { type: 'square', vol: 0.06, filter: 2000 }); tone(554, t + 0.2, 0.3, { type: 'square', vol: 0.06, filter: 2000 }); },
  capture() { if (!ok()) return; const t = ctx.currentTime; [[523, 0, 0.15], [523, 0.16, 0.1], [659, 0.28, 0.15], [784, 0.45, 0.6]].forEach(([f, d, l]) => { tone(f, t + d, l, { type: 'sawtooth', vol: 0.08, filter: 2200, attack: 0.02 }); tone(f / 2, t + d, l, { type: 'triangle', vol: 0.05 }); }); noise(t + 0.45, 0.5, { vol: 0.08, freq: 600 }); },
  defeat() { if (!ok()) return; const t = ctx.currentTime; [[392, 0], [349, 0.3], [311, 0.6]].forEach(([f, d]) => tone(f, t + d, 0.4, { type: 'sawtooth', vol: 0.06, filter: 1200, attack: 0.03 })); },
  paper() { if (!ok()) return; const t = ctx.currentTime; for (let i = 0; i < 3; i++) noise(t + i * 0.07, 0.09, { vol: 0.06, freq: 3000 + i * 800, type: 'highpass' }); },
  cannon(v = 1) { if (!ok()) return; const t = ctx.currentTime + Math.random() * 0.2; tone(90, t, 0.9, { type: 'sine', vol: 0.35 * v, slide: 0.4, attack: 0.005 }); noise(t, 0.7, { vol: 0.28 * v, freq: 500 }); noise(t + 0.05, 1.4, { vol: 0.08 * v, freq: 220 }); },
  rifles(v = 1) { if (!ok()) return; const t = ctx.currentTime; for (let i = 0; i < 6; i++) noise(t + Math.random() * 0.9, 0.04, { vol: (0.05 + Math.random() * 0.08) * v, freq: 1800 + Math.random() * 1500, type: 'bandpass', q: 1.5 }); },
  plane() { if (!ok()) return; const t = ctx.currentTime; const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(95, t + 1.2); f.type = 'lowpass'; f.frequency.value = 500; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.9); },
};

// ---------- música: acordes lentos em tom menor, tambor marcial distante e trovões de artilharia ao longe.
// A progressão é sorteada a cada compasso (graus de um modo menor), então não repete nenhuma melodia conhecida.
const ROOT = 110; // lá
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const DEGREES = [0, 5, 3, 6, 4, 0, 2, 5];
const hz = (semi) => ROOT * Math.pow(2, semi / 12);
function chordAt(deg) { const i = ((deg % 7) + 7) % 7, oct = Math.floor(deg / 7) * 12; return [SCALE[i] + oct, SCALE[(i + 2) % 7] + oct + (i + 2 >= 7 ? 12 : 0), SCALE[(i + 4) % 7] + oct + (i + 4 >= 7 ? 12 : 0)]; }
function pad(semis, t, dur) {
  for (const s of semis) for (const det of [-4, 4]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = hz(s); o.detune.value = det; f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(700, t + dur / 2); f.frequency.linearRampToValueAtTime(380, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 1.2); g.gain.setValueAtTime(0.045, t + dur - 1.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.1);
  }
}
function drum(t, accent) { noise(t, 0.12, { vol: accent ? 0.22 : 0.1, freq: 1600, type: 'bandpass', q: 0.8, bus: musicBus }); tone(160, t, 0.12, { type: 'triangle', vol: accent ? 0.12 : 0.05, bus: musicBus, slide: 0.6 }); }
function scheduleBar(t) {
  const beat = 60 / 66, dur = beat * 8; // 2 compassos lentos por acorde
  const deg = DEGREES[bar % DEGREES.length] + (Math.random() < 0.25 ? 2 : 0);
  pad(chordAt(deg).map(s => s - 12), t, dur);
  tone(hz(chordAt(deg)[0] - 24), t, dur * 0.95, { type: 'triangle', vol: 0.09, attack: 0.6, bus: musicBus });
  // melodia esparsa de trompa: notas da escala sorteadas, poucas
  if (bar % 2 === 1) for (let k = 0; k < 3; k++) if (Math.random() < 0.6) { const n = SCALE[(Math.random() * 7) | 0] + 12; tone(hz(n), t + beat * (1 + k * 2.3), beat * 1.8, { type: 'triangle', vol: 0.05, attack: 0.25, bus: musicBus }); }
  // tambor marcial (rufar curto no fim)
  if (bar % 4 !== 0) for (let b = 0; b < 8; b++) { drum(t + b * beat, b % 4 === 0); if (b === 7) for (let r = 1; r < 4; r++) drum(t + b * beat + r * beat / 4, false); }
  // artilharia ao longe
  if (Math.random() < 0.35) { const at = t + Math.random() * dur; tone(55, at, 1.6, { type: 'sine', vol: 0.12, slide: 0.5, bus: musicBus }); noise(at, 1.8, { vol: 0.05, freq: 160, bus: musicBus }); }
  bar++; return dur;
}
function startMusic() {
  if (timer) return; nextBar = ctx.currentTime + 0.3;
  timer = setInterval(() => { if (!ctx || ctx.state !== 'running') return; while (nextBar < ctx.currentTime + 2) nextBar += scheduleBar(nextBar); }, 500);
}
