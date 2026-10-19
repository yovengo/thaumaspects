'use client'

import { maximumBoardSize, minimumBoardSize } from '@/features/research-map/board/boardGeometry'
import type { ResearchBoardController } from '@/features/research-map/board/useResearchBoard'
import { BroomIcon, MinusIcon, PlusIcon, WandIcon } from '@/features/research-map/icons'

export function BoardToolbar({ controller }: { controller: ResearchBoardController }) {
  const {
    solvePhase,
    boardSize,
    changeBoardSize,
    boardMessage,
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
      <p className="board-status" role="status">
        {boardMessage}
      </p>
      <div className="board-action-buttons">
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
