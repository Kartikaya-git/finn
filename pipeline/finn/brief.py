"""Brief: per-Holding price series + classified Filings (last 30 days)."""
from __future__ import annotations

import calendar
import hashlib
import re
from datetime import date, datetime

from . import fin
from .classify import classify
from .screener import Company


def _quarter_end(label: str) -> date | None:
    try:
        d = datetime.strptime(label.strip(), "%b %Y")
    except ValueError:
        return None
    return date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])


def results_block(c: Company, filing_ts: str) -> dict | None:
    """Latest quarter vs previous quarter and same quarter last year, if the
    latest column is the quarter this Filing plausibly reports."""
    q = fin.quarter_rows(c.quarters)
    if len(q) < 5:
        return None
    cur, pq, py = q[-1], q[-2], q[-5]
    qe = _quarter_end(cur["period"])
    fd = datetime.fromisoformat(filing_ts).date()
    if qe is None or not (0 <= (fd - qe).days <= 75):
        return None
    rows = []
    for metric, key in (("Revenue", "revenue"), ("EBITDA", "ebitda"), ("PBT", "pbt"), ("PAT", "pat")):
        if cur[key] is None:
            continue
        rows.append({
            "metric": metric, "cur": cur[key], "prev_q": pq[key], "prev_y": py[key],
            "qoq": fin.pct(cur[key], pq[key]), "yoy": fin.pct(cur[key], py[key]),
        })
    return {"period": cur["period"], "unit": "₹ Cr", "ebitda_label": fin.ebitda_label(c.quarters), "rows": rows}


def holding_entry(c: Company, series: list, raw_filings: list[dict]) -> dict:
    annual = fin.annual_rows(c)
    annual_rev = annual[-1]["revenue"] if annual else None
    filings = []
    for f in raw_filings:  # newest first
        cat, tier, why = classify(f["title"], f["summary"], annual_revenue_cr=annual_rev)
        filings.append({
            "id": hashlib.sha1(f["url"].encode()).hexdigest()[:12],
            "symbol": c.symbol, "title": f["title"], "summary": f["summary"], "url": f["url"],
            "ts": f["ts"], "category": cat, "tier": tier, "why": why,
        })
    # One results Card per Holding: prefer the primary results Filing over
    # newspaper copies / presentations, then the earliest (the actual declaration).
    rc = [x for x in filings if x["category"] == "results" and x["tier"] == "card"]
    secondary = re.compile(r"newspaper|presentation|media statement|press release", re.I)
    rc.sort(key=lambda x: (bool(secondary.search(x["title"])), x["ts"]))
    if rc:
        block = results_block(c, rc[0]["ts"])
        if block:
            rc[0]["results"] = block
        else:
            rc[0]["tier"], rc[0]["why"] = "routine", "Results filing, numbers not yet on screener"
        for x in rc[1:]:
            x["tier"], x["why"] = "routine", "Same results, already carded"
    return {"symbol": c.symbol, "name": c.name, "sector": c.sector, "series": series[-90:], "filings": filings}
