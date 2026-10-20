import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import '@/styles/tokens.css'
import '@/index.css'
import '@/styles/base.css'
import '@/shared/layout/SiteShell.css'
import '@/features/research-map/quick-search/QuickSearch.css'
import '@/features/research-map/board/ResearchBoard.css'
import '@/features/research-map/availability/AspectSettings.css'
import '@/features/essentia/EssentiaPlanner.css'
import '@/features/essentia/shared/EssentiaShared.css'
import '@/features/essentia/target/TargetPanel.css'
import '@/features/essentia/furnace/FurnacePanel.css'
import '@/features/essentia/alternatives/AlternativesPanel.css'
import '@/features/essentia/catalog/CatalogPanel.css'
import '@/features/auth/AuthControl.css'
import { ClientProviders } from '@/components/ClientProviders'
import { SESSION_COOKIE } from '@/server/auth'
import { SiteShell } from '@/shared/layout/SiteShell'

export const metadata: Metadata = {
  title: 'Thaumaspects — GTNH Research & Essentia',
  description: 'GTNH research map and essentia planner.',
  icons: { icon: '/favicon.svg' },
  other: { google: 'notranslate' },
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hasSessionCookie = (await cookies()).has(SESSION_COOKIE)
  return (
    <html lang="en" translate="no" className="notranslate" data-scroll-behavior="smooth">
      <body>
        <ClientProviders hasSessionCookie={hasSessionCookie}>
          <SiteShell>{children}</SiteShell>
        </ClientProviders>
        <Analytics />
      </body>
    </html>
  )
}
