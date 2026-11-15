import { Brief } from './brief/Brief'
import { Dossier } from './dossier/Dossier'
import { Guide } from './guide/Guide'
import { useHash } from './store'

export function App() {
  const hash = useHash()
  const m = hash.match(/^#\/d\/([^/?]+)/)
  if (hash.startsWith('#/guide')) return <main className="shell"><Guide /></main>
  return <main className="shell">{m ? <Dossier key={m[1]} symbol={decodeURIComponent(m[1]).toUpperCase()} /> : <Brief />}</main>
}
