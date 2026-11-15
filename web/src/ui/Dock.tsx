import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { load } from '../data'
import { go } from '../store'
import type { Kind, Tickers } from '../types'
import './ui.css'

type T = Tickers['tickers'][number]

const BADGE: Record<Kind, { label: string; tone: string }> = {
  holding: { label: 'Holding', tone: 'signal' },
  research: { label: 'Research', tone: 'info' },
  indexed: { label: 'Indexed', tone: '' },
}
/** The single most useful badge for a ticker: Holding beats Research beats Indexed. */
export function kindBadge(kind: Kind[]) {
  const k: Kind = kind.includes('holding') ? 'holding' : kind.includes('research') ? 'research' : 'indexed'
  return BADGE[k]
}

export function SearchGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.6" />
      <path d="M10.4 10.4 13.6 13.6" />
    </svg>
  )
}

export function Dock({ right }: { right?: ReactNode }) {
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const [sel, setSel] = useState(0)
  const [all, setAll] = useState<T[]>([])
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { load<Tickers>('tickers.json').then((t) => setAll(t?.tickers ?? [])) }, [])

  const hits = useMemo(() => {
    const s = q.trim().toUpperCase()
    if (!s) return []
    const exact = all.filter((t) => t.symbol === s)
    const starts = all.filter((t) => t.symbol !== s && t.symbol.startsWith(s))
    const name = all.filter((t) => !t.symbol.startsWith(s) && t.name.toUpperCase().includes(s))
    return [...exact, ...starts, ...name].slice(0, 6)
  }, [q, all])

  const open = (sym: string) => {
    const s = sym.trim().toUpperCase()
    if (!s) return
    setQ(''); setFocus(false); input.current?.blur()
    go(`/d/${encodeURIComponent(s)}`)
  }
  const raw = q.trim().toUpperCase()
  const showList = focus && raw.length > 0
  const unknown = (raw.length >= 3 || hits.length === 0) && raw.length > 0 && !hits.some((h) => h.symbol === raw)

  return (
    <div className="dock fdock">
      {showList && (
        <div className="fdock-list" role="listbox" id="fdock-list" aria-label="Matching companies">
          {hits.map((t, i) => {
            const b = kindBadge(t.kind)
            return (
              <button
                key={t.symbol} type="button" role="option" aria-selected={i === sel}
                className={`fdock-opt${i === sel ? ' on' : ''}`}
                onPointerDown={(e) => { e.preventDefault(); open(t.symbol) }}
                onClick={() => open(t.symbol)}
              >
                <span className="sym">{t.symbol}</span>
                <span className="fdock-name">{t.name}</span>
                <span className={`pill ${b.tone}`}>{b.label}</span>
              </button>
            )
          })}
          {unknown && (
            <button type="button" className={`fdock-opt ghost${hits.length === 0 ? ' on' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); open(raw) }} onClick={() => open(raw)}>
              <span className="sym">{raw}</span>
              <span className="fdock-name">Open Dossier anyway</span>
              <span className="fdock-arrow" aria-hidden="true">↵</span>
            </button>
          )}
        </div>
      )}
      <div className="fdock-row">
        <label className={`fdock-pill${focus ? ' focus' : ''}`}>
          <SearchGlyph />
          <input
            ref={input} value={q} placeholder="Search any NSE company"
            aria-label="Search any NSE company" aria-controls="fdock-list" aria-expanded={showList}
            autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="go"
            onChange={(e) => { setQ(e.target.value); setSel(0) }}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, Math.max(hits.length - 1, 0))) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
              if (e.key === 'Enter') { e.preventDefault(); open(hits[sel]?.symbol ?? raw) }
              if (e.key === 'Escape') { setQ(''); input.current?.blur() }
            }}
          />
          {q && <button type="button" className="fdock-clear" aria-label="Clear search" onPointerDown={(e) => { e.preventDefault(); setQ('') }}>×</button>}
        </label>
        {right}
      </div>
    </div>
  )
}
