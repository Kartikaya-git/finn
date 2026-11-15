import { Brief } from './Brief'
import { Dossier } from './Dossier'
import { useHash } from './store'

export function App() {
  const hash = useHash()
  const m = hash.match(/^#\/d\/([^/?]+)/)
  return <main className="shell">{m ? <Dossier symbol={decodeURIComponent(m[1]).toUpperCase()} /> : <Brief />}</main>
}
