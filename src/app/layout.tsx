import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import '../index.css'
import '../App.css'

export const metadata: Metadata = {
  title: 'Thaumaspects — GTNH Research & Essentia',
  description: 'GTNH research map and essentia planner.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}<Analytics /></body></html>
}
