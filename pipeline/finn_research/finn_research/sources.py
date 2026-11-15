"""Primary-source fetch: screener.in page (quarters + concall links) and transcript PDFs."""
import hashlib
import re
import subprocess
import threading
import time

import requests
from bs4 import BeautifulSoup

from .paths import PDF_CACHE, SCREENER_CACHE

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
_last = [0.0]
_net_lock = threading.Lock()
MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def _polite_get(url, **kw):
    with _net_lock:  # ~1 request/second across all worker threads
        gap = time.time() - _last[0]
        if gap < 1.0:
            time.sleep(1.0 - gap)
        _last[0] = time.time()
    headers = {"User-Agent": UA, **kw.pop("headers", {})}
    return requests.get(url, headers=headers, timeout=60, **kw)


def screener_page(symbol: str, max_age_h: float = 24):
    SCREENER_CACHE.mkdir(parents=True, exist_ok=True)
    for variant, url in (("consolidated", f"https://www.screener.in/company/{symbol}/consolidated/"),
                         ("standalone", f"https://www.screener.in/company/{symbol}/")):
        p = SCREENER_CACHE / f"{symbol}_{variant}.html"
        if p.exists() and time.time() - p.stat().st_mtime < max_age_h * 3600:
            html = p.read_text()
        else:
            r = _polite_get(url)
            if r.status_code != 200:
                continue
            html = r.text
            p.write_text(html)
        soup = BeautifulSoup(html, "lxml")
        q = parse_quarters(soup)
        if q["rows"]:
            return soup, q, variant
    raise RuntimeError(f"screener.in has no quarterly data for {symbol}")


def parse_quarters(soup):
    sec = soup.find("section", id="quarters")
    tbl = sec.find("table") if sec else None
    if not tbl:
        return {"periods": [], "rows": {}}
    periods = [th.get_text(strip=True) for th in tbl.find("thead").find_all("th")][1:]
    rows = {}
    for tr in tbl.find("tbody").find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        name = re.sub(r"\s*\+\s*$", "", tds[0].get_text(" ", strip=True)).strip()
        if not name or name.lower().startswith("raw pdf"):
            continue
        rows[name] = [td.get_text(strip=True) for td in tds[1:]]
    return {"periods": periods, "rows": rows}


def quarters_table_text(q, last_n=10):
    per = q["periods"][-last_n:]
    out = ["Metric | " + " | ".join(per)]
    for name, vals in q["rows"].items():
        out.append(f"{name} | " + " | ".join(vals[-last_n:]))
    return "\n".join(out) + "\n(Rs crore except %, EPS in Rs; columns are quarter-ends)"


def call_quarter(label: str) -> str:
    """'Jul 2026' concall discusses the quarter ended Jun 2026 = Q1 FY27."""
    m = re.match(r"([A-Z][a-z]{2})\w*\s+(\d{4})", label.strip())
    if not m:
        return label
    mon, yr = MONTHS[m.group(1)], int(m.group(2))
    if mon <= 3:
        return f"Q3 FY{yr % 100:02d}"
    if mon <= 6:
        return f"Q4 FY{yr % 100:02d}"
    if mon <= 9:
        return f"Q1 FY{(yr + 1) % 100:02d}"
    return f"Q2 FY{(yr + 1) % 100:02d}"


def concall_docs(soup, n=4):
    """Return up to n most-recent [{label, quarter, url, kind}] — transcript preferred, PPT as fallback."""
    box = soup.select_one("div.documents.concalls")
    out = []
    if not box:
        return out
    for li in box.find_all("li"):
        lab = li.find("div")
        label = lab.get_text(strip=True) if lab else ""
        links = {a.get_text(strip=True): a.get("href") for a in li.find_all("a") if a.get("href")}
        if links.get("Transcript"):
            out.append({"label": label, "quarter": call_quarter(label), "url": links["Transcript"], "kind": "concall"})
        elif links.get("PPT"):
            out.append({"label": label, "quarter": call_quarter(label), "url": links["PPT"], "kind": "investor presentation"})
    return out[:n]


def fetch_pdf_text(url: str) -> str:
    PDF_CACHE.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha1(url.encode()).hexdigest()
    pdf, txt = PDF_CACHE / f"{h}.pdf", PDF_CACHE / f"{h}.txt"
    if txt.exists():
        return txt.read_text()
    if not pdf.exists():
        headers = {"Referer": "https://www.bseindia.com/"} if "bseindia" in url else {}
        r = _polite_get(url, headers=headers)
        if r.status_code != 200 or not r.content.startswith(b"%PDF"):
            raise RuntimeError(f"HTTP {r.status_code}, not a PDF")
        pdf.write_bytes(r.content)
    try:
        text = subprocess.run(["pdftotext", "-q", str(pdf), "-"], capture_output=True, text=True, timeout=120).stdout
    except (FileNotFoundError, subprocess.TimeoutExpired):
        text = ""
    if len(text.strip()) < 500:
        from pypdf import PdfReader
        text = "\n".join((p.extract_text() or "") for p in PdfReader(str(pdf)).pages)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 500:
        raise RuntimeError("no extractable text (scanned PDF?)")
    txt.write_text(text)
    return text
