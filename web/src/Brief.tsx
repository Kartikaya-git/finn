import { useEffect, useMemo, useRef, useState } from 'react'
import { load, usingFixtures } from './data'
import { go, readLS, readLSArray, writeLS } from './store'
import { CATEGORIES, DEFAULT_RULES, WINDOWS, catLabel, market, triage, type Card, type CatMode, type WatchRules, type WindowKey } from './rules'
import { ago, asOf, num, pct, tone } from './fmt'
import { Spark } from './charts'
import { Search } from './Search'
import type { Brief as BriefT, Enrichment, Filing, Holding } from './types'

const LS_DISMISSED = 'finn.dismissed.v1'
const LS_RULES = 'finn.rules.v1'

export function Brief() {
  const [brief, setBrief] = useState<BriefT | null | undefined>(undefined)
  const [enrich, setEnrich] = useState<Enrichment>({})
  const [fixtures, setFixtures] = useState(false)
  const [win, setWin] = useState<WindowKey>('24h')
  const [rules, setRules] = useState<WatchRules>(() => readLS(LS_RULES, DEFAULT_RULES))
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(readLSArray(LS_DISMISSED)))
  const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null)
  const [sheet, setSheet] = useState(false)
  const [routineOpen, setRoutineOpen] = useState(false)

  useEffect(() => {
    load<BriefT>('brief.json').then(setBrief)
    load<Enrichment>('enrichment.json').then((e) => setEnrich(e ?? {}))
    usingFixtures().then(setFixtures)
  }, [])
  useEffect(() => writeLS(LS_RULES, rules), [rules])
  useEffect(() => writeLS(LS_DISMISSED, [...dismissed]), [dismissed])
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 4000)
    return () => clearTimeout(t)
  }, [undo])

  const days = WINDOWS.find((w) => w[0] === win)![1]
  const t = useMemo(() => (brief ? triage(brief, rules, days, dismissed) : null), [brief, rules, days, dismissed])

  const dismiss = (ids: string[], label: string) => {
    setDismissed((d) => new Set([...d, ...ids]))
    setUndo({ ids, label })
  }
  const restore = () => {
    if (!undo) return
    setDismissed((d) => { const n = new Set(d); undo.ids.forEach((i) => n.delete(i)); return n })
    setUndo(null)
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <span className="wordmark">FINN</span>
          {brief && <span className="asof">Data as of {asOf(brief.generated_at)}{fixtures && <span className="fixture"> · sample data</span>}</span>}
          <button className="icon" aria-label="Watch rules" onClick={() => setSheet(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
          </button>
        </div>
        <Search />
        <div className="chips" role="tablist" aria-label="Filing window">
          {WINDOWS.map(([k]) => (
            <button key={k} role="tab" aria-selected={k === win} className={`chip${k === win ? ' on' : ''}`} onClick={() => setWin(k)}>{k}</button>
          ))}
        </div>
      </header>

      {brief === undefined && <div className="skeleton"><i /><i /><i /></div>}
      {brief === null && <p className="empty">No Brief yet. Run <code>python -m finn build</code> to generate one.</p>}

      {brief && t && (
        <>
          <p className="summary">
            <b className={t.groups.length ? 'acc' : 'ok'}>{t.groups.length} need you</b>
            <span>·</span><b>{t.routine.length}</b> routine<span>·</span><b>{t.quiet.length}</b> quiet
          </p>

          <section aria-labelledby="h-needs">
            <h2 id="h-needs" className="sec">Needs you</h2>
            {t.groups.length === 0 && (
              <div className="clear">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                <span>{t.windowCardCount > 0 ? `All clear — you've worked through ${win}.` : `Nothing needs you in the last ${win}.`}</span>
                {days < 7 && <button className="link" onClick={() => setWin('7d')}>Widen to 7d</button>}
              </div>
            )}
            {t.groups.map((g) => (
              <div className="group" key={g.holding.symbol}>
                <div className="ghead">
                  <button className="gsym" onClick={() => go(`/d/${g.holding.symbol}`)}><b>{g.holding.symbol}</b><span>{g.holding.name}</span></button>
                  {g.cards.length > 1 && <button className="link small" onClick={() => dismiss(g.cards.map((c) => c.id), `${g.cards.length} ${g.holding.symbol} Cards`)}>Dismiss all</button>}
                </div>
                {g.cards.map((c) => (
                  <CardView key={c.id} card={c} holding={g.holding} genAt={brief.generated_at} enrich={enrich} onDismiss={() => dismiss([c.id], `${c.symbol} Card`)} />
                ))}
              </div>
            ))}
          </section>

          <section aria-labelledby="h-routine">
            <button id="h-routine" className="routine-row" aria-expanded={routineOpen} onClick={() => setRoutineOpen((o) => !o)} disabled={!t.routine.length}>
              <span><b>{t.routine.length}</b> routine filing{t.routine.length === 1 ? '' : 's'}</span>
              {t.routine.length > 0 && <svg className={`chev${routineOpen ? ' open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>}
            </button>
            {routineOpen && (
              <ul className="routine">
                {t.routine.map((f) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      <div className="rl1"><b>{f.symbol}</b><span className="rt">{f.title}</span><time>{ago(f.ts, brief.generated_at)}</time></div>
                      {(enrich[f.id]?.summary ?? f.summary) && <div className="rl2">{enrich[f.id]?.summary ?? f.summary}</div>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="h-quiet">
            <h2 id="h-quiet" className="sec">Quiet <span className="muted">· end of day</span></h2>
            <ul className="quiet">
              {t.quiet.map((h) => <QuietRow key={h.symbol} h={h} />)}
            </ul>
          </section>
          <footer className="foot">Every Holding appears once. Filings from screener.in · prices end-of-day.</footer>
        </>
      )}

      {undo && (
        <div className="toast" role="status">
          <span>Dismissed {undo.label}</span>
          <button onClick={restore}>Undo</button>
        </div>
      )}
      {sheet && <RulesSheet rules={rules} setRules={setRules} onClose={() => setSheet(false)} onReset={() => setDismissed(new Set())} dismissedCount={dismissed.size} />}
    </div>
  )
}

function QuietRow({ h }: { h: Holding }) {
  const m = market(h)
  return (
    <li>
      <button className="qrow" onClick={() => go(`/d/${h.symbol}`)}>
        <span className="qname"><b>{h.symbol}</b><span>{h.name}</span></span>
        <span className="qnum">{m ? num(m.close, 2) : '—'}</span>
        <span className={`qnum ${tone(m?.dayPct)}`}>{m ? pct(m.dayPct) : '—'}</span>
        <span className={`qnum vol${m && m.volX >= 1.5 ? ' hi' : ''}`}>{m ? `${num(m.volX, 1)}×` : '—'}</span>
        {m ? <Spark values={m.closes} /> : <span />}
      </button>
    </li>
  )
}

function CardView({ card, holding, genAt, enrich, onDismiss }: { card: Card; holding: Holding; genAt: string; enrich: Enrichment; onDismiss: () => void }) {
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)

  const leave = () => { setLeaving(true); setTimeout(onDismiss, 180) }
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY, locked: null }
  }
  const onMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y
    if (s.locked === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) s.locked = Math.abs(ddx) > Math.abs(ddy)
    if (s.locked) setDx(Math.min(0, ddx))
  }
  const onUp = () => {
    if (start.current?.locked && dx < -96) leave()
    else setDx(0)
    start.current = null
  }

  let tag: string, title: string, why: string, body: React.ReactNode, ts = card.ts
  if (card.kind === 'filing') {
    const f = card.filing
    // Exchange titles are boilerplate ("Announcement under Regulation 30 (LODR)-…");
    // the one-line summary is the actual news, so it leads.
    const e = enrich[f.id] ?? enrich[f.url]
    tag = catLabel(f.category); title = e?.summary ?? f.summary ?? f.title; why = f.why; ts = f.ts
    body = <FilingBody f={f} enrich={enrich} />
  } else if (card.kind === 'price') {
    tag = 'Price'; title = `${pct(card.m.dayPct)} today`
    body = <MoveBody m={card.m} line={`Closed ${num(card.m.close, 2)} on ${card.m.date}`} />
    why = 'day move beyond your Watch rule'
  } else {
    tag = 'Volume'; title = `Volume ${num(card.m.volX, 1)}× 20-day avg`; why = 'volume above your Watch rule'
    body = <MoveBody m={card.m} line={`Close ${num(card.m.close, 2)} · ${pct(card.m.dayPct)} on the day`} />
  }

  return (
    <article className={`card${leaving ? ' leaving' : ''}`} style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx && start.current ? 'none' : undefined }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="cmeta">
        <span className={`tag sev${card.sev}`}>{tag}</span>
        <time>{card.kind === 'filing' ? `${ago(ts, genAt)} ago` : 'last close'}</time>
      </div>
      <h3 className="ctitle">{title}</h3>
      <p className="why">{why}</p>
      {body}
      <div className="cactions">
        <button className="btn ghost" onClick={leave}>Dismiss</button>
        <button className="btn" onClick={() => go(`/d/${holding.symbol}`)}>Dig in</button>
      </div>
    </article>
  )
}

function MoveBody({ m, line }: { m: { closes: number[] }; line: string }) {
  return (
    <div className="move">
      <Spark values={m.closes} w={120} h={32} />
      <span className="muted">{line}<br />last 30 sessions</span>
    </div>
  )
}

function FilingBody({ f, enrich }: { f: Filing; enrich: Enrichment }) {
  const e = enrich[f.id] ?? enrich[f.url]
  const person = f.person ?? e?.person
  const summary = e?.summary ?? f.summary
  if (f.results?.rows?.length) {
    const r = f.results
    return (
      <div className="results">
        <table>
          <thead><tr><th>{r.period} · {r.unit}</th><th>Cur</th><th>QoQ</th><th>YoY</th></tr></thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.metric}>
                <td>{row.metric === 'EBITDA' ? r.ebitda_label || 'EBITDA' : row.metric}</td>
                <td>{num(row.cur)}</td>
                <td className={tone(row.qoq)}>{pct(row.qoq)}</td>
                <td className={tone(row.yoy)}>{pct(row.yoy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <a className="src" href={f.url} target="_blank" rel="noreferrer">Filing ↗</a>
      </div>
    )
  }
  if (person) {
    return (
      <div className="person">
        <div className="p1"><b>{person.name}</b><span className={`pill ${person.change === 'appointed' ? 'good' : 'watch'}`}>{person.change}</span></div>
        <div className="p2">{person.role}</div>
        {person.profile && <p className="p3">{person.profile}</p>}
        <a className="src" href={f.url} target="_blank" rel="noreferrer">Filing ↗</a>
      </div>
    )
  }
  return (
    <div className="other">
      <a className="src" href={f.url} target="_blank" rel="noreferrer">{summary ? f.title.replace(/^Announcement under Regulation 30 \(LODR\)-/, '') : 'Filing'} ↗</a>
    </div>
  )
}

function RulesSheet({ rules, setRules, onClose, onReset, dismissedCount }: { rules: WatchRules; setRules: (r: WatchRules) => void; onClose: () => void; onReset: () => void; dismissedCount: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const setCat = (c: string, m: CatMode) => {
    const cats = { ...rules.cats }
    if (m === 'default') delete cats[c]; else cats[c] = m
    setRules({ ...rules, cats })
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="h-rules" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheethead">
          <h2 id="h-rules">Watch rules</h2>
          <button className="link" onClick={onClose}>Done</button>
        </div>
        <p className="muted small">Changes re-triage the Brief instantly. Price rules use end-of-day closes.</p>
        <label className="slider">
          <span>Day move beyond <b>±{rules.dayMove.toFixed(1)}%</b></span>
          <input type="range" min={1} max={10} step={0.5} value={rules.dayMove} onChange={(e) => setRules({ ...rules, dayMove: +e.target.value })} />
        </label>
        <label className="slider">
          <span>Volume above <b>{rules.volMult.toFixed(1)}×</b> 20-day avg</span>
          <input type="range" min={1.2} max={5} step={0.1} value={rules.volMult} onChange={(e) => setRules({ ...rules, volMult: +e.target.value })} />
        </label>
        <h3 className="sec">Filing types</h3>
        <ul className="cats">
          {CATEGORIES.map(([c, label]) => {
            const m = rules.cats[c] ?? 'default'
            return (
              <li key={c}>
                <span>{label}</span>
                <div className="seg" role="radiogroup" aria-label={label}>
                  {(['card', 'default', 'routine'] as CatMode[]).map((x) => (
                    <button key={x} role="radio" aria-checked={m === x} className={m === x ? 'on' : ''} onClick={() => setCat(c, x)}>
                      {x === 'card' ? 'Card' : x === 'default' ? 'Default' : 'Routine'}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="sheetfoot">
          <button className="link" onClick={() => setRules(DEFAULT_RULES)}>Reset rules</button>
          {dismissedCount > 0 && <button className="link" onClick={onReset}>Restore {dismissedCount} dismissed</button>}
        </div>
      </div>
    </div>
  )
}
