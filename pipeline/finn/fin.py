"""Turn parsed screener tables into contract-shaped financial rows."""
from __future__ import annotations

from .screener import Company, Table

REV = ("Sales", "Revenue")
EBITDA = ("Operating Profit", "Financing Profit")
OPM = ("OPM %", "Financing Margin %")
PBT = ("Profit before tax",)
PAT = ("Net Profit", "Profit after tax")


def ebitda_label(t: Table) -> str:
    return "Financing Profit" if t.which(*EBITDA) == "Financing Profit" else "EBITDA"


def _at(row, i):
    if row is None or i >= len(row):
        return None
    return row[i]


def quarter_rows(t: Table) -> list[dict]:
    rev, eb, opm, pbt, pat = t.get(*REV), t.get(*EBITDA), t.get(*OPM), t.get(*PBT), t.get(*PAT)
    out = []
    for i, col in enumerate(t.cols):
        out.append({
            "period": col,
            "revenue": _at(rev, i), "ebitda": _at(eb, i), "pbt": _at(pbt, i),
            "pat": _at(pat, i), "opm": _at(opm, i),
        })
    return [r for r in out if r["revenue"] is not None or r["pat"] is not None]


def _by_col(t: Table, labels) -> dict[str, float | None]:
    row = t.get(*labels)
    if row is None:
        return {}
    return {c: _at(row, i) for i, c in enumerate(t.cols)}


def annual_rows(c: Company) -> list[dict]:
    pl = c.pl
    rev, eb, opm, pat = (_by_col(pl, x) for x in (REV, EBITDA, OPM, PAT))
    cfo = _by_col(c.cf, ("Cash from Operating Activity",))
    fcf = _by_col(c.cf, ("Free Cash Flow",))
    debt = _by_col(c.bs, ("Borrowings", "Borrowing"))
    eqc = _by_col(c.bs, ("Equity Capital",))
    res = _by_col(c.bs, ("Reserves",))
    out = []
    for col in pl.cols:
        if col.upper().startswith("TTM"):
            continue
        cf_, fc_ = cfo.get(col), fcf.get(col)
        capex = round(cf_ - fc_, 2) if cf_ is not None and fc_ is not None else None
        eq = None
        if eqc.get(col) is not None or res.get(col) is not None:
            eq = (eqc.get(col) or 0) + (res.get(col) or 0)
        out.append({
            "year": col, "revenue": rev.get(col), "ebitda": eb.get(col), "pat": pat.get(col), "opm": opm.get(col),
            "cfo": cf_, "capex": capex, "fcf": fc_, "debt": debt.get(col), "equity": eq,
        })
    return [r for r in out if r["revenue"] is not None or r["pat"] is not None]


def pct(cur, prev) -> float:
    if cur is None or prev is None or prev == 0:
        return 0.0
    return round((cur - prev) / abs(prev) * 100, 1)
