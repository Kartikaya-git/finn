# FINN — Tickets

Source of truth for the build. See SPEC.md for the data contract.

## T1 — Data pipeline (screener → JSON)
`pipeline/`: screener client with cache + rate limit; parse quarters/P&L/BS/CF/ratios/documents; chart API series; announcements; rule classifier; results QoQ/YoY extraction; writes brief.json, tickers.json, dossier/*.json. CLI `build` and `dossier SYMBOL`.
Blocked by: —

## T2 — Brief + Dossier frontend
`web/`: mobile-first Vite React app. Brief (Needs you / Routine / Quiet, window chips, Dismiss, Watch rules sheet, client-side price/volume rules), Dossier (deterministic sections + research layer + Ask retrieval). Works against sample fixtures until T1 lands.
Blocked by: — (contract in SPEC.md)

## T3 — Research layer + enrichment
`web/public/data/research/*.json`, `*.chunks.json` for research set from concall transcripts; `enrichment.json` with incoming-person profiles for management_change Filings.
Blocked by: —

## T4 — Integrate, deploy, document
Run pipeline, wire data, verify at 390px, GitHub repo + Pages + scheduled workflow, README + covering note.
Blocked by: T1, T2, T3
