import { useEffect, useMemo, useRef, useState } from 'react'
import { load } from './data'
import { go } from './store'
import type { Tickers } from './types'

export function Search() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const [tickers, setTickers] = useState<Tickers['tickers']>([])
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { load<Tickers>('tickers.json').then((t) => setTickers(t?.tickers ?? [])) }, [])

  const hits = useMemo(() => {
    const s = q.trim().toUpperCase()
    if (!s) return []
    const starts = tickers.filter((t) => t.symbol.startsWith(s))
    const name = tickers.filter((t) => !t.symbol.startsWith(s) && t.name.toUpperCase().includes(s))
    return [...starts, ...name].slice(0, 6)
  }, [q, tickers])

  const pick = (sym: string) => {
    setQ(''); setOpen(false); ref.current?.blur()
    go(`/d/${encodeURIComponent(sym.toUpperCase())}`)
  }
  return (
    <div className="search">
      <input
        ref={ref} value={q} placeholder="Any NSE ticker…" aria-label="Open a Dossier for any NSE ticker"
        autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="go"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
          if (e.key === 'Enter' && q.trim()) pick(hits[sel]?.symbol ?? q.trim())
          if (e.key === 'Escape') { setQ(''); ref.current?.blur() }
        }}
      />
      {open && hits.length > 0 && (
        <ul className="suggest" role="listbox">
          {hits.map((t, i) => (
            <li key={t.symbol} role="option" aria-selected={i === sel} className={i === sel ? 'sel' : ''} onMouseDown={() => pick(t.symbol)}>
              <b>{t.symbol}</b><span>{t.name}</span>
              {t.kind.includes('holding') && <em>Holding</em>}
              {t.kind.includes('research') && <em className="acc">Research</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
