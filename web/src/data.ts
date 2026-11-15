// Data access. Reads the real pipeline output under data/; if brief.json is
// absent (fresh checkout, pipeline not run) the whole app switches to the
// bundled fixtures under data/_fixtures/ and says so in the header.
const BASE = `${import.meta.env.BASE_URL}data/`
let root: Promise<string> | null = null

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    // Vite dev server answers unknown paths with index.html (200), so parse defensively.
    const text = await res.text()
    if (!text || text.trimStart().startsWith('<')) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function dataRoot(): Promise<string> {
  if (!root) {
    root = getJson<unknown>(`${BASE}brief.json`).then((b) => (b ? BASE : `${BASE}_fixtures/`))
  }
  return root
}

export async function usingFixtures(): Promise<boolean> {
  return (await dataRoot()) !== BASE
}

const cache = new Map<string, Promise<unknown>>()
export function load<T>(path: string): Promise<T | null> {
  if (!cache.has(path)) cache.set(path, dataRoot().then((r) => getJson<T>(r + path)))
  return cache.get(path) as Promise<T | null>
}
