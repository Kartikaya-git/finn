// Hand-rolled SVG marks. Sized in CSS pixels; colors come from CSS tokens.
export function Spark({ values, w = 72, h = 22 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return <svg width={w} height={h} aria-hidden />
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
  const up = values[values.length - 1] >= values[0]
  const [lx, ly] = pts[pts.length - 1].split(',')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`spark ${up ? 'up' : 'down'}`} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2" />
    </svg>
  )
}

interface BarSeries { label: string; values: (number | null)[]; cls: string }
export function Bars({ labels, series, h = 96, fmt }: { labels: string[]; series: BarSeries[]; h?: number; fmt: (v: number) => string }) {
  const W = 320
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null)
  const max = Math.max(0, ...all), min = Math.min(0, ...all)
  const span = max - min || 1
  const top = 14, base = h - 16
  const y = (v: number) => top + ((max - v) / span) * (base - top)
  const slot = W / labels.length
  const gap = Math.min(4, slot * 0.2)
  const bw = (slot - gap * 2) / series.length
  const lastIdx = labels.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="chart" role="img" aria-label={series.map((s) => s.label).join(' and ')}>
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="axis" />
      {labels.map((l, i) => (
        <g key={l}>
          {series.map((s, j) => {
            const v = s.values[i]
            if (v == null) return null
            const x = i * slot + gap + j * bw
            return <rect key={j} x={x + 0.5} width={Math.max(1, bw - 1)} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} rx="1.5" className={`${s.cls}${i === lastIdx ? ' last' : ''}`}><title>{`${l} · ${s.label}: ${fmt(v)}`}</title></rect>
          })}
          {(labels.length <= 6 || i % 3 === lastIdx % 3) && <text x={i * slot + slot / 2} y={h - 3} textAnchor="middle" className="tick">{l}</text>}
        </g>
      ))}
      {series.length === 1 && series[0].values[lastIdx] != null && (
        <text x={lastIdx * slot + slot / 2} y={y(series[0].values[lastIdx]!) - 4} textAnchor="middle" className="val">{fmt(series[0].values[lastIdx]!)}</text>
      )}
    </svg>
  )
}

export function Line({ labels, values, h = 56, fmt }: { labels: string[]; values: number[]; h?: number; fmt: (v: number) => string }) {
  const W = 320
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const top = 12, base = h - 6
  const x = (i: number) => 4 + (i / (values.length - 1)) * (W - 40)
  const y = (v: number) => top + ((max - v) / span) * (base - top)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const li = values.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="chart" role="img" aria-label="Operating margin by quarter">
      <path d={d} className="line" fill="none" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === li ? 3 : 1.5} className="dot"><title>{`${labels[i]}: ${fmt(v)}`}</title></circle>)}
      <text x={x(li) + 6} y={y(values[li]) + 4} className="val">{fmt(values[li])}</text>
    </svg>
  )
}

export function MixBar({ segments }: { segments: { name: string; share_pct: number | null }[] }) {
  const segs = segments.filter((s) => s.share_pct != null && s.share_pct > 0)
  if (!segs.length) return null
  return (
    <div className="mix">
      <div className="mixbar">{segs.map((s, i) => <span key={s.name} className={`m${i % 5}`} style={{ flexGrow: s.share_pct! }} title={`${s.name} ${s.share_pct}%`} />)}</div>
      <ul className="mixlegend">{segs.map((s, i) => <li key={s.name}><i className={`m${i % 5}`} />{s.name} <b>{s.share_pct}%</b></li>)}</ul>
    </div>
  )
}
