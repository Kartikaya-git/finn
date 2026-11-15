export type Kind = 'holding' | 'research' | 'indexed'
export interface Tickers { generated_at: string; tickers: { symbol: string; name: string; kind: Kind[] }[] }

export interface Person { name: string; role: string; change: 'appointed' | 'resigned' | 'retired'; profile: string }
export interface ResultsRow { metric: 'Revenue' | 'EBITDA' | 'PBT' | 'PAT'; cur: number; prev_q: number; prev_y: number; qoq: number; yoy: number }
export interface Filing {
  id: string; symbol: string; title: string; summary: string; url: string; ts: string
  category: string; tier: 'card' | 'routine'; why: string
  results?: { period: string; unit: string; ebitda_label: 'EBITDA' | 'Financing Profit'; rows: ResultsRow[] }
  person?: Person
}
export interface Holding { symbol: string; name: string; sector: string; series: [string, number, number][]; filings: Filing[] }
export interface Brief { generated_at: string; holdings: Holding[] }

export interface Dossier {
  symbol: string; name: string; generated_at: string; about: string; sector: string
  price: { close: number; change_pct: number; mcap_cr: number | null; pe: number | null; roce: number | null; roe: number | null }
  quarters: { period: string; revenue: number; ebitda: number; pbt: number; pat: number; opm: number }[]
  annual: { year: string; revenue: number; ebitda: number; pat: number; opm: number; cfo: number | null; capex: number | null; fcf: number | null; debt: number | null; equity: number | null }[]
  computed: {
    revenue_cagr_3y: number | null; revenue_cagr_5y: number | null; pat_cagr_3y: number | null; pat_cagr_5y: number | null
    opm_trend: 'expanding' | 'stable' | 'compressing'; de_ratio: number | null; debt_trend: 'rising' | 'flat' | 'falling'
    cfo_to_pat_5y: number | null; fcf_5y_cr: number | null; ccc_days: number | null; ccc_trend: 'lengthening' | 'stable' | 'shortening' | null
  }
  flags: { level: 'good' | 'watch' | 'bad'; text: string }[]
  sources: { kind: 'concall' | 'annual_report' | 'ppt'; label: string; url: string }[]
}
export type Verdict = 'kept' | 'partly' | 'missed' | 'pending'
export interface Research {
  symbol: string; model: string; generated_at: string
  business: { summary: string; segments: { name: string; share_pct: number | null }[] }
  promises: { quarter: string; promise: string; source: string; delivered: string; verdict: Verdict }[]
  narrative_vs_numbers: { claim: string; numbers: string; agrees: boolean }[]
  guidance: { metric: string; guide: string; source: string }[]
  bull: string[]; bear: string[]
}
export interface Chunks { symbol: string; chunks: { id: string; source: string; quarter: string; text: string }[] }
export type Enrichment = Record<string, { person?: Person; summary?: string }>
