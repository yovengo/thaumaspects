import type { Metadata } from 'next'
import App from '../../App'

export const metadata: Metadata = {
  title: 'Essentia Planner — Thaumaspects',
}

export default function EssentiaPage() {
  return <App page="essentia" />
}
