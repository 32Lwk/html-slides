/* html-slides diagrams：
   .dgm[data-links] … 中の id 付きの箱どうしを矢印でつなぐ（関係図・流れ図・担当者ごとのフロー図・ツリー）。
     data-links='[["a","b","ラベル",{"mode":"elbow","tone":"key"}], {"from":"b","to":"c","dash":true}]'
     from/to は "id" か "id:right" "id:bottom:0.3"（辺と辺の上の位置 0〜1）。mode: auto（揃えば直線、ずれればカギ形）/ s / hv / vh / curve
     tone: key（強調色）/ money（注意色）、dash: 破線、both: 両向き、label の位置は dx・dy・anchor・at:[x,y] で調整
   .cycle … 中の .node を円周に並べ、次の .node へ弧の矢印を描く（data-r で半径、data-start で最初の角度） */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  function frame(root) {
    const R = root.getBoundingClientRect();
    return { R, k: R.width / root.offsetWidth || 1 };
  }
  function rect(root, F, id) {
    const el = root.querySelector("#" + CSS.escape(id)) || document.getElementById(id);
    if (!el) throw new Error("diagram: no element #" + id);
    const b = el.getBoundingClientRect();
    return { x: (b.left - F.R.left) / F.k, y: (b.top - F.R.top) / F.k, w: b.width / F.k, h: b.height / F.k };
  }
  function at(b, side, t = 0.5) {
    if (side === "top") return [b.x + b.w * t, b.y];
    if (side === "bottom") return [b.x + b.w * t, b.y + b.h];
    if (side === "left") return [b.x, b.y + b.h * t];
    return [b.x + b.w, b.y + b.h * t];
  }
  function sides(a, b) {
    const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2);
    const gx = Math.abs(dx) - (a.w + b.w) / 2, gy = Math.abs(dy) - (a.h + b.h) / 2;
    if (gx >= gy) return dx > 0 ? ["right", "left"] : ["left", "right"];
    return dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
  }
  function geometry(p1, p2, s1, mode, bend = 0.25) {
    const [x1, y1] = p1, [x2, y2] = p2, hz = s1 === "left" || s1 === "right";
    const straight = [`M${x1},${y1}L${x2},${y2}`, [(x1 + x2) / 2, (y1 + y2) / 2]];
    if (mode === "s") return straight;
    if (mode === "hv") return [`M${x1},${y1}H${x2}V${y2}`, [x2, (y1 + y2) / 2]];
    if (mode === "vh") return [`M${x1},${y1}V${y2}H${x2}`, [(x1 + x2) / 2, y2]];
    if (mode === "curve") {
      const c = hz ? `C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}` : `C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
      return [`M${x1},${y1}${c}`, [(x1 + x2) / 2, (y1 + y2) / 2]];
    }
    if (mode === "arc") {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -(y2 - y1) * bend, ny = (x2 - x1) * bend;
      return [`M${x1},${y1}Q${mx + nx},${my + ny} ${x2},${y2}`, [mx + nx / 2, my + ny / 2]];
    }
    if (Math.abs(x1 - x2) < 3 || Math.abs(y1 - y2) < 3) return straight;
    if (hz) { const xm = (x1 + x2) / 2; return [`M${x1},${y1}H${xm}V${y2}H${x2}`, [xm, (y1 + y2) / 2]]; }
    const ym = (y1 + y2) / 2;
    return [`M${x1},${y1}V${ym}H${x2}V${y2}`, [(x1 + x2) / 2, ym]];
  }
  function svgFor(root) {
    let svg = root.querySelector(":scope > svg.dgm-links");
    if (!svg) { svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "dgm-links"); root.prepend(svg); }
    const W = root.offsetWidth, H = root.offsetHeight;
    svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const uid = "d" + Math.random().toString(36).slice(2, 8);
    svg.innerHTML = `<defs>${["", "key", "money"].map(t => `<marker id="${uid}${t}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style="fill:var(--${t === "key" ? "accent" : t === "money" ? "warn" : "sub"})"/></marker>`).join("")}</defs>`;
    return { svg, uid };
  }
  const parseEnd = s => { const [id, side, t] = String(s).split(":"); return { id, side, t: t === undefined ? 0.5 : +t }; };
  function draw(root, links) {
    const F = frame(root), { svg, uid } = svgFor(root);
    let html = "";
    links.forEach(L => {
      const o = Array.isArray(L) ? { from: L[0], to: L[1], label: typeof L[2] === "string" ? L[2] : "", ...(typeof L[2] === "object" ? L[2] : L[3] || {}) } : L;
      const A = parseEnd(o.from), B = parseEnd(o.to);
      const a = rect(root, F, A.id), b = rect(root, F, B.id);
      const [sa, sb] = sides(a, b);
      const s1 = A.side || sa, s2 = B.side || sb;
      const p1 = at(a, s1, A.t), p2 = at(b, s2, B.t);
      const gap = o.gap ?? 4;
      const shift = (p, s, d) => (s === "top" ? [p[0], p[1] - d] : s === "bottom" ? [p[0], p[1] + d] : s === "left" ? [p[0] - d, p[1]] : [p[0] + d, p[1]]);
      const [d, mid] = geometry(o.both ? shift(p1, s1, gap) : p1, shift(p2, s2, gap), s1, o.mode || "auto", o.bend);
      const tone = o.tone || (o.dash ? "money" : "");
      const cls = [o.dash ? "dash" : "", tone].filter(Boolean).join(" ");
      html += `<path d="${d}" class="${cls}" marker-end="url(#${uid}${tone})"${o.both ? ` marker-start="url(#${uid}${tone})"` : ""}/>`;
      if (o.label) {
        const [lx, ly] = o.at || mid;
        const flat = !o.at && d.split(/[LHVCQ]/).length === 2 && Math.abs(p1[1] - p2[1]) < 3;
        const [dx, dy, an] = flat ? [0, -12, "middle"] : [10, 6, "start"];
        html += `<text x="${lx + (o.dx ?? dx)}" y="${ly + (o.dy ?? dy)}" class="${tone}" text-anchor="${o.anchor || an}">${String(o.label).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
      }
    });
    svg.insertAdjacentHTML("beforeend", html);
  }
  function cycle(root) {
    const nodes = [...root.querySelectorAll(":scope > .node")], n = nodes.length;
    if (!n) return;
    const W = root.offsetWidth, H = root.offsetHeight, cx = W / 2, cy = H / 2;
    const maxN = Math.max(...nodes.map(e => Math.max(e.offsetWidth, e.offsetHeight)));
    const R = +root.dataset.r || Math.min(W, H) / 2 - maxN / 2 - 6;
    const a0 = ((+root.dataset.start || -90) * Math.PI) / 180;
    const ang = i => a0 + (i / n) * Math.PI * 2;
    nodes.forEach((e, i) => { e.style.left = cx + R * Math.cos(ang(i)) + "px"; e.style.top = cy + R * Math.sin(ang(i)) + "px"; });
    const { svg, uid } = svgFor(root);
    let html = "";
    nodes.forEach((e, i) => {
      if (i === n - 1 && root.dataset.open !== undefined) return;
      const e2 = nodes[(i + 1) % n];
      const g1 = (Math.hypot(e.offsetWidth, e.offsetHeight) / 2 + 14) / R, g2 = (Math.hypot(e2.offsetWidth, e2.offsetHeight) / 2 + 18) / R;
      const a = ang(i) + g1, b = ang(i + 1) - g2;
      if (b <= a) return;
      const p = t => [cx + R * Math.cos(t), cy + R * Math.sin(t)];
      const [x1, y1] = p(a), [x2, y2] = p(b);
      html += `<path d="M${x1},${y1}A${R},${R} 0 ${b - a > Math.PI ? 1 : 0} 1 ${x2},${y2}" class="key" marker-end="url(#${uid}key)"/>`;
    });
    svg.insertAdjacentHTML("beforeend", html);
  }
  function render(sec) {
    sec.querySelectorAll(".cycle").forEach(el => { if (!el.dataset.drawn) { cycle(el); el.dataset.drawn = "1"; } });
    sec.querySelectorAll(".dgm[data-links]").forEach(el => {
      if (el.dataset.drawn) return;
      try { draw(el, JSON.parse(el.dataset.links)); } catch (e) { console.error(e); el.classList.add("f-missing"); }
      el.dataset.drawn = "1";
    });
  }
  Slides.drawLinks = draw;
  Slides.onShow(render);
})();
