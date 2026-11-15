import type { ReactNode } from 'react'
import { go } from '../store'
import './guide.css'

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="gd-step">
      <span className="gd-n num" aria-hidden="true">{n}</span>
      <div className="gd-step-body">{children}</div>
    </li>
  )
}

const WORDS: [string, string][] = [
  ['Revenue', 'Total sales. The top line.'],
  ['EBITDA', 'Profit from running the business, before interest, tax and wear-and-tear. Banks show Financing profit here instead.'],
  ['PAT', 'Profit after tax. What is left for shareholders.'],
  ['QoQ', 'Change from the quarter before.'],
  ['YoY', 'Change from the same quarter last year.'],
  ['Margin', 'How much of each rupee of sales is kept as profit.'],
  ['CFO / PAT', 'Is profit turning into cash? Near 1 or above is healthy.'],
  ['FCF', 'Cash left after paying for new plant and equipment.'],
  ['D/E', 'How much the company borrows for every rupee it owns.'],
  ['Cash cycle', 'Days of cash stuck in stock and unpaid bills. Longer is worse.'],
  ['ROCE', 'Profit earned on the money put into the business.'],
  ['Volume ×', 'Today’s trading versus a normal day. 3× means three times usual.'],
]

export function Guide() {
  return (
    <div className="gd">
      <header className="gd-top">
        <button className="tap gd-back" aria-label="Back to the Brief" onClick={() => (history.length > 1 ? history.back() : go('/'))}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="label">Help</span>
      </header>

      <h1 className="gd-h1">How to use FINN</h1>
      <p className="gd-lede">FINN reads every filing from the companies you own and shows you only what matters.</p>

      <section className="gd-sec">
        <h2 className="gd-h2">Your daily check</h2>
        <p className="gd-meta">About 2 minutes</p>
        <ol className="gd-steps">
          <Step n={1}>
            Open FINN. The headline tells you how many things need you.
            <div className="gd-mock gd-mock-head" aria-hidden="true">
              <span className="gd-mock-h">3 things need you.</span>
              <span className="gd-meter"><i className="on" /><i className="on" /><i className="on" /><i /></span>
            </div>
          </Step>
          <Step n={2}>
            Tap a Card to see what happened: the results, the new appointee or the price move.
          </Step>
          <Step n={3}>
            Tap <b>Dig in →</b> to research the company. Tap <b>Clear</b>, or swipe left, once you’ve seen it.
          </Step>
          <Step n={4}>
            When the headline says <b>All clear</b>, you’re done for the day.
          </Step>
        </ol>
        <ul className="gd-tips">
          <li>Tap <b>24h</b>, <b>3d</b>, <b>7d</b> or <b>30d</b> to look further back.</li>
          <li>Routine filings, like meeting schedules, are folded into one line. Tap it to see them.</li>
          <li>Companies with nothing new sit in the quiet list at the bottom.</li>
        </ul>
      </section>

      <section className="gd-sec">
        <h2 className="gd-h2">Set what counts as important</h2>
        <ol className="gd-steps">
          <Step n={1}>Tap the <b>sliders</b> button at the bottom right.</Step>
          <Step n={2}>Choose how big a <b>day move</b> (in %) should get a Card.</Step>
          <Step n={3}>Choose how much <b>volume</b> (× a normal day) should get a Card.</Step>
          <Step n={4}>For each filing type, pick <b>Always Card</b>, <b>Auto</b> or <b>Always Routine</b>.</Step>
        </ol>
        <p className="gd-note">Your Brief updates as soon as you change a setting.</p>
      </section>

      <section className="gd-sec">
        <h2 className="gd-h2">Get alerts on your phone</h2>
        <p className="gd-p">Open the sliders sheet and turn on <b>Phone alerts</b>. FINN will notify you when a new Card arrives.</p>
      </section>

      <section className="gd-sec">
        <h2 className="gd-h2">Research a company</h2>
        <ol className="gd-steps">
          <Step n={1}>Tap the search bar at the bottom and type a company name.</Step>
          <Step n={2}>
            Read the verdict first. It tells you how often management did what they said.
            <div className="gd-mock gd-mock-verdict" aria-hidden="true">
              <span className="gd-mock-v">Management kept 5 of 7 promises.</span>
              <span className="gd-bar"><i className="pos" /><i className="pos" /><i className="pos" /><i className="pos" /><i className="pos" /><i className="warn" /><i className="neg" /></span>
            </div>
          </Step>
          <Step n={3}>Use the tabs to jump to promises, numbers, guidance and flags.</Step>
          <Step n={4}>Tap <b>Ask</b> to search what management said on calls. Answers are quoted word for word, with the source.</Step>
        </ol>
        <p className="gd-note">Not in FINN yet? Tap <b>Build it</b>. The research is ready in a few minutes.</p>
      </section>

      <section className="gd-sec">
        <h2 className="gd-h2">What the colours and words mean</h2>

        <h3 className="gd-h3">Promises</h3>
        <ul className="gd-key">
          <li><span className="pill pos">Kept</span>They did what they said.</li>
          <li><span className="pill warn">Partly</span>Some of it, or late.</li>
          <li><span className="pill neg">Missed</span>They didn’t, or went back on it.</li>
          <li><span className="pill info">Pending</span>Too early to tell.</li>
        </ul>

        <h3 className="gd-h3">Card colours</h3>
        <ul className="gd-key">
          <li><span className="gd-rail signal" aria-hidden="true" />Orange: results, a leadership change, a deal or a legal case.</li>
          <li><span className="gd-rail warn" aria-hidden="true" />Amber: a big price or volume move, or another notable filing.</li>
        </ul>

        <h3 className="gd-h3">Story vs numbers</h3>
        <ul className="gd-key">
          <li><span className="pill pos">Agrees</span>What management said matches the figures.</li>
          <li><span className="pill neg">Diverges</span>The figures tell a different story.</li>
        </ul>

        <h3 className="gd-h3">The numbers</h3>
        <dl className="gd-words">
          {WORDS.map(([t, m]) => (
            <div key={t} className="gd-word"><dt>{t}</dt><dd>{m}</dd></div>
          ))}
        </dl>
      </section>

      <p className="prov gd-foot">Data from company filings, results and call transcripts via screener.in. No news, no broker notes.</p>
    </div>
  )
}
