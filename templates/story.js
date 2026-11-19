// story.js — one short. The studio calls setup(S) once, then shot(f, S) for every frame f.
// This starter works with any script: it cuts to a new framing on every sentence. For a real short,
// rewrite SHOTS from work/sentences.json (see SKILL.md, "Shot plan") and give each sentence its own picture.

export const config = { fps: 30, look: "paper" };   // look: "paper" (cut-out edge) or "ink" (clean lines)

export function setup(S) {
  const { tex } = S;
  // ground + set
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

// framings reused across sentences: wide, two-shot, close on hero, close on friend
const FRAMES = [
  { camera: { pos: [0, 2.4, 6.3], target: [0, 2.0, -4], fov: 52 }, faces: ["neutral", "neutral"], arms: ["down", "down"] },
  { camera: { pos: [0.05, 1.5, 3.7], target: [0.05, 1.32, 0], fov: 36 }, faces: ["smug", "shock"], arms: ["point", "scared"] },
  { camera: { pos: [-0.3, 1.55, 3.0], target: [-0.3, 1.42, 0], fov: 34 }, faces: ["happy", "think"], arms: ["present", "think"] },
  { camera: { pos: [0.4, 1.52, 2.8], target: [0.4, 1.4, -0.3], fov: 34 }, faces: ["think", "wow"], arms: ["hips", "up"] },
];

export function shot(f, S) {
  const n = S.sentences.length ? S.sentences.findLastIndex((s) => f >= s.from - 3) : Math.floor(f / 90);
  const k = Math.max(0, n) % FRAMES.length, fr = FRAMES[k];
  const sent = S.sentences[Math.max(0, n)];
  const talk = sent ? S.talking(f, sent.from, sent.to) : 0;
  return {
    light: "golden",
    camera: S.cam(f, [{ f: (sent?.from ?? 0), ...fr.camera }, { f: (sent?.from ?? 0) + 90, ...fr.camera, pos: fr.camera.pos.map((v, i) => v + [0, 0, -0.25][i]) }]),
    actors: [
      { id: "hero", pos: [-0.38, 0, 0.1], state: { face: fr.faces[0], arms: fr.arms[0], look: 0.6, talk: k % 2 ? talk : 0, blink: S.blink(f, 1), ...S.idle(f, 1) } },
      { id: "friend", pos: [0.42, 0, -0.35], state: { face: fr.faces[1], arms: fr.arms[1], look: -0.6, talk: k % 2 ? 0 : talk, blink: S.blink(f, 2), ...S.idle(f, 2) } },
    ],
    effects: k === 1 ? [{ kind: "exclaim", pos: [0.62, 2.2, -0.35], size: 0.4, t: S.clamp((f - (sent?.from ?? 0)) / 20) }] : [],
    flash: sent && f - sent.from < 3 && f - sent.from >= 0 && n > 0 ? 0.25 * (1 - (f - sent.from) / 3) : 0,
  };
}
