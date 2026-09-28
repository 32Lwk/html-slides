#!/usr/bin/env node
// README の図（docs/img/*.png）を作る。figures.html もこのスキルの部品で組んである。
//   node docs/figures/build.mjs
// 1. 検査の見本（bad は ?check 付き、good は普通に）を撮る → 2. 図のページを撮って docs/img/<id>.png に置く
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const deck = join(HERE, "figures.html");
const exp = (...a) => {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts/export.mjs"), deck, "--out", join(HERE, "png"), ...a], { stdio: "inherit" });
  if (r.status && !a.includes("--check")) process.exit(r.status);
};
if (!existsSync(join(HERE, "fonts"))) spawnSync(process.execPath, [join(ROOT, "scripts/deck.mjs"), "update", deck], { stdio: "inherit" });

const FIGS = ["hero", "features", "workflow", "check", "themes", "modes"];
exp("--check", "--only", "bad");
exp("--only", "good");
exp("--only", FIGS.join(","));

const out = join(ROOT, "docs/img");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(join(HERE, "png"))) {
  const m = f.match(/^\d+-(.+)\.png$/);
  if (m && FIGS.includes(m[1])) copyFileSync(join(HERE, "png", f), join(out, m[1] + ".png"));
}
console.log("→ " + out);
