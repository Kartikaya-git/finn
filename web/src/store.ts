import { useEffect, useState } from 'react'

export function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...JSON.parse(v) } : fallback
  } catch {
    return fallback
  }
}
export function readLSArray(key: string): string[] {
  try {
    const v = localStorage.getItem(key)
    const a = v ? JSON.parse(v) : []
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}
export function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / blocked storage: state lives for this session only */
  }
}

export function useHash(): string {
  const [h, setH] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const on = () => setH(window.location.hash || '#/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return h
}
export const go = (path: string) => {
  window.location.hash = path
}
