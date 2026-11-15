# FINN design system — "The evening edition"

FINN reads like a tightly edited briefing written for one reader, not a dashboard. It uses editorial typography for judgments, mono figures for numbers, one signal colour for "needs you", and everything else stays quiet.

## Point of view
- **The Brief is a front page.** The masthead headline states the verdict in words ("3 things need you tonight."). Stories (Cards) follow in rank order, then a single line folds the routine filings, then a ticker list of quiet holdings at the bottom.
- **Density through disclosure.** A Card is collapsed by default to 2 lines: rail, symbol, headline, meta. Tapping expands it in place to the detail (results table / appointee profile / move chart) and its actions. This is how ~10 items fit on one phone screen.
- **Triage is felt.** A segmented meter under the masthead shows cleared vs open Cards. Swipe left (or tap ✓) to clear; the meter fills. At zero open Cards, the masthead turns to "All clear." with a calm check.
- **Judgment first in the Dossier.** Its hero is a scorecard: "Management kept 5 of 7 promises", with segmented verdict bar. Everything else is evidence beneath it. Sticky section tabs let you jump.
- **Provenance is typographic.** Every section ends with a small-caps source line: `COMPUTED FROM FILINGS` or `FROM 4 CONCALL TRANSCRIPTS · GEMINI-3.8-FLASH`.
- **Thumb-first.** Primary navigation is a floating bottom dock: a search pill ("Search any NSE company") + a Watch-rules button. Nothing important lives only at the top.

## Tokens (defined in `src/ui/tokens.css` — use them, never hard-code colours)
- Surfaces: `--paper` (page), `--card`, `--sunk` (wells, tracks), `--hair` (1px rules), `--hair-2`.
- Ink: `--ink` (primary), `--ink-2` (secondary), `--ink-3` (tertiary/meta).
- Signal: `--signal` (orange — "needs you", open Cards, the one accent), `--signal-soft`.
- Semantic: `--pos` / `--pos-soft` (up, kept), `--neg` / `--neg-soft` (down, missed), `--warn` / `--warn-soft` (partly, watch). `--info` / `--info-soft` for neutral tags (pending).
- Type: `--serif` (Instrument Serif — display headlines and verdict sentences only), `--sans` (Inter Tight — UI), `--mono` (JetBrains Mono — every number, ticker symbols, provenance lines).
- Radius: `--r-1` 6px, `--r-2` 12px, `--r-3` 20px. Spacing on a 4px grid.
- Motion: `--ease` cubic-bezier(.2,.8,.2,1); 160–240ms; respect reduced motion.

## Type scale
- Masthead headline: serif 34/36, -0.01em. Dossier verdict: serif 28/32.
- Section label: mono 10.5px, uppercase, 0.12em tracking, `--ink-3`.
- Card headline: sans 15/20 weight 550. Body 13.5/20. Meta: mono 11px `--ink-3`.
- Numbers: always `--mono`, tabular, never bold; colour carries sign.

## Primitives (classes in tokens.css)
- `.label` — mono small-caps section label.
- `.prov` — provenance line (mono 10px uppercase, `--ink-3`, top hairline).
- `.sym` — ticker in mono 12px weight 600, letter-spacing .02em.
- `.num`, `.pos`, `.neg` — numbers and their sign colours.
- `.pill` + `.pill.pos|neg|warn|info|signal` — compact status chips (10.5px, 2px 7px, radius 999).
- `.hair` — 1px rule. `.tap` — 44px minimum hit target helper.
- `.dock` — fixed bottom floating bar container (max-width 440px, safe-area aware, blurred paper).
- `.sheet`, `.scrim` — bottom sheet. `.toast` — undo toast above the dock.

## Rules
- Phone first at 390px; on desktop the app is a 440px column centred on `--paper` with a faint hairline frame.
- Light ("paper": warm off-white) and dark ("ink": near-black blue) both first-class via prefers-color-scheme.
- No emojis. No gradients except the dock blur. No drop shadows except the sheet/dock (soft, large, low-alpha).
- Severity is shown by a 3px left rail on the Card: `--signal` for results / management change / M&A / litigation, `--warn` for price/volume and other Cards.
- Empty and loading states are designed (skeleton lines in `--sunk`, never spinners).
