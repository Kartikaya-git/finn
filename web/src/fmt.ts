const nf = (d: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })
export const num = (v: number | null | undefined, d = 0) => (v == null || !isFinite(v) ? '—' : nf(d).format(v))
export const pct = (v: number | null | undefined, d = 1) =>
  v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(d).format(Math.abs(v))}%`
export const tone = (v: number | null | undefined) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '')
export const crore = (v: number | null | undefined) => {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e5) return `₹${nf(2).format(v / 1e5)} L Cr`
  return `₹${nf(0).format(v)} Cr`
}
export function ago(ts: string, ref: string): string {
  const m = Math.max(0, (new Date(ref).getTime() - new Date(ts).getTime()) / 6e4)
  if (m < 60) return `${Math.round(m)}m`
  if (m < 60 * 24) return `${Math.round(m / 60)}h`
  return `${Math.round(m / 1440)}d`
}
export const asOf = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
