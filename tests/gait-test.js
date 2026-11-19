// Gait test.
//   ?mode=walk | run | front   one step cycle in place (phase = frame / 16), fixed camera: body motion only
//   ?mode=path                 S.walk across the picture and back toward the camera, with ground ticks every 25 cm,
//                              so a planted foot that slides is easy to spot frame by frame
//   ?mode=fit                  three people spread out, camera from S.fit: nobody may touch the frame edge
export const config = { fps: 30, frames: 150 };

export function setup(S) {
  S.ground(S.tex.paper("#e3d3b4", 2, [60, 60]), 400);
  for (let i = -16; i <= 16; i++) S.box(0.02, 0.01, 0.5, i % 4 ? "#a08f74" : "#5c4f3e", [i * 0.25, 0, 0], { outline: false });
  S.actor("a", { accent: "#d97757", hat: "cap" });
  S.actor("b", { accent: "#4f8fc0", hair: "bun" });
  S.actor("c", { accent: "#7aa35a", build: "tall", moustache: true });
}

const PATH = [{ f: 0, v: [-2.6, 0, 0] }, { f: 70, v: [1.6, 0, 0] }, { f: 85, v: [1.6, 0, 0] }, { f: 140, v: [1.6, 0, 2.2] }];

export function shot(f, S) {
  const mode = S.params.mode ?? "walk";
  if (mode === "path") {
    const w = S.walk(f, PATH, { who: "a" });
    const [x, , z] = w.pos;   // tracking camera: in a 9:16 picture a walker crosses a fixed frame in a second or two
    return {
      light: "day", caption: { text: `${f}`, age: 9 },
      camera: { pos: [x * 0.9, 1.3, z + 4.4], target: [x * 0.95, 0.9, z], fov: 36 },
      actors: [{ id: "a", pos: w.pos, dir: w.dir, state: { ...w.state, face: "neutral", blink: S.blink(f, 2) } }],
    };
  }
  if (mode === "fit") {
    const at = [[-1.4, 0, 0], [0.2, 0, -1.2], [1.3, 0, 0.6]];
    return {
      light: "day", caption: { text: "fit", age: 9 },
      camera: S.fit(at, { from: [0.2, 0.3, 1] }),
      actors: at.map((pos, i) => ({ id: "abc"[i], pos, state: { face: "happy", arms: i === 1 ? "wave" : "down", t: f } })),
    };
  }
  const phase = f / 16;
  const run = mode === "run";
  const state = mode === "front" ? { legs: "walk", phase, view: "front", face: "neutral" } : { legs: run ? "run" : "walk", phase, view: "side", face: "neutral" };
  return {
    light: "day", caption: { text: `${mode} ${f % 16}/16`, age: 9 },
    camera: { pos: [0, 1.0, 4.2], target: [0, 0.95, 0], fov: 34 },
    actors: [{ id: "a", pos: [0, 0, 0], state }],
  };
}
