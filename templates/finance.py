"""損益計算書・資金繰り・損益分岐の計算のひな形（html-slides）。

デッキの data/ にコピーし、calc.py から import して使う。numpy は要らない（月ごとのリストで計算する）。
出した dict を data.json に入れ、スライドの財務の表（data-fin）とグラフ（data-chart）の "@fin.…" で読む。

    from finance import income_statement, to_columns, cash_flow, break_even

    pl = income_statement(revenue, cogs={"茶葉": tea, "送料": ship}, sga={"広告費": ads, "人件費など": fixed})
    table = to_columns(pl, unit=1e6, rates={"gross_rate": ("gross", "rev"), "op_rate": ("op", "rev")})
    cf = cash_flow(pl["op"], capex={1: 30e6}, financing={0: 300e6}, revenue=revenue, collect_lag=1)
    bep = break_even(revenue, variable=[...], fixed=[...])

金額は正の数で渡す（費用も正）。表に出すときにマイナスにしたい行は to_columns(..., negate=[...]) で符号を変える。
"""
from __future__ import annotations

from typing import Iterable

Series = list[float]


def _add(*xs: Iterable[float]) -> Series:
    xs = [list(x) for x in xs]
    return [sum(v) for v in zip(*xs)] if xs else []


def _sub(a: Iterable[float], b: Iterable[float]) -> Series:
    return [x - y for x, y in zip(a, b)]


def cumsum(a: Iterable[float]) -> Series:
    out, s = [], 0.0
    for v in a:
        s += v
        out.append(s)
    return out


def income_statement(revenue: Series, cogs: dict[str, Series] | None = None, sga: dict[str, Series] | None = None,
                     other: dict[str, Series] | None = None) -> dict:
    """月ごとの損益計算書。

    revenue: 月ごとの売上高。cogs: 売上原価の内訳。sga: 販売費・一般管理費の内訳。other: 営業外（利息など、費用は正・収益は負）。
    返り値の行: rev, cogs{…}, cogs_total, gross（売上総利益）, sga{…}, sga_total, op（営業利益）, ordinary（経常利益）
    """
    n = len(revenue)
    cogs, sga, other = cogs or {}, sga or {}, other or {}
    cogs_total = _add(*cogs.values()) if cogs else [0.0] * n
    sga_total = _add(*sga.values()) if sga else [0.0] * n
    gross = _sub(revenue, cogs_total)
    op = _sub(gross, sga_total)
    ordinary = _sub(op, _add(*other.values())) if other else op[:]
    return {"rev": list(revenue), "cogs": cogs, "cogs_total": cogs_total, "gross": gross,
            "sga": sga, "sga_total": sga_total, "op": op, "ordinary": ordinary}


def flatten(pl: dict, prefix: str = "") -> dict[str, Series]:
    """内訳の dict を 'cogs_茶葉' のような平らな名前にする（to_columns に渡す前に使う）"""
    out = {}
    for k, v in pl.items():
        if isinstance(v, dict):
            out.update(flatten(v, f"{prefix}{k}_"))
        else:
            out[f"{prefix}{k}"] = v
    return out


def to_columns(lines: dict, *, size: int = 3, years: int | None = None, year_len: int = 12, unit: float = 1.0, digits: int = 1,
               stock: Iterable[str] = (), rates: dict[str, tuple[str, str]] | None = None, negate: Iterable[str] = (),
               q_label: str = "Q{n}", y_label: str = "{n}年目", y_group: str = "年の合計", q_group: str = "{n}年目") -> dict:
    """月ごとの行を、四半期（size か月ずつ）と年の列にまとめ、財務の表（data-fin）で読める形にする。

    stock: 合計ではなく期末の値を使う行（資金の残高・会員数など）。rates: 合計してから割る率の行（名前: (分子, 分母)）。
    negate: 表でマイナスに見せる行（費用など）。unit: 割る数（1e6 で百万円）。返り値: {cols, groups, em, lines: {名前: [列ごとの値]}}
    """
    lines = flatten(lines)
    n = len(next(iter(lines.values())))
    years = years or n // year_len
    nq = n // size
    stock, negate = set(stock), set(negate)

    def agg(a: Series, i0: int, i1: int, name: str) -> float:
        return a[i1 - 1] if name in stock else sum(a[i0:i1])

    out = {}
    for name, a in lines.items():
        qs = [agg(a, q * size, (q + 1) * size, name) for q in range(nq)]
        ys = [agg(a, y * year_len, (y + 1) * year_len, name) for y in range(years)]
        sign = -1 if name in negate else 1
        out[name] = [round(sign * v / unit, digits) for v in qs + ys]
    for name, (num, den) in (rates or {}).items():
        raw = {k: [agg(lines[k], q * size, (q + 1) * size, k) for q in range(nq)] + [agg(lines[k], y * year_len, (y + 1) * year_len, k) for y in range(years)] for k in (num, den)}
        out[name] = [round(a / b, 4) if b else None for a, b in zip(raw[num], raw[den])]
    per_year = year_len // size
    cols = [q_label.format(n=(q % per_year) + 1) for q in range(nq)] + [y_label.format(n=y + 1) for y in range(years)]
    groups = [{"label": q_group.format(n=y + 1), "span": per_year} for y in range(nq // per_year)] + [{"label": y_group, "span": years}]
    return {"cols": cols, "groups": groups, "em": list(range(nq, nq + years)), "lines": out}


def cash_flow(op: Series, *, capex: dict[int, float] | Series | None = None, financing: dict[int, float] | None = None,
              revenue: Series | None = None, collect_lag: int = 0, payables: Series | None = None, pay_lag: int = 0,
              start: float = 0.0) -> dict:
    """月ごとの資金繰り（営業利益をお金の出入りに直した簡易版）。

    op: 月の営業利益。capex: 投資（{月: 額} か月ごとのリスト、正の数）。financing: 出資・借入（{月: 額}。0 は開業前）。
    revenue と collect_lag: 売上の入金が何か月遅れるか。payables と pay_lag: 支払いを何か月遅らせられるか。
    返り値: flow（月の出入り）, balance（月末の残高、出資込み）, need（出資なしで一番へこむ額＝必要な資金）,
            trough_month（一番へこむ月）, recover_month（出資なしの累計がプラスに戻る月、戻らなければ None）, pre（開業前の出資）
    """
    n = len(op)
    cap = [0.0] * n
    if isinstance(capex, dict):
        for m, v in capex.items():
            if 1 <= m <= n:
                cap[m - 1] += v
    elif capex:
        cap = list(capex)
    fin = [0.0] * n
    pre = 0.0
    for m, v in (financing or {}).items():
        if m <= 0:
            pre += v
        elif m <= n:
            fin[m - 1] += v
    lag_in = [0.0] * n
    if revenue is not None and collect_lag:
        for i in range(n):
            lag_in[i] = -revenue[i] + (revenue[i - collect_lag] if i >= collect_lag else 0.0)
    lag_out = [0.0] * n
    if payables is not None and pay_lag:
        for i in range(n):
            lag_out[i] = payables[i] - (payables[i - pay_lag] if i >= pay_lag else 0.0)
    ops = [o + a + b for o, a, b in zip(op, lag_in, lag_out)]
    no_fin = cumsum(_sub(ops, cap))
    flow = [o - c + f for o, c, f in zip(ops, cap, fin)]
    balance = [start + pre + v for v in cumsum(flow)]
    low = min(no_fin)
    trough = no_fin.index(low) + 1
    recover = next((i + 1 for i in range(trough - 1, n) if no_fin[i] >= 0), None)
    return {"flow": flow, "balance": balance, "cum": no_fin, "need": max(0.0, -low), "trough_month": trough,
            "recover_month": recover, "pre": pre}


def break_even(revenue: Series, variable: Series, fixed: Series) -> dict:
    """月ごとの損益分岐点の売上高＝固定費 ÷ 限界利益率（限界利益率＝1 − 変動費 ÷ 売上高）。

    返り値: bep（月ごとの損益分岐点の売上高）, cm_rate（限界利益率）, first_month（売上高が損益分岐点を超え、その後も下回らない最初の月）,
            safety（月ごとの安全余裕率＝(売上高 − 損益分岐点) ÷ 売上高）
    年の率を出すときは月の率を平均せず 1 − 損益分岐点の合計 ÷ 売上高の合計 にする（表の2つの額から計算し直して合うように）
    """
    n = len(revenue)
    cm = [(1 - v / r) if r else 0.0 for r, v in zip(revenue, variable)]
    bep = [f / c if c > 0 else None for f, c in zip(fixed, cm)]
    above = [b is not None and r >= b for r, b in zip(revenue, bep)]
    first = next((i + 1 for i in range(n) if all(above[i:])), None)
    safety = [round((r - b) / r, 4) if r and b is not None else None for r, b in zip(revenue, bep)]
    return {"bep": bep, "cm_rate": cm, "first_month": first, "safety": safety}


def break_even_units(price: float, var_unit: float, fixed: float, max_units: float, steps: int = 6) -> dict:
    """1個（1人・1箱）あたりの値段と変動費から、損益分岐の数量と、売上・費用の線（グラフ用）を出す"""
    cm = price - var_unit
    units = [max_units * i / steps for i in range(steps + 1)]
    return {"units": units, "revenue": [u * price for u in units], "cost": [fixed + u * var_unit for u in units],
            "bep_units": fixed / cm if cm > 0 else None, "bep_revenue": fixed / cm * price if cm > 0 else None}


def scale(a: Iterable[float | None], unit: float = 1e6, digits: int = 1) -> list[float | None]:
    """グラフに渡すために単位をそろえる（1e6 で百万円）"""
    return [None if v is None else round(v / unit, digits) for v in a]
