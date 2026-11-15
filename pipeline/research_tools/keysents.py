import sys, re, json
d = json.load(open(f"../../web/public/data/research/{sys.argv[1]}.chunks.json"))
pat = re.compile(sys.argv[2], re.I)
lim = int(sys.argv[3]) if len(sys.argv) > 3 else 400
for c in d["chunks"]:
    for s in re.split(r"(?<=[.?])\s+", c["text"]):
        if pat.search(s) and len(s) < lim: print(f"[{c['quarter']}] {s}")
