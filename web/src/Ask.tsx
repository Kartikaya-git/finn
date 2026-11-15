import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import type { Chunks } from './types'

interface Hit { id: string; source: string; quarter: string; text: string; terms: string[] }
interface Turn { q: string; hits: Hit[] }

const STOP = new Set('the a an of to in on for and or is are was were be what how why did does do with about their its it this that from by at as has have had will would can could they them management company'.split(' '))

function snippet(text: string, terms: string[], len = 340): string {
  const lower = text.toLowerCase()
  const first = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, first - 120)
  const s = text.slice(start, start + len)
  return (start > 0 ? '…' : '') + s + (start + len < text.length ? '…' : '')
}
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>
}

export function AskThread({ symbol, chunks }: { symbol: string; chunks: Chunks | null }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [q, setQ] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const index = useMemo(() => {
    if (!chunks?.chunks?.length) return null
    const ms = new MiniSearch<Chunks['chunks'][number]>({
      fields: ['text', 'quarter', 'source'], storeFields: ['source', 'quarter', 'text'],
      processTerm: (t) => (STOP.has(t.toLowerCase()) ? null : t.toLowerCase()),
      searchOptions: { prefix: true, fuzzy: 0.2, boost: { text: 2 } },
    })
    ms.addAll(chunks.chunks)
    return ms
  }, [chunks])
  useEffect(() => { if (turns.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [turns])

  const ask = (text = q) => {
    const question = text.trim()
    if (!question || !index) return
    const hits = index.search(question).slice(0, 3).map((r) => ({ id: String(r.id), source: r.source as string, quarter: r.quarter as string, text: r.text as string, terms: r.terms }))
    setTurns((t) => [...t, { q: question, hits }])
    setQ('')
  }

  return (
    <>
      <section className="dsec ask" aria-labelledby="h-ask">
        <div className="dhead"><h2 id="h-ask">Ask</h2><span className="prov">from transcripts · retrieval only</span></div>
        {!index ? (
          <p className="muted">Ask is available for research-set companies.</p>
        ) : (
          <>
            <p className="muted small">Answers come only from {symbol}'s own concall transcripts — the passages are quoted, never paraphrased.</p>
            {turns.length === 0 && (
              <div className="suggestions">
                {['capacity utilisation', 'margin guidance', 'working capital', 'exports'].map((s) => (
                  <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className="turn">
                <p className="q">{t.q}</p>
                {t.hits.length === 0 && <p className="muted">Nothing in the transcripts matches that. Try a metric or a segment name.</p>}
                {t.hits.map((h) => (
                  <blockquote key={h.id} className="passage">
                    <p><Highlight text={snippet(h.text, h.terms)} terms={h.terms} /></p>
                    <cite>{h.source.includes(h.quarter) ? h.source : `${h.source} · ${h.quarter}`}</cite>
                  </blockquote>
                ))}
              </div>
            ))}
            <div ref={endRef} />
          </>
        )}
      </section>
      {index && (
        <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask() }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask about ${symbol}…`} aria-label={`Ask about ${symbol}`} enterKeyHint="search" />
          <button type="submit" className="btn" disabled={!q.trim()}>Ask</button>
        </form>
      )}
    </>
  )
}
