import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import '@/index.css'
import '@/App.css'
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
