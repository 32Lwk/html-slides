#!/usr/bin/env node
// デッキ（1 ファイルの HTML スライド）を作る・部品を最新にする・テーマなどを変える。
//   node deck.mjs new <dir> [--mode doc|pitch] [--theme green|navy|mono|blue|wa|dark] [--lang ja|en] [--name slides.html] [--title "…"]
//   node deck.mjs update <deck.html>                     … 埋め込みの CSS・JS（/*LIB:…*/）を assets の最新に差し替え、fonts/ を置く
//   node deck.mjs set <deck.html> [--theme …] [--mode …] [--lang …]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const THEMES = ["green", "navy", "mono", "blue", "wa", "dark"];
const [cmd, target, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith("--")) opt[rest[i].slice(2)] = rest[i + 1]?.startsWith("--") || rest[i + 1] === undefined ? true : rest[++i];

const die = m => { console.error(m); process.exit(1); };
const read = p => readFileSync(join(ROOT, p), "utf8");
const libCss = () => read("assets/themes.css") + "\n" + read("assets/slides.css");
const libJs = () => ["runtime.js", "tables.js", "charts.js", "diagrams.js"].map(f => read("assets/" + f)).join("\n");

function fillLib(html) {
  const put = (h, tag, body) => {
    const re = new RegExp(`/\\*LIB:${tag}\\*/[\\s\\S]*?/\\*END LIB:${tag}\\*/`);
    if (!re.test(h)) die(`/*LIB:${tag}*/ … /*END LIB:${tag}*/ の印がありません`);
    return h.replace(re, () => `/*LIB:${tag}*/\n${body}\n/*END LIB:${tag}*/`);
  };
  return put(put(html, "CSS", libCss()), "JS", libJs());
}
function setAttrs(html, o) {
  return html.replace(/<html\b[^>]*>/, tag => {
    let t = tag;
    const set = (name, v) => { t = new RegExp(`\\s${name}="[^"]*"`).test(t) ? t.replace(new RegExp(`\\s${name}="[^"]*"`), ` ${name}="${v}"`) : t.replace(/>$/, ` ${name}="${v}">`); };
    if (o.lang) set("lang", o.lang);
    if (o.theme) { if (!THEMES.includes(o.theme)) die(`theme は ${THEMES.join(" / ")}`); set("data-theme", o.theme); }
    if (o.mode) { if (!["doc", "pitch"].includes(o.mode)) die("mode は doc / pitch"); set("data-mode", o.mode); }
    return t;
  });
}
function copyFonts(dir) {
  mkdirSync(join(dir, "fonts"), { recursive: true });
  for (const f of readdirSync(join(ROOT, "assets/fonts"))) {
    const dst = join(dir, "fonts", f);
    if (!existsSync(dst)) copyFileSync(join(ROOT, "assets/fonts", f), dst);
  }
}

if (cmd === "new") {
  if (!target) die("usage: node deck.mjs new <dir> [--mode doc|pitch] [--theme …] [--lang ja|en] [--name slides.html] [--title …]");
  const mode = opt.mode || "doc", lang = opt.lang || "ja", theme = opt.theme || "green";
  const dir = resolve(target);
  const name = opt.name || (mode === "pitch" ? "pitch.html" : "slides.html");
  const out = join(dir, name);
  if (existsSync(out) && !opt.force) die(`${out} はもうあります（上書きは --force）`);
  mkdirSync(join(dir, "illust"), { recursive: true });
  let html = read(`templates/${mode}.html`);
  html = setAttrs(fillLib(html), { lang, theme, mode });
  if (opt.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${opt.title}</title>`);
  writeFileSync(out, html);
  copyFonts(dir);
  console.log(`作成: ${out}\n  mode=${mode} theme=${theme} lang=${lang}\n  fonts/ と illust/ を置きました。見本のページを書き換えるか消してください。`);
  if (html.includes("<!--MAP:")) {
    if (!existsSync(join(ROOT, "scripts/node_modules/d3-geo"))) console.log("  見本の地図は空です（scripts/ で npm install のあと make-map.mjs を実行）");
    else {
      const r = spawnSync(process.execPath, [join(ROOT, "scripts/make-map.mjs"), join(ROOT, "templates/maps.json"), "--into", out], { encoding: "utf8" });
      if (r.status) console.log("  見本の地図を作れませんでした:", r.stderr.trim());
    }
  }
} else if (cmd === "update") {
  if (!target || !existsSync(target)) die("usage: node deck.mjs update <deck.html>");
  writeFileSync(target, fillLib(readFileSync(target, "utf8")));
  copyFonts(dirname(resolve(target)));
  console.log(`更新: ${target}（CSS・JS を最新に、fonts/ を確認）`);
} else if (cmd === "set") {
  if (!target || !existsSync(target)) die("usage: node deck.mjs set <deck.html> [--theme …] [--mode …] [--lang …]");
  writeFileSync(target, setAttrs(readFileSync(target, "utf8"), opt));
  console.log(`設定: ${basename(target)} ${JSON.stringify(opt)}`);
} else {
  die("usage: node deck.mjs new|update|set …");
}
