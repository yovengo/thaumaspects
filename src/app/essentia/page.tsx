import type { Metadata } from 'next'
import EssentiaPlanner from '@/features/essentia/EssentiaPlanner'

export const metadata: Metadata = {
  title: 'Essentia Planner — Thaumaspects',
}

export default function EssentiaPage() {
  return <EssentiaPlanner />
}
