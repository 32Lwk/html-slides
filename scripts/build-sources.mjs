#!/usr/bin/env node
// 出典（参考文献）と前提の一覧のページを sources.json から作り、デッキに埋め込む。
//   node build-sources.mjs <deck.html> <sources.json> [--md <sources.md>]
// - 外部の資料は、デッキの並びで最初に使うページの順に 1 から番号を振り、章ごとにまとめる（ページの並びを変えたら実行し直す）
// - 行の高さを Chrome で測ってページに分ける。<!-- SOURCES:BEGIN/END -->（一次調査・外部の資料）と
//   <!-- ASSUMPTIONS:BEGIN/END -->（前提の一覧。印がなければ SOURCES の後ろ）を置き換え、/*CITES*/ に各ページの出典の番号を書く
// - 全件の一覧（完全な URL）を Markdown に書き出す（既定は sources.json と同じフォルダの sources.md）
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runInDeck, withProbe, esc, deckPages, putBlock, putScript, isEn } from "./lib/deck.mjs";

const args = process.argv.slice(2);
const deck = args.find(a => a.endsWith(".html")), json = args.find(a => a.endsWith(".json"));
const val = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };
if (!deck || !json || !existsSync(deck) || !existsSync(json)) { console.error("usage: node build-sources.mjs <deck.html> <sources.json> [--md sources.md]"); process.exit(1); }

const FOOT_GAP = 16, SAFETY = 0.92;
const data = JSON.parse(readFileSync(json, "utf8"));
let src = readFileSync(deck, "utf8");
const EN = isEn(src);
const L = EN ? {
  src: "Sources", prim: "Primary research", ext: "External sources", asm: "Assumptions", whole: "Whole deck",
  extHead: "<tr><th>No.</th><th>Publisher “Title”</th><th>Date</th><th>Link</th><th>Pages</th></tr>",
  primHead: "<tr><th>No.</th><th>Research</th><th>Who / how many</th><th>When</th><th>Method</th><th>Record</th><th>Pages</th></tr>",
  asmHead: "<tr><th>Number</th><th>Value</th><th>Status</th><th>Basis</th><th>Where computed</th><th>Pages</th></tr>",
  primH1: n => `Primary research: ${n} studies we ran ourselves`, extH1: (a, b, g) => `External sources ${a === b ? a : `${a}–${b}`}: ${g}`,
  asmH1: m => `Assumptions${m}: numbers without an outside source, tagged plan / estimate / placeholder`,
  extFoot: d => (d ? `Links checked ${d}. ` : "") + "Rules, prices and laws change; re-check before relying on them.",
  asmFoot: "Plan = decided by us. Estimate = our calculation from research. Placeholder = to be replaced with measured values.",
  status: { plan: "Plan", est: "Estimate", tbd: "Placeholder" }, archived: "archived", chapters: "chapters",
} : {
  src: "出典", prim: "一次調査", ext: "外部の資料", asm: "前提の一覧", whole: "資料全体",
  extHead: "<tr><th>№</th><th>発行者「資料名」</th><th>日付</th><th>リンク</th><th>使うページ</th></tr>",
  primHead: "<tr><th>№</th><th>調査</th><th>だれ・何人</th><th>いつ</th><th>方法</th><th>記録</th><th>使うページ</th></tr>",
  asmHead: "<tr><th>数字</th><th>置いた値</th><th>状態</th><th>置き方・理由</th><th>計算の場所</th><th>使うページ</th></tr>",
  primH1: n => `一次調査：自分たちで聞いた${n}件の声`, extH1: (a, b, g) => `外部の資料 ${a === b ? a : `${a}〜${b}`}：${g}`,
  asmH1: m => `前提の一覧${m}：出典のない数字を、計画・推計・仮置きに分ける`,
  extFoot: d => (d ? `${d} にリンクを確認。` : "") + "規約・料金・法令は変わるので、使う前に最新版を確かめ直す",
  asmFoot: "計画＝自分たちで決めた値。推計＝調べた数字からの計算。仮置き＝実績で置き直す値",
  status: { plan: "計画", est: "推計", tbd: "仮置き" }, archived: "保存版", chapters: "の章",
};
const STATUS = { 計画: "plan", plan: "plan", 推計: "est", est: "est", estimate: "est", 仮置き: "tbd", tbd: "tbd", placeholder: "tbd" };
const EXT_COLS = '<colgroup><col style="width:60px"><col><col style="width:140px"><col style="width:400px"><col style="width:230px"></colgroup>';
const PRIM_COLS = '<colgroup><col style="width:60px"><col style="width:290px"><col style="width:320px"><col style="width:150px"><col><col style="width:250px"><col style="width:170px"></colgroup>';
const ASM_COLS = '<colgroup><col style="width:300px"><col style="width:250px"><col style="width:120px"><col><col style="width:260px"><col style="width:170px"></colgroup>';

const GEN = attrs => /data-gen="sources"/.test(attrs);
const { order, chap } = deckPages(src, (id, attrs) => GEN(attrs), EN);
const missing = new Set();
const keep = ps => (ps || []).filter(p => (p in order) || (missing.add(p), false));
const byOrder = ps => [...ps].sort((a, b) => order[a] - order[b]);
const pageLinks = ps => byOrder(ps).map(p => `<a class="pgl" href="#${esc(p)}">${esc(p)}</a>`).join("");
const shortUrl = (u, n = 44) => {
  try { const p = new URL(u); let s = p.host.replace(/^www\./, "") + decodeURIComponent(p.pathname).replace(/\/$/, ""); if (p.search && s.length < 30) s += decodeURIComponent(p.search); return s.length <= n ? s : s.slice(0, n - 1) + "…"; }
  catch { return u; }
};

const prim = (data.primary || []).map(p => ({ ...p, pages: keep(p.pages) }));
const ext = (data.external || []).map((e, i) => ({ ...e, pages: keep(e.pages), _i: i }));
ext.forEach(e => { e._first = e.pages.length ? Math.min(...e.pages.map(p => order[p])) : 1e9; });
ext.sort((a, b) => a._first - b._first || a._i - b._i);
ext.forEach((e, i) => { e.no = i + 1; e.group = e.pages.length ? chap[byOrder(e.pages)[0]] : L.whole; });
const asm = (data.assumptions || []).map((a, i) => ({ ...a, id: a.id || `A${i + 1}`, pages: keep(a.pages), st: STATUS[String(a.status || "").toLowerCase()] || "tbd" }));
/* 文の中の {{key}} を、振り直したあとの外部の資料の番号にする（番号を手で書くと、並びを変えたときにずれる） */
const hand = [...prim, ...asm].filter(o => /外部の資料\s*\d|source\s*\d/i.test(`${o.basis || ""}${o.how || ""}`)).map(o => o.id);
const noOf = Object.fromEntries(ext.filter(e => e.key).map(e => [e.key, e.no]));
const badKeys = new Set();
const fill = s => (typeof s === "string" ? s.replace(/\{\{([\w-]+)\}\}/g, (m, k) => (k in noOf ? String(noOf[k]) : (badKeys.add(k), m))) : s);
[...prim, ...ext, ...asm].forEach(o => { for (const f of ["name", "who", "how", "where", "title", "note", "item", "value", "basis"]) o[f] = fill(o[f]); });

const extRow = e => {
  const link = e.archive || e.url || "";
  return `<tr id="srow-${e.no}"><td class="no">${e.no}</td><td><span class="pub">${esc(e.pub)}</span>「${esc(e.title)}」${e.note ? ` <span class="nt">${esc(e.note)}</span>` : ""}</td>`
    + `<td class="dt">${esc(e.date)}</td><td class="u">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(shortUrl(link))}</a>` : ""}${e.archive ? `<span class="stag">${L.archived}</span>` : ""}</td>`
    + `<td class="pg">${pageLinks(e.pages)}</td></tr>`;
};
const primRow = p => `<tr id="srow-${esc(p.id)}"><td class="no">${esc(p.id)}</td><td><span class="pub">${esc(p.name)}</span></td><td>${esc(p.who)}</td>`
  + `<td class="dt">${esc(p.when)}</td><td>${esc(p.how)}</td><td class="nt">${esc(p.where)}</td><td class="pg">${pageLinks(p.pages)}</td></tr>`;
const asmRow = a => `<tr id="srow-${esc(a.id)}"><td><span class="pub">${esc(a.item)}</span></td><td>${esc(a.value)}</td>`
  + `<td><span class="st ${a.st}">${L.status[a.st]}</span></td><td>${esc(a.basis)}</td><td class="nt">${esc(a.where)}</td><td class="pg">${pageLinks(a.pages)}</td></tr>`;
const table = (cls, cols, head, rows) => `  <table class="src${cls ? " " + cls : ""}">\n${cols}\n${head}\n${rows}\n  </table>`;
const section = (id, kicker, h1, body, footL, footR) =>
  `<section id="${id}" data-gen="sources" data-sparse-ok>\n  <div class="kicker">${kicker}</div>\n  <h1>${esc(h1)}</h1>\n  <div class="rule"></div>\n${body}\n`
  + `  <div class="foot"><span>${esc(footL)}</span><span>${esc(footR)}</span></div>\n</section>\n`;

/* 行の高さを測る：全部の行を 1 ページに描き、表の頭の下から注記の上までの高さを出す */
const stripBlocks = s => s.replace(/<!--\s*(SOURCES|ASSUMPTIONS):BEGIN\s*-->[\s\S]*?<!--\s*\1:END\s*-->/g, "");
const measureBody =
  table("prim", PRIM_COLS, L.primHead, prim.map(primRow).join("\n")).replace("<table", '<table data-k="prim"') + "\n"
  + table("", EXT_COLS, L.extHead, `<tr class="grp"><td colspan="5">${L.ext}</td></tr>\n` + ext.map(extRow).join("\n")).replace("<table", '<table data-k="ext"') + "\n"
  + table("asmt", ASM_COLS, L.asmHead, asm.map(asmRow).join("\n")).replace("<table", '<table data-k="asm"');
const mpage = section("hs-measure", "SOURCES", L.extH1(1, 99, L.src), measureBody, L.extFoot(data.checked), `${L.src} 1/9`);
let mdoc = putBlock(stripBlocks(src), "SOURCES", mpage);
const m = await runInDeck(resolve(deck), withProbe(mdoc, `
  const s = document.getElementById("hs-measure"), k = s.getBoundingClientRect().width / 1920, top = s.getBoundingClientRect().top;
  const y = el => (el.getBoundingClientRect().top - top) / k, h = el => el.getBoundingClientRect().height / k;
  const t0 = s.querySelector("table.src"), out = { rows: {}, head: {} };
  out.start = y(t0);
  s.querySelectorAll("table.src").forEach(t => { out.head[t.dataset.k] = h(t.rows[0]); });
  out.foot = y(s.querySelector(".foot"));
  out.grp = h(s.querySelector("tr.grp"));
  s.querySelectorAll("tr[id]").forEach(r => { out.rows[r.id] = h(r); });
  window.__hsDone(out);`), "hs-measure");
if (m.error) { console.error("測れませんでした:", m.error); process.exit(1); }
const limit = k => (m.foot - FOOT_GAP - m.start - m.head[k]) * SAFETY;

function paginate(items, height, lim, group = () => null, gh = 0) {
  const pages = [];
  let cur = [], h = 0, last;
  for (const it of items) {
    const g = group(it);
    let need = height(it) + (g !== null && g !== last ? gh : 0);
    if (cur.length && h + need > lim) { pages.push(cur); cur = []; h = 0; last = undefined; need = height(it) + (g !== null ? gh : 0); }
    cur.push(it); h += need; last = g;
  }
  if (cur.length) pages.push(cur);
  return pages;
}
const primPages = prim.length ? paginate(prim, p => m.rows[`srow-${p.id}`] || 60, limit("prim")) : [];
const extPages = paginate(ext, e => m.rows[`srow-${e.no}`] || 40, limit("ext"), e => e.group, m.grp);
const asmPages = paginate(asm, a => m.rows[`srow-${a.id}`] || 40, limit("asm"));
const total = primPages.length + extPages.length;

/* ページを作る */
let html = "", k = 0;
const pageOf = {};
primPages.forEach((rows, j) => {
  k++;
  const id = j ? `src-prim-${j + 1}` : "src-prim";
  rows.forEach(p => (pageOf[p.id] = id));
  html += section(id, `SOURCES · ${k}/${total}`, L.primH1(prim.length), table("prim", PRIM_COLS, L.primHead, rows.map(primRow).join("\n")),
    data.primaryFoot || "", `${L.src} ${k}/${total}`);
});
extPages.forEach((rows, j) => {
  k++;
  const id = `src-${j + 1}`, trs = [];
  let last;
  rows.forEach(e => {
    pageOf[String(e.no)] = id;
    if (e.group !== last) { trs.push(`<tr class="grp"><td colspan="5">${esc(e.group)}</td></tr>`); last = e.group; }
    trs.push(extRow(e));
  });
  const gs = [...new Set(rows.map(e => e.group))];
  const g = gs.length === 1 ? gs[0] : gs.map(x => x.split(" ")[0]).join("・") + L.chapters;
  html += section(id, `SOURCES · ${k}/${total}`, L.extH1(rows[0].no, rows[rows.length - 1].no, g), table("", EXT_COLS, L.extHead, trs.join("\n")),
    data.foot || L.extFoot(data.checked), `${L.src} ${k}/${total}`);
});
let asmHtml = "";
asmPages.forEach((rows, j) => {
  const id = j ? `assump-${j + 1}` : "assump";
  rows.forEach(a => (pageOf[a.id] = id));
  const more = asmPages.length > 1 ? `（${j + 1}/${asmPages.length}）` : "";
  asmHtml += section(id, `ASSUMPTIONS${asmPages.length > 1 ? ` · ${j + 1}/${asmPages.length}` : ""}`, L.asmH1(more),
    table("asmt", ASM_COLS, L.asmHead, rows.map(asmRow).join("\n")), data.assumptionsFoot || L.asmFoot, L.asm);
});

/* 各ページの出典欄の番号 */
const cites = { src: {}, pages: {} };
const push = (pg, n) => (cites.pages[pg] ||= []).push(n);
prim.forEach(p => { cites.src[p.id] = { p: pageOf[p.id], t: p.name }; p.pages.forEach(pg => push(pg, p.id)); });
ext.forEach(e => { cites.src[e.no] = { p: pageOf[e.no], t: `${e.pub || ""}「${e.title || ""}」${e.date || ""}` }; e.pages.forEach(pg => push(pg, String(e.no))); });
asm.forEach(a => { cites.src[a.id] = { p: pageOf[a.id], t: `${a.item}：${a.value}（${L.status[a.st]}）` }; a.pages.forEach(pg => push(pg, a.id)); });
for (const pg in cites.pages) {
  const rank = n => (/^\d+$/.test(n) ? 1 : cites.src[n]?.p?.startsWith("assump") ? 2 : 0);
  cites.pages[pg] = [...new Set(cites.pages[pg])].sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? a - b : a.localeCompare(b, "en", { numeric: true })));
}

const hasAsmBlock = /<!--\s*ASSUMPTIONS:BEGIN\s*-->/.test(src);
src = putBlock(src, "SOURCES", hasAsmBlock ? html : html + asmHtml, "<!-- GLOSSARY:BEGIN -->");
if (hasAsmBlock) src = putBlock(src, "ASSUMPTIONS", asmHtml);
src = putScript(src, "CITES", cites);
writeFileSync(deck, src);

/* Markdown の一覧 */
const md = val("md") || join(dirname(resolve(json)), "sources.md");
const T = [`# ${L.src}`, "", (EN ? `Generated from ${json} by build-sources.mjs (do not edit by hand).` : `${json} から build-sources.mjs で作る（手で直さない）。`) + (data.checked ? (EN ? ` Links checked ${data.checked}.` : ` リンクの確認 ${data.checked}。`) : ""), ""];
if (prim.length) {
  T.push(`## ${L.prim}`, "", EN ? "| No. | Research | Who | When | Method | Record | Pages |" : "| № | 調査 | だれ・何人 | いつ | 方法 | 記録 | 使うページ |", "|---|---|---|---|---|---|---|");
  prim.forEach(p => T.push(`| ${p.id} | ${p.name} | ${p.who || ""} | ${p.when || ""} | ${p.how || ""} | ${p.where || ""} | ${byOrder(p.pages).join(", ")} |`));
  T.push("");
}
T.push(`## ${L.ext}`);
let lastG;
ext.forEach(e => {
  if (e.group !== lastG) { T.push("", `### ${e.group}`, "", EN ? "| No. | Publisher “Title” | Date | URL | Pages |" : "| № | 発行者「資料名」 | 日付 | URL | 使うページ |", "|---|---|---|---|---|"); lastG = e.group; }
  T.push(`| ${e.no} | ${e.pub || ""}「${e.title || ""}」${e.note ? `（${e.note}）` : ""} | ${e.date || ""} | ${e.url || ""}${e.archive ? `（${L.archived}: ${e.archive}）` : ""} | ${byOrder(e.pages).join(", ")} |`);
});
if (asm.length) {
  T.push("", `## ${L.asm}`, "", EN ? "| ID | Number | Value | Status | Basis | Where | Pages |" : "| ID | 数字 | 置いた値 | 状態 | 置き方・理由 | 計算の場所 | 使うページ |", "|---|---|---|---|---|---|---|");
  asm.forEach(a => T.push(`| ${a.id} | ${a.item} | ${a.value} | ${L.status[a.st]} | ${a.basis || ""} | ${a.where || ""} | ${byOrder(a.pages).join(", ")} |`));
}
writeFileSync(md, T.join("\n") + "\n");

console.log(`${L.prim} ${prim.length}・${L.ext} ${ext.length}（${extPages.length} ページ）・${L.asm} ${asm.length}（${asmPages.length} ページ）→ ${deck}`);
console.log(`一覧: ${md}`);
if (missing.size) console.log("デッキにないページ id（無視した）:", [...missing].join(", "));
if (badKeys.size) console.log("external にない {{key}}（そのまま残した）:", [...badKeys].join(", "));
if (hand.length) console.log("番号を手で書いた行（並びが変わるとずれる。{{key}} にする）:", hand.join(", "));
const unused = ext.filter(e => !e.pages.length).map(e => e.no);
if (unused.length) console.log("どのページでも使っていない外部の資料:", unused.join(", "));
