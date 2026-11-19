#!/usr/bin/env node
// Contact sheet of rendered frames, so a whole short can be checked at a glance before the long render.
//   node tools/sheet.mjs <folder of f00000.jpg…> [out.jpg] [--cols 6]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const dir = path.resolve(args[0] ?? "stills");
const out = path.resolve(args[1] && !args[1].startsWith("--") ? args[1] : path.join(dir, "sheet.jpg"));
const cols = Number(args[args.indexOf("--cols") + 1]) || 6;
const files = fs.readdirSync(dir).filter((f) => /^f\d{5}\.jpg$/.test(f)).sort();
if (!files.length) throw new Error(`no frames in ${dir}`);
const rows = Math.ceil(files.length / cols);
const list = path.join(dir, "_sheet.txt");
fs.writeFileSync(list, files.map((f) => `file '${path.join(dir, f).replace(/\\/g, "/")}'\nduration 1`).join("\n"));
const r = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=270:480,tile=${cols}x${rows}:padding=6:color=0x222222`, "-frames:v", "1", out], { encoding: "utf8" });
fs.unlinkSync(list);
if (r.status !== 0) throw new Error(r.stderr);
console.log(`${out}  (${files.length} frames: ${files.map((f) => +f.slice(1, 6)).join(", ")})`);
