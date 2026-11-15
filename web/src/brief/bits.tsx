// Small shared pieces for the Brief: icons, the segmented control, an animated disclosure.
import { useEffect, useRef, type ReactNode } from 'react'

/** Exchange text arrives with SQL-escaped quotes ("Company''s"). */
export const tidy = (s: string) => s.replace(/''/g, '\u2019').replace(/\s+/g, ' ').trim()

export const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`)

export const shortName = (name: string) =>
  name.replace(/\s*\((India)\)/i, '').replace(/\s+(Ltd|Limited)\.?$/i, '').replace(/\s+Corporation$/i, ' Corp')

export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.4 6.6 11.4 12.6 4.8" />
    </svg>
  )
}

export function Chevron() {
  return (
    <svg className="bf-chev" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.2 8 10.2 12 6.2" />
    </svg>
  )
}

export function Sliders() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h7.5M14.5 6H17M3 14h2.5M9.5 14H17" />
      <circle cx="12.5" cy="6" r="2" />
      <circle cx="7.5" cy="14" r="2" />
    </svg>
  )
}

/** Pill segmented control with a sliding thumb. */
export function Segmented<K extends string>({ label, options, value, onChange, size = 'md' }: {
  label: string; options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void; size?: 'md' | 'sm'
}) {
  const idx = Math.max(0, options.findIndex((o) => o[0] === value))
  return (
    <div className={`bf-seg ${size}`} role="radiogroup" aria-label={label} style={{ ['--n' as string]: options.length, ['--i' as string]: idx }}>
      <i className="bf-seg-thumb" aria-hidden="true" />
      {options.map(([k, text]) => (
        <button key={k} type="button" role="radio" aria-checked={k === value} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>
          {text}
        </button>
      ))}
    </div>
  )
}

/** Height-animated disclosure; collapsed content is inert so it never takes focus. */
export function Reveal({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null)
  useEffect(() => {
    inner.current?.toggleAttribute('inert', !open)
  }, [open])
  return (
    <div className={`bf-reveal${open ? ' open' : ''} ${className}`}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
