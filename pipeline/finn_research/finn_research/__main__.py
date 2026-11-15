"""uv run python -m finn_research SYMBOL [SYMBOL...]"""
import argparse
import json
import sys
import time

from . import llm
from .engine import build_chunks, research
from .paths import OUT_DIR, PROTECTED
from .sources import concall_docs, fetch_pdf_text, quarters_table_text, screener_page


def run_one(symbol):
    soup, q, variant = screener_page(symbol)
    docs = []
    for d in concall_docs(soup, n=4):
        src = f"{d['quarter']} {d['kind']}"
        try:
            text = fetch_pdf_text(d["url"])
            docs.append({**d, "source": src, "text": text})
            print(f"    fetched {src} ({len(text.split())} words)", flush=True)
        except Exception as e:
            print(f"    skipped {src}: {e}", flush=True)
    if not docs:
        raise RuntimeError("no concall transcripts or presentations could be fetched")
    chunks = build_chunks(symbol, docs)
    note, qstats = research(symbol, docs, quarters_table_text(q), variant)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / f"{symbol}.json").write_text(json.dumps(note, indent=2, ensure_ascii=False))
    (OUT_DIR / f"{symbol}.chunks.json").write_text(json.dumps(chunks, ensure_ascii=False))
    kinds = sum(1 for d in docs if d["kind"] == "concall")
    return f"{kinds} transcripts + {len(docs)-kinds} presentations, {len(chunks['chunks'])} chunks, " \
           f"quotes {qstats['kept']} verified / {qstats['dropped']} dropped"


def main(argv=None):
    ap = argparse.ArgumentParser(prog="finn_research")
    ap.add_argument("symbols", nargs="+")
    ap.add_argument("--force", action="store_true", help="allow overwriting hand-written research set")
    a = ap.parse_args(argv)
    syms = [s.upper() for s in a.symbols]
    print(f"research: {len(syms)} companies, MAP={llm.MAP_MODEL}, REDUCE={llm.REDUCE_MODEL}", flush=True)
    ok, failed = [], []
    for i, s in enumerate(syms, 1):
        if s in PROTECTED and not a.force:
            print(f"research {i}/{len(syms)} {s} skipped (hand-written research set; --force to override)", flush=True)
            continue
        t0 = time.time()
        print(f"research {i}/{len(syms)} {s} starting", flush=True)
        try:
            info = run_one(s)
            ok.append(s)
            print(f"research {i}/{len(syms)} {s} ok ({info}, {time.time()-t0:.0f}s)", flush=True)
        except Exception as e:
            failed.append((s, str(e)))
            print(f"research {i}/{len(syms)} {s} FAILED ({e}, {time.time()-t0:.0f}s)", flush=True)
    print(f"\ndone: {len(ok)} ok, {len(failed)} failed", flush=True)
    for s, e in failed:
        print(f"  {s}: {e}")
    print(llm.usage_summary(), flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
