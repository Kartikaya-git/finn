"""MAP (cheap, per document) -> REDUCE (strong, per company)."""
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from . import llm
from .chunk import chunk_words

MAX_DOC_CHARS = 160_000
MAX_CHUNKS = 400

MAP_PROMPT = """You are extracting facts from ONE primary-source document of {symbol} ({source}).
Use ONLY the document text below. No outside knowledge. Every "quote" must be copied
character-for-character from the document (a short contiguous span, 8-40 words) — quotes that
are not exact substrings will be discarded.

Return JSON:
{{"guidance": [{{"metric": str, "statement": str, "quote": str, "horizon": str}}],
  "claims":   [{{"claim": str, "quote": str}}],
  "segments": [{{"name": str, "share_pct": number|null}}]}}

- guidance: forward-looking targets/commitments by management (growth, margin, capex, launches,
  capacity, debt) — up to 8, most concrete first. horizon e.g. "FY27", "next 2-3 years", "Q3 FY27".
- claims: management's characterisations of performance that numbers could confirm or refute
  (e.g. "demand recovered", "margins expanded") — up to 6.
- segments: business segments with revenue share % if stated, else null — up to 6.

DOCUMENT:
<<<
{text}
>>>"""

REDUCE_PROMPT = """You are an equity research analyst writing a grounded research note on {symbol}.
STRICT RULES: use ONLY the primary-source extracts and the quarterly numbers table below.
Do NOT use outside knowledge, news, or memory of this company. If the data cannot support a
point, say so or mark it pending. Every number you cite must appear in the table or extracts.

QUARTERLY NUMBERS (screener.in, {variant}):
{table}

EXTRACTS FROM MANAGEMENT DOCUMENTS (oldest -> newest):
{extracts}

Return JSON exactly in this shape:
{{"business": {{"summary": str (2-3 sentences, from the extracts), "segments": [{{"name": str, "share_pct": number|null}}]}},
 "promises": [{{"quarter": str, "promise": str, "source": str, "delivered": str, "verdict": "kept"|"partly"|"missed"|"pending"}}],
 "narrative_vs_numbers": [{{"claim": str, "numbers": str, "agrees": bool}}],
 "guidance": [{{"metric": str, "guide": str, "source": str}}],
 "bull": [str, str, str], "bear": [str, str, str]}}

- promises: 4-7 items, taken from the EARLIER documents. "delivered" must cite actual figures
  from the table (with quarter labels, e.g. "Sales Rs 5,906 cr in Sep 2026 vs Rs 5,498 cr in Jun 2026")
  or what a LATER document says. If the horizon has not yet passed, verdict "pending".
  "source" = the document label given, e.g. "Q4 FY26 concall".
- narrative_vs_numbers: 3-5 claims checked against the table; "numbers" quotes the figures.
- guidance: currently outstanding guidance from the most recent documents (3-6 items).
- bull / bear: exactly 3 each, each anchored in a figure or a management statement above."""


def _norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip().lower()


def map_doc(symbol, doc):
    text = doc["text"][:MAX_DOC_CHARS]
    out = llm.generate_json(llm.MAP_MODEL, MAP_PROMPT.format(symbol=symbol, source=doc["source"], text=text),
                            tag=f"map {doc['source']}")
    hay = _norm(text)
    kept = dropped = 0
    res = {"source": doc["source"], "quarter": doc["quarter"], "guidance": [], "claims": [], "segments": []}
    for key in ("guidance", "claims"):
        for item in (out.get(key) or []):
            q = item.get("quote") or ""
            if q and _norm(q) in hay:
                res[key].append(item); kept += 1
            else:
                dropped += 1
    res["segments"] = [s for s in (out.get("segments") or []) if isinstance(s, dict) and s.get("name")]
    res["_quotes"] = {"kept": kept, "dropped": dropped}
    return res


def build_chunks(symbol, docs):
    chunks = []
    for d in docs:
        for i, c in enumerate(chunk_words(d["text"])):
            chunks.append({"id": f"{symbol}-{d['quarter'].replace(' ', '')}-{i:03d}",
                           "source": d["source"], "quarter": d["quarter"], "text": c})
    # keep the newest documents whole if we have to cap (docs are newest-first)
    return {"symbol": symbol, "chunks": chunks[:MAX_CHUNKS]}


def research(symbol, docs, quarters_text, variant):
    with ThreadPoolExecutor(max_workers=4) as ex:
        maps = list(ex.map(lambda d: map_doc(symbol, d), docs))
    maps = list(reversed(maps))  # oldest -> newest
    extracts = json.dumps([{k: v for k, v in m.items() if k != "_quotes"} for m in maps], ensure_ascii=False, indent=1)
    red = llm.generate_json(llm.REDUCE_MODEL,
                            REDUCE_PROMPT.format(symbol=symbol, variant=variant, table=quarters_text, extracts=extracts),
                            tag="reduce")
    verdicts = {"kept", "partly", "missed", "pending"}
    biz = red.get("business") or {}
    out = {
        "symbol": symbol,
        "model": f"{llm.MAP_MODEL} (extract) → {llm.REDUCE_MODEL} (reconcile)",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "business": {"summary": biz.get("summary", ""),
                     "segments": [{"name": s.get("name"), "share_pct": s.get("share_pct")}
                                  for s in (biz.get("segments") or []) if isinstance(s, dict)]},
        "promises": [{"quarter": p.get("quarter", ""), "promise": p.get("promise", ""), "source": p.get("source", ""),
                      "delivered": p.get("delivered", ""),
                      "verdict": p.get("verdict") if p.get("verdict") in verdicts else "pending"}
                     for p in (red.get("promises") or [])],
        "narrative_vs_numbers": [{"claim": n.get("claim", ""), "numbers": n.get("numbers", ""), "agrees": bool(n.get("agrees"))}
                                 for n in (red.get("narrative_vs_numbers") or [])],
        "guidance": [{"metric": g.get("metric", ""), "guide": g.get("guide", ""), "source": g.get("source", "")}
                     for g in (red.get("guidance") or [])],
        "bull": [str(b) for b in (red.get("bull") or [])][:3],
        "bear": [str(b) for b in (red.get("bear") or [])][:3],
    }
    qstats = {"kept": sum(m["_quotes"]["kept"] for m in maps), "dropped": sum(m["_quotes"]["dropped"] for m in maps)}
    return out, qstats
