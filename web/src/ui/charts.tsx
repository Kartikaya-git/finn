// Hand-rolled SVG charts. No chart library: every mark is drawn here so it
// inherits the token palette and reads as one system in light and dark.
import './ui.css'

const finite = (v: number | null | undefined): v is number => v != null && isFinite(v)

/** Inline sparkline. tone 'auto' colours by first-vs-last direction. */
export function Spark({ values, w = 72, h = 22, tone = 'auto' }: { values: number[]; w?: number; h?: number; tone?: 'pos' | 'neg' | 'auto' }) {
  const v = values.filter(finite)
  if (v.length < 2) return <svg width={w} height={h} aria-hidden="true" />
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1
  const pad = 2
  const x = (i: number) => pad + (i * (w - pad * 2)) / (v.length - 1)
  const y = (n: number) => pad + (1 - (n - lo) / span) * (h - pad * 2)
  const d = v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join('')
  const t = tone === 'auto' ? (v[v.length - 1] >= v[0] ? 'pos' : 'neg') : tone
  const c = `var(--${t})`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={c} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r="2" fill={c} />
    </svg>
  )
}

const short = (s: string) => {
  // "Mar 2024" -> "Mar 24", "Dec 2023" -> "D23" style kept readable
  const m = s.match(/^([A-Za-z]{3})\w*\s+(\d{2})(\d{2})$/)
  return m ? `${m[1]} ${m[3]}` : s
}
const yy = (s: string) => {
  const m = s.match(/(\d{2})(\d{2})$/)
  return m ? `FY${m[2]}` : s
}

/** Quarterly revenue bars with an OPM line on its own right-hand scale. */
export function RevenueOpm({ rows, opmLabel = 'OPM' }: { rows: { period: string; revenue: number; opm: number | null }[]; opmLabel?: string }) {
  const W = 340, H = 150, top = 14, bot = 20, left = 2, right = 30
  const n = rows.length
  if (!n) return null
  const rmax = Math.max(...rows.map((r) => r.revenue), 1)
  const om = rows.map((r) => r.opm).filter(finite)
  const showOpm = om.length > 1
  const olo = Math.min(...om, 0), ohi = Math.max(...om, 1)
  const ih = H - top - bot, iw = W - left - right
  const bw = iw / n
  const y = (v: number) => top + ih - (v / rmax) * ih
  const oy = (v: number) => top + ih - ((v - olo) / (ohi - olo || 1)) * ih * 0.8 - ih * 0.1
  const cx = (i: number) => left + bw * i + bw / 2
  const line = rows.map((r, i) => (finite(r.opm) ? `${cx(i).toFixed(1)},${oy(r.opm).toFixed(1)}` : null)).filter(Boolean).join(' ')
  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Quarterly revenue, ${n} quarters, with ${opmLabel}`}>
      <line x1={left} x2={W - right} y1={top + ih} y2={top + ih} stroke="var(--hair-2)" />
      {rows.map((r, i) => (
        <rect key={r.period} x={left + bw * i + bw * 0.18} width={bw * 0.64} y={y(r.revenue)} height={Math.max(top + ih - y(r.revenue), 1)}
          rx="1.5" fill={i === n - 1 ? 'var(--ink-2)' : 'var(--hair-2)'} />
      ))}
      {showOpm && <polyline points={line} fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeLinejoin="round" />}
      {showOpm && rows.map((r, i) => finite(r.opm) && (
        <circle key={i} cx={cx(i)} cy={oy(r.opm)} r={i === n - 1 ? 2.6 : 1.6} fill="var(--card)" stroke="var(--signal)" strokeWidth="1.3" />
      ))}
      {showOpm && finite(rows[n - 1].opm) && (
        <text x={W - right + 6} y={oy(rows[n - 1].opm!) + 3} style={{ fill: 'var(--signal)' }}>{rows[n - 1].opm!.toFixed(0)}%</text>
      )}
      {rows.map((r, i) => (i === 0 || i === n - 1 || i % 4 === 0) && (
        <text key={'t' + i} x={cx(i)} y={H - 6} textAnchor="middle">{short(r.period)}</text>
      ))}
    </svg>
  )
}

/** One small-multiple: a column series on its own scale, labelled at the ends. */
export function Columns({ values, labels, tone = 'ink', h = 64, fmt }: { values: (number | null)[]; labels: string[]; tone?: 'ink' | 'signal' | 'pos' | 'info'; h?: number; fmt: (v: number) => string }) {
  const W = 160, top = 14, bot = 14
  const v = values.map((x) => (finite(x) ? x : 0))
  const max = Math.max(...v, 0), min = Math.min(...v, 0)
  const span = max - min || 1
  const ih = h - top - bot
  const zero = top + (max / span) * ih
  const n = v.length, bw = W / n
  const fill = tone === 'ink' ? 'var(--ink-2)' : `var(--${tone})`
  return (
    <svg className="ch" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${labels[0]} to ${labels[n - 1]}`}>
      <line x1="0" x2={W} y1={zero} y2={zero} stroke="var(--hair-2)" />
      {v.map((x, i) => {
        const hh = (Math.abs(x) / span) * ih
        return <rect key={i} x={bw * i + bw * 0.16} width={bw * 0.68} y={x >= 0 ? zero - hh : zero} height={Math.max(hh, 0.8)} rx="1"
          fill={x < 0 ? 'var(--neg)' : fill} opacity={i === n - 1 ? 1 : 0.42} />
      })}
      <text x={W} y={9} textAnchor="end" className="ch-strong">{finite(values[n - 1]) ? fmt(values[n - 1]!) : '—'}</text>
      <text x="0" y={h - 2}>{yy(labels[0])}</text>
      <text x={W} y={h - 2} textAnchor="end">{yy(labels[n - 1])}</text>
    </svg>
  )
}

/** Paired bars per year: a (solid) vs b (outlined). Used for CFO vs PAT. */
export function Paired({ rows, aLabel, bLabel }: { rows: { label: string; a: number | null; b: number | null }[]; aLabel: string; bLabel: string }) {
  const W = 340, H = 136, top = 8, bot = 18
  const n = rows.length
  if (!n) return null
  const vals = rows.flatMap((r) => [r.a, r.b]).filter(finite)
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0)
  const span = max - min || 1
  const ih = H - top - bot
  const zero = top + (max / span) * ih
  const gw = W / n
  const bw = Math.min(gw * 0.3, 11)
  const bar = (v: number | null, x: number, solid: boolean, k: string) => {
    if (!finite(v)) return <rect key={k} x={x} width={bw} y={zero - 1} height={1} fill="var(--hair-2)" />
    const hh = Math.max((Math.abs(v) / span) * ih, 1)
    const neg = v < 0
    return solid
      ? <rect key={k} x={x} width={bw} y={v >= 0 ? zero - hh : zero} height={hh} rx="1.2" fill={neg ? 'var(--neg)' : 'var(--ink-2)'} />
      : <rect key={k} x={x + 0.6} width={bw - 1.2} y={(v >= 0 ? zero - hh : zero) + 0.6} height={Math.max(hh - 1.2, 0.5)} rx="1"
          fill="var(--paper)" stroke={neg ? 'var(--neg)' : 'var(--ink-3)'} strokeWidth="1.2" />
  }
  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${aLabel} versus ${bLabel} by year`}>
      <line x1="0" x2={W} y1={zero} y2={zero} stroke="var(--hair-2)" />
      {rows.map((r, i) => {
        const cx = gw * i + gw / 2
        return (
          <g key={r.label}>
            {bar(r.a, cx - bw - 1, true, 'a')}
            {bar(r.b, cx + 1, false, 'b')}
            {(i % 2 === n % 2 || i === n - 1) && <text x={cx} y={H - 5} textAnchor="middle">{yy(r.label)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

/** Thin line with an end label, for D/E or CCC trends. */
export function Trend({ values, labels, fmt, tone = 'ink', w = 160, h = 56 }: { values: (number | null)[]; labels: string[]; fmt: (v: number) => string; tone?: 'ink' | 'signal' | 'warn' | 'pos' | 'neg'; w?: number; h?: number }) {
  const W = w, top = 12, bot = 14
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => finite(p[1]))
  if (pts.length < 2) return null
  const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]))
  const span = hi - lo || 1, ih = h - top - bot
  const x = (i: number) => 2 + (i * (W - 4)) / (values.length - 1)
  const y = (v: number) => top + (1 - (v - lo) / span) * ih
  const c = tone === 'ink' ? 'var(--ink-2)' : `var(--${tone})`
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')
  const area = `${d}L${x(pts[pts.length - 1][0]).toFixed(1)} ${top + ih}L${x(pts[0][0]).toFixed(1)} ${top + ih}Z`
  const last = pts[pts.length - 1]
  return (
    <svg className="ch" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`Trend ${labels[0]} to ${labels[labels.length - 1]}`}>
      <path d={area} fill={c} opacity=".08" />
      <path d={d} fill="none" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={x(last[0])} cy={y(last[1])} r="2.4" fill={c} />
      <text x={W} y={9} textAnchor="end" className="ch-strong">{fmt(last[1])}</text>
      <text x="0" y={h - 2}>{yy(labels[0])}</text>
      <text x={W} y={h - 2} textAnchor="end">{yy(labels[labels.length - 1])}</text>
    </svg>
  )
}
