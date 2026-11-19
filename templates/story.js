// story.js — one short. The studio calls setup(S) once, then shot(f, S) for every frame f.
// This starter works with any script: the hero walks in on the first sentence, then it cuts to a new framing on
// every sentence. For a real short, rewrite it from work/sentences.json (see SKILL.md, "Shot plan") and give each
// sentence its own picture. Rules kept here: walking only through S.walk, cameras from S.fit (nobody cut at the edge).

export const config = { fps: 30, look: "paper" };   // look: "paper" (cut-out edge) or "ink" (clean lines)

const HERO = [-0.38, 0, 0.1], FRIEND = [0.42, 0, -0.35];

export function setup(S) {
  const { tex } = S;
  // ground + set (the street's raised sidewalks are at |z| 3.0–4.6; the cast stands on the road, y = 0)
  S.ground(S.look === "ink" ? tex.cobble(2, [80, 80], "#c9b48f") : tex.paper("#e3d3b4", 2, [60, 60]), 400);
  S.street({ len: 160, width: 6 });
  S.row(-40, 40, -9.5, { seed: 4 });
  S.hills(-80);
  S.cloud(-8, 16, -60, 2.2); S.cloud(10, 19, -70, 2.8);
  S.lamp(-2.6, -4.2, { on: true }); S.tree(3.4, -5.2, { s: 1.1 }); S.bench(-1.2, -5.6);
  // cast: accent = scarf colour; hat, hair, moustache, glasses, build
  S.actor("hero", { accent: "#d97757", hat: "cap" });
  S.actor("friend", { accent: "#3f8f8a", hair: "bun", hairColor: "#3a2a20" });
}

// framings reused across sentences: wide, two-shot, close on hero, close on friend (crop = may cut below the waist)
const FRAMES = [
  { who: [HERO, FRIEND], from: [0.15, 0.45, 1], fov: 44, pad: 0.12, faces: ["neutral", "neutral"], arms: ["down", "down"] },
  { who: [{ pos: HERO, crop: 0.3 }, { pos: FRIEND, crop: 0.3 }], from: [0, 0.12, 1], fov: 38, pad: 0.1, faces: ["smug", "shock"], arms: ["point", "scared"] },
  { who: [{ pos: HERO, crop: 0.42 }], from: [-0.2, 0.1, 1], fov: 34, pad: 0.18, faces: ["happy", "think"], arms: ["present", "think"] },
  { who: [{ pos: FRIEND, crop: 0.42 }], from: [0.2, 0.1, 1], fov: 34, pad: 0.18, faces: ["think", "wow"], arms: ["hips", "up"] },
];

export function shot(f, S) {
  const n = S.sentences.length ? S.sentences.findLastIndex((s) => f >= s.from - 3) : Math.floor(f / 90);
  const k = Math.max(0, n) % FRAMES.length, fr = FRAMES[k];
  const sent = S.sentences[Math.max(0, n)];
  const t0 = sent?.from ?? 0, talk = sent ? S.talking(f, sent.from, sent.to) : 0;
  // the hero walks in during the first sentence (about 1.1 m/s), then stands and faces the camera
  const walkEnd = Math.max(40, S.sentences[0]?.to ?? 60);
  const w = S.walk(f, [{ f: 0, v: [-2.2, 0, 0.5] }, { f: walkEnd, v: HERO }], { who: "hero" });
  const heroState = f < walkEnd + 8 ? { ...w.state } : { view: "front", ...S.idle(f, 1) };
  const view = (pad) => S.fit(k === 0 && f < walkEnd ? [...fr.who, [-2.2, 0, 0.5]] : fr.who, { from: fr.from, fov: fr.fov, pad });
  return {
    light: "golden",
    camera: S.cam(f, [{ f: t0, ...view(fr.pad) }, { f: t0 + 90, ...view(fr.pad + 0.05) }]),
    actors: [
      { id: "hero", pos: w.pos, dir: w.dir, state: { face: fr.faces[0], arms: f < walkEnd ? undefined : fr.arms[0], look: 0.6, talk: k % 2 ? talk : 0, blink: S.blink(f, 1), ...heroState } },
      { id: "friend", pos: FRIEND, state: { face: fr.faces[1], arms: fr.arms[1], look: -0.6, talk: k % 2 ? 0 : talk, blink: S.blink(f, 2), ...S.idle(f, 2) } },
    ],
    effects: k === 1 ? [{ kind: "exclaim", pos: [FRIEND[0] + 0.2, 2.2, FRIEND[2]], size: 0.4, t: S.clamp((f - t0) / 20) }] : [],
    flash: sent && f - sent.from < 3 && f - sent.from >= 0 && n > 0 ? 0.25 * (1 - (f - sent.from) / 3) : 0,
  };
}
