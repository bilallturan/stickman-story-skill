// World kit: ready-made pieces for building a set. Units are metres, y is up, the camera usually looks toward -z.
// The same calls work in both looks: "ink" gets toon shading with black outlines, "paper" gets soft matte card.
import * as THREE from "three";
import { cobble, facade, paper, seeded, shade, signboard, tiles, makeCanvas, toTexture } from "./textures.js";

export function buildWorldKit(S) {
  const { scene, look } = S;
  const ink = look === "ink";
  const steps = new Uint8Array([90, 170, 255]);
  const ramp = new THREE.DataTexture(steps, 3, 1, THREE.RedFormat); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const outlineMat = new THREE.MeshBasicMaterial({ color: "#1b1b1b", side: THREE.BackSide });

  const mat = (color = "#ffffff", o = {}) => {
    const p = { color, map: o.map ?? null, transparent: !!o.transparent, side: o.side ?? THREE.FrontSide };
    if (o.glow) return new THREE.MeshBasicMaterial({ ...p, color: o.glow });
    return ink ? new THREE.MeshToonMaterial({ ...p, gradientMap: ramp }) : new THREE.MeshLambertMaterial(p);
  };
  const outline = (mesh, k = 0.04) => {
    if (!ink) return mesh;
    const o = new THREE.Mesh(mesh.geometry, outlineMat);
    const s = mesh.geometry.boundingSphere ?? (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere);
    const f = 1 + k / Math.max(0.2, s.radius);
    o.scale.setScalar(f); mesh.add(o);
    return mesh;
  };
  const place = (mesh, at = [0, 0, 0], { rot = 0, parent = scene, shadow = true } = {}) => {
    mesh.position.set(...at); mesh.rotation.y = rot;
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };

  const K = {};
  K.mat = mat;
  K.outline = outline;
  K.group = (at = [0, 0, 0], rot = 0, parent = scene) => { const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rot; parent.add(g); return g; };

  // primitives: y of `at` is the base (bottom) of the shape
  K.box = (w, h, d, m, at = [0, 0, 0], o = {}) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Array.isArray(m) ? m : typeof m === "string" ? mat(m) : m); mesh.geometry.translate(0, h / 2, 0); if (o.outline !== false) outline(mesh); return place(mesh, at, o); };
  K.cyl = (rt, rb, h, m, at = [0, 0, 0], o = {}) => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 16), typeof m === "string" ? mat(m) : m); mesh.geometry.translate(0, h / 2, 0); if (o.outline !== false) outline(mesh); return place(mesh, at, o); };
  K.ball = (r, m, at = [0, 0, 0], o = {}) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), typeof m === "string" ? mat(m) : m); if (o.squash) mesh.scale.set(...o.squash); if (o.outline !== false) outline(mesh); return place(mesh, at, o); };
  K.cone = (r, h, m, at = [0, 0, 0], o = {}) => { const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg ?? 12), typeof m === "string" ? mat(m) : m); mesh.geometry.translate(0, h / 2, 0); if (o.outline !== false) outline(mesh); return place(mesh, at, o); };
  K.card = (w, h, m, at = [0, 0, 0], o = {}) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), typeof m === "string" ? mat(m, { side: THREE.DoubleSide }) : m); mesh.geometry.translate(0, h / 2, 0); return place(mesh, at, { ...o, shadow: o.shadow ?? true }); };

  K.ground = (texture, size = 300, color = "#ffffff") => {
    const m = mat(color, { map: texture });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
    mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  };

  // a building: facade on the front (+z) face, plaster sides, gable or flat roof
  K.building = (x, z, o = {}) => {
    const { w = 6, d = 5, floors = 2, wall = "#e8c98f", roof = "#b5523b", rot = 0, sign = null, shutter = null, flat = false, seed = (x * 7 + z * 13) | 0, glass, trim } = o;
    const h = floors * 3.1;
    const r = seeded(seed + 101);
    const front = facade({ wall, floors, cols: Math.max(2, Math.round(w / 2.1)), sign, shutter, seed, meters: [w, h], glass, trim, border: !ink });
    const back = facade({ wall, floors, cols: Math.max(2, Math.round(w / 2.1)), door: false, seed: seed + 3, meters: [w, h], glass, trim, border: !ink });
    const side = facade({ wall, floors, cols: Math.max(1, Math.round(d / 2.6)), door: false, seed: seed + 5, meters: [d, h], glass, trim, border: !ink });
    const mats = [mat("#fff", { map: side }), mat("#fff", { map: side }), mat(shade(wall, -0.15)), mat(shade(wall, -0.2)), mat("#fff", { map: front }), mat("#fff", { map: back })];
    const g = K.group([x, 0, z], rot);
    K.box(w, h, d, mats, [0, 0, 0], { parent: g });
    if (flat) { K.box(w + 0.3, 0.35, d + 0.3, shade(wall, -0.25), [0, h, 0], { parent: g }); }
    else {
      const roofH = Math.min(2.4, d * 0.45);
      const shape = new THREE.Shape(); shape.moveTo(-d / 2 - 0.35, 0); shape.lineTo(0, roofH); shape.lineTo(d / 2 + 0.35, 0); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.5, bevelEnabled: false }); geo.translate(0, 0, -(w + 0.5) / 2);
      const mesh = new THREE.Mesh(geo, mat("#fff", { map: tiles(roof, seed, [w / 2, 2]) }));
      mesh.rotation.y = Math.PI / 2; mesh.position.y = h; mesh.castShadow = true; outline(mesh, 0.05); g.add(mesh);
      if (r() < 0.7) K.box(0.6, 1.2, 0.6, shade(roof, -0.2), [w * 0.25 * (r() < 0.5 ? -1 : 1), h + roofH * 0.35, d * 0.15], { parent: g });
    }
    return g;
  };

  // a row of varied buildings along x, fronts facing +z (or -z with rot = Math.PI)
  const WALLS = ["#e8c98f", "#d9a38a", "#c9d4b0", "#e7d6b8", "#b9cbd8", "#efc6a0", "#d8b4c7", "#cfc09a"];
  const ROOFS = ["#b5523b", "#8f4a36", "#6d5a4a", "#a8623e", "#5f6f7a"];
  K.row = (x0, x1, z, { seed = 1, rot = 0, floors = [2, 3] } = {}) => {
    const r = seeded(seed); let x = x0;
    while (x < x1) {
      const w = 4.5 + r() * 3;
      K.building(x + w / 2, z, { w, d: 5 + r() * 2, floors: floors[0] + Math.floor(r() * (floors[1] - floors[0] + 1)), wall: WALLS[Math.floor(r() * WALLS.length)], roof: ROOFS[Math.floor(r() * ROOFS.length)], rot, shutter: r() < 0.5 ? ["#4f7a5a", "#3f5f7f", "#8a4a3a"][Math.floor(r() * 3)] : null, seed: Math.floor(r() * 1000) });
      x += w + 0.2;
    }
  };

  K.street = ({ len = 120, width = 7, z = 0 } = {}) => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(len, width), mat("#fff", { map: cobble(4, [len / 4, width / 4]) }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, z); road.receiveShadow = true; scene.add(road);
    for (const s of [-1, 1]) K.box(len, 0.15, 1.6, mat("#fff", { map: paper("#cfc2a8", 21, [len / 3, 1]) }), [0, 0, z + s * (width / 2 + 0.8)], { outline: false });
  };

  K.lamp = (x, z, { on = false } = {}) => {
    const g = K.group([x, 0, z]);
    K.cyl(0.06, 0.09, 3.2, "#2c2f33", [0, 0, 0], { parent: g });
    K.box(0.42, 0.5, 0.42, "#2c2f33", [0, 3.2, 0], { parent: g });
    K.box(0.3, 0.36, 0.3, mat("#fff", { glow: on ? "#ffd36b" : "#e9e4d0" }), [0, 3.27, 0], { parent: g, outline: false, shadow: false });
    K.cone(0.32, 0.25, "#2c2f33", [0, 3.7, 0], { parent: g, seg: 4 });
    if (on) { const l = new THREE.PointLight("#ffcf7a", 6, 8, 1.6); l.position.set(0, 3.3, 0); g.add(l); }
    return g;
  };

  K.tree = (x, z, { s = 1, type = "round", color } = {}) => {
    const g = K.group([x, 0, z]); g.scale.setScalar(s);
    K.cyl(0.14, 0.2, 1.6, "#7a5236", [0, 0, 0], { parent: g });
    const leaf = color ?? (type === "pine" ? "#3f6e4a" : "#5f9a52");
    if (type === "pine") { [0, 1, 2].forEach((i) => K.cone(1.1 - i * 0.25, 1.4, leaf, [0, 1.3 + i * 0.75, 0], { parent: g })); }
    else { K.ball(1.05, leaf, [0, 2.5, 0], { parent: g }); K.ball(0.7, shade(leaf, 0.1), [0.55, 2.2, 0.35], { parent: g }); K.ball(0.65, shade(leaf, -0.08), [-0.6, 2.25, 0.2], { parent: g }); }
    return g;
  };

  K.bush = (x, z, s = 1, color = "#5f9a52") => K.ball(0.55 * s, color, [x, 0.35 * s, z], { squash: [1.3, 0.8, 1] });
  K.cloud = (x, y, z, s = 1) => { const g = K.group([x, y, z]); g.scale.setScalar(s); [[0, 0, 0, 1.2], [1.2, -0.2, 0, 0.9], [-1.2, -0.25, 0, 0.85], [0.5, 0.45, 0, 0.8]].forEach(([a, b, c, r]) => K.ball(r, mat("#ffffff"), [a, b, c], { parent: g, outline: false, shadow: false, squash: [1.2, 0.8, 0.8] })); return g; };
  K.hills = (z = -70, color = "#8fb47a") => { for (let i = -3; i <= 3; i++) K.ball(18 + (i % 2) * 6, shade(color, (i % 3) * 0.06), [i * 26, -8, z - Math.abs(i) * 4], { outline: false, shadow: false, squash: [1.4, 0.7, 1] }); };
  K.sign = (text, w, h, at, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: signboard(text, o), side: THREE.DoubleSide })); m.position.set(...at); m.rotation.y = o.rot ?? 0; m.castShadow = true; scene.add(m); return m; };
  K.fence = (x0, x1, z, color = "#e8dcc4") => { for (let x = x0; x <= x1; x += 0.6) K.box(0.12, 0.9, 0.08, color, [x, 0, z], { outline: true }); K.box(x1 - x0, 0.1, 0.06, color, [(x0 + x1) / 2, 0.65, z]); };
  K.bench = (x, z, rot = 0) => { const g = K.group([x, 0, z], rot); K.box(1.6, 0.08, 0.45, "#9a6a43", [0, 0.45, 0], { parent: g }); K.box(1.6, 0.4, 0.06, "#9a6a43", [0, 0.6, -0.2], { parent: g }); [-0.7, 0.7].forEach((a) => K.box(0.08, 0.45, 0.4, "#2c2f33", [a, 0, 0], { parent: g })); return g; };
  K.crate = (x, z, s = 0.7) => K.box(s, s, s, mat("#fff", { map: woodTex() }), [x, 0, z]);
  K.barrel = (x, z) => K.cyl(0.38, 0.33, 0.95, "#8a5a36", [x, 0, z]);

  // interior room: floor, three walls (front open toward +z), optional window
  K.room = ({ w = 8, d = 6, h = 3.2, wall = "#e9d8b8", floor = "#a0714a", at = [0, 0, 0], window = true } = {}) => {
    const g = K.group(at);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat("#fff", { map: woodFloor(floor) })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; g.add(fl);
    const wm = mat("#fff", { map: paper(wall, 31, [w / 3, h / 3]) });
    K.box(w, h, 0.2, wm, [0, 0, -d / 2], { parent: g, outline: false });
    K.box(0.2, h, d, wm, [-w / 2, 0, 0], { parent: g, outline: false });
    K.box(0.2, h, d, wm, [w / 2, 0, 0], { parent: g, outline: false });
    K.box(w, 0.18, 0.06, shade(wall, -0.3), [0, 0.9, -d / 2 + 0.12], { parent: g, outline: false });
    if (window) { K.box(1.6, 1.3, 0.05, mat("#fff", { glow: "#bfe3f2" }), [w * 0.2, 1.3, -d / 2 + 0.13], { parent: g, outline: false, shadow: false }); K.box(1.8, 0.1, 0.1, "#fffaf0", [w * 0.2, 1.25, -d / 2 + 0.16], { parent: g }); }
    return g;
  };

  function woodTex() { const [c, g] = makeCanvas(128, 128); g.fillStyle = "#b07a4a"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#6e4528"; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122); g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.stroke(); return toTexture(c); }
  function woodFloor(color) { const [c, g] = makeCanvas(256, 256), r = seeded(9); for (let i = 0; i < 8; i++) { g.fillStyle = shade(color, (r() - 0.5) * 0.2); g.fillRect(0, i * 32, 256, 31); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, i * 32 + 31, 256, 1); } return toTexture(c, [3, 3]); }

  return K;
}
