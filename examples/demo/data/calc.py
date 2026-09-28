"""SENCHA BOX（架空の事業）の数字を計算し、スライドに流し込む data.json と地図の maps.json を書く。

    python data/calc.py
    node <skill>/scripts/inject-data.mjs slides.html pitch.html data/data.json
    node <skill>/scripts/make-map.mjs data/maps.json --into slides.html

数字はすべて見本用の仮の値。前提を変えたら、上の3行をやり直すだけでスライドの数字・グラフ・地図がそろって変わる。
"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MONTHS = np.arange(1, 37)

# ---- 前提（見本用の仮の値） ----
PLANS = {"standard": {"price": 3800, "share": 0.6}, "premium": {"price": 6800, "share": 0.4}}
CHURN = 0.04                 # 毎月やめる割合
NEW_PEAK, NEW_MID, NEW_K = 3200, 16, 0.28   # 新しい会員：月の最大・中心の月・傾き（S 字）
COST = {"tea": 1100, "pack": 350, "ship": 1450, "pay_rate": 0.035}   # 1箱あたり
CAC = 6000                   # 新しい会員1人を集める広告費
FIXED = lambda m: 3e6 + 22e6 / (1 + np.exp(-(m - 14) / 4))           # 人件費・家賃など（円/月）
REGIONS = {"US": 0.42, "HK": 0.20, "TW": 0.16, "CA": 0.12, "SG": 0.10}
PREMIUM_BY_REGION = {"US": 0.45, "HK": 0.40, "TW": 0.30, "CA": 0.42, "SG": 0.38}

# ---- 会員数と損益（月次） ----
new = NEW_PEAK / (1 + np.exp(-NEW_K * (MONTHS - NEW_MID)))
members = np.zeros(36)
for i in range(36):
    members[i] = (members[i - 1] if i else 0) * (1 - CHURN) + new[i]
arpu = sum(p["price"] * p["share"] for p in PLANS.values())
boxes = members
revenue = boxes * arpu
var_cost = boxes * (COST["tea"] + COST["pack"] + COST["ship"]) + revenue * COST["pay_rate"]
ads = new * CAC
fixed = FIXED(MONTHS)
op = revenue - var_cost - ads - fixed

def yearly(a):
    return [float(a[y * 12:(y + 1) * 12].sum()) for y in range(3)]

rev_y, op_y = yearly(revenue), yearly(op)
oku = lambda v: round(v / 1e8, 1)
by_plan = {k: [oku(r * p["share"] * p["price"] / arpu) for r in rev_y] for k, p in PLANS.items()}

# 1箱あたり（3年目の平均）
y3 = slice(24, 36)
b3 = boxes[y3].sum()
unit = {
    "price": round(arpu),
    "tea": -COST["tea"], "pack": -COST["pack"], "ship": -COST["ship"],
    "pay": -round(arpu * COST["pay_rate"]),
    "ads": -round(ads[y3].sum() / b3),
    "fixed": -round(fixed[y3].sum() / b3),
}
unit["profit"] = sum(unit.values())

# 地域 → プラン（3年目の年末の会員）
m_end = members[-1]
sankey = []
for r, s in REGIONS.items():
    n = m_end * s
    sankey += [{"from": r, "to": "premium", "v": round(n * PREMIUM_BY_REGION[r])},
               {"from": r, "to": "standard", "v": round(n * (1 - PREMIUM_BY_REGION[r]))}]

data = {
    "rev": [oku(v) for v in rev_y],
    "op": [oku(v) for v in op_y],
    "margin": [round(o / r, 3) if r else 0 for o, r in zip(op_y, rev_y)],
    "members": [round(members[11]), round(members[23]), round(members[35])],
    "arpu": round(arpu),
    "churn": CHURN,
    "cac": CAC,
    "ltv": round((arpu - COST["tea"] - COST["pack"] - COST["ship"] - arpu * COST["pay_rate"]) / CHURN),
    "grossBox": round(arpu - COST["tea"] - COST["pack"] - COST["ship"] - arpu * COST["pay_rate"]),
    "life": round(1 / CHURN),
    "premShare": round(sum(REGIONS[r] * PREMIUM_BY_REGION[r] for r in REGIONS), 3),
    "byPlan": by_plan,
    "monthly": {"labels": [f"{m}" for m in MONTHS], "members": [round(v / 1000, 1) for v in members],
                "op": [round(v / 1e6) for v in op],
                "opColors": ["warn" if v < 0 else "accent" for v in op]},
    "breakeven": int(next(m for m, v in zip(MONTHS, op) if v > 0)),
    "unit": unit,
    "regions": {k: round(v * 100) for k, v in REGIONS.items()},
    "sankey": sankey,
}
data["ltvCac"] = round(data["ltv"] / CAC, 1)

# ---- 損益計算書・資金繰り・損益分岐（スキルの templates/finance.py。自分のデッキでは data/ にコピーして import する） ----
sys.path.insert(0, str(HERE.parents[2] / "templates"))
from finance import income_statement, to_columns, cash_flow, break_even, scale  # noqa: E402

CAPEX = {1: 30e6}            # 1か月目にアプリと倉庫の仕組み（仮置き）
EQUITY = {0: 400e6}          # 開業前の出資（仮置き）。カードの入金は翌月（collect_lag=1）
L = lambda a: [float(v) for v in a]
pl = income_statement(
    L(revenue),
    cogs={"tea": L(boxes * COST["tea"]), "pack": L(boxes * COST["pack"]), "ship": L(boxes * COST["ship"])},
    sga={"pay": L(revenue * COST["pay_rate"]), "ads": L(ads), "fixed": L(fixed)},
)
cols = to_columns(pl, unit=1e6, digits=1, rates={"gross_rate": ("gross", "rev"), "op_rate": ("op", "rev")},
                  negate=["cogs_tea", "cogs_pack", "cogs_ship", "cogs_total", "sga_pay", "sga_ads", "sga_fixed", "sga_total"])
cf = cash_flow(pl["op"], capex=CAPEX, financing=EQUITY, revenue=L(revenue), collect_lag=1)
variable = [c + p for c, p in zip(pl["cogs_total"], pl["sga"]["pay"])]
bep = break_even(L(revenue), variable, L(ads + fixed))
data["fin"] = {
    "pl": {**cols, **cols.pop("lines")},
    "cf": {"balance": scale(cf["balance"]), "cum": scale(cf["cum"]), "need": round(cf["need"] / 1e8, 2),
           "trough": cf["trough_month"], "recover": cf["recover_month"], "equity": round(cf["pre"] / 1e8, 1),
           "capex": round(sum(CAPEX.values()) / 1e6), "low": round(min(cf["balance"]) / 1e8, 2),
           "colors": ["warn" if v < 0 else "accent" for v in cf["cum"]]},
    "bep": {"rev": scale(revenue), "line": scale(bep["bep"]), "first": bep["first_month"],
            "cm": round(bep["cm_rate"][-1], 3), "fixedY3": round(sum((ads + fixed)[24:36]) / 12 / 1e6),
            "bepY3": round(sum(bep["bep"][24:36]) / 12 / 1e6), "revY3": round(sum(revenue[24:36]) / 12 / 1e6),
            "bepEnd": round(bep["bep"][-1] / 1e6),
            # 率は月の率の平均でなく、年の合計から出す（表の売上高・損益分岐点から読者が計算し直して合うように）
            "safetyY3": round(1 - sum(bep["bep"][24:36]) / sum(revenue[24:36]), 3)},
}

# ---- 産地（見本用の概数） ----
TEA_T = {"鹿児島": 27000, "静岡": 25800, "三重": 5200, "宮崎": 2900, "京都": 2300, "福岡": 1700,
         "奈良": 1400, "熊本": 1200, "佐賀": 1100, "長崎": 700, "埼玉": 600, "愛知": 500,
         "岐阜": 400, "滋賀": 400, "高知": 300, "大分": 300, "茨城": 200, "愛媛": 200}
top = sorted(TEA_T.items(), key=lambda kv: -kv[1])[:6]
data["tea"] = {"labels": [k for k, _ in top], "values": [v for _, v in top],
               "share2": round((TEA_T["鹿児島"] + TEA_T["静岡"]) / sum(TEA_T.values()), 3)}
(HERE / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

# ---- 地図 ----
ORIGIN = {"lon": 138.38, "lat": 34.98}
maps = {"maps": [
    {"name": "markets", "width": 1036, "height": 640, "pacific": True, "zoom": 1.3, "shift": [0, 70],
     "fill": {"TW": "accent", "HK": "accent", "SG": "mid", "US": "sub", "CA": "sub", "JP": "warn"},
     "arcs": [{"from": [138.38, 34.98], "to": "Taipei", "cls": "accent"},
              {"from": [138.38, 34.98], "to": "Hong Kong", "cls": "accent"},
              {"from": [138.38, 34.98], "to": "Singapore", "cls": "accent dash"},
              {"from": [138.38, 34.98], "to": "Los Angeles", "cls": "dash"},
              {"from": [138.38, 34.98], "to": "Toronto", "cls": "dash"}],
     "points": [{"lon": 138.38, "lat": 34.98, "text": "静岡", "cls": "warn", "label": "top"},
                {"city": "Taipei", "text": "台北", "label": "right"},
                {"city": "Hong Kong", "text": "香港", "label": "left"},
                {"city": "Singapore", "text": "シンガポール", "label": "right"},
                {"city": "Los Angeles", "text": "ロサンゼルス", "label": "bottom"},
                {"city": "Toronto", "text": "トロント", "label": "top"}]},
    {"name": "tea", "scope": "japan", "width": 1036, "height": 740, "okinawaInset": True,
     "values": TEA_T, "steps": 5, "breaks": [500, 1000, 2000, 5000],
     "legendTitle": "荒茶の生産量（t、見本用の概数）", "legendLow": "少", "legendHigh": "多",
     "labels": [{"code": "静岡", "text": "静岡"}, {"code": "鹿児島", "text": "鹿児島"}, {"code": "三重", "text": "三重", "dx": 10}]},
    {"name": "markets_en", "pitch": True, "width": 1720, "height": 700, "pacific": True, "lang": "en", "zoom": 1.25, "shift": [0, 60],
     "fill": {"TW": "accent", "HK": "accent", "SG": "accent", "US": "mid", "CA": "mid", "JP": "warn"},
     "arcs": [{"from": [138.38, 34.98], "to": "Taipei", "cls": "accent"},
              {"from": [138.38, 34.98], "to": "Singapore", "cls": "accent"},
              {"from": [138.38, 34.98], "to": "Los Angeles", "cls": "dash"}],
     "points": [{"lon": 138.38, "lat": 34.98, "text": "Japan", "cls": "warn", "label": "top"},
                {"city": "Singapore", "text": "Asia first", "label": "right"},
                {"city": "Los Angeles", "text": "then N. America", "label": "bottom"}]},
]}
(HERE / "maps.json").write_text(json.dumps(maps, ensure_ascii=False, indent=1), encoding="utf-8")

print("売上高（億円）", data["rev"], "営業利益", data["op"], "会員（年末）", data["members"])
print("1箱", unit, "黒字化の月", data["breakeven"])
print("資金：必要", data["fin"]["cf"]["need"], "億円・底の月", data["fin"]["cf"]["trough"], "・戻る月", data["fin"]["cf"]["recover"],
      "／損益分岐を超える月", data["fin"]["bep"]["first"])
print("四半期の売上高", data["fin"]["pl"]["rev"])
print("四半期の営業利益", data["fin"]["pl"]["op"])
