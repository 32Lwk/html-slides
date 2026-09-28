# 部品（HTML の書き方）

すべて `assets/slides.css` にある。色はテーマの変数（`var(--accent)` など）だけを使い、色コードを直接書かない。
見本は `templates/doc.html`・`templates/pitch.html` と `examples/demo/`（`png/sheet.png` で一覧）。

## 目次

- ページの型（doc）
- 表紙・中扉
- カード・帯・箇条書き
- 大きな数字・足し算の流れ・時間の帯
- 表・横棒・凡例
- 比べる：左右・2×2・ピラミッド・ベン図
- 画像
- 映す発表（pitch）の部品
- 発表者メモ
- レイアウトの型（ページの設計図）

## ページの型（doc）

```html
<section id="value">                      <!-- id は英小文字。PNG の名前と #リンクになる -->
  <div class="kicker"><span class="sec">01</span>VALUE</div>   <!-- 章番号＋英語の小見出し -->
  <h1>見出しは、このページの結論を1文で言い切る</h1>
  <div class="rule"></div>
  …本文（下の部品）…
  <div class="strip">結論を帯で言い直す。<b>強調</b>、<span class="w">お金・注意</span></div>
  <div class="foot"><span>出典・前提</span><span>1ドル=150円</span></div>   <!-- 2つ目の span は右寄せ -->
</section>
```

- 本文の高さの目安（doc）：h1 が1行なら本文は約 y=200〜1000 の 800px。`.strip.bottom` を使うなら本文は約 700px まで
- ページ番号は自動（`data-nopno` を section に付けると消える。`<html data-nopno>` で全部消える）
- 別ページへのリンク：`<a class="ref" href="#unit">1箱の内訳</a>` → 自動で「p.13」が付く（PNG でもたどれる）。`data-fl="要素の id"` で飛んだ先を光らせる、`<a class="pgl" href="#unit"></a>` は「p.13」だけ。飛んだ先に「← 元のページへ」が出る（reference/sources.md）
- 出典欄（注記の下の「出典 1 3–6 P2」）と用語の下線は `build-sources.mjs`・`build-glossary.mjs` が付ける。手で書かない

## 表紙・中扉

```html
<section id="cover" class="cover" data-nopno>
  <div class="kicker">SERVICE · 提案書</div>
  <h1>何を・誰に・どう良くするかを言い切る題</h1>     <!-- 96px、幅 1000px まで。右に絵 -->
  <div class="lead">1〜2文の要約。数字は data-f で</div>
  <img class="hero-img" src="illust/cover.webp" alt="">   <!-- 右上 700×700。絵がなければ <div class="ph hero-img">絵</div> -->
  <div class="toc">
    <div><span class="sec">01</span>章の名前<small>この章で言うこと</small></div> …
  </div>
  <div class="foot"><span>日付・前提</span><span>イラストは生成AIで作成したイメージ</span></div>
</section>

<section id="ch01" class="chap" data-n="01" data-t="市場と顧客">   <!-- data-n・data-t から下の章の並びを自動で作る -->
  <div class="ck">Chapter 01</div>
  <div class="cn">01</div>
  <h1>市場と顧客</h1>
  <div class="lead">この章で言うことを1文で</div>
</section>
```

## カード・帯・箇条書き

```html
<div class="grid">                        <!-- 3列。.g2 .g4 .g5 -->
  <div class="card">
    <img class="ill" src="illust/fan.webp" alt="">   <!-- 任意。高さ 250px -->
    <div class="when">誰に</div><h2>短い見出し</h2><p>説明は2〜3行</p>
    <div class="note">補足は灰色で下に寄せる</div>
  </div>
  <div class="card key">…</div>          <!-- 強調（1ページに1〜2枚） -->
  <div class="card open">…<span class="tag">未定</span></div>   <!-- 未定・注意。.tag.ok .tag.gray -->
  <div class="card solid">…</div>        <!-- 塗りつぶし -->
</div>

<h3>小見出し<small>補足</small></h3>
<ul class="pts"><li>…</li></ul>          <!-- 点の箇条書き -->
<ul class="check"><li>…</li></ul>        <!-- チェックの箇条書き（確かめること・条件） -->
<ol class="steps"><li>…</li></ol>        <!-- 番号つきの手順 -->
<div class="lead">大きめの1文</div>
<div class="quote">声・引用<cite>誰の声か</cite></div>
<div class="strip">帯</div>  <div class="strip bottom">ページの下に固定する帯</div>
```

## 大きな数字・足し算の流れ・時間の帯

```html
<div class="kpis">                        <!-- 4列。.k3 .k2 -->
  <div class="kpi key"><div class="v"><span data-f="rev.2"></span><small>億円</small></div>
    <div class="k">売上高（3年目）</div><div class="d">補足</div></div>
</div>

<div class="flow">                        <!-- 足し算・掛け算・手順 -->
  <div class="step"><span class="who">1箱で残る額</span><span class="big"><span data-f="grossBox"></span><small>円</small></span><small>説明</small></div>
  <div class="gap">×</div>
  <div class="step key">…</div>          <!-- .key 強調、.money お金 -->
</div>

<div class="timeline">                    <!-- 時間の配分。幅は flex の数 -->
  <div class="seg" style="flex:2">進行<small>2分</small></div>
  <div class="seg key" style="flex:4">プレイ<small>4分</small></div>
</div>
```

## 表・横棒・凡例

```html
<table class="tbl">                       <!-- .tight で詰める -->
  <tr><th>項目</th><th class="r">金額</th></tr>
  <tr class="em"><td>強調の行</td><td class="r">100</td></tr>
  <tr><td>普通の行</td><td class="s">灰色の説明</td></tr>
  <tr class="sum"><td>合計</td><td class="r">…</td></tr>
</table>
<!-- ○△× は <span class="mk o">○</span> <span class="mk t">△</span> <span class="mk x">×</span> -->

<div class="bars">                        <!-- CSS だけの横棒（数が少ないとき）。多いときは charts.js の bar horizontal -->
  <div class="l">A<small>補足</small></div><div><div class="b key" style="width:80%"></div></div><div class="v">80</div>
</div>

<div class="legend"><span><i style="background:var(--accent)"></i>1か月目から</span> …</div>
```

損益計算書のような「行＝科目・列＝期間」の数字の表は、手で `table.tbl` を書かず `data-fin`（`assets/tables.js`）で計算の出力から描く（reference/finance.md）。

## 比べる：左右・2×2・ピラミッド・ベン図

```html
<div class="vs"><div class="card">前</div><div class="mid">→</div><div class="card key">後</div></div>

<div class="matrix" style="height:600px">
  <div class="q"><h4>左上</h4>説明</div><div class="q key"><h4>右上（狙う所）</h4>…</div>
  <div class="q">…</div><div class="q">…</div>
  <div class="ax-x"><span>安い</span><span>高い</span></div>
  <div class="ax-y"><span>低い</span><span>高い</span></div>
</div>

<!-- ピラミッド：各段の幅と --i（上辺の内側への入り）をデッキの <style> で決める -->
<div class="pyramid pyr"><div>頂点</div><div>中段</div><div class="base">土台</div></div>
<style>.pyr > div { height: 170px } .pyr > div:nth-child(1) { width: 320px; height: 190px }
.pyr > div:nth-child(2) { width: 580px; --i: 130px } .pyr > div:nth-child(3) { width: 840px; --i: 130px }</style>

<div class="venn" style="height:560px">
  <div class="c a" style="left:0;top:0;width:520px;height:520px">A</div>
  <div class="c b" style="left:320px;top:0;width:520px;height:520px;justify-content:flex-end">B</div>
  <div class="mid" style="left:330px;top:230px;width:180px">重なり</div>
</div>
```

## 画像

```html
<img class="hero-img" src="illust/x.webp" alt="">                 <!-- 表紙の右 -->
<figure class="fig" style="height:600px"><img src="illust/x.webp" alt=""><figcaption>説明</figcaption></figure>
<figure class="fig cover" style="height:600px"><img src="photo.jpg" alt=""></figure>   <!-- 写真を枠いっぱい -->
<div class="phones"><figure><img src="screen1.png" alt=""><figcaption>画面の説明</figcaption></figure> …</div>
<div class="ph" style="height:400px">まだ無い絵（置き場所）</div>
```

## 映す発表（pitch）の部品

`<html data-mode="pitch">` のとき文字はすべて 54px 以上（`?check` が調べる）。1ページ1メッセージ、文は短く、絵と数字を主役にする。

```html
<div class="center fill"><div class="say">言いたいことを<br><em>強調色</em>で1つだけ</div></div>
<div class="center" style="height:760px"><div class="bignum">44<small>k</small></div><div class="bignum-k">説明</div></div>
<div class="trio"><figure><img src="illust/a.webp" alt=""><figcaption>見出し<small>補足</small></figcaption></figure> …</div>  <!-- .t2 .t4 -->
<div class="chain"><figure><img …><figcaption>A</figcaption></figure><div class="arrow">→</div><figure>…</figure></div>
<div class="band">A <b>→</b> B</div>
<div class="split"><div>文</div><img src="…" alt=""></div>
<section class="dark">…</section>                        <!-- 反転（締め・問い） -->
<section class="full-img"><img src="…" alt=""><div class="over">写真に重ねる1文</div></section>
```

グラフ・地図・図は pitch でも使えるが、文字が 54px になるので数を絞る（棒は3〜5本、地図のラベルは3つまで、図の箱は4つまで）。
地図は仕様に `"pitch": true` を付ける（点とラベルの間隔が 54px 用になる）。

## 発表者メモ

```html
<section id="say" data-end="0:40">          <!-- このページを終える目標の時刻（分:秒） -->
  …
  <aside class="notes">話す台本。画面には出ない</aside>
</section>
```

キー：N メモを重ねる／P 発表者用の窓（ページ送りが連動、経過時間と目標）／T 時計を0に／F 全画面。

## レイアウトの型（ページの設計図）

| 伝えたいこと | 型 |
|---|---|
| 3つの価値・3者の得 | `.grid` のカード3枚（絵つき）＋ `.strip` |
| 数字の結論 | `.kpis` 4つ＋ `.flow`（数字のでき方）＋ 横棒1本の比較 |
| 伸び方 | `.cols.c64`：左に棒・線グラフ、右に「読み取り」`ul.pts` と `.strip` |
| お金の内訳 | waterfall（全幅）＋ `.strip` |
| 構成・行き先 | sankey（左 6）＋ donut と `ul.pts`（右 4） |
| どこで売るか | `.cols.c64`：左に地図＋`.legend`、右に表 |
| 産地・分布 | `.cols.c64`：左に都道府県の塗り分け、右に横棒 |
| 位置取り | `.cols.c64`：左に bubble（quad で4つに分ける）、右に読み取りと `.quote` |
| 仕事の流れ | `.lanes.dgm`（行＝担当、列＝段階）＋ `.strip` |
| 仕組み・お金と物の流れ | `.cols`：左に `.dgm`（箱と矢印）、右に `.cycle` |
| 計画・時期 | gantt（全幅） |
| 土台と積み上げ | `.cols.mid`：左に `.pyramid`、右に `ul.check` と `.quote` |
| リスク | `table.tbl`（影響は `.mk`）＋止める線・進める線の `.card` 2枚＋`.strip.bottom` |
| 比べる | `.grid.g2`：左に横棒、右に表。または `.vs` |
