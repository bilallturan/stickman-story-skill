#!/usr/bin/env node
// Render frames of a story to JPEG files.
//   node tools/render.mjs <project folder | story.js> [--frames 0,30,60 | 0-300 | 0-300:15] [--out dir] [--look paper|ink] [--resume] [--cpu] [--param k=v]
// A project folder contains story.js and (after timing) work/words.json. Default output: <project>/frames
import fs from "node:fs";
import path from "node:path";
import { frameList, openStudio, SKILL } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : args[i + 1]; };
const flag = (name) => args.includes(`--${name}`);
const target = path.resolve(args[0] ?? ".");

let project, story, words;
if (fs.statSync(target).isDirectory()) {
  project = target; story = "/p/story.js";
  if (fs.existsSync(path.join(project, "work", "words.json"))) words = "/p/work/words.json";
} else {
  const rel = path.relative(SKILL, target).split(path.sep).join("/");
  if (rel.startsWith("..")) { project = path.dirname(target); story = "/p/" + path.basename(target); }
  else story = "/" + rel;
}
const params = {};
args.forEach((a, i) => { if (a === "--param") { const [k, v] = args[i + 1].split("="); params[k] = v; } });
const out = path.resolve(opt("out", path.join(project ?? path.dirname(target), "frames")));
fs.mkdirSync(out, { recursive: true });

const studio = await openStudio({ project, story, words, look: opt("look"), params, cpu: flag("cpu") });
const { fps, frames } = studio.meta;
let todo = frameList(opt("frames"), frames);
if (flag("resume")) todo = todo.filter((f) => !fs.existsSync(path.join(out, `f${String(f).padStart(5, "0")}.jpg`)));
console.log(`${todo.length} frame(s) of ${frames} (${(frames / fps).toFixed(1)} s, look: ${studio.meta.look}) → ${out}`);
const t0 = Date.now();
for (let i = 0; i < todo.length; i++) {
  fs.writeFileSync(path.join(out, `f${String(todo[i]).padStart(5, "0")}.jpg`), await studio.frame(todo[i]));
  if ((i + 1) % 30 === 0 || i + 1 === todo.length) { const per = (Date.now() - t0) / 1000 / (i + 1); console.log(`  ${i + 1}/${todo.length} · ${per.toFixed(2)} s/frame · ~${(per * (todo.length - i - 1) / 60).toFixed(1)} min left`); }
}
await studio.close();
