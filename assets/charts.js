/* html-slides charts：<div class="chart" style="height:…px" data-chart='{"type":"bar",…}'> を SVG で描く。
   種類：bar（縦・横・積み上げ・100%・折れ線の重ね）／line／donut（pie）／scatter（bubble）／waterfall／sankey／gantt。
   色は "accent" "warn" "mid" "sub" "ink" "c1"〜"c6" か色コード。数字は fmt {d,x,r,u,sign}（Slides.fmt）。"@a.b" は window.DATA の値。 */
(() => {
  const PITCH = () => Slides.mode === "pitch";
  const NAMED = { accent: "var(--accent)", warn: "var(--warn)", mid: "var(--accent-mid)", sub: "var(--c6)", ink: "var(--ink)", line: "var(--line)", lane: "var(--lane)" };
  const col = (c, i = 0) => (c ? NAMED[c] || (/^c[1-6]$/.test(c) ? `var(--${c})` : c) : `var(--c${(i % 6) + 1})`);
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  let ctx;
  function tw(text, size, weight = 700) {
    ctx ??= document.createElement("canvas").getContext("2d");
    ctx.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;
    return Math.max(...String(text).split("\n").map(l => ctx.measureText(l).width));
  }
  function niceStep(range, n) {
    const raw = range / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function scale(min, max, n, o = {}) {
    if (o.min !== undefined) min = o.min;
    if (o.max !== undefined) max = o.max;
    if (max === min) max = min + 1;
    const st = o.step || niceStep(max - min, n);
    return { lo: o.min ?? Math.floor(min / st + 1e-9) * st, hi: o.max ?? Math.ceil(max / st - 1e-9) * st, st };
  }
  const ticks = sc => { const a = []; for (let v = sc.lo; v <= sc.hi + sc.st * 1e-6; v += sc.st) a.push(+v.toFixed(10)); return a; };
  function resolve(x) {
    if (typeof x === "string" && x.startsWith("@")) return Slides.get(x.slice(1));
    if (Array.isArray(x)) return x.map(resolve);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, resolve(v)]));
    return x;
  }
  /** 複数行の文字（\n で改行） */
  function text(x, y, s, cls, o = {}) {
    const lines = String(s ?? "").split("\n"), lh = o.lh || 1.2, fs = o.fs || 20;
    const dy0 = o.vcenter ? -((lines.length - 1) * fs * lh) / 2 : o.bottom ? -(lines.length - 1) * fs * lh : 0;
    const attrs = `class="${cls}${o.halo ? " halo" : ""}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.fill ? ` style="fill:${o.fill}"` : ""}${o.base ? ` dominant-baseline="${o.base}"` : ""}`;
    if (lines.length === 1) return `<text x="${x}" y="${y + dy0}" ${attrs}>${esc(s)}</text>`;
    return `<text x="${x}" y="${y + dy0}" ${attrs}>${lines.map((l, i) => `<tspan x="${x}" dy="${i ? fs * lh : 0}">${esc(l)}</tspan>`).join("")}</text>`;
  }
  function legendRow(items, x, y, fs, maxW) {
    let s = "", cx = x, cy = y;
    items.forEach(it => {
      const w = fs * 1.2 + 10 + tw(it.name, fs, 600) + fs * 1.4;
      if (cx + w > x + maxW && cx > x) { cx = x; cy += fs * 1.6; }
      s += it.line
        ? `<line x1="${cx}" x2="${cx + fs * 1.2}" y1="${cy - fs * 0.35}" y2="${cy - fs * 0.35}" style="stroke:${it.color}; stroke-width:${Math.max(3, fs / 6)}"/>`
        : `<rect x="${cx}" y="${cy - fs * 0.8}" width="${fs * 1.2}" height="${fs * 0.8}" rx="3" style="fill:${it.color}"/>`;
      s += text(cx + fs * 1.2 + 10, cy, it.name, "tk", { fs });
      cx += w;
    });
    return { svg: s, h: cy - y + fs * 1.6 };
  }
  const isHl = (s, i, label) => {
    const h = s.highlight;
    if (h === undefined) return false;
    return (Array.isArray(h) ? h : [h]).some(v => v === i || v === label);
  };
  const sizes = el => {
    const cs = getComputedStyle(el);
    return { fs: parseFloat(cs.getPropertyValue("--chart-fs")) || 19, fv: parseFloat(cs.getPropertyValue("--chart-fs-v")) || 24 };
  };

  /* ---------- 棒（縦・横、グループ・積み上げ・100%、折れ線の重ね） ---------- */
  function bar(s, W, H, { fs, fv }) {
    const L = s.labels || [], all = s.series || [{ values: s.values, name: s.name || "" }];
    const S = all.filter(x => x.type !== "line"), LN = all.filter(x => x.type === "line");
    const pct = s.stacked === "100%", stacked = !!s.stacked;
    const vals = S.map(se => se.values.map((v, i) => (pct ? (v / S.reduce((t, x) => t + (x.values[i] || 0), 0)) * 100 : v)));
    const f = v => Slides.fmt(v, pct ? { d: 0, u: "%" } : s.fmt || {});
    const tot = L.map((_, i) => vals.reduce((t, a) => t + Math.max(0, a[i] || 0), 0));
    const neg = L.map((_, i) => vals.reduce((t, a) => t + Math.min(0, a[i] || 0), 0));
    const maxV = stacked ? Math.max(...tot) : Math.max(0, ...vals.flat());
    const minV = stacked ? Math.min(0, ...neg) : Math.min(0, ...vals.flat());
    const sc = scale(minV, maxV, PITCH() ? 3 : 5, { min: s.min, max: pct ? 100 : s.max, step: s.step });
    const axis = s.axis ?? !PITCH();
    const vlab = s.valueLabels ?? true;
    const legendItems = (S.length > 1 || LN.length) && s.legend !== false
      ? [...S.map((se, i) => ({ name: se.name, color: col(se.color, i) })), ...LN.map((se, i) => ({ name: se.name, color: col(se.color || "warn", i + 3), line: true }))] : [];
    let out = "", top = 0;
    if (legendItems.length) { const lg = legendRow(legendItems, 0, fs, fs, W); out += lg.svg; top += lg.h + 6; }
    if (s.unit) { out += text(0, top + fs, s.unit, "un", { fs }); top += fs * 1.5; }
    const fmtTick = v => Slides.fmt(v, pct ? { d: 0, u: "%" } : { ...(s.fmt || {}), ...(Number.isInteger(sc.st) ? { d: 0 } : {}), u: s.tickUnit ?? "" });

    if (s.horizontal) {
      const labW = s.labelWidth || Math.min(W * 0.4, Math.max(...L.map(l => tw(l, fs * 1.1, 800))) + 20);
      const valW = vlab ? Math.max(...(stacked ? tot : vals.flat()).map(v => tw(f(v), fv, 800))) + 18 : 10;
      const x0 = labW, x1 = W - valW, y0 = top + (axis ? fs * 1.6 : 4), y1 = H - 4;
      const X = v => x0 + ((v - sc.lo) / (sc.hi - sc.lo)) * (x1 - x0);
      const row = (y1 - y0) / L.length, bh = Math.min(row * (1 - (s.gap ?? 0.3)), s.barMax || 999);
      if (axis) ticks(sc).forEach(v => { out += `<line class="grid-l" x1="${X(v)}" x2="${X(v)}" y1="${y0 - 6}" y2="${y1}"/>` + text(X(v), y0 - 12, fmtTick(v), "tk", { fs, anchor: "middle" }); });
      L.forEach((l, i) => {
        const cy = y0 + row * i + row / 2;
        out += text(labW - 16, cy, l, "lb", { fs: fs * 1.1, anchor: "end", vcenter: true, base: "central" });
        if (stacked) {
          let acc = 0;
          S.forEach((se, j) => {
            const v = vals[j][i] || 0, c = col(se.colors?.[i] || se.color, j);
            out += `<rect x="${X(acc)}" y="${cy - bh / 2}" width="${Math.max(0, X(acc + v) - X(acc))}" height="${bh}" style="fill:${c}"/>`;
            if (s.segLabels && X(acc + v) - X(acc) > tw(f(v), fs, 800) + 12) out += text((X(acc) + X(acc + v)) / 2, cy, f(v), "vl in", { fs, anchor: "middle", base: "central" });
            acc += v;
          });
          if (vlab) out += text(X(tot[i]) + 12, cy, f(tot[i]), "vl", { fs: fv, base: "central" });
        } else {
          const bw = bh / S.length;
          S.forEach((se, j) => {
            const v = vals[j][i], hl = isHl(s, i, l);
            const c = se.colors?.[i] ? col(se.colors[i]) : s.highlight !== undefined && S.length === 1 ? (hl ? col("accent") : col(s.muted || "mid")) : col(se.color, j);
            const y = cy - bh / 2 + bw * j;
            out += `<rect x="${Math.min(X(0), X(v))}" y="${y}" width="${Math.abs(X(v) - X(0))}" height="${bw - (S.length > 1 ? 3 : 0)}" rx="${Math.min(8, bw / 4)}" style="fill:${c}"/>`;
            if (vlab) out += text(Math.max(X(0), X(v)) + 12, y + bw / 2, f(v), "vl", { fs: fv, base: "central", fill: hl ? "var(--accent)" : "" });
          });
        }
      });
      if (sc.lo < 0 || axis) out += `<line class="ax" x1="${X(0)}" x2="${X(0)}" y1="${y0}" y2="${y1}"/>`;
      (s.ref || []).forEach(r => { out += `<line class="refl" x1="${X(r.v)}" x2="${X(r.v)}" y1="${y0}" y2="${y1}" style="stroke:${col(r.color || "warn")}"/>` + text(X(r.v) + 8, y0 + fs, r.label || "", "lb", { fs, fill: col(r.color || "warn"), halo: true }); });
      return out;
    }

    const lnSc = LN.some(x => x.axis === "right") ? scale(Math.min(0, ...LN.flatMap(x => x.values)), Math.max(...LN.flatMap(x => x.values)), PITCH() ? 3 : 5, s.right || {}) : sc;
    const fR = v => Slides.fmt(v, s.fmtRight || s.fmt || {});
    const lines = Math.max(...L.map(l => String(l).split("\n").length));
    const leftW = axis ? Math.max(...ticks(sc).map(v => tw(fmtTick(v), fs, 600))) + 14 : 0;
    const rightW = lnSc !== sc && axis ? Math.max(...ticks(lnSc).map(v => tw(fR(v), fs, 600))) + 14 : 0;
    const x0 = leftW, x1 = W - rightW, y0 = top + (vlab ? fv * 1.5 : 10), y1 = H - lines * fs * 1.2 - 14;
    const Y = v => y1 - ((v - sc.lo) / (sc.hi - sc.lo)) * (y1 - y0);
    const YR = v => y1 - ((v - lnSc.lo) / (lnSc.hi - lnSc.lo)) * (y1 - y0);
    const band = (x1 - x0) / L.length, bw = Math.min(band * (1 - (s.gap ?? 0.35)), s.barMax || 999);
    if (axis) {
      ticks(sc).forEach(v => { out += `<line class="grid-l" x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}"/>` + text(x0 - 12, Y(v), fmtTick(v), "tk", { fs, anchor: "end", base: "central" }); });
      if (lnSc !== sc) ticks(lnSc).forEach(v => { out += text(x1 + 12, YR(v), fR(v), "tk", { fs, base: "central" }); });
    }
    L.forEach((l, i) => {
      const cx = x0 + band * i + band / 2, hl = isHl(s, i, l);
      if (!s.xEvery || i % s.xEvery === 0) out += text(cx, y1 + fs + 10, l, hl ? "lb" : "tk", { fs, anchor: "middle", fill: hl ? "var(--accent)" : "" });
      if (stacked) {
        let pos = 0, ng = 0;
        S.forEach((se, j) => {
          const v = vals[j][i] || 0, c = col(se.colors?.[i] || se.color, j);
          const a = v >= 0 ? pos : ng, b = a + v;
          out += `<rect x="${cx - bw / 2}" y="${Math.min(Y(a), Y(b))}" width="${bw}" height="${Math.abs(Y(a) - Y(b))}" style="fill:${c}"/>`;
          if (s.segLabels && Math.abs(Y(a) - Y(b)) > fs * 1.3 && tw(f(v), fs, 800) < bw - 8) out += text(cx, (Y(a) + Y(b)) / 2, f(v), "vl in", { fs, anchor: "middle", base: "central" });
          if (v >= 0) pos = b; else ng = b;
        });
        if (vlab && !pct) out += text(cx, Y(tot[i]) - 12, f(tot[i]), "vl", { fs: fv, anchor: "middle", fill: hl ? "var(--accent)" : "" });
      } else {
        const w = bw / S.length;
        S.forEach((se, j) => {
          const v = vals[j][i];
          if (v == null) return;
          const c = se.colors?.[i] ? col(se.colors[i]) : s.highlight !== undefined && S.length === 1 ? (hl ? col("accent") : col(s.muted || "mid")) : col(se.color, j);
          const x = cx - bw / 2 + w * j;
          out += `<rect x="${x + (S.length > 1 ? 2 : 0)}" y="${Math.min(Y(0), Y(v))}" width="${w - (S.length > 1 ? 4 : 0)}" height="${Math.abs(Y(v) - Y(0))}" rx="${Math.min(8, w / 5)}" style="fill:${c}"/>`;
          if (vlab && (S.length === 1 || tw(f(v), fs, 800) <= w + 6)) out += text(x + w / 2, v >= 0 ? Y(v) - 12 : Y(v) + fv + 6, f(v), "vl", { fs: S.length > 1 ? fs : fv, anchor: "middle", fill: hl ? "var(--accent)" : "" });
        });
      }
    });
    out += `<line class="ax" x1="${x0}" x2="${x1}" y1="${Y(Math.max(0, sc.lo))}" y2="${Y(Math.max(0, sc.lo))}"/>`;
    LN.forEach((se, j) => {
      const YY = se.axis === "right" ? YR : Y, c = col(se.color || "warn", j + 3);
      const pts = se.values.map((v, i) => [x0 + band * i + band / 2, YY(v)]);
      out += `<path d="${pts.map((p, i) => (i ? "L" : "M") + p.join(",")).join("")}" style="fill:none; stroke:${c}; stroke-width:${Math.max(3, fs / 6)}"/>`;
      pts.forEach(([x, y], i) => {
        out += `<circle cx="${x}" cy="${y}" r="${Math.max(5, fs / 4)}" style="fill:var(--bg); stroke:${c}; stroke-width:3"/>`;
        if (se.valueLabels) out += text(x, se.values[i] < 0 ? y + fs * 1.5 : y - fs * 0.8, se.axis === "right" ? fR(se.values[i]) : f(se.values[i]), "lb", { fs, anchor: "middle", fill: c, halo: true });
      });
    });
    (s.ref || []).forEach(r => {
      const c = col(r.color || "warn");
      out += `<line class="refl" x1="${x0}" x2="${x1}" y1="${Y(r.v)}" y2="${Y(r.v)}" style="stroke:${c}"/>` + text(x1, Y(r.v) - 10, r.label || "", "lb", { fs, anchor: "end", fill: c, halo: true });
    });
    return out;
  }

  /* ---------- 折れ線 ---------- */
  function line(s, W, H, { fs, fv }) {
    const L = s.labels || [], S = s.series || [];
    const f = v => Slides.fmt(v, s.fmt || {});
    const all = S.flatMap(x => x.values).filter(v => v != null);
    const sc = scale(Math.min(s.zero === false ? Math.min(...all) : 0, ...all), Math.max(...all), PITCH() ? 3 : 5, { min: s.min, max: s.max, step: s.step });
    const fmtTick = v => Slides.fmt(v, { ...(s.fmt || {}), ...(Number.isInteger(sc.st) ? { d: 0 } : {}), u: s.tickUnit ?? "" });
    const axis = s.axis ?? !PITCH();
    let out = "", top = 0;
    const endLabels = s.endLabels ?? true;
    if (!endLabels && S.length > 1) { const lg = legendRow(S.map((x, i) => ({ name: x.name, color: col(x.color, i), line: true })), 0, fs, fs, W); out += lg.svg; top += lg.h; }
    if (s.unit) { out += text(0, top + fs, s.unit, "un", { fs }); top += fs * 1.5; }
    const last = se => { for (let i = se.values.length - 1; i >= 0; i--) if (se.values[i] != null) return i; return -1; };
    const endTxt = se => (S.length > 1 ? `${se.name} ` : "") + f(se.values[last(se)]);
    const leftW = axis ? Math.max(...ticks(sc).map(v => tw(fmtTick(v), fs, 600))) + 14 : 0;
    const rightW = endLabels ? Math.max(...S.map(se => tw(endTxt(se), fv * 0.9, 800))) + 22 : 16;
    const x0 = leftW, x1 = W - rightW, y0 = top + fv, y1 = H - fs * 1.2 - 14;
    const X = i => x0 + (L.length > 1 ? (i / (L.length - 1)) * (x1 - x0) : (x1 - x0) / 2);
    const Y = v => y1 - ((v - sc.lo) / (sc.hi - sc.lo)) * (y1 - y0);
    if (axis) ticks(sc).forEach(v => { out += `<line class="grid-l" x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}"/>` + text(x0 - 12, Y(v), fmtTick(v), "tk", { fs, anchor: "end", base: "central" }); });
    out += `<line class="ax" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>`;
    const maxLab = Math.max(...L.map(l => tw(l, fs, 600)));
    const every = s.xEvery || Math.max(1, Math.ceil((maxLab + fs) / ((x1 - x0) / Math.max(1, L.length - 1))));
    L.forEach((l, i) => { if (i % every === 0 || i === L.length - 1 && s.xLast !== false) out += text(X(i), y1 + fs + 10, l, "tk", { fs, anchor: i === 0 && every > 1 ? "start" : i === L.length - 1 && every > 1 ? "end" : "middle" }); });
    let markEnd = -Infinity, markRow = 0;
    (s.marks || []).forEach(m => {
      const c = col(m.color || "sub"), x = X(m.i);
      markRow = x + 8 < markEnd ? markRow + 1 : 0;
      markEnd = Math.max(markRow ? markEnd : -Infinity, x + 8 + tw(m.label || "", fs, 600));
      out += `<line class="refl" x1="${x}" x2="${x}" y1="${y0 - 6}" y2="${y1}" style="stroke:${c}; stroke-width:2"/>` + text(x + 8, y0 + fs * 0.4 + markRow * fs * 1.3, m.label || "", "tk", { fs, fill: c, halo: true });
    });
    const ends = [];
    S.forEach((se, j) => {
      const c = col(se.color, j), sw = se.width || (j === 0 || se.key ? Math.max(4, fs / 4.5) : Math.max(3, fs / 7));
      const pts = se.values.map((v, i) => (v == null ? null : [X(i), Y(v)]));
      const segs = []; let cur = [];
      pts.forEach(p => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      segs.forEach(sg => {
        const d = sg.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
        if (s.area || se.area) out += `<path d="${d}L${sg[sg.length - 1][0]},${Y(Math.max(0, sc.lo))}L${sg[0][0]},${Y(Math.max(0, sc.lo))}Z" style="fill:${c}; opacity:0.14"/>`;
        out += `<path d="${d}" style="fill:none; stroke:${c}; stroke-width:${sw}; stroke-linejoin:round; stroke-linecap:round${se.dash ? "; stroke-dasharray:10 8" : ""}"/>`;
      });
      if (s.dots || se.dots) pts.forEach(p => { if (p) out += `<circle cx="${p[0]}" cy="${p[1]}" r="${sw * 1.2}" style="fill:${c}"/>`; });
      const li = last(se);
      if (li >= 0) {
        out += `<circle cx="${X(li)}" cy="${Y(se.values[li])}" r="${sw * 1.6}" style="fill:var(--bg); stroke:${c}; stroke-width:${sw}"/>`;
        if (endLabels) ends.push({ y: Y(se.values[li]), x: X(li), t: endTxt(se), c });
      }
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < fv) ends[i].y = ends[i - 1].y + fv;
    ends.forEach(e => { out += text(e.x + 16, e.y, e.t, "vl", { fs: fv * 0.9, base: "central", fill: e.c, halo: true }); });
    (s.ref || []).forEach(r => {
      const c = col(r.color || "warn");
      out += `<line class="refl" x1="${x0}" x2="${x1}" y1="${Y(r.v)}" y2="${Y(r.v)}" style="stroke:${c}"/>` + text(x0 + 8, Y(r.v) - 10, r.label || "", "lb", { fs, fill: c, halo: true });
    });
    return out;
  }

  /* ---------- 円・ドーナツ（凡例は右に値と割合） ---------- */
  function donut(s, W, H, { fs, fv }) {
    const items = s.items || [], total = items.reduce((t, x) => t + x.v, 0);
    const f = v => Slides.fmt(v, s.fmt || {});
    const legend = s.legend !== false;
    const D = Math.min(H, legend ? W * 0.5 : W), R = D / 2, r = R * (s.inner ?? (s.type === "pie" ? 0 : 0.58));
    const cx = R, cy = H / 2;
    let out = "", a = -Math.PI / 2;
    items.forEach((it, i) => {
      const da = (it.v / total) * Math.PI * 2, b = a + da, lg = da > Math.PI ? 1 : 0, c = col(it.color, i);
      const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      const [ax, ay] = p(a, R), [bx, by] = p(b, R), [cx2, cy2] = p(b, r), [dx, dy] = p(a, r);
      out += items.length === 1
        ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" style="fill:none; stroke:${c}; stroke-width:${R - r}"/>`
        : `<path d="M${ax},${ay}A${R},${R} 0 ${lg} 1 ${bx},${by}L${cx2},${cy2}${r ? `A${r},${r} 0 ${lg} 0 ${dx},${dy}` : ""}Z" style="fill:${c}; stroke:var(--bg); stroke-width:3"/>`;
      if (s.sliceLabels !== false && da > 0.35) {
        const [lx, ly] = p(a + da / 2, r ? (R + r) / 2 : R * 0.62);
        out += text(lx, ly, `${Math.round((it.v / total) * 100)}%`, "vl in", { fs, anchor: "middle", base: "central" });
      }
      a = b;
    });
    if (r && s.center) {
      out += text(cx, cy - fs * 0.2, s.center.v ?? f(total), "vl", { fs: fv * 1.5, anchor: "middle" });
      if (s.center.k) out += text(cx, cy + fv * 0.9, s.center.k, "tk", { fs, anchor: "middle" });
    }
    if (legend) {
      const x = D + 50, rowH = Math.min((H - 10) / items.length, fs * 3.2);
      const y0 = cy - (rowH * items.length) / 2 + rowH / 2;
      items.forEach((it, i) => {
        const y = y0 + rowH * i;
        out += `<rect x="${x}" y="${y - fs * 0.5}" width="${fs}" height="${fs}" rx="3" style="fill:${col(it.color, i)}"/>`;
        out += text(x + fs + 14, y, it.label, "lb", { fs: fs * 1.1, base: "central" });
        const pc = `${Math.round((it.v / total) * 100)}%`, lv = s.legendValue || "both";
        out += text(W, y, lv === "pct" ? pc : lv === "value" ? f(it.v) : `${f(it.v)}  ${pc}`, "vl", { fs: fs * 1.1, anchor: "end", base: "central" });
      });
    }
    return out;
  }

  /* ---------- 散布図・バブル ---------- */
  function scatter(s, W, H, { fs }) {
    const P = s.points || [], ax = s.x || {}, ay = s.y || {};
    const scx = scale(Math.min(...P.map(p => p.x)), Math.max(...P.map(p => p.x)), PITCH() ? 3 : 5, ax);
    const scy = scale(Math.min(...P.map(p => p.y)), Math.max(...P.map(p => p.y)), PITCH() ? 3 : 5, ay);
    const fx = v => Slides.fmt(v, ax.fmt || {}), fy = v => Slides.fmt(v, ay.fmt || {});
    const rMax = s.rMax || (PITCH() ? 70 : 44), vMax = Math.max(...P.map(p => p.r || 0), 1);
    const leftW = Math.max(...ticks(scy).map(v => tw(fy(v), fs, 600))) + 14 + (ay.label ? fs * 1.6 : 0);
    const x0 = leftW, x1 = W - 20, y0 = 20, y1 = H - fs * 1.3 - 14 - (ax.label ? fs * 1.5 : 0);
    const X = v => x0 + ((v - scx.lo) / (scx.hi - scx.lo)) * (x1 - x0), Y = v => y1 - ((v - scy.lo) / (scy.hi - scy.lo)) * (y1 - y0);
    let out = "";
    ticks(scy).forEach(v => { out += `<line class="grid-l" x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}"/>` + text(x0 - 12, Y(v), fy(v), "tk", { fs, anchor: "end", base: "central" }); });
    ticks(scx).forEach(v => { out += text(X(v), y1 + fs + 10, fx(v), "tk", { fs, anchor: "middle" }); });
    out += `<line class="ax" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/><line class="ax" x1="${x0}" x2="${x0}" y1="${y0}" y2="${y1}"/>`;
    if (ax.label) out += text((x0 + x1) / 2, H - 4, ax.label, "lb", { fs, anchor: "middle" });
    if (ay.label) out += `<text class="lb" transform="translate(${fs},${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">${esc(ay.label)}</text>`;
    if (s.quad) {
      const qx = X(s.quad.x ?? (scx.lo + scx.hi) / 2), qy = Y(s.quad.y ?? (scy.lo + scy.hi) / 2);
      out += `<line class="refl" x1="${qx}" x2="${qx}" y1="${y0}" y2="${y1}" style="stroke:var(--sub); stroke-width:2"/><line class="refl" x1="${x0}" x2="${x1}" y1="${qy}" y2="${qy}" style="stroke:var(--sub); stroke-width:2"/>`;
      const ql = s.quad.labels || [];
      [[x0 + 12, y0 + fs, "start"], [x1 - 12, y0 + fs, "end"], [x0 + 12, y1 - 12, "start"], [x1 - 12, y1 - 12, "end"]].forEach(([x, y, an], i) => { if (ql[i]) out += text(x, y, ql[i], "tk", { fs, anchor: an }); });
    }
    P.forEach((p, i) => {
      const r = p.r ? Math.sqrt(p.r / vMax) * rMax : PITCH() ? 16 : 10, c = col(p.color || (p.key ? "accent" : "mid"), i);
      out += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${r}" style="fill:${c}; opacity:${p.r ? 0.85 : 1}; stroke:var(--bg); stroke-width:2"/>`;
      if (p.label) out += text(X(p.x) + r + 8, Y(p.y), p.label, p.key ? "vl" : "lb", { fs, base: "central", halo: true, fill: p.key ? "var(--accent)" : "" });
    });
    return out;
  }

  /* ---------- ウォーターフォール（total:true は合計の棒） ---------- */
  function waterfall(s, W, H, { fs, fv }) {
    const It = s.items || [];
    const f = v => Slides.fmt(v, s.fmt || {}), fs2 = v => Slides.fmt(v, { ...(s.fmt || {}), sign: true });
    let run = 0;
    const bars = It.map(it => { if (it.total) { const b = { a: 0, b: it.v ?? run, it }; run = b.b; return b; } const b = { a: run, b: run + it.v, it }; run += it.v; return b; });
    const sc = scale(Math.min(0, ...bars.flatMap(b => [b.a, b.b])), Math.max(...bars.flatMap(b => [b.a, b.b])), PITCH() ? 3 : 5, { min: s.min, max: s.max });
    const lines = Math.max(...It.map(it => String(it.label).split("\n").length));
    const x0 = 0, x1 = W, y0 = fv * 1.5 + (s.unit ? fs * 1.5 : 0), y1 = H - lines * fs * 1.2 - 14;
    const Y = v => y1 - ((v - sc.lo) / (sc.hi - sc.lo)) * (y1 - y0);
    const band = (x1 - x0) / It.length, bw = band * (1 - (s.gap ?? 0.3));
    let out = s.unit ? text(0, fs, s.unit, "un", { fs }) : "";
    bars.forEach((b, i) => {
      const cx = x0 + band * i + band / 2, up = b.b >= b.a;
      const c = col(b.it.color || (b.it.total ? "accent" : up ? "mid" : "warn"));
      out += `<rect x="${cx - bw / 2}" y="${Math.min(Y(b.a), Y(b.b))}" width="${bw}" height="${Math.max(2, Math.abs(Y(b.a) - Y(b.b)))}" rx="6" style="fill:${c}"/>`;
      out += text(cx, Math.min(Y(b.a), Y(b.b)) - 12, b.it.total ? f(b.b) : fs2(b.b - b.a), "vl", { fs: b.it.total ? fv : fv * 0.85, anchor: "middle", fill: b.it.total ? "" : up ? "" : "var(--warn)" });
      out += text(cx, y1 + fs + 10, b.it.label, b.it.total ? "lb" : "tk", { fs, anchor: "middle" });
      if (i < bars.length - 1) out += `<line x1="${cx + bw / 2}" x2="${cx + band - bw / 2}" y1="${Y(b.b)}" y2="${Y(b.b)}" style="stroke:var(--sub); stroke-width:2; stroke-dasharray:5 5"/>`;
    });
    out += `<line class="ax" x1="${x0}" x2="${x1}" y1="${Y(Math.max(0, sc.lo))}" y2="${Y(Math.max(0, sc.lo))}"/>`;
    return out;
  }

  /* ---------- サンキー（links: [{from,to,v}]、nodes で名前・色） ---------- */
  function sankey(s, W, H, { fs }) {
    const links = s.links || [], meta = Object.fromEntries((s.nodes || []).map(n => [n.id, n]));
    const f = v => Slides.fmt(v, s.fmt || {});
    const ids = [...new Set(links.flatMap(l => [l.from, l.to]))];
    const N = Object.fromEntries(ids.map(id => [id, { id, label: meta[id]?.label ?? id, color: meta[id]?.color, in: [], out: [], col: 0 }]));
    links.forEach(l => { N[l.from].out.push(l); N[l.to].in.push(l); });
    for (let k = 0; k < ids.length; k++) links.forEach(l => { N[l.to].col = Math.max(N[l.to].col, N[l.from].col + 1); });
    ids.forEach(id => { if (meta[id]?.col !== undefined) N[id].col = meta[id].col; });
    const ncol = Math.max(...ids.map(id => N[id].col)) + 1;
    ids.forEach(id => { const n = N[id]; n.v = Math.max(n.in.reduce((t, l) => t + l.v, 0), n.out.reduce((t, l) => t + l.v, 0)); });
    const cols = [...Array(ncol)].map((_, c) => ids.filter(id => N[id].col === c).map(id => N[id]));
    const nw = s.nodeWidth || (PITCH() ? 40 : 26), pad = s.pad ?? fs * 1.6;
    const lab = n => `${n.label}\n${f(n.v)}`;
    const leftW = Math.max(...cols[0].map(n => tw(n.label, fs, 800))) + 16;
    const rightW = Math.max(...cols[ncol - 1].map(n => tw(n.label, fs, 800))) + 16;
    const x0 = leftW, x1 = W - rightW - nw;
    const k = Math.min(...cols.map(c => (H - pad * (c.length - 1)) / c.reduce((t, n) => t + n.v, 0)));
    cols.forEach((c, ci) => {
      const tot = c.reduce((t, n) => t + n.v * k, 0) + pad * (c.length - 1);
      let y = (H - tot) / 2;
      c.forEach(n => { n.x = x0 + (ncol > 1 ? (ci / (ncol - 1)) * (x1 - x0) : 0); n.y = y; n.h = n.v * k; n.oy = y; n.iy = y; y += n.h + pad; });
    });
    let out = "";
    const ci0 = {};
    ids.forEach((id, i) => { ci0[id] = col(N[id].color, i); });
    [...links].sort((a, b) => N[a.to].y - N[b.to].y).forEach(l => {
      const a = N[l.from], b = N[l.to], h = l.v * k;
      const sx = a.x + nw, tx = b.x, sy = a.oy, ty = b.iy, xm = (sx + tx) / 2;
      a.oy += h; b.iy += h;
      out += `<path d="M${sx},${sy}C${xm},${sy} ${xm},${ty} ${tx},${ty}L${tx},${ty + h}C${xm},${ty + h} ${xm},${sy + h} ${sx},${sy + h}Z" style="fill:${l.color ? col(l.color) : ci0[l.from]}; opacity:0.28"/>`;
    });
    ids.forEach(id => {
      const n = N[id], c = ci0[id];
      out += `<rect x="${n.x}" y="${n.y}" width="${nw}" height="${Math.max(2, n.h)}" rx="3" style="fill:${c}"/>`;
      const cy = n.y + n.h / 2;
      if (n.col === 0) out += text(n.x - 12, cy, lab(n), "lb", { fs, anchor: "end", vcenter: true, base: "central" });
      else if (n.col === ncol - 1) out += text(n.x + nw + 12, cy, lab(n), "lb", { fs, vcenter: true, base: "central" });
      else out += text(n.x + nw + 10, cy, lab(n), "lb", { fs, vcenter: true, base: "central", halo: true });
    });
    return out;
  }

  /* ---------- ガント（rows: [{group,label,a,b,color,text}]、ticks・marks） ---------- */
  function gantt(s, W, H, { fs }) {
    const R = s.rows || [], min = s.min ?? Math.min(...R.map(r => r.a)), max = s.max ?? Math.max(...R.map(r => r.b));
    const grpW = R.some(r => r.group) ? Math.max(...R.map(r => tw(r.group || "", fs, 800))) + 24 : 0;
    const labW = s.labelWidth || Math.max(...R.map(r => tw(r.label || "", fs * 0.95, 600))) + 20;
    const marks = s.marks || [];
    const x0 = grpW + labW, x1 = W - 8, y0 = fs * 1.6, y1 = H - (marks.length ? fs * 1.8 : 4);
    const X = v => x0 + ((v - min) / (max - min)) * (x1 - x0);
    const rh = (y1 - y0) / R.length, bh = Math.min(rh * 0.68, PITCH() ? 70 : 34);
    let out = "";
    (s.ticks || []).forEach(t => { out += `<line class="grid-l" x1="${X(t.v)}" x2="${X(t.v)}" y1="${y0 - 4}" y2="${y1}"/>` + text(X(t.v) + (t.mid ? 0 : 6), y0 - 10, t.label, "tk", { fs, anchor: t.mid ? "middle" : "start" }); });
    R.forEach((r, i) => {
      const y = y0 + rh * i, cy = y + rh / 2;
      if (r.group) { out += text(0, cy, r.group, "lb", { fs, base: "central" }); if (i) out += `<line class="grid-l" x1="0" x2="${x1}" y1="${y}" y2="${y}"/>`; }
      out += text(x0 - 14, cy, r.label || "", "tk", { fs: fs * 0.95, anchor: "end", base: "central", fill: "var(--ink)" });
      const c = col(r.color || "accent"), w = Math.max(4, X(r.b) - X(r.a));
      out += `<rect x="${X(r.a)}" y="${cy - bh / 2}" width="${w}" height="${bh}" rx="${Math.min(8, bh / 3)}" style="fill:${c}${r.dash ? "; opacity:0.45" : ""}"/>`;
      if (r.text && tw(r.text, fs * 0.9, 700) < w - 16) out += text(X(r.a) + 10, cy, r.text, r.dash ? "tk" : "vl in", { fs: fs * 0.9, base: "central", fill: r.dash ? "var(--ink)" : "" });
      else if (r.text) out += text(X(r.b) + 10, cy, r.text, "tk", { fs: fs * 0.9, base: "central" });
    });
    marks.forEach((m, i) => {
      const c = col(m.color || "warn"), x = X(m.v);
      out += `<line class="refl" x1="${x}" x2="${x}" y1="${y0 - 6}" y2="${y1 + 6}" style="stroke:${c}"/>`;
      out += text(m.anchor === "end" ? x - 8 : x + 8, H - 6, m.label, "lb", { fs, fill: c, anchor: m.anchor || "start" });
    });
    return out;
  }

  const TYPES = { bar, line, donut, pie: donut, scatter, bubble: scatter, waterfall, sankey, gantt };
  function render(el, force) {
    if (el.dataset.drawn && !force) return;
    const src = el.dataset.chart || el.querySelector('script[type="application/json"]')?.textContent;
    if (!src) return;
    el.dataset.chart = src;
    let s;
    try { s = resolve(JSON.parse(src)); } catch (e) { el.textContent = "chart JSON error: " + e.message; el.classList.add("f-missing"); return; }
    const W = el.clientWidth, H = el.clientHeight || s.height || 520;
    const fn = TYPES[s.type || "bar"];
    if (!fn) { el.textContent = "unknown chart type: " + s.type; return; }
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.title || s.type)}">${fn(s, W, H, sizes(el))}</svg>`;
    el.dataset.drawn = "1";
  }
  Slides.chart = render;
  Slides.chartTypes = TYPES;
  Slides.onShow(sec => sec.querySelectorAll(".chart[data-chart], .chart > script[type='application/json']").forEach(x => render(x.classList.contains("chart") ? x : x.parentElement)));
})();
