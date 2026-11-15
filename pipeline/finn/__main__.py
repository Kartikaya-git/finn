"""CLI: `python -m finn build` | `python -m finn dossier SYMBOL`."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone

from . import brief, dossier
from .screener import NotFound, announcements, company, price_series

OUT = dossier.OUT

HOLDINGS = ["RELIANCE", "HDFCBANK", "INFY", "ITC", "LT", "BAJFINANCE", "ASIANPAINT", "TITAN", "SUNPHARMA", "MARUTI",
            "DMART", "ETERNAL", "POLYCAB", "DIXON", "KPITTECH", "IRCTC", "TRENT", "DEEPAKNTR", "CDSL", "HAL"]
RESEARCH = ["POLYCAB", "KPITTECH", "DIXON", "PIDILITIND"]
NIFTY50 = ["ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV",
           "BEL", "BHARTIARTL", "CIPLA", "COALINDIA", "DRREDDY", "EICHERMOT", "ETERNAL", "GRASIM", "HCLTECH", "HDFCBANK",
           "HDFCLIFE", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDIGO", "INFY", "ITC", "JIOFIN", "JSWSTEEL", "KOTAKBANK",
           "LT", "M&M", "MARUTI", "MAXHEALTH", "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SBIN",
           "SHRIRAMFIN", "SUNPHARMA", "TATACONSUM", "TMPV", "TATASTEEL", "TCS", "TECHM", "TITAN", "TRENT", "ULTRACEMCO",
           "WIPRO"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def universe() -> dict[str, list[str]]:
    kinds: dict[str, list[str]] = {}
    for kind, syms in (("holding", HOLDINGS), ("research", RESEARCH), ("indexed", NIFTY50)):
        for s in syms:
            kinds.setdefault(s, [])
            if kind not in kinds[s]:
                kinds[s].append(kind)
    return kinds


def build() -> None:
    kinds = universe()
    order = HOLDINGS + [s for s in RESEARCH if s not in HOLDINGS] + [s for s in NIFTY50 if s not in HOLDINGS and s not in RESEARCH]
    print(f"building {len(order)} companies ({len(HOLDINGS)} holdings); cache at pipeline/.cache/", flush=True)
    tickers, holdings, failed = [], [], []
    for i, sym in enumerate(order, 1):
        t0 = time.time()
        try:
            c = company(sym)
            series = price_series(c.company_id)
            dossier.write(sym, c=c, series=series)
            note = ""
            if "holding" in kinds[sym]:
                raw = announcements(c.company_id)
                h = brief.holding_entry(c, series, raw)
                holdings.append(h)
                cards = sum(f["tier"] == "card" for f in h["filings"])
                note = f", {len(h['filings'])} filings / {cards} cards"
            tickers.append({"symbol": sym, "name": c.name, "kind": kinds[sym]})
            print(f"dossier {i}/{len(order)} {sym} ok ({time.time() - t0:.1f}s{note})", flush=True)
        except (NotFound, Exception) as e:  # keep going; report at end
            failed.append(sym)
            print(f"dossier {i}/{len(order)} {sym} FAILED: {type(e).__name__}: {e}", flush=True)
    (OUT / "tickers.json").write_text(json.dumps({"generated_at": now_iso(), "tickers": tickers}, ensure_ascii=False, indent=1))
    (OUT / "brief.json").write_text(json.dumps({"generated_at": now_iso(), "holdings": holdings}, ensure_ascii=False, indent=1))
    print(f"wrote brief.json ({len(holdings)} holdings), tickers.json ({len(tickers)}), failed: {failed or 'none'}")


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in ("build", "dossier"):
        print(__doc__)
        return 2
    if argv[0] == "build":
        build()
        return 0
    if len(argv) < 2:
        print("usage: python -m finn dossier SYMBOL")
        return 2
    print(dossier.write(argv[1].upper()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
