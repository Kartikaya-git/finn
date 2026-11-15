"""Screener.in client: polite fetch with on-disk cache, plus table/section parsers.

Every network response is cached under pipeline/.cache/ keyed by URL, so reruns
are instant and the site sees at most ~1 request/second from us.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

BASE = "https://www.screener.in"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
CACHE = Path(__file__).resolve().parent.parent / ".cache"
MIN_INTERVAL = 1.0  # seconds between real network requests

_session = requests.Session()
_session.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
_last_hit = 0.0


class NotFound(Exception):
    pass


def fetch(url: str, max_age_h: float = 12.0) -> str:
    """GET url (text), served from cache if younger than max_age_h."""
    global _last_hit
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha1(url.encode()).hexdigest()[:20] + ".txt")
    if path.exists() and (time.time() - path.stat().st_mtime) < max_age_h * 3600:
        return path.read_text()
    for attempt in range(3):
        wait = MIN_INTERVAL - (time.time() - _last_hit)
        if wait > 0:
            time.sleep(wait)
        _last_hit = time.time()
        r = _session.get(url, timeout=30)
        if r.status_code == 404:
            raise NotFound(url)
        if r.status_code == 429:
            pause = 10 * (attempt + 1)
            print(f"  rate-limited on {url}, waiting {pause}s", flush=True)
            time.sleep(pause)
            continue
        r.raise_for_status()
        path.write_text(r.text)
        return r.text
    raise RuntimeError(f"gave up on {url}")


# ---------- number parsing ----------

def num(s: str | None) -> float | None:
    """'1,23,456' -> 123456.0, '12%' -> 12.0, '' -> None."""
    if s is None:
        return None
    s = s.replace(",", "").replace("%", "").replace("₹", "").strip()
    if s in ("", "-", "--"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _label(td) -> str:
    t = td.get_text(" ", strip=True)
    return re.sub(r"\s*\+$", "", t).strip()


@dataclass
class Table:
    cols: list[str]                       # column headers, e.g. "Sep 2026", "Mar 2026", "TTM"
    rows: dict[str, list[float | None]]   # label -> values aligned with cols

    def get(self, *labels: str) -> list[float | None] | None:
        for lab in labels:
            for k, v in self.rows.items():
                if k.lower() == lab.lower():
                    return v
        return None

    def which(self, *labels: str) -> str | None:
        for lab in labels:
            for k in self.rows:
                if k.lower() == lab.lower():
                    return k
        return None

    @property
    def empty(self) -> bool:
        return not self.cols or not any(any(x is not None for x in v) for v in self.rows.values())


def parse_table(soup: BeautifulSoup, section_id: str) -> Table:
    t = soup.select_one(f"section#{section_id} table")
    if t is None:
        return Table([], {})
    cols = [th.get_text(" ", strip=True) for th in t.select("thead th")][1:]
    rows: dict[str, list[float | None]] = {}
    for tr in t.select("tbody tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        lab = _label(tds[0])
        if not lab or lab in rows:
            continue
        rows[lab] = [num(td.get_text(strip=True)) for td in tds[1:]]
    return Table(cols, rows)


# ---------- company page ----------

@dataclass
class Company:
    symbol: str
    company_id: str
    name: str
    url: str
    about: str
    sector: str
    top: dict[str, float | None]
    quarters: Table
    pl: Table
    bs: Table
    cf: Table
    ratios: Table
    shareholding: Table
    sources: list[dict] = field(default_factory=list)


def _company_soup(symbol: str) -> tuple[BeautifulSoup, str]:
    sym = quote(symbol, safe="")
    cons = f"{BASE}/company/{sym}/consolidated/"
    soup = BeautifulSoup(fetch(cons), "lxml")
    if parse_table(soup, "quarters").empty or parse_table(soup, "profit-loss").empty:
        sa = f"{BASE}/company/{sym}/"
        soup = BeautifulSoup(fetch(sa), "lxml")
        return soup, sa
    return soup, cons


def _about(soup) -> str:
    p = soup.select_one(".company-profile .about p")
    if not p:
        return ""
    for sup in p.find_all("sup"):
        sup.decompose()
    return re.sub(r"\s+", " ", p.get_text(" ", strip=True)).strip()


def _sector(soup) -> str:
    peers = soup.select_one("section#peers")
    if not peers:
        return ""
    by_title = {a.get("title"): a.get_text(strip=True) for a in peers.select("p.sub a[title]")}
    return by_title.get("Broad Industry") or by_title.get("Industry") or by_title.get("Sector") or ""


def _top(soup) -> dict[str, float | None]:
    out = {}
    for li in soup.select("#top-ratios li"):
        n, v = li.select_one(".name"), li.select_one(".number")
        if n and v:
            out[n.get_text(strip=True)] = num(v.get_text(strip=True))
    return out


def _sources(soup) -> list[dict]:
    out: list[dict] = []
    for li in soup.select("section#documents .concalls li")[:8]:
        month_el = li.find("div")
        month = month_el.get_text(strip=True) if month_el else ""
        for a in li.find_all("a", href=True):
            kind = a.get_text(strip=True).lower()
            if kind == "transcript":
                out.append({"kind": "concall", "label": f"Concall transcript · {month}", "url": a["href"]})
            elif kind == "ppt":
                out.append({"kind": "ppt", "label": f"Investor presentation · {month}", "url": a["href"]})
    for li in soup.select("section#documents .annual-reports li")[:5]:
        a = li.find("a", href=True)
        if a:
            out.append({"kind": "annual_report", "label": a.get_text(" ", strip=True), "url": a["href"]})
    return out


def company(symbol: str) -> Company:
    soup, url = _company_soup(symbol)
    holder = soup.select_one("[data-company-id]")
    if holder is None:
        raise NotFound(symbol)
    h1 = soup.find("h1")
    return Company(
        symbol=symbol,
        company_id=holder["data-company-id"],
        name=h1.get_text(strip=True) if h1 else symbol,
        url=url,
        about=_about(soup),
        sector=_sector(soup),
        top=_top(soup),
        quarters=parse_table(soup, "quarters"),
        pl=parse_table(soup, "profit-loss"),
        bs=parse_table(soup, "balance-sheet"),
        cf=parse_table(soup, "cash-flow"),
        ratios=parse_table(soup, "ratios"),
        shareholding=parse_table(soup, "shareholding"),
        sources=_sources(soup),
    )


# ---------- chart API ----------

def price_series(company_id: str, days: int = 365) -> list[list]:
    """[[date, close, volume], ...] oldest first."""
    url = f"{BASE}/api/company/{company_id}/chart/?q=Price-DMA50-DMA200-Volume&days={days}"
    data = json.loads(fetch(url))
    by = {d["metric"]: d["values"] for d in data.get("datasets", [])}
    vol = {row[0]: row[1] for row in by.get("Volume", [])}
    out = []
    for date, close in by.get("Price", []):
        c = num(str(close))
        if c is None:
            continue
        v = vol.get(date)
        out.append([date, c, int(float(v)) if v not in (None, "") else 0])
    out.sort(key=lambda r: r[0])
    return out


# ---------- announcements ----------

def announcements(company_id: str, days: int = 30, now: datetime | None = None) -> list[dict]:
    """Recent + important announcements, deduped by url, within `days`, newest first."""
    seen: dict[str, dict] = {}
    for kind in ("recent", "important"):
        try:
            html = fetch(f"{BASE}/announcements/{kind}/{company_id}/", max_age_h=6)
        except NotFound:
            continue
        soup = BeautifulSoup(html, "lxml")
        for a in soup.select("ul.list-links li a[href]"):
            url = a["href"]
            meta = a.find("div")
            t = meta.find("time") if meta else None
            if t is None or url in seen:
                continue
            ts = t.get("datetime", "")
            summary = ""
            if meta:
                txt = meta.get_text(" ", strip=True)
                tt = t.get_text(" ", strip=True)
                summary = txt[len(tt):].lstrip(" -–").strip() if txt.startswith(tt) else txt
                meta.extract()
            title = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
            seen[url] = {"title": title, "summary": summary, "url": url, "ts": ts}
    now = now or datetime.now().astimezone()
    cutoff = now - timedelta(days=days)
    out = []
    for f in seen.values():
        try:
            dt = datetime.fromisoformat(f["ts"])
        except ValueError:
            continue
        if dt >= cutoff:
            out.append(f)
    out.sort(key=lambda f: f["ts"], reverse=True)
    return out
