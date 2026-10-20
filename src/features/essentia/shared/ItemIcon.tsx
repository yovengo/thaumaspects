'use client'

import Image from 'next/image'
import renderedIconBounds from '@/data/renderedIconBounds.json'
import type { ItemAspect } from '@/features/essentia/model/planner'
import { displayItemName } from '@/features/essentia/shared/format'

export function ItemIcon({ item, large = false }: { item: ItemAspect; large?: boolean }) {
  const { name, icon } = item
  const cleanName = displayItemName(name)
  const bounds =
    icon?.kind === 'rendered'
      ? ((renderedIconBounds.overrides as Record<string, number[]>)[icon.file] ??
        renderedIconBounds.default)
      : undefined
  const frameSize = large ? 40 : 32
  const [sourceWidth, sourceHeight, x, y, width, height] = bounds ?? [256, 256, 0, 0, 256, 256]
  const scale = (large ? 38 : 30) / Math.max(width, height)
  const renderedStyle = {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    left: frameSize / 2 - (x + width / 2) * scale,
    top: frameSize / 2 - (y + height / 2) * scale,
  }
  const title =
    icon?.quality === 'ambiguous'
      ? 'Several items share this name; one matching game icon is shown'
      : icon?.quality === 'related'
        ? 'Icon from a related item'
        : icon?.quality === 'generic'
          ? 'Exact icon unavailable; a game icon of this item type is shown'
          : undefined
  return (
    <span
      className={`ess-item-icon ${large ? 'is-large' : ''} ${icon ? 'has-texture' : ''} ${icon && icon.quality !== 'exact' ? 'is-approximate' : ''}`}
      title={title}
      aria-hidden="true"
    >
      {icon?.kind === 'atlas' ? (
        <Image
          className="ess-atlas-sprite"
          src={`/api/atlas-icons/${icon.id}`}
          width={32}
          height={32}
          alt=""
        />
      ) : icon?.kind === 'rendered' ? (
        <span className="ess-rendered-frame" style={{ width: frameSize, height: frameSize }}>
          <Image
            src={`/gt-icons/rendered/${icon.file}`}
            width={sourceWidth}
            height={sourceHeight}
            style={renderedStyle}
            alt=""
          />
        </span>
      ) : (
        <span>
          {cleanName
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join('')
            .toUpperCase()}
        </span>
      )}
    </span>
  )
}
