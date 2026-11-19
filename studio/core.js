// Studio core: one Three.js scene rendered frame by frame into a 1080x1920 picture.
// A story module exports `config`, `setup(S)` (build the world once) and `shot(f, S)` (describe frame f).
// shot(f) returns { camera:{pos,target,fov}, light, actors:[{id,pos,state,flip,scale}], effects:[...],
//                   caption: true|false|"text", flash 0..1, fade 0..1, overlay(g,w,h) }
import * as THREE from "three";
import { drawFigure, cardSize, CARD_PAD, FIGURE_HEIGHT, strideFor } from "./figure.js";
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
  // walking along a path: keys [{ f, v:[x,y,z], pass }] (repeat a point to stand still for a while; pass: true = a corner
  // walked through without slowing down — give each segment frames in proportion to its length so the speed matches).
  // Constant speed per segment with a short ease at start and stop. The step phase comes from the distance covered,
  // so a planted foot keeps its spot on the ground; the stride comes from the character's build (`who`) and `scale`.
  // The body settles into / out of a standing pose over a few frames when the walker starts or stops.
  // view "auto": profile when the path crosses the picture, front/back when it goes toward/away from the camera.
  // Natural pace: walk 1.0–1.4 m/s (30–42 frames for 1.3 m at scale 1), run 2.5–4 m/s.
  S.walk = (f, keys, { who, scale = 1, run = false, stride, ease: e = 6, settle: settleFrames = 7 } = {}) => {
    const at = (t) => {
      if (t <= keys[0].f) return keys[0].v;
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (t <= b.f) {
          // speed up over `wi`, slow down over `wo` (share of the segment); a key with pass: true is walked through at full speed
          const n = Math.max(1, b.f - a.f), u = S.clamp((t - a.f) / n);
          const wi = i > 0 && a.pass ? 0 : Math.min(0.5, e / n), wo = b.pass ? 0 : Math.min(0.5, e / n), v = 1 / (1 - wi / 2 - wo / 2);
          const s2 = u < wi ? (v * u * u) / (2 * wi) : u > 1 - wo ? 1 - (v * (1 - u) * (1 - u)) / (2 * wo) : v * (u - wi / 2);
          return a.v.map((x, j) => x + (b.v[j] - x) * s2); }
      }
      return keys.at(-1).v;
    };
    const build = who ? S.actors.get(who)?.spec.build : undefined;
    const cycle = stride ?? strideFor(build, run) * scale;               // world metres per full step cycle
    const step = (t) => { const a = at(t - 1), b = at(t); return Math.hypot(b[0] - a[0], b[2] - a[2]); };
    let dist = 0, startMove = null, lastMove = null, lastDist = 0, lastDir = [1, 0];
    for (let t = keys[0].f + 1; t <= f; t++) {
      const d = step(t);
      if (d > 0.0015) { if (startMove === null || lastMove !== t - 1) startMove = t; lastMove = t; const a = at(t - 1), b = at(t); lastDir = [b[0] - a[0], b[2] - a[2]]; }
      dist += d; if (lastMove === t) lastDist = dist;
    }
    const pos = at(f), legs = run ? "run" : "walk";
    const state = (phaseDist, settle) => ({ legs, phase: phaseDist / cycle, stride: cycle / scale, view: "auto", settle });
    if (lastMove === f && f > keys[0].f)                                 // moving now
      return { pos, dir: lastDir, moving: true, state: state(dist, S.clamp(1 - (f - startMove) / settleFrames)) };
    if (lastMove !== null && f - lastMove < settleFrames)                // just stopped: settle into a stand
      return { pos, dir: lastDir, moving: false, state: state(lastDist, (f - lastMove) / settleFrames) };
    // standing (before the first step or after the last): keep facing the way of the walk, no sudden turn.
    // To face the camera, the story overrides with view: "front".
    let dir = lastDir;
    if (lastMove === null) { const i = keys.findIndex((k, j) => j > 0 && Math.hypot(k.v[0] - keys[j - 1].v[0], k.v[2] - keys[j - 1].v[2]) > 0.01);
      dir = i > 0 ? [keys[i].v[0] - keys[i - 1].v[0], keys[i].v[2] - keys[i - 1].v[2]] : null; }
    return { pos, dir, moving: false, state: dir ? { legs: "stand", view: "auto" } : { legs: "stand" } };
  };

  // ---- placement: a camera that keeps every listed figure whole inside the picture
  // who: list of [x,y,z] or { pos, scale, build, crop } (crop: share of the figure height that may be cut at the bottom,
  // e.g. 0.45 for a waist-up shot). from: direction from the group to the camera ([0, 0.3, 1] = in front, a bit above).
  // pad: free margin at the edges (0.1 = 10 %). Returns { pos, target, fov } for shot().camera or S.cam keys.
  // bounds: [[x0,y0,z0],[x1,y1,z1]] — the camera must stay inside this box (a room). When the room is too small to
  // step back far enough, the lens gets wider instead (up to 100°), so nobody is cut and the camera never ends up
  // behind a wall.
  S.fit = (who, { from = [0, 0.3, 1], fov = 36, pad = 0.1, crop = 0, minDist = 1.5, bounds = null } = {}) => {
    const V = (a) => new THREE.Vector3(...a);
    const back = V(from).normalize(), fw = back.clone().negate();
    const right = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fw).normalize();
    const pts = [];
    for (const w of who) {
      const o = Array.isArray(w) ? { pos: w } : w, sc = o.scale ?? 1, h = (FIGURE_HEIGHT(o.build) + 0.12) * sc, r = 0.42 * sc;
      const y0 = h * (o.crop ?? crop);
      for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [y0, h]) pts.push(V(o.pos).add(new THREE.Vector3(dx, y, dz)));
    }
    const solve = (lens) => {
      const tanV = Math.tan((lens / 2) * Math.PI / 180) * (1 - pad), tanH = tanV * (width / height);
      let target = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length), d = minDist;
      for (let pass = 0; pass < 3; pass++) {
        d = minDist;
        for (const q of pts) { const rel = q.clone().sub(target), z = rel.dot(fw); d = Math.max(d, Math.abs(rel.dot(right)) / tanH - z, Math.abs(rel.dot(up)) / tanV - z); }
        // re-centre: shift the target so the projected extents sit symmetric in the picture
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const q of pts) { const rel = q.clone().sub(target), z = d + rel.dot(fw), sx = rel.dot(right) / z, sy = rel.dot(up) / z; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
        target.addScaledVector(right, ((x0 + x1) / 2) * d).addScaledVector(up, ((y0 + y1) / 2) * d);
      }
      return { target, d };
    };
    // how far the camera can step back from the target before it leaves the bounds
    const room = (target) => {
      if (!bounds) return Infinity;
      let t = Infinity;
      for (let i = 0; i < 3; i++) { const b = back.getComponent(i), p = target.getComponent(i); if (Math.abs(b) > 1e-6) t = Math.min(t, ((b > 0 ? bounds[1][i] : bounds[0][i]) - p) / b); }
      return Math.max(0.3, t - 0.05);
    };
    let lens = fov, s = solve(lens);
    while (s.d > room(s.target) && lens < 100) { lens += 2; s = solve(lens); }
    const d = Math.min(s.d, room(s.target));
    return { pos: s.target.clone().addScaledVector(back, d).toArray(), target: s.target.toArray(), fov: lens };
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
    const [c, g] = makeCanvas(res / 2, res, { cpu: true });
    const tex = toTexture(c);
    const size = cardSize(spec.build), wid = size / 2;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: true, side: THREE.DoubleSide, fog: true });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(wid, size), mat);
    card.position.y = size / 2 - CARD_PAD;
    const shadowTex = radialShadow();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.36), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.45 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015;
    const root = new THREE.Group(); root.add(card, shadow); root.visible = false; root.userData.noCollide = true; scene.add(root);
    const a = { id, spec, c, g, tex, card, shadow, root, mat };
    S.actors.set(id, a);
    return a;
  };

  // ---- effects pool (billboards)
  const fxPool = [];
  const fxCard = (i) => {
    if (fxPool[i]) return fxPool[i];
    const [c, g] = makeCanvas(256, 256, { cpu: true }), tex = toTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true }));
    m.renderOrder = 10; m.userData.noCollide = true; scene.add(m);
    return (fxPool[i] = { c, g, tex, m });
  };

  await story.setup(S);

  // ---- solid props (boxes of the world meshes), for the "inside a prop" check and S.floor
  let solidCache = null;
  const solids = () => {
    if (solidCache) return solidCache;
    scene.updateMatrixWorld(true);
    solidCache = [];
    const walk = (o) => {
      if (o.userData.noCollide) return;
      if (o.isMesh && o.geometry) {
        const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3());
        if (b.min.y < 1.6 && Math.min(sz.x, sz.y, sz.z) > 0.03) solidCache.push(b);
      }
      o.children.forEach(walk);
    };
    walk(scene);
    return solidCache;
  };
  S.refreshSolids = () => { solidCache = null; };   // call after moving props in setup-time code
  // height of the walkable top under (x, z): 0 on the ground, 0.15 on a sidewalk, the top of a low platform
  S.floor = (x, z) => { let y = 0; for (const b of solids()) if (b.max.y <= 0.6 && x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) y = Math.max(y, b.max.y); return y; };

  // ---- one frame
  const stepMemo = new Map();
  S.render = (f) => {
    const sh = story.shot(f, S) ?? {};
    S.light(sh.light ?? "day");
    const L = sh.camera ?? { pos: [0, 1.6, 6], target: [0, 1.4, 0], fov: 40 };
    camera.position.set(...L.pos); camera.lookAt(...L.target); camera.fov = L.fov ?? 40; camera.updateProjectionMatrix();
    camera.updateMatrixWorld();   // this frame's camera, so facing and the framing check never use the previous one
    sun.position.copy(new THREE.Vector3(...L.target).add(S.sunDir.clone().multiplyScalar(30))); sun.target.position.set(...L.target);

    const cap = sh.caption === undefined || sh.caption === true ? currentWord(S, f) : sh.caption;
    let capBox = null;                                        // caption area in NDC, to warn when it covers a face
    if (cap) { og.font = `600 ${Math.round(width * 0.085)}px Fredoka`; const hw = og.measureText(cap.text ?? cap).width / width + 0.05;
      capBox = { x0: -hw, x1: hw, y0: 1 - 2 * 0.675, y1: 1 - 2 * 0.605 }; }
    const seen = new Set(), report = [];
    const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const camFwd = new THREE.Vector3(); camera.getWorldDirection(camFwd);
    for (const it of sh.actors ?? []) {
      const a = S.actors.get(it.id); if (!a) continue;
      seen.add(it.id);
      let state = it.state ?? {}, flip = it.flip;
      if (state.view === "auto") {                            // pick the view from the walking direction and this camera
        const d = it.dir ?? [1, 0], n = Math.hypot(d[0], d[1]) || 1;
        const across = (d[0] * camRight.x + d[1] * camRight.z) / n, away = (d[0] * camFwd.x + d[1] * camFwd.z) / n;
        // profile reads best; front/back only when the path points almost straight at / away from the camera (< ~20°)
        state = { ...state, view: Math.abs(across) >= 0.34 ? "side" : away > 0 ? "back" : "front" };
      }
      // a walker in profile faces the way it moves, as seen from this camera
      if (flip === undefined && it.dir && state.view === "side") flip = it.dir[0] * camRight.x + it.dir[1] * camRight.z < 0;
      a.g.clearRect(0, 0, a.c.width, a.c.height);
      const info = drawFigure(a.g, a.c.width, a.c.height, a.spec, { t: f, ...state }, S.look);
      a.tex.needsUpdate = true;
      a.root.visible = true;
      a.root.position.set(...it.pos);
      const sc = it.scale ?? 1; a.root.scale.set(sc, sc, sc);
      a.card.scale.x = flip ? -1 : 1;
      a.card.rotation.y = Math.atan2(camera.position.x - it.pos[0], camera.position.z - it.pos[2]) - (it.yaw ?? 0);
      a.mat.color.copy(S.tint).lerp(new THREE.Color("#ffffff"), 0.15);
      a.shadow.visible = it.shadow !== false;
      // framing check: is the figure partly outside the left/right/top edge? (bottom crops are normal in close-ups)
      // and is the flat card cutting into a prop (cart, wall, raised sidewalk)? `touchOk` for sitting on / leaning in.
      if (info?.ext) {
        const e = info.ext, k = flip ? -1 : 1, base = new THREE.Vector3(...it.pos);
        const at = (x, y) => base.clone().addScaledVector(camRight, x * k * sc).add(new THREE.Vector3(0, y * sc, 0)).project(camera);
        // sides measured at feet, waist and head height: with a camera looking down or up, verticals lean in the picture
        const T = at(0, e.top), B = at(0, 0.3);
        const xs = [0.3, 1.1, e.top * 0.92].flatMap((y) => [at(k > 0 ? e.minX : e.maxX, y).x, at(k > 0 ? e.maxX : e.minX, y).x]);
        const inView = Math.max(...xs) > -1 && Math.min(...xs) < 1 && T.y > -1 && B.y < 1 && T.z < 1;
        if (inView) {
          const edges = [];
          if (!it.edgeOk && Math.min(...xs) < -1) edges.push("left");
          if (!it.edgeOk && Math.max(...xs) > 1) edges.push("right");
          if (!it.edgeOk && T.y > 1) edges.push("top");
          if (!it.touchOk) {
            const th = a.card.rotation.y, ax = Math.cos(th), az = -Math.sin(th), m = 0.02;
            let hit = false;
            for (const dx of [-0.2, 0, 0.2]) for (const y of [0.1, 0.45, 0.9, 1.3]) {
              const px = it.pos[0] + ax * dx * sc, py = it.pos[1] + y * sc, pz = it.pos[2] + az * dx * sc;
              for (const b of solids()) if (px > b.min.x + m && px < b.max.x - m && py > b.min.y + m && py < b.max.y - m && pz > b.min.z + m && pz < b.max.z - m) { hit = true; break; }
            }
            if (hit) edges.push("prop");
          }
          if (!it.hiddenOk && e.head) {                       // head and chest both blocked by a prop (behind a column, a wall)
            const cam = camera.position, ray = new THREE.Ray(), hitP = new THREE.Vector3();
            const blocked = (y) => {
              const p = new THREE.Vector3(it.pos[0], it.pos[1] + y * sc, it.pos[2]), dist = p.distanceTo(cam);
              ray.set(cam, p.clone().sub(cam).normalize());
              return solids().some((b) => !b.containsPoint(cam) && ray.intersectBox(b, hitP) && hitP.distanceTo(cam) < dist - 0.3);
            };
            if (blocked(e.head[1]) && blocked(1.0)) edges.push("hidden");
          }
          if (capBox && e.head) {                             // the one-word caption sits on the face
            const hc = at(e.head[0], e.head[1]), hr = Math.abs(at(e.head[0], e.head[1] + e.head[2]).y - hc.y);
            if (hc.x > capBox.x0 && hc.x < capBox.x1 && hc.y + hr * 0.6 > capBox.y0 && hc.y - hr * 0.6 < capBox.y1) edges.push("caption");
          }
          if (edges.length) report.push({ id: it.id, edges });
        }
      }
    }
    for (const [id, a] of S.actors) if (!seen.has(id)) a.root.visible = false;
    S.lastReport = report;
    // foot contacts of visible walkers (phase crosses a half cycle) → render --check writes work/steps.json for the sound
    S.lastSteps = [];
    for (const it of sh.actors ?? []) {
      const st = it.state ?? {}, walking = (st.legs === "walk" || st.legs === "run") && (st.settle ?? 0) < 0.6;
      const idx = walking ? Math.floor((st.phase ?? 0) * 2) : null, prev = stepMemo.get(it.id);
      const p = new THREE.Vector3(...it.pos).project(camera), visible = p.z < 1 && Math.abs(p.x) < 1.05 && p.y > -1.1 && p.y < 1;
      if (walking && prev && prev.f === f - 1 && prev.idx !== null && prev.idx !== idx && visible) S.lastSteps.push({ id: it.id, f, run: st.legs === "run" });
      stepMemo.set(it.id, { f, idx });
    }

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
