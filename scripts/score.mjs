/**
 * Writes the soundtrack for the demo: a low drone, wind on paper, a guqin-ish
 * pluck per cinnabar dot, a bell when the seal lands, and a rising phrase at
 * the finale. Everything is synthesised here — the repo ships no audio files.
 *
 *   node scripts/score.mjs [video/timeline.json] [video/score.wav]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TL = process.argv[2] ?? 'video/timeline.json';
const OUT = process.argv[3] ?? 'video/score.wav';
const SR = 48000;

const events = existsSync(TL) ? JSON.parse(readFileSync(TL, 'utf8')) : [];
const lastBeat = events.length ? events[events.length - 1].t : 60;
const DUR = Math.min(120, Math.ceil(lastBeat + 4));
const N = Math.ceil(DUR * SR);

const L = new Float32Array(N);
const R = new Float32Array(N);

// D gong pentatonic: D E F# A B
const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94];
const note = (i) => {
  const oct = Math.floor(i / SCALE.length);
  return SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length] * Math.pow(2, oct);
};

function add(i, l, r) {
  if (i < 0 || i >= N) return;
  L[i] += l;
  R[i] += r;
}

/** A plucked string: a few partials, fast attack, long exponential tail. */
function pluck(t0, freq, gain = 0.3, decay = 0.85, pan = 0) {
  const start = Math.floor(t0 * SR);
  const len = Math.min(N - start, Math.floor(SR * (decay * 4)));
  if (len <= 0) return;
  const gl = Math.cos(((pan + 1) / 2) * Math.PI * 0.5);
  const gr = Math.sin(((pan + 1) / 2) * Math.PI * 0.5);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.004);
    const drop = 1 - 0.012 * Math.exp(-t / 0.05);
    const w =
      Math.sin(2 * Math.PI * freq * drop * t) * 1.0 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.3 * Math.exp(-t / 0.35) +
      Math.sin(2 * Math.PI * freq * 3 * t) * 0.12 * Math.exp(-t / 0.2) +
      Math.sin(2 * Math.PI * freq * 4.05 * t) * 0.06 * Math.exp(-t / 0.12);
    const pick = k < SR * 0.006 ? (Math.random() * 2 - 1) * 0.5 * (1 - k / (SR * 0.006)) : 0;
    const s = (w + pick) * env * gain;
    add(start + k, s * gl, s * gr);
  }
}

function bell(t0, freq = 220, gain = 0.3) {
  const start = Math.floor(t0 * SR);
  const len = Math.min(N - start, Math.floor(SR * 3.2));
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.exp(-t / 1.25) * Math.min(1, t / 0.006);
    const s =
      (Math.sin(2 * Math.PI * freq * t) +
        Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.35 +
        Math.sin(2 * Math.PI * freq * 2.72 * t) * 0.18 +
        Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.4) *
      env *
      gain;
    add(start + k, s * 0.7, s * 0.7);
  }
}

function drum(t0, gain = 0.34) {
  const start = Math.floor(t0 * SR);
  const len = Math.min(N - start, Math.floor(SR * 0.9));
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.exp(-t / 0.16) * Math.min(1, t / 0.003);
    const f = 92 * (1 - 0.5 * Math.min(1, t / 0.25));
    const s = Math.sin(2 * Math.PI * f * t) * env * gain;
    add(start + k, s, s);
  }
}

function noiseSwell(t0, dur, gain = 0.05, f0 = 420, f1 = 1200) {
  const start = Math.floor(t0 * SR);
  const len = Math.min(N - start, Math.floor(SR * dur));
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const u = t / dur;
    const cut = f0 + (f1 - f0) * Math.sin(u * Math.PI);
    const a = Math.min(0.9, (2 * Math.PI * cut) / SR);
    lp += a * (Math.random() * 2 - 1 - lp);
    const env = Math.sin(u * Math.PI) ** 2;
    const s = lp * env * gain;
    add(start + k, s * 0.8, s);
  }
}

// ---------------------------------------------------------------- the bed

// drone: D2 + A2 + a breath of D3
const swell = (t) => {
  const inA = Math.min(1, t / 6);
  const outA = Math.min(1, Math.max(0, (DUR - t) / 6));
  return inA * outA;
};
let lpBed = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const env = swell(t) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.07 * t));
  // pairs detuned by a fraction of a hertz: they beat slowly instead of humming
  const d2 =
    (Math.sin(2 * Math.PI * 73.42 * t) + Math.sin(2 * Math.PI * 73.86 * t + 0.7)) * 0.03;
  const a2 =
    (Math.sin(2 * Math.PI * 110.0 * t + 0.4) + Math.sin(2 * Math.PI * 110.51 * t + 2.1)) * 0.017;
  const d3 = Math.sin(2 * Math.PI * 146.83 * t + 1.1) * 0.011;
  // wind getting through the paper
  const a = (2 * Math.PI * 620) / SR;
  lpBed += a * (Math.random() * 2 - 1 - lpBed);
  const wind = lpBed * 0.038 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.05 * t + 1.7));
  const s = (d2 + a2 + d3) * env + wind * env;
  add(i, s, s * 0.96);
}

// ---------------------------------------------------------------- the beats

const PENTA = [0, 1, 2, 3, 4, 5, 6, 7];
let dotCount = 0;

for (const e of events) {
  switch (e.kind) {
    case 'draw-start':
      noiseSwell(e.t, 0.45, 0.035, 700, 1800);
      break;
    case 'dot': {
      const idx = typeof e.n === 'number' ? e.n : dotCount;
      dotCount++;
      pluck(e.t, note(PENTA[idx % PENTA.length]), 0.31, 0.85, idx % 2 ? 0.35 : -0.35);
      break;
    }
    case 'shadowdot':
      pluck(e.t, note((e.n ?? 0) + 3) * 0.5, 0.15, 1.1, -0.5);
      break;
    case 'seal':
      bell(e.t, 220, 0.26);
      drum(e.t, 0.3);
      break;
    case 'walk':
      noiseSwell(e.t, 0.5, 0.022, 900, 300);
      break;
    case 'shadow':
      noiseSwell(e.t, 1.6, 0.05, 1600, 260);
      pluck(e.t + 0.15, 110, 0.12, 1.6, -0.6);
      break;
    case 'finale':
      bell(e.t, 293.66, 0.3);
      [0, 1, 2, 3, 4, 5].forEach((k, i) => pluck(e.t + 0.25 + i * 0.26, note(k + 3), 0.16 - i * 0.012, 1.0, -0.6 + i * 0.24));
      break;
    default:
      break;
  }
}

// a slow phrase between the beats, so the room never feels empty
const phrases = [0.9, 5.2, 8.6, 12.4, 16.2, 20.6, 25.5, 30.2, 34.4, 38.8, 43.2, 47.5, 51.8];
phrases.forEach((t, i) => {
  const seq = [0, 2, 4, 3, 1];
  for (let k = 0; k < 3; k++) {
    const at = t + k * 0.34;
    if (at > DUR - 2) break;
    pluck(at, note(seq[(i + k) % seq.length] + (i % 3) * 2), 0.075, 1.5, ((i + k) % 3) * 0.5 - 0.5);
  }
});

// ---------------------------------------------------------------- room

// three early reflections, low-passed, quietly mixed back in
const taps = [
  { ms: 97, g: 0.22 },
  { ms: 191, g: 0.14 },
  { ms: 311, g: 0.09 },
];
for (const { ms, g } of taps) {
  const d = Math.floor((ms / 1000) * SR);
  for (let i = d; i < N; i++) {
    L[i] += R[i - d] * g * 0.6 + L[i - d] * g * 0.4;
    R[i] += L[i - d] * g * 0.6 + R[i - d] * g * 0.4;
  }
}

// ---------------------------------------------------------------- master

let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (DUR - t) / 2.2));
  L[i] = Math.tanh(L[i] * 1.15) * fade;
  R[i] = Math.tanh(R[i] * 1.15) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.84 / peak : 1;

const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * norm * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * norm * 32767))), 46 + i * 4);
}
writeFileSync(OUT, buf);
console.log(`wrote ${OUT} · ${DUR}s · ${events.length} beats · peak ${peak.toFixed(3)}`);
