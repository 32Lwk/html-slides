#!/usr/bin/env node
// 計算の結果（JSON）をデッキに埋め込む。HTML の /*DATA*/ … /*END DATA*/ を window.DATA = {…}; に書き換える。
//   node inject-data.mjs <deck.html> <data.json> [<deck2.html> …]
// デッキ側では <span data-f="rev.y3" data-d="1" data-u="億円"></span> やグラフの "@rev.series" で参照する。
import { readFileSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);
const json = files.find(f => f.endsWith(".json"));
const decks = files.filter(f => f.endsWith(".html"));
if (!json || !decks.length) { console.error("usage: node inject-data.mjs <deck.html> [...] <data.json>"); process.exit(1); }
const data = JSON.stringify(JSON.parse(readFileSync(json, "utf8")));
for (const d of decks) {
  const html = readFileSync(d, "utf8");
  const re = /\/\*DATA\*\/[\s\S]*?\/\*END DATA\*\//;
  if (!re.test(html)) { console.error(`${d} に /*DATA*/ … /*END DATA*/ がありません（テンプレートの <script> にあります）`); process.exit(1); }
  writeFileSync(d, html.replace(re, () => `/*DATA*/window.DATA = ${data};/*END DATA*/`));
  console.log(`埋め込み: ${d}（${Math.round(data.length / 1024)}KB）`);
}
