#!/usr/bin/env node
// Render frames of a story to JPEG files, and check framing on every rendered frame.
//   node tools/render.mjs <project folder | story.js> [--frames 0,30,60 | 0-300 | 0-300:15] [--out dir] [--look paper|ink] [--resume] [--cpu] [--param k=v]
//   node tools/render.mjs <project> --check        → render every frame without saving, report only (fast full pass)
// A project folder contains story.js and (after timing) work/words.json. Default output: <project>/frames
// Framing report: characters cut by the left/right/top edge, as frame ranges; also written to <project>/work/framing.json.
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
const checkOnly = flag("check");
const out = path.resolve(opt("out", path.join(project ?? path.dirname(target), "frames")));
if (!checkOnly) fs.mkdirSync(out, { recursive: true });

const studio = await openStudio({ project, story, words, look: opt("look"), params, cpu: flag("cpu") });
const { fps, frames } = studio.meta;
let todo = frameList(opt("frames"), frames);
if (flag("resume") && !checkOnly) todo = todo.filter((f) => !fs.existsSync(path.join(out, `f${String(f).padStart(5, "0")}.jpg`)));
console.log(`${todo.length} frame(s) of ${frames} (${(frames / fps).toFixed(1)} s, look: ${studio.meta.look}) ${checkOnly ? "→ framing check only" : `→ ${out}`}`);
const t0 = Date.now(), cuts = {}, steps = [];
for (let i = 0; i < todo.length; i++) {
  const f = todo[i];
  let rep;
  if (checkOnly) rep = await studio.check(f);
  else { fs.writeFileSync(path.join(out, `f${String(f).padStart(5, "0")}.jpg`), await studio.frame(f)); rep = await studio.report(); }
  for (const r of rep) for (const e of r.edges) (cuts[`${r.id} (${e})`] ??= []).push(f);
  for (const s of await studio.steps()) steps.push({ ...s, t: +(s.f / fps).toFixed(3) });
  if ((i + 1) % 60 === 0 || i + 1 === todo.length) { const per = (Date.now() - t0) / 1000 / (i + 1); console.log(`  ${i + 1}/${todo.length} · ${per.toFixed(2)} s/frame · ~${(per * (todo.length - i - 1) / 60).toFixed(1)} min left`); }
}
await studio.close();

// framing summary as frame ranges
const step = todo.length > 1 ? Math.min(...todo.slice(1).map((f, i) => f - todo[i])) : 1;
const ranges = (list) => { const r = []; for (const f of list) { const last = r.at(-1); if (last && f - last[1] <= step) last[1] = f; else r.push([f, f]); } return r.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)); };
const summary = Object.fromEntries(Object.entries(cuts).map(([k, v]) => [k, ranges(v)]));
if (project) {
  fs.mkdirSync(path.join(project, "work"), { recursive: true }); fs.writeFileSync(path.join(project, "work", "framing.json"), JSON.stringify(summary, null, 1));
  // foot contacts need every frame in order; only a full pass writes them
  if (todo.length === frames && step === 1) { fs.writeFileSync(path.join(project, "work", "steps.json"), JSON.stringify(steps)); console.log(`steps: ${steps.length} foot contacts → work/steps.json`); }
}
if (Object.keys(summary).length) {
  console.log("FRAMING: (left/right/top = cut by the frame edge; caption = the caption sits on a face; prop = card cuts into an object; hidden = behind an object)");
  console.log("  fix the camera (S.fit) or the positions; mark a real entrance/exit with edgeOk: true");
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: frames ${v.join(", ")}`);
}
else console.log("framing: no character is cut by the frame edge, no caption on a face");
