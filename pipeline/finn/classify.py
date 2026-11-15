"""Rule-based Filing classifier (no LLM).

classify(title, summary) -> (category, tier, why)

Rules run on the title first (BSE titles carry the filing type); if the title is
generic ("Disclosure under Regulation 30 ..."), they run on title + summary.
Default tiers per SPEC: Card for results, management_change, M&A, fund_raise,
litigation, capex; Routine otherwise, with escalations.
"""
from __future__ import annotations

import re

CARD_DEFAULT = {"results", "management_change", "M&A", "fund_raise", "litigation", "capex"}

# (category, pattern) — first match wins; order matters.
RULES: list[tuple[str, str]] = [
    ("earnings_call", r"transcript|audio recording|video recording|earnings call|conference call|con-call|concall"),
    ("investor_meetings", r"analyst|investor meet|analyst meet|institutional investor|investor conference|investor presentation"),
    ("results", r"financial results?|\bresults?\b.*(quarter|half year|year ended|q[1-4])|(q[1-4]|h1|quarter(ly)?)\b[^.;]{0,30}\bresults?\b|integrated filing \(financial\)|unaudited|audited .*results"),
    ("credit_rating", r"credit rating|\brating\b"),
    ("pledging", r"pledge|encumbrance"),
    ("insider_trading", r"insider trading|regulation 7\(2\)|reg\.? 7|trading window|sast|takeover regulations|regulation 29|regulation 31"),
    ("M&A", r"acquisition|acquire|restructuring|amalgamation|merger|scheme of arrangement|demerger|takeover|stake purchase|joint venture|divest|sale of (?:stake|business|subsidiary)"),
    ("fund_raise", r"qualified institutions placement|\bqip\b|preferential (issue|allotment)|warrants|rights issue|non-convertible debentures|\bncds?\b|commercial paper|raising of funds|fund rais|bonds?\b"),
    ("management_change", r"change in (directorate|management|kmp|key managerial)|appointment|appointed|resignation|resigns?|cessation|re-?appoint|retire|superannuat|managing director|chief executive|\bceo\b|\bcfo\b|company secretary"),
    ("litigation", r"litigation|dispute|court|tribunal|\bnclt\b|arbitration|penalty|show cause|tax demand|\border\b.*(authority|gst|income tax)|search and seizure|\braid\b|insolvency|nclat"),
    ("dividend", r"dividend|record date"),
    ("bonus_split", r"bonus|sub-?division|split"),
    ("capex", r"capex|capacity expansion|commission(ing|ed)|new plant|greenfield|brownfield|commercial production|capital expenditure"),
    ("postal_ballot", r"postal ballot|e-?voting"),
    ("agm_egm", r"\bagm\b|\begm\b|annual general meeting|extra-?ordinary general meeting|general meeting"),
    ("press_release", r"press release|media release|bagging|receiving of orders|order win|contract|newspaper publication"),
]

ORDER_WIN = re.compile(r"bagging|receiving of orders|order win|(secured|received|bagged|won|awarded).{0,40}(order|contract)|(order|contract).{0,40}(worth|valued)", re.I)
NOTICE = re.compile(r"intimation|to consider|prior notice|board meeting (?:intimation|notice)|will be held|scheduled to", re.I)
RESULTS_OUTCOME = re.compile(r"outcome|approved|results? for|financial results", re.I)


def _cat(text: str) -> str | None:
    t = text.lower()
    for cat, pat in RULES:
        if re.search(pat, t):
            return cat
    return None


def _crore(text: str) -> float | None:
    m = re.search(r"(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)\s*(crore|cr\b|lakh|billion|bn|million|mn)", text, re.I)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    unit = m.group(2).lower()
    return {"lakh": v / 100, "billion": v * 100, "bn": v * 100, "million": v / 10, "mn": v / 10}.get(unit, v)


def classify(title: str, summary: str = "", annual_revenue_cr: float | None = None) -> tuple[str, str, str]:
    both = f"{title} {summary}"
    low = both.lower()

    # Board-meeting notices (incl. results-meeting notices) -> Routine
    if re.search(r"board meeting", title, re.I) and NOTICE.search(both) and not re.search(r"outcome", title, re.I):
        cat = "results" if re.search(r"result", low) else "unclassified"
        return cat, "routine", "Results meeting notice" if cat == "results" else "Board meeting notice"

    cat = _cat(title)
    if cat is None or (cat in ("press_release",) and _cat(summary) not in (None, "press_release")):
        cat = _cat(both) or "unclassified"
    if cat == "insider_trading" and re.search(r"pledge|encumbrance", low):
        cat = "pledging"
    # Order wins override generic categories
    if ORDER_WIN.search(both) and cat in ("press_release", "unclassified", "litigation"):
        cat = "press_release"
        amt = _crore(both)
        if amt and annual_revenue_cr and amt >= 0.02 * annual_revenue_cr:
            return cat, "card", f"Large order win (~{amt / annual_revenue_cr * 100:.0f}% of annual revenue)"
        if amt and not annual_revenue_cr and amt >= 500:
            return cat, "card", "Large order win"
        return cat, "routine", "Order win, small vs revenue" if amt else "Order win, size not stated"

    if cat == "results" and re.search(r"issued by|parent company|holding company", title, re.I):
        return "unclassified", "routine", "Group company's results, not this company's"
    if cat == "fund_raise" and re.search(r"repayment|redeem|redemption|monitoring agency|utili[sz]ation", low):
        return cat, "routine", "Debt repaid / proceeds monitoring"
    if cat == "results":
        if NOTICE.search(both) and not RESULTS_OUTCOME.search(summary):
            return cat, "routine", "Results meeting notice"
        return cat, "card", "Quarterly results declared"
    if cat == "management_change":
        if re.search(r"independent director", low) and re.search(r"complet|tenure|retire|cessation", low):
            return cat, "routine", "Scheduled independent-director retirement"
        if re.search(r"re-?appoint", low) and not re.search(r"resign|cessation", low):
            return cat, "routine", "Reappointment, same person continues"
        if re.search(r"company secretary|compliance officer", low) and not re.search(r"ceo|cfo|managing director|chief", low):
            return cat, "card", "Company secretary changed"
        return cat, "card", "Leadership change"
    if cat == "credit_rating":
        if re.search(r"downgrad|negative|watch with negative", low):
            return cat, "card", "Credit rating downgrade"
        return cat, "routine", "Rating reaffirmed or upgraded"
    if cat == "pledging":
        if re.search(r"release|revoc|invocation released", low):
            return cat, "routine", "Pledge released"
        return cat, "card", "Promoter pledge created / increased"
    if cat == "insider_trading":
        if re.search(r"promoter", low) and re.search(r"\bsale\b|sold|dispos|sell", low):
            return cat, "card", "Promoter selling shares"
        if re.search(r"trading window", low):
            return cat, "routine", "Trading window closure"
        return cat, "routine", "Insider / SAST disclosure"
    if cat in CARD_DEFAULT:
        why = {
            "M&A": "Acquisition / restructuring",
            "fund_raise": "Capital raise",
            "litigation": "Legal / regulatory action",
            "capex": "Capacity / capex update",
        }[cat]
        return cat, "card", why
    why = {
        "earnings_call": "Concall record, numbers already out",
        "investor_meetings": "Investor meeting schedule",
        "dividend": "Dividend / record date admin",
        "bonus_split": "Bonus / split admin",
        "postal_ballot": "Shareholder vote admin",
        "agm_egm": "General meeting admin",
        "press_release": "Press release",
        "unclassified": "Procedural filing",
    }.get(cat, "Procedural filing")
    return cat, "routine", why


def is_results_declared(title: str, summary: str) -> bool:
    cat, tier, _ = classify(title, summary)
    return cat == "results" and tier == "card"


if __name__ == "__main__":
    CASES = [
        ("Results - Financial Results For Sep 30, 2026", "Q2 FY27 revenue up 9% YoY", "results", "card"),
        ("Board Meeting Intimation for Consideration Of Unaudited Financial Results For Quarter Ended September 30, 2026", "Board meeting on Oct 20 to consider Q2 results", "results", "routine"),
        ("Board Meeting Outcome for Outcome Of Board Meeting", "Board approved unaudited financial results for quarter ended Sep 30, 2026", "results", "card"),
        ("Integrated Filing (Financial)", "Integrated financial filing for quarter ended September 30, 2026", "results", "card"),
        ("Announcement under Regulation 30 (LODR)-Change in Management", "Mr. X superannuated on October 31, 2026", "management_change", "card"),
        ("Announcement under Regulation 30 (LODR)-Change in Directorate", "Reappointed V. Rangan as Executive Director for one year", "management_change", "routine"),
        ("Announcement under Regulation 30 (LODR)-Cessation", "Cessation of Mr. Y as Independent Director upon completion of second tenure", "management_change", "routine"),
        ("Announcement under Regulation 30 (LODR)-Earnings Call Transcript", "Transcript of Q2 earnings call", "earnings_call", "routine"),
        ("Announcement under Regulation 30 (LODR)-Analyst / Investor Meet - Intimation", "Schedule of analyst meetings", "investor_meetings", "routine"),
        ("Announcement under Regulation 30 (LODR)-Credit Rating", "CRISIL reaffirmed AAA/Stable", "credit_rating", "routine"),
        ("Announcement under Regulation 30 (LODR)-Credit Rating", "ICRA downgraded long-term rating to AA-", "credit_rating", "card"),
        ("Announcement under Regulation 30 (LODR)-Acquisition", "Acquisition of 100% stake in ABC Ltd for Rs 450 crore", "M&A", "card"),
        ("Announcement under Regulation 30 (LODR)-Bagging/Receiving of orders/contracts", "Received order worth Rs 2,400 crore from NHAI", "press_release", "card"),
        ("Closure of Trading Window", "Trading window closed from Oct 1", "insider_trading", "routine"),
        ("Corporate Action-Board approves Dividend", "Interim dividend of Rs 10 per share; record date Oct 30", "dividend", "routine"),
        ("Disclosure under Regulation 31(1) and 31(2) of SAST", "Promoter created pledge on 2% of shares", "pledging", "card"),
        ("Shareholder Meeting / Postal Ballot-Outcome of Postal_Ballot", "Shareholders approved appointment of Z as MD", "postal_ballot", "routine"),
        ("Announcement under Regulation 30 (LODR)-Commissioning of new plant", "Commenced commercial production at Hosur plant", "capex", "card"),
    ]
    bad = 0
    for title, summ, ecat, etier in CASES:
        cat, tier, why = classify(title, summ, annual_revenue_cr=20000)
        ok = cat == ecat and tier == etier
        bad += not ok
        print(("ok  " if ok else "FAIL"), f"{cat:18} {tier:8} {why:42} | {title[:60]}")
    print(f"{len(CASES) - bad}/{len(CASES)} passed")
    raise SystemExit(1 if bad else 0)
