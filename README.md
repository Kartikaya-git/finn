# FINN — Financial INvestment ageNt

**Live (open on a phone):** https://kartikaya-git.github.io/finn/

FINN is a mobile-first agent for an investor holding a portfolio of NSE-listed companies. Its thesis: the scarce skill isn't aggregating information, it's **ranking it by how much it needs you** — and proving that with primary sources.

## Two pages, deliberately

| | **Brief** (home, push) | **Dossier** (pull) |
|---|---|---|
| Question it answers | "What changed that needs me?" | "What do I think of this company?" |
| Time | Events since the window start | Multi-quarter judgment |
| Content | Every Holding exactly once: **Needs you** Cards → collapsed **Routine** filings → **Quiet** rows | Promises vs delivered, narrative vs numbers, guidance, bull/bear, computed trajectory / balance sheet / cash quality, **Ask** |

Why not a third "portfolio" page: the broker app already has one, and a list that shows every company equally works against filtering. Instead the home screen *is* the portfolio, ordered by attention. Dismiss a Card and the Holding drops into Quiet — "done for the day" is visible.

### Brief
- Time window chips (24h / 3d / 7d / 30d). Windows end at the latest Filing, so a weekend or stale refresh never shows an empty Brief.
- **Results Cards**: Revenue / EBITDA / PBT / PAT this quarter vs QoQ and YoY (banks: Financing Profit in the EBITDA slot).
- **Management-change Cards**: the incoming person's profile, taken from the Filing itself (SEBI LODR requires a brief profile of the appointee) — a primary source instead of LinkedIn scraping.
- **Watch rules** (gear icon): day-move %, volume × 20-day average, and per-category "always Card / always Routine". Evaluated on-device from the shipped price/volume series, so changing a threshold re-ranks instantly.
- Every Card carries a `why` — the reason it earned your attention.

### Dossier
- **Promises vs delivered** leads: what management guided each quarter, what the numbers later showed, verdict (kept / partly / missed / pending), source.
- Deterministic sections work for **any** ticker (59 indexed; `python -m finn dossier SYMBOL` builds any other): trajectory, CAGRs, margin trend, D/E, cash-conversion cycle, CFO/PAT, FCF, rule-derived flags that each cite a number.
- **Ask** answers only with quoted passages from the company's own concall transcripts (client-side retrieval, ₹0).
- Every section is labelled with provenance: *from filings · computed* or *from transcripts · cached*.

## Architecture

```
screener.in (filings, EOD price+volume, financials, transcript links)
        │  1 req/s, on-disk cache
        ▼
pipeline/finn            rules + code, ₹0        → brief.json, tickers.json, dossier/*.json
pipeline/finn_research   map: Flash-Lite (extract guidance/claims per transcript, quotes verified verbatim)
                         reduce: Flash (promises vs delivered, once per company-quarter, cached)
                                                  → research/*.json, research/*.chunks.json
        ▼
web/  Vite + React + TS static app (GitHub Pages) — triage, Watch rules and Ask run on-device
        ▲
GitHub Actions: deploy on push; end-of-day pipeline cron on weekdays after market close
```

**Model routing.** Classification, tiering and every financial number are deterministic code: free, reproducible, explainable. A cheap model does bulk extraction over transcript chunks; a stronger model is called once per company per quarter for the one step that needs reasoning (reconciling promises with delivery). All LLM responses are cached by prompt hash, so reruns cost nothing. Ask is retrieval-only. The deployed app makes zero LLM calls.

**Primary sources only on the pull side.** Research is built from concall transcripts and results numbers; quotes are checked to be verbatim substrings of the source; the prompt forbids outside knowledge.

**Data source choice.** BSE, NSE and Yahoo block automated clients (Akamai 403s / 429s). screener.in republishes the same BSE filings (same PDF links), EOD price/volume and standardised financials, so one reliable source replaces three fragile ones.

## Run locally

```bash
# data
cd pipeline && uv run python -m finn build          # Brief + all Dossiers
uv run python -m finn dossier TATASTEEL             # any ticker
uv run python -m finn_research ITC                  # research layer (needs GEMINI_API_KEY in ../.env)

# app
cd web && npm i && npm run dev                      # http://localhost:5173/finn/
```

## Deliberately left out
Live LLM calls from the deployed app (static hosting, no exposed keys), real push notifications, intraday data, auth, LinkedIn scraping.

## Next
Web push from the scheduled pipeline; cheap-model fallback for ambiguous press releases; incremental research refresh when a new transcript lands; a "what changed in the thesis" diff per quarter; a spoken morning Brief.

## Repo map
- `CONTEXT.md` — domain glossary (Brief, Card, Holding, Filing, Dossier, Ask, Watch rule…)
- `SPEC.md` — spec and data contract · `TICKETS.md` — build tickets
- `pipeline/` — data + research engines · `web/` — the app
