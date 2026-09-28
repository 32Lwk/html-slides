# 財務の表と計算のひな形（損益計算書・資金繰り・損益分岐）

数字は Python で計算して `data.json` に入れ、スライドは `data-fin`（表）と `data-chart`（グラフ）で読むだけにする。表に数字を手で打たない。

## 1. 計算：templates/finance.py

`<skill>/templates/finance.py` をデッキの `data/` にコピーし、`calc.py` から import する（numpy は要らない）。金額は月ごとのリストで、費用も正の数で渡す。

```python
from finance import income_statement, to_columns, cash_flow, break_even, scale

pl = income_statement(revenue,                                   # 月ごとの売上高
                      cogs={"tea": tea, "ship": ship},           # 売上原価の内訳
                      sga={"ads": ads, "fixed": fixed})          # 販売費・一般管理費の内訳
cols = to_columns(pl, unit=1e6, digits=1,                         # 四半期（3か月ずつ）と年の列、百万円
                  rates={"gross_rate": ("gross", "rev"), "op_rate": ("op", "rev")},   # 率は合計してから割る
                  negate=["cogs_tea", "cogs_ship", "cogs_total", "sga_ads", "sga_fixed", "sga_total"])  # 表でマイナスに見せる行
cf = cash_flow(pl["op"], capex={1: 30e6}, financing={0: 400e6},   # 投資と出資（0 は開業前）
               revenue=revenue, collect_lag=1)                    # 売上の入金が1か月遅れる
bep = break_even(revenue, variable=var_cost, fixed=fixed_cost)    # 損益分岐点＝固定費 ÷ 限界利益率

data["fin"] = {"pl": {**cols, **cols.pop("lines")},
               "cf": {"balance": scale(cf["balance"]), "need": cf["need"] / 1e8, "trough": cf["trough_month"]},
               "bep": {"rev": scale(revenue), "line": scale(bep["bep"]), "first": bep["first_month"]}}
```

| 関数 | 返すもの |
|---|---|
| `income_statement` | 月ごとの `rev` `cogs{…}` `cogs_total` `gross`（売上総利益） `sga{…}` `sga_total` `op`（営業利益） `ordinary` |
| `to_columns` | `cols`（Q1…Q4・1年目…）・`groups`（上の見出し）・`em`（年の列）・`lines`（内訳は `cogs_tea` のように `_` でつなぐ）。`stock` に入れた行は合計でなく期末の値 |
| `cash_flow` | `balance`（出資込みの月末残高）・`cum`（出資なしの累計）・`need`（必要な資金＝累計の底）・`trough_month`・`recover_month`・`pre` |
| `break_even` | `bep`（月ごとの損益分岐点の売上高）・`cm_rate`（限界利益率）・`first_month`（超えて、その後も下回らない最初の月）・`safety`（安全余裕率） |
| `break_even_units` | 1個あたりの値段と変動費から、損益分岐の数量と売上・費用の線（グラフ用） |
| `scale` | グラフ用に単位をそろえる（1e6 で百万円） |

置いた値（出資・投資・入金の遅れなど）は `sources.json` の `assumptions` に載せ、表のページの注記から前提の一覧へリンクする（`reference/sources.md`）。

## 2. 表：data-fin

```html
<div class="fin" data-fin='{"cols":"@fin.pl.cols","groups":"@fin.pl.groups","em":"@fin.pl.em","unit":"百万円","fmt":{"d":1},"rows":[
  {"label":"売上高","v":"@fin.pl.rev","kind":"key"},
  {"label":"売上原価","v":"@fin.pl.cogs_total"},
  {"label":"茶葉","v":"@fin.pl.cogs_tea","indent":1},
  {"label":"売上総利益","v":"@fin.pl.gross","kind":"sum"},
  {"label":"売上総利益率","v":"@fin.pl.gross_rate","kind":"pct"},
  {"head":"販売費・一般管理費"},
  {"label":"営業利益","v":"@fin.pl.op","kind":"key"}]}'></div>
```

| キー | 意味 |
|---|---|
| `cols` `groups` `em` | 列の名前・上の見出し（`[{label, span}]`、まとまりの頭に縦線）・背景を付ける列の番号（年の合計など） |
| `unit` | 左上の「単位：百万円」 |
| `fmt` | 数字の書式（`d` 小数の桁、`x` 掛ける数、`u` 単位）。行ごとに `fmt` で上書き |
| `rows[].kind` | `sum` 小計（太字＋上に線）・`key` 強調（太字＋色の帯）・`pct` 率（既定で ×100・小数1桁・%、灰色） |
| `rows[].indent` | 1・2 で字下げ（内訳） |
| `rows[].head` | 見出しだけの行 |

マイナスは「−」で赤。`"@…"` の先に数字がない行は「—」になり、`?check` が `data-missing` で知らせる。
15列（12四半期＋3年）までは 1920px に収まる。それより多いときは年だけの表にするか、`class="fin tight"` で詰める。

## 3. ページの組み方

| ページ | 見出し（言い切る） | 中身 |
|---|---|---|
| 四半期の損益 | 「3年目の第1四半期から営業利益が黒字になり、年2.9億円に届く」 | `data-fin` の表＋下に1行の読み取り（`strip`） |
| 資金繰り | 「一番へこむのは26か月目の3.2億円で、出資4億円で足りる」 | 残高と出資なしの累計の線（`line`、底の月に `marks`）＋必要な資金・残高の底の KPI |
| 損益分岐 | 「24か月目に損益分岐点を超え、3年目の安全余裕率は36%」 | 売上高と損益分岐点の線＋固定費 ÷ 限界利益率の小さな表 |

- 安全余裕率は (売上高 − 損益分岐点) ÷ 売上高で、「損益分岐点を36%上回る」（損益分岐点に対する割合、見本なら約55%）とは別の数。見出しでは「安全余裕率は◯%」と書く
- 年の率は月の率を平均せず、年の合計から出す（`1 − 損益分岐点の合計 ÷ 売上高の合計`）。読者が表の2つの額から計算し直して合うように
- グラフの右端の値（36か月目）と表の値（3年目の平均）が違うときは、グラフの小見出しにどちらかを書く

見本は `examples/demo/slides.html` の `#fin-pl` `#fin-cf` `#fin-bep`、計算は `examples/demo/data/calc.py`。
