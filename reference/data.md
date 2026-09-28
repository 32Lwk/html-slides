# 数字（計算 → data.json → デッキ）

スライドの数字は手で打たず、計算のスクリプトの結果を埋め込む。前提を変えたら計算をやり直すだけで、本文・グラフ・地図の数字がそろって変わる。

```
data/calc.py ──→ data/data.json ──inject-data.mjs──→ <script>/*DATA*/window.DATA = {…};/*END DATA*/</script>
            └──→ data/maps.json ──make-map.mjs────→ <!--MAP:name-->…<!--END MAP:name-->
```

```bash
python data/calc.py
node <skill>/scripts/inject-data.mjs slides.html pitch.html data/data.json
node <skill>/scripts/make-map.mjs data/maps.json --into slides.html pitch.html
```

見本：`examples/demo/data/calc.py`（numpy。会員数の S 字・解約・1箱の内訳・地域の割合を計算して data.json と maps.json を書く）。

## 計算のスクリプトの書き方

- 最初に前提を定数で並べる（値段・割合・費用）。コメントに「見本用の仮の値」「調べた値（出典）」を書き分ける
- スライドに出す値は、出す形に丸めてから JSON に入れる（億円なら `round(v / 1e8, 1)`）
- 配列はグラフにそのまま渡せる形にする（`labels` と `values`、系列ごとの配列、項目ごとの色 `["warn" if v < 0 else "accent" …]`）
- 文字コードは UTF-8：`json.dumps(data, ensure_ascii=False)`、`write_text(…, encoding="utf-8")`
- このPCの Python は `PYTHONUTF8=1`（ユーザーの環境変数）で動く。新しいシェルで `UnicodeDecodeError: 'cp932'` が出たら `$env:PYTHONUTF8=1` を付ける
- 使えるもの：numpy・pandas・scipy・matplotlib（グラフは charts.js で描くので matplotlib は検算用）

## デッキで使う

### 本文の数字：`data-f`

```html
<span data-f="rev.2"></span>億円                          → 20.9億円（rev[2]）
<span data-f="margin.2" data-x="100" data-d="0"></span>%    → 14%
<span data-f="members.2" data-x="0.0001" data-d="1"></span>万人 → 4.4万人
<span data-f="unit.profit" data-u="円"></span>              → 687円
<span data-f="growth" data-sign data-x="100" data-u="%"></span> → +12%
<span data-f="users" data-r="1000"></span>                  → 1000 単位に丸める
```

| 属性 | 意味 |
|---|---|
| `data-f` | DATA の中の場所（`a.b.0`） |
| `data-d` | 小数の桁（既定 0） |
| `data-x` | 掛ける数（割合 → % は 100、円 → 万円は 0.0001） |
| `data-r` | この単位で丸める |
| `data-u` | 後ろに付ける単位 |
| `data-sign` | 正の数に＋を付ける |

負の数は「−」（全角のマイナス）。桁区切りは言葉に合わせる。見つからない場所は「—」になり `?check` が `data-missing` として知らせる。

### グラフの値：`"@…"`

```html
<div class="chart" style="height:600px" data-chart='{"type":"bar","labels":["1年目","2年目","3年目"],"series":[{"values":"@rev"}]}'></div>
```

### JS から

`Slides.get("rev.2")`、`Slides.fmt(v, {d:1, u:"億円"})`、`Slides.onShow(sec => …)`（ページを見せるたびに呼ばれる。自前の図を描くとき）。

## 為替・単位

- 為替はデッキの foot に書く（例「1ドル=150円」）。計算のスクリプトの定数と同じ値にする
- 大きな数は「億円」「万人」にそろえ、1ページの中で単位を混ぜない
