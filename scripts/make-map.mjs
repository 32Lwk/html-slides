#!/usr/bin/env node
// 地図を SVG で作る（オフラインで表示でき、色はテーマの CSS 変数に従う）。仕様は reference/maps.md。
//   node make-map.mjs spec.json [--into deck.html [deck2.html…]]
//   spec.json は 1 枚の地図 {…} か {"maps":[{…},{…}]}。--into を付けると、<!--MAP:name-->…<!--END MAP:name--> があるデッキに書き込む。
//   out を書けば SVG ファイルにも出す。最初に一度 scripts/ で npm install が要る。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), GEO = join(HERE, "..", "assets", "geo");
let d3, topo;
try {
  d3 = await import("d3-geo");
  topo = await import("topojson-client");
} catch {
  console.error(`d3-geo が入っていません。先に実行してください:\n  cd "${HERE}" && npm install`);
  process.exit(1);
}

const args = process.argv.slice(2);
const specPath = args.find(a => !a.startsWith("--"));
const into = args.includes("--into") ? args.slice(args.indexOf("--into") + 1).filter(a => !a.startsWith("--")) : [];
if (!specPath) { console.error("usage: node make-map.mjs spec.json [--into deck.html [deck2.html…]]"); process.exit(1); }
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const maps = spec.maps || [spec];

const cache = {};
const load = f => (cache[f] ??= JSON.parse(readFileSync(join(GEO, f), "utf8")));
const countries = detail => { const t = load(`countries-${detail}.json`); return topo.feature(t, t.objects.countries).features; };
const prefs = () => { const t = load("japan-prefs.json"); return topo.feature(t, t.objects.prefs).features; };
const CITIES = load("cities.json");
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

function findCountry(list, key) {
  const k = String(key).toLowerCase();
  return list.find(f => [f.properties.a2, f.properties.a3, f.properties.ja, f.properties.en].some(v => v && String(v).toLowerCase() === k));
}
function findPref(list, key) {
  const k = String(key).replace(/[都道府県]$/, "");
  return list.find(f => f.properties.code === +key || f.properties.ja === key || f.properties.ja.replace(/[都道府県]$/, "") === k || f.properties.en.toLowerCase() === String(key).toLowerCase());
}
function findCity(key, a2) {
  const k = String(key).toLowerCase();
  return CITIES.find(c => (!a2 || c.a2 === a2) && (c.en?.toLowerCase() === k || c.ja === key || c.ja?.replace(/[市区都]$/, "") === key));
}
/** [lon,lat] を国コード・都市名・座標から */
function lonlat(p, feats) {
  if (Array.isArray(p)) return p;
  if (typeof p === "object" && p.lon !== undefined) return [p.lon, p.lat];
  const c = findCity(p);
  if (c) return [c.lon, c.lat];
  const f = feats && findCountry(feats, p);
  if (f) return d3.geoCentroid(f);
  throw new Error(`場所が見つかりません: ${p}（{"lon":…,"lat":…} で指定）`);
}

function projection(m, W, H, fitObj) {
  const kind = m.projection || (m.scope === "japan" ? "mercator" : m.fit ? "mercator" : "naturalEarth");
  const P = { naturalEarth: d3.geoNaturalEarth1, equalEarth: d3.geoEqualEarth, mercator: d3.geoMercator, conic: d3.geoConicConformal, orthographic: d3.geoOrthographic }[kind];
  if (!P) throw new Error("projection: naturalEarth / equalEarth / mercator / conic / orthographic");
  const p = P();
  if (m.rotate) p.rotate(m.rotate);
  else if (m.pacific) p.rotate([-150, 0]);
  if (kind === "conic") p.parallels(m.parallels || [30, 45]).rotate(m.rotate || [-137, 0]);
  const pad = m.pad ?? 24;
  p.fitExtent([[pad, pad], [W - pad, H - pad]], fitObj);
  if (m.zoom) p.scale(p.scale() * m.zoom);
  if (m.shift) { const [tx, ty] = p.translate(); p.translate([tx + m.shift[0], ty + m.shift[1]]); }
  p.clipExtent([[0, 0], [W, H]]);
  return p;
}
/** 経度・緯度の範囲 [[西,南],[東,北]] を点の集まりにする（多角形だと向きで地球の裏側と取り違えるため） */
function boxPoints([[w, s], [e, n]]) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const x = w + ((e - w) * i) / 8, y = s + ((n - s) * i) / 8; pts.push([x, s], [x, n], [w, y], [e, y]); }
  return { type: "MultiPoint", coordinates: pts };
}
function quantile(values, steps, breaks) {
  if (breaks) return v => 1 + breaks.filter(b => v >= b).length;
  const s = [...values].sort((a, b) => a - b);
  const cuts = [...Array(steps - 1)].map((_, i) => s[Math.floor(((i + 1) / steps) * s.length)]);
  return v => 1 + cuts.filter(c => v >= c).length;
}

function build(m) {
  const W = m.width || 900, H = m.height || 600, lang = m.lang || "ja";
  const nameOf = f => (lang === "en" ? f.properties.en : f.properties.ja || f.properties.en);
  const isJapan = m.scope === "japan";
  let feats, fitObj, detail = m.detail;
  if (isJapan) {
    feats = prefs();
    const inset = m.okinawaInset ?? !m.fit;
    const main = inset ? feats.filter(f => f.properties.code !== 47) : feats;
    fitObj = !m.fit ? (inset ? boxPoints([[128.6, 30.2], [145.9, 45.6]]) : { type: "FeatureCollection", features: main })
      : Array.isArray(m.fit[0]) ? boxPoints(m.fit)
      : { type: "FeatureCollection", features: m.fit.map(k => findPref(feats, k)).filter(Boolean) };
    m._inset = inset;
  } else {
    if (!detail) {
      if (!m.fit || m.fit === "world") detail = "110m";
      else {
        const f50 = countries("50m");
        const fc = Array.isArray(m.fit[0]) ? null : m.fit.map(k => findCountry(f50, k)).filter(Boolean);
        const b = fc ? d3.geoBounds({ type: "FeatureCollection", features: fc }) : m.fit;
        const span = Math.max(Math.abs(b[1][0] - b[0][0]), Math.abs(b[1][1] - b[0][1]));
        detail = span > 70 ? "110m" : span > 25 ? "50m" : "10m";
      }
    }
    feats = countries(detail);
    if (!m.fit || m.fit === "world") fitObj = { type: "Sphere" };
    else if (Array.isArray(m.fit[0])) fitObj = boxPoints(m.fit);
    else {
      const fc = m.fit.map(k => { const f = findCountry(feats, k) || findCountry(countries("10m"), k); if (!f) throw new Error("国が見つかりません: " + k); return f; });
      fitObj = { type: "FeatureCollection", features: fc };
    }
  }
  const proj = projection(m, W, H, fitObj);
  const path = d3.geoPath(proj).digits(1);
  const find = k => (isJapan ? findPref(feats, k) : findCountry(feats, k) || findCountry(countries("10m"), k));

  // 塗り分け：fill は {キー: "accent"|"mid"|"warn"|"sub"} 、values は {キー: 数} を q1〜q5 に
  const cls = new Map();
  Object.entries(m.fill || {}).forEach(([k, c]) => { const f = find(k); if (f) cls.set(f, c); else console.warn("見つかりません:", k); });
  let legend = "";
  if (m.values) {
    const steps = m.steps || 5, entries = Object.entries(m.values).map(([k, v]) => [find(k), v]).filter(([f]) => f);
    const q = quantile(entries.map(e => e[1]), steps, m.breaks);
    entries.forEach(([f, v]) => { if (!cls.has(f)) cls.set(f, "q" + Math.min(5, q(v) + (5 - steps))); });
    if (m.legend !== false) {
      const vals = entries.map(e => e[1]).sort((a, b) => a - b), fmt = v => (m.unit ? `${Math.round(v).toLocaleString()}${m.unit}` : Math.round(v).toLocaleString());
      const lx = m.legendAt?.[0] ?? (isJapan ? W - steps * 46 - 24 : 24), ly = m.legendAt?.[1] ?? H - 30;
      legend = `<g class="legend">` + [...Array(steps)].map((_, i) => `<rect x="${lx + i * 46}" y="${ly - 14}" width="44" height="14" class="land q${i + 1 + (5 - steps)}"/>`).join("")
        + `<text x="${lx}" y="${ly + 22}" class="ml sub">${esc(m.legendLow ?? fmt(vals[0]))}</text><text x="${lx + steps * 46 - 2}" y="${ly + 22}" class="ml sub" text-anchor="end">${esc(m.legendHigh ?? fmt(vals[vals.length - 1]))}</text>`
        + (m.legendTitle ? (lx > W / 2 ? `<text x="${lx + steps * 46 - 2}" y="${ly - 24}" class="ml sub" text-anchor="end">` : `<text x="${lx}" y="${ly - 24}" class="ml sub">`) + `${esc(m.legendTitle)}</text>` : "") + `</g>`;
    }
  }

  let body = "";
  if (!isJapan && m.graticule) body += `<path class="grat" d="${path(d3.geoGraticule10())}"/>`;
  if (!isJapan && (!m.fit || m.fit === "world") && m.sphere !== false) body += `<path class="sea" d="${path({ type: "Sphere" })}"/>`;
  const drawn = isJapan && m._inset ? feats.filter(f => f.properties.code !== 47) : feats;
  const small = [];
  drawn.forEach(f => {
    const d = path(f);
    if (!d) return;
    const c = cls.get(f);
    body += `<path class="land${c ? " " + c : ""}" d="${d}"><title>${esc(nameOf(f))}</title></path>`;
    if (c && path.area(f) < (m.minArea ?? 40)) small.push([f, c]);
  });
  if (!isJapan) cls.forEach((c, f) => { if (!drawn.includes(f)) small.push([f, c]); });
  // 小さすぎて見えない国（シンガポール・香港など）は丸で示す
  small.forEach(([f, c]) => { const [x, y] = path.centroid(f); if (isFinite(x)) body += `<circle cx="${x}" cy="${y}" r="${m.dotR || 9}" class="pt ${c === "warn" ? "warn" : "accent"}"/>`; });

  // 沖縄の差し込み（日本全体の地図）
  if (isJapan && m._inset) {
    const ok = feats.find(f => f.properties.code === 47);
    const iw = m.insetSize?.[0] ?? W * 0.34, ih = m.insetSize?.[1] ?? H * 0.26, ix = m.insetAt?.[0] ?? 16, iy = m.insetAt?.[1] ?? 16;
    const p2 = d3.geoMercator().fitExtent([[ix + 10, iy + 10], [ix + iw - 10, iy + ih - 10]], boxPoints(m.insetBox || [[126.6, 26.0], [128.4, 26.95]])).clipExtent([[ix, iy], [ix + iw, iy + ih]]);
    const path2 = d3.geoPath(p2).digits(1), c = cls.get(ok);
    body += `<path d="M${ix + iw},${iy}V${iy + ih}H${ix}" class="grat" style="stroke:var(--sub);stroke-width:1.5"/><path class="land${c ? " " + c : ""}" d="${path2(ok)}"><title>${esc(nameOf(ok))}</title></path>`;
    ok._insetCentroid = path2.centroid(ok);
  }

  // 線（arcs）：from/to は国コード・都市名・[lon,lat]
  const defs = `<defs>${["", "accent", "warn"].map(t => `<marker id="${m.name || "map"}-ah${t}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--${t || "ink"})"/></marker>`).join("")}</defs>`;
  (m.arcs || []).forEach(a => {
    const p1 = proj(lonlat(a.from, feats)), p2 = proj(lonlat(a.to, feats));
    if (!p1 || !p2) return;
    const bend = a.bend ?? 0.2, mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
    const cx = mx - (p2[1] - p1[1]) * bend, cy = my + (p2[0] - p1[0]) * bend;
    const c = a.cls || "accent";
    body += `<path class="arc ${c}${a.dash ? " dash" : ""}" d="M${p1[0].toFixed(1)},${p1[1].toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}"${a.arrow === false ? "" : ` marker-end="url(#${m.name || "map"}-ah${c === "accent" || c === "warn" ? c : ""})"`}/>`;
    if (a.label) body += `<text x="${(mx + cx) / 2 + (a.dx || 0)}" y="${(my + cy) / 2 + (a.dy || 0)}" class="ml ${c}" text-anchor="middle">${esc(a.label)}</text>`;
  });

  // 名前（labels: true なら塗った国・都道府県すべて、配列なら指定したものだけ）
  const labels = m.labels === true ? [...cls.keys()].map(f => ({ f })) : (m.labels || []).map(l => ({ ...l, f: find(l.code ?? l.key) }));
  labels.forEach(l => {
    if (!l.f) return;
    let [x, y] = l.lon !== undefined ? proj([l.lon, l.lat]) : l.f._insetCentroid || path.centroid(l.f);
    if (!isFinite(x)) return;
    const onFill = ["accent", "warn", "q4", "q5"].includes(cls.get(l.f)) && path.area(l.f) > 6000 && !l.dx && !l.dy;
    x += l.dx || 0; y += l.dy || 0;
    body += `<text x="${x}" y="${y}" class="ml${l.cls ? " " + l.cls : onFill ? " on" : ""}" text-anchor="${l.anchor || "middle"}" dominant-baseline="central">${esc(l.text ?? nameOf(l.f))}</text>`;
  });

  // 点（points）：{city:"Manila"} か {name,lon,lat}。label は right/left/top/bottom/none
  (m.points || []).forEach(pt => {
    const c = pt.city ? findCity(pt.city, pt.a2) : null;
    if (pt.city && !c && pt.lon === undefined) throw new Error("都市が見つかりません: " + pt.city + "（lon・lat で指定）");
    const ll = pt.lon !== undefined ? [pt.lon, pt.lat] : [c.lon, c.lat];
    const xy = proj(ll);
    if (!xy) return;
    const [x, y] = xy, r = pt.r || (m.pitch ? 16 : 9), fs = m.pitch ? 54 : 20;
    body += `<circle cx="${x}" cy="${y}" r="${r}" class="pt ${pt.cls || "accent"}"/>`;
    const txt = pt.text ?? pt.name ?? (lang === "en" ? c?.en : (c?.ja || c?.en)?.replace(/^東京都$/, "東京").replace(/市$/, ""));
    const side = pt.label || "right", g = r + 8;
    if (side !== "none" && txt) {
      const [tx, ty, an] = side === "left" ? [x - g, y, "end"] : side === "top" ? [x, y - g - fs * 0.6, "middle"] : side === "bottom" ? [x, y + g + fs * 0.6, "middle"] : [x + g, y, "start"];
      body += `<text x="${tx + (pt.dx || 0)}" y="${ty + (pt.dy || 0)}" class="ml ${pt.tcls || ""}" text-anchor="${an}" dominant-baseline="central">${esc(txt)}</text>`;
    }
  });

  const svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(m.title || m.name || "map")}">${defs}${body}${legend}</svg>`;
  return { svg, W, H, detail: isJapan ? "japan" : detail };
}

const decks = Object.fromEntries(into.map(p => [p, readFileSync(p, "utf8")]));
const changed = new Set();
for (const m of maps) {
  const { svg, detail } = build(m);
  if (m.out) { writeFileSync(resolve(dirname(specPath), m.out), svg); console.log("SVG:", m.out); }
  const hits = [];
  if (into.length) {
    if (!m.name) { console.error("--into には name が要ります"); process.exit(1); }
    const re = new RegExp(`<!--MAP:${m.name}-->[\\s\\S]*?<!--END MAP:${m.name}-->`);
    for (const p of into) {
      if (!re.test(decks[p])) continue;
      decks[p] = decks[p].replace(re, () => `<!--MAP:${m.name}-->${svg}<!--END MAP:${m.name}-->`);
      changed.add(p); hits.push(p);
    }
    if (!hits.length) console.warn(`  ! どのデッキにも <!--MAP:${m.name}--><!--END MAP:${m.name}--> がありません`);
  }
  console.log(`地図 ${m.name || "(no name)"}: ${Math.round(svg.length / 1024)}KB（${detail}）${hits.length ? " → " + hits.join(", ") : ""}`);
}
for (const p of changed) { writeFileSync(p, decks[p]); console.log("書き込み:", p); }
