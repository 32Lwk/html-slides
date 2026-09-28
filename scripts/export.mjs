#!/usr/bin/env node
// HTML スライドを <section id> の並び順で 1 枚ずつ PNG（1920×1080）に書き出す。Windows・Mac・Linux で動く。
//   node export.mjs <deck.html>                 → png/01-<id>.png …（pitch.html なら png-pitch/）。古い NN-*.png は消して振り直す
//   node export.mjs <deck.html> --check         → png…/check/ に赤枠つきで書き出し、はみ出し・小さすぎる文字・数字の抜け・画像の抜けを一覧にする
//   オプション: --only id1,id2  --theme navy（テーマを一時的に変えて撮る）  --out <dir>  --sheet（一覧の sheet.png も作る）  --jobs 4
//   Chrome の場所が違うときは CHROME=… を指定する（Edge も可）
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { dirname, join, resolve, basename, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const deck = args.find(a => !a.startsWith("--") && extname(a) === ".html");
const flag = n => args.includes("--" + n);
const val = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };
if (!deck || !existsSync(deck)) { console.error("usage: node export.mjs <deck.html> [--check] [--only id,id] [--theme name] [--out dir] [--sheet] [--jobs n]"); process.exit(1); }

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const P = process.platform === "win32" ? [
    `${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ] : process.platform === "darwin" ? [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"];
  return P.find(p => p && existsSync(p));
}
const CHROME = findChrome();
if (!CHROME) { console.error("Chrome / Edge が見つかりません。CHROME=… で場所を指定してください"); process.exit(1); }

const html = resolve(deck), dir = dirname(html), base = basename(html, ".html");
const src = readFileSync(html, "utf8");
let ids = [...src.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
if (!ids.length) { console.error('<section id="…"> がありません'); process.exit(1); }
const index = Object.fromEntries(ids.map((id, i) => [id, i + 1]));
const only = val("only")?.split(",").map(s => s.trim());
if (only) ids = ids.filter(id => only.includes(id));
const CHECK = flag("check");
const LIB = src.includes("/*LIB:JS*/");
if (CHECK && !LIB) console.log("このデッキは html-slides の部品を埋め込んでいないので、?check の赤枠（.ovf-badge）だけで判定します");
let out = resolve(val("out") || join(dir, base === "slides" ? "png" : `png-${base}`));
if (CHECK) out = join(out, "check");
mkdirSync(out, { recursive: true });
if (!only) for (const f of readdirSync(out)) if (/^\d{2,3}-.*\.png$/.test(f)) rmSync(join(out, f));
const q = new URLSearchParams();
if (CHECK) q.set("check", "");
if (val("theme")) q.set("theme", val("theme"));
const qs = q.toString() ? "?" + q.toString().replace(/=(&|$)/g, "$1") : "";
const url = id => pathToFileURL(html).href + qs + "#" + id;
const pad = n => String(n).padStart(ids.length >= 100 || Object.keys(index).length >= 100 ? 3 : 2, "0");

function chrome(extra, target) {
  const prof = mkdtempSync(join(tmpdir(), "hs-chrome-"));
  const argv = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--force-device-scale-factor=1", "--allow-file-access-from-files", `--user-data-dir=${prof}`, "--virtual-time-budget=6000", ...extra, target];
  return new Promise(res => {
    let stdout = "";
    const p = spawn(CHROME, argv, { stdio: ["ignore", "pipe", "ignore"] });
    p.stdout.on("data", d => (stdout += d));
    p.on("close", () => { try { rmSync(prof, { recursive: true, force: true }); } catch {} res(stdout); });
  });
}
async function pool(items, n, fn) {
  const it = items.entries(); const work = async () => { for (const [i, x] of it) await fn(x, i); };
  await Promise.all([...Array(Math.min(n, items.length))].map(work));
}

const issues = {};
await pool(ids, +(val("jobs") || 4), async id => {
  const png = join(out, `${pad(index[id])}-${id}.png`);
  await chrome(["--window-size=1920,1080", `--screenshot=${png}`], url(id));
  if (CHECK) {
    const dom = await chrome(["--window-size=1920,1080", "--dump-dom"], url(id));
    const m = dom.match(/<script type="application\/json" id="check-out">([\s\S]*?)<\/script>/);
    if (m) { try { const r = JSON.parse(m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")); if (r.issues.length) issues[id] = r.issues; } catch {} }
    else if (!LIB) { if (dom.includes('<div class="ovf-badge"')) issues[id] = [{ why: "overflow", el: "(check/ の PNG の赤枠)" }]; }
    else issues[id] = [{ why: "check-not-run", el: "検査の結果が読めない（runtime.js が古い → deck.mjs update）" }];
  }
  console.log(png);
});

if (flag("sheet")) {
  const files = readdirSync(out).filter(f => /^\d{2,3}-.*\.png$/.test(f)).sort();
  const cols = 4, w = 460, h = 259, rows = Math.ceil(files.length / cols);
  const sheet = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#d9dde5;font:600 15px sans-serif;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:16px 20px}figure{margin:0}img{width:${w}px;height:${h}px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.2)}figcaption{margin-top:4px;color:#333}</style>`
    + files.map(f => `<figure><img src="${f}"><figcaption>${f.replace(/\.png$/, "")}</figcaption></figure>`).join("");
  writeFileSync(join(out, "sheet.html"), sheet);
  await chrome([`--window-size=${cols * (w + 20) + 20},${rows * (h + 40) + 40}`, `--screenshot=${join(out, "sheet.png")}`], pathToFileURL(join(out, "sheet.html")).href);
  console.log(join(out, "sheet.png"));
}

if (CHECK) {
  const bad = Object.keys(issues).sort((a, b) => index[a] - index[b]);
  if (!bad.length) console.log("問題: なし");
  else {
    console.log(`問題: ${bad.length} ページ（赤枠は ${out} の PNG）`);
    for (const id of bad) {
      console.log(`  ${pad(index[id])}-${id}`);
      issues[id].slice(0, 10).forEach(x => console.log(`    - ${x.why}: ${x.el}`));
      if (issues[id].length > 10) console.log(`    … ほか ${issues[id].length - 10} 件`);
    }
    process.exitCode = 1;
  }
}
