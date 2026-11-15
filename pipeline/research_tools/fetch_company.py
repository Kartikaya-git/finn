"""Fetch screener company page; print concall links and quarters table."""
import sys, re, time, urllib.request, html
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
def get(url, ref=None):
    h = {"User-Agent": UA}
    if ref: h["Referer"] = ref
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30).read()
if __name__ == "__main__":
    for sym in sys.argv[1:]:
        p = f"raw/{sym}.html"
        try: s = open(p).read()
        except FileNotFoundError:
            s = get(f"https://www.screener.in/company/{sym}/consolidated/").decode(); open(p, "w").write(s); time.sleep(1)
        cid = re.search(r'data-company-id="(\d+)"', s).group(1)
        print("==", sym, cid)
        doc = s[s.find('id="documents"'):]
        cc = doc[doc.find("Concalls"):][:6000]
        print(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " | ", cc))[:1500])
        for m in re.finditer(r'href="([^"]+)"[^>]*>\s*Transcript', cc): print("T", m.group(1))
