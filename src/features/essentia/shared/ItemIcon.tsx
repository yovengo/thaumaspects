'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { ItemAspect } from '@/features/essentia/model/planner'
import { displayItemName } from '@/features/essentia/shared/format'

export function ItemIcon({ item, large = false }: { item: ItemAspect; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const iconUrl = item.iconUrl
  const showImage = Boolean(iconUrl && failedUrl !== iconUrl)
  const name = displayItemName(item.name)
  return (
    <span
      className={`ess-item-icon ${large ? 'is-large' : ''} ${showImage ? 'has-texture' : ''}`}
      aria-hidden="true"
    >
      {showImage && iconUrl ? (
        <Image
          src={iconUrl}
          width={large ? 40 : 32}
          height={large ? 40 : 32}
          unoptimized
          loading="lazy"
          onError={() => setFailedUrl(iconUrl)}
          alt=""
        />
      ) : (
        <span>
          {name
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
