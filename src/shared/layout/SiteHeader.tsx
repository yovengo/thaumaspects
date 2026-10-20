'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AuthControl from '@/features/auth/AuthControl'

export function SiteHeader() {
  const pathname = usePathname()
  const onResearchMap = pathname === '/'
  const onEssentiaPlanner = pathname === '/essentia'

  return (
    <header className="site-header">
      <Link href="/" className="site-brand" aria-label="Thaumaspects home">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">
            <path d="M12 1.5 15.1 8.9 22.5 12 15.1 15.1 12 22.5 8.9 15.1 1.5 12 8.9 8.9Z" />
          </svg>
        </div>
        <div className="brand-copy">
          <strong>Thaumaspects</strong>
        </div>
      </Link>
      <nav className="primary-nav" aria-label="Main tools">
        <Link
          href="/"
          className={onResearchMap ? 'is-active' : ''}
          aria-current={onResearchMap ? 'page' : undefined}
        >
          <span aria-hidden="true">⬡</span> Research Map
        </Link>
        <Link
          href="/essentia"
          className={onEssentiaPlanner ? 'is-active' : ''}
          aria-current={onEssentiaPlanner ? 'page' : undefined}
        >
          <span aria-hidden="true">✧</span> Essentia Planner
        </Link>
      </nav>
      <div className="site-actions">
        <span className="site-version">
          <small>GTNH</small>
          <strong>2.9.0-beta-2</strong>
        </span>
        <AuthControl />
      </div>
    </header>
  )
}
