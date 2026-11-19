#!/usr/bin/env node
// Music + sound effects, synthesized here (no sample files, no licensing), mixed under the narration.
//   node tools/sound.mjs <project>
// Reads <project>/sound.json:
//   { "voice": "voice.mp3",
//     "music": { "mood": "playful|mystery|tense|warm|epic", "bpm": 104, "level": -17, "start": 0, "end": null, "sting": true },
//     "sfx": [ { "t": 1.25, "kind": "pop", "gain": 0 } ],  "tail": 0.8 }
// times in seconds (frame / 30). Writes <project>/work/mix.wav (44.1 kHz stereo). Needs ffmpeg on PATH.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SR = 44100;
const proj = path.resolve(process.argv[2] ?? ".");
const cfg = JSON.parse(fs.readFileSync(path.join(proj, "sound.json"), "utf8"));
const db = (x) => Math.pow(10, x / 20);

function decode(file) {
  const r = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}

let seed = 7;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const add = (buf, at, src, gain = 1) => { const i0 = Math.round(at * SR); for (let i = 0; i < src.length && i0 + i < buf.length; i++) if (i0 + i >= 0) buf[i0 + i] += src[i] * gain; };
const env = (n, a, r) => (i) => Math.min(1, i / Math.max(1, a * SR)) * Math.exp(-i / (r * SR));

// ---- instruments
function pluck(f, dur, amp = 0.3, bright = 1) {
  const n = Math.round(dur * SR), o = new Float32Array(n), e = env(n, 0.004, dur * 0.35);
  for (let i = 0; i < n; i++) { const t = i / SR, p = 2 * Math.PI * f * t; o[i] = amp * e(i) * (Math.sin(p) + 0.35 * bright * Math.sin(2 * p) * Math.exp(-t * 8) + 0.12 * bright * Math.sin(3 * p) * Math.exp(-t * 12)); }
  return o;
}
function pad(freqs, dur, amp = 0.08) {
  const n = Math.round(dur * SR), o = new Float32Array(n); let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, a = Math.min(1, t / 0.6) * Math.min(1, (dur - t) / 0.5);
    let s = 0; for (const f of freqs) for (const d of [-0.12, 0.12]) { const ph = (f * (1 + d / 100) * t) % 1; s += ph * 2 - 1; }
    lp += 0.06 * (s / (freqs.length * 2) - lp); o[i] = amp * a * lp * 3;
  }
  return o;
}
function bass(f, dur, amp = 0.22) { const n = Math.round(dur * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = amp * Math.min(1, t / 0.01) * Math.exp(-t * 2.5) * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)); } return o; }
function kick(amp = 0.5) { const n = Math.round(0.3 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, f = 45 + 80 * Math.exp(-t * 30); ph += f / SR; o[i] = amp * Math.exp(-t * 12) * Math.sin(2 * Math.PI * ph); } return o; }
function hat(amp = 0.06) { const n = Math.round(0.05 * SR), o = new Float32Array(n); let prev = 0; for (let i = 0; i < n; i++) { const x = noise(); o[i] = amp * Math.exp(-i / (0.012 * SR)) * (x - prev); prev = x; } return o; }
function snare(amp = 0.18) { const n = Math.round(0.18 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = amp * (0.7 * noise() * Math.exp(-t * 22) + 0.4 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30)); } return o; }

const MOODS = {
  playful: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], bpm: 108, drums: "light", arp: [0, 2, 1, 2, 0, 2, 1, 2], bright: 1 },
  mystery: { root: 62, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], bpm: 78, drums: "pulse", arp: [0, 1, 2, 1], bright: 0.4 },
  tense:   { root: 64, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 4], bpm: 122, drums: "drive", arp: [0, 0, 1, 0, 2, 0, 1, 0], bright: 0.6 },
  warm:    { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 5, 4], bpm: 84, drums: "none", arp: [0, 1, 2, 1], bright: 0.7 },
  epic:    { root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], bpm: 92, drums: "big", arp: [0, 2, 1, 2], bright: 0.8 },
};
function chordNotes(m, degree, octave = 0) { const s = m.scale, n = (k) => m.root + 12 * octave + s[(degree + k) % 7] + 12 * Math.floor((degree + k) / 7); return [n(0), n(2), n(4)]; }

function music(o, total) {
  const m = MOODS[o.mood] ?? MOODS.playful, bpm = o.bpm ?? m.bpm, beat = 60 / bpm, bar = beat * 4;
  const start = o.start ?? 0, end = Math.min(o.end ?? total, total);
  const buf = new Float32Array(Math.ceil(total * SR) + SR);
  let b = 0;
  for (let t = start; t < end; t += bar, b++) {
    const deg = m.prog[b % m.prog.length], ch = chordNotes(m, deg), len = Math.min(bar, end - t);
    add(buf, t, pad(ch.map((x) => mtof(x)), len + 0.3, 0.07));
    add(buf, t, bass(mtof(ch[0] - 24), Math.min(bar, len) * 0.9));
    const step = bar / m.arp.length;
    m.arp.forEach((k, i) => { const at = t + i * step; if (at < end - 0.05) add(buf, at, pluck(mtof(ch[k] + 12), step * 1.6, 0.16, m.bright)); });
    for (let q = 0; q < 4; q++) {
      const at = t + q * beat; if (at >= end) break;
      if (m.drums === "light") { if (q % 2 === 0) add(buf, at, kick(0.35)); add(buf, at + beat / 2, hat()); }
      if (m.drums === "pulse" && q % 2 === 0) add(buf, at, kick(0.25));
      if (m.drums === "drive") { add(buf, at, kick(0.4)); add(buf, at + beat / 2, hat(0.08)); if (q % 2) add(buf, at, snare(0.14)); }
      if (m.drums === "big") { if (q === 0 || q === 2) add(buf, at, kick(0.55)); if (q === 2) add(buf, at, snare(0.2)); }
    }
  }
  if (o.sting !== false && end < total - 0.2) {   // final hit where the music stops
    add(buf, end, pad(chordNotes(m, 0, 0).map(mtof), 2.2, 0.12)); add(buf, end, kick(0.6)); add(buf, end, pluck(mtof(m.root + 24), 1.5, 0.25));
  }
  return buf;
}

// ---- sound effects
const SFX = {
  pop: () => { const n = Math.round(0.12 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (900 - 600 * t / 0.12) / SR; o[i] = 0.5 * Math.exp(-t * 35) * Math.sin(2 * Math.PI * ph); } return o; },
  boing: () => { const n = Math.round(0.5 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (180 + 120 * Math.sin(t * 40) * Math.exp(-t * 4) + 200 * t) / SR; o[i] = 0.4 * Math.exp(-t * 5) * Math.sin(2 * Math.PI * ph); } return o; },
  whoosh: () => { const n = Math.round(0.55 * SR), o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR, a = Math.sin(Math.PI * t / 0.55), k = 0.02 + 0.25 * a; lp += k * (noise() - lp); o[i] = 0.6 * a * a * lp; } return o; },
  swish: () => { const n = Math.round(0.18 * SR), o = new Float32Array(n); let prev = 0; for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); o[i] = 0.35 * Math.sin(Math.PI * t / 0.18) * (x - prev); prev = x; } return o; },
  ding: () => { const n = Math.round(1.4 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = 0.25 * Math.exp(-t * 3) * (Math.sin(2 * Math.PI * 1320 * t) + 0.5 * Math.sin(2 * Math.PI * 2640 * t) * Math.exp(-t * 4) + 0.3 * Math.sin(2 * Math.PI * 3960 * t) * Math.exp(-t * 8)); } return o; },
  thud: () => { const n = Math.round(0.35 * SR), o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR; lp += 0.05 * (noise() - lp); o[i] = 0.6 * Math.exp(-t * 14) * (Math.sin(2 * Math.PI * (70 - 30 * t) * t) + lp * 2); } return o; },
  tick: () => { const n = Math.round(0.03 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = 0.4 * Math.exp(-i / (0.004 * SR)) * Math.sin(2 * Math.PI * 2200 * i / SR); return o; },
  click: () => SFX.tick(),
  sparkle: () => { const o = new Float32Array(Math.round(1.0 * SR)); [2093, 2637, 3136, 4186].forEach((f, k) => add(o, k * 0.07, pluck(f, 0.5, 0.08))); return o; },
  magic: () => { const o = new Float32Array(Math.round(1.3 * SR)); [523, 659, 784, 1047, 1319, 1568].forEach((f, k) => add(o, k * 0.08, pluck(f, 0.6, 0.12))); return o; },
  coin: () => { const o = new Float32Array(Math.round(0.5 * SR)); [[988, 0], [1319, 0.08]].forEach(([f, at]) => { const n = Math.round(0.35 * SR), s = new Float32Array(n); for (let i = 0; i < n; i++) s[i] = 0.18 * Math.exp(-i / (0.1 * SR)) * Math.sign(Math.sin(2 * Math.PI * f * i / SR)); add(o, at, s); }); return o; },
  sting: () => { const o = new Float32Array(Math.round(2.2 * SR)); add(o, 0, pad([110, 131, 165, 220].map((f) => f), 2.0, 0.2)); add(o, 0, kick(0.7)); add(o, 0, pluck(220, 1.6, 0.3, 0.5)); return o; },
  impact: () => { const o = new Float32Array(Math.round(1.0 * SR)); add(o, 0, kick(0.9)); add(o, 0, SFX.thud(), 0.8); return o; },
  splash: () => { const n = Math.round(0.9 * SR), o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR; lp += 0.15 * (noise() - lp); o[i] = 0.5 * Math.exp(-t * 5) * lp; } return o; },
  footsteps: () => { const o = new Float32Array(Math.round(1.2 * SR)); for (let k = 0; k < 4; k++) add(o, k * 0.28, SFX.thud(), 0.35); return o; },
  drumroll: () => { const o = new Float32Array(Math.round(1.6 * SR)); for (let k = 0; k < 28; k++) add(o, k * 0.05, snare(0.08 + k * 0.003)); add(o, 1.45, kick(0.5)); return o; },
  riser: () => { const n = Math.round(1.5 * SR), o = new Float32Array(n); let ph = 0, lp = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (200 + 900 * t * t) / SR; lp += (0.02 + 0.2 * t / 1.5) * (noise() - lp); o[i] = (t / 1.5) * 0.3 * (Math.sin(2 * Math.PI * ph) * 0.5 + lp); } return o; },
  bell: () => SFX.ding(),
  gasp: () => SFX.swish(),
};

// ---- mix
// silent mode: "voice": null and "duration": seconds → music + effects only (the music sits at speech level then)
const silent = cfg.voice === null || cfg.voice === false;
if (silent && !cfg.duration) throw new Error('sound.json: with "voice": null, give "duration" in seconds');
const voice = silent ? new Float32Array(0) : decode(path.resolve(proj, cfg.voice ?? "voice.mp3"));
const total = silent ? cfg.duration : voice.length / SR + (cfg.tail ?? 0.8);
const N = Math.ceil(total * SR);
if (silent && cfg.music) cfg.music.level ??= -4;

// voice to a steady speaking level (about -20 dBFS RMS over its active parts)
let sum = 0, cnt = 0;
for (let i = 0; i < voice.length; i += 64) { const v = voice[i]; if (Math.abs(v) > 0.01) { sum += v * v; cnt++; } }
const vRms = Math.sqrt(sum / Math.max(1, cnt)) || 0.05, vGain = db(-20) / vRms;

// voice activity → ducking curve for the music
const duck = new Float32Array(N); { let e = 0; const win = 512;
  for (let i = 0; i < N; i += win) { let s = 0; for (let k = i; k < Math.min(i + win, voice.length); k++) s += Math.abs(voice[k] * vGain); const lvl = s / win; e += (lvl > 0.015 ? 0.35 : 0.04) * ((lvl > 0.015 ? 1 : 0) - e); for (let k = i; k < Math.min(i + win, N); k++) duck[k] = e; } }

const bed = new Float32Array(N);
if (cfg.music) {
  const m = music(cfg.music, total);
  let ms = 0, mc = 0; for (let i = 0; i < Math.min(m.length, N); i += 64) { ms += m[i] * m[i]; mc++; }
  const g = db(-20 + (cfg.music.level ?? -17)) / (Math.sqrt(ms / Math.max(1, mc)) || 1);
  for (let i = 0; i < N; i++) bed[i] = (m[i] ?? 0) * g * (1 - 0.45 * duck[i]);
}
const fx = new Float32Array(N);
for (const s of cfg.sfx ?? []) { const make = SFX[s.kind]; if (!make) { console.log(`unknown sfx "${s.kind}" (skipped)`); continue; } add(fx, s.t, make(), db(-14 + (s.gain ?? 0))); }

const out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVEfmt ", 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
const haas = Math.round(0.009 * SR);   // a little width for the music: right channel 9 ms later
let peak = 0;
for (let i = 0; i < N; i++) {
  const v = (voice[i] ?? 0) * vGain, l = v + bed[i] + fx[i], r = v + (bed[i - haas] ?? 0) + fx[i];
  const L = Math.tanh(l * 1.1) / 1.1, R = Math.tanh(r * 1.1) / 1.1;
  peak = Math.max(peak, Math.abs(L), Math.abs(R));
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R)) * 32767), 46 + i * 4);
}
fs.mkdirSync(path.join(proj, "work"), { recursive: true });
fs.writeFileSync(path.join(proj, "work", "mix.wav"), out);
console.log(`mix.wav · ${silent ? "silent (no voice) · " : ""}${total.toFixed(2)} s · music: ${cfg.music?.mood ?? "none"} · ${(cfg.sfx ?? []).length} sfx · peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
