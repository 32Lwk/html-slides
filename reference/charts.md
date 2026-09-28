# グラフ（assets/charts.js）

外部のライブラリなしで SVG を描く。色・文字の大きさはテーマと mode（doc 19px／pitch 54px）に従う。

```html
<div class="chart" style="height:600px" data-chart='{"type":"bar", …}'></div>
<!-- JSON が長いときは中に書ける -->
<div class="chart" style="height:600px"><script type="application/json">{"type":"bar", …}</script></div>
```

- **高さは必ず style で指定**（幅は親に合わせる）。ページが表示されたときに描く
- 値は数か `"@a.b.0"`（`window.DATA` の値。[data.md](data.md)）。配列ごと `"values":"@rev"` も可
- 色：`"accent"` `"warn"` `"mid"` `"sub"` `"ink"` `"c1"`〜`"c6"` か色コード（色コードはテーマで変わらないので避ける）
- 数の書式 `fmt`：`{"d":1,"x":100,"r":1000,"u":"%","sign":true}`（小数の桁・掛ける数・丸め・単位・正に＋）
- JSON は `'…'` の中に書くので、文字に `'` を使わない。改行は `"\n"`

## どれを使うか

| 言いたいこと | type |
|---|---|
| 大きさを比べる（3〜8個） | `bar`（名前が長ければ `horizontal`） |
| 内訳の合計と伸び | `bar` + `stacked:true`（割合なら `"100%"`） |
| 伸びと別の指標（利益・率） | `bar` + `series[{type:"line"}]`（単位が違えば `axis:"right"`） |
| 時間の変化（10点以上） | `line` |
| 全体の割合（2〜5個） | `donut` |
| 2つの軸での位置取り・大きさ | `scatter` / `bubble`（`quad` で4つに分ける） |
| 足し引きで結果に至る | `waterfall` |
| 行き先・流れの量 | `sankey` |
| 時期・計画 | `gantt` |

強調は1つだけ（`highlight`）。ほかは `mid`（薄い強調色）にする。

## bar

```json
{"type":"bar","labels":["1年目","2年目","3年目"],
 "series":[{"name":"上位","values":"@byPlan.premium","color":"accent"},
           {"name":"基本","values":"@byPlan.standard","color":"mid"},
           {"name":"営業利益","values":"@op","type":"line","color":"warn","valueLabels":true}],
 "stacked":true,"unit":"億円","fmt":{"d":1},"min":-5,"step":5}
```

| キー | 意味 |
|---|---|
| `labels` | 項目名（`"\n"` で改行） |
| `series` | `[{name, values, color, colors:[項目ごとの色], type:"line", axis:"right", valueLabels}]`。1本なら `"values"` だけでも可 |
| `stacked` | `true` 積み上げ／`"100%"` 割合 |
| `horizontal` | 横棒。`labelWidth` で名前の幅 |
| `highlight` | 強調する項目（番号か名前、配列も可）。ほかは `muted`（既定 `"mid"`） |
| `unit` | 左上に出す単位 |
| `tickUnit` | 目盛りに付ける単位（既定なし） |
| `valueLabels` | 棒の上の数（既定 true） |
| `segLabels` | 積み上げの各段の中に数 |
| `ref` | 基準線 `[{v, label, color}]` |
| `axis` | 目盛りと格子（doc は既定 true、pitch は false） |
| `min` `max` `step` | 目盛りの範囲・間隔 |
| `gap` `barMax` | 棒の間の割合・棒の最大の太さ |
| `xEvery` | 項目名を n 個ごとに出す（月次など項目が多いとき） |
| `legend` | false で凡例を消す（系列が2つ以上で自動） |
| `right` `fmtRight` | 右の軸の範囲・書式 |

## line

```json
{"type":"line","labels":"@monthly.labels","xEvery":6,"area":true,
 "series":[{"name":"会員","values":"@monthly.members","color":"accent"},{"name":"計画","values":[…],"dash":true}],
 "marks":[{"i":3,"label":"シンガポール"},{"i":6,"label":"北米"}],"fmt":{"d":1,"u":"千人"}}
```

- 終わりの値を線の右に書く（`endLabels`、既定 true。false なら凡例）
- `null` の値は線を切る。`zero:false` で 0 から始めない
- `marks` は縦の点線（近いと自動で段をずらす）。`dots` で全点に丸、系列の `width` `dash` `key`

## donut / pie

```json
{"type":"donut","items":[{"label":"米国","v":42,"color":"accent"},{"label":"アジア","v":46,"color":"mid"}],
 "center":{"v":"4.4万","k":"人"},"legendValue":"pct"}
```

`inner`（穴の大きさ 0〜1）、`legend:false`、`sliceLabels:false`、`legendValue`：`"both"`（既定：値と%）／`"pct"`／`"value"`。

## scatter / bubble

```json
{"type":"bubble","x":{"label":"月の値段（円）","min":2000,"max":11000},"y":{"label":"品質","min":3,"max":10},
 "quad":{"x":6500,"y":7,"labels":["左上","右上","左下","右下"]},
 "points":[{"x":2600,"y":4.6,"r":60,"label":"A社"},{"x":5000,"y":8.2,"r":44,"label":"自社","key":true}]}
```

`r` は円の面積に比例（`rMax` で最大の半径）。`key:true` の点を強調色と太字にする。

## waterfall

```json
{"type":"waterfall","unit":"円","items":[{"label":"支払い","v":5000,"total":true},{"label":"茶葉","v":-1100,"color":"accent"},
 {"label":"送料","v":-1450},{"label":"残る","total":true}]}
```

`total:true` は合計の棒（`v` を省くとそこまでの累計）。減る棒は注意色、増える棒は `mid`。

## sankey

```json
{"type":"sankey","links":[{"from":"US","to":"premium","v":8340}, …],
 "nodes":[{"id":"US","label":"米国","color":"accent"},{"id":"premium","label":"上位 6,800円"}]}
```

列は自動（つながりの深さ）。`nodes[].col` で列を指定、`nodeWidth`、`pad`、`fmt`。流れの色は `links[].color` か元の箱の色。

## gantt

```json
{"type":"gantt","min":0,"max":36,
 "ticks":[{"v":0,"label":"1年目"},{"v":12,"label":"2年目"}],
 "marks":[{"v":3,"label":"90日の判断"},{"v":23,"label":"黒字","anchor":"end","color":"accent"}],
 "rows":[{"group":"市場","label":"台湾・香港","a":0,"b":36,"text":"1か月目から"},
         {"label":"農家10軒へ","a":12,"b":36,"color":"c6","dash":true,"text":"2年目から"}]}
```

`group` は左端の区分（最初の行にだけ書く）。`text` は棒の中（入らなければ右）。`dash:true` は薄い棒（予定・未定）。

## pitch で使うとき

文字が 54px になるので、棒は3〜5本、目盛りは出さず（既定で消える）値を棒の上に書く。凡例より直接ラベル。
