# イラスト（GenerateImage → to_webp.py）

Cursor の GenerateImage（`cursor` 名前空間の組み込みツール。GetDynamicTools で形を確かめてから CallDynamicTool）で描き、`scripts/to_webp.py` で背景を抜いて webp にする。
1デッキの絵は**同じ画風にそろえる**：下の「画風の指示」を毎回そのまま付け、2枚目からは1枚目を `reference_image_paths` に渡す。

## 手順

1. 描く絵を決める（表紙1枚＋カード3枚、など。1ページに絵は1〜3枚）
2. 1枚目を描く：`<何を描くか>` ＋ テーマの画風の指示。保存先はワークスペースの外でも中でもよい
3. 2枚目から：同じ指示＋ `reference_image_paths: [1枚目]`（「同じ画風・同じ色で」と書く）
4. 変換：`python <skill>/scripts/to_webp.py raw/fan.png illust/fan.webp`（外周から白を透明にし、余白を切り、長い辺 1400px）
5. 置く：`<img class="ill" src="illust/fan.webp" alt="">`、foot に「イラストは生成AIで作成したイメージ」
6. `export.mjs --check` で `image-missing` が無いこと、PNG で絵が切れていないことを見る

`to_webp.py` のオプション：`--max 1400`（長い辺）、`--keep-bg`（背景を残す：写真・背景まで描いた絵）、`--thresh 24`（白と見なす幅）、`--pad 12`（切った後の余白）、`--quality 88`。

## 画風の指示（テーマごと）

共通の部分（英語で書くと安定する）：

```
Flat vector illustration for a business presentation slide. Clean geometric flat shapes, soft rounded corners,
minimal details, no outlines or thin dark outlines only, gentle soft shadows, friendly and calm mood.
Palette: {ACCENT} and {WARN} as the only accent colors, plus soft neutrals (warm grays, off-white, light beige).
Centered subject with generous empty space around it. Pure white background. No text, no letters, no numbers, no logos, no watermark.
```

| テーマ | {ACCENT} | {WARN} | 足す言葉 |
|---|---|---|---|
| green | emerald green (#1f9d55) | burnt orange (#c2410c) | fresh, optimistic |
| navy | deep navy blue (#1f3a68) | coral red (#e4572e) | trustworthy, corporate |
| mono | near-black charcoal (#111111) | signal red (#d62828) | minimalist, editorial, mostly grayscale |
| blue | bright blue (#2563eb) | golden amber (#b7791f) | modern tech, clean |
| wa | deep indigo blue (#264e86) | vermilion orange (#d9480f) | Japanese, calm, subtle washi texture feel |
| dark | mint green (#34d399) | warm orange (#fb923c) | glowing accents that read well on a dark navy slide |

描くもの（`<何を描くか>`）の書き方：

- 1枚に1つの場面・1つの主役。「誰が・何を・どこで」を1文で（例：`An elderly man smiling while holding a cup of green tea, a tea box on the table`）
- 人物は国や年代を書くと偏りを避けやすい。実在の人・商標・キャラクターは描かない
- 文字は入れない（見出しは HTML で書く）。画面・看板が要る場面は「blank screen」「blank sign」と書く
- 表紙の絵は正方形（700×700 に置く）、カードの絵は横長でもよい（高さ 250px に収まる）

## よくある失敗

| 症状 | 直し方 |
|---|---|
| 絵ごとに画風が違う | 2枚目から `reference_image_paths` に1枚目を渡し、同じ指示をそのまま付ける |
| 絵の中の白（服・カップ）まで透明になる | 外周とつながっていなければ残る。つながるなら `--thresh 12` に下げるか `--keep-bg` |
| 背景が灰色で抜けない | 指示に `Pure white background` があるか。`--thresh 40` に上げる |
| 文字・ロゴが入る | `No text, no letters, no numbers, no logos` を必ず付ける。入ったら描き直す |
| ダークのテーマで暗い部分が沈む | dark 用の指示（glowing accents）で描き直す |

## 写真・画面の画像

写真は `to_webp.py … --keep-bg --max 1920`。アプリの画面は PNG のまま `.phones` に置く（`object-fit: cover`）。
見本（Pexels・Unsplash など）を使うときは foot に出典を書く。
