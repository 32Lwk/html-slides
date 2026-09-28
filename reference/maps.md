# 地図（scripts/make-map.mjs）

Natural Earth（パブリックドメイン）の国境と、日本の都道府県の境から SVG を作り、デッキに埋め込む。ネットなしで表示でき、色はテーマに従う。
最初に一度 `scripts/` で `npm install`（d3-geo・topojson-client）が要る。

```bash
node <skill>/scripts/make-map.mjs maps.json --into slides.html [pitch.html]
```

デッキの側には置き場所だけ書く（中身は make-map が書き換える）：

```html
<div class="map"><!--MAP:markets--><!--END MAP:markets--></div>
```

`maps.json` は1枚 `{…}` か `{"maps":[{…},{…}]}`。`--into` に複数のデッキを並べると、印のあるデッキに書く。`"out":"x.svg"` でファイルにも出す。
計算のスクリプト（`data/calc.py`）から maps.json を書き出すと、数字と地図がそろう（[data.md](data.md)）。

## 世界・国

```json
{"name":"markets","width":1036,"height":640,"pacific":true,"zoom":1.3,"shift":[0,70],
 "fill":{"TW":"accent","HK":"accent","SG":"mid","US":"sub","CA":"sub","JP":"warn"},
 "arcs":[{"from":[138.38,34.98],"to":"Taipei","cls":"accent"},{"from":"Tokyo","to":"Los Angeles","cls":"dash"}],
 "points":[{"lon":138.38,"lat":34.98,"text":"静岡","cls":"warn","label":"top"},{"city":"Taipei","text":"台北","label":"right"}]}
```

| キー | 意味 |
|---|---|
| `width` `height` | SVG の大きさ（px）。**置く場所の幅に合わせる**（doc の `.cols.c64` の左は 1036、全幅は 1776、pitch の全幅は 1720） |
| `projection` | `naturalEarth`（世界の既定）／`equalEarth`／`mercator`（`fit` のときの既定）／`conic`（`parallels`）／`orthographic`（地球儀、`rotate`） |
| `pacific` | 太平洋を真ん中に（日本とアメリカを1枚に入れるとき） |
| `rotate` | `[λ, φ]` 回転（`pacific` より優先） |
| `fit` | 映す範囲：国コードの配列 `["JP","KR","TW"]`／範囲 `[[西,南],[東,北]]`／`"world"`（既定） |
| `detail` | `110m`／`50m`／`10m`。省くと映す範囲の広さで自動 |
| `zoom` `shift` | fit の後に拡大・移動（世界地図で南極や北極を切るとき `zoom:1.3, shift:[0,70]`） |
| `pad` | 余白（既定 24） |
| `fill` | 塗る国 `{"国": "accent"|"mid"|"warn"|"sub"}`。国はコード（`JP` `USA`）か名前（`日本` `Japan`） |
| `values` | 塗り分け `{"国": 数}` → 5段階。`steps`、`breaks:[区切り]`、`legend:false`、`legendTitle` `legendLow` `legendHigh` `unit` `legendAt:[x,y]` |
| `minArea` `dotR` | 小さな国（シンガポール・香港）は丸で示す。粗い地図にない国も細かい地図から探して丸にする |
| `graticule` `sphere` | 経緯線・海の色（世界全体のとき） |
| `arcs` | 線 `[{from, to, cls:"accent"|"warn"|"dash"の組み合わせ, bend, arrow:false, label, dx, dy}]`。端は国・都市名・`[経度,緯度]` |
| `points` | 点 `[{city | lon,lat, text, label:"right"|"left"|"top"|"bottom"|"none", cls:"accent"|"warn"|"ring", r, dx, dy, tcls}]` |
| `labels` | 国の名前：`true`（塗った国すべて）か `[{code, text, dx, dy, lon, lat, cls, anchor}]` |
| `lang` | `ja`（既定）／`en`。国名・都市名の言葉 |
| `pitch` | pitch のデッキに置くとき true（点とラベルの間を 54px 用に） |

都市は `assets/geo/cities.json`（約1,200都市、英語名か日本語名で引ける。同名は `"a2":"US"` で国を指定）。無い場所は `lon`・`lat` で書く。

## 日本の都道府県

```json
{"name":"tea","scope":"japan","width":1036,"height":740,
 "values":{"鹿児島":27000,"静岡":25800,"三重":5200},"breaks":[500,1000,2000,5000],
 "legendTitle":"荒茶の生産量（t）","legendLow":"少","legendHigh":"多",
 "labels":[{"code":"静岡","text":"静岡"},{"code":"鹿児島","text":"鹿児島"}]}
```

- 都道府県は名前（`静岡`・`静岡県`）、番号（22）、英語名で指定
- 既定で沖縄は左上に差し込み（`okinawaInset:false` で消す。`insetSize` `insetAt` `insetBox:[[西,南],[東,北]]` で先島まで入れるなど）
- 本土は北海道〜屋久島の範囲に合わせる。一部だけなら `"fit":["東京","神奈川","千葉","埼玉"]`
- 凡例は右下（海の上）。`legendAt` で動かす

## 書き方のこつ

- 塗る国は2〜3色まで。凡例（`.legend`）を地図の下に HTML で置き、塗りの意味を書く
- 線は「どこからどこへ」を1本ずつ。本数が多いなら表に回す
- ラベルは結論に要る所だけ（doc で6つ、pitch で3つまで）
- 出典を foot に書く：「地図：Natural Earth（パブリックドメイン）」
- 大きさの目安：110m の世界地図で約 110KB、都道府県で約 50KB。1デッキに地図 5 枚くらいまで
