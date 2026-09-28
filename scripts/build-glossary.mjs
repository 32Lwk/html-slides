#!/usr/bin/env node
// 用語集のページを glossary.json から作り、デッキに埋め込む。本文の下線（各ページで最初の1回）は runtime.js が window.GLOSS から引く。
//   node build-glossary.mjs <deck.html> <glossary.json>
// - 項目の高さを Chrome で測り、2列（左の列から順に）でページに分ける
// - <!-- GLOSSARY:BEGIN --> 〜 <!-- GLOSSARY:END -->（なければ DATA の script の前）を置き換え、/*GLOSS*/ に下線の言葉と飛び先を書く
// glossary.json:
//   { "groups": [{ "title": "市場の言葉", "terms": [{ "id": "ltv", "t": "LTV", "s": "1人から残る額", "d": "意味（1〜2文）",
//                  "p": "詳しく説明するページの id", "a": ["別の書き方"], "re": "正規表現（a の代わり）", "noauto": true }] }],
//     "links": [{ "id": "…", "t": "…", "d": "…", "a": ["本文の言葉"], "go": "飛び先のページ id", "fl": "光らせる要素の id" }] }
//   groups の代わりに "terms": [...] だけでもよい。noauto は本文に下線を引かない（用語集にだけ載せる）
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runInDeck, withProbe, esc, deckPages, putBlock, putScript, isEn } from "./lib/deck.mjs";

const args = process.argv.slice(2);
const deck = args.find(a => a.endsWith(".html")), json = args.find(a => a.endsWith(".json"));
if (!deck || !json || !existsSync(deck) || !existsSync(json)) { console.error("usage: node build-glossary.mjs <deck.html> <glossary.json>"); process.exit(1); }

const FOOT_GAP = 16, SAFETY = 0.94;
const data = JSON.parse(readFileSync(json, "utf8"));
let src = readFileSync(deck, "utf8");
const EN = isEn(src);
const L = EN ? { gl: "Glossary", more: "more", h1: (k, n, g) => `Glossary${n > 1 ? ` (${k}/${n})` : ""}: ${g}`, foot: "Hover an underlined word in the deck to see its meaning; click to jump here" }
  : { gl: "用語集", more: "詳しく", h1: (k, n, g) => `用語集${n > 1 ? `（${k}/${n}）` : ""}：${g}`, foot: "本文の点線の言葉にマウスを乗せると意味が出て、クリックするとここへ飛ぶ" };

const groups = data.groups || [{ title: data.title || L.gl, terms: data.terms || [] }];
const { order } = deckPages(src, (id, attrs) => /data-gen="glossary"/.test(attrs), EN);
const bad = new Set();
const items = groups.flatMap((g, gi) => g.terms.map(t => ({ ...t, gid: `gl-${t.id}`, group: g.title, gi })));
const dup = items.map(x => x.id).filter((x, i, a) => a.indexOf(x) !== i);
if (dup.length) { console.error("id が重複しています:", [...new Set(dup)].join(", ")); process.exit(1); }

const entry = t => {
  const p = t.p && (t.p in order ? t.p : (bad.add(t.p), null));
  return `<div class="ge" id="srow-${esc(t.gid)}"><b>${esc(t.t)}${t.s ? `<small>${esc(t.s)}</small>` : ""}</b><p>${esc(t.d)}${p ? ` <a class="ref" href="#${esc(p)}">${L.more}</a>` : ""}</p></div>`;
};
const gh = g => `<div class="gh">${esc(g)}</div>`;
const section = (id, kicker, h1, body) =>
  `<section id="${id}" data-gen="glossary" data-sparse-ok>\n  <div class="kicker">${kicker}</div>\n  <h1>${esc(h1)}</h1>\n  <div class="rule"></div>\n${body}\n`
  + `  <div class="foot"><span>${esc(data.foot || L.foot)}</span></div>\n</section>\n`;

/* 高さを測る：1列の幅で全部を並べる */
const mbody = `  <div class="gls"><div class="gc">${gh("M")}\n${items.map(entry).join("\n")}</div><div class="gc"></div></div>`;
const mdoc = putBlock(src.replace(/<!--\s*GLOSSARY:BEGIN\s*-->[\s\S]*?<!--\s*GLOSSARY:END\s*-->/, ""), "GLOSSARY", section("hs-measure", "GLOSSARY", L.h1(1, 9, "M"), mbody));
const m = await runInDeck(resolve(deck), withProbe(mdoc, `
  const s = document.getElementById("hs-measure"), k = s.getBoundingClientRect().width / 1920, top = s.getBoundingClientRect().top;
  const y = el => (el.getBoundingClientRect().top - top) / k, h = el => el.getBoundingClientRect().height / k, out = { rows: {} };
  out.start = y(s.querySelector(".gls"));
  out.foot = y(s.querySelector(".foot"));
  out.gh = h(s.querySelector(".gh"));
  s.querySelectorAll(".ge").forEach(r => { out.rows[r.id] = h(r); });
  window.__hsDone(out);`), "hs-measure");
if (m.error) { console.error("測れませんでした:", m.error); process.exit(1); }
const limit = (m.foot - FOOT_GAP - m.start) * SAFETY;

/* 左の列 → 右の列 → 次のページ。まとまりの見出しは列の頭か、まとまりが変わる所に入れる */
const pages = [];
let page = [[]], h = 0, last = null;
for (const it of items) {
  const need = () => m.rows[`srow-${it.gid}`] + (it.group !== last || !page[page.length - 1].length ? m.gh : 0);
  if (h + need() > limit && page[page.length - 1].length) {
    if (page.length === 1) page.push([]); else { pages.push(page); page = [[]]; }
    h = 0;
  }
  const col = page[page.length - 1];
  if (it.group !== last || !col.length) { col.push({ gh: it.group }); h += m.gh; }
  col.push(it); h += m.rows[`srow-${it.gid}`]; last = it.group;
}
if (page[0].length) pages.push(page);

let html = "";
const secOf = {};
pages.forEach((cols, i) => {
  const id = `gl${i + 1}`;
  const titles = [...new Set(cols.flat().filter(x => !x.gh).map(x => x.group))];
  cols.flat().forEach(x => { if (!x.gh) secOf[x.id] = id; });
  const body = `  <div class="gls">${cols.map(c => `<div class="gc">\n${c.map(x => (x.gh ? gh(x.gh) : entry(x))).join("\n")}\n</div>`).join("")}${cols.length < 2 ? '<div class="gc"></div>' : ""}</div>`;
  html += section(id, `GLOSSARY · ${i + 1}/${pages.length}`, L.h1(i + 1, pages.length, titles.join("・")), body);
});

/* 本文の下線：長い言葉から先に当てる（「上位プラン」を「プラン」より先に） */
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bound = w => (/^[A-Za-z0-9]/.test(w) ? "(?<![A-Za-z0-9])" : "") + escRe(w) + (/[A-Za-z0-9]$/.test(w) ? "(?![A-Za-z0-9])" : "");
const pattern = words => [...new Set(words.filter(Boolean))].sort((a, b) => b.length - a.length).map(bound).join("|");
const longest = e => Math.max(...[e.t, ...(e.a || [])].map(w => (w || "").length));
const gloss = [];
items.filter(t => !t.noauto).forEach(t => gloss.push({ id: t.gid, sec: secOf[t.id], t: t.t, d: t.d, re: t.re || pattern([t.t, ...(t.a || [])]), _n: t.re ? 99 : longest(t) }));
(data.links || []).forEach(l => {
  if (!(l.go in order)) { bad.add(l.go); return; }
  gloss.push({ id: `gl-${l.id}`, k: "link", sec: l.go, t: l.t, d: l.d, re: l.re || pattern([l.t, ...(l.a || [])]), ...(l.fl ? { fl: l.fl } : {}), _n: l.re ? 99 : longest(l) });
});
gloss.sort((a, b) => b._n - a._n).forEach(g => delete g._n);

src = putBlock(src, "GLOSSARY", html);
src = putScript(src, "GLOSS", gloss);
writeFileSync(deck, src);
console.log(`${L.gl} ${items.length} 語（${pages.length} ページ）・本文の下線 ${gloss.length} → ${deck}`);
if (bad.size) console.log("デッキにないページ id（リンクを外した）:", [...bad].join(", "));
