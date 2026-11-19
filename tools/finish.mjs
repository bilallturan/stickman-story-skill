#!/usr/bin/env node
// Frames + mix → finished MP4 (H.264, AAC, loudness -14 LUFS / peak -1 dB), then a quality check.
//   node tools/finish.mjs <project> ["Title"] [--fps 30]
// Reads <project>/frames/f00000.jpg… and <project>/work/mix.wav. Writes <project>/out/<Title>.mp4 and out/qa.jpg.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const proj = path.resolve(args[0] ?? ".");
const title = (args[1] && !args[1].startsWith("--") ? args[1] : path.basename(proj)).replace(/[\\/:*?"<>|]/g, "-");
const fps = Number(args[args.indexOf("--fps") + 1]) || 30;
const FF = process.env.FFMPEG ?? "ffmpeg";
const run = (a, opts = {}) => { const r = spawnSync(FF, a, { encoding: "utf8", maxBuffer: 1 << 28, ...opts }); if (r.status !== 0 && !opts.ok) throw new Error(r.stderr.slice(-2000)); return r; };

const frames = fs.readdirSync(path.join(proj, "frames")).filter((f) => /^f\d{5}\.jpg$/.test(f)).sort();
if (!frames.length) throw new Error("no frames: run tools/render.mjs first");
const n = frames.length;
const missing = []; for (let i = 0; i < n; i++) if (frames[i] !== `f${String(i).padStart(5, "0")}.jpg`) { missing.push(i); break; }
if (missing.length) throw new Error(`frame ${missing[0]} is missing: render it (tools/render.mjs --resume)`);
const mix = path.join(proj, "work", "mix.wav");
if (!fs.existsSync(mix)) throw new Error("work/mix.wav missing: run tools/sound.mjs first");

// pass 1: measure loudness; pass 2: encode with the measured values (accurate -14 LUFS)
const m = run(["-hide_banner", "-i", mix, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]).stderr;
const j = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
const outDir = path.join(proj, "out"); fs.mkdirSync(outDir, { recursive: true });
const dst = path.join(outDir, `${title}.mp4`);
run(["-v", "error", "-y", "-framerate", String(fps), "-i", path.join(proj, "frames", "f%05d.jpg"), "-i", mix,
  "-af", `${ln},alimiter=limit=0.84:level=false:attack=2:release=60,aresample=48000`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-c:a", "aac", "-b:a", "192k", "-t", (n / fps).toFixed(3), dst]);

// quality check: frozen picture, black frames, final loudness
const q = run(["-hide_banner", "-i", dst, "-vf", "freezedetect=n=0.002:d=0.5,blackdetect=d=0.1:pix_th=0.06", "-af", "ebur128=peak=true", "-f", "null", "-"], { ok: true }).stderr;
const freezes = [...q.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)].map((x) => `${(+x[1]).toFixed(1)} s (${(+x[2]).toFixed(1)} s)`);
const blacks = [...q.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((x) => `${(+x[1]).toFixed(1)}–${(+x[2]).toFixed(1)} s`);
const I = q.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1), peak = q.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1);

// contact sheet: 12 evenly spaced frames
const pick = Array.from({ length: 12 }, (_, i) => Math.round((i + 0.5) * n / 12));
const list = path.join(outDir, "qa_list.txt");
fs.writeFileSync(list, pick.map((f) => `file '${path.join(proj, "frames", `f${String(Math.min(n - 1, f)).padStart(5, "0")}.jpg`).replace(/\\/g, "/")}'\nduration 1`).join("\n"));
run(["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=270:480,tile=6x2:padding=6:color=0x222222", "-frames:v", "1", path.join(outDir, "qa.jpg")]);
fs.unlinkSync(list);

console.log(`${dst}\n  ${n} frames · ${(n / fps).toFixed(2)} s · ${I?.replace(/\s+/g, " ")} · ${peak?.replace(/\s+/g, " ")}`);
console.log(freezes.length ? `  WARNING frozen picture at: ${freezes.join(", ")}` : "  no frozen stretches ≥ 0.5 s");
console.log(blacks.length ? `  WARNING black frames at: ${blacks.join(", ")}` : "  no black frames");
console.log(`  contact sheet: ${path.join(outDir, "qa.jpg")}`);
