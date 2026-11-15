import { go } from '../store'
import './guide.css'

type Term = [term: string, meaning: string, mark?: 'signal' | 'warn' | 'pos' | 'neg' | 'info']

const SECTIONS: { id: string; label: string; title: string; intro?: string; terms: Term[] }[] = [
  {
    id: 'brief', label: 'The Brief', title: 'Your portfolio, ranked by what needs you.',
    intro: 'The home page. Every Holding appears exactly once — as a Card if something material happened, as a Quiet row if nothing did. Clear the Cards and you are done for the day.',
    terms: [
      ['Needs you', 'Cards: material Filings and crossed Watch rules, ranked by severity then recency. The headline counts them.', 'signal'],
      ['Card', 'One thing that changed at one Holding. Tap to open the detail — results table, the new appointee, or the price move.'],
      ['Severity rail', 'The coloured bar on a Card. Orange: results, management change, M&A, litigation. Amber: price/volume moves and other material Filings.', 'warn'],
      ['Clear', 'Dismiss a Card (swipe left, or tap Clear). The Holding drops into Quiet. Undo appears for a few seconds; Watch rules can restore all cleared Cards.'],
      ['Dig in', 'Open the Dossier for that company.'],
      ['Triage meter', 'One segment per Card in the window. Segments fade as you clear them.'],
      ['Window', '24h / 3d / 7d / 30d of Filings, measured back from the latest Filing so a weekend never shows an empty Brief.'],
      ['Routine', 'Filings judged not worth your attention — investor-meeting schedules, procedural notices, concall recordings. Folded into one line; open it to see each with a one-line summary.'],
      ['Quiet', 'Holdings with no open Card. One row each: close, day move, volume vs its 20-day average, 30-session sparkline.'],
      ['Watch rules', 'Your thresholds (sliders button in the dock): day move beyond ±X%, volume above N× the 20-day average, and per Filing type “always Card / Auto / always Routine”. Changes re-rank the Brief instantly.'],
    ],
  },
  {
    id: 'dossier', label: 'The Dossier', title: 'What should I think of this company?',
    intro: 'On-demand research for any indexed NSE company, built only from primary sources — the company’s own results filings, concall transcripts and investor presentations. No news, no broker notes.',
    terms: [
      ['Verdict', 'The opening sentence: how many of management’s promises were kept, from the last four quarters of guidance.'],
      ['Promises vs delivered', 'What management explicitly guided each quarter (growth, margins, capex, targets) against what the later numbers or calls showed.'],
      ['Kept', 'Delivered in full by the numbers.', 'pos'],
      ['Partly', 'Delivered in part, late, or only by a softer measure.', 'warn'],
      ['Missed', 'Not delivered, or reversed.', 'neg'],
      ['Pending', 'The deadline has not arrived yet — too early to judge.', 'info'],
      ['Agrees / Diverges', 'Narrative vs numbers: a claim management made, set against the reported figures. Solid green rail when they agree, dashed red when they diverge.'],
      ['Guidance', 'Management’s outstanding forward targets, with the call they were given on.'],
      ['Flags', 'Rule-based observations from the financials, each citing its number. Green healthy, amber watch, red concern.'],
      ['Ask', 'Search the company’s own transcripts. Answers are quoted passages with their source — never generated text.'],
      ['Provenance line', '“Computed from filings” = deterministic code over reported numbers. “From transcripts · model” = analysed by the named model, once, and cached.'],
    ],
  },
  {
    id: 'numbers', label: 'Numbers', title: 'The figures, in plain words.',
    terms: [
      ['Revenue', 'Total sales — the top line.'],
      ['EBITDA', 'Earnings before interest, tax, depreciation and amortisation: core operating profit. For banks and NBFCs FINN shows Financing profit in this slot.'],
      ['PBT / PAT', 'Profit before tax / profit after tax (the bottom line).'],
      ['QoQ / YoY', 'Change vs the previous quarter / vs the same quarter a year ago (strips out seasonality).'],
      ['OPM', 'Operating profit margin: EBITDA ÷ revenue.'],
      ['CAGR', 'Compound annual growth rate over 3 or 5 years.'],
      ['CFO / PAT', 'Cash from operations ÷ profit. Near or above 1 means profits are turning into cash; persistently below is a red flag.'],
      ['FCF', 'Free cash flow: cash from operations minus capital spending.'],
      ['D/E', 'Debt ÷ equity — how much the company leans on borrowing.'],
      ['Cash cycle (CCC)', 'Days of cash tied up in inventory and receivables, net of payables. Lengthening quietly drains cash. Not meaningful for lenders.'],
      ['ROCE / ROE', 'Return on capital employed / on shareholders’ equity.'],
      ['Volume ×', 'Today’s traded volume divided by the average of the previous 20 sessions.'],
    ],
  },
]

export function Guide() {
  return (
    <div className="gd">
      <header className="gd-top">
        <button className="tap gd-back" aria-label="Back to the Brief" onClick={() => (history.length > 1 ? history.back() : go('/'))}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="label">How FINN works</span>
      </header>

      <h1 className="gd-h1">Two pages. One question each.</h1>
      <p className="gd-lede">
        The <b>Brief</b> answers <em>what changed that needs me?</em> The <b>Dossier</b> answers <em>what should I think of this company?</em> Everything else is evidence.
      </p>
      <nav className="gd-toc" aria-label="Sections">
        {SECTIONS.map((s) => <a key={s.id} href={`#/guide`} onClick={(e) => { e.preventDefault(); document.getElementById(`g-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{s.label}</a>)}
      </nav>

      {SECTIONS.map((s) => (
        <section key={s.id} id={`g-${s.id}`} className="gd-sec">
          <div className="label">{s.label}</div>
          <h2 className="gd-h2">{s.title}</h2>
          {s.intro && <p className="gd-intro">{s.intro}</p>}
          <dl className="gd-terms">
            {s.terms.map(([t, m, mark]) => (
              <div key={t} className="gd-row">
                <dt>{mark && <i className={`gd-dot ${mark}`} aria-hidden="true" />}{t}</dt>
                <dd>{m}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="prov gd-foot">Data: screener.in (BSE filings, end-of-day prices, reported financials, concall transcripts). Classification and numbers are deterministic code; transcript analysis is done once per company and cached.</p>
    </div>
  )
}
