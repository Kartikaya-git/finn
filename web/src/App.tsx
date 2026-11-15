import { Brief } from './brief/Brief'
import { Dossier } from './dossier/Dossier'
import { useHash } from './store'

export function App() {
  const hash = useHash()
  const m = hash.match(/^#\/d\/([^/?]+)/)
  return <main className="shell">{m ? <Dossier key={m[1]} symbol={decodeURIComponent(m[1]).toUpperCase()} /> : <Brief />}</main>
}
