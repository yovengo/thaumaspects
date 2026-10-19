'use client'

import type { ResearchBoardController } from '@/features/research-map/board/useResearchBoard'
import { AspectIcon } from '@/features/research-map/icons'
import { aspectLabel as label } from '@/features/research-map/model/catalog'

export function AspectPalette({ controller }: { controller: ResearchBoardController }) {
  const {
    solvePhase,
    pendingAspect,
    paletteQuery,
    setPaletteQuery,
    paletteAspects,
    dragRef,
    setPendingAspect,
  } = controller

  return (
    <aside className="board-palette">
      <div className="palette-heading">
        <strong>{pendingAspect ? `${label(pendingAspect)} selected` : 'Aspects'}</strong>
      </div>
      <input
        value={paletteQuery}
        onChange={(event) => setPaletteQuery(event.target.value)}
        placeholder="Search aspects…"
        aria-label="Search map aspects"
      />
      <div className="palette-list">
        {paletteAspects.map((aspect) => (
          <button
            type="button"
            className={pendingAspect === aspect ? 'is-active' : ''}
            aria-pressed={pendingAspect === aspect}
            disabled={solvePhase !== 'idle'}
            draggable={solvePhase === 'idle'}
            onDragStart={(event) => {
              dragRef.current = true
              event.dataTransfer.setData('text/aspect', aspect)
            }}
            onDragEnd={() =>
              window.setTimeout(() => {
                dragRef.current = false
              }, 0)
            }
            onClick={() => setPendingAspect(aspect)}
            key={aspect}
          >
            <AspectIcon aspect={aspect} />
            <span>{label(aspect)}</span>
            <small>{aspect}</small>
          </button>
        ))}
        {paletteAspects.length === 0 && <p className="palette-empty">No aspects found.</p>}
      </div>
    </aside>
  )
}
