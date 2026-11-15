// Ask: retrieval-only Q&A over a company's own primary sources. Nothing is
// generated; the sheet shows the three best-matching passages, quoted.
import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import type { Chunks } from '../types'
import { SearchGlyph } from '../ui/Dock'

type Chunk = Chunks['chunks'][number]
interface Hit { id: string; source: string; quarter: string; text: string; terms: string[]; score: number }

const STOP = new Set('the a an of to in on for and or is are was were be what how why did does do with about their its it this that from by at as has have had will would can could they them management company say said says tell me any much many'.split(' '))

function snippet(text: string, terms: string[], len = 360): string {
  const lower = text.toLowerCase()
  const first = terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0
  let start = Math.max(0, first - 110)
  if (start > 0) { const sp = text.indexOf(' ', start); if (sp > 0 && sp - start < 20) start = sp + 1 }
  let end = Math.min(text.length, start + len)
  if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > start) end = sp }
  return (start > 0 ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : '')
}
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const ts = terms.filter((t) => t.length > 1)
  if (!ts.length) return <>{text}</>
  const re = new RegExp(`(${ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>
}

export function useAskIndex(chunks: Chunks | null) {
  return useMemo(() => {
    if (!chunks?.chunks?.length) return null
    const ms = new MiniSearch<Chunk>({
      fields: ['text'], storeFields: ['source', 'quarter', 'text'],
      processTerm: (t) => { const l = t.toLowerCase(); return STOP.has(l) || l.length < 2 ? null : l },
      searchOptions: { prefix: (t) => t.length > 3, fuzzy: (t) => (t.length > 5 ? 0.2 : false), combineWith: 'OR' },
    })
    ms.addAll(chunks.chunks)
    return ms
  }, [chunks])
}

const DEFAULT_SUGGEST = ['capex', 'margin guidance', 'working capital', 'demand outlook', 'exports']

export function AskBar({ symbol, chunks, sourceNoun, suggest, onSearch, pending, clearPending }: {
  symbol: string; chunks: Chunks | null; sourceNoun: string; suggest: string[]
  onSearch: () => void; pending: string | null; clearPending: () => void
}) {
  const index = useAskIndex(chunks)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState<{ q: string; hits: Hit[] } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const nSources = useMemo(() => new Set(chunks?.chunks.map((c) => c.source) ?? []).size, [chunks])

  const run = (text: string) => {
    const question = text.trim()
    if (!question) return
    setQ(question)
    if (!index) { setAsked({ q: question, hits: [] }); return }
    const hits = index.search(question).slice(0, 3).map((r) => ({
      id: String(r.id), source: r.source as string, quarter: r.quarter as string, text: r.text as string, terms: r.terms, score: r.score,
    }))
    setAsked({ q: question, hits })
  }
  // A promise row can hand us a query ("Find in transcripts").
  useEffect(() => {
    if (pending) { setOpen(true); run(pending); clearPending() }
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [open])

  const chips = (suggest.length ? suggest : DEFAULT_SUGGEST).slice(0, 5)
  const top = asked?.hits[0]?.score ?? 1

  return (
    <>
      <div className="dock fdock">
        <div className="fdock-row">
          <button type="button" className="fdock-pill ask-pill" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 60) }}
            aria-haspopup="dialog">
            <AskGlyph />
            <span className="ask-ph">{index ? `Ask about ${symbol}…` : `Ask about ${symbol}`}</span>
            <span className="ask-kbd">{index ? 'QUOTED' : 'N/A'}</span>
          </button>
          <button type="button" className="dz-round" aria-label="Search another company" onClick={onSearch}><SearchGlyph size={18} /></button>
        </div>
      </div>

      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="sheet ask-sheet" role="dialog" aria-modal="true" aria-label={`Ask about ${symbol}`}>
            <div className="ask-grab" aria-hidden="true" />
            <div className="ask-head">
              <div>
                <p className="label">Ask · {symbol}</p>
                <p className="ask-promise">
                  {index
                    ? <>Answers are quoted from {symbol}’s own {sourceNoun}, never generated.</>
                    : <>Ask isn’t available for {symbol} yet. It needs the transcript corpus, which is built for the research set only.</>}
                </p>
              </div>
              <button type="button" className="dz-round sm" aria-label="Close" onClick={() => setOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
              </button>
            </div>

            {index && (
              <>
                <form className="ask-form" onSubmit={(e) => { e.preventDefault(); run(q) }}>
                  <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="capex, margins, exports…"
                    aria-label={`Question about ${symbol}`} enterKeyHint="search" autoComplete="off" />
                  <button type="submit" className="ask-go" disabled={!q.trim()} aria-label="Search passages">
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                  </button>
                </form>
                <div className="ask-chips">
                  {chips.map((s) => <button key={s} type="button" className={`chip${asked?.q === s ? ' on' : ''}`} onClick={() => run(s)}>{s}</button>)}
                </div>

                {!asked && (
                  <p className="ask-meta num">{chunks!.chunks.length} PASSAGES · {nSources} SOURCES · KEYWORD RETRIEVAL</p>
                )}
                {asked && asked.hits.length === 0 && (
                  <div className="ask-empty">
                    <p>Nothing in {symbol}’s {sourceNoun} matches “{asked.q}”.</p>
                    <p className="dim">Try a metric, a segment or a product name.</p>
                  </div>
                )}
                {asked && asked.hits.length > 0 && (
                  <ol className="ask-hits">
                    {asked.hits.map((h, i) => (
                      <li key={h.id} className="ask-hit" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="ask-hit-top">
                          <span className="num ask-rank">{String(i + 1).padStart(2, '0')}</span>
                          <span className="ask-src">{h.source.includes(h.quarter) ? h.source : `${h.source} · ${h.quarter}`}</span>
                          <span className="ask-rel" aria-label={`Relevance ${Math.round((h.score / top) * 100)} percent`}>
                            <i style={{ width: `${Math.max(12, (h.score / top) * 100)}%` }} />
                          </span>
                        </div>
                        <blockquote><Marked text={snippet(h.text, h.terms)} terms={h.terms} /></blockquote>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="prov">Retrieved by keyword match · verbatim excerpts · no model in the loop</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function AskGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M3 3.5h10v7H8l-3 2.5v-2.5H3z" />
      <path d="M5.8 6.2h4.4M5.8 8.2h2.6" strokeLinecap="round" />
    </svg>
  )
}
