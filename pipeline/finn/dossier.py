"""Deterministic Dossier: screener tables -> computed metrics + rule-derived flags."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from . import fin
from .screener import Company, company, price_series

OUT = Path(__file__).resolve().parents[2] / "web" / "public" / "data"


def _cagr(series: list[float | None], years: int) -> float | None:
    vals = [v for v in series]
    if len(vals) < years + 1:
        return None
    a, b = vals[-(years + 1)], vals[-1]
    if a is None or b is None or a <= 0 or b <= 0:
        return None
    return round(((b / a) ** (1 / years) - 1) * 100, 1)


def _avg(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def compute(c: Company, annual: list[dict]) -> dict:
    rev = [r["revenue"] for r in annual]
    pat = [r["pat"] for r in annual]
    opm = [r["opm"] for r in annual]
    out: dict = {
        "revenue_cagr_3y": _cagr(rev, 3), "revenue_cagr_5y": _cagr(rev, 5),
        "pat_cagr_3y": _cagr(pat, 3), "pat_cagr_5y": _cagr(pat, 5),
    }
    recent, earlier = _avg(opm[-2:]), _avg(opm[-5:-2])
    if recent is not None and earlier is not None and recent - earlier > 1.5:
        out["opm_trend"] = "expanding"
    elif recent is not None and earlier is not None and recent - earlier < -1.5:
        out["opm_trend"] = "compressing"
    else:
        out["opm_trend"] = "stable"
    last = annual[-1] if annual else {}
    debt, eq = last.get("debt"), last.get("equity")
    out["de_ratio"] = round(debt / eq, 2) if debt is not None and eq else None
    debts = [r["debt"] for r in annual if r["debt"] is not None]
    if len(debts) >= 4 and debts[-4] is not None:
        a, b = debts[-4], debts[-1]
        if b > a * 1.15 + 1:
            out["debt_trend"] = "rising"
        elif b < a * 0.85 - 1:
            out["debt_trend"] = "falling"
        else:
            out["debt_trend"] = "flat"
    else:
        out["debt_trend"] = "flat"
    last5 = annual[-5:]
    cfo5 = [r["cfo"] for r in last5]
    pat5 = [r["pat"] for r in last5]
    if len(last5) == 5 and None not in cfo5 and None not in pat5 and sum(pat5) > 0:
        out["cfo_to_pat_5y"] = round(sum(cfo5) / sum(pat5), 2)
    else:
        out["cfo_to_pat_5y"] = None
    fcf5 = [r["fcf"] for r in last5]
    out["fcf_5y_cr"] = round(sum(fcf5)) if len(last5) == 5 and None not in fcf5 else None
    ccc = c.ratios.get("Cash Conversion Cycle")
    ccc = [x for x in (ccc or []) if x is not None]
    out["ccc_days"] = ccc[-1] if ccc else None
    if len(ccc) >= 4:
        d = ccc[-1] - ccc[-4]
        out["ccc_trend"] = "lengthening" if d > 10 else "shortening" if d < -10 else "stable"
    else:
        out["ccc_trend"] = None
    return out


def flags(c: Company, annual: list[dict], comp: dict, is_fin: bool) -> list[dict]:
    f: list[dict] = []
    add = lambda level, text: f.append({"level": level, "text": text})
    r = comp.get("cfo_to_pat_5y")
    if r is not None and not is_fin:
        if r < 0.7:
            add("bad", f"CFO/PAT over 5y is {r:.2f} — profits not turning into cash")
        elif r < 0.9:
            add("watch", f"CFO/PAT over 5y is {r:.2f} — cash conversion a bit soft")
        else:
            add("good", f"CFO/PAT over 5y is {r:.2f} — profits backed by cash")
    fcf = comp.get("fcf_5y_cr")
    if fcf is not None and not is_fin and fcf < 0:
        add("watch", f"Cumulative 5y free cash flow is ₹{fcf:,.0f} Cr — growth is consuming cash")
    de = comp.get("de_ratio")
    if de is not None and not is_fin:
        if de > 1.0:
            add("bad", f"Debt/equity is {de:.2f} — leveraged balance sheet")
        elif de > 0.5:
            add("watch", f"Debt/equity is {de:.2f}")
        elif de < 0.1:
            add("good", f"Debt/equity is {de:.2f} — virtually debt-free")
    if comp.get("debt_trend") == "rising" and not is_fin and len(annual) >= 4:
        a, b = annual[-4]["debt"], annual[-1]["debt"]
        if a is not None and b is not None:
            add("watch", f"Borrowings rose from ₹{a:,.0f} Cr to ₹{b:,.0f} Cr over 3 years")
    g5, p5 = comp.get("revenue_cagr_5y"), comp.get("pat_cagr_5y")
    if g5 is not None:
        if g5 >= 15:
            add("good", f"Revenue 5y CAGR is {g5:.1f}%")
        elif g5 < 5:
            add("watch", f"Revenue 5y CAGR is only {g5:.1f}%")
    if g5 is not None and p5 is not None and p5 < g5 - 5:
        add("watch", f"PAT 5y CAGR {p5:.1f}% lags revenue CAGR {g5:.1f}% — margins leaking")
    opm = [r["opm"] for r in annual if r["opm"] is not None]
    if comp["opm_trend"] != "stable" and len(opm) >= 4 and not is_fin:
        lvl = "good" if comp["opm_trend"] == "expanding" else "watch"
        add(lvl, f"Operating margin {comp['opm_trend']}: {opm[-4]:.0f}% → {opm[-1]:.0f}% over 3 years")
    ccc = c.ratios.get("Cash Conversion Cycle")
    ccc = [x for x in (ccc or []) if x is not None]
    if comp.get("ccc_trend") == "lengthening":
        add("watch", f"Cash conversion cycle lengthened from {ccc[-4]:.0f} to {ccc[-1]:.0f} days")
    elif comp.get("ccc_trend") == "shortening":
        add("good", f"Cash conversion cycle shortened from {ccc[-4]:.0f} to {ccc[-1]:.0f} days")
    roce = c.top.get("ROCE")
    if roce is not None and not is_fin:
        if roce >= 20:
            add("good", f"ROCE is {roce:.1f}%")
        elif roce < 10:
            add("watch", f"ROCE is {roce:.1f}% — below cost of capital")
    roe = c.top.get("ROE")
    if roe is not None and is_fin:
        add("good" if roe >= 15 else "watch", f"ROE is {roe:.1f}%" + ("" if roe >= 15 else " — below 15% for a lender"))
    prom = c.shareholding.get("Promoters")
    prom = [x for x in (prom or []) if x is not None]
    if len(prom) >= 5 and prom[-5] - prom[-1] >= 2:
        add("watch", f"Promoter holding fell from {prom[-5]:.1f}% to {prom[-1]:.1f}% in 4 quarters")
    q = fin.quarter_rows(c.quarters)
    if len(q) >= 5 and q[-1]["pat"] is not None and q[-5]["pat"] not in (None, 0):
        yoy = fin.pct(q[-1]["pat"], q[-5]["pat"])
        if yoy <= -15:
            add("bad", f"Latest quarter PAT down {abs(yoy):.1f}% YoY ({q[-1]['period']})")
        elif yoy >= 20:
            add("good", f"Latest quarter PAT up {yoy:.1f}% YoY ({q[-1]['period']})")
    return f


def build(symbol: str, c: Company | None = None, series: list | None = None) -> dict:
    c = c or company(symbol)
    series = series if series is not None else price_series(c.company_id)
    annual = fin.annual_rows(c)
    comp = compute(c, annual)
    is_fin = fin.ebitda_label(c.quarters) == "Financing Profit"
    close = series[-1][1] if series else c.top.get("Current Price")
    chg = fin.pct(series[-1][1], series[-2][1]) if len(series) >= 2 else 0.0
    return {
        "symbol": symbol, "name": c.name,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "about": c.about, "sector": c.sector,
        "price": {
            "close": close, "change_pct": chg, "mcap_cr": c.top.get("Market Cap"),
            "pe": c.top.get("Stock P/E"), "roce": c.top.get("ROCE"), "roe": c.top.get("ROE"),
        },
        "quarters": fin.quarter_rows(c.quarters)[-12:],
        "annual": annual,
        "computed": comp,
        "flags": flags(c, annual, comp, is_fin),
        "sources": c.sources,
    }


def write(symbol: str, **kw) -> Path:
    d = build(symbol, **kw)
    path = OUT / "dossier" / f"{symbol}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(d, ensure_ascii=False, indent=1))
    return path
