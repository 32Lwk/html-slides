# html-slides

![html-slides — きれいな HTML スライドを、毎回同じ品質で](docs/img/hero.png)

**Cursor の Agent Skill：きれいな 1920×1080 の HTML スライドを、毎回同じ品質で作る。**
グラフ・図・地図・計算の埋め込み・イラスト・PNG の書き出しと自動の検査まで 1 つに入っています。

[日本語](#日本語) ・ [English](#english)

---

## 日本語

### できること

![グラフ・図・地図・数字・イラスト・発表用の型](docs/img/features.png)

| | |
|---|---|
| **グラフ** | 縦棒・横棒・積み上げ（100% も）・棒と線の複合・線・面・ドーナツ・散布・バブル・滝・サンキー・ガント（自前の SVG） |
| **図** | 関係図・担当者ごとのフロー図・循環図・ツリー。箱を並べると矢印は自動で引く |
| **地図** | 世界・国ごと・日本の都道府県（沖縄の差し込み付き）の塗り分け・点・弧 |
| **数字** | Python で計算した結果を埋め込み、スライドの数字とグラフが同じ元を指す。前提を変えても食い違わない |
| **イラスト** | テーマごとに固定したスタイルで生成し、背景を透明にしてなじませる |
| **オフライン** | 1 ファイルの HTML に全部を埋め込み、フォントも同梱。ネットなしで開ける |

### 使い方：頼むだけ

![6 つの手順](docs/img/workflow.png)

Cursor のチャットで「◯◯のスライドを作って」「グラフを入れて」「PNG に書き出して」と頼むと、Agent が [SKILL.md](SKILL.md) を読んで上の手順で仕上げます。

### 崩れは自動で見つかる

![検査：直す前と直した後](docs/img/check.png)

Chrome で全ページを撮り、はみ出し・画面の外・小さすぎる文字・数字の抜けなどを赤枠で示します。「問題: なし」になるまで直してから書き出します。

### テーマと型

![6 つのテーマ](docs/img/themes.png)

![doc と pitch](docs/img/modes.png)

<details>
<summary>見本の全ページ（資料 18 枚・発表 7 枚）</summary>

架空の日本茶の定期便の事業計画を題材にした見本です（`examples/demo/`。数字は `data/calc.py` の計算、イラストは生成 AI）。

![資料の見本（18 枚）](examples/demo/png/sheet.png)

![発表の見本（7 枚）](examples/demo/png-pitch/sheet.png)

</details>

### 入れ方

```bash
git clone https://github.com/32Lwk/html-slides.git ~/.cursor/skills/html-slides
cd ~/.cursor/skills/html-slides/scripts && npm install     # 地図に使う d3-geo・topojson-client
```

- Windows（PowerShell）は `git clone https://github.com/32Lwk/html-slides.git "$env:USERPROFILE\.cursor\skills\html-slides"`
- 必要なもの：Node 18 以上、Chrome か Edge、Python 3（numpy。イラストの後処理に Pillow）
- Windows で Python の日本語が化けるときは環境変数 `PYTHONUTF8=1` を設定する

### 手で使う

```bash
S=~/.cursor/skills/html-slides/scripts
node $S/deck.mjs new ./my-deck --mode doc --theme green --lang ja --title "題名"   # デッキを作る
python calc.py && node $S/inject-data.mjs ./my-deck/slides.html data.json      # 計算を埋め込む
node $S/make-map.mjs maps.json --into ./my-deck/slides.html                      # 地図を書き込む
node $S/export.mjs ./my-deck/slides.html --check                                 # 検査（問題のページと理由）
node $S/export.mjs ./my-deck/slides.html --sheet                                 # PNG と一覧の sheet.png
```

### 中身

| パス | 中身 |
|---|---|
| [SKILL.md](SKILL.md) | Agent が読む手順（最初に決めること・手順・検査の直し方・コマンド） |
| [reference/](reference/) | 書き方・部品・グラフ・図・地図・データ・イラストの詳しい説明 |
| `assets/` | テーマ・CSS・ランタイム・グラフ・図・フォント・地図のデータ |
| `scripts/` | `deck.mjs`（作る・更新）`export.mjs`（書き出し・検査）`inject-data.mjs` `make-map.mjs` `to_webp.py` |
| `templates/` | `deck new` の元（doc・pitch） |
| `examples/demo/` | 見本のデッキと PNG |
| [examples/project-skill/SKILL.template.md](examples/project-skill/SKILL.template.md) | 案件ごとの約束（表記・出典・公開手順）を書くプロジェクトスキルのひな形 |
| `docs/figures/` | この README の図（図もこのスキルで作っている。`node docs/figures/build.mjs` で作り直す） |

**2 段の使い方**：汎用のデザインと道具はこの個人スキルに、案件ごとの約束（用語・為替・出典・公開の手順）はリポジトリの `.cursor/skills/<名前>/SKILL.md` に分けると、どの案件でも同じ見た目で作れます。ひな形は実際の案件で使ったプロジェクトスキルから事業の中身を抜いたものです。

### ライセンス

スキル本体は [MIT](LICENSE)。同梱のフォント（Noto Sans JP・Inter）は SIL OFL 1.1、地図のデータは Natural Earth（パブリックドメイン）。詳しくは [THIRD_PARTY.md](THIRD_PARTY.md)。

---

## English

**A Cursor Agent Skill for building polished 1920×1080 HTML slide decks with consistent quality** — charts, diagrams, maps, computed numbers, illustrations, PNG export and automatic layout checks in one package. (Figures above have English captions; the skill documentation is written in Japanese, and decks can be English with `--lang en`.)

![Features](docs/img/features.png)

- **Single-file HTML decks** — one `<section>` per slide (fixed 1920×1080, scaled to the window); CSS, JS, data and maps embedded, fonts bundled, **works offline**
- **Two modes** — `doc` (self-explanatory handouts) and `pitch` (all text ≥ 54px, speaker notes, synced presenter window, target times)
- **Six themes** — `green` `navy` `mono` `blue` `wa` (Japanese style) `dark`
- **Built-in SVG charts** — column, bar, stacked (incl. 100%), bar + line combo, line, area, donut, scatter, bubble, waterfall, Sankey, Gantt
- **Diagrams** — relationship diagrams, swimlane flows, cycles and trees; arrows are routed automatically
- **Maps** — world, single countries, Japanese prefectures (with Okinawa inset), generated from Natural Earth
- **Numbers come from code** — embed JSON from a Python model and reference it with `data-f="rev.y3"` or `"@path"`
- **Automatic checks** — headless Chrome renders every slide and flags overflow, off-canvas elements, tiny text, missing data, empty maps, missing images and duplicate ids

![Automatic checks](docs/img/check.png)

### Install

```bash
git clone https://github.com/32Lwk/html-slides.git ~/.cursor/skills/html-slides
cd ~/.cursor/skills/html-slides/scripts && npm install
```

Requires Node 18+, Chrome or Edge, and Python 3 (numpy; Pillow for illustrations). Then ask Cursor's Agent to "make slides about …", "add a chart", or "export to PNG" — it reads [SKILL.md](SKILL.md) and follows the workflow.

### Manual use

```bash
S=~/.cursor/skills/html-slides/scripts
node $S/deck.mjs new ./my-deck --mode pitch --theme navy --lang en --title "Title"
node $S/inject-data.mjs ./my-deck/slides.html data.json
node $S/make-map.mjs maps.json --into ./my-deck/slides.html
node $S/export.mjs ./my-deck/slides.html --check
node $S/export.mjs ./my-deck/slides.html --sheet
```

### License

The skill is [MIT](LICENSE). Bundled fonts (Noto Sans JP, Inter) are under the SIL OFL 1.1 and map data is from Natural Earth (public domain). See [THIRD_PARTY.md](THIRD_PARTY.md).
