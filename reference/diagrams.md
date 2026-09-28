# 図（assets/diagrams.js）

箱は HTML（`.node` や `.lanes .box`）で並べ、矢印だけを SVG で自動で引く。箱の位置は CSS grid で決めるので、文字が増えても崩れにくい。

**箱の id はデッキ全体で一意にする**（ページの `<section id>` とも重ねない）。ページごとに接頭辞を付けると安全（`loop-a`・`kt-rev`）。重なると `?check` が `dup-id` を出す。下の例の短い id（`a` `b`）はそのページだけの例。

## 関係図・流れ図：`.dgm[data-links]`

```html
<div class="dgm" style="height:560px; display:grid; grid-template-columns:repeat(3, 300px);
     justify-content:space-between; align-content:center; row-gap:140px"
     data-links='[["a","b","注文"],["b","c","手数料",{"dash":true}],["b","d","発送の依頼"],["d","e","渡す"],["e","a","届く",{"tone":"key"}]]'>
  <div class="node" id="a">お客さま<small>海外のファン</small></div>
  <div class="node solid" id="b">自社</div>
  <div class="node money" id="c">決済会社</div>
  <div class="node key" id="e">配送会社</div>
  <div class="node" id="d">倉庫</div>
</div>
```

- 箱：`.node`（`.key` 強調／`.money` お金／`.solid` 塗り／`.ghost` 点線／`.round` 丸）。中に `<small>` と `<img>` を置ける
- 矢印：`["from","to","ラベル",{オプション}]` か `{"from":…,"to":…,"label":…}`
- 端の指定：`"id"`（向き合う辺を自動）／`"id:right"`／`"id:bottom:0.3"`（辺の上の位置 0〜1。同じ2つの箱の間に行きと帰りを引くとき）
- `mode`：既定は自動（揃っていれば直線、ずれていればカギ形）／`"s"` 直線／`"hv"` 横→縦／`"vh"` 縦→横／`"curve"`／`"arc"`（`bend` で曲がり、負なら反対側）
- `tone`：`"key"` 強調色／`"money"` 注意色。`dash:true` は破線で既定の色は注意色（**お金の流れは破線**、物・情報は実線にそろえる）
- `both:true` 両向き、`gap` 箱からの隙間、ラベルは `dx` `dy` `anchor` `at:[x,y]` で動かす（横の直線は線の上、ほかは線の右に自動）

### 崩れない並べ方

- 線が箱を横切らないように、**流れが一周する順に箱を置く**（例：上の段 左→右、下の段 右→左）
- 1つの図は箱6個・矢印7本まで。増えるなら2枚に分ける
- 箱の幅は grid の列で固定し、`justify-content:space-between` で端をそろえる

## 担当者ごとのフロー図：`.lanes.dgm`

```html
<div class="lanes dgm" style="--cols:5; --rows:4; --rowh:150px"
     data-links='[["l1","l2","注文"],["l2","l3","発注"],["l6","l7","追跡番号",{"dash":true}],["l8","l9","届く",{"tone":"key"}]]'>
  <div></div>
  <div class="phase"><b>1日目</b> 締め</div> … （--cols 個）

  <div class="who">お客さま<small>補足</small></div>
  <div class="cell"><div class="box" id="l1">注文<small>補足</small></div></div>
  <div class="cell"></div> …（1行に --cols 個の .cell）

  <div class="who me">自社<small>…</small></div>     <!-- 自分の行は .me で反転 -->
  …
</div>
```

- 1行目：左上の空き `<div></div>` ＋段階の見出し `.phase` を列の数だけ
- 各行：`.who` ＋ `.cell` を列の数だけ（空でも置く）。箱は `.box`（`.key` `.money` `.cond` 点線＝条件つき）
- `--cols`・`--rows`・`--rowh`（行の高さ）・`--who`（左の列の幅）で大きさを決める。本文 800px に収まるのは 4行×150px くらい

## 循環図：`.cycle`

```html
<div class="cycle" style="height:560px" data-start="-90">
  <div class="hub">毎月<br>くり返す</div>
  <div class="node key">届く</div>
  <div class="node">感想を聞く<small>アプリで3問</small></div>
  <div class="node">次の茶葉を選ぶ</div>
  <div class="node">農家へ発注</div>
</div>
```

`.node` を円周に並べて弧の矢印でつなぐ。`data-r` 半径（既定は自動）、`data-start` 最初の箱の角度（-90 が真上）、`data-open` で最後から最初への矢印を引かない（輪にしない順番）。

## ツリー（組織・分解）

```html
<div class="tree dgm" data-links='[["kt-rev","kt-mem"],["kt-rev","kt-price"],["kt-rev","kt-life"]]'>
  <div class="row"><div class="node solid" id="kt-rev">売上高</div></div>
  <div class="row"><div class="node" id="kt-mem">会員数</div><div class="node" id="kt-price">1箱の値段</div><div class="node" id="kt-life">続く月数</div></div>
</div>
```

`.tree` は行を縦に並べ、`.row` の中を横に並べる。矢印は上から下へ自動（向き合う辺）。KPI の分解・組織図に使う。

## pitch で使うとき

`.node` は 60px、線は 6px になる。箱は4つまで、ラベルは1〜2語にする。
