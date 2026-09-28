/* html-slides 財務の表：<div class="fin" data-fin='{…}'> を、DATA の数字から損益計算書・資金繰りなどの表にする。
   列は四半期と年など（groups で上に見出し、各まとまりの頭に縦線）。行は小計（sum）・強調（key）・率（pct）・見出し（head）・字下げ（indent）。
   マイナスは「−」で赤く、数字がないセルは「—」にして ?check の data-missing に出す。 */
(() => {
  const S = window.Slides;
  const at = v => (typeof v === "string" && v.startsWith("@") ? S.get(v.slice(1)) : v);
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function one(host) {
    let o;
    try { o = JSON.parse(host.dataset.fin); } catch (e) { host.textContent = "data-fin の JSON が読めない"; host.classList.add("f-missing"); return; }
    const cols = at(o.cols) || [], groups = at(o.groups) || [], em = new Set(at(o.em) || []);
    const starts = new Set();
    let c = 0;
    groups.forEach(g => { if (c) starts.add(c); c += g.span || 1; });
    const cls = i => [starts.has(i) ? "gs" : "", em.has(i) ? "em" : ""].filter(Boolean).join(" ");
    const missing = [];
    let h = "<table class=\"fin\">";
    if (groups.length) h += `<tr class="grp"><th class="lb"></th>${groups.map((g, gi) => `<th colspan="${g.span || 1}" class="${gi ? "gs" : ""}">${esc(g.label)}</th>`).join("")}</tr>`;
    h += `<tr><th class="lb">${esc(o.unit ? (S.lang === "en" ? `Unit: ${o.unit}` : `単位：${o.unit}`) : "")}</th>${cols.map((x, i) => `<th class="${cls(i)}">${esc(x)}</th>`).join("")}</tr>`;
    (o.rows || []).forEach(r => {
      if (r.head) { h += `<tr class="head"><td class="lb" colspan="${cols.length + 1}">${esc(r.head)}</td></tr>`; return; }
      const vals = at(r.v);
      const f = Object.assign({}, r.kind === "pct" ? { d: 1, x: 100, u: "%" } : o.fmt || {}, r.fmt || {});
      if (!Array.isArray(vals)) missing.push(typeof r.v === "string" ? r.v.replace(/^@/, "") : r.label);
      const tr = [r.kind || "", r.indent ? `i${r.indent}` : ""].filter(Boolean).join(" ");
      h += `<tr class="${tr}"><td class="lb">${esc(r.label)}</td>${cols.map((_, i) => {
        const v = Array.isArray(vals) ? vals[i] : undefined;
        const neg = typeof v === "number" && v * (f.x ?? 1) < 0 && S.fmt(v, f).startsWith("−");
        return `<td class="${[cls(i), neg ? "neg" : ""].filter(Boolean).join(" ")}">${S.fmt(v, f)}</td>`;
      }).join("")}</tr>`;
    });
    host.innerHTML = h + "</table>";
    host.classList.toggle("f-missing", missing.length > 0);
    if (missing.length) host.dataset.f = missing.join(",");
  }
  S.tables = root => root.querySelectorAll("[data-fin]").forEach(one);
})();
