"""Download first 4 unique concall transcripts per symbol from screener #documents, extract text."""
import sys, re, time, subprocess, os, urllib.request
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
def get(url):
    r = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.bseindia.com/"})
    return urllib.request.urlopen(r, timeout=60).read()
for sym in sys.argv[1:]:
    s = open(f"raw/{sym}.html").read()
    doc = s[s.find('id="documents"'):]; cc = doc[doc.find("Concalls"):]
    items = re.findall(r'<div[^>]*>\s*(\w{3} \d{4})\s*</div>(.*?)(?=<div[^>]*>\s*\w{3} \d{4}\s*</div>|</ul>)', cc, re.S)
    seen, n = set(), 0
    for date, body in items:
        m = re.search(r'href="([^"]+)"[^>]*>\s*Transcript', body)
        if not m or m.group(1) in seen: continue
        seen.add(m.group(1)); n += 1
        out = f"raw/{sym}_{n}_{date.replace(' ','')}"
        if not os.path.exists(out + ".txt"):
            open(out + ".pdf", "wb").write(get(m.group(1))); time.sleep(1)
            subprocess.run(["pdftotext", "-layout", out + ".pdf", out + ".txt"])
        print(sym, n, date, m.group(1), os.path.getsize(out + ".txt"))
        if n == 4: break
