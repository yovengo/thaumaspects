import type { ReactNode } from 'react'
import { SiteHeader } from './SiteHeader'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <main className="app-shell">
      <SiteHeader />
      {children}
      <footer>
        <a
          href="https://github.com/ythri/tcresearch/tree/gh-pages"
          target="_blank"
          rel="noreferrer"
        >
          ythri/tcresearch
        </a>{' '}
        ·{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>{' '}
        ·{' '}
        <a href="https://github.com/yovengo/thaumaspects" target="_blank" rel="noreferrer">
          Source code
        </a>
      </footer>
    </main>
  )
}
