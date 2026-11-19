// Comic effects drawn on a square canvas (shown as a camera-facing card).
// t is the animation phase 0..1 (pop-in, wobble). kinds: exclaim, question, stars, idea, sweat, hearts, zzz, anger, sparkle, burst, coin, note
export function drawEffect(g, N, kind, t = 0, o = {}) {
  const c = N / 2, pop = Math.min(1, t * 4), sc = pop < 1 ? 0.6 + pop * 0.5 - Math.sin(pop * Math.PI) * 0.1 : 1 + Math.sin(t * 12) * 0.03;
  g.save(); g.translate(c, c); g.scale(sc, sc); g.translate(-c, -c);
  g.lineJoin = g.lineCap = "round"; g.lineWidth = N * 0.035; g.strokeStyle = "#1b1b1b";
  const text = (s, col, size = 0.7) => { g.font = `700 ${N * size}px Fredoka`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = N * 0.06; g.strokeText(s, c, c); g.fillStyle = col; g.fillText(s, c, c); };
  const star = (x, y, r, col) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fillStyle = col; g.fill(); g.stroke(); };
  switch (kind) {
    case "exclaim": text("!", "#e84a3c", 0.8); break;
    case "question": text("?", "#f2b544", 0.75); break;
    case "stars": [[0.3, 0.35, 0.12], [0.7, 0.3, 0.09], [0.55, 0.7, 0.1]].forEach(([x, y, r], i) => star(x * N, y * N + Math.sin(t * 6 + i) * N * 0.03, r * N, "#ffd24a")); break;
    case "sparkle": [[0.5, 0.5, 0.2], [0.25, 0.3, 0.08], [0.78, 0.72, 0.07]].forEach(([x, y, r]) => { g.beginPath(); g.moveTo(x * N, y * N - r * N); g.quadraticCurveTo(x * N, y * N, x * N + r * N, y * N); g.quadraticCurveTo(x * N, y * N, x * N, y * N + r * N); g.quadraticCurveTo(x * N, y * N, x * N - r * N, y * N); g.quadraticCurveTo(x * N, y * N, x * N, y * N - r * N); g.fillStyle = "#fff6c8"; g.fill(); g.lineWidth = N * 0.02; g.stroke(); }); break;
    case "idea": g.fillStyle = "#ffe066"; g.beginPath(); g.arc(c, c * 0.85, N * 0.22, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#9aa0a6"; g.fillRect(c - N * 0.1, c * 1.2, N * 0.2, N * 0.12); g.strokeRect(c - N * 0.1, c * 1.2, N * 0.2, N * 0.12);
      for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.9 + i * Math.PI * 0.3; g.beginPath(); g.moveTo(c + Math.cos(a) * N * 0.3, c * 0.85 + Math.sin(a) * N * 0.3); g.lineTo(c + Math.cos(a) * N * 0.42, c * 0.85 + Math.sin(a) * N * 0.42); g.stroke(); } break;
    case "sweat": g.fillStyle = "#7fc3ec"; g.beginPath(); g.moveTo(c, N * 0.15); g.quadraticCurveTo(c + N * 0.25, c + N * 0.1, c, N * 0.82); g.quadraticCurveTo(c - N * 0.25, c + N * 0.1, c, N * 0.15); g.fill(); g.stroke(); break;
    case "hearts": [[0.35, 0.45, 0.16], [0.68, 0.32, 0.11]].forEach(([x, y, r]) => { const X = x * N, Y = y * N + Math.sin(t * 5) * N * 0.03, R = r * N; g.beginPath(); g.moveTo(X, Y + R * 0.9); g.bezierCurveTo(X - R * 1.6, Y - R * 0.2, X - R * 0.6, Y - R * 1.3, X, Y - R * 0.4); g.bezierCurveTo(X + R * 0.6, Y - R * 1.3, X + R * 1.6, Y - R * 0.2, X, Y + R * 0.9); g.fillStyle = "#ec5b6d"; g.fill(); g.stroke(); }); break;
    case "zzz": g.font = `700 ${N * 0.28}px Fredoka`; g.textAlign = "center"; [[0.35, 0.7, 0.8], [0.55, 0.5, 1], [0.72, 0.3, 1.2]].forEach(([x, y, k]) => { g.save(); g.translate(x * N, y * N); g.scale(k, k); g.lineWidth = N * 0.03; g.strokeText("z", 0, 0); g.fillStyle = "#ffffff"; g.fillText("z", 0, 0); g.restore(); }); break;
    case "anger": g.strokeStyle = "#e84a3c"; g.lineWidth = N * 0.06; for (let q = 0; q < 4; q++) { g.save(); g.translate(c, c); g.rotate(q * Math.PI / 2); g.beginPath(); g.arc(N * 0.2, N * 0.2, N * 0.14, Math.PI, Math.PI * 1.5); g.stroke(); g.restore(); } break;
    case "burst": { g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = (i % 2 ? 0.28 : 0.46) * N; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fillStyle = "#ffd24a"; g.fill(); g.stroke(); if (o.text) { g.font = `700 ${N * 0.16}px Fredoka`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#1b1b1b"; g.fillText(o.text, c, c, N * 0.6); } break; }
    case "coin": g.fillStyle = "#f2b544"; g.beginPath(); g.ellipse(c, c, N * 0.3 * Math.abs(Math.cos(t * 6)) + N * 0.02, N * 0.3, 0, 0, 7); g.fill(); g.stroke(); break;
    case "note": g.fillStyle = "#1b1b1b"; g.beginPath(); g.ellipse(c - N * 0.1, c + N * 0.2, N * 0.12, N * 0.09, -0.4, 0, 7); g.fill(); g.fillRect(c, c - N * 0.3, N * 0.04, N * 0.5); g.beginPath(); g.moveTo(c + N * 0.04, c - N * 0.3); g.quadraticCurveTo(c + N * 0.3, c - N * 0.2, c + N * 0.2, c); g.stroke(); break;
  }
  g.restore();
}
