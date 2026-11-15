import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, DEFAULT_RULES, market, type CatMode, type WatchRules } from '../rules'
import { num } from '../fmt'
import type { Brief } from '../types'
import { Segmented, plural } from './bits'

const MODES = [['card', 'Card'], ['default', 'Auto'], ['routine', 'Routine']] as const

interface Props {
  brief: Brief; rules: WatchRules; setRules: (r: WatchRules) => void; onClose: () => void
  live: { open: number; routine: number; win: string }
  dismissedCount: number; onRestore: () => void
}

export function RulesSheet({ brief, rules, setRules, onClose, live, dismissedCount, onRestore }: Props) {
  const done = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    done.current?.focus()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const markets = useMemo(() => brief.holdings.map(market).filter((m) => m != null), [brief])
  const pxHits = markets.filter((m) => Math.abs(m.dayPct) >= rules.dayMove).length
  const volHits = markets.filter((m) => m.volX >= rules.volMult).length

  const setCat = (c: string, m: CatMode) => {
    const cats = { ...rules.cats }
    if (m === 'default') delete cats[c]
    else cats[c] = m
    setRules({ ...rules, cats })
  }
  const isDefault = rules.dayMove === DEFAULT_RULES.dayMove && rules.volMult === DEFAULT_RULES.volMult && Object.keys(rules.cats).length === 0

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet bf-sheet" role="dialog" aria-modal="true" aria-labelledby="bf-h-rules" onClick={(e) => e.stopPropagation()}>
        <div className="bf-sh-head">
          <i className="bf-grab" aria-hidden="true" />
          <div className="bf-sh-title">
            <h2 id="bf-h-rules">Watch rules</h2>
            <button ref={done} type="button" className="bf-done" onClick={onClose}>Done</button>
          </div>
          <p className="bf-sh-live" aria-live="polite">
            <span className={live.open ? 'signal' : ''}><b className="num">{live.open}</b> open {plural(live.open, 'Card')}</span>
            <span className="bf-dot">·</span>
            <span><b className="num">{live.routine}</b> routine</span>
            <span className="bf-dot">·</span>
            <span>last {live.win}</span>
          </p>
        </div>

        <Rule
          name="Day move" value={`±${num(rules.dayMove, 1)}%`} min={1} max={10} step={0.5} v={rules.dayMove}
          onChange={(dayMove) => setRules({ ...rules, dayMove })}
          note={`${pxHits} ${plural(pxHits, 'Holding')} moved this much at the last close`}
        />
        <Rule
          name="Volume" value={`${num(rules.volMult, 1)}× avg`} min={1.2} max={5} step={0.1} v={rules.volMult}
          onChange={(volMult) => setRules({ ...rules, volMult })}
          note={`${volHits} ${plural(volHits, 'Holding')} traded this heavily vs its 20-day average`}
        />

        <div className="bf-sh-sec">
          <h3 className="label">Filing types</h3>
          <p className="bf-sh-note">Auto lets FINN judge each Filing. Card always raises one; Routine always folds it.</p>
          <ul className="bf-cats">
            {CATEGORIES.map(([c, label]) => {
              const m = rules.cats[c] ?? 'default'
              return (
                <li key={c} className={m !== 'default' ? 'set' : ''}>
                  <span>{label}</span>
                  <Segmented size="sm" label={label} options={MODES} value={m} onChange={(x) => setCat(c, x)} />
                </li>
              )
            })}
          </ul>
        </div>

        <PhoneAlerts />

        <div className="bf-sh-foot">
          <button type="button" className="bf-btn ghost" disabled={isDefault} onClick={() => setRules(DEFAULT_RULES)}>Reset rules</button>
          <button type="button" className="bf-btn ghost" disabled={dismissedCount === 0} onClick={onRestore}>
            {dismissedCount ? `Restore ${dismissedCount} cleared` : 'Nothing cleared'}
          </button>
        </div>
      </div>
    </div>
  )
}

const NTFY_TOPIC = 'finn-kartikaya-portfolio'

function PhoneAlerts() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const test = async () => {
    setState('sending')
    try {
      const r = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        body: 'Test alert from FINN. If you can read this, phone alerts work.',
        headers: { Title: 'FINN test alert', Tags: 'bell' },
      })
      setState(r.ok ? 'sent' : 'failed')
    } catch {
      setState('failed')
    }
  }
  return (
    <div className="bf-sh-sec">
      <h3 className="label">Phone alerts</h3>
      <p className="bf-sh-note">
        Get a notification the moment a filing needs you or a stock crosses your Watch rule. FINN checks every 30 minutes during market hours.
      </p>
      <div className="bf-sh-foot">
        <a className="bf-btn solid" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href={`https://ntfy.sh/${NTFY_TOPIC}`} target="_blank" rel="noreferrer">Subscribe on this phone</a>
        <button type="button" className="bf-btn ghost" disabled={state === 'sending'} onClick={test} aria-live="polite">
          {state === 'sent' ? 'Sent ✓' : state === 'failed' ? 'Failed, try again' : state === 'sending' ? 'Sending…' : 'Send a test alert'}
        </button>
      </div>
      <p className="bf-sh-note">or install the free ntfy app and subscribe to <b>{NTFY_TOPIC}</b></p>
    </div>
  )
}

function Rule({ name, value, min, max, step, v, onChange, note }: {
  name: string; value: string; min: number; max: number; step: number; v: number; onChange: (v: number) => void; note: string
}) {
  const p = ((v - min) / (max - min)) * 100
  return (
    <label className="bf-rule">
      <span className="bf-rule-h"><span>{name}</span><span className="num">{value}</span></span>
      <input
        type="range" className="bf-range" min={min} max={max} step={step} value={v}
        style={{ ['--p' as string]: `${p}%` }} onChange={(e) => onChange(+e.target.value)}
      />
      <span className="bf-rule-n">{note}</span>
    </label>
  )
}
