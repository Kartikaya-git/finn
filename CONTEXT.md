# FINN

FINN (Financial INvestment ageNt) is a mobile-first agent for an investor holding a portfolio of NSE/BSE-listed companies. It filters what changed into what matters (push) and researches a company on demand from its primary sources (pull).

## The investor's world

**Holding**:
One company in the investor's portfolio, identified by its NSE ticker.
_Avoid_: Position, stock, scrip

**Portfolio**:
The investor's set of 15–20 Holdings that FINN watches.
_Avoid_: Watchlist

**Filing**:
An official disclosure a listed company posts to NSE/BSE.
_Avoid_: Announcement, notice, news

## Push: the Brief

**Brief**:
FINN's home page: every Holding appears exactly once, ordered by how much it needs the investor's attention.
_Avoid_: Inbox, feed, dashboard, digest

**Card**:
A single item in the Brief telling the investor that something material changed at one Holding (a Filing or a crossed Watch rule).
_Avoid_: Notification, alert, item

**Needs you**:
The top section of the Brief, holding the open Cards.

**Routine**:
The collapsed section of the Brief holding Filings judged not worth a Card.

**Quiet**:
The bottom section of the Brief: one thin row per Holding with no open Cards, showing only its end-of-day state.

**Dismiss**:
The investor's act of clearing a Card; a Holding with no open Cards drops into Quiet.

**Watch rule**:
An investor-set threshold that, when crossed, raises a Card (e.g. a day move beyond ±X%, volume above N× its recent average, or a Filing of a chosen type).
_Avoid_: Alert setting, trigger

## Pull: the Dossier

**Dossier**:
FINN's research page for one company, grounded only in that company's primary sources; works for any NSE ticker, not just Holdings.
_Avoid_: Research view, company page, report

**Ask**:
The follow-up question thread at the foot of a Dossier, scoped to that company.
_Avoid_: Chat, copilot

**Dig in**:
The action that opens a Dossier from a Card or Quiet row.

**Primary source**:
A document published by the company itself — annual report, concall transcript, results filing. The only evidence a Dossier may use.
_Avoid_: Secondary source (news, broker notes) — excluded by definition
