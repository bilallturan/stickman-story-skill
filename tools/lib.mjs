// Shared helpers for the command-line tools: a local static server, finding a Chromium build, opening the studio.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".json": "application/json", ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".txt": "text/plain" };

// "/p/..." is served from the project folder, everything else from the skill folder. Bound to 127.0.0.1 only.
export function serve(projectDir) {
  const roots = { skill: SKILL, project: projectDir ? path.resolve(projectDir) : null };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const [root, rel] = u.startsWith("/p/") && roots.project ? [roots.project, u.slice(3)] : [roots.skill, u.slice(1)];
    const file = path.resolve(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

// Prefer a Chromium already installed by Playwright (any revision) so no extra download is needed.
export function findBrowser() {
  if (process.env.STICKMAN_BROWSER) return process.env.STICKMAN_BROWSER;
  const home = os.homedir();
  const caches = [process.env.PLAYWRIGHT_BROWSERS_PATH, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright"),
    path.join(home, ".cache", "ms-playwright"), path.join(home, "Library", "Caches", "ms-playwright")].filter((p) => p && fs.existsSync(p));
  const inside = ["chrome-headless-shell-win64/chrome-headless-shell.exe", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-headless-shell-mac-arm64/chrome-headless-shell",
    "chrome-headless-shell-mac-x64/chrome-headless-shell", "chrome-win64/chrome.exe", "chrome-win/chrome.exe", "chrome-linux64/chrome", "chrome-linux/chrome",
    "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"];
  const found = [];
  for (const c of caches) for (const d of fs.readdirSync(c)) {
    const m = d.match(/^chromium(_headless_shell)?-(\d+)$/); if (!m) continue;
    for (const rel of inside) { const p = path.join(c, d, rel); if (fs.existsSync(p)) found.push({ p, rev: +m[2], shell: !!m[1] }); }
  }
  found.sort((a, b) => (b.shell - a.shell) || (b.rev - a.rev));
  return found[0]?.p;   // undefined → Playwright's own default
}

export async function openStudio({ project, story, words, look, params = {}, cpu = false }) {
  const { chromium } = await import("playwright-core");
  const srv = await serve(project);
  const args = ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--disable-dev-shm-usage"];
  if (cpu || (process.platform === "linux" && !process.env.STICKMAN_GPU)) args.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader");
  else if (process.platform === "win32") args.push("--use-angle=d3d11");
  const browser = await chromium.launch({ executablePath: findBrowser(), args });
  const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const q = new URLSearchParams({ story, ...(words ? { words } : {}), ...(look ? { look } : {}), ...params });
  await page.goto(`http://127.0.0.1:${srv.address().port}/studio/index.html?${q}`);
  try { await page.waitForFunction("window.READY === true", null, { timeout: 120000 }); }
  catch { await browser.close(); srv.close(); throw new Error("Studio did not load:\n  " + errors.join("\n  ")); }
  const meta = await page.evaluate("window.META");
  return {
    meta, errors,
    async frame(f) { const url = await page.evaluate((n) => window.renderFrame(n), f); if (errors.length) throw new Error(`frame ${f}: ${errors.at(-1)}`); return Buffer.from(url.split(",")[1], "base64"); },
    async close() { await browser.close(); srv.close(); },
  };
}

// "0,30,60" or "0-120" or "0-120:10"
export function frameList(spec, total) {
  if (!spec) return [...Array(total).keys()];
  return spec.split(",").flatMap((part) => {
    const m = part.match(/^(\d+)-(\d+)(?::(\d+))?$/);
    if (!m) return [Number(part)];
    const out = []; for (let f = +m[1]; f <= Math.min(+m[2], total - 1); f += +(m[3] ?? 1)) out.push(f); return out;
  });
}
