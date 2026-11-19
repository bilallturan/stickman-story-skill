// Procedural textures drawn on 2D canvases. Everything is seeded, so the same call always
// produces the same picture (renders are repeatable frame to frame).
import * as THREE from "three";

export function seeded(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d")];
}

export function toTexture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const hex = (h) => new THREE.Color(h);
export function shade(color, k) {   // k < 0 darker, k > 0 lighter
  const c = hex(color);
  return k < 0 ? "#" + c.clone().multiplyScalar(1 + k).getHexString() : "#" + c.clone().lerp(new THREE.Color("#ffffff"), k).getHexString();
}

// paper grain: speckles + faint fibres over whatever is already drawn
export function grain(g, w, h, seed = 1, amount = 1) {
  const r = seeded(seed);
  for (let i = 0; i < w * h * 0.0035 * amount; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.03 + r() * 0.05})` : `rgba(255,255,255,${0.05 + r() * 0.08})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  g.lineWidth = 1;
  for (let i = 0; i < 40 * amount; i++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI, l = 8 + r() * 30;
    g.strokeStyle = `rgba(90,70,50,${0.04 + r() * 0.05})`;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 6, y + Math.sin(a) * l * 0.5 + r() * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}

export function paper(color = "#efe6d2", seed = 1, repeat = [1, 1]) {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = color; g.fillRect(0, 0, 512, 512);
  grain(g, 512, 512, seed, 1.2);
  return toTexture(c, repeat);
}

export function cobble(seed = 3, repeat = [12, 12], base = "#b9a88f") {
  const [c, g] = makeCanvas(512, 512), r = seeded(seed);
  g.fillStyle = shade(base, -0.35); g.fillRect(0, 0, 512, 512);
  const rowH = 46;
  for (let row = 0; row < 512 / rowH + 1; row++) {
    let x = (row % 2) * -30;
    while (x < 540) {
      const w = 48 + r() * 30, y = row * rowH;
      g.fillStyle = shade(base, (r() - 0.5) * 0.25);
      roundRect(g, x + 3, y + 3, w - 6, rowH - 6, 12); g.fill();
      g.fillStyle = "rgba(255,255,255,.18)"; roundRect(g, x + 8, y + 6, w - 22, 8, 4); g.fill();
      x += w;
    }
  }
  grain(g, 512, 512, seed + 9, 0.8);
  return toTexture(c, repeat);
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// building front: plaster wall, a grid of windows with frames and shutters, a door, optional shop sign.
// `meters` = [width, height] of the face it is mapped onto, so windows keep their shape.
export function facade(o = {}) {
  const { wall = "#e8c98f", trim = "#fffaf0", glass = "#2f4a66", shutter = null, floors = 2, cols = 3, door = true, sign = null, seed = 7, meters = [6, 6], border = false } = o;
  const W = 512, H = Math.round(W * meters[1] / meters[0]), r = seeded(seed);
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  grain(g, W, H, seed, 1.4);
  // soft stains so walls are not flat
  for (let i = 0; i < 6; i++) {
    const x = r() * W, y = r() * H, rad = 40 + r() * 120, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(120,80,40,.07)"); gr.addColorStop(1, "rgba(120,80,40,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  const fh = H / floors, ww = W / cols * 0.42, wh = fh * 0.46;
  for (let fl = 0; fl < floors; fl++) {
    const top = H - (fl + 1) * fh;
    g.fillStyle = shade(wall, -0.12); g.fillRect(0, top + fh - 6, W, 6);   // floor line
    for (let k = 0; k < cols; k++) {
      const cx = (k + 0.5) * W / cols;
      if (fl === 0 && door && k === Math.floor(cols / 2)) continue;
      const x = cx - ww / 2, y = top + fh * 0.22;
      if (shutter) { g.fillStyle = shutter; g.fillRect(x - ww * 0.42, y, ww * 0.4, wh); g.fillRect(x + ww * 1.02, y, ww * 0.4, wh);
        g.strokeStyle = shade(shutter, -0.3); g.lineWidth = 2;
        for (let s = 1; s < 6; s++) { g.beginPath(); g.moveTo(x - ww * 0.42, y + s * wh / 6); g.lineTo(x - ww * 0.02, y + s * wh / 6); g.moveTo(x + ww * 1.02, y + s * wh / 6); g.lineTo(x + ww * 1.42, y + s * wh / 6); g.stroke(); } }
      g.fillStyle = trim; g.fillRect(x - 7, y - 7, ww + 14, wh + 14);
      const gl = g.createLinearGradient(x, y, x + ww, y + wh); gl.addColorStop(0, shade(glass, 0.15)); gl.addColorStop(1, shade(glass, -0.3));
      g.fillStyle = gl; g.fillRect(x, y, ww, wh);
      g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.moveTo(x + ww * 0.15, y + wh); g.lineTo(x + ww * 0.55, y); g.lineTo(x + ww * 0.72, y); g.lineTo(x + ww * 0.32, y + wh); g.fill();
      g.fillStyle = trim; g.fillRect(x + ww / 2 - 3, y, 6, wh); g.fillRect(x, y + wh * 0.45, ww, 5);
      g.fillStyle = shade(trim, -0.2); g.fillRect(x - 12, y + wh + 7, ww + 24, 9);   // sill
    }
  }
  if (door) {
    const dw = W / cols * 0.5, dh = fh * 0.72, dx = W / 2 - dw / 2, dy = H - dh;
    g.fillStyle = trim; roundRect(g, dx - 8, dy - 8, dw + 16, dh + 16, dw / 2); g.fill();
    g.fillStyle = "#6b4026"; roundRect(g, dx, dy, dw, dh + 8, dw / 2.2); g.fill();
    g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 3;
    for (let s = 1; s < 4; s++) { g.beginPath(); g.moveTo(dx + s * dw / 4, dy + 20); g.lineTo(dx + s * dw / 4, H); g.stroke(); }
    g.fillStyle = "#f2c14e"; g.beginPath(); g.arc(dx + dw * 0.8, dy + dh * 0.55, 5, 0, 7); g.fill();
  }
  if (sign) {
    const sw = W * 0.7, sh = Math.min(70, fh * 0.2), sx = (W - sw) / 2, sy = H - fh - sh * 0.4;
    g.fillStyle = sign.bg ?? "#2d5a3d"; roundRect(g, sx, sy, sw, sh, 8); g.fill();
    g.fillStyle = sign.fg ?? "#fff3d6"; g.font = `600 ${Math.round(sh * 0.6)}px Fredoka`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(sign.text, W / 2, sy + sh / 2 + 2, sw * 0.9);
  }
  if (border) { g.strokeStyle = "#fffdf6"; g.lineWidth = 14; g.strokeRect(7, 7, W - 14, H - 14); }
  return toTexture(c);
}

export function tiles(color = "#b5523b", seed = 5, repeat = [3, 2]) {
  const [c, g] = makeCanvas(256, 256), r = seeded(seed);
  g.fillStyle = shade(color, -0.25); g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) for (let k = -1; k < 9; k++) {
    const x = k * 32 + (row % 2) * 16, y = row * 32;
    g.fillStyle = shade(color, (r() - 0.5) * 0.2);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 32, y); g.lineTo(x + 32, y + 22); g.quadraticCurveTo(x + 16, y + 34, x, y + 22); g.closePath(); g.fill();
  }
  grain(g, 256, 256, seed, 0.6);
  return toTexture(c, repeat);
}

export function skyGradient(stops) {
  const [c, g] = makeCanvas(8, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  stops.forEach(([p, col]) => gr.addColorStop(p, col));
  g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
  const t = toTexture(c); t.anisotropy = 1; return t;
}

export function signboard(text, o = {}) {
  const { bg = "#2d5a3d", fg = "#fff3d6", w = 512, h = 160, sub = null } = o;
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = bg; roundRect(g, 4, 4, w - 8, h - 8, 18); g.fill();
  g.strokeStyle = shade(bg, -0.35); g.lineWidth = 8; roundRect(g, 4, 4, w - 8, h - 8, 18); g.stroke();
  grain(g, w, h, 11, 0.8);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `600 ${Math.round(h * (sub ? 0.42 : 0.55))}px Fredoka`; g.fillText(text, w / 2, h * (sub ? 0.4 : 0.52), w * 0.9);
  if (sub) { g.font = `500 ${Math.round(h * 0.2)}px Fredoka`; g.fillText(sub, w / 2, h * 0.76, w * 0.9); }
  return toTexture(c);
}
