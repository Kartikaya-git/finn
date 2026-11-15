import { useState, type ReactNode } from 'react'
import type { Dossier as D, Research, Verdict } from '../types'
import { crore, num, pct } from '../fmt'
import { Columns, Paired, RevenueOpm, Trend } from '../ui/charts'
import {
  LEDGER_ORDER, VERDICTS, VERDICT_LABEL, VERDICT_TONE, cashHead, cashRead, growthHead, isLender, latestQuarter, leverageHead, tally,
} from './model'

/* ---------- small pieces ---------- */

const signCls = (v: number | null | undefined) => (v == null ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '')

/** Wraps figures inside prose in tabular mono so every cited number reads as data. */
export function Figures({ text }: { text: string }) {
  const re = /((?:₹|Rs\.?\s?)?(?<![A-Za-z])[−-]?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|bps|bn|Cr|crore|days|x|L Cr))?)/g
  const parts = text.split(re)
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="fig">{p}</span> : p))}</>
}

export function Section({ id, kicker, title, aside, prov, children }: { id: string; kicker: string; title: ReactNode; aside?: ReactNode; prov: string; children: ReactNode }) {
  return (
    <section id={`s-${id}`} className="dz-sec" aria-labelledby={`h-${id}`} data-sec={id}>
      <header className="dz-sec-head">
        <p className="label">{kicker}</p>
        <div className="dz-sec-title">
          <h2 id={`h-${id}`}>{title}</h2>
          {aside}
        </div>
      </header>
      {children}
      <p className="prov">{prov}</p>
    </section>
  )
}

export function VerdictBar({ counts, total, big }: { counts: Record<string, number>; total: number; big?: boolean }) {
  const order = ['kept', 'partly', 'missed', 'pending']
  const cells: string[] = []
  for (const k of order) for (let i = 0; i < (counts[k] ?? 0); i++) cells.push(k)
  return (
    <div className={`vbar${big ? ' lg' : ''}`} role="img" aria-label={order.filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`).join(', ') + ` of ${total}`}>
      {cells.map((k, i) => <i key={i} className={`vb-${k}`} style={{ animationDelay: `${i * 30}ms` }} />)}
    </div>
  )
}

/* ---------- Promises ---------- */

export function Promises({ r, via, onFind }: { r: Research; via: string; onFind: (q: string) => void }) {
  const t = tally(r)
  const [filter, setFilter] = useState<Verdict | 'all'>('all')
  const rows = [...r.promises]
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => LEDGER_ORDER.indexOf(a.verdict) - LEDGER_ORDER.indexOf(b.verdict) || a.i - b.i)
    .filter((p) => filter === 'all' || p.verdict === filter)
  const decided = t.kept + t.partly + t.missed
  const title = decided === 0 ? 'Every promise is still open'
    : t.missed === 0 && t.partly === 0 ? `${t.kept} of ${decided} decided promises kept in full`
    : `${t.kept} kept, ${t.partly} partly, ${t.missed} missed`
  return (
    <Section id="promises" kicker="Promises vs delivered" title={title} prov={`${via} · cached · ${r.model}`}>
      <div className="seg" role="tablist" aria-label="Filter promises by verdict">
        <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
          All <span className="num">{r.promises.length}</span>
        </button>
        {VERDICTS.filter((v) => t[v]).map((v) => (
          <button key={v} role="tab" aria-selected={filter === v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>
            <i className={`dot ${VERDICT_TONE[v]}`} />{VERDICT_LABEL[v]} <span className="num">{t[v]}</span>
          </button>
        ))}
      </div>
      <ol className="ledger">
        {rows.map((p) => <PromiseRow key={p.i} p={p} onFind={onFind} />)}
      </ol>
    </Section>
  )
}

function PromiseRow({ p, onFind }: { p: Research['promises'][number]; onFind: (q: string) => void }) {
  const [open, setOpen] = useState(false)
  const long = p.promise.length + p.delivered.length > 170
  return (
    <li className={`lrow v-${p.verdict}${open ? ' open' : ''}`}>
      <div className="lrow-top">
        <span className="num lq">{p.quarter}</span>
        <span className={`pill ${VERDICT_TONE[p.verdict]}`}>{VERDICT_LABEL[p.verdict]}</span>
      </div>
      <p className="lp">{p.promise}</p>
      <p className="ld"><span className="ld-k">Delivered</span><Figures text={p.delivered} /></p>
      <div className="lrow-foot">
        <span className="lsrc">{p.source}</span>
        <span className="lrow-acts">
          {open && <button type="button" className="lbtn" onClick={() => onFind(p.promise.split(/[.:;,(]/)[0].slice(0, 60))}>Find in transcripts</button>}
          {long && (
            <button type="button" className="lbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? 'less' : 'more'}<Chev up={open} />
            </button>
          )}
        </span>
      </div>
    </li>
  )
}

export function Chev({ up }: { up?: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`chev${up ? ' up' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 3.8 5 6.3l2.5-2.5" /></svg>
  )
}

/* ---------- Narrative vs numbers + Guidance ---------- */

export function Narrative({ r, via }: { r: Research; via: string }) {
  const items = r.narrative_vs_numbers
  const held = items.filter((x) => x.agrees).length
  const title = held === items.length ? `All ${items.length} claims hold up` : held === 0 ? `None of ${items.length} claims survive the numbers` : `${items.length - held} of ${items.length} claims diverge from the numbers`
  return (
    <Section id="narrative" kicker="Narrative vs numbers" title={title} prov={`${via} · cross-checked with filings · cached`}>
      {items.length > 0 && (
        <ol className="nvn">
          {items.map((x, i) => (
            <li key={i} className={`nv ${x.agrees ? 'ok' : 'off'}`}>
              <div className="nv-rail" aria-hidden="true"><i /><b /><i /></div>
              <div className="nv-body">
                <p className="nv-k">They said</p>
                <p className="nv-claim">{x.claim}</p>
                <p className="nv-k nv-k2">
                  The numbers
                  <span className={`pill ${x.agrees ? 'pos' : 'neg'}`}>{x.agrees ? 'Agrees' : 'Diverges'}</span>
                </p>
                <p className="nv-num"><Figures text={x.numbers} /></p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {r.guidance.length > 0 && (
        <div className="guide">
          <p className="label">Standing guidance</p>
          <dl>
            {r.guidance.map((g, i) => (
              <div key={i} className="g-row">
                <dt>{g.metric}</dt>
                <dd className="g-guide"><Figures text={g.guide} /></dd>
                <dd className="g-src">{g.source}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Section>
  )
}

/* ---------- Numbers ---------- */

export function Numbers({ d }: { d: D }) {
  const lq = latestQuarter(d)
  const lender = isLender(d)
  const c = d.computed
  const annual = d.annual.slice(-10)
  const qrows = d.quarters.map((q) => ({ period: q.period, revenue: q.revenue, opm: lender ? (q.revenue ? (q.pat / q.revenue) * 100 : null) : q.opm }))
  const marginName = lender ? 'PAT margin' : 'OPM'
  return (
    <Section id="numbers" kicker="Numbers" title={growthHead(d)} prov="Computed from filings · ₹ crore, consolidated">
      {lq && (
        <div className="block">
          <div className="block-h"><span className="label">Latest quarter</span><span className="num dim">{lq.period}</span></div>
          <div className="stats">
            {lq.rows.map((s) => (
              <div key={s.key} className="stat">
                <span className="stat-k">{s.key}</span>
                <span className="stat-v num">{num(s.v)}</span>
                <span className="stat-d num"><span className={signCls(s.yoy)}>{pct(s.yoy)}</span> <span className="dim">YoY</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="block">
        <div className="block-h">
          <span className="label">Revenue · {d.quarters.length} quarters</span>
          <span className="legend"><i className="lg-bar" />Revenue <i className="lg-line" />{marginName}</span>
        </div>
        <RevenueOpm rows={qrows} opmLabel={marginName} />
      </div>
      <div className="block">
        <div className="block-h"><span className="label">Annual · own scales</span><span className="num dim">{annual.length} yrs</span></div>
        <div className="multiples">
          <figure><figcaption>Revenue</figcaption><Columns values={annual.map((a) => a.revenue)} labels={annual.map((a) => a.year)} fmt={(v) => crore(v)} /></figure>
          <figure><figcaption>PAT</figcaption><Columns values={annual.map((a) => a.pat)} labels={annual.map((a) => a.year)} tone="signal" fmt={(v) => crore(v)} /></figure>
        </div>
      </div>
      <div className="block">
        <table className="cagr num">
          <thead><tr><th scope="col"><span className="label">Compounding</span></th><th scope="col">3y</th><th scope="col">5y</th></tr></thead>
          <tbody>
            <tr><th scope="row">Revenue</th><Cell v={c.revenue_cagr_3y} /><Cell v={c.revenue_cagr_5y} /></tr>
            <tr><th scope="row">PAT</th><Cell v={c.pat_cagr_3y} /><Cell v={c.pat_cagr_5y} /></tr>
            {!lender && (
              <tr><th scope="row">Operating margin</th>
                <td colSpan={2} className={c.opm_trend === 'expanding' ? 'pos' : c.opm_trend === 'compressing' ? 'neg' : ''}>
                  {c.opm_trend === 'expanding' ? '↗ ' : c.opm_trend === 'compressing' ? '↘ ' : '→ '}{c.opm_trend}{lq?.opm != null ? ` · ${lq.opm.toFixed(0)}% now` : ''}
                </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function Cell({ v }: { v: number | null }) {
  return <td className={signCls(v)}>{pct(v)}</td>
}

/** Big crore figure with the unit set small: "4,592 Cr", "2.51 L Cr". */
function BigCrore({ v }: { v: number | null }) {
  if (v == null) return <>—</>
  const lakh = Math.abs(v) >= 1e5
  const n = lakh ? num(v / 1e5, 2) : num(v)
  return <>₹{n}<small>{lakh ? 'L Cr' : 'Cr'}</small></>
}

/* ---------- Cash ---------- */

export function Cash({ d }: { d: D }) {
  const c = d.computed
  const yrs = d.annual.slice(-8)
  const r = c.cfo_to_pat_5y
  return (
    <Section id="cash" kicker="Cash quality" title={cashHead(d)} prov="Computed from filings · cash-flow statements">
      <div className="bigs">
        <div className="big">
          <span className="stat-k">CFO / PAT · 5y</span>
          <span className={`big-v num ${r == null || isLender(d) ? '' : r >= 0.9 ? 'pos' : r >= 0.6 ? 'warn' : 'neg'}`}>{r == null ? '—' : r.toFixed(2)}<small>×</small></span>
        </div>
        <div className="big">
          <span className="stat-k">Free cash flow · 5y</span>
          <span className={`big-v num ${signCls(c.fcf_5y_cr)}`}><BigCrore v={c.fcf_5y_cr} /></span>
        </div>
      </div>
      <p className="read">{cashRead(d)}</p>
      <div className="block">
        <div className="block-h">
          <span className="label">CFO vs PAT · by year</span>
          <span className="legend"><i className="lg-solid" />CFO <i className="lg-open" />PAT</span>
        </div>
        <Paired rows={yrs.map((a) => ({ label: a.year, a: a.cfo, b: a.pat }))} aLabel="Operating cash flow" bLabel="PAT" />
      </div>
    </Section>
  )
}

/* ---------- Balance sheet ---------- */

export function Balance({ d }: { d: D }) {
  const c = d.computed
  const lender = isLender(d)
  const yrs = d.annual.slice(-10)
  const hasDebt = yrs.some((a) => a.debt != null)
  const de = yrs.map((a) => (a.debt != null && a.equity ? a.debt / a.equity : null))
  return (
    <Section id="balance" kicker="Balance sheet" title={leverageHead(d)} prov={lender ? 'Computed from filings · balance sheet' : 'Computed from filings · balance sheet, receivables, inventory, payables'}>
      <div className="bigs three">
        <div className="big">
          <span className="stat-k">Debt / equity</span>
          <span className="big-v num">{c.de_ratio == null ? '—' : c.de_ratio.toFixed(2)}</span>
          <span className={`stat-d ${c.debt_trend === 'rising' ? 'warn' : c.debt_trend === 'falling' ? 'pos' : 'dim'}`}>debt {c.debt_trend}</span>
        </div>
        <div className="big">
          <span className="stat-k">Cash cycle</span>
          {c.ccc_days == null
            ? <><span className="big-v num dim">n/a</span><span className="stat-d dim">{lender ? 'not meaningful for lenders' : 'not reported'}</span></>
            : <><span className="big-v num">{num(c.ccc_days)}<small>d</small></span>
                <span className={`stat-d ${c.ccc_trend === 'lengthening' ? 'neg' : c.ccc_trend === 'shortening' ? 'pos' : 'dim'}`}>{c.ccc_trend ?? 'trend n/a'}</span></>}
        </div>
      </div>
      {hasDebt && (
        <div className="block">
          <div className="block-h"><span className="label">{lender ? 'Borrowings & equity' : 'Debt & equity'}</span><span className="num dim">₹ Cr</span></div>
          <div className="multiples">
            <figure><figcaption>{lender ? 'Borrowings' : 'Debt'}</figcaption><Columns values={yrs.map((a) => a.debt)} labels={yrs.map((a) => a.year)} tone="info" fmt={(v) => crore(v)} /></figure>
            <figure><figcaption>Equity</figcaption><Columns values={yrs.map((a) => a.equity)} labels={yrs.map((a) => a.year)} fmt={(v) => crore(v)} /></figure>
          </div>
          {de.filter((x) => x != null).length > 2 && (
            <figure className="solo"><figcaption>D/E</figcaption><Trend values={de} labels={yrs.map((a) => a.year)} fmt={(v) => v.toFixed(2)} tone="warn" w={340} h={60} /></figure>
          )}
        </div>
      )}
      {lender && <p className="read gap">For a lender, borrowings and deposits fund the loan book. Read leverage alongside capital adequacy, which filings report separately.</p>}
    </Section>
  )
}

/* ---------- Flags ---------- */

export function Flags({ d }: { d: D }) {
  const order = { bad: 0, watch: 1, good: 2 } as const
  const f = [...d.flags].sort((a, b) => order[a.level] - order[b.level])
  const n = { good: 0, watch: 0, bad: 0 }
  f.forEach((x) => n[x.level]++)
  return (
    <Section id="flags" kicker="Flags" title={n.bad ? `${n.bad} red flag${n.bad > 1 ? 's' : ''}, ${n.watch} to watch` : n.watch ? `${n.watch} to watch, ${n.good} healthy` : `${n.good} healthy signals, nothing to watch`}
      prov="Computed from filings · deterministic rules">
      <ul className="flags">
        {f.map((x, i) => (
          <li key={i} className={`flag ${x.level}`}><i aria-hidden="true" /><span><span className="sr">{x.level === 'bad' ? 'Red flag: ' : x.level === 'watch' ? 'Watch: ' : 'Healthy: '}</span><Figures text={x.text} /></span></li>
        ))}
      </ul>
    </Section>
  )
}

/* ---------- Bull / Bear ---------- */

export function BullBear({ r, via }: { r: Research; via: string }) {
  return (
    <Section id="bullbear" kicker="Bull vs bear" title="The case on each side" prov={`${via} · cached · ${r.model}`}>
      <div className="bb">
        <div className="bb-col bull">
          <p className="bb-h"><span className="pos">▲</span> Bull <span className="num dim">{r.bull.length}</span></p>
          <ul>{r.bull.map((b, i) => <li key={i}><Figures text={b} /></li>)}</ul>
        </div>
        <div className="bb-col bear">
          <p className="bb-h"><span className="neg">▼</span> Bear <span className="num dim">{r.bear.length}</span></p>
          <ul>{r.bear.map((b, i) => <li key={i}><Figures text={b} /></li>)}</ul>
        </div>
      </div>
    </Section>
  )
}

/* ---------- Business ---------- */

const SEG_TONES = ['var(--ink-2)', 'var(--signal)', 'var(--info)', 'var(--warn)', 'var(--pos)']
export function Business({ d, r, via }: { d: D; r: Research | null; via: string }) {
  const segs = r?.business.segments ?? []
  const known = segs.filter((s) => s.share_pct != null && s.share_pct > 0)
  const sum = known.reduce((a, s) => a + (s.share_pct ?? 0), 0)
  const rest = Math.max(0, 100 - sum)
  const showMix = known.length > 0 && sum >= 40
  return (
    <Section id="business" kicker="Business" title={d.sector} prov={r ? `${via} · cached` : 'From exchange filings · company description'}>
      <p className="biz">{r?.business.summary || d.about}</p>
      {showMix && (
        <div className="block">
          <div className="block-h"><span className="label">Segment mix</span><span className="num dim">% of revenue</span></div>
          <div className="mix" role="img" aria-label={known.map((s) => `${s.name} ${s.share_pct}%`).join(', ')}>
            {known.map((s, i) => <i key={s.name} style={{ flexGrow: s.share_pct!, background: SEG_TONES[i % SEG_TONES.length] }} />)}
            {rest > 0 && <i className="mix-rest" style={{ flexGrow: rest }} />}
          </div>
          <ul className="mix-key">
            {known.map((s, i) => <li key={s.name}><i style={{ background: SEG_TONES[i % SEG_TONES.length] }} /><span>{s.name}</span><span className="num">{s.share_pct}%</span></li>)}
            {rest > 0 && <li><i className="mix-rest" /><span className="dim">Other / not split out</span><span className="num dim">{rest}%</span></li>}
          </ul>
        </div>
      )}
      {!showMix && segs.length > 0 && (
        <ul className="seg-list">{segs.map((s) => <li key={s.name}>{s.name}{s.share_pct != null && <span className="num"> · {s.share_pct}%</span>}</li>)}</ul>
      )}
    </Section>
  )
}

/* ---------- Sources ---------- */

const KIND: Record<D['sources'][number]['kind'], string> = { concall: 'Concall transcripts', ppt: 'Investor presentations', annual_report: 'Annual reports' }
export function Sources({ d }: { d: D }) {
  const [all, setAll] = useState(false)
  const groups = (['concall', 'ppt', 'annual_report'] as const).map((k) => ({ k, items: d.sources.filter((s) => s.kind === k) })).filter((g) => g.items.length)
  return (
    <Section id="sources" kicker="Primary sources" title={`${d.sources.length} documents on the exchange`} prov="Links open the original PDF on BSE or the company site">
      {groups.map((g) => (
        <div key={g.k} className="src-g">
          <p className="label">{KIND[g.k]} <span className="num">· {g.items.length}</span></p>
          <ul className="src">
            {(all ? g.items : g.items.slice(0, 3)).map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  <span>{s.label.replace(/^(Concall transcript|Investor presentation)\s*·\s*/i, '')}</span>
                  <span className="src-host num">{hostOf(s.url)}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M4 2.5h5.5V8M9.3 2.7 2.5 9.5" /></svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.some((g) => g.items.length > 3) && (
        <button type="button" className="src-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Show latest only' : `Show all ${d.sources.length}`}<Chev up={all} />
        </button>
      )}
    </Section>
  )
}
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
