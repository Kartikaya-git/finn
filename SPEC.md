# FINN — Spec

Vocabulary is defined in [CONTEXT.md](CONTEXT.md). Use those words exactly (Brief, Card, Holding, Filing, Dossier, Ask, Watch rule, Needs you / Routine / Quiet).

## Problem
An investor holding ~20 NSE companies is flooded with Filings, prices and results. FINN filters that into the few things that need them (push) and analyses any company from primary sources on demand (pull). Mobile-first.

## Product: two pages
1. **Brief (home)** — every Holding appears exactly once, ordered by attention.
   - *Needs you*: Cards (material Filings + crossed Watch rules). Results Cards show Revenue / EBITDA / PBT / PAT this quarter vs QoQ and YoY. Management-change Cards show the incoming person's brief profile (taken from the Filing's own SEBI-mandated profile annexure).
   - *Routine*: collapsed row of low-relevance Filings, each with a one-line summary.
   - *Quiet*: one thin row per Holding with no open Card (price, day move, volume vs avg, sparkline).
   - Time window chips (24h default, 3d, 7d, 30d). If 24h has nothing, say so and offer one tap to widen.
   - Dismiss a Card → Holding drops to Quiet (persisted in localStorage).
   - Watch rules sheet: day-move threshold (default ±3%), volume multiple (default 2× 20-day avg), per-category "always Card / always Routine" overrides. Price/volume rules are evaluated **client-side** from the series in brief.json, so thresholds are live.
2. **Dossier** — one company, primary sources only. Reached by Dig in (Card / Quiet row) or the search bar (any ticker in tickers.json).
   - Deterministic sections (any ticker, zero LLM cost): Financial snapshot, Trajectory, Balance sheet, Cash quality, Sources (concall + annual report links).
   - LLM layer (cached, research set only): **Promises vs delivered** (headline), Narrative vs numbers, Guidance, Bull vs bear, Business snapshot.
   - **Ask**: question box at the foot; zero-cost retrieval over the company's transcript chunks (client-side search) returning cited passages.

## Data (single source: screener.in public pages)
- Company page `https://www.screener.in/company/{SYMBOL}/consolidated/` (fallback `/company/{SYMBOL}/`): sections `#quarters #profit-loss #balance-sheet #cash-flow #ratios #shareholding #documents`; `data-company-id` attribute.
- EOD price+volume: `https://www.screener.in/api/company/{id}/chart/?q=Price-DMA50-DMA200-Volume&days=365`.
- Filings: `https://www.screener.in/announcements/recent/{id}/` → `<li>` with title, `<time datetime>`, one-line summary, BSE PDF link.
- Polite: 1 request/sec, cache raw HTML/JSON under `pipeline/.cache/` (gitignored).
- BSE/NSE/Yahoo block this machine; screener carries their data. Banks/NBFCs: screener shows "Financing Profit" instead of Operating Profit — use it in the EBITDA slot and label it.

## Filing classification (rules, no LLM)
Keyword rules on title+summary → ENAM category (results, M&A, fund_raise, management_change, litigation, insider_trading, earnings_call, investor_meetings, credit_rating, dividend, bonus_split, capex, press_release, postal_ballot, agm_egm, pledging, unclassified). Default tier: Card for results, management_change, M&A, fund_raise, litigation, capex. Routine otherwise, with escalations: credit_rating downgrade, pledge increase, promoter selling, large order win → Card. Results-meeting *notices* and scheduled independent-director retirements → Routine. Each Filing carries `why` (one short phrase explaining its tier).

## Data contract (`web/public/data/`)
```ts
// tickers.json
{ generated_at: string, tickers: { symbol: string, name: string, kind: ("holding"|"research"|"indexed")[] }[] }

// brief.json
{
  generated_at: string,            // ISO
  holdings: {
    symbol: string, name: string, sector: string,
    series: [string, number, number][],   // [date, close, volume], last ~90 sessions, oldest first
    filings: Filing[]                     // last 30 days, newest first
  }[]
}
type Filing = {
  id: string,                      // sha1(pdf_url)[:12]
  symbol: string, title: string, summary: string, url: string,
  ts: string,                      // ISO with offset
  category: string, tier: "card"|"routine", why: string,
  results?: {                      // only for results Cards
    period: string,                // e.g. "Sep 2026"
    unit: "₹ Cr",
    ebitda_label: "EBITDA"|"Financing Profit",
    rows: { metric: "Revenue"|"EBITDA"|"PBT"|"PAT", cur: number, prev_q: number, prev_y: number, qoq: number, yoy: number }[]  // qoq/yoy are % change
  },
  person?: { name: string, role: string, change: "appointed"|"resigned"|"retired", profile: string }  // from enrichment
}

// dossier/{SYMBOL}.json  (deterministic)
{
  symbol, name, generated_at, about: string, sector: string,
  price: { close: number, change_pct: number, mcap_cr: number|null, pe: number|null, roce: number|null, roe: number|null },
  quarters: { period: string, revenue: number, ebitda: number, pbt: number, pat: number, opm: number }[],   // last 12, oldest first
  annual:   { year: string, revenue: number, ebitda: number, pat: number, opm: number, cfo: number|null, capex: number|null, fcf: number|null, debt: number|null, equity: number|null }[],
  computed: {
    revenue_cagr_3y: number|null, revenue_cagr_5y: number|null, pat_cagr_3y: number|null, pat_cagr_5y: number|null,
    opm_trend: "expanding"|"stable"|"compressing", de_ratio: number|null, debt_trend: "rising"|"flat"|"falling",
    cfo_to_pat_5y: number|null, fcf_5y_cr: number|null, ccc_days: number|null, ccc_trend: "lengthening"|"stable"|"shortening"|null
  },
  flags: { level: "good"|"watch"|"bad", text: string }[],   // rule-derived, each tied to a number
  sources: { kind: "concall"|"annual_report"|"ppt", label: string, url: string }[]
}

// research/{SYMBOL}.json  (LLM layer, cached; research set only)
{
  symbol, model: string, generated_at,
  business: { summary: string, segments: { name: string, share_pct: number|null }[] },
  promises: { quarter: string, promise: string, source: string, delivered: string, verdict: "kept"|"partly"|"missed"|"pending" }[],
  narrative_vs_numbers: { claim: string, numbers: string, agrees: boolean }[],
  guidance: { metric: string, guide: string, source: string }[],
  bull: string[], bear: string[]
}
// research/{SYMBOL}.chunks.json — Ask corpus
{ symbol, chunks: { id: string, source: string, quarter: string, text: string }[] }

// enrichment.json — keyed by Filing.id or pdf url
{ [key: string]: { person?: Filing["person"], summary?: string } }
```

## Companies
- Portfolio (20): RELIANCE, HDFCBANK, INFY, ITC, LT, BAJFINANCE, ASIANPAINT, TITAN, SUNPHARMA, MARUTI, DMART, ETERNAL, POLYCAB, DIXON, KPITTECH, IRCTC, TRENT, DEEPAKNTR, CDSL, HAL.
- Research set: POLYCAB, KPITTECH, DIXON, PIDILITIND.
- Indexed (deterministic Dossier only, so search works widely): NIFTY 50 constituents.

## Architecture
- `pipeline/` — Python (uv). `python -m finn build` writes all JSON; `python -m finn dossier SYMBOL` builds one Dossier for any ticker on demand.
- `web/` — Vite + React + TypeScript static app, reads JSON from `${import.meta.env.BASE_URL}data/`. Vite `base: '/finn/'`.
- GitHub Actions: Pages deploy on push; scheduled pipeline run after market close (11:00 UTC weekdays) commits fresh data.
- Model routing: classification and all numbers are rules/code (₹0). LLM only for promises-vs-delivered, narrative, bull/bear — cached per company per quarter. Ask is retrieval-only (₹0).

## Out of scope
Live LLM in the deployed app, auth, real push notifications, intraday data, LinkedIn scraping.
