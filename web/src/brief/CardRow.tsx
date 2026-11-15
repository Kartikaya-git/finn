import { useRef, useState } from 'react'
import { go } from '../store'
import { catLabel, type Card, type Market, type WatchRules } from '../rules'
import { ago, asOf, num, pct } from '../fmt'
import { Spark } from '../ui/charts'
import type { Enrichment, Filing, Holding, Person } from '../types'
import { Check, Chevron, Reveal, shortName, tidy } from './bits'

const SWIPE_CLEAR = 96
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  card: Card; holding: Holding; first: boolean; genAt: string; enrich: Enrichment; rules: WatchRules
  open: boolean; onToggle: () => void; onClear: () => void
}

function describe(card: Card, enrich: Enrichment, rules: WatchRules) {
  if (card.kind === 'filing') {
    const f = card.filing
    const e = enrich[f.id] ?? enrich[f.url]
    // Exchange titles are boilerplate ("Announcement under Regulation 30…"); the summary is the news.
    return { tag: catLabel(f.category), headline: tidy(e?.summary || f.summary || f.title), why: f.why, filing: f, person: f.person ?? e?.person }
  }
  const m = card.m
  if (card.kind === 'price') {
    return {
      tag: 'Price move',
      headline: `${m.dayPct < 0 ? 'Fell' : 'Rose'} ${num(Math.abs(m.dayPct), 1)}% to ₹${num(m.close, 2)} at the close`,
      why: `Beyond your ±${num(rules.dayMove, 1)}% day-move Watch rule`,
    }
  }
  return {
    tag: 'Volume',
    headline: `Traded ${num(m.volX, 1)}× its 20-day average volume`,
    why: `Above your ${num(rules.volMult, 1)}× volume Watch rule`,
  }
}

export function CardRow({ card, holding, first, genAt, enrich, rules, open, onToggle, onClear }: Props) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const start = useRef<{ x: number; y: number; lock: boolean | null } | null>(null)
  const swiped = useRef(false)

  const leave = () => {
    if (leaving) return
    setLeaving(true)
    setDx(0)
    window.setTimeout(onClear, reduced() ? 0 : 220)
  }
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY, lock: null }
    swiped.current = false
  }
  const onMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y
    if (s.lock === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      s.lock = Math.abs(ddx) > Math.abs(ddy) * 1.2
      if (s.lock) setDragging(true)
    }
    if (s.lock) {
      swiped.current = true
      // Resist past the threshold so it feels anchored.
      const x = Math.min(0, ddx)
      setDx(x < -SWIPE_CLEAR ? -SWIPE_CLEAR + (x + SWIPE_CLEAR) * 0.35 : x)
    }
  }
  const onUp = (e: React.PointerEvent) => {
    const s = start.current
    start.current = null
    setDragging(false)
    // A cancelled gesture (scroll took over, call came in) never clears.
    if (e.type === 'pointerup' && s?.lock && dx <= -SWIPE_CLEAR + 1) leave()
    else setDx(0)
  }

  const d = describe(card, enrich, rules)
  const ts = card.kind === 'filing' ? card.filing.ts : card.ts
  const armed = dx <= -SWIPE_CLEAR + 1
  const sev = card.sev === 0 ? 'sev0' : 'sev1'
  const bodyId = `bf-b-${card.id.replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <div className={`bf-cw${first ? '' : ' follow'}${leaving ? ' leaving' : ''}`}>
      <div className="bf-clip">
        <div className={`bf-under${armed ? ' armed' : ''}`} aria-hidden="true" style={{ width: Math.max(0, -dx) }}>
          <span><Check size={18} /></span>
        </div>
        <article
          className={`bf-card${open ? ' open' : ''}${dragging ? ' drag' : ''}`}
          style={dx ? { transform: `translateX(${dx}px)` } : undefined}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <i className={`bf-rail ${sev}`} aria-hidden="true" />
          <button
            type="button" className="bf-head" aria-expanded={open} aria-controls={bodyId}
            onClick={() => { if (swiped.current) { swiped.current = false; return } onToggle() }}
          >
            <span className="bf-meta">
              {first ? <span className="sym">{holding.symbol}</span> : <span className="bf-cont"><span className="bf-vh">{holding.symbol}</span></span>}
              <span className="pill">{d.tag}</span>
              <time className="bf-time" dateTime={ts}>{ago(ts, genAt)}</time>
              <Chevron />
            </span>
            <span className="bf-hl">{d.headline}</span>
            <span className="bf-why">{d.why}</span>
          </button>

          <Reveal open={open}>
            <div className="bf-body" id={bodyId}>
              {card.kind === 'filing' ? <FilingDetail f={card.filing} person={'person' in d ? d.person : undefined} /> : <MoveDetail m={card.m} kind={card.kind} />}
              <div className="bf-act">
                {card.kind === 'filing' && card.filing.url ? (
                  <a className="bf-src" href={card.filing.url} target="_blank" rel="noreferrer">
                    Filing <span aria-hidden="true">↗</span><span className="bf-src-t">{asOf(card.filing.ts)}</span>
                  </a>
                ) : (
                  <span className="bf-src muted">{shortName(holding.name)}</span>
                )}
                <button type="button" className="bf-btn ghost" onClick={leave}>Clear</button>
                <button type="button" className="bf-btn solid" onClick={() => go(`/d/${holding.symbol}`)}>Dig in <span aria-hidden="true">→</span></button>
              </div>
            </div>
          </Reveal>
        </article>
      </div>
    </div>
  )
}

function FilingDetail({ f, person }: { f: Filing; person?: Person }) {
  if (f.results?.rows?.length) {
    const r = f.results
    return (
      <table className="bf-res">
        <thead>
          <tr><th scope="col">{r.period} · {r.unit || '₹ Cr'}</th><th scope="col">Cur</th><th scope="col">QoQ</th><th scope="col">YoY</th></tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.metric}>
              <th scope="row">{row.metric === 'EBITDA' ? r.ebitda_label || 'EBITDA' : row.metric}</th>
              <td>{num(row.cur)}</td>
              <td className={sign(row.qoq)}>{pct(row.qoq)}</td>
              <td className={sign(row.yoy)}>{pct(row.yoy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  if (person) {
    const initials = person.name.replace(/^(Mr|Ms|Mrs|Dr|Shri|Smt)\.?\s+/i, '').split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join('')
    const tone = person.change === 'appointed' ? 'pos' : 'warn'
    return (
      <div className="bf-person">
        <div className="bf-person-h">
          <span className="bf-av" aria-hidden="true">{initials}</span>
          <div className="bf-person-id">
            <div className="bf-pname">{person.name}<span className={`pill ${tone}`}>{person.change[0].toUpperCase() + person.change.slice(1)}</span></div>
            <div className="bf-prole">{person.role}</div>
          </div>
        </div>
        {person.profile && <p className="bf-pprof">{person.profile}</p>}
      </div>
    )
  }
  return null
}

function MoveDetail({ m, kind }: { m: Market; kind: 'price' | 'volume' }) {
  return (
    <div className="bf-move">
      <div className="bf-move-chart"><Spark values={m.closes} w={340} h={64} tone="auto" /></div>
      <div className="bf-move-cap label">Last {m.closes.length} sessions</div>
      <dl className="bf-stats">
        <div><dt className="label">Close</dt><dd className="num">₹{num(m.close, 2)}</dd></div>
        <div><dt className="label">Day</dt><dd className={`num ${sign(m.dayPct)}`}>{pct(m.dayPct)}</dd></div>
        <div><dt className="label">Vol / 20d</dt><dd className={`num${kind === 'volume' || m.volX >= 1.5 ? ' warn' : ''}`}>{num(m.volX, 1)}×</dd></div>
      </dl>
    </div>
  )
}

const sign = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'pos' : 'neg')
