import { useEffect, useState } from 'react'
import { load } from './data'
import { go } from './store'
import { crore, num, pct, tone } from './fmt'
import { Bars, Line, MixBar } from './charts'
import { AskThread } from './Ask'
import type { Chunks, Dossier as DossierT, Research, Verdict } from './types'

interface State { d: DossierT | null; r: Research | null; c: Chunks | null }

const FILINGS = 'from filings · computed'
const TRANSCRIPTS = 'from transcripts · cached'

export function Dossier({ symbol }: { symbol: string }) {
  const [s, setS] = useState<State | undefined>(undefined)
  useEffect(() => {
    setS(undefined)
    window.scrollTo(0, 0)
    Promise.all([
      load<DossierT>(`dossier/${symbol}.json`),
      load<Research>(`research/${symbol}.json`),
      load<Chunks>(`research/${symbol}.chunks.json`),
    ]).then(([d, r, c]) => setS({ d, r, c }))
  }, [symbol])

  const back = () => (window.history.length > 1 ? window.history.back() : go('/'))

  return (
    <div className="page dossier">
      <header className="dtop">
        <button className="icon" aria-label="Back to Brief" onClick={back}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="dtitle">
          <h1>{s?.d?.name ?? symbol}</h1>
          {s?.d && (
            <p className="strip">
              <b>{symbol}</b>
              <span>{num(s.d.price.close, 2)} <em className={tone(s.d.price.change_pct)}>{pct(s.d.price.change_pct)}</em></span>
              <span>MCap {crore(s.d.price.mcap_cr)}</span>
              <span>P/E {num(s.d.price.pe, 1)}</span>
              <span>ROCE {s.d.price.roce == null ? '—' : `${num(s.d.price.roce, 1)}%`}</span>
            </p>
          )}
        </div>
      </header>

      {s === undefined && <div className="skeleton"><i /><i /><i /></div>}
      {s && !s.d && (
        <div className="unknown">
          <h2>{symbol} isn't indexed in this demo.</h2>
          <p>Dossiers are built from screener.in for any NSE ticker. Build this one with</p>
          <code>python -m finn dossier {symbol}</code>
          <button className="btn ghost" onClick={() => go('/')}>Back to Brief</button>
        </div>
      )}
      {s?.d && <Body d={s.d} r={s.r} />}
      {s?.d && <AskThread symbol={symbol} chunks={s.c} />}
    </div>
  )
}

function Sec({ id, title, prov, children }: { id: string; title: string; prov: string; children: React.ReactNode }) {
  return (
    <section className="dsec" aria-labelledby={id}>
      <div className="dhead"><h2 id={id}>{title}</h2><span className="prov">{prov}</span></div>
      {children}
    </section>
  )
}

const VERDICT: Record<Verdict, string> = { kept: 'good', partly: 'watch', missed: 'bad', pending: 'neutral' }

function Body({ d, r }: { d: DossierT; r: Research | null }) {
  const q = d.quarters ?? []
  const a = d.annual ?? []
  const lq = q[q.length - 1]
  const ttm = q.length >= 4 ? q.slice(-4).reduce((acc, x) => ({ revenue: acc.revenue + x.revenue, ebitda: acc.ebitda + x.ebitda, pat: acc.pat + x.pat }), { revenue: 0, ebitda: 0, pat: 0 }) : null
  const qyoy = q.length >= 5 ? (lq.revenue / q[q.length - 5].revenue - 1) * 100 : null
  const qpatyoy = q.length >= 5 ? (lq.pat / q[q.length - 5].pat - 1) * 100 : null
  const c = d.computed
  const tally = r?.promises?.reduce<Record<string, number>>((m, p) => ({ ...m, [p.verdict]: (m[p.verdict] ?? 0) + 1 }), {})
  const ylab = (y: string) => { const m = y.match(/(\d{2})$/); return m ? `FY${m[1]}` : y }
  const qlab = (p: string) => p.replace(/^(\w{3})\w* (\d{2})?(\d{2})$/, "$1 '$3")

  return (
    <>
      {d.about && <p className="about">{d.about}</p>}

      {r?.promises?.length ? (
        <Sec id="h-prom" title="Promises vs delivered" prov={TRANSCRIPTS}>
          <p className="tally">
            {(['kept', 'partly', 'missed', 'pending'] as Verdict[]).filter((v) => tally?.[v]).map((v) => (
              <span key={v} className={`pill ${VERDICT[v]}`}>{tally![v]} {v}</span>
            ))}
          </p>
          <ol className="ledger">
            {r.promises.map((p, i) => (
              <li key={i}>
                <div className="l1"><span className="qtr">{p.quarter}</span><span className={`pill ${VERDICT[p.verdict]}`}>{p.verdict}</span></div>
                <p className="promise">{p.promise}</p>
                <p className="delivered"><span>Delivered</span>{p.delivered}</p>
                <p className="lsrc">{p.source}</p>
              </li>
            ))}
          </ol>
        </Sec>
      ) : null}

      {r?.narrative_vs_numbers?.length ? (
        <Sec id="h-nvn" title="Narrative vs numbers" prov={TRANSCRIPTS}>
          <ul className="nvn">
            {r.narrative_vs_numbers.map((n, i) => (
              <li key={i} className={n.agrees ? 'agree' : 'diverge'}>
                <span className="mark" aria-label={n.agrees ? 'agrees' : 'diverges'}>{n.agrees ? 'Agrees' : 'Diverges'}</span>
                <p className="claim">“{n.claim}”</p>
                <p className="nums">{n.numbers}</p>
              </li>
            ))}
          </ul>
        </Sec>
      ) : null}

      {r?.guidance?.length ? (
        <Sec id="h-guid" title="Guidance" prov={TRANSCRIPTS}>
          <table className="kv">
            <tbody>{r.guidance.map((g, i) => <tr key={i}><th>{g.metric}</th><td>{g.guide}<small>{g.source}</small></td></tr>)}</tbody>
          </table>
        </Sec>
      ) : null}

      {r && (r.bull?.length || r.bear?.length) ? (
        <Sec id="h-bb" title="Bull vs bear" prov={TRANSCRIPTS}>
          <div className="bb">
            <div className="bull"><h3>Bull</h3><ul>{r.bull.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div className="bear"><h3>Bear</h3><ul>{r.bear.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
        </Sec>
      ) : null}

      {r?.business ? (
        <Sec id="h-biz" title="Business snapshot" prov={TRANSCRIPTS}>
          <p className="body">{r.business.summary}</p>
          <MixBar segments={r.business.segments ?? []} />
        </Sec>
      ) : null}

      {lq && (
        <Sec id="h-fin" title="Financial snapshot" prov={FILINGS}>
          <div className="stats">
            <Stat k={`Revenue · ${qlab(lq.period)}`} v={crore(lq.revenue)} d={qyoy} />
            <Stat k={`PAT · ${qlab(lq.period)}`} v={crore(lq.pat)} d={qpatyoy} />
            <Stat k="OPM" v={`${num(lq.opm, 1)}%`} />
            {ttm && <Stat k="Revenue · TTM" v={crore(ttm.revenue)} />}
            {ttm && <Stat k="PAT · TTM" v={crore(ttm.pat)} />}
            <Stat k="ROE" v={d.price.roe == null ? '—' : `${num(d.price.roe, 1)}%`} />
          </div>
        </Sec>
      )}

      {(q.length > 1 || a.length > 1) && (
        <Sec id="h-traj" title="Trajectory" prov={FILINGS}>
          <div className="cagr">
            <Chip k="Rev 3y" v={c.revenue_cagr_3y} /><Chip k="Rev 5y" v={c.revenue_cagr_5y} />
            <Chip k="PAT 3y" v={c.pat_cagr_3y} /><Chip k="PAT 5y" v={c.pat_cagr_5y} />
            <span className={`trend ${c.opm_trend === 'expanding' ? 'up' : c.opm_trend === 'compressing' ? 'down' : ''}`}>OPM {c.opm_trend}</span>
          </div>
          {q.length > 1 && (<>
            <h3 className="sub">Quarterly revenue · ₹ Cr</h3>
            <Bars labels={q.map((x) => qlab(x.period))} series={[{ label: 'Revenue', values: q.map((x) => x.revenue), cls: 'b-acc' }]} fmt={(v) => num(v)} />
            <h3 className="sub">Operating margin · %</h3>
            <Line labels={q.map((x) => x.period)} values={q.map((x) => x.opm)} fmt={(v) => `${num(v, 1)}%`} />
          </>)}
          {a.length > 1 && (<>
            <h3 className="sub">Annual revenue and PAT · ₹ Cr <Legend items={[['b-mut', 'Revenue'], ['b-acc', 'PAT']]} /></h3>
            <Bars labels={a.map((x) => ylab(x.year))} series={[{ label: 'Revenue', values: a.map((x) => x.revenue), cls: 'b-mut' }, { label: 'PAT', values: a.map((x) => x.pat), cls: 'b-acc' }]} fmt={(v) => num(v)} />
          </>)}
        </Sec>
      )}

      <Sec id="h-bs" title="Balance sheet" prov={FILINGS}>
        <div className="stats">
          <Stat k="Debt" v={crore(a[a.length - 1]?.debt)} note={c.debt_trend} />
          <Stat k="Debt / equity" v={num(c.de_ratio, 2)} />
          <Stat k="Cash conversion" v={c.ccc_days == null ? '—' : `${num(c.ccc_days)} days`} note={c.ccc_trend ?? undefined} />
        </div>
      </Sec>

      {a.some((x) => x.cfo != null) && (
        <Sec id="h-cash" title="Cash quality" prov={FILINGS}>
          <div className="stats">
            <Stat k="CFO / PAT · 5y" v={c.cfo_to_pat_5y == null ? '—' : `${num(c.cfo_to_pat_5y, 2)}×`} />
            <Stat k="FCF · 5y" v={crore(c.fcf_5y_cr)} />
          </div>
          <h3 className="sub">CFO vs PAT · ₹ Cr <Legend items={[['b-acc', 'CFO'], ['b-mut', 'PAT']]} /></h3>
          <Bars labels={a.map((x) => ylab(x.year))} series={[{ label: 'CFO', values: a.map((x) => x.cfo), cls: 'b-acc' }, { label: 'PAT', values: a.map((x) => x.pat), cls: 'b-mut' }]} fmt={(v) => num(v)} />
        </Sec>
      )}

      {d.flags?.length ? (
        <Sec id="h-flags" title="Flags" prov={FILINGS}>
          <ul className="flags">{d.flags.map((f, i) => <li key={i}><i className={`dot ${f.level}`} aria-label={f.level} />{f.text}</li>)}</ul>
        </Sec>
      ) : null}

      {d.sources?.length ? (
        <Sec id="h-src" title="Sources" prov="primary documents">
          <ul className="sources">
            {d.sources.map((s, i) => (
              <li key={i}><a href={s.url} target="_blank" rel="noreferrer"><span className="skind">{s.kind === 'annual_report' ? 'AR' : s.kind === 'ppt' ? 'PPT' : 'Call'}</span>{s.label}<span className="ext">↗</span></a></li>
            ))}
          </ul>
        </Sec>
      ) : null}
    </>
  )
}

function Stat({ k, v, d, note }: { k: string; v: string; d?: number | null; note?: string }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {d != null && <span className={`d ${tone(d)}`}>{pct(d)} YoY</span>}
      {note && <span className={`d ${note === 'rising' || note === 'lengthening' ? 'down' : note === 'falling' || note === 'shortening' ? 'up' : ''}`}>{note}</span>}
    </div>
  )
}
function Chip({ k, v }: { k: string; v: number | null }) {
  if (v == null) return null
  return <span className="cchip">{k} <b className={tone(v)}>{pct(v)}</b></span>
}
function Legend({ items }: { items: [string, string][] }) {
  return <span className="legend">{items.map(([c, l]) => <span key={l}><i className={c} />{l}</span>)}</span>
}
