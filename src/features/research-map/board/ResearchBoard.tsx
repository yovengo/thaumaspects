'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { AspectPalette } from '@/features/research-map/board/AspectPalette'
import { BoardCanvas } from '@/features/research-map/board/BoardCanvas'
import { BoardToolbar } from '@/features/research-map/board/BoardToolbar'
import type { ResearchBoardController } from '@/features/research-map/board/useResearchBoard'
import { ScreenshotImport } from '@/features/research-map/recognition/ScreenshotImport'

export function ResearchBoard({ controller }: { controller: ResearchBoardController }) {
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <section
        className={`panel research-board ${controller.solvePhase !== 'idle' ? 'is-solving' : ''}`}
        aria-label="Research map"
      >
        <BoardToolbar controller={controller} onImportScreenshot={() => setImportOpen(true)} />
        <div
          className="board-layout"
          style={{ '--board-map-height': `${controller.boardMapHeight}px` } as CSSProperties}
        >
          <AspectPalette controller={controller} />
          <BoardCanvas controller={controller} />
        </div>
      </section>
      {importOpen && (
        <ScreenshotImport
          catalog={controller.catalog}
          onClose={() => setImportOpen(false)}
          onImport={controller.loadBoard}
        />
      )}
    </>
  )
}
