"""Phone alerts via ntfy.sh: one push per new Card Filing or Watch-rule breach.

Run with `python -m finn.notify`. State (already-notified ids) lives in
web/public/data/alerts_state.json so each item is pushed at most once.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import requests

DATA = Path(__file__).resolve().parents[2] / "web" / "public" / "data"
BRIEF = DATA / "brief.json"
STATE = DATA / "alerts_state.json"

DAY_MOVE = 3.0  # % — same default as the app's Watch rules
VOL_MULT = 2.0  # × mean volume of the previous 20 sessions
MAX_PUSHES = 10
APP = "https://kartikaya-git.github.io/finn/#/d/{}"
HIGH = {"results", "management_change", "M&A", "litigation"}
LABELS = {
    "results": "Results", "management_change": "Management change", "M&A": "M&A",
    "litigation": "Litigation", "fund_raise": "Fund raise", "capex": "Capex",
    "credit_rating": "Credit rating", "pledging": "Pledging", "insider_trading": "Insider trading",
    "dividend": "Dividend", "earnings_call": "Earnings call", "investor_meetings": "Investor meetings",
    "press_release": "Press release", "bonus_split": "Bonus / split", "agm_egm": "AGM / EGM",
    "postal_ballot": "Postal ballot", "unclassified": "Unclassified",
}


def _pct(x: float) -> str:
    return f"{x:+.1f}%"


def filing_alert(f: dict) -> dict:
    cat = f.get("category", "unclassified")
    body = f.get("summary") or f.get("title", "")
    res = f.get("results")
    if res:
        yoy = {r["metric"]: r.get("yoy") for r in res.get("rows", [])}
        bits = [f"{k} {_pct(yoy[m])} YoY" for k, m in (("Rev", "Revenue"), ("PAT", "PAT")) if yoy.get(m) is not None]
        if bits:
            body = f"{body}\n{' · '.join(bits)}"
    return {
        "id": f["id"], "symbol": f["symbol"], "label": LABELS.get(cat, cat.replace("_", " ").capitalize()),
        "body": body, "tags": "page_facing_up", "priority": "high" if cat in HIGH else "default",
    }


def market_alerts(h: dict) -> list[dict]:
    s = h.get("series") or []
    if len(s) < 2:
        return []
    (date, close, vol), prev = s[-1], s[-2]
    prior = [r[2] for r in s[max(0, len(s) - 21):-1]]
    avg = sum(prior) / len(prior) if prior else 0
    day = (close / prev[1] - 1) * 100 if prev[1] else 0
    volx = vol / avg if avg else 0
    out = []
    if abs(day) >= DAY_MOVE:
        out.append({
            "id": f"px:{h['symbol']}:{date}", "symbol": h["symbol"], "label": "Day move",
            "body": f"{h.get('name', h['symbol'])} moved {_pct(day)} to {close:,.2f} on {date}.",
            "tags": "chart_with_upwards_trend" if day > 0 else "chart_with_downwards_trend", "priority": "default",
        })
    if volx >= VOL_MULT:
        out.append({
            "id": f"vol:{h['symbol']}:{date}", "symbol": h["symbol"], "label": "Volume spike",
            "body": f"{h.get('name', h['symbol'])} traded {volx:.1f}× its 20-day average volume on {date}.",
            "tags": "bar_chart", "priority": "default",
        })
    return out


def collect(brief: dict) -> list[dict]:
    items: list[dict] = []
    for h in brief["holdings"]:
        items += [filing_alert(f) for f in h.get("filings", []) if f.get("tier") == "card"]
        items += market_alerts(h)
    return items


def push(topic: str, title: str, body: str, *, click: str, tags: str, priority: str) -> int:
    r = requests.post(
        f"https://ntfy.sh/{topic}", data=body.encode(),
        headers={"Title": title.encode(), "Click": click, "Tags": tags, "Priority": priority}, timeout=15,
    )
    return r.status_code


def main() -> None:
    topic = os.environ.get("FINN_NTFY_TOPIC") or "finn-kartikaya-portfolio"
    brief = json.loads(BRIEF.read_text())
    items = collect(brief)
    first_run = not STATE.exists()
    seen: set[str] = set() if first_run else set(json.loads(STATE.read_text()).get("seen", []))

    if first_run:
        n = len(brief["holdings"])
        code = push(topic, "FINN is on", f"FINN is watching {n} holdings · {len(items)} things need you",
                    click="https://kartikaya-git.github.io/finn/", tags="eyes", priority="default")
        print(f"first run: summary push to {topic} -> HTTP {code}; marked {len(items)} items seen")
        seen = {i["id"] for i in items}
    else:
        new = [i for i in items if i["id"] not in seen]
        print(f"{len(new)} new alert(s) for {topic}" + (f", sending first {MAX_PUSHES}" if len(new) > MAX_PUSHES else ""))
        for k, i in enumerate(new[:MAX_PUSHES], 1):
            code = push(topic, f"{i['symbol']} · {i['label']}", i["body"], click=APP.format(i["symbol"]),
                        tags=i["tags"], priority=i["priority"])
            print(f"push {k}/{min(len(new), MAX_PUSHES)}: {i['symbol']} · {i['label']} -> HTTP {code}")
            if code == 200:
                seen.add(i["id"])

    STATE.write_text(json.dumps({"seen": sorted(seen)}, indent=1) + "\n")


if __name__ == "__main__":
    main()
