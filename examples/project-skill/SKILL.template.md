---
name: my-project-slides
description: >-
  （見本）<プロジェクト名> のスライド（<deck のパス> と、このリポジトリで新しく作るスライド）を作る・直すときの約束。
  表記・見出し・数字の出どころ・出典・付録の並び・公開の手順。デザインと部品・グラフ・地図・書き出しは個人スキル html-slides に従う。
  「スライド」「slides.html」「ページを足して」「PNG に書き出して」と頼まれたとき、<deck のフォルダ> を触るときに使う。
---

# <プロジェクト名> のスライド

<!--
  これはプロジェクトスキルの見本。リポジトリのスキルのフォルダ（.cursor/skills/<名前>/SKILL.md や .claude/skills/<名前>/SKILL.md）にコピーし、< > を埋めて、
  要らない節は消す。汎用のこと（部品・グラフ・地図・検査）は html-slides に任せ、ここにはこの案件だけの約束を書く。
  実際の案件で使った形をもとに、事業の中身を抜いてある。
-->

**最初に個人スキル html-slides の SKILL.md（例：`~/.cursor/skills/html-slides/SKILL.md`、`~/.claude/skills/html-slides/SKILL.md`）を読む。** デザイン・部品・グラフ・図・地図・計算の埋め込み・イラスト・書き出しと検査の手順はそちら。以下、個人スキルの場所を `$HS` と書く。

内容の約束（決まっていること・言い方）は `<.cursor/rules/xxx.mdc などの正の文書>` が正。ここと食い違ったらそちらを優先する。

## どのファイルか

| ファイル | 中身 | 部品 |
|---|---|---|
| `<decks/slides.html>` | 提出資料（一覧は `<decks/README.md>`） | html-slides（`deck.mjs new --theme <green>` で作った） |
| `<decks/pitch.html>` | 発表（文字 54px 以上、台本は `<pitch/script.md>`） | 同上（`--mode pitch`） |

- html-slides の部品を埋め込んだデッキは、スキルを直したら `node "$HS/scripts/deck.mjs" update <deck>` で最新にする
- html-slides より前に作った手作りのデッキ（`/*LIB:…*/` の印がない）には `deck.mjs update` をかけない。新しいページは同じファイルの既存のページを写す。`export.mjs` の検査・書き出しは使える

## 検査と書き出し

```bash
node "$HS/scripts/export.mjs" <decks/slides.html> --check --out "$TMPDIR/deck-check"   # Windows は $env:TEMP
node "$HS/scripts/export.mjs" <decks/slides.html> --sheet                              # <decks/png/> に書き出す
```

- 「問題: なし」まで直し、PNG を目で見る。検査の PNG はリポジトリに入れない（`--out` で一時フォルダへ）

## 見出しと表記

- h1 はそのページのメッセージ。見出しだけ読めば価値が分かる文にする。題名（「市場規模」「概要」）、根拠のない一般化（「海外では」「証明済み」）、口語は使わない
- 社内の言葉をスライドに出さない：`<「企画書」「決定」「仮置き」など、読み手に見せない言葉>`
- 金額の単位は `<円>` にそろえ、外国の通貨は換算して書く：`<1ドル=150円 など、使う為替を固定して列挙>`。マイナスは「−」
- 同じものは同じ名前で書く：`<正式な呼び名と、使わない呼び名の対応>`
- 決まっていないことは選択肢を並べ、どれかを前提にしない（`.card.open`・`.tag`）

## 数字・出典（手で直さない）

| 対象 | 元 | 作り直すコマンド |
|---|---|---|
| 数字（`data-f`・グラフ） | `<model/calc.py>` | `python <model/calc.py>` → `node "$HS/scripts/inject-data.mjs" <decks/*.html> <model/data.json>` |
| 地図 | `<decks/maps.json>` | `node "$HS/scripts/make-map.mjs" <decks/maps.json> --into <decks/slides.html>` |
| 出典のページ | `<sources.json>` | `<python build_sources.py>`（ページの並びを変えたら必ず） |

- 前提の一覧のページ（`#<assump>`）を作り、各ページで最初に出る「モデル」「推計」をそこへのリンク（`<a class="ref" href="#assump">`）にする
- 出典に載せるもの・載せないもの：`<一次調査は載せる、社内の相談・講評は載せない など>`

## ページの並び

- 本編 → 付録（中扉）→ 用語集 → 出典。付録は **本編で出てくる順**（詳しく説明する本編のページの順。本編からリンクのないページは関連するページの隣）
- 付録の見出しは「付録：」で始め、本編の注記の最後に「詳細は付録：◯◯」のリンク（`a.ref`。ページ番号はスクリプトが付ける）
- ページを足す・動かしたら `<decks/README.md>` の一覧を直す

## イラスト

- `<decks/illust/>` に webp で置き、接頭辞で種類を分ける（`<ic- アイコン、ps- 人物 など>`）
- 作り方は `$HS/reference/illustrations.md` の `<green>` テーマの指示。foot に「イラストは生成AIで作成したイメージ」

## 公開（頼まれたときだけ）

`<公開先と手順。例：site/ にコピーしてデプロイ。コミットのあと HEAD を worktree に取り出してからデプロイすると、未コミットの変更が出ない>`
