// Studio core: one Three.js scene rendered frame by frame into a 1080x1920 picture.
// A story module exports `config`, `setup(S)` (build the world once) and `shot(f, S)` (describe frame f).
// shot(f) returns { camera:{pos,target,fov}, light, actors:[{id,pos,state,flip,scale}], effects:[...],
//                   caption: true|false|"text", flash 0..1, fade 0..1, overlay(g,w,h) }
import * as THREE from "three";
import { drawFigure, cardSize, CARD_PAD } from "./figure.js";
import { drawEffect } from "./effects.js";
import { makeCanvas, skyGradient, toTexture } from "./textures.js";
import * as TEX from "./textures.js";
import { buildWorldKit } from "./world.js";

export const LIGHTS = {
  day:      { sky: [[0, "#6fb6e3"], [0.55, "#b8def0"], [1, "#efe6cf"]], hemi: ["#ffffff", "#a89a82", 1.6], sun: ["#fff4e0", 2.6, [8, 14, 7]], fog: "#d9e9ee", tint: "#ffffff" },
  golden:   { sky: [[0, "#e98d4f"], [0.5, "#f5c27f"], [1, "#fbe3bd"]], hemi: ["#ffe0b5", "#7a5a3c", 1.25], sun: ["#ffb867", 3.0, [-10, 6, 8]], fog: "#f2c592", tint: "#fff0da" },
  night:    { sky: [[0, "#0b1229"], [0.6, "#202b55"], [1, "#39355a"]], hemi: ["#6070b0", "#151525", 0.8], sun: ["#a9bcff", 0.9, [6, 12, 4]], fog: "#1c2446", tint: "#b9c6ff" },
  interior: { sky: [[0, "#3a2a20"], [1, "#5a4434"]], hemi: ["#fff0d6", "#5a4838", 1.3], sun: ["#ffdcae", 1.8, [2, 6, 4]], fog: "#3a2c22", tint: "#fff3e3" },
  dramatic: { sky: [[0, "#2a0f14"], [0.6, "#7a2a22"], [1, "#d8743c"]], hemi: ["#ff9a6a", "#1a0a0a", 0.9], sun: ["#ff8a4a", 3.0, [-6, 4, 6]], fog: "#5a2420", tint: "#ffd2b8" },
};

export async function createStudio({ width = 1080, height = 1920, look = "paper", story, words = [], params = {} }) {
  const glCanvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 400);
  const hemi = new THREE.HemisphereLight("#fff", "#888", 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff", 2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 }); sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog("#ddd", 30, 140);

  const [out, og] = makeCanvas(width, height);
  const S = { THREE, scene, camera, renderer, look, width, height, fps: story.config?.fps ?? 30, words, params, actors: new Map(), refs: {} };
  Object.assign(S, buildWorldKit(S));

  // ---- lights
  const skyCache = new Map();
  let lightKey = null;
  S.light = (name) => {
    const L = typeof name === "string" ? LIGHTS[name] ?? LIGHTS.day : name;
    const key = typeof name === "string" ? name : JSON.stringify(name);
    if (key === lightKey) return L;
    lightKey = key;
    if (!skyCache.has(key)) skyCache.set(key, skyGradient(L.sky));
    scene.background = skyCache.get(key);
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; S.sunDir = new THREE.Vector3(...L.sun[2]).normalize();
    scene.fog.color.set(L.fog);
    S.tint = new THREE.Color(L.tint);
    return L;
  };

  // ---- camera helpers: keyframes [{f, pos, target, fov}], eased; plus a slow breathing drift
  const ease = (t) => t * t * (3 - 2 * t);
  S.cam = (f, keys, drift = 1) => {
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) if (f >= keys[i].f && f <= keys[i + 1].f) { a = keys[i]; b = keys[i + 1]; break; }
    const t = b.f === a.f ? 1 : ease(Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f))));
    const mix = (p, q) => p.map((v, i) => v + (q[i] - v) * t);
    const w = f / S.fps;
    const pos = mix(a.pos, b.pos).map((v, i) => v + drift * [Math.sin(w * 0.7) * 0.05, Math.sin(w * 0.9) * 0.03, Math.cos(w * 0.6) * 0.05][i]);
    return { pos, target: mix(a.target, b.target), fov: (a.fov ?? 40) + ((b.fov ?? a.fov ?? 40) - (a.fov ?? 40)) * t };
  };
  // ---- timing helpers (frames). words.json: [{ w, start, end, p }] where p is the punctuation after the word
  S.tex = TEX;
  S.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  S.ease = ease;
  S.span = (f, f0, f1) => ease(S.clamp((f - f0) / Math.max(1, f1 - f0)));          // eased 0..1 between two frames
  S.track = (f, keys) => {                                                          // keys: [{ f, v:[...] }] → eased vector
    if (f <= keys[0].f) return keys[0].v;
    for (let i = 0; i < keys.length - 1; i++) if (f <= keys[i + 1].f) { const t = S.span(f, keys[i].f, keys[i + 1].f); return keys[i].v.map((x, j) => x + (keys[i + 1].v[j] - x) * t); }
    return keys.at(-1).v;
  };
  S.pick = (f, list) => { let cur = list[0]; for (const s of list) if (f >= s.from) cur = s; return cur; };   // active entry of [{ from, ... }]
  S.sentences = [];
  { let cur = null;
    S.words.forEach((w, i) => {
      if (!cur) cur = { from: Math.round(w.start * S.fps), first: i, text: [] };
      cur.text.push(w.w);
      if (/[.!?…]/.test(w.p ?? "") || i === S.words.length - 1) { S.sentences.push({ ...cur, to: Math.round(w.end * S.fps), last: i, text: cur.text.join(" ") }); cur = null; }
    }); }
  S.wordAt = (text, from = 0) => { const k = S.words.findIndex((w, i) => i >= from && norm(w.w) === norm(text)); return k < 0 ? null : Math.round(S.words[k].start * S.fps); };
  S.wordFrame = (i) => (S.words[i] ? Math.round(S.words[i].start * S.fps) : null);
  S.blink = (f, seed = 1) => { const p = (f + seed * 37) % (95 + (seed * 13) % 40); return p < 3 ? [0.5, 1, 0.5][p] : 0; };
  S.talking = (f, f0, f1) => (f >= f0 && f <= f1 ? Math.abs(Math.sin(f * 0.9)) * 0.8 + 0.1 : 0);
  S.idle = (f, seed = 1) => ({ headTilt: Math.sin(f / 23 + seed) * 3, lean: Math.sin(f / 31 + seed * 2) * 0.08 });

  // ---- actors: a camera-facing card per character, redrawn every frame
  S.actor = (id, spec = {}, { res = 1024 } = {}) => {
    const [c, g] = makeCanvas(res / 2, res);
    const tex = toTexture(c);
    const size = cardSize(spec.build), wid = size / 2;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: true, side: THREE.DoubleSide, fog: true });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(wid, size), mat);
    card.position.y = size / 2 - CARD_PAD;
    const shadowTex = radialShadow();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.36), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.45 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015;
    const root = new THREE.Group(); root.add(card, shadow); root.visible = false; scene.add(root);
    const a = { id, spec, c, g, tex, card, shadow, root, mat };
    S.actors.set(id, a);
    return a;
  };

  // ---- effects pool (billboards)
  const fxPool = [];
  const fxCard = (i) => {
    if (fxPool[i]) return fxPool[i];
    const [c, g] = makeCanvas(256, 256), tex = toTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true }));
    m.renderOrder = 10; scene.add(m);
    return (fxPool[i] = { c, g, tex, m });
  };

  await story.setup(S);

  // ---- one frame
  S.render = (f) => {
    const sh = story.shot(f, S) ?? {};
    S.light(sh.light ?? "day");
    const L = sh.camera ?? { pos: [0, 1.6, 6], target: [0, 1.4, 0], fov: 40 };
    camera.position.set(...L.pos); camera.lookAt(...L.target); camera.fov = L.fov ?? 40; camera.updateProjectionMatrix();
    sun.position.copy(new THREE.Vector3(...L.target).add(S.sunDir.clone().multiplyScalar(30))); sun.target.position.set(...L.target);

    const seen = new Set();
    for (const it of sh.actors ?? []) {
      const a = S.actors.get(it.id); if (!a) continue;
      seen.add(it.id);
      a.g.clearRect(0, 0, a.c.width, a.c.height);
      drawFigure(a.g, a.c.width, a.c.height, a.spec, { t: f, ...it.state }, S.look);
      a.tex.needsUpdate = true;
      a.root.visible = true;
      a.root.position.set(...it.pos);
      const sc = it.scale ?? 1; a.root.scale.set(sc, sc, sc);
      a.card.scale.x = it.flip ? -1 : 1;
      a.card.rotation.y = Math.atan2(camera.position.x - it.pos[0], camera.position.z - it.pos[2]) - (it.yaw ?? 0);
      a.mat.color.copy(S.tint).lerp(new THREE.Color("#ffffff"), 0.15);
      a.shadow.visible = it.shadow !== false;
    }
    for (const [id, a] of S.actors) if (!seen.has(id)) a.root.visible = false;

    (sh.effects ?? []).forEach((e, i) => {
      const p = fxCard(i); p.g.clearRect(0, 0, 256, 256);
      drawEffect(p.g, 256, e.kind, e.t ?? (f / S.fps) % 1, e);
      p.tex.needsUpdate = true; p.m.visible = true;
      p.m.position.set(...e.pos); const s = e.size ?? 0.6; p.m.scale.set(s, s, s);
      p.m.quaternion.copy(camera.quaternion);
    });
    for (let i = (sh.effects ?? []).length; i < fxPool.length; i++) fxPool[i].m.visible = false;

    sh.before?.(f, S);
    renderer.render(scene, camera);

    // ---- 2D finish: picture, vignette, caption, flash/fade, custom overlay
    og.drawImage(glCanvas, 0, 0, width, height);
    const vg = og.createRadialGradient(width / 2, height * 0.48, height * 0.3, width / 2, height * 0.5, height * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(20,10,5,${S.look === "paper" ? 0.38 : 0.28})`);
    og.fillStyle = vg; og.fillRect(0, 0, width, height);
    if (S.look === "paper") paperOverlay(og, width, height);
    sh.overlay?.(og, width, height, f);
    const cap = sh.caption === undefined || sh.caption === true ? currentWord(S, f) : sh.caption;
    if (cap) drawCaption(og, width, height, cap.text ?? cap, cap.age ?? 99);
    if (sh.flash) { og.fillStyle = `rgba(255,255,255,${sh.flash})`; og.fillRect(0, 0, width, height); }
    if (sh.fade) { og.fillStyle = `rgba(0,0,0,${sh.fade})`; og.fillRect(0, 0, width, height); }
    return out;
  };
  return S;
}

const norm = (s) => String(s).toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]/gu, "");

function currentWord(S, f) {
  const t = f / S.fps;
  for (let i = 0; i < S.words.length; i++) {
    const w = S.words[i], next = S.words[i + 1];
    if (t >= w.start - 0.03 && t < (next ? Math.min(next.start - 0.03, w.end + 0.6) : w.end + 0.6)) return { text: w.w, age: t - w.start };
  }
  return null;
}

// single word in the middle of the lower half; a quick pop when it changes
function drawCaption(g, W, H, text, age) {
  const size = Math.round(W * 0.085), pop = age < 0.12 ? 0.85 + (age / 0.12) * 0.15 : 1;
  g.save(); g.translate(W / 2, H * 0.64); g.scale(pop, pop);
  g.font = `600 ${size}px Fredoka`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = size * 0.2; g.strokeStyle = "#1b1b1b"; g.strokeText(text, 0, 0);
  g.fillStyle = "#ffffff"; g.fillText(text, 0, 0);
  g.restore();
}

let grainCanvas = null;
function paperOverlay(g, W, H) {   // faint paper fibres over the whole picture
  if (!grainCanvas) {
    const [c, x] = makeCanvas(W, H);
    for (let i = 0; i < W * H * 0.002; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.035)" : "rgba(255,255,255,.05)"; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    grainCanvas = c;
  }
  g.drawImage(grainCanvas, 0, 0);
}

function radialShadow() {
  // a round blur; the plane it sits on is wide and flat, which turns it into an ellipse
  const [c, g] = makeCanvas(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,.8)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
