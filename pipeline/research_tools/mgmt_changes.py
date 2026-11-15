"""Scan screener announcements for 20 Holdings; list management-change filings in last 30 days."""
import urllib.error, re, time, json, html, os, urllib.request
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
HOLD = "RELIANCE HDFCBANK INFY ITC LT BAJFINANCE ASIANPAINT TITAN SUNPHARMA MARUTI DMART ETERNAL POLYCAB DIXON KPITTECH IRCTC TRENT DEEPAKNTR CDSL HAL".split()
KW = re.compile(r"appoint|resign|cessation|ceas|change in (director|management|kmp|key)|key managerial|company secretary|chief (executive|financial)|managing director|retire|re-?designat", re.I)
def get(u):
    for i in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=30).read().decode()
            time.sleep(2); return r
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            print(f"429 on {u}, waiting {10*(i+1)}s", flush=True); time.sleep(10*(i+1))
    raise RuntimeError(u)
out = []
for s in HOLD:
    p = f"raw/{s}.html"
    if not os.path.exists(p):
        h = get(f"https://www.screener.in/company/{s}/consolidated/"); open(p, "w").write(h)
    cid = re.search(r'data-company-id="(\d+)"', open(p).read()).group(1)
    a = f"raw/{s}_ann.html"
    if not os.path.exists(a):
        h = get(f"https://www.screener.in/announcements/recent/{cid}/"); open(a, "w").write(h)
    for li in re.findall(r"<li[^>]*>(.*?)</li>", open(a).read(), re.S):
        href = re.search(r'href="([^"]+)"', li); t = re.search(r'datetime="([^"]+)"', li)
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", li))).strip()
        if href and t and t.group(1) >= "2026-10-16" and KW.search(text):
            out.append({"symbol": s, "url": href.group(1), "ts": t.group(1), "text": text[:400]})
json.dump(out, open("raw/mgmt_candidates.json", "w"), indent=1)
for o in out: print(o["symbol"], o["ts"][:10], o["url"], "|", o["text"][:260])
