import { useEffect, useMemo, useRef, useState } from 'react'
import { load, usingFixtures } from '../data'
import { readLS, readLSArray, writeLS } from '../store'
import { DEFAULT_RULES, WINDOWS, market, triage, type WatchRules, type WindowKey } from '../rules'
import type { Brief as BriefT, Enrichment } from '../types'
import { Dock } from '../ui/Dock'
import { CardRow } from './CardRow'
import { Quiet, Routine } from './Sections'
import { RulesSheet } from './RulesSheet'
import { Check, Segmented, Sliders, plural } from './bits'
import './brief.css'

const LS_DISMISSED = 'finn.dismissed.v1'
const LS_RULES = 'finn.rules.v1'

const IST = { timeZone: 'Asia/Kolkata' } as const
const dayMonth = (d: Date) => d.toLocaleDateString('en-GB', { ...IST, day: 'numeric', month: 'short' }).toUpperCase()
function dateLine(genAt: string, eod: string | null) {
  const d = new Date(genAt)
  const wd = d.toLocaleDateString('en-GB', { ...IST, weekday: 'short' }).toUpperCase()
  return `${wd} ${dayMonth(d)}${eod ? ` · EOD ${dayMonth(new Date(`${eod}T12:00:00+05:30`))}` : ''}`
}

export function Brief() {
  const [brief, setBrief] = useState<BriefT | null | undefined>(undefined)
  const [enrich, setEnrich] = useState<Enrichment>({})
  const [fixtures, setFixtures] = useState(false)
  const [win, setWin] = useState<WindowKey>('24h')
  const [rules, setRules] = useState<WatchRules>(() => readLS(LS_RULES, DEFAULT_RULES))
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(readLSArray(LS_DISMISSED)))
  const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null)
  const [sheet, setSheet] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const undoTimer = useRef<number>()

  useEffect(() => {
    load<BriefT>('brief.json').then(setBrief)
    load<Enrichment>('enrichment.json').then((e) => setEnrich(e ?? {}))
    usingFixtures().then(setFixtures)
  }, [])
  useEffect(() => writeLS(LS_RULES, rules), [rules])
  useEffect(() => writeLS(LS_DISMISSED, [...dismissed]), [dismissed])
  useEffect(() => {
    window.clearTimeout(undoTimer.current)
    if (undo) undoTimer.current = window.setTimeout(() => setUndo(null), 5000)
    return () => window.clearTimeout(undoTimer.current)
  }, [undo])

  const days = WINDOWS.find((w) => w[0] === win)![1]
  const t = useMemo(() => (brief ? triage(brief, rules, days, dismissed) : null), [brief, rules, days, dismissed])
  const eod = useMemo(() => {
    const dates = (brief?.holdings ?? []).map((h) => market(h)?.date).filter((d): d is string => !!d)
    return dates.length ? dates.sort()[dates.length - 1] : null
  }, [brief])

  const clear = (id: string, symbol: string) => {
    setDismissed((d) => new Set(d).add(id))
    setExpanded((e) => (e === id ? null : e))
    // Clears made while the toast is up fold into one undo.
    setUndo((u) => (u ? { ids: [...u.ids, id], label: `${u.ids.length + 1} Cards` } : { ids: [id], label: symbol }))
  }
  const restore = () => {
    if (!undo) return
    setDismissed((d) => {
      const n = new Set(d)
      undo.ids.forEach((i) => n.delete(i))
      return n
    })
    setUndo(null)
  }

  const custom = rules.dayMove !== DEFAULT_RULES.dayMove || rules.volMult !== DEFAULT_RULES.volMult || Object.keys(rules.cats).length > 0
  const dock = (
    <Dock
      right={
        <button type="button" className="bf-rulesbtn" aria-label="Watch rules" onClick={() => setSheet(true)}>
          <Sliders />
          {custom && <i className="bf-rulesdot" aria-label="Custom rules active" />}
        </button>
      }
    />
  )

  if (brief === undefined) return <div className="bf">{<Skeleton />}{dock}</div>
  if (brief === null || !t)
    return (
      <div className="bf">
        <Top line="NO BRIEF YET" fixtures={false} />
        <h1 className="bf-verdict">Nothing to read yet.</h1>
        <p className="bf-deck">Run <code>python -m finn build</code> to write the first Brief.</p>
        {dock}
      </div>
    )

  const open = t.groups.reduce((n, g) => n + g.cards.length, 0)
  const total = t.windowCardCount
  const cleared = Math.max(0, total - open)

  return (
    <div className="bf">
      <Top line={dateLine(brief.generated_at, eod)} fixtures={fixtures} />

      <header className="bf-mast">
        <h1 className="bf-verdict" aria-live="polite">
          {open === 0 ? (
            <><span>All clear.</span><span className="bf-ok"><Check size={18} /></span></>
          ) : open === 1 ? (
            <><em>One</em> thing needs you.</>
          ) : (
            <><em>{open}</em> things need you.</>
          )}
        </h1>
        <p className="bf-deck">
          <span className="num">{t.routine.length}</span> routine {plural(t.routine.length, 'filing')} folded
          <span className="bf-dot">·</span>
          <span className="num">{t.quiet.length}</span> {plural(t.quiet.length, 'holding')} quiet
        </p>

        <div className="bf-meter" role="img" aria-label={`${cleared} of ${total} Cards cleared`}>
          {total === 0 ? <i /> : Array.from({ length: total }, (_, i) => <i key={i} className={i < open ? 'on' : ''} />)}
        </div>
        <div className="bf-ctrl">
          <span className="bf-tally">
            {total === 0 ? <>No Cards in {win}</> : <><b>{cleared}</b> of {total} cleared</>}
          </span>
          <Segmented label="Window" options={WINDOWS.map(([k]) => [k, k] as const)} value={win} onChange={(k) => { setWin(k); setExpanded(null) }} />
        </div>

        {open === 0 && days < 7 && (
          <p className="bf-widen">
            Nothing open in the last {win}.
            <button type="button" onClick={() => setWin('7d')}>Widen to 7d <span aria-hidden="true">→</span></button>
          </p>
        )}
      </header>

      {open > 0 && (
        <section className="bf-sec" aria-labelledby="bf-h-needs">
          <div className="bf-sech">
            <h2 id="bf-h-needs" className="label">Needs you</h2>
            <span className="label">Ranked · tap to open</span>
          </div>
          <div className="bf-panel">
            {t.groups.map((g) =>
              g.cards.map((c, i) => (
                <CardRow
                  key={c.id} card={c} holding={g.holding} first={i === 0} genAt={brief.generated_at} enrich={enrich} rules={rules}
                  open={expanded === c.id} onToggle={() => setExpanded((e) => (e === c.id ? null : c.id))}
                  onClear={() => clear(c.id, c.symbol)}
                />
              )),
            )}
          </div>
        </section>
      )}

      <Routine items={t.routine} enrich={enrich} genAt={brief.generated_at} />
      <Quiet holdings={t.quiet} eod={eod ? dayMonth(new Date(`${eod}T12:00:00+05:30`)) : ''} />

      <footer className="prov bf-foot">
        Every Holding appears once · Filings via NSE/BSE · Prices end of day
        {fixtures && <> · Sample data</>}
      </footer>

      {undo && (
        <div className="toast" role="status">
          <span>Cleared {undo.label}</span>
          <button type="button" onClick={restore}>Undo</button>
        </div>
      )}
      {sheet && (
        <RulesSheet
          brief={brief} rules={rules} setRules={setRules} onClose={() => setSheet(false)}
          live={{ open, routine: t.routine.length, win }}
          dismissedCount={dismissed.size} onRestore={() => { setDismissed(new Set()); setUndo(null) }}
        />
      )}
      {dock}
    </div>
  )
}

function Top({ line, fixtures }: { line: string; fixtures: boolean }) {
  return (
    <div className="bf-top">
      <span className="bf-mark"><i aria-hidden="true" />FINN</span>
      <span className="bf-date">
        {line}
        {fixtures && <span className="bf-fixture" title="The pipeline has not run; showing bundled fixtures"> · SAMPLE</span>}
      </span>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the Brief">
      <div className="bf-top"><span className="bf-mark"><i aria-hidden="true" />FINN</span><span className="skel" style={{ width: 132, height: 10 }} /></div>
      <div className="bf-mast">
        <span className="skel" style={{ width: '78%', height: 34, marginTop: 4 }} />
        <span className="skel" style={{ width: '64%', height: 13, marginTop: 14 }} />
        <span className="skel" style={{ width: '100%', height: 4, marginTop: 22 }} />
        <span className="skel" style={{ width: 160, height: 36, marginTop: 12, marginLeft: 'auto', borderRadius: 999 }} />
      </div>
      <div className="bf-sec">
        <div className="bf-panel">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bf-skrow">
              <span className="skel" style={{ width: 120, height: 11 }} />
              <span className="skel" style={{ width: '92%', height: 14, marginTop: 10 }} />
              <span className="skel" style={{ width: '58%', height: 14, marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
