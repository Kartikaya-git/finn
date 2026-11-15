import { useState } from 'react'
import { go } from '../store'
import { market } from '../rules'
import { ago, num, pct } from '../fmt'
import { Spark } from '../ui/charts'
import type { Enrichment, Filing, Holding } from '../types'
import { Chevron, Reveal, plural, shortName, tidy } from './bits'

export function Routine({ items, enrich, genAt }: { items: Filing[]; enrich: Enrichment; genAt: string }) {
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  const syms = [...new Set(items.map((f) => f.symbol))]
  const more = syms.length - 3
  return (
    <section className="bf-sec bf-routine" aria-label="Routine">
      <button type="button" className={`bf-fold${open ? ' open' : ''}`} aria-expanded={open} aria-controls="bf-routine-list" onClick={() => setOpen((o) => !o)}>
        <span className="bf-fold-t"><span className="num">{items.length}</span> routine {plural(items.length, 'filing')}</span>
        <span className="bf-fold-s">{syms.slice(0, 3).join(' · ')}{more > 0 ? ` +${more}` : ''}</span>
        <Chevron />
      </button>
      <Reveal open={open}>
        <ul className="bf-rlist" id="bf-routine-list">
          {items.map((f) => {
            const e = enrich[f.id] ?? enrich[f.url]
            return (
              <li key={f.id}>
                <a href={f.url} target="_blank" rel="noreferrer">
                  <span className="sym">{f.symbol}</span>
                  <span className="bf-rsum">{tidy(e?.summary || f.summary || f.title)}</span>
                  <time className="bf-time" dateTime={f.ts}>{ago(f.ts, genAt)}</time>
                </a>
              </li>
            )
          })}
        </ul>
      </Reveal>
    </section>
  )
}

export function Quiet({ holdings, eod }: { holdings: Holding[]; eod: string }) {
  if (!holdings.length) return null
  return (
    <section className="bf-sec" aria-labelledby="bf-h-quiet">
      <div className="bf-sech">
        <h2 id="bf-h-quiet" className="label">Quiet</h2>
        <span className="label">{holdings.length} {plural(holdings.length, 'holding')}{eod ? ` · EOD ${eod}` : ''}</span>
      </div>
      <ul className="bf-quiet">
        {holdings.map((h) => {
          const m = market(h)
          const hot = !!m && m.volX >= 1.5
          return (
            <li key={h.symbol}>
              <button type="button" className="bf-q" onClick={() => go(`/d/${h.symbol}`)} aria-label={`${h.symbol}, ${h.name}. Open Dossier`}>
                <span className="bf-q-id">
                  <span className="sym">{h.symbol}</span>
                  <span className="bf-q-name">{shortName(h.name)}</span>
                </span>
                <span className="bf-q-spark">{m && <Spark values={m.closes} w={56} h={22} tone="auto" />}</span>
                <span className="bf-q-px">
                  <span className="num bf-q-close">{m ? num(m.close, 2) : '—'}</span>
                  <span className={`num bf-q-day ${m ? (m.dayPct > 0 ? 'pos' : m.dayPct < 0 ? 'neg' : '') : ''}`}>{m ? pct(m.dayPct) : '—'}</span>
                </span>
                <span className={`num bf-q-vol${hot ? ' warn' : ''}`} title="Volume vs 20-day average">{m ? `${num(m.volX, 1)}×` : '—'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
