#!/usr/bin/env node
// Start a new short:  node tools/new.mjs <project folder>
// Creates story.js (starter), script.txt, sound.json and work/. Put the narration in the folder as voice.mp3.
import fs from "node:fs";
import path from "node:path";
import { SKILL } from "./lib.mjs";

const dst = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) { console.log("usage: node tools/new.mjs <project folder>"); process.exit(1); }
if (fs.existsSync(path.join(dst, "story.js"))) { console.log(`${dst} already has a story.js; nothing changed.`); process.exit(0); }
fs.mkdirSync(path.join(dst, "work"), { recursive: true });
fs.copyFileSync(path.join(SKILL, "templates", "story.js"), path.join(dst, "story.js"));
fs.writeFileSync(path.join(dst, "script.txt"), "");
fs.writeFileSync(path.join(dst, "sound.json"), JSON.stringify({ voice: "voice.mp3", music: { mood: "playful", level: -17, sting: true }, sfx: [], tail: 0.8 }, null, 2));
console.log(`new short: ${dst}
  1. script.txt  ← the exact text that is read
  2. voice.mp3   ← the narration
  3. uv run "${path.join(SKILL, "tools", "timing.py")}" "${dst}"
  4. node "${path.join(SKILL, "tools", "render.mjs")}" "${dst}" --frames 0-9999:45 --out "${path.join(dst, "stills")}"   (preview)
  5. node "${path.join(SKILL, "tools", "sound.mjs")}" "${dst}"  ·  render.mjs (all frames)  ·  finish.mjs "${dst}" "Title"`);
