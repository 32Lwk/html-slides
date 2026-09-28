# 出典

data/sources.json から build-sources.mjs で作る（手で直さない）。 リンクの確認 2026-09-28。

## 一次調査

| № | 調査 | だれ・何人 | いつ | 方法 | 記録 | 使うページ |
|---|---|---|---|---|---|---|
| P1 | 海外の日本茶好きへのオンラインのアンケート（見本） | 台湾・香港・米国の120人 | 2026-08 | Web のアンケート（選ぶ問い10・自由記述2） | data/survey.csv（見本） | value, rivals, base |
| P2 | 静岡・鹿児島の茶農家への聞き取り（見本） | 農家6軒 | 2026-07 | 訪ねて1時間ずつ聞く | notes/farms.md（見本） | value, farms, lanes |

## 外部の資料

### 01 市場と顧客

| № | 発行者「資料名」 | 日付 | URL | 使うページ |
|---|---|---|---|---|
| 1 | 見本の貿易統計「緑茶の輸出額（国・地域別）」 | 2026-03 | https://example.com/trade/green-tea-exports | value, markets |
| 2 | 見本の市場調査会社「海外の日本茶の消費者調査 2026」 | 2026-05 | https://example.com/research/japanese-tea-2026 | markets, rivals, mix |
| 3 | 見本の関税当局「少額の輸入品の扱い（北米）」 | 2026-06 | https://example.com/customs/low-value-imports | markets, risks |
| 4 | 見本の統計局「作物統計：茶の栽培面積と荒茶の生産量」 | 2026-02 | https://example.com/stats/tea-production | farms |

### 02 仕組み

| № | 発行者「資料名」 | 日付 | URL | 使うページ |
|---|---|---|---|---|
| 5 | 見本の運送会社「国際配送の運賃表（関税込みの配送）」 | 2026-04 | https://example.com/carrier/ddp-rates | lanes, unit, risks |
| 6 | 見本の決済会社「手数料と入金のご案内」 | 2026-01 | https://example.com/payments/pricing | loop, unit, fin-cf |
| 7 | 見本の業界団体「定期便の解約率の調査」 | 2025-11 | https://example.com/association/subscription-churn | loop, kpi, growth, risks |

### 03 数字と計画

| № | 発行者「資料名」 | 日付 | URL | 使うページ |
|---|---|---|---|---|
| 8 | 見本の広告会社「SNS 広告の獲得単価の目安」 | 2026-02 | https://example.com/ads/cac-benchmarks | kpi, unit |

## 前提の一覧

| ID | 数字 | 置いた値 | 状態 | 置き方・理由 | 計算の場所 | 使うページ |
|---|---|---|---|---|---|---|
| A1 | 月の値段 | 基本3,800円・上位6,800円 | 計画 | 競合の中価格帯（外部の資料 2）に合わせて決めた | calc.py の PLANS | kpi, unit, mix, fin-pl |
| A2 | 上位プランを選ぶ割合 | 40%（地域ごとに30〜45%。3年目の会員の構成では約41%） | 推計 | アンケート（P1）で上位を選んだ割合 | calc.py の PLANS・PREMIUM_BY_REGION | growth, mix |
| A3 | やめる割合 | 毎月4% | 仮置き | 業界の調査（外部の資料 7）の中央値より低く置いた。90日で測って置き直す | calc.py の CHURN | loop, kpi, growth, risks |
| A4 | 新しい会員 | 月最大3,200人（16か月目が中心の S 字） | 推計 | 広告の獲得単価（外部の資料 8）と広告費から | calc.py の NEW_PEAK・NEW_MID・NEW_K | growth, members |
| A5 | 集める広告費 | 1人6,000円 | 推計 | SNS 広告の目安（外部の資料 8）の中央 | calc.py の CAC | kpi, unit |
| A6 | 1箱の原価 | 茶葉1,100円・梱包350円 | 計画 | 農家と約束する買い値と、倉庫の見積もり | calc.py の COST | loop, unit, fin-pl |
| A7 | 国際送料 | 1箱1,450円（関税込み） | 推計 | 運賃表（外部の資料 5）の1kg の箱 | calc.py の COST["ship"] | unit, risks, fin-pl |
| A8 | 人件費・家賃など | 月300万円 → 2,500万円（14か月目が中心） | 仮置き | 採用の計画から置いた | calc.py の FIXED | unit, fin-pl, fin-bep |
| A9 | 契約する農家 | 1年目6軒 → 2年目10軒 | 計画 | 聞き取り（P2）で1年分の量を約束できると答えた軒数から | 計画の値（calc.py では使わない） | farms, roadmap |
| A10 | 地域の割合 | 米国42%・香港20%・台湾16%・カナダ12%・シンガポール10% | 推計 | 市場調査（外部の資料 2）の購入者の分布 | calc.py の REGIONS | markets, mix |
| A11 | カードの入金 | 翌月 | 推計 | 決済会社の入金の案内（外部の資料 6） | calc.py の cash_flow(collect_lag=1) | fin-cf |
| A12 | 1か月目の投資 | 3,000万円 | 仮置き | アプリと倉庫の仕組みの見積もり前の置き値 | calc.py の CAPEX | fin-cf |
| A13 | 開業前の出資 | 4億円 | 仮置き | 資金繰りの底（必要な資金）を覆う額 | calc.py の EQUITY | fin-cf |
