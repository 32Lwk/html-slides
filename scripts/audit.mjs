#!/usr/bin/env node
// 敵対的な検査（機械の分）：描いたあとのデッキを読み、ページをまたいだ数字の食い違い・出典のない数字・切れたリンクなどを一覧にする。
// あわせて、専門家役のレビュー（reference/review.md）が読む本文を書き出す。
//   node audit.mjs <deck.html> [--out <dir>] [--terms 売上高,営業利益] [--online]
// 書き出すもの（既定は <デッキのフォルダ>/review/）:
//   <name>-audit.md   検査の結果（エラー・要確認・参考）
//   <name>-text.md    ページごとの本文（見出し・本文・注記・出典の番号・発表者メモ）。レビューはこれだけを根拠に答える
//   <name>-pages.json ページ番号・id・見出し（build-review.mjs が使う）
// エラー（切れたリンク・出典の番号の不整合）があれば終了コード 1。--online で外部リンクも開いて確かめる
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { runInDeck, withProbe } from "./lib/deck.mjs";

const args = process.argv.slice(2);
const deck = args.find(a => a.endsWith(".html"));
const val = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };
if (!deck || !existsSync(deck)) { console.error("usage: node audit.mjs <deck.html> [--out dir] [--terms a,b] [--online]"); process.exit(1); }
const html = readFileSync(deck, "utf8");
const base = basename(deck, ".html");
const outDir = resolve(val("out") || join(dirname(resolve(deck)), "review"));
mkdirSync(outDir, { recursive: true });
const nsec = (html.match(/<section\b/g) || []).length;

/* ページで：1枚ずつ表示してグラフも描かせ、本文・リンク・手で書いた数字・出典の番号を集める */
const r = await runInDeck(resolve(deck), withProbe(html, `
  const ids = Slides.ids, pages = [];
  const HIDE = ".foot, .cites, .pno, aside.notes, .kicker, h1, .back, .ovf-badge, .chaps, .nav";
  const COMPUTED = "[data-f], .fin, .chart, .map, .pno, .cites, .pg, a.pgl, .kicker, .back, aside.notes, .chaps, .nav, [data-gen]";
  for (const id of ids) {
    location.hash = id;
    await new Promise(r => setTimeout(r, 140));
    const sec = document.getElementById(id), q = s => sec.querySelector(":scope " + s);
    const hidden = [...sec.querySelectorAll(HIDE)].map(e => [e, e.style.display]);
    hidden.forEach(([e]) => (e.style.display = "none"));
    const body = sec.innerText;
    hidden.forEach(([e, d]) => (e.style.display = d));
    const hand = [];
    const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const p = n.parentElement;
      if (!n.data.trim() || p.closest(COMPUTED) || p.closest("svg")) continue;
      hand.push({ t: n.data.replace(/\\s+/g, " ").trim(), foot: !!p.closest(".foot") });
    }
    pages.push({
      id, n: ids.indexOf(id) + 1,
      kind: sec.matches(".cover") ? "cover" : sec.matches(".chap") ? "chap" : sec.dataset.gen || "page",
      h1: (q("h1")?.innerText || "").replace(/\\s+/g, " ").trim(),
      body: body.replace(/\\n{3,}/g, "\\n\\n").trim(),
      foot: (q(".foot")?.innerText || "").replace(/\\s+/g, " ").trim(),
      notes: (q("aside.notes")?.textContent || "").replace(/\\s+/g, " ").trim(),
      kpis: [...sec.querySelectorAll(".kpi")].map(k => ({ k: k.querySelector(".k")?.innerText.trim() || "", v: k.querySelector(".v")?.innerText.replace(/\\s+/g, "").trim() || "" })),
      links: [...sec.querySelectorAll("a[href]")].map(a => ({ href: a.getAttribute("href"), text: a.innerText.replace(/\\s+/g, " ").trim().slice(0, 40), cls: a.className,
        ok: !a.getAttribute("href").startsWith("#") || a.getAttribute("href").length < 2 || !!document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1))) })),
      hand, cites: (window.CITES?.pages || {})[id] || [],
      gloss: [...sec.querySelectorAll("a.gl")].map(a => a.dataset.n || a.dataset.fl),
      checkIssues: [...sec.querySelectorAll(".ovf")].length,
    });
  }
  const chaps = {}; let cur = "";
  ids.forEach(id => { const s = document.getElementById(id); if (s.matches(".chap")) cur = [s.dataset.n, s.dataset.t].filter(Boolean).join(" "); chaps[id] = cur; });
  window.__hsDone({ title: document.title, pages, chaps, cites: window.CITES || null, gloss: (window.GLOSS || []).map(g => ({ id: g.id, k: g.k, t: g.t, re: g.re, sec: g.sec })) });`), "", 4000 + nsec * 400);
if (r.error) { console.error("読めませんでした:", r.error); process.exit(1); }

const P = r.pages, byId = Object.fromEntries(P.map(p => [p.id, p]));
const pn = id => (byId[id] ? `p.${byId[id].n} #${id}` : `#${id}`);
const content = P.filter(p => p.kind === "page");
const errors = [], warns = [], infos = [];

/* 1. 切れたリンク・出典の番号 */
P.forEach(p => p.links.filter(l => !l.ok).forEach(l => errors.push(`${pn(p.id)}：リンク「${l.text}」の飛び先 ${l.href} がない`)));
if (r.cites) {
  for (const id of Object.keys(r.cites.pages || {})) if (!byId[id]) errors.push(`出典の番号を付けるページ #${id} がデッキにない（sources.json の pages を直して build-sources.mjs をやり直す）`);
  for (const [no, s] of Object.entries(r.cites.src || {})) if (!s.p || !byId[s.p]) errors.push(`出典 ${no} の行があるページ #${s.p} がない（build-sources.mjs をやり直す）`);
}

/* 2. 出典のない数字：手で書いた「数＋単位」があるのに、出典の番号も前提へのリンクもないページ */
const NUM = /[−\-+]?\d[\d,]*(?:\.\d+)?\s*(?:万|億|千|百万)?\s*(?:円|%|％|ドル|人|件|倍|t|トン|kg|社|軒|箱|店|台)/g;
const SKIPNUM = /^\d+(?:か月目|年目|日目|年|月|日|位|章|つ|番)/;
content.forEach(p => {
  const nums = [...new Set(p.hand.filter(h => !h.foot).flatMap(h => h.t.match(NUM) || []))].filter(x => !SKIPNUM.test(x));
  const backed = p.cites.length || p.links.some(l => /assump|src-|fin-/.test(l.href));
  if (nums.length && !backed) warns.push(`${pn(p.id)}：出典のない数字 ${nums.slice(0, 6).join("・")}${nums.length > 6 ? ` ほか${nums.length - 6}` : ""}（出典の番号・前提の一覧へのリンクがない）`);
});

/* 3. ページをまたいだ数字の食い違いの候補：同じ言葉のすぐ後ろの「数＋単位」が、ページによって違う */
const labels = [];
(r.gloss || []).forEach(g => { try { labels.push({ name: g.t, re: new RegExp(g.re, "g") }); } catch {} });
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const kpiLabels = [...new Set(content.flatMap(p => p.kpis.map(k => k.k.replace(/[（(].*$/, "").trim())).filter(s => s.length >= 2))];
[...kpiLabels, ...(val("terms") || "").split(",").map(s => s.trim()).filter(Boolean)].forEach(t => { if (!labels.some(l => l.name === t)) labels.push({ name: t, re: new RegExp(escRe(t), "g") }); });
const MUL = { 千: 1e3, 万: 1e4, 百万: 1e6, 億: 1e8 };
const VAL = /^(?:\s|[はがもでを：:＝=・]|約|毎月|毎年|平均|最大|最低|全体の|月に|年に|1(?:人|箱|個|台|件|か月|日)(?:あたり)?|（[^）]{0,14}）|\([^)]{0,14}\))*([−\-]?\d[\d,]*(?:\.\d+)?)\s*(百万|千|万|億)?\s*(円|%|％|人|件|倍|か月|日|箱|軒|t|ドル)/;
const QUAL = /(\d+)\s*年目|(\d+)\s*か月目|Q\d|([1-9])\s*年(?!間)/;
const seen = {};
P.forEach(p => {
  const lines = [p.h1, ...p.body.split(/\n/), ...p.kpis.map(k => `${k.k} ${k.v}`)].filter(Boolean);
  lines.forEach(line => labels.forEach(l => {
    l.re.lastIndex = 0;
    for (let m; (m = l.re.exec(line));) {
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 24), v = after.match(VAL);
      if (!v) continue;
      const tail = line.slice(m.index + m[0].length + v[0].length, m.index + m[0].length + v[0].length + 4);
      if (+v[1] === 1 && /人|箱|件|軒/.test(v[3]) || /^(?:あたり|を|に|ずつ)/.test(tail)) continue;
      const around = line.slice(Math.max(0, m.index - 14), m.index + m[0].length + 24);
      const q = line.slice(Math.max(0, m.index - 14), m.index + m[0].length + v[0].length).match(QUAL)?.[0]?.replace(/\s/g, "") || "";
      const unit = v[3] === "％" ? "%" : v[3];
      const mul = MUL[v[2]] || 1, dec = (v[1].split(".")[1] || "").length;
      const num = parseFloat(v[1].replace(/,/g, "").replace("−", "-")) * mul;
      /* 「5%以下」「6%超」は目安・止める線で、前提の値（4%）とは比べない。線どうしは同じ向きのものだけ比べる */
      const bound = tail.match(/^(以下|以上|未満|超|を超え|まで)/)?.[1]?.replace("を超え", "超") || "";
      const key = `${l.name}｜${[q, bound && "〜" + bound].filter(Boolean).join(" ")}｜${unit}`;      (seen[key] ||= []).push({ id: p.id, num, step: mul / 10 ** dec, shown: (v[1] + (v[2] || "") + v[3]), ctx: around.replace(/\s+/g, " ").trim() });
    }
  }));
});
const conflicts = [];
for (const [key, hits] of Object.entries(seen)) {
  const vals = [...new Set(hits.map(h => h.num))];
  if (vals.length < 2 || new Set(hits.map(h => h.id)).size < 2) continue;
  const [name, q, unit] = key.split("｜");
  /* 丸めの違い：どの2つも、粗いほうの桁で丸めれば同じ（20.9億円 と 21億円）。20億円 と 21億円 は食い違い */
  const round = hits.every(a => hits.every(b => Math.abs(a.num - b.num) <= Math.max(a.step, b.step) / 2 + 1e-9));
  conflicts.push({ name, q, unit, round, hits });
}
conflicts.sort((a, b) => a.round - b.round);

/* 4. 用語・見出し・付録 */
const usedGl = new Set(P.flatMap(p => p.gloss));
const unusedGl = (r.gloss || []).filter(g => !usedGl.has(g.id) && g.k !== "link");
if (unusedGl.length) infos.push(`本文に出てこない用語 ${unusedGl.length}：${unusedGl.map(g => g.t).join("・")}（用語集から外すか、本文での書き方を a に足す）`);
content.forEach(p => {
  const h = p.h1.replace(/^(付録|Appendix)\s*[:：]\s*/i, "");
  if (!p.h1) warns.push(`${pn(p.id)}：見出し（h1）がない`);
  else if (h.length < 12 && !/[。、,]/.test(h)) warns.push(`${pn(p.id)}：見出し「${p.h1}」が題名だけに見える（読めば主張が分かる文にする）`);
});
const incoming = {};
P.forEach(p => p.links.forEach(l => { if (l.href.startsWith("#")) (incoming[l.href.slice(1)] ||= new Set()).add(p.id); }));
content.filter(p => /^(付録|Appendix)/i.test(p.h1) && !(incoming[p.id]?.size)).forEach(p => infos.push(`${pn(p.id)}：どのページからもリンクされていない付録`));
P.filter(p => p.checkIssues).forEach(p => warns.push(`${pn(p.id)}：?check の赤枠が ${p.checkIssues} か所（export.mjs --check で確かめる）`));

/* 5. 外部リンク */
const ext = [...new Set(P.flatMap(p => p.links.map(l => l.href)).filter(h => /^https?:/.test(h)))];
if (args.includes("--online")) {
  await Promise.all(ext.map(async u => {
    try {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
      let res = await fetch(u, { method: "HEAD", redirect: "follow", signal: ac.signal }).catch(() => null);
      if (!res || res.status >= 400) res = await fetch(u, { method: "GET", redirect: "follow", signal: ac.signal });
      clearTimeout(t);
      if (res.status >= 400) warns.push(`外部リンク ${u} が ${res.status}`);
    } catch (e) { warns.push(`外部リンク ${u} が開けない（${e.name === "AbortError" ? "10秒で応答なし" : e.message}）`); }
  }));
}

/* 書き出し */
const today = new Date().toISOString().slice(0, 10);
const A = [`# ${r.title || base} の機械の検査`, "", `| 項目 | 内容 |`, `|---|---|`, `| 検査日 | ${today} |`, `| 対象 | \`${basename(deck)}\`（全${P.length}ページ。JavaScript で数字・グラフを描いたあとの表示で読んだ） |`,
  `| 結果 | エラー ${errors.length}・要確認 ${warns.length + conflicts.filter(c => !c.round).length}・丸めの違い ${conflicts.filter(c => c.round).length}・参考 ${infos.length} |`, `| 外部リンク | ${ext.length} 件${args.includes("--online") ? "（開いて確かめた）" : "（--online で開いて確かめる）"} |`, "",
  "エラーは直す。要確認は人かレビューで読み、意図どおりなら残してよい。食い違いの候補は「同じ言葉のすぐ後ろの数字」を比べた機械的な拾い上げで、年・月が違えば別の値として扱う。", ""];
const sec = (t, xs) => { A.push(`## ${t}`, ""); if (!xs.length) A.push("なし", ""); else { xs.forEach(x => A.push(`- ${x}`)); A.push(""); } };
sec("1. エラー（切れたリンク・出典の番号）", errors);
A.push("## 2. ページをまたいだ数字の食い違いの候補", "");
const real = conflicts.filter(c => !c.round), rounds = conflicts.filter(c => c.round);
if (!conflicts.length) A.push("なし", "");
else {
  A.push("| 言葉 | 条件 | 値とページ | 見立て |", "|---|---|---|---|");
  [...real, ...rounds].forEach(c => {
    const vs = Object.values(Object.groupBy ? Object.groupBy(c.hits, h => h.shown) : c.hits.reduce((o, h) => ((o[h.shown] ||= []).push(h), o), {}))
      .map(hs => `${hs[0].shown}（${[...new Set(hs.map(h => pn(h.id)))].join("、")}）`).join(" ／ ");
    A.push(`| ${c.name} | ${c.q || "—"} | ${vs} | ${c.round ? "丸めの違い（桁をそろえる）" : "食い違い？（文脈を読む）"} |`);
  });
  A.push("");
}
sec("3. 要確認（出典のない数字・見出し・検査の赤枠・外部リンク）", warns);
sec("4. 参考", infos);
writeFileSync(join(outDir, `${base}-audit.md`), A.join("\n") + "\n");

const T = [`# ${r.title || base} の本文`, "", `\`${basename(deck)}\` を描いたあとの文字（audit.mjs が ${today} に書き出した）。専門家役のレビューは、この本文だけを根拠に答える。`,
  "グラフは軸と値の文字だけが入るので、形は PNG で見る。", ""];
P.forEach(p => {
  T.push(`## p.${p.n} #${p.id} ${p.h1 || "（見出しなし）"}`, "", `- 章：${r.chaps[p.id] || "—"}　種類：${p.kind}`);
  if (p.cites.length) T.push(`- 出典の番号：${p.cites.join(", ")}`);
  const refs = [...new Set(p.links.filter(l => l.href.startsWith("#") && l.href.length > 1 && /ref|pgl/.test(l.cls)).map(l => pn(l.href.slice(1))))];
  if (refs.length) T.push(`- リンク先：${refs.join("、")}`);
  T.push("", p.body.split("\n").map(s => s.trim()).filter(Boolean).join("\n"), "");
  if (p.foot) T.push(`> 注記：${p.foot}`, "");
  if (p.notes) T.push(`> 発表者メモ：${p.notes}`, "");
});
if (r.cites) {
  T.push("## 出典の番号の意味", "");
  Object.entries(r.cites.src).forEach(([no, s]) => T.push(`- ${no}：${s.t}（${pn(s.p)}）`));
  T.push("");
}
writeFileSync(join(outDir, `${base}-text.md`), T.join("\n") + "\n");
writeFileSync(join(outDir, `${base}-pages.json`), JSON.stringify({ deck: basename(deck), title: r.title, pages: P.map(p => ({ n: p.n, id: p.id, h1: p.h1, chap: r.chaps[p.id] || "" })) }, null, 1));

console.log(`エラー ${errors.length}・要確認 ${warns.length + real.length}・丸めの違い ${rounds.length}・参考 ${infos.length}`);
[...errors.map(x => "  ✗ " + x), ...real.map(c => `  ? 食い違いの候補「${c.name}${c.q ? "（" + c.q + "）" : ""}」：${[...new Set(c.hits.map(h => h.shown + " " + pn(h.id)))].join(" ／ ")}`)].slice(0, 20).forEach(x => console.log(x));
console.log(`書き出し: ${join(outDir, base + "-audit.md")}・${base}-text.md・${base}-pages.json`);
if (errors.length) process.exitCode = 1;
