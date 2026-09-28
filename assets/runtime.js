/* html-slides runtime：画面合わせ・ページ送り・番号・章の並び・data-f の数字・?check・発表者メモ。
   デッキ側の <script> は window.DATA と Slides.onShow(fn) を使える（DOMContentLoaded で初期化するので、デッキ側の定義が先に済む）。 */
(() => {
  const H = document.documentElement;
  const Q0 = new URLSearchParams(location.search);
  if (Q0.get("theme")) H.dataset.theme = Q0.get("theme");
  const MODE = H.dataset.mode || "doc";
  const EN = (H.lang || "ja").toLowerCase().startsWith("en");
  const MIN_FS = MODE === "pitch" ? 54 : 16;
  const Q = new URLSearchParams(location.search);
  const CHECK = Q.has("check"), PRESENTER = Q.has("presenter");
  const T = EN
    ? { prev: "Previous", next: "Next", fs: "Fullscreen", ovf: "Issues", elapsed: "Elapsed", until: "End this page by", reset: "T: reset timer", nx: "Next: " }
    : { prev: "前へ", next: "次へ", fs: "全画面", ovf: "問題", elapsed: "経過", until: "このページは", reset: "T で時計を0に", nx: "次：" };
  const hooks = [];

  const get = path => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), window.DATA);
  /** 数字の書式。d 小数の桁、x 掛ける数、r この単位で丸める、u 単位、sign 正の数に＋ */
  function fmt(v, o = {}) {
    if (v == null || Number.isNaN(+v)) return "—";
    v = +v * (o.x ?? 1);
    if (o.r) v = Math.round(v / o.r) * o.r;
    const d = o.d ?? 0;
    let s = Math.abs(v).toLocaleString(EN ? "en-US" : "ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d });
    if (v < 0 && s.replace(/[0.,]/g, "")) s = "−" + s;
    else if (o.sign && v > 0) s = "+" + s;
    return s + (o.u ?? "");
  }
  function fillData(root) {
    root.querySelectorAll("[data-f]").forEach(el => {
      const v = get(el.dataset.f);
      const ds = el.dataset;
      el.textContent = fmt(v, { d: +(ds.d || 0), x: ds.x ? +ds.x : 1, r: ds.r ? +ds.r : 0, u: ds.u || "", sign: "sign" in ds });
      el.classList.toggle("f-missing", v === undefined);
    });
  }

  const Slides = (window.Slides = { mode: MODE, lang: EN ? "en" : "ja", get, fmt, fillData, onShow: fn => hooks.push(fn), ids: [] });

  /* ---------- ?check：表示中のページの問題を赤枠にし、#check-out に JSON で書く（export.mjs が読む） ---------- */
  function describe(el) {
    const cls = [...el.classList].filter(c => c !== "ovf").slice(0, 2).map(c => "." + c).join("");
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls}${txt ? ` "${txt}"` : ""}`;
  }
  /* 本文（見出しの線から下の注記まで）で実際に塗られている範囲：文字・画像・SVG・背景や枠のある箱 */
  function painted(sec) {
    const boxes = [], skip = ".kicker, h1, .rule, .foot, .pno, .ovf-badge, .ovf-gap, aside.notes, [data-nocheck], .nav";
    const visible = c => c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c);
    sec.querySelectorAll("*").forEach(el => {
      if (el.closest(skip) || el.parentElement.closest("svg")) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || +cs.opacity === 0) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const boxy = ["IMG", "svg", "CANVAS", "VIDEO"].includes(el.tagName) || visible(cs.backgroundColor) || cs.backgroundImage !== "none"
        || (parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0 && visible(cs.borderTopColor)) || cs.boxShadow !== "none";
      if (boxy) boxes.push(r);
      if (el.tagName === "svg") return;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(n);
        const t = rg.getBoundingClientRect(); if (t.width && t.height) boxes.push(t);
      }
    });
    return boxes;
  }
  /* 空き・偏り：左右の空きの差が 15% 以上、または下の空きが上より 35% 以上多い（中央に寄せたページは差が出ないので通る） */
  const SPARSE_X = 15, SPARSE_Y = 35;
  function sparse(sec, S, k, foot) {
    if (sec.matches(".cover, .chap, .dark, .full-img, [data-sparse-ok]")) return null;
    const cs = getComputedStyle(sec), px = v => parseFloat(v) * k;
    const head = sec.querySelector(":scope > .rule") || sec.querySelector(":scope > h1");
    const A = { l: S.left + px(cs.paddingLeft), r: S.right - px(cs.paddingRight),
      t: head ? head.getBoundingClientRect().bottom : S.top + px(cs.paddingTop), b: foot ? foot.top : S.bottom - px(cs.paddingBottom) };
    const bx = painted(sec);
    if (!bx.length || A.r <= A.l || A.b <= A.t) return null;
    const U = { l: Math.min(...bx.map(r => r.left)), r: Math.max(...bx.map(r => r.right)), t: Math.min(...bx.map(r => r.top)), b: Math.max(...bx.map(r => r.bottom)) };
    const W = A.r - A.l, H = A.b - A.t, pct = v => Math.round(Math.max(0, v) * 100);
    const e = { l: pct((U.l - A.l) / W), r: pct((A.r - U.r) / W), t: pct((U.t - A.t) / H), b: pct((A.b - U.b) / H) };
    const said = [], gaps = [];
    if (e.r - e.l >= SPARSE_X) { said.push(`右が${e.r}%`); gaps.push({ l: U.r, r: A.r, t: A.t, b: A.b }); }
    if (e.l - e.r >= SPARSE_X) { said.push(`左が${e.l}%`); gaps.push({ l: A.l, r: U.l, t: A.t, b: A.b }); }
    if (e.b - e.t >= SPARSE_Y) { said.push(`下が${e.b}%`); gaps.push({ l: A.l, r: A.r, t: U.b, b: A.b }); }
    if (!said.length) return null;
    return { why: `sparse ${said.join("・")}空いている（中身を広げる・大きくする・ページをまとめる。わざと空けるなら data-sparse-ok）`,
      gaps: gaps.map(g => ({ left: (g.l - S.left) / k, top: (g.t - S.top) / k, width: (g.r - g.l) / k, height: (g.b - g.t) / k })) };
  }
  function check(sec) {
    sec.querySelectorAll(".ovf").forEach(e => e.classList.remove("ovf"));
    sec.querySelectorAll(".ovf-badge, .ovf-gap").forEach(e => e.remove());
    const S = sec.getBoundingClientRect(), k = S.width / 1920;
    const foot = sec.querySelector(":scope > .foot")?.getBoundingClientRect();
    const hits = [];
    const add = (el, why) => { if (!hits.some(h => h.el === el)) hits.push({ el, why }); };
    sec.querySelectorAll("*").forEach(el => {
      if (el.closest(".pno, .ovf-badge, aside.notes, [data-nocheck]")) return;
      if (el.classList.contains("map") && !el.querySelector("svg")) add(el, "map-empty（make-map.mjs --into で書き込む）");
      if (el.id && !el.closest("svg") && document.querySelectorAll(`[id="${CSS.escape(el.id)}"]`).length > 1) add(el, `dup-id #${el.id}（デッキ全体で一意にする）`);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const cs = getComputedStyle(el);
      if (r.left < S.left - k || r.right > S.right + k || r.top < S.top - k || r.bottom > S.bottom + k) add(el, "outside");
      const inSvg = el.closest("svg");
      if (!inSvg && el.clientHeight > 0 && cs.display !== "inline" && !["svg", "IMG", "SECTION"].includes(el.tagName)
        && cs.textOverflow !== "ellipsis"
        && (el.scrollHeight > el.clientHeight + (cs.overflowY === "visible" ? Math.max(12, parseFloat(cs.fontSize) * 0.35) : 2)
          || el.scrollWidth > el.clientWidth + (cs.overflowX === "visible" ? 6 : 2))) add(el, "clipped");
      if (foot && !inSvg && !el.closest(".foot, .pno") && cs.position !== "absolute" && r.bottom > foot.top - 4 * k && r.top < foot.bottom) add(el, "on-foot");
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (hasText && parseFloat(cs.fontSize) < MIN_FS) add(el, `font ${parseFloat(cs.fontSize)}px < ${MIN_FS}px`);
      if (el.tagName === "IMG" && el.complete && !el.naturalWidth) add(el, "image-missing");
      if (el.classList.contains("f-missing")) add(el, `data-missing ${el.dataset.f || el.dataset.chart?.slice(0, 40) || ""}`);
    });
    hits.forEach(h => h.el.classList.add("ovf"));
    const sp = sparse(sec, S, k, foot);
    if (sp) {
      hits.push({ el: sec, why: sp.why });
      sp.gaps.forEach(g => {
        const d = document.createElement("div");
        d.className = "ovf-gap";
        Object.assign(d.style, Object.fromEntries(Object.entries(g).map(([p, v]) => [p, v + "px"])));
        sec.appendChild(d);
      });
    }
    let out = document.getElementById("check-out");
    if (!out) { out = document.createElement("script"); out.type = "application/json"; out.id = "check-out"; document.body.appendChild(out); }
    out.textContent = JSON.stringify({ id: sec.id, issues: hits.map(h => ({ why: h.why, el: describe(h.el) })) });
    if (hits.length) {
      const b = document.createElement("div");
      b.className = "ovf-badge";
      b.textContent = `${T.ovf} ${hits.length}：${[...new Set(hits.map(h => h.why.split(" ")[0]))].slice(0, 4).join(" / ")}`;
      sec.appendChild(b);
      console.warn(sec.id, hits);
    }
  }

  function init() {
    const secs = [...document.querySelectorAll("section")];
    const ids = (Slides.ids = secs.map(s => s.id));
    fillData(document);

    /* ページ番号（data-nopno で消す） */
    secs.forEach((s, i) => {
      if (s.hasAttribute("data-nopno") || H.hasAttribute("data-nopno")) return;
      const n = document.createElement("div");
      n.className = "pno";
      n.textContent = i + 1;
      s.appendChild(n);
    });
    /* 中扉の下に章の並び（section.chap の data-n・data-t） */
    const chaps = secs.filter(s => s.classList.contains("chap"));
    if (chaps.length > 1) chaps.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "chaps";
      row.innerHTML = chaps.map((c, j) => `<div class="${j === i ? "on" : j < i ? "done" : ""}"><b>${c.dataset.n || j + 1}</b>${c.dataset.t || ""}</div>`).join("");
      s.appendChild(row);
    });
    /* ページへのリンクに番号（PNG・PDF でもたどれる） */
    document.querySelectorAll("a.ref").forEach(a => {
      const n = ids.indexOf(a.hash.slice(1)) + 1;
      if (n) a.insertAdjacentHTML("beforeend", `<span class="pg">p.${n}</span>`);
    });

    const nav = document.createElement("div");
    nav.className = "nav";
    nav.innerHTML = `<button data-go="-1" aria-label="${T.prev}">‹</button><span></span><button data-go="1" aria-label="${T.next}">›</button><button data-fs aria-label="${T.fs}">⛶</button>`;
    document.body.appendChild(nav);

    /* 発表者メモ：N で重ねる、P で発表者用の窓（ページ送りが連動）、T で時計を0に */
    const np = document.createElement("div");
    np.className = "np";
    np.innerHTML = `<div class="meta"></div><div class="txt"></div><div class="next"></div>`;
    document.body.appendChild(np);
    const bc = "BroadcastChannel" in window ? new BroadcastChannel("html-slides:" + location.pathname) : null;
    let t0 = null;
    const toSec = s => { const [m, x] = s.split(":").map(Number); return m * 60 + x; };
    const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    const current = () => (ids.includes(location.hash.slice(1)) ? location.hash.slice(1) : ids[0]);
    function paintNotes() {
      const id = current(), i = ids.indexOf(id), sec = secs[i];
      const el = t0 === null ? 0 : (performance.now() - t0) / 1000;
      const end = sec.dataset.end ? toSec(sec.dataset.end) : null;
      np.querySelector(".meta").innerHTML = `<span>${i + 1} / ${ids.length}</span><span>${T.elapsed} <b class="${end !== null && el > end ? "late" : ""}">${mmss(el)}</b></span>`
        + (sec.dataset.end ? `<span>${T.until} <b>${sec.dataset.end}</b>${EN ? "" : " まで"}</span>` : "") + `<span>${T.reset}</span>`;
      np.querySelector(".txt").textContent = sec.querySelector("aside.notes")?.textContent.trim() || "";
      const nx = secs[i + 1];
      np.querySelector(".next").textContent = nx ? T.nx + (nx.querySelector("h1")?.textContent.trim() || nx.id) : "";
    }
    setInterval(() => { if (np.classList.contains("show") || PRESENTER) paintNotes(); }, 500);

    function fit() {
      const k = Math.min(innerWidth / 1920, innerHeight / 1080);
      const st = document.body.style;
      st.setProperty("--k", k);
      st.setProperty("--x", (innerWidth - 1920 * k) / 2 + "px");
      st.setProperty("--y", (innerHeight - 1080 * k) / 2 + "px");
    }
    function show() {
      const id = current();
      document.querySelectorAll("section.on").forEach(s => s.classList.remove("on"));
      const sec = secs[ids.indexOf(id)];
      sec.classList.add("on");
      if (t0 === null && id !== ids[0]) t0 = performance.now();
      nav.querySelector("span").textContent = `${ids.indexOf(id) + 1} / ${ids.length}`;
      hooks.forEach(fn => { try { fn(sec); } catch (e) { console.error(e); } });
      paintNotes();
      if (CHECK) setTimeout(() => check(sec), 80);
    }
    function go(d) {
      const cur = Math.max(0, ids.indexOf(location.hash.slice(1)));
      const next = Math.min(ids.length - 1, Math.max(0, cur + d));
      if (next !== cur || !location.hash) location.hash = ids[next];
    }
    Slides.go = go;
    Slides.show = show;
    if (bc) bc.onmessage = e => {
      if (e.data.id && e.data.id !== current()) location.hash = e.data.id;
      if (e.data.reset) t0 = performance.now();
    };

    let hideTimer;
    const reveal = () => { nav.classList.add("show"); clearTimeout(hideTimer); hideTimer = setTimeout(() => nav.classList.remove("show"), 2500); };
    nav.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.fs !== undefined) document.fullscreenElement ? document.exitFullscreen() : H.requestFullscreen?.();
      else go(Number(b.dataset.go));
    });
    addEventListener("keydown", e => {
      if (e.target.closest?.("input, textarea")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") location.hash = ids[0];
      else if (e.key === "End") location.hash = ids[ids.length - 1];
      else if (e.key === "f") H.requestFullscreen?.();
      else if (e.key === "n") { np.classList.toggle("show"); paintNotes(); }
      else if (e.key === "p") window.open(location.pathname + "?presenter" + location.hash, "html-slides-presenter", "width=1100,height=700");
      else if (e.key === "t") { t0 = performance.now(); bc?.postMessage({ reset: true }); paintNotes(); }
    });
    let touchX = null;
    addEventListener("touchstart", e => { touchX = e.touches[0].clientX; reveal(); }, { passive: true });
    addEventListener("touchend", e => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      touchX = null;
    });
    addEventListener("mousemove", reveal);
    addEventListener("resize", fit);
    addEventListener("hashchange", () => { show(); bc?.postMessage({ id: current() }); });
    if (PRESENTER) document.body.classList.add("presenter");
    fit();
    /* 文字の幅を測ってから図を描くので、フォントの読み込みを待つ */
    const fontsReady = document.fonts
      ? Promise.all(['"Noto Sans JP"', "Inter"].flatMap(f => [400, 800].map(w => document.fonts.load(`${w} 20px ${f}`, "あ漢Aa1").catch(() => {})))).then(() => document.fonts.ready)
      : Promise.resolve();
    fontsReady.then(show);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init);
})();
