"""Split extracted transcripts into ~160-word chunks -> web/public/data/research/{SYM}.chunks.json"""
import sys, re, json, glob
QMAP = {"Oct2026": "Q2 FY27", "Nov2026": "Q2 FY27", "Jul2026": "Q1 FY27", "Aug2026": "Q1 FY27",
        "May2026": "Q4 FY26", "Jan2026": "Q3 FY26", "Feb2026": "Q3 FY26"}
OUT = "../../web/public/data/research"
for sym in sys.argv[1:]:
    chunks = []
    for f in sorted(glob.glob(f"raw/{sym}_?_*.txt")):
        q = QMAP[f.rsplit("_", 1)[1][:-4]]
        t = open(f).read()
        # drop cover letter (before Moderator) and page furniture
        i = t.find("Moderator:")
        if i > 0: t = t[i:]
        lines = [l.strip() for l in t.splitlines()]
        lines = [l for l in lines if l and not re.match(r"^(Page \d+ of \d+|\d+)$", l)]
        words = re.sub(r"\s+", " ", " ".join(lines)).split(" ")
        # split on sentence boundaries near 160 words
        cur = []
        for w in words:
            cur.append(w)
            if (len(cur) >= 150 and w.endswith((".", "?"))) or len(cur) >= 200:
                chunks.append((q, " ".join(cur))); cur = []
        if len(cur) > 30: chunks.append((q, " ".join(cur)))
    chunks = chunks[:400]
    out = {"symbol": sym, "chunks": [{"id": f"{sym}-{q.replace(' ', '')}-{i:03d}", "source": f"{q} concall", "quarter": q, "text": t}
                                     for i, (q, t) in enumerate(chunks)]}
    json.dump(out, open(f"{OUT}/{sym}.chunks.json", "w"), ensure_ascii=False)
    from collections import Counter; print(sym, len(chunks), Counter(q for q, _ in chunks))
