'use client'

import { maximumBoardSize, minimumBoardSize } from '@/features/research-map/board/boardGeometry'
import type { ResearchBoardController } from '@/features/research-map/board/useResearchBoard'
import {
  BroomIcon,
  MinusIcon,
  PlusIcon,
  ScreenshotIcon,
  WandIcon,
} from '@/features/research-map/icons'

export function BoardToolbar({
  controller,
  onImportScreenshot,
}: {
  controller: ResearchBoardController
  onImportScreenshot: () => void
}) {
  const {
    solvePhase,
    boardSize,
    changeBoardSize,
    cancelSolve,
    finishReveal,
    solveEntireMap,
    clearMap,
  } = controller

  return (
    <div className="board-toolbar">
      {/* biome-ignore lint/a11y/useSemanticElements: This compact stepper uses its own accessible group label. */}
      <div className="board-radius" role="group" aria-label="Map radius">
        <span>Rings</span>
        <div className="board-radius-stepper">
          <button
            type="button"
            aria-label="Decrease map radius"
            disabled={boardSize <= minimumBoardSize || solvePhase !== 'idle'}
            onClick={() => changeBoardSize(boardSize - 2)}
          >
            <MinusIcon />
          </button>
          <output aria-live="polite">{Math.floor(boardSize / 2)}</output>
          <button
            type="button"
            aria-label="Increase map radius"
            disabled={boardSize >= maximumBoardSize || solvePhase !== 'idle'}
            onClick={() => changeBoardSize(boardSize + 2)}
          >
            <PlusIcon />
          </button>
        </div>
      </div>
      <div className="board-action-buttons">
        <button
          className="quiet-button board-screenshot-button"
          type="button"
          aria-label="Import screenshot (beta)"
          disabled={solvePhase !== 'idle'}
          onClick={onImportScreenshot}
        >
          <ScreenshotIcon />
          <span className="board-screenshot-label">Import screenshot</span>
          <span className="board-screenshot-beta" aria-hidden="true">
            Beta
          </span>
        </button>
        {solvePhase !== 'idle' && (
          <button
            className="quiet-button board-solve-control"
            type="button"
            onClick={solvePhase === 'searching' ? cancelSolve : finishReveal}
          >
            {solvePhase === 'searching' ? 'Cancel' : 'Show result'}
          </button>
        )}
        <button
          className="primary-button board-auto-button"
          type="button"
          aria-label="Auto-connect all"
          disabled={solvePhase !== 'idle'}
          onClick={solveEntireMap}
        >
          <WandIcon />
          <span className="board-auto-label-full">Auto-connect all</span>
          <span className="board-auto-label-short">Connect all</span>
        </button>
        <button
          className="quiet-button board-clear-button"
          type="button"
          aria-label="Clear map"
          title="Clear map"
          disabled={solvePhase !== 'idle'}
          onClick={clearMap}
        >
          <BroomIcon />
        </button>
      </div>
    </div>
  )
}
