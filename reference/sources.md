# 出典・前提の一覧・用語集・ページ内リンク

資料の信頼を支える付録を、JSON から作って埋め込む。手で表を書かない（番号・ページ番号・改ページがずれるため）。

| 作るもの | 元にする JSON | スクリプト | デッキの印 |
|---|---|---|---|
| 出典（一次調査・外部の資料） | `data/sources.json` | `build-sources.mjs` | `<!-- SOURCES:BEGIN --><!-- SOURCES:END -->`・`/*CITES*/` |
| 前提の一覧（計画／推計／仮置き） | 同じ `sources.json` の `assumptions` | 同上 | `<!-- ASSUMPTIONS:BEGIN --><!-- ASSUMPTIONS:END -->`（なければ出典の後ろ） |
| 用語集 | `data/glossary.json` | `build-glossary.mjs` | `<!-- GLOSSARY:BEGIN --><!-- GLOSSARY:END -->`・`/*GLOSS*/` |

印を書いておけばその場所に入る（ないときは DATA の `<script>` の前＝最後のページの後ろ）。`/*CITES*/` `/*GLOSS*/` はスクリプトが自分で足す。
ページの並び・本文を変えたら、両方をやり直してから `export.mjs --check`。

```bash
node <skill>/scripts/build-sources.mjs slides.html data/sources.json     # 前提の一覧・出典のページと各ページの出典の番号
node <skill>/scripts/build-glossary.mjs slides.html data/glossary.json   # 用語集のページと本文の下線
```

先に `build-sources.mjs`（用語集のリンクが前提の一覧 `#assump` を指せるように）。どちらも行の高さを Chrome で測ってページに分けるので、文字が増えてもはみ出さない。作ったページには `data-gen` と `data-sparse-ok` が付く（空きの検査から外し、用語の下線も引かない）。

## sources.json

```json
{
  "checked": "2026-09-28",
  "foot": "外部の資料のページの注記（省くと「◯◯ にリンクを確認…」）",
  "primary": [
    {"id": "P1", "name": "海外の購入者へのアンケート", "who": "3地域の120人", "when": "2026-08",
     "how": "Web（選ぶ問い10・自由記述2）", "where": "data/survey.csv", "pages": ["value", "rivals"]}
  ],
  "external": [
    {"key": "churn", "pub": "発行者", "title": "資料名", "date": "2026-02", "url": "https://…", "archive": "（消えた資料の保存版 URL）",
     "note": "（補足）", "pages": ["markets", "unit"]}
  ],
  "assumptions": [
    {"id": "A3", "item": "やめる割合", "value": "毎月4%", "status": "仮置き",
     "basis": "業界の調査（外部の資料 {{churn}}）より低く置いた。90日で測って置き直す", "where": "calc.py の CHURN", "pages": ["loop", "kpi"]}
  ]
}
```

- **外部の資料を文の中で指すときは `{{key}}`**（`external` に `key` を付ける）。振り直したあとの番号に置き換わる。番号を手で書くと、ページの並びを変えたときに別の資料を指してしまう（手で書いた「外部の資料 3」はスクリプトが知らせる）

- **pages** はその資料・前提を使うページの `<section id>`。デッキにない id は無視して知らせる
- **外部の資料の番号**は、デッキの並びで最初に使うページの順に 1 から振り直す（同じページの中は JSON の順）。章（`section.chap` の `data-n` `data-t`）ごとにまとめる
- **一次調査**は `P1` のように自分で番号を付ける（出典欄では灰色）
- **前提**の `status` は `計画`（自分たちで決めた値）・`推計`（調べた数字からの計算）・`仮置き`（実績で置き直す値）。英語は plan / estimate / placeholder。`id` を省くと `A1`…
- 出典のない数字は、必ず前提の一覧に載せる。「推計」「仮置き」の数字を本編で最初に使うページから `<a class="ref" href="#assump">前提の一覧</a>` でリンクする
- Markdown の一覧（完全な URL）を `sources.md` に書き出す（`--md` で場所を変えられる）

### 各ページの出典欄

本文の注記（`.foot`）の下に「出典 1 3–6 P2 A3」が並ぶ（3つ以上続く番号は 3–6 にまとめる）。マウスを乗せると資料名、クリックで出典のページへ飛び、その行が光る。発表用（pitch）では出さない。
出典欄に入りきらないと `clipped` で知らせるので、ページを分けるか、使う資料を絞る。

## glossary.json

```json
{
  "groups": [
    {"title": "数字の言葉", "terms": [
      {"id": "ltv", "t": "1人から残る額", "s": "LTV", "d": "1人の会員がやめるまでに自社に残す額", "a": ["LTV"], "p": "kpi"}
    ]}
  ],
  "links": [
    {"id": "assump", "t": "仮の値", "d": "外部の出典がない数字", "a": ["仮の値"], "go": "assump", "fl": "srow-A3"}
  ]
}
```

- `t` 見出しの言葉、`s` 小さく添える読み・略語、`d` 意味（1〜2文）、`p` 詳しく説明するページ（「詳しく p.N」が付く）
- `a` 本文での別の書き方（下線を引く言葉）。英数字の言葉は前後が英数字でないときだけ当たる。`re` で正規表現を直接書いてもよい
- `noauto: true` は用語集に載せるだけで、本文に下線を引かない
- `links` は用語集に載せず、本文の言葉から任意のページへ飛ばすだけ（`fl` はそのページで光らせる要素の id）
- 本文の下線は各ページで最初の1回だけ。見出し（h1）・小見出し・注記・リンク・グラフの中には引かない。`data-nogloss` を付けた要素・ページも外す
- 長い言葉から先に当てる（「上位プラン」が「プラン」より先）

## ページ内リンク

| 書き方 | 動き |
|---|---|
| `<a class="ref" href="#unit">1箱の内訳</a>` | 「p.13」が自動で付く（PNG・PDF でもたどれる） |
| `<a class="ref" href="#unit" data-fl="unit-ship">送料</a>` | 飛んだ先で `id="unit-ship"` の要素を2.5秒光らせる |
| `<a class="pgl" href="#unit"></a>` | 中身が「p.13」になる（表の中など、言葉のいらない所） |

リンク・出典の番号・用語の下線で飛ぶと、飛んだ先のページの右上に「← 元のページへ」が出る（Web で見るときだけ）。
飛び先の id がないリンクは `?check` が `link-missing` で知らせ、`audit.mjs` もエラーにする。

**付録への道**：本編の注記の最後に「詳細は <a class="ref" href="#fin-pl">付録：四半期の損益</a>」を置く。付録は本編で出てくる順に並べる。どこからもリンクされない付録は `audit.mjs` が知らせる。
