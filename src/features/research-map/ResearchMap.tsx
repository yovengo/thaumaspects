'use client'

import { AspectSettings } from '@/features/research-map/availability/AspectSettings'
import type { ResearchBoardInput } from '@/features/research-map/board/boardInput'
import { ResearchBoard } from '@/features/research-map/board/ResearchBoard'
import { ArrowLeftIcon, SearchIcon } from '@/features/research-map/icons'
import { QuickSearch } from '@/features/research-map/quick-search/QuickSearch'
import { useResearchMap } from '@/features/research-map/state/useResearchMap'

export default function ResearchMap({ boardInput }: { boardInput?: ResearchBoardInput | null }) {
  const { catalog, mode, switchMode, quickSearch, researchBoard, availability, boardInputError } =
    useResearchMap(boardInput)

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
      {boardInputError && (
        <p className="board-input-error" role="alert">
          Unable to load map: {boardInputError}
        </p>
      )}
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
