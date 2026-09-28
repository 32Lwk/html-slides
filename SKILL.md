---
name: html-slides
description: >-
  1920×1080 固定の 1 ファイル HTML スライドを、決まったデザイン（結論を言い切る見出し・強調色とお金の色の 2 色・
  6 つのテーマ）で安定して作り、Chrome headless で PNG に書き出してはみ出し・小さすぎる文字・数字の抜けを自動で確かめる。
  自前の SVG グラフ（棒・線・面・円・散布・滝・ガント・サンキーほか）、関係図・担当者ごとのフロー図・循環図、
  世界・国・日本の都道府県の地図、Python の計算結果の埋め込み、テーマに合わせたイラスト（GenerateImage）まで扱う。
  資料（doc）と発表（pitch、文字 54px 以上）の 2 つの型、日本語と英語。オフラインで開ける。
  「スライドを作って」「発表資料」「プレゼン」「ピッチ」「slides.html」「HTML でスライド」「PNG に書き出して」
  「グラフを入れて」「地図を入れて」「図にして」「イラストを入れて」と頼まれたとき、既存のデッキにページを足す・直すときに使う。
---

# HTML スライド

1 つの HTML ファイル（デッキ）で 1 ページ＝1 つの `<section id>`（1920×1080 固定）。CSS・JS・データ・地図はファイルに埋め込み、フォントは隣の `fonts/` に置くので、ネットなしで開ける。`deck.html#id` でそのページを開く。

- スキルの場所：`~/.cursor/skills/html-slides/`（Windows は `%USERPROFILE%\.cursor\skills\html-slides\`）。以下 `$HS` と書く
- 見本：`$HS/examples/demo/slides.html`（資料・和風・日本語 18 枚）と `pitch.html`（発表・紺・英語 7 枚）。PNG は同じフォルダの `png/`・`png-pitch/`（`sheet.png` が一覧）。**迷ったら見本の同じ種類のページを開いて、そのまま写す**
- Windows・Mac とも Node 18 以上と Chrome（か Edge）で動く。計算は Python 3（numpy）

## 初めて使うとき（1 回だけ）

```bash
cd "$HS/scripts" && npm install      # 地図に使う d3-geo・topojson-client
```

Windows で Python の日本語が化ける・`UnicodeEncodeError` が出るときは、ユーザーの環境変数 `PYTHONUTF8=1` を設定する（このスキルの `.py` は UTF-8 で読み書きする）。

## 最初に決めること（分からなければ AskQuestion で聞く）

| 項目 | 選択肢 | 決め方 |
|---|---|---|
| 型 `--mode` | `doc`（資料。読んで分かる、本文 22px 以上）／`pitch`（発表で映す。文字 54px 以上、1 ページ 1 つのこと、メモ付き） | 配って読むなら doc、話しながら映すなら pitch。両方要るなら 2 ファイルに分け、データは共通にする |
| テーマ `--theme` | `green`（緑・既定）／`navy`（紺・堅め）／`mono`（黒と赤）／`blue`（青・技術）／`wa`（和風・生成り）／`dark`（暗い背景） | 相手と内容に合わせる。後から `deck.mjs set` で変えられる |
| 言語 `--lang` | `ja`／`en` | ボタン・メモ・数字の書式が切り替わる |

## 手順

```
- [ ] 1. 元の文書を読み、1 ページ 1 メッセージで構成を決める（reference/writing.md）
- [ ] 2. node deck.mjs new でデッキを作る
- [ ] 3. ページを書く（部品は reference/components.md、グラフ charts.md、図 diagrams.md）
- [ ] 4. 数字があれば calc.py で計算して inject-data.mjs で埋め込む（reference/data.md）
- [ ] 5. 地図があれば make-map.mjs --into で書き込む（reference/maps.md）
- [ ] 6. イラストがあれば GenerateImage → to_webp.py（reference/illustrations.md）
- [ ] 7. export.mjs --check を「問題: なし」になるまで繰り返す
- [ ] 8. export.mjs --sheet で PNG を書き出し、sheet.png と数枚を開いて目で確かめる
```

**手順 2**

```bash
node "$HS/scripts/deck.mjs" new <出力フォルダ> --mode doc --theme green --lang ja --title "題名"
#   → <出力フォルダ>/slides.html（pitch なら --name pitch.html を付けると分けられる）と fonts/
```

テンプレートの見本のページ（表紙・中扉・カード・グラフ・図・地図・表）が入っている。使う型だけ残して書き換え、要らないページは消す。テンプレートに `<!--MAP:…-->` があれば世界地図も自動で書き込まれる（`npm install` 済みのとき）。

**手順 3**：どのページも `kicker → h1 → rule → 本文 → strip（任意）→ foot` の並び。h1 は題名でなく **そのページの結論を 1 文で言い切る**。部品は reference/components.md のものだけで組み、ページごとの `<style>` で新しい見た目を作らない（大きさ・位置の微調整は `style=""` で）。

**手順 7**：`?check` を付けて開いたときと同じ検査を全ページにかける。

```bash
node "$HS/scripts/export.mjs" <deck.html> --check          # 問題のページと理由を一覧、赤枠の PNG は png/check/
```

| 理由 | 意味 | 直し方（上から順に試す） |
|---|---|---|
| `clipped` | 箱から文字があふれる | 文字を削る → ページを分ける → `style="font-size"` を少し下げる |
| `outside` | 1920×1080 の外へ出る | 部品を減らす・高さを指定する |
| `on-foot` | 下の注記（foot）に重なる | 本文を短く・グラフの高さを下げる |
| `font Npx < 16px`（pitch は 54px） | 小さすぎる文字 | 文字を減らして大きくする。pitch は文を語句にする |
| `data-missing` | `data-f`・`"@…"` のデータがない | calc の出力のキーと、inject を実行したかを確かめる |
| `map-empty` | 地図がまだ書き込まれていない | `make-map.mjs <spec> --into <deck>` |
| `image-missing` | 画像が読めない | パス・ファイル名 |
| `dup-id` | 同じ id が 2 か所（ページの id と図の箱など） | 図の箱の id にページごとの接頭辞を付ける |

「問題: なし」でも崩れはありうるので、**手順 8 で必ず PNG を目で見る**（重なり・空きすぎ・読みにくい色）。`png/check/` は消してよい。

**手順 8**

```bash
node "$HS/scripts/export.mjs" <deck.html> --sheet          # png/NN-id.png と一覧の png/sheet.png
node "$HS/scripts/export.mjs" <deck.html> --only kpi,unit   # 一部だけ撮り直す
node "$HS/scripts/export.mjs" <deck.html> --theme dark --out /tmp/dark   # テーマを変えて試し撮り
```

見る点：空きすぎたページ（下 1/3 が空なら絵・グラフを大きくするか要素を足す）、図の線が箱や文字を横切っていないか、グラフの目盛り・ラベルの重なり、強調色が 1 ページ 1〜2 か所に収まっているか。

## コマンド一覧

| コマンド | 使い方 |
|---|---|
| `deck.mjs new <dir> [--mode] [--theme] [--lang] [--name] [--title] [--force]` | デッキを作る |
| `deck.mjs update <deck.html>` | 埋め込みの CSS・JS（`/*LIB:CSS*/`・`/*LIB:JS*/`）をスキルの最新に差し替え、`fonts/` を置く。スキルを直したら既存のデッキにも実行する |
| `deck.mjs set <deck.html> [--theme] [--mode] [--lang]` | `<html>` の属性を変える |
| `inject-data.mjs <deck.html> [deck2.html…] <data.json>` | 計算結果を `/*DATA*/…/*END DATA*/` に埋め込む |
| `make-map.mjs <spec.json> [--into deck.html …]` | 地図の SVG を作り `<!--MAP:name-->…<!--END MAP:name-->` に書き込む |
| `export.mjs <deck.html> [--check] [--sheet] [--only a,b] [--theme] [--out] [--jobs 4]` | PNG の書き出しと検査 |
| `python to_webp.py in.png [out.webp] [--max 1400] [--keep-bg]` | 生成した絵の背景を透明にして webp に |

Chrome が見つからないときは環境変数 `CHROME` に場所を入れる。スキルの部品を埋め込んでいない古いデッキにも `export.mjs` は使える（そのときは赤枠の `.ovf-badge` があるかだけで判定する）。

## 資料（doc）と発表（pitch）の違い

| | doc | pitch |
|---|---|---|
| 目的 | 配って読む。1 ページで論理が完結 | 話しながら映す。話が主、画面は補助 |
| 文字 | 本文 22px 以上（補足 16px まで） | すべて 54px 以上 |
| 1 ページ | 部品 1〜3 個、根拠と注記まで | 1 つのこと（数字 1 つ・絵 1 枚・3 語まで） |
| 部品 | カード・表・グラフ・図・地図 | `.say`（大きな一言）・`.bignum`・`.trio`（絵 3 枚）・`.chain`・`.split`・`section.dark`・単純なグラフ |
| メモ | 要らない | `<aside class="notes">` に台本、`data-end="1:05"` に終わりの時刻 |
| キー | ← → スペース・Home・End、F 全画面 | 加えて N でメモを重ねる、P で発表者用の窓、T で時計を 0 に |

## ファイル

| パス | 中身 |
|---|---|
| `assets/themes.css` | 6 テーマの色（CSS 変数。`--accent` 強調・`--warn` お金と注意・`--c1..c6` 系列・`--seq1..5` 濃淡） |
| `assets/slides.css` | 型と部品 |
| `assets/runtime.js` | 画面合わせ・ページ送り・番号・章の並び・`data-f`・`?check`・メモ |
| `assets/charts.js` `assets/diagrams.js` | グラフと図（`data-chart`・`data-links`） |
| `assets/fonts/` | Noto Sans JP・Inter（OFL） |
| `assets/geo/` | Natural Earth（110m・10m）と日本の都道府県 |
| `templates/doc.html` `pitch.html` `maps.json` | `deck new` の元 |
| `reference/` | 下の詳しい説明 |
| `examples/demo/` | 見本（`data/calc.py` から数字・地図まで通したもの） |
| `examples/project-skill/SKILL.template.md` | 案件ごとのプロジェクトスキルのひな形 |

## 詳しい説明（必要になったら読む）

- [reference/writing.md](reference/writing.md) — 見出しの書き方・1 ページ 1 メッセージ・数字と色・ページの順（**最初に読む**）
- [reference/components.md](reference/components.md) — ページの型と部品、レイアウトの型の早見表
- [reference/charts.md](reference/charts.md) — グラフの種類とキー、どのグラフを選ぶか
- [reference/diagrams.md](reference/diagrams.md) — 関係図・担当者ごとのフロー図・循環図・ツリー
- [reference/maps.md](reference/maps.md) — 世界・国・日本の都道府県の地図
- [reference/data.md](reference/data.md) — Python で計算して埋め込む流れ
- [reference/illustrations.md](reference/illustrations.md) — テーマごとのイラストの作り方（固定のスタイル指示）

## 守ること

- 数字は手で打たず、計算の出力を `data-f`・`"@path"` で参照する（前提を変えても食い違わない）
- 色は CSS 変数だけ。強調（`.key`）は 1 ページ 1〜2 か所。お金の流れはお金の色（`--warn`）と破線
- 決まっていないことは決まったものとして書かない（`.card.open`・`.tag` で分けて選択肢を並べる）
- 生成したイラストを使ったら foot に「イラストは生成AIで作成したイメージ」と書く。地図は foot に「地図：Natural Earth」
- 仕上げの前に必ず `export.mjs --check` と PNG の目視。直したら撮り直す
- 案件ごとの約束（表記・出典・公開の手順）は、そのリポジトリのプロジェクトスキルに従う。まだなければ `examples/project-skill/SKILL.template.md` を `.cursor/skills/<名前>/SKILL.md` にコピーして埋める
