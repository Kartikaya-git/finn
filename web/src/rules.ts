import type { Brief, Filing, Holding } from './types'

export type CatMode = 'card' | 'default' | 'routine'
export interface WatchRules { dayMove: number; volMult: number; cats: Record<string, CatMode> }
export const DEFAULT_RULES: WatchRules = { dayMove: 3, volMult: 2, cats: {} }

export const CATEGORIES: [string, string][] = [
  ['results', 'Results'], ['management_change', 'Management change'], ['M&A', 'M&A'],
  ['litigation', 'Litigation'], ['fund_raise', 'Fund raise'], ['capex', 'Capex'],
  ['credit_rating', 'Credit rating'], ['pledging', 'Pledging'], ['insider_trading', 'Insider trading'],
  ['dividend', 'Dividend'], ['earnings_call', 'Earnings call'], ['investor_meetings', 'Investor meetings'],
  ['press_release', 'Press release'], ['bonus_split', 'Bonus / split'], ['agm_egm', 'AGM / EGM'],
  ['postal_ballot', 'Postal ballot'], ['unclassified', 'Unclassified'],
]
export const catLabel = (c: string) => CATEGORIES.find((x) => x[0] === c)?.[1] ?? c.replace(/_/g, ' ')

export const WINDOWS = [
  ['24h', 1], ['3d', 3], ['7d', 7], ['30d', 30],
] as const
export type WindowKey = (typeof WINDOWS)[number][0]

export interface Market { close: number; dayPct: number; volX: number; date: string; closes: number[] }
export function market(h: Holding): Market | null {
  const s = h.series
  if (!s || s.length < 2) return null
  const last = s[s.length - 1]
  const prev = s[s.length - 2]
  const prior = s.slice(Math.max(0, s.length - 21), s.length - 1).map((r) => r[2])
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0
  return {
    close: last[1],
    dayPct: prev[1] ? (last[1] / prev[1] - 1) * 100 : 0,
    volX: avg ? last[2] / avg : 0,
    date: last[0],
    closes: s.slice(-30).map((r) => r[1]),
  }
}

export type Card =
  | { kind: 'filing'; id: string; symbol: string; sev: number; ts: string; filing: Filing }
  | { kind: 'price'; id: string; symbol: string; sev: number; ts: string; m: Market }
  | { kind: 'volume'; id: string; symbol: string; sev: number; ts: string; m: Market }

const SEV0 = new Set(['results', 'management_change', 'M&A', 'litigation'])
export const effectiveTier = (f: Filing, r: WatchRules) => {
  const mode = r.cats[f.category] ?? 'default'
  return mode === 'default' ? f.tier : mode
}

export interface Group { holding: Holding; cards: Card[]; sev: number; latest: string }
export interface Triage { groups: Group[]; routine: Filing[]; quiet: Holding[]; windowCardCount: number }

export function triage(brief: Brief, r: WatchRules, days: number, dismissed: Set<string>): Triage {
  const cutoff = new Date(brief.generated_at).getTime() - days * 864e5
  const groups: Group[] = []
  const routine: Filing[] = []
  const quiet: Holding[] = []
  let windowCardCount = 0
  for (const h of brief.holdings) {
    const cards: Card[] = []
    for (const f of h.filings ?? []) {
      if (new Date(f.ts).getTime() < cutoff) continue
      if (effectiveTier(f, r) === 'card') {
        windowCardCount++
        if (!dismissed.has(f.id)) cards.push({ kind: 'filing', id: f.id, symbol: h.symbol, sev: SEV0.has(f.category) ? 0 : 2, ts: f.ts, filing: f })
      } else routine.push(f)
    }
    const m = market(h)
    if (m) {
      const ts = `${m.date}T15:30:00+05:30`
      if (Math.abs(m.dayPct) >= r.dayMove) {
        windowCardCount++
        const id = `${h.symbol}:px:${m.date}`
        if (!dismissed.has(id)) cards.push({ kind: 'price', id, symbol: h.symbol, sev: 1, ts, m })
      }
      if (m.volX >= r.volMult) {
        windowCardCount++
        const id = `${h.symbol}:vol:${m.date}`
        if (!dismissed.has(id)) cards.push({ kind: 'volume', id, symbol: h.symbol, sev: 1, ts, m })
      }
    }
    if (cards.length) {
      cards.sort((a, b) => a.sev - b.sev || b.ts.localeCompare(a.ts))
      groups.push({ holding: h, cards, sev: cards[0].sev, latest: cards.reduce((x, c) => (c.ts > x ? c.ts : x), '') })
    } else quiet.push(h)
  }
  groups.sort((a, b) => a.sev - b.sev || b.latest.localeCompare(a.latest))
  routine.sort((a, b) => b.ts.localeCompare(a.ts))
  quiet.sort((a, b) => Math.abs(market(b)?.dayPct ?? 0) - Math.abs(market(a)?.dayPct ?? 0))
  return { groups, routine, quiet, windowCardCount }
}
