'use client'

import { AlternativesPanel } from '@/features/essentia/alternatives/AlternativesPanel'
import { CatalogPanel } from '@/features/essentia/catalog/CatalogPanel'
import { FurnacePanel } from '@/features/essentia/furnace/FurnacePanel'
import { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'
import { TargetPanel } from '@/features/essentia/target/TargetPanel'

export default function EssentiaPlanner() {
  const { target, furnace, alternatives, catalog } = useEssentiaPlanner()

  return (
    <div className="ess-page">
      <h1 className="sr-only">Essentia Planner</h1>
      <section
        className={`ess-main${furnace.sourcePickerOpen ? ' has-open-source' : ''}`}
        aria-label="Essentia calculation"
      >
        <TargetPanel controller={target} />
        <FurnacePanel controller={furnace} />
      </section>
      <AlternativesPanel controller={alternatives} />
      <CatalogPanel controller={catalog} />
    </div>
  )
}
