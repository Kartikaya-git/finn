// Pure derivations for the Dossier: everything here is computed from the
// pipeline files, so the UI never invents a number.
import type { Chunks, Dossier as D, Research, Verdict } from '../types'

export const VERDICTS: Verdict[] = ['kept', 'partly', 'missed', 'pending']
export const VERDICT_LABEL: Record<Verdict, string> = { kept: 'Kept', partly: 'Partly', missed: 'Missed', pending: 'Pending' }
export const VERDICT_TONE: Record<Verdict, string> = { kept: 'pos', partly: 'warn', missed: 'neg', pending: 'info' }
/** Ledger order: what needs the reader first. */
export const LEDGER_ORDER: Verdict[] = ['missed', 'partly', 'pending', 'kept']

export const isLender = (d: D) => /bank|financ|insurance/i.test(d.sector)

export function tally(r: Research) {
  const t: Record<Verdict, number> = { kept: 0, partly: 0, missed: 0, pending: 0 }
  for (const p of r.promises) t[p.verdict] = (t[p.verdict] ?? 0) + 1
  return t
}

const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
export const word = (n: number) => WORD[n] ?? String(n)

/** Where the transcript analysis came from: "4 concall transcripts", "4 investor presentations". */
export function corpus(r: Research, c: Chunks | null) {
  const srcs = new Set<string>(c?.chunks?.length ? c.chunks.map((x) => x.source) : r.promises.map((p) => p.source))
  let calls = 0, decks = 0, other = 0
  for (const s of srcs) /concall|call|transcript/i.test(s) ? calls++ : /present|ppt|deck/i.test(s) ? decks++ : other++
  const parts: string[] = []
  if (calls) parts.push(`${calls} concall transcript${calls > 1 ? 's' : ''}`)
  if (decks) parts.push(`${decks} investor presentation${decks > 1 ? 's' : ''}`)
  if (other) parts.push(`${other} filing${other > 1 ? 's' : ''}`)
  const noun = calls && !decks ? 'concall transcripts' : decks && !calls ? 'investor presentations' : 'concall transcripts and presentations'
  return { text: parts.join(' + ') || 'company disclosures', n: srcs.size, noun }
}

/** Same period a year back = 4 quarters earlier. */
export function latestQuarter(d: D) {
  const q = d.quarters, n = q.length
  if (!n) return null
  const cur = q[n - 1], prev = q[n - 2] ?? null, ly = q[n - 5] ?? null
  const g = (a: number, b: number | undefined | null) => (b == null || b === 0 ? null : ((a - b) / Math.abs(b)) * 100)
  const lender = isLender(d)
  const rows = [
    { key: 'Revenue', v: cur.revenue, yoy: g(cur.revenue, ly?.revenue), qoq: g(cur.revenue, prev?.revenue) },
    { key: lender ? 'Financing profit' : 'EBITDA', v: cur.ebitda, yoy: g(cur.ebitda, ly?.ebitda), qoq: g(cur.ebitda, prev?.ebitda) },
    { key: 'PBT', v: cur.pbt, yoy: g(cur.pbt, ly?.pbt), qoq: g(cur.pbt, prev?.pbt) },
    { key: 'PAT', v: cur.pat, yoy: g(cur.pat, ly?.pat), qoq: g(cur.pat, prev?.pat) },
  ]
  return { period: cur.period, rows, opm: cur.opm, opmLy: ly?.opm ?? null, patm: cur.revenue ? (cur.pat / cur.revenue) * 100 : null }
}

export function cashRead(d: D): string {
  const r = d.computed.cfo_to_pat_5y
  if (isLender(d)) return 'For a lender, operating cash flow swings with loan-book growth, so read cash conversion loosely.'
  if (r == null) return 'Not enough cash-flow history to judge conversion.'
  if (r >= 1) return 'Every rupee of reported profit has arrived as operating cash.'
  if (r >= 0.8) return 'Most reported profit converts to cash; the gap is working capital.'
  if (r >= 0.5) return 'Cash trails reported profit. Watch receivables and inventory.'
  return 'Reported profit is not turning into cash. This needs an explanation.'
}
export function cashHead(d: D): string {
  const r = d.computed.cfo_to_pat_5y
  if (isLender(d)) return 'Lender cash flow follows the loan book'
  if (r == null) return 'Cash conversion unavailable'
  if (r >= 1) return 'Profits are backed by cash'
  if (r >= 0.8) return 'Cash mostly follows profit'
  if (r >= 0.5) return 'Cash lags profit'
  return 'Profit without cash'
}
export function leverageHead(d: D): string {
  const de = d.computed.de_ratio
  if (isLender(d)) return 'A lender: borrowing is the raw material'
  if (de == null) return 'Leverage unavailable'
  if (de < 0.1) return 'Virtually debt-free'
  if (de < 0.5) return 'Conservatively geared'
  if (de < 1) return 'Moderately geared'
  return 'Leveraged balance sheet'
}
export function growthHead(d: D): string {
  const c3 = d.computed.revenue_cagr_3y, c5 = d.computed.revenue_cagr_5y
  const c = c3 ?? c5
  if (c == null) return 'Growth history incomplete'
  const span = c3 != null ? '3 years' : '5 years'
  if (c < 0) return `Revenue shrank ${Math.abs(c).toFixed(1)}% a year over ${span}`
  return `Revenue compounded ${c.toFixed(1)}% a year over ${span}`
}

/** Computed verdict for tickers without transcript research. */
export function computedVerdict(d: D) {
  const c = d.computed
  const g = c.revenue_cagr_3y ?? c.revenue_cagr_5y
  const a = g == null ? 'Growth history is incomplete' : g >= 0 ? `Revenue up ${g.toFixed(0)}% a year` : `Revenue down ${Math.abs(g).toFixed(0)}% a year`
  const r = c.cfo_to_pat_5y
  const b = isLender(d) ? 'a lender’s cash flow to read loosely'
    : r == null ? 'cash conversion unknown' : r >= 0.9 ? 'profits backed by cash' : r >= 0.6 ? 'cash lagging profit' : 'profit not turning into cash'
  return `${a}, ${b}.`
}
