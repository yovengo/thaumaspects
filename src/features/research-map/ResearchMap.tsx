'use client'

import { AspectSettings } from '@/features/research-map/availability/AspectSettings'
import { ResearchBoard } from '@/features/research-map/board/ResearchBoard'
import { ArrowLeftIcon, SearchIcon } from '@/features/research-map/icons'
import { QuickSearch } from '@/features/research-map/quick-search/QuickSearch'
import { useResearchMap } from '@/features/research-map/state/useResearchMap'

export default function ResearchMap() {
  const { catalog, mode, switchMode, quickSearch, researchBoard, availability } = useResearchMap()

  return (
    <>
      <div className="page-heading">
        <h1>{mode === 'quick' ? 'Quick Search' : 'Research Map'}</h1>
        <button className="secondary-link" type="button" onClick={switchMode}>
          {mode === 'quick' ? (
            <>
              <ArrowLeftIcon /> Research Map
            </>
          ) : (
            <>
              <SearchIcon /> Quick Search
            </>
          )}
        </button>
      </div>
      {mode === 'board' && <ResearchBoard controller={researchBoard} />}
      {mode === 'quick' && <QuickSearch catalog={catalog} controller={quickSearch} />}
      <AspectSettings
        catalog={catalog}
        controller={availability}
        isSolving={researchBoard.solvePhase !== 'idle'}
      />
    </>
  )
}
