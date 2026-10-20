'use client'

import Image from 'next/image'
import { useState } from 'react'
import { aspectLabel } from '@/features/essentia/shared/format'

export function AspectIcon({ name }: { name: string }) {
  const [missing, setMissing] = useState(false)
  return missing ? (
    <span className="ess-aspect-icon ess-aspect-fallback" aria-hidden="true">
      {name.slice(0, 2).toUpperCase()}
    </span>
  ) : (
    <Image
      className="ess-aspect-icon"
      src={`/aspects/color/${name === 'strontio' ? 'stronito' : name}.png`}
      width={25}
      height={25}
      onError={() => setMissing(true)}
      alt=""
    />
  )
}

export function AspectTag({ name, amount }: { name: string; amount?: number }) {
  return (
    <span className="ess-aspect-tag">
      <AspectIcon name={name} />
      <span>{aspectLabel(name)}</span>
      {amount !== undefined && <b>{amount}</b>}
    </span>
  )
}
