'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

type PendingFlight = {
  request: string
  anchor: HTMLElement | null
  anchorTop: number
  scrollY: number
}

export function useFavoriteFlight(catalogSearching: boolean, catalogRequest: string) {
  const pending = useRef<PendingFlight | null>(null)
  const activeAnimation = useRef<Animation | null>(null)

  const startFavoriteFlight = (row: HTMLElement) => {
    const anchor = (row.nextElementSibling ?? row.previousElementSibling) as HTMLElement | null
    pending.current = {
      request: catalogRequest,
      anchor,
      anchorTop: anchor?.getBoundingClientRect().top ?? 0,
      scrollY: window.scrollY,
    }

    activeAnimation.current?.cancel()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const start = row.getBoundingClientRect()
    const listTop = row.parentElement?.getBoundingClientRect().top ?? start.top
    const distanceToTop = Math.max(0, start.top - listTop)
    if (distanceToTop < start.height / 2) return
    const travel = Math.min(180, distanceToTop * 0.45)

    const copy = row.cloneNode(true) as HTMLElement
    copy.classList.add('ess-catalog-flying-copy')
    copy.inert = true
    copy.setAttribute('aria-hidden', 'true')
    copy.style.top = `${start.top}px`
    copy.style.left = `${start.left}px`
    copy.style.width = `${start.width}px`
    document.body.append(copy)
    row.classList.add('is-departing')

    const animation = copy.animate(
      [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: `translateY(-${travel}px) scale(0.96)`, opacity: 0 },
      ],
      { duration: 240, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    )
    activeAnimation.current = animation
    const finish = () => {
      copy.remove()
      row.classList.remove('is-departing')
      if (activeAnimation.current === animation) activeAnimation.current = null
    }
    animation.onfinish = finish
    animation.oncancel = finish
  }

  useEffect(() => () => activeAnimation.current?.cancel(), [])

  useLayoutEffect(() => {
    const flight = pending.current
    if (!flight || flight.request === catalogRequest) return

    if (flight.anchor?.isConnected) {
      const shift = flight.anchor.getBoundingClientRect().top - flight.anchorTop
      if (Math.abs(shift) > 0.5) window.scrollBy({ top: shift, behavior: 'instant' })
    } else if (window.scrollY !== flight.scrollY) {
      window.scrollTo({ top: flight.scrollY, behavior: 'instant' })
    }

    if (catalogSearching) return
    pending.current = null
  }, [catalogSearching, catalogRequest])

  return startFavoriteFlight
}
