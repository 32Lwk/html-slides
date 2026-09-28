#!/usr/bin/env node
// 専門家役のレビュー（review.json）を、評価の集計・弱点・質問の一覧・専門家ごとの質疑応答・ページ別の参照索引の Markdown にする。
//   node build-review.mjs <review.json> [--pages <name>-pages.json] [--out <review.md>] [--experts 20 --questions 5]
// ページ番号と見出しは audit.mjs が書く <name>-pages.json から引く（既定は review.json と同じフォルダの <deck の名前>-pages.json）。
// review.json の形は reference/review.md。参照の id がデッキにない・評価が A/B/C でない・人数や問いの数が違うときは知らせる
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
const json = args.find(a => a.endsWith(".json") && !a.endsWith("-pages.json"));
const val = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };
if (!json || !existsSync(json)) { console.error("usage: node build-review.mjs <review.json> [--pages x-pages.json] [--out review.md] [--experts 20 --questions 5]"); process.exit(1); }
const R = JSON.parse(readFileSync(json, "utf8"));
const deckBase = basename(R.deck || "slides.html", ".html");
const pagesPath = val("pages") || join(dirname(resolve(json)), `${deckBase}-pages.json`);
if (!existsSync(pagesPath)) { console.error(`${pagesPath} がありません（先に node audit.mjs <deck.html> を実行する）`); process.exit(1); }
const PG = JSON.parse(readFileSync(pagesPath, "utf8"));
const byId = Object.fromEntries(PG.pages.map(p => [p.id, p]));
const warn = [];
const pn = id => (byId[id] ? `p.${byId[id].n} #${id}` : (warn.push(`デッキにない参照 #${id}`), `#${id}`));
const sortRefs = rs => [...new Set(rs)].sort((a, b) => (byId[a]?.n ?? 1e9) - (byId[b]?.n ?? 1e9));
const pad = n => String(n).padStart(2, "0");
const cell = s => String(s ?? "").replace(/\|/g, "｜").replace(/\n+/g, " ");

const E = R.experts || [];
const wantE = +(val("experts") || 0), wantQ = +(val("questions") || 0);
if (wantE && E.length !== wantE) warn.push(`専門家が ${E.length} 人（指定は ${wantE} 人）`);
E.forEach((e, i) => {
  e.no = i + 1;
  if (wantQ && (e.qs || []).length !== wantQ) warn.push(`${pad(e.no)} ${e.role} の問いが ${(e.qs || []).length} 個（指定は ${wantQ} 個）`);
  (e.qs || []).forEach((q, j) => {
    q.id = `Q${pad(e.no)}-${j + 1}`;
    q.grade = String(q.grade || "").trim().toUpperCase();
    if (!["A", "B", "C"].includes(q.grade)) warn.push(`${q.id} の評価「${q.grade}」が A/B/C でない`);
    q.refs = sortRefs(q.refs || []);
    if (!q.refs.length) warn.push(`${q.id} に参照ページがない`);
  });
});
const all = E.flatMap(e => e.qs || []);
const cnt = g => all.filter(q => q.grade === g).length;
const date = R.date || new Date().toISOString().slice(0, 10);
const title = R.title || PG.title || deckBase;

const L = [`# ${title} 専門家${E.length}人の質疑応答`, "",
  "| 項目 | 内容 |", "|---|---|",
  `| 作成日 | ${date} |`,
  `| 対象 | \`${R.deck || PG.deck}\`（全${PG.pages.length}ページ。描いたあとの本文を audit.mjs で書き出して読んだ） |`,
  `| 方法 | ${cell(R.method || `${E.length}の専門分野の審査員を役として立て、各自が資料を読んで厳しい質問を出し、そのあと資料の記載だけを根拠に答える`)} |`,
  `| 件数 | ${E.length}人 × ${Math.max(0, ...E.map(e => (e.qs || []).length))}問 ＝ ${all.length}問 |`, "",
  "## 読み方", "",
  `- **ページ番号**は \`${R.deck || PG.deck}\` の通し番号で、\`p.12 #growth\` は12ページ目、\`${R.deck || PG.deck}#growth\` で開けるページです。末尾に「ページ別の参照索引」があります。`,
  "- **回答**は発表者が資料だけで答える想定の文です。資料にない事実や数字は足していません。資料に答えがなければ、ないと書いています。",
  "- **評価**は回答の強さです。",
  "  - A: 資料で十分に答えられる",
  "  - B: 部分的に答えられる（前提・仮置き・これから確かめる）",
  "  - C: 資料に答えがない、または弱点", "",
  "## 1. 評価の集計", "",
  `全${all.length}問のうち、A が ${cnt("A")}問、B が ${cnt("B")}問、C が ${cnt("C")}問です。${R.summary ? cell(R.summary) : ""}`, "",
  "| No. | 分野 | A | B | C |", "|---|---|---|---|---|",
  ...E.map(e => { const g = x => (e.qs || []).filter(q => q.grade === x).length; return `| ${pad(e.no)} | [${cell(e.role)}](#${pad(e.no)}) | ${g("A")} | ${g("B")} | ${g("C")} |`; }), ""];

L.push("## 2. 何人もが同じ所を突いた弱点", "", "### 2-1. 繰り返し出た論点", "");
if ((R.issues || []).length) {
  L.push("| 論点 | 突いた専門家 | 資料での扱い | 主な参照 |", "|---|---|---|---|");
  R.issues.forEach(x => L.push(`| ${cell(x.topic)} | ${(x.by || []).map(pad).join("・")} | ${cell(x.deck)} | ${sortRefs(x.refs || []).map(pn).join(", ")} |`));
} else L.push("なし");
L.push("", "### 2-2. 原文で確かめた、資料の中の食い違い", "", "専門家の指摘のうち、原文を読んで実際に食い違っていたものです。直すかどうかは別に判断してください。", "");
if ((R.conflicts || []).length) {
  /* fixed：レビューのあとに直した中身（直したらページ番号は直す前のもののまま残す） */
  const fx = R.conflicts.some(x => x.fixed);
  L.push(fx ? "| 箇所 | 食い違い | レビューのあと |" : "| 箇所 | 食い違い |", fx ? "|---|---|---|" : "|---|---|");
  R.conflicts.forEach(x => L.push(`| ${sortRefs(x.refs || []).map(pn).join("・")} | ${cell(x.what)} |${fx ? ` ${x.fixed ? "直した：" + cell(x.fixed) : "未対応"} |` : ""}`));
} else L.push("なし");
if ((R.notes || []).length) { L.push("", "### 2-3. まとめるときに直した点", ""); R.notes.forEach(x => L.push(`- ${x}`)); }

L.push("", "## 3. 質問の一覧", "", "| 番号 | 質問 | 評価 | 参照ページ |", "|---|---|---|---|");
all.forEach(q => L.push(`| ${q.id} | ${cell(q.title)} | ${q.grade} | ${q.refs.map(r => `p.${byId[r]?.n ?? "?"}`).join(", ")} |`));

L.push("", "## 4. 専門家ごとの質疑応答", "");
E.forEach(e => {
  L.push(`<a id="${pad(e.no)}"></a>`, "", `### ${pad(e.no)}. ${e.role}`);
  if (e.view) L.push(`> 観点: ${e.view}`);
  L.push("");
  (e.qs || []).forEach(q => {
    L.push(`#### ${q.id}. ${q.title}`, `**質問**: ${q.q}`, "", `**回答**: ${q.a}`, "", `**参照**: ${q.refs.map(pn).join(", ")}`, "", `**評価**: ${q.grade}${q.why ? `（${q.why}）` : ""}`, "");
  });
});

const idx = {};
all.forEach(q => q.refs.forEach(r => (idx[r] ||= []).push(q.id)));
const rows = Object.keys(idx).sort((a, b) => (byId[a]?.n ?? 1e9) - (byId[b]?.n ?? 1e9));
L.push("## 5. ページ別の参照索引", "", "| ページ | 見出し | 参照数 | 質問 |", "|---|---|---|---|");
rows.forEach(r => L.push(`| ${pn(r)} | ${cell(byId[r]?.h1 || "")} | ${idx[r].length} | ${idx[r].join(", ")} |`));
const top = [...rows].sort((a, b) => idx[b].length - idx[a].length).slice(0, 10);
const never = PG.pages.filter(p => !idx[p.id] && !/^(gl\d|src-|assump)/.test(p.id)).map(p => `p.${p.n} #${p.id}`);
L.push("", `参照の多い上位${top.length}ページ: ${top.map(r => `${pn(r)}（${idx[r].length}）`).join("、")}`, "");
if (never.length) L.push(`一度も参照されなかったページ: ${never.join("、")}`, "");

const out = val("out") || json.replace(/\.json$/, ".md");
writeFileSync(out, L.join("\n"));
console.log(`専門家 ${E.length}人・${all.length}問（A ${cnt("A")}・B ${cnt("B")}・C ${cnt("C")}）→ ${out}`);
[...new Set(warn)].forEach(w => console.log("  注意: " + w));
