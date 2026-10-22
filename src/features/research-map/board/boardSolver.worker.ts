import {
  type BoardSearchOptions,
  type BoardSearchProgress,
  type BoardSolveResult,
  solveAllAnchors,
} from '@/features/research-map/board/boardSolver'
import type { Catalog } from '@/features/research-map/model/types'

export type SolveRequest = {
  board: Record<string, string>
  anchors: string[]
  obstacles: string[]
  boardSize: number
  catalog: Catalog
  enabled: string[]
  options?: BoardSearchOptions
}

export type SolveResponse =
  | { type: 'search'; progress: BoardSearchProgress }
  | { type: 'complete'; result: BoardSolveResult }
  | { type: 'error' }

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  let lastUpdate = -Infinity

  try {
    const { board, anchors, obstacles, boardSize, catalog, enabled, options } = event.data
    const result = solveAllAnchors({
      board,
      anchorCells: new Set(anchors),
      obstacles: new Set(obstacles),
      boardSize,
      catalog,
      enabled: new Set(enabled),
      options,
      onSearch: (progress) => {
        const now = performance.now()
        if (now - lastUpdate < 70) return
        lastUpdate = now
        self.postMessage({ type: 'search', progress } satisfies SolveResponse)
      },
    })
    self.postMessage({ type: 'complete', result } satisfies SolveResponse)
  } catch {
    self.postMessage({ type: 'error' } satisfies SolveResponse)
  }
}
