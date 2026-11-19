// The stickman: drawn with the 2D canvas API onto a texture, then shown as a camera-facing card in the 3D world.
// Units are metres; the figure stands on y = 0. Two looks:
//   "paper" — a paper cut-out: thick white edge and a soft drop shadow around the whole figure
//   "ink"   — clean black lines only
const DEG = Math.PI / 180;

// poses: [left upper, left lower, right upper, right lower] in degrees; 0 = hanging down, + = away from the body
export const ARM_POSES = {
  down: [12, 4, 12, 4], hips: [55, -125, 55, -125], up: [138, 12, 138, 12], cheer: [122, 35, 122, 35],
  point: [12, 4, 95, -5], wave: [12, 4, 150, 25], shrug: [70, -95, 70, -95], think: [12, 4, 35, -150],
  cross: [40, -150, 40, -150], present: [12, 4, 70, 30], hold: [25, -70, 25, -70], scared: [110, -150, 110, -150],
  facepalm: [12, 4, 30, -165], reach: [12, 4, 80, 10],
};
export const FACES = ["neutral", "happy", "laugh", "shock", "angry", "sad", "think", "smug", "scared", "sleep", "wow", "nervous"];

const BODY = {
  adult: { leg: 0.8, torso: 0.52, head: 0.25, arm: 0.3 },
  kid:   { leg: 0.55, torso: 0.38, head: 0.24, arm: 0.22 },
  tall:  { leg: 0.92, torso: 0.6, head: 0.24, arm: 0.34 },
};
export const FIGURE_HEIGHT = (build = "adult") => { const b = BODY[build] ?? BODY.adult; return b.leg + b.torso + 0.05 + b.head * 2; };
// The card a figure is drawn on: `size` metres tall (canvas height), feet `pad` metres above the card's bottom edge.
export const CARD_PAD = 0.12;
export const cardSize = (build = "adult") => FIGURE_HEIGHT(build) + 0.25 + CARD_PAD * 2;

/**
 * spec  : { head:"#fbfaf5", accent:"#d97757", scarf:true, hat:null|"cap"|"beanie"|"top"|"fez"|"straw"|"bowler"|"crown"|"hood",
 *           hair:null|"tuft"|"bun"|"long"|"spiky", hairColor, glasses, moustache, beard, build:"adult"|"kid"|"tall" }
 * state : { face, arms (name or [4 angles]), legs:"stand"|"walk"|"run"|"sit"|"jump", phase 0..1, look -1..1, blink 0..1,
 *           talk 0..1, lean -1..1, headTilt (deg), sweat, blush, wind 0..1, prop:{kind, text} }
 */
export function drawFigure(g, W, H, spec = {}, st = {}, look = "paper") {
  if (look !== "paper") return drawLines(g, W, H, spec, st);
  // paper cut-out: draw the figure on its own layer, then put a white edge (the figure's silhouette grown
  // by a few pixels in every direction) and a soft drop shadow underneath it
  const [ink, ig] = layer("ink", W, H), [sil, sg] = layer("sil", W, H);
  ig.clearRect(0, 0, W, H);
  const info = drawLines(ig, W, H, spec, st);
  sg.clearRect(0, 0, W, H); sg.globalCompositeOperation = "source-over"; sg.drawImage(ink, 0, 0);
  sg.globalCompositeOperation = "source-in"; sg.fillStyle = "#fffdf7"; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = "source-over";
  const edge = Math.max(3, info.lw * 0.75);
  g.save();
  g.shadowColor = "rgba(40,25,10,.38)"; g.shadowBlur = info.lw * 1.2; g.shadowOffsetX = info.lw * 0.45; g.shadowOffsetY = info.lw * 0.65;
  g.drawImage(sil, 0, 0);
  g.restore();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.drawImage(sil, Math.cos(a) * edge, Math.sin(a) * edge); }
  g.drawImage(ink, 0, 0);
  return info;
}

const layers = {};
function layer(name, W, H) {
  const l = layers[name];
  if (l && l[0].width === W && l[0].height === H) return l;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  return (layers[name] = [c, c.getContext("2d")]);
}

function drawLines(g, W, H, spec = {}, st = {}) {
  const b = BODY[spec.build] ?? BODY.adult;
  const s = H / cardSize(spec.build);                            // px per metre
  const P = (x, y) => [W / 2 + x * s, H - (CARD_PAD + y) * s];
  const lw = Math.max(3, 0.042 * s);

  // ---- skeleton
  const phase = (st.phase ?? 0) * Math.PI * 2;
  let lift = 0, legL, legR;
  if (st.legs === "walk") { const k = Math.sin(phase); legL = [8 + 22 * k, Math.max(0, -28 * k)]; legR = [8 - 22 * k, Math.max(0, 28 * k)]; lift = Math.abs(Math.cos(phase)) * 0.02; }
  else if (st.legs === "run") { const k = Math.sin(phase); legL = [10 + 42 * k, Math.max(0, -70 * k)]; legR = [10 - 42 * k, Math.max(0, 70 * k)]; lift = 0.04 + Math.abs(Math.cos(phase)) * 0.05; }
  else if (st.legs === "jump") { legL = [25, 40]; legR = [25, 40]; lift = 0.12; }
  else if (st.legs === "sit") { legL = [80, -85]; legR = [80, -85]; lift = -b.leg * 0.45; }
  else { legL = [9, 0]; legR = [9, 0]; }
  const lean = (st.lean ?? 0) * 0.14;
  const hip = [0, b.leg + lift];
  const shoulder = [hip[0] + lean, hip[1] + b.torso];
  let arms = typeof st.arms === "string" ? ARM_POSES[st.arms] ?? ARM_POSES.down : st.arms ?? ARM_POSES.down;
  if (st.legs === "walk" || st.legs === "run") {   // counter-swing when the arms are relaxed
    const k = Math.sin(phase) * (st.legs === "run" ? 40 : 18);
    if (!st.arms || st.arms === "down") arms = [12 - k, st.legs === "run" ? -70 : 4, 12 + k, st.legs === "run" ? -70 : 4];
  }
  if (st.arms === "wave") arms = [arms[0], arms[1], arms[2], arms[3] + Math.sin(phase * 3) * 25];
  const limb = (from, side, a1, a2, len) => {
    const d1 = [side * Math.sin(a1 * DEG), -Math.cos(a1 * DEG)];
    const j = [from[0] + d1[0] * len, from[1] + d1[1] * len];
    const d2 = [side * Math.sin((a1 + a2) * DEG), -Math.cos((a1 + a2) * DEG)];
    return [from, j, [j[0] + d2[0] * len, j[1] + d2[1] * len]];
  };
  const armL = limb(shoulder, -1, arms[0], arms[1], b.arm), armR = limb(shoulder, 1, arms[2], arms[3], b.arm);
  const legLp = limb(hip, -1, legL[0], legL[1], b.leg / 2), legRp = limb(hip, 1, legR[0], legR[1], b.leg / 2);
  const tilt = (st.headTilt ?? 0) * DEG;
  const neck = [shoulder[0], shoulder[1] + 0.05];
  const head = [neck[0] + Math.sin(tilt) * b.head, neck[1] + b.head * 0.95];

  const lines = [[hip, shoulder], [shoulder, neck], armL, armR, legLp, legRp];
  const path = (pts) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(...p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); };
  const [hx, hy] = P(...head), R = b.head * s;
  g.lineCap = g.lineJoin = "round";

  // ---- scarf (behind the head, over the body)
  if (spec.scarf !== false) {
    const col = spec.accent ?? "#d97757", [nx, ny] = P(...neck);
    const wind = st.wind ?? 0.3, wav = Math.sin(phase * 2 + (st.t ?? 0) * 0.15) * 0.04;
    g.fillStyle = col; g.strokeStyle = "#1b1b1b"; g.lineWidth = lw * 0.45;
    g.beginPath();
    g.moveTo(nx - R * 0.1, ny - R * 0.05);
    g.quadraticCurveTo(nx - R * (0.7 + wind * 0.6), ny + R * (0.15 + wav * 4), nx - R * (0.9 + wind), ny + R * (0.55 + wav * 6));
    g.lineTo(nx - R * (0.6 + wind * 0.7), ny + R * (0.62 + wav * 5));
    g.quadraticCurveTo(nx - R * 0.35, ny + R * 0.35, nx + R * 0.05, ny + R * 0.32);
    g.closePath(); g.fill(); g.stroke();
    roundRectPath(g, nx - R * 0.55, ny - R * 0.18, R * 1.1, R * 0.36, R * 0.18); g.fill(); g.stroke();
  }

  // ---- limbs
  g.strokeStyle = "#1b1b1b"; g.lineWidth = lw;
  lines.forEach((l) => { path(l); g.stroke(); });
  g.fillStyle = "#1b1b1b";
  [armL[2], armR[2]].forEach((p) => { const [x, y] = P(...p); g.beginPath(); g.arc(x, y, lw * 0.85, 0, 7); g.fill(); });
  [legLp[2], legRp[2]].forEach((p, i) => { const [x, y] = P(...p); g.beginPath(); g.ellipse(x + (i ? 1 : -1) * lw * 0.8, y, lw * 1.3, lw * 0.75, 0, 0, 7); g.fill(); });

  // ---- prop in the right hand
  if (st.prop) drawProp(g, P(...armR[2]), lw, st.prop);

  // ---- head
  g.save(); g.translate(hx, hy); g.rotate(tilt);
  if (spec.hair === "long") { g.fillStyle = spec.hairColor ?? "#2b2420"; roundRectPath(g, -R * 1.05, -R * 0.9, R * 2.1, R * 1.9, R * 0.9); g.fill(); }
  g.fillStyle = spec.head ?? "#fbfaf5"; g.strokeStyle = "#1b1b1b"; g.lineWidth = lw * 0.85;
  g.beginPath(); g.ellipse(0, 0, R, R * 1.02, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  drawHair(g, R, lw, spec);
  drawFace(g, R, lw, st, spec);
  drawHat(g, R, lw, spec);
  g.restore();

  if (st.sweat) { g.fillStyle = "#7fc3ec"; g.strokeStyle = "#1b1b1b"; g.lineWidth = lw * 0.35; const x = hx + R * 0.95, y = hy - R * 0.5; g.beginPath(); g.moveTo(x, y - R * 0.3); g.quadraticCurveTo(x + R * 0.18, y, x, y + R * 0.08); g.quadraticCurveTo(x - R * 0.18, y, x, y - R * 0.3); g.fill(); g.stroke(); }
  return { headPx: [hx, hy], scale: s, lw };
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function drawFace(g, R, lw, st, spec) {
  const face = st.face ?? "neutral", lk = (st.look ?? 0) * R * 0.14, blink = st.blink ?? 0, talk = st.talk ?? 0;
  const ex = R * 0.36, ey = -R * 0.05, er = R * 0.12;
  g.fillStyle = "#1b1b1b"; g.strokeStyle = "#1b1b1b"; g.lineCap = "round";
  const eye = (sx) => {
    const x = sx * ex + lk, y = ey;
    if (face === "happy" || face === "laugh") { g.lineWidth = lw * 0.6; g.beginPath(); g.arc(x, y + er * 0.5, er * 0.9, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return; }
    if (face === "sleep" || blink > 0.85) { g.lineWidth = lw * 0.55; g.beginPath(); g.moveTo(x - er, y); g.lineTo(x + er, y); g.stroke(); return; }
    let rx = er * 0.78, ry = er * 1.05;
    if (face === "shock" || face === "wow" || face === "scared") { rx *= 1.3; ry *= 1.3; }
    ry *= 1 - blink;
    if (face === "smug") { g.beginPath(); g.ellipse(x, y + ry * 0.35, rx, ry * 0.6, 0, Math.PI, 0, true); g.fill(); g.lineWidth = lw * 0.5; g.beginPath(); g.moveTo(x - rx * 1.3, y); g.lineTo(x + rx * 1.3, y); g.stroke(); return; }
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + rx * 0.3, y - ry * 0.35, rx * 0.32, 0, 7); g.fill(); g.fillStyle = "#1b1b1b";
  };
  eye(-1); eye(1);
  // brows
  const brow = { angry: [-0.35, 0.18], sad: [0.35, 0.1], think: [0.0, 0.3, true], shock: [0, 0.42], wow: [0, 0.42], scared: [0.3, 0.4], nervous: [0.25, 0.25], smug: [-0.15, 0.22] }[face];
  if (brow) {
    g.lineWidth = lw * 0.55;
    [-1, 1].forEach((sx) => {
      const lift = brow[2] && sx === 1 ? 0.18 : 0, x = sx * ex + lk, y = ey - er * 1.9 - R * (brow[1] + lift) * 0.4, a = brow[0] * sx;
      g.beginPath(); g.moveTo(x - er * 1.1, y - a * er * 1.4); g.lineTo(x + er * 1.1, y + a * er * 1.4); g.stroke();
    });
  }
  if (st.blush || face === "laugh") { g.fillStyle = "rgba(235,110,110,.35)"; [-1, 1].forEach((sx) => { g.beginPath(); g.ellipse(sx * R * 0.58 + lk, R * 0.22, R * 0.14, R * 0.08, 0, 0, 7); g.fill(); }); g.fillStyle = "#1b1b1b"; }
  if (spec.glasses) { g.lineWidth = lw * 0.4; [-1, 1].forEach((sx) => { g.beginPath(); g.arc(sx * ex + lk, ey, er * 1.9, 0, 7); g.stroke(); }); g.beginPath(); g.moveTo(-ex + er * 1.9 + lk, ey); g.lineTo(ex - er * 1.9 + lk, ey); g.stroke(); }
  // mouth
  const my = R * 0.42, mx = lk * 0.6;
  g.lineWidth = lw * 0.55;
  if (talk > 0.05 || face === "laugh" || face === "shock" || face === "wow" || face === "scared") {
    const open = face === "laugh" ? 0.6 : face === "shock" || face === "wow" || face === "scared" ? 0.75 : talk;
    const w = face === "laugh" ? R * 0.42 : R * (0.16 + 0.1 * open), h = R * (0.06 + 0.22 * open);
    g.fillStyle = "#3a1414"; g.beginPath();
    if (face === "laugh") { g.moveTo(mx - w, my - h * 0.3); g.quadraticCurveTo(mx, my + h * 1.6, mx + w, my - h * 0.3); g.closePath(); }
    else g.ellipse(mx, my, w, h, 0, 0, 7);
    g.fill(); g.stroke();
  } else if (face === "happy") { g.beginPath(); g.arc(mx, my - R * 0.15, R * 0.28, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  else if (face === "sad") { g.beginPath(); g.arc(mx, my + R * 0.18, R * 0.22, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
  else if (face === "angry") { g.beginPath(); g.moveTo(mx - R * 0.2, my + R * 0.03); g.lineTo(mx + R * 0.2, my - R * 0.03); g.stroke(); }
  else if (face === "smug") { g.beginPath(); g.moveTo(mx - R * 0.18, my); g.quadraticCurveTo(mx + R * 0.05, my + R * 0.06, mx + R * 0.24, my - R * 0.12); g.stroke(); }
  else if (face === "think" || face === "nervous") { g.beginPath(); g.moveTo(mx - R * 0.14, my + R * 0.02); g.bezierCurveTo(mx - R * 0.05, my - R * 0.06, mx + R * 0.05, my + R * 0.08, mx + R * 0.14, my); g.stroke(); }
  else if (face !== "sleep") { g.beginPath(); g.moveTo(mx - R * 0.12, my); g.lineTo(mx + R * 0.12, my); g.stroke(); }
  if (spec.moustache) { g.fillStyle = spec.hairColor ?? "#2b2420"; g.beginPath(); g.ellipse(mx - R * 0.12, my - R * 0.1, R * 0.15, R * 0.06, -0.3, 0, 7); g.ellipse(mx + R * 0.12, my - R * 0.1, R * 0.15, R * 0.06, 0.3, 0, 7); g.fill(); }
  if (spec.beard) { g.fillStyle = spec.hairColor ?? "#2b2420"; g.beginPath(); g.moveTo(-R * 0.6, R * 0.35); g.quadraticCurveTo(0, R * 1.35, R * 0.6, R * 0.35); g.quadraticCurveTo(0, R * 0.75, -R * 0.6, R * 0.35); g.fill(); }
}

function drawHair(g, R, lw, spec) {
  const col = spec.hairColor ?? "#2b2420";
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw * 0.6;
  if (spec.hair === "tuft") { [-0.15, 0, 0.15].forEach((d, i) => { g.beginPath(); g.moveTo(d * R, -R * 0.98); g.quadraticCurveTo(d * R + R * 0.12, -R * 1.25, d * R + R * (0.05 + i * 0.05), -R * 1.32); g.stroke(); }); }
  if (spec.hair === "spiky") { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.1 + i * 0.13), r2 = i % 2 ? R * 1.25 : R * 0.95; g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } g.closePath(); g.fill(); }
  if (spec.hair === "bun") { g.beginPath(); g.arc(0, -R * 1.12, R * 0.28, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, -R * 0.55, R * 0.98, R * 0.5, 0, Math.PI, 0); g.fill(); }
  if (spec.hair === "long") { g.beginPath(); g.ellipse(0, -R * 0.5, R * 1.02, R * 0.56, 0, Math.PI, 0); g.fill(); }
}

function drawHat(g, R, lw, spec) {
  const acc = spec.hatColor ?? spec.accent ?? "#d97757", ink = "#1b1b1b";
  g.strokeStyle = ink; g.lineWidth = lw * 0.6;
  const fillStroke = () => { g.fill(); g.stroke(); };
  switch (spec.hat) {
    case "cap": g.fillStyle = acc; g.beginPath(); g.ellipse(0, -R * 0.62, R * 0.95, R * 0.55, 0, Math.PI, 0); g.closePath(); fillStroke(); g.beginPath(); g.ellipse(R * 0.55, -R * 0.6, R * 0.6, R * 0.12, 0, 0, 7); fillStroke(); break;
    case "beanie": g.fillStyle = acc; g.beginPath(); g.ellipse(0, -R * 0.55, R * 0.98, R * 0.62, 0, Math.PI, 0); g.closePath(); fillStroke(); g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, -R * 1.2, R * 0.16, 0, 7); fillStroke(); break;
    case "top": g.fillStyle = "#222"; roundRectPath(g, -R * 0.55, -R * 1.75, R * 1.1, R * 1.05, R * 0.08); fillStroke(); g.fillStyle = acc; g.fillRect(-R * 0.55, -R * 0.95, R * 1.1, R * 0.2); g.fillStyle = "#222"; g.beginPath(); g.ellipse(0, -R * 0.72, R * 0.95, R * 0.13, 0, 0, 7); fillStroke(); break;
    case "bowler": g.fillStyle = "#2a2a2a"; g.beginPath(); g.ellipse(0, -R * 0.72, R * 0.72, R * 0.6, 0, Math.PI, 0); g.closePath(); fillStroke(); g.beginPath(); g.ellipse(0, -R * 0.72, R * 1.0, R * 0.14, 0, 0, 7); fillStroke(); break;
    case "fez": g.fillStyle = "#b8262e"; g.beginPath(); g.moveTo(-R * 0.5, -R * 0.75); g.lineTo(-R * 0.38, -R * 1.45); g.lineTo(R * 0.38, -R * 1.45); g.lineTo(R * 0.5, -R * 0.75); g.closePath(); fillStroke(); g.strokeStyle = "#1b1b1b"; g.beginPath(); g.moveTo(0, -R * 1.45); g.quadraticCurveTo(R * 0.5, -R * 1.4, R * 0.55, -R * 0.95); g.stroke(); break;
    case "straw": g.fillStyle = "#e6c46f"; g.beginPath(); g.moveTo(-R * 1.35, -R * 0.62); g.lineTo(0, -R * 1.45); g.lineTo(R * 1.35, -R * 0.62); g.quadraticCurveTo(0, -R * 0.4, -R * 1.35, -R * 0.62); fillStroke(); break;
    case "crown": g.fillStyle = "#f2b544"; g.beginPath(); g.moveTo(-R * 0.6, -R * 0.75); g.lineTo(-R * 0.65, -R * 1.35); g.lineTo(-R * 0.3, -R * 1.05); g.lineTo(0, -R * 1.45); g.lineTo(R * 0.3, -R * 1.05); g.lineTo(R * 0.65, -R * 1.35); g.lineTo(R * 0.6, -R * 0.75); g.closePath(); fillStroke(); break;
    case "hood": g.fillStyle = acc; g.beginPath(); g.ellipse(0, -R * 0.15, R * 1.18, R * 1.22, 0, Math.PI * 0.92, Math.PI * 2.08); g.ellipse(0, -R * 0.05, R * 0.82, R * 0.88, 0, Math.PI * 2.05, Math.PI * 0.95, true); g.closePath(); fillStroke(); break;
  }
}

function drawProp(g, [x, y], lw, prop) {
  g.save(); g.translate(x, y); g.lineWidth = lw * 0.5; g.strokeStyle = "#1b1b1b";
  const k = lw * 4;
  switch (prop.kind) {
    case "lantern": g.strokeStyle = "#1b1b1b"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, k * 0.5); g.stroke(); g.fillStyle = "#3b4a3f"; g.fillRect(-k * 0.45, k * 0.5, k * 0.9, k * 1.1); g.fillStyle = "#ffd36b"; g.fillRect(-k * 0.3, k * 0.65, k * 0.6, k * 0.8); break;
    case "paper": g.fillStyle = "#fffaf0"; g.fillRect(-k * 0.2, -k * 1.2, k * 1.1, k * 1.4); g.strokeRect(-k * 0.2, -k * 1.2, k * 1.1, k * 1.4); g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(-k * 0.05, -k * 1.2 + i * k * 0.22); g.lineTo(k * 0.75, -k * 1.2 + i * k * 0.22); g.stroke(); } break;
    case "coin": g.fillStyle = "#f2b544"; g.beginPath(); g.arc(0, -k * 0.3, k * 0.4, 0, 7); g.fill(); g.stroke(); break;
    case "simit": case "ring": { const r = k * 0.62; g.fillStyle = prop.color ?? "#c98a44"; g.beginPath(); g.arc(0, -r, r, 0, Math.PI * 2); g.arc(0, -r, r * 0.42, 0, Math.PI * 2, true); g.fill("evenodd"); g.stroke();
      g.beginPath(); g.arc(0, -r, r * 0.42, 0, Math.PI * 2); g.stroke();
      if (prop.kind === "simit") { g.fillStyle = "#fff6dc"; for (let i = 0; i < 14; i++) { const a = i * 0.45, rr = r * (0.58 + (i % 3) * 0.13); g.beginPath(); g.ellipse(Math.cos(a) * rr, -r + Math.sin(a) * rr, lw * 0.22, lw * 0.13, a, 0, 7); g.fill(); } } break; }
    case "bread": g.fillStyle = "#d9a15b"; g.beginPath(); g.ellipse(k * 0.3, -k * 0.3, k * 0.9, k * 0.4, -0.3, 0, 7); g.fill(); g.stroke(); g.lineWidth = lw * 0.3; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(k * (0.3 + i * 0.4) - k * 0.1, -k * 0.55); g.lineTo(k * (0.3 + i * 0.4) + k * 0.1, -k * 0.1); g.stroke(); } break;
    case "phone": g.fillStyle = "#222"; g.fillRect(-k * 0.3, -k * 1.1, k * 0.6, k * 1.1); g.fillStyle = "#7fc3ec"; g.fillRect(-k * 0.22, -k * 1.0, k * 0.44, k * 0.85); break;
    case "sign": g.fillStyle = "#6b4026"; g.fillRect(-lw * 0.3, -k * 2.5, lw * 0.6, k * 2.5); g.fillStyle = "#fffaf0"; g.fillRect(-k * 1.2, -k * 3.6, k * 2.4, k * 1.2); g.strokeRect(-k * 1.2, -k * 3.6, k * 2.4, k * 1.2);
      if (prop.text) { g.fillStyle = "#1b1b1b"; g.font = `600 ${Math.round(k * 0.55)}px Fredoka`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(prop.text, 0, -k * 3.0, k * 2.2); } break;
    case "magnifier": g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(0, 0); g.lineTo(k * 0.6, -k * 0.6); g.stroke(); g.fillStyle = "rgba(180,220,255,.5)"; g.beginPath(); g.arc(k * 0.95, -k * 0.95, k * 0.5, 0, 7); g.fill(); g.stroke(); break;
  }
  g.restore();
}
