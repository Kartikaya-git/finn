import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { load } from '../data'
import { crore, num, pct } from '../fmt'
import { go } from '../store'
import type { Chunks, Dossier as D, Research, Tickers } from '../types'
import { Dock } from '../ui/Dock'
import { AskBar } from './Ask'
import { VERDICT_LABEL, computedVerdict, corpus, isLender, tally, word } from './model'
import { Balance, BullBear, Business, Cash, Flags, Narrative, Numbers, Promises, Sources, VerdictBar } from './sections'
import './dossier.css'

type State = { status: 'loading' } | { status: 'missing'; name: string | null } | { status: 'ready'; d: D; r: Research | null; c: Chunks | null }

export function Dossier({ symbol }: { symbol: string }) {
  const [s, setS] = useState<State>({ status: 'loading' })
  useEffect(() => {
    let live = true
    window.scrollTo(0, 0)
    Promise.all([
      load<D>(`dossier/${symbol}.json`),
      load<Research>(`research/${symbol}.json`),
      load<Chunks>(`research/${symbol}.chunks.json`),
      load<Tickers>('tickers.json'),
    ]).then(([d, r, c, t]) => {
      if (!live) return
      if (!d) setS({ status: 'missing', name: t?.tickers.find((x) => x.symbol === symbol)?.name ?? null })
      else setS({ status: 'ready', d, r, c })
    })
    return () => { live = false }
  }, [symbol])

  if (s.status === 'loading') return <Skeleton symbol={symbol} />
  if (s.status === 'missing') return <NotIndexed symbol={symbol} name={s.name} />
  return <Ready d={s.d} r={s.r} c={s.c} />
}

/* ---------- top bar ---------- */

function TopBar({ symbol, name, right }: { symbol: string; name?: string | null; right?: React.ReactNode }) {
  return (
    <div className="dz-top">
      <button type="button" className="dz-back" aria-label="Back to the Brief" onClick={() => go('/')}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3.5 5.5 9l5.5 5.5" /></svg>
      </button>
      <div className="dz-id">
        <span className="sym">{symbol}</span>
        {name && <span className="dz-name">{name}</span>}
      </div>
      {right}
    </div>
  )
}

/* ---------- ready ---------- */

interface Tab { id: string; label: string; n?: number }

function Ready({ d, r, c }: { d: D; r: Research | null; c: Chunks | null }) {
  const [searching, setSearching] = useState(false)
  const [pendingQ, setPendingQ] = useState<string | null>(null)
  const src = useMemo(() => (r ? corpus(r, c) : null), [r, c])
  const via = src?.noun === 'investor presentations' ? 'From investor presentations' : 'From transcripts'

  const tabs: Tab[] = [
    ...(r?.promises.length ? [{ id: 'promises', label: 'Promises', n: r.promises.length }] : []),
    ...(r && (r.narrative_vs_numbers.length || r.guidance.length) ? [{ id: 'narrative', label: 'Narrative', n: r.narrative_vs_numbers.length || undefined }] : []),
    ...(d.quarters.length ? [{ id: 'numbers', label: 'Numbers' }] : []),
    ...(d.annual.length ? [{ id: 'cash', label: 'Cash' }, { id: 'balance', label: 'Balance sheet' }] : []),
    ...(d.flags.length ? [{ id: 'flags', label: 'Flags', n: d.flags.length }] : []),
    ...(r && (r.bull.length || r.bear.length) ? [{ id: 'bullbear', label: 'Bull/Bear' }] : []),
    { id: 'business', label: 'Business' },
    ...(d.sources.length ? [{ id: 'sources', label: 'Sources', n: d.sources.length }] : []),
  ]
  const active = useActiveSection(tabs.map((t) => t.id))
  const scrolled = useScrolledPast(72)

  const suggest = useMemo(() => {
    const fromGuide = (r?.guidance ?? []).map((g) => g.metric.trim().toLowerCase()).filter((m) => m.length > 2 && m.length <= 22)
    return [...new Set([...fromGuide, 'capex', 'demand', 'margin'])].slice(0, 5)
  }, [r])

  return (
    <div className="dz">
      <header className="dz-head">
        <TopBar symbol={d.symbol} name={d.name} right={
          <div className={`dz-quote num${scrolled ? ' on' : ''}`} aria-hidden={!scrolled}>
            <span>{num(d.price.close, 2)}</span>
            <span className={d.price.change_pct > 0 ? 'pos' : d.price.change_pct < 0 ? 'neg' : 'dim'}>{pct(d.price.change_pct)}</span>
          </div>
        } />
      </header>

      <dl className="strip num" aria-label="Price and valuation">
        <div><dt>Close</dt><dd>₹{num(d.price.close, 2)}</dd></div>
        <div><dt>Day</dt><dd className={d.price.change_pct > 0 ? 'pos' : d.price.change_pct < 0 ? 'neg' : ''}>{pct(d.price.change_pct)}</dd></div>
        <div><dt>MCap</dt><dd>{crore(d.price.mcap_cr)}</dd></div>
        <div><dt>P/E</dt><dd>{num(d.price.pe, 1)}</dd></div>
        <div><dt>{isLender(d) ? 'ROE' : 'ROCE'}</dt><dd>{isLender(d) ? (d.price.roe == null ? '—' : `${num(d.price.roe, 1)}%`) : d.price.roce == null ? '—' : `${num(d.price.roce, 1)}%`}</dd></div>
      </dl>

      {r && r.promises.length ? <HeroResearch r={r} src={src!} /> : <HeroComputed d={d} hasResearch={!!r} />}

      <Tabs tabs={tabs} active={active} />

      <div className="dz-body">
        {r && r.promises.length > 0 && <Promises r={r} via={via} onFind={(q) => setPendingQ(q)} />}
        {r && (r.narrative_vs_numbers.length > 0 || r.guidance.length > 0) && <Narrative r={r} via={via} />}
        {d.quarters.length > 0 && <Numbers d={d} />}
        {d.annual.length > 0 && <Cash d={d} />}
        {d.annual.length > 0 && <Balance d={d} />}
        {d.flags.length > 0 && <Flags d={d} />}
        {r && (r.bull.length > 0 || r.bear.length > 0) && <BullBear r={r} via={via} />}
        <Business d={d} r={r} via={via} />
        {d.sources.length > 0 && <Sources d={d} />}
        <p className="dz-end num">FINN · DOSSIER {d.symbol} · BUILT {new Date(d.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</p>
      </div>

      {searching
        ? <Dock right={<button type="button" className="dz-round" aria-label="Back to Ask" onClick={() => setSearching(false)}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>} />
        : <AskBar symbol={d.symbol} chunks={c} sourceNoun={src?.noun ?? 'concall transcripts'} suggest={suggest}
            onSearch={() => setSearching(true)} pending={pendingQ} clearPending={() => setPendingQ(null)} />}
    </div>
  )
}

/* ---------- hero ---------- */

function HeroResearch({ r, src }: { r: Research; src: ReturnType<typeof corpus> }) {
  const t = tally(r)
  const total = r.promises.length
  const nv = r.narrative_vs_numbers
  const held = nv.filter((x) => x.agrees).length
  return (
    <section className="hero" aria-labelledby="hero-h">
      <p className="label">The verdict</p>
      <h1 id="hero-h" className="hero-h">
        Management kept <em>{word(t.kept)}</em> of {word(total)} promise{total > 1 ? 's' : ''}{t.missed ? <>, and missed <em className="neg">{word(t.missed)}</em></> : ''}.
      </h1>
      <VerdictBar counts={t} total={total} big />
      <ul className="hero-key num">
        {(['kept', 'partly', 'missed', 'pending'] as const).map((k) => (
          <li key={k} className={t[k] ? '' : 'zero'}><i className={`vb-${k}`} />{t[k]} {VERDICT_LABEL[k].toLowerCase()}</li>
        ))}
      </ul>
      {t.partly > 0 && (
        <p className="hero-sub">Counting partly as half, <span className="num">{(t.kept + t.partly / 2).toFixed(1)}</span> of <span className="num">{total - t.pending}</span> decided promises were met.</p>
      )}
      {nv.length > 0 && (
        <a className="hero-nv" href="#s-narrative" onClick={(e) => { e.preventDefault(); scrollToSection('narrative') }}>
          <span className="hero-nv-n num"><b className={held === nv.length ? 'pos' : held === 0 ? 'neg' : 'warn'}>{held}</b>/{nv.length}</span>
          <span>of management’s claims hold up against the reported numbers</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
        </a>
      )}
      <p className="prov">From {src.text} · {r.model}</p>
    </section>
  )
}

function HeroComputed({ d, hasResearch }: { d: D; hasResearch: boolean }) {
  const c = d.computed
  const n = { good: 0, watch: 0, bad: 0 }
  d.flags.forEach((f) => n[f.level]++)
  return (
    <section className="hero" aria-labelledby="hero-h">
      <p className="label">From the filings</p>
      <h1 id="hero-h" className="hero-h">{computedVerdict(d)}</h1>
      <div className="vbar lg" role="img" aria-label={`${n.good} healthy, ${n.watch} watch, ${n.bad} red flags`}>
        {(['good', 'watch', 'bad'] as const).flatMap((k) => Array.from({ length: n[k] }, (_, i) => <i key={k + i} className={`vb-${k}`} />))}
      </div>
      <ul className="hero-key num">
        <li className={n.good ? '' : 'zero'}><i className="vb-good" />{n.good} healthy</li>
        <li className={n.watch ? '' : 'zero'}><i className="vb-watch" />{n.watch} watch</li>
        <li className={n.bad ? '' : 'zero'}><i className="vb-bad" />{n.bad} red</li>
      </ul>
      <p className="hero-figs num">
        <span>REV CAGR 3Y <b className={c.revenue_cagr_3y != null && c.revenue_cagr_3y < 0 ? 'neg' : ''}>{pct(c.revenue_cagr_3y)}</b></span>
        <span>CFO/PAT 5Y <b>{c.cfo_to_pat_5y == null ? '—' : c.cfo_to_pat_5y.toFixed(2)}</b></span>
        <span>D/E <b>{c.de_ratio == null ? '—' : c.de_ratio.toFixed(2)}</b></span>
      </p>
      <p className="hero-note">
        {hasResearch ? 'Transcript analysis found no trackable promises' : 'Transcript analysis isn’t built'} for {d.symbol} yet, so there is no promises-vs-delivered check. Everything below is computed from filings.
      </p>
      <p className="prov">Computed from filings · deterministic rules</p>
    </section>
  )
}

/* ---------- tabs ---------- */

function headOffset() {
  const h = document.querySelector('.dz-head') as HTMLElement | null
  const t = document.querySelector('.tabs') as HTMLElement | null
  return (h?.offsetHeight ?? 52) + (t?.offsetHeight ?? 41) + 4
}
function useScrolledPast(y: number) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const f = () => setOn(window.scrollY > y)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [y])
  return on
}
function scrollToSection(id: string) {
  const el = document.getElementById(`s-${id}`)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headOffset(), behavior: reduce ? 'auto' : 'smooth' })
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '')
  const key = ids.join(',')
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const line = headOffset() + 24
        let cur = ids[0]
        for (const id of ids) {
          const el = document.getElementById(`s-${id}`)
          if (el && el.getBoundingClientRect().top <= line) cur = id
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = ids[ids.length - 1]
        setActive(cur)
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return active
}

function Tabs({ tabs, active }: { tabs: Tab[]; active: string }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const b = bar.current, el = b?.querySelector<HTMLElement>(`[data-tab="${active}"]`)
    if (!b || !el) return
    const left = el.offsetLeft - b.clientWidth / 2 + el.offsetWidth / 2
    b.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [active])
  const click = useCallback((id: string) => scrollToSection(id), [])
  return (
    <nav className="tabs" ref={bar} aria-label="Dossier sections">
      {tabs.map((t) => (
        <button key={t.id} type="button" data-tab={t.id} className={t.id === active ? 'on' : ''} aria-current={t.id === active ? 'true' : undefined} onClick={() => click(t.id)}>
          {t.label}{t.n != null && <span className="num">{t.n}</span>}
        </button>
      ))}
    </nav>
  )
}

/* ---------- states ---------- */

function Skeleton({ symbol }: { symbol: string }) {
  return (
    <div className="dz" aria-busy="true" aria-label={`Loading Dossier for ${symbol}`}>
      <header className="dz-head"><TopBar symbol={symbol} /></header>
      <div className="strip sk-strip">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="skel" style={{ height: 22 }} />)}</div>
      <section className="hero">
        <span className="skel" style={{ width: 90, height: 10 }} />
        <span className="skel" style={{ width: '92%', height: 28, marginTop: 14 }} />
        <span className="skel" style={{ width: '64%', height: 28, marginTop: 8 }} />
        <span className="skel" style={{ width: '100%', height: 12, marginTop: 20, borderRadius: 4 }} />
      </section>
      <div className="dz-body">
        {[0, 1].map((k) => (
          <section key={k} className="dz-sec">
            <span className="skel" style={{ width: 110, height: 10 }} />
            <span className="skel" style={{ width: '70%', height: 18, marginTop: 10 }} />
            {[0, 1, 2].map((i) => <span key={i} className="skel" style={{ width: '100%', height: 64, marginTop: 12, borderRadius: 12 }} />)}
          </section>
        ))}
      </div>
    </div>
  )
}

function NotIndexed({ symbol, name }: { symbol: string; name: string | null }) {
  const cmd = `python -m finn.expand ${symbol}`
  const [copied, setCopied] = useState(false)
  return (
    <div className="dz">
      <header className="dz-head"><TopBar symbol={symbol} name={name} /></header>
      <section className="hero ni">
        <p className="label">Not indexed</p>
        <h1 className="hero-h">FINN hasn’t read {name ?? symbol}’s filings yet.</h1>
        <p className="ni-p">A Dossier is built offline from exchange filings: twelve quarters, twelve years of annual results, cash flows and the balance sheet. This symbol isn’t in the index, so there is nothing to show that we could stand behind.</p>
        <a className="ni-build" href={`https://github.com/Kartikaya-git/finn/issues/new?title=${encodeURIComponent(`build: ${symbol}`)}&body=${encodeURIComponent(`Build the FINN Dossier for ${symbol}. Submitting this issue starts the build; it closes itself when the Dossier is live (about 3 minutes).`)}`} target="_blank" rel="noreferrer">
          Build it <span aria-hidden="true">→</span>
        </a>
        <p className="ni-p dim">Opens a one-click request on GitHub. FINN reads {symbol}’s filings and transcripts, writes the Dossier, and publishes it here in about 3 minutes. Then reload this page.</p>
        <p className="label ni-l">Or build it on your machine</p>
        <div className="cmd">
          <code>{cmd}</code>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {}) }}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="prov">Nothing on this page is estimated</p>
      </section>
      <Dock />
    </div>
  )
}
