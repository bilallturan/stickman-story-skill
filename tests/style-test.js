// Style test: the same golden-hour street in each look. ?variant=street (default) | close | end
import { paper, cobble } from "../studio/textures.js";

export const config = { fps: 30, seconds: 3 };

export function setup(S) {
  const ink = S.look === "ink";
  S.ground(ink ? cobble(2, [80, 80], "#c9b48f") : paper("#e3d3b4", 2, [60, 60]), 400);
  S.street({ len: 160, width: 6 });
  S.row(-40, 40, -9.5, { seed: 4 });
  S.row(-40, 40, 9.5, { seed: 8, rot: Math.PI });
  S.hills(-80);
  S.cloud(-8, 16, -60, 2.2); S.cloud(10, 19, -70, 2.8); S.cloud(2, 13, -50, 1.6);
  S.lamp(-2.6, -4.2, { on: true }); S.tree(3.4, -5.2, { s: 1.1 }); S.bench(-1.2, -5.6); S.barrel(2.2, -4.8);
  S.sign("FIRIN", 1.6, 0.5, [-0.4, 3.6, -6.9], { bg: "#7a3b2a" });
  S.actor("ali", { accent: "#d97757", hat: "cap", hair: null });
  S.actor("ayse", { accent: "#3f8f8a", hair: "bun", hairColor: "#3a2a20" });
  S.actor("dede", { accent: "#7a5aa8", hat: "fez", moustache: true, build: "tall" });
}

export function shot(f, S) {
  const v = S.params.variant ?? "street";
  if (v === "close") return {
    light: "golden",
    camera: S.fit([{ pos: [-0.38, 0, 0.1], crop: 0.3 }, { pos: [0.42, 0, -0.35], crop: 0.3 }], { from: [0, 0.12, 1], fov: 36, pad: 0.08 }),
    actors: [{ id: "ali", pos: [-0.38, 0, 0.1], state: { face: "smug", arms: "point", look: 0.6, talk: 0.5, headTilt: -4 } },
             { id: "ayse", pos: [0.42, 0, -0.35], state: { face: "shock", arms: "scared", look: -0.6 } }],
    effects: [{ kind: "exclaim", pos: [0.62, 2.2, -0.35], size: 0.4, t: 0.6 }],
    caption: { text: "Sonra", age: 1 },
  };
  if (v === "end") return {
    light: "golden",
    camera: S.fit([{ pos: [-0.42, 0, 1.1], crop: 0.2 }, { pos: [0.3, 0, 1.1], crop: 0.6 }], { from: [0, 0.1, 1], fov: 38, pad: 0.1 }),   // the empty spot on the right leaves room for the end text
    actors: [{ id: "ali", pos: [-0.42, 0, 1.1], state: { face: "happy", arms: "wave", phase: 0.1 } }],
    caption: { text: "Yarın yeni hikâye", age: 1 },
  };
  return {
    light: "golden",
    // three people staged in depth (a 9:16 picture is narrow), camera from S.fit so nobody is cut
    camera: S.fit([[-0.55, 0, 0.6], [0.35, 0, -0.7], [1.05, 0, -2.5]], { from: [-0.1, 0.35, 1], fov: 46, pad: 0.1 }),
    actors: [{ id: "ali", pos: [-0.55, 0, 0.6], state: { face: "smug", arms: "point", look: 0.7 } },
             { id: "ayse", pos: [0.35, 0, -0.7], state: { face: "shock", arms: "scared", look: -0.7 } },
             { id: "dede", pos: [1.05, 0, -2.5], state: { face: "think", arms: "think", look: -0.5 } }],
    effects: [{ kind: "exclaim", pos: [0.6, 2.3, -0.7], size: 0.5, t: 0.6 }, { kind: "question", pos: [1.35, 2.6, -2.5], size: 0.5, t: 0.6 }],
    caption: { text: "Bir gün", age: 1 },
  };
}
