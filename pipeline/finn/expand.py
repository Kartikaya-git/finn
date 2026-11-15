"""Add companies to FINN on demand: `python -m finn.expand SYM [SYM ...]`.

Builds each company's Dossier and registers it in tickers.json (and pipeline/indexed_extra.json,
so the scheduled Brief rebuild keeps it). Used by the "Build it" GitHub workflow and for bulk indexing.
"""
from __future__ import annotations

import json
import sys
import time

from . import dossier
from .__main__ import OUT, now_iso
from .screener import company, price_series

EXTRA = OUT.parent.parent.parent / "pipeline" / "indexed_extra.json"


def register(sym: str, name: str) -> None:
    tk_path = OUT / "tickers.json"
    tk = json.loads(tk_path.read_text())
    if not any(t["symbol"] == sym for t in tk["tickers"]):
        tk["tickers"].append({"symbol": sym, "name": name, "kind": ["indexed"]})
        tk["generated_at"] = now_iso()
        tk_path.write_text(json.dumps(tk, ensure_ascii=False, indent=1))
    extra = json.loads(EXTRA.read_text()) if EXTRA.exists() else []
    if not any(t["symbol"] == sym for t in extra):
        extra.append({"symbol": sym, "name": name, "kind": ["indexed"]})
        EXTRA.write_text(json.dumps(extra, ensure_ascii=False, indent=1))


def main(syms: list[str]) -> int:
    failed = []
    print(f"indexing {len(syms)} companies", flush=True)
    for i, sym in enumerate(syms, 1):
        sym = sym.upper().strip()
        t0 = time.time()
        try:
            c = company(sym)
            dossier.write(sym, c=c, series=price_series(c.company_id))
            register(sym, c.name)
            print(f"index {i}/{len(syms)} {sym} ok ({time.time() - t0:.1f}s)", flush=True)
        except Exception as e:  # keep going
            failed.append(sym)
            print(f"index {i}/{len(syms)} {sym} FAILED: {type(e).__name__}: {e}", flush=True)
    print(f"done; failed: {failed or 'none'}", flush=True)
    return 1 if failed and len(failed) == len(syms) else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
