import type { Catalog } from '@/types/domain'
import { type BoardSearchProgress, type SolvedBoard, solveAllAnchors } from './boardSolver'

export type SolveRequest = {
  board: Record<string, string>
  anchors: string[]
  obstacles: string[]
  boardSize: number
  catalog: Catalog
  enabled: string[]
}

export type SolveResponse =
  | { type: 'search'; progress: BoardSearchProgress }
  | { type: 'complete'; result: SolvedBoard | { message: string } }
  | { type: 'error' }

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  let lastUpdate = -Infinity

  try {
    const { board, anchors, obstacles, boardSize, catalog, enabled } = event.data
    const result = solveAllAnchors(
      board,
      new Set(anchors),
      new Set(obstacles),
      boardSize,
      catalog,
      new Set(enabled),
      (progress) => {
        const now = performance.now()
        if (now - lastUpdate < 70) return
        lastUpdate = now
        self.postMessage({ type: 'search', progress } satisfies SolveResponse)
      },
    )
    self.postMessage({ type: 'complete', result } satisfies SolveResponse)
  } catch {
    self.postMessage({ type: 'error' } satisfies SolveResponse)
  }
}
