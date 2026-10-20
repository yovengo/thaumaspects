'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/features/auth/AuthProvider'

let browserClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return new QueryClient()
  browserClient ??= new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  return browserClient
}

export function ClientProviders({
  children,
  hasSessionCookie,
}: {
  children: ReactNode
  hasSessionCookie: boolean
}) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <AuthProvider hasSessionCookie={hasSessionCookie}>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
