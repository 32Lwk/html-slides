// スクリプトで共通に使う部品：Chrome を探して動かす・デッキのページの並び・印の間の置き換え・HTML の書き出し
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export function findChrome() {
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
  const hit = P.find(p => p && existsSync(p));
  if (!hit) { console.error("Chrome / Edge が見つかりません。CHROME=… で場所を指定してください"); process.exit(1); }
  return hit;
}

/** HTML の文字列を、デッキと同じフォルダ（fonts/・illust/ が効く）に一時ファイルとして置き、Chrome で開いて <pre id="out"> の JSON を返す */
export async function runInDeck(deckPath, html, hash = "", budget = 12000) {
  const tmp = join(dirname(deckPath), `.hs-tmp-${process.pid}-${Date.now()}.html`);
  writeFileSync(tmp, html);
  const prof = mkdtempSync(join(tmpdir(), "hs-chrome-"));
  const argv = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--force-device-scale-factor=1", "--allow-file-access-from-files", `--user-data-dir=${prof}`, "--window-size=1920,1080",
    `--virtual-time-budget=${budget}`, "--dump-dom", pathToFileURL(tmp).href + (hash ? "#" + hash : "")];
  const dom = await new Promise(res => {
    let out = "";
    const p = spawn(findChrome(), argv, { stdio: ["ignore", "pipe", "ignore"] });
    p.stdout.on("data", d => (out += d));
    p.on("close", () => res(out));
  });
  try { rmSync(tmp); rmSync(prof, { recursive: true, force: true }); } catch {}
  const m = dom.match(/<pre id="hs-out">([\s\S]*?)<\/pre>/);
  if (!m) { console.error("Chrome から結果を読めませんでした（CHROME=… で別の Chrome を試す）"); process.exit(1); }
  return JSON.parse(m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
}

/** ページで動かす JS を </body> の前に差し込む。fn は window.__hsDone(obj) を呼んで結果を返す */
export function withProbe(html, js) {
  const probe = `<script>window.__hsDone = o => { const p = document.createElement("pre"); p.id = "hs-out"; p.textContent = JSON.stringify(o); document.body.appendChild(p); };
addEventListener("load", () => setTimeout(async () => { try { ${js} } catch (e) { window.__hsDone({ error: String(e) }); } }, 1200));</script>`;
  return html.replace(/<\/body>(?![\s\S]*<\/body>)/, probe + "</body>");
}

export const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** デッキの <section> の並び。skip に当たる id（作ったページ自身）は除く。chap は直前の中扉の「番号 題」 */
export function deckPages(src, skip = () => false, en = false) {
  const order = {}, chap = {}, list = [];
  let cur = en ? "Opening" : "はじめに";
  for (const m of src.matchAll(/<section\b([^>]*)>/g)) {
    const attrs = m[1], id = attrs.match(/\bid="([^"]+)"/)?.[1];
    if (!id || skip(id, attrs)) continue;
    if (/\bclass="[^"]*\bchap\b/.test(attrs)) {
      const n = attrs.match(/data-n="([^"]*)"/)?.[1] || "", t = attrs.match(/data-t="([^"]*)"/)?.[1] || "";
      cur = [n, t].filter(Boolean).join(" ");
    }
    order[id] = list.length;
    chap[id] = cur;
    list.push(id);
  }
  return { order, chap, list };
}

/** <!--NAME:BEGIN--> … <!--NAME:END--> を置き換える。なければ before の前（なければ最初のデッキ用 <script> の前）に足す */
export function putBlock(src, name, body, before) {
  const re = new RegExp(`<!--\\s*${name}:BEGIN\\s*-->[\\s\\S]*?<!--\\s*${name}:END\\s*-->`);
  const block = `<!-- ${name}:BEGIN -->\n${body}<!-- ${name}:END -->`;
  if (re.test(src)) return src.replace(re, () => block);
  const at = (before && src.indexOf(before) >= 0) ? src.indexOf(before) : src.search(/<script>\s*\/\*DATA\*\//);
  if (at < 0) throw new Error(`${name} を入れる場所が見つかりません（<!-- ${name}:BEGIN --><!-- ${name}:END --> をデッキに書く）`);
  return src.slice(0, at) + block + "\n\n" + src.slice(at);
}

/** /*NAME*\/ … /*END NAME*\/ の中身を window.NAME = …; にする。なければ /*DATA*\/ の script の後ろに足す */
export function putScript(src, name, value) {
  const re = new RegExp(`/\\*${name}\\*/[\\s\\S]*?/\\*END ${name}\\*/`);
  const body = `/*${name}*/window.${name} = ${JSON.stringify(value)};/*END ${name}*/`;
  if (re.test(src)) return src.replace(re, () => body);
  const m = src.match(/<script>\s*\/\*DATA\*\/[\s\S]*?<\/script>/);
  if (!m) throw new Error(`/*${name}*/ を入れる場所が見つかりません（<script>/*DATA*/…</script> のあるデッキで動かす）`);
  const at = m.index + m[0].length;
  return src.slice(0, at) + `\n<script>${body}</script>` + src.slice(at);
}

export const isEn = src => /<html\b[^>]*\blang="en/i.test(src);
