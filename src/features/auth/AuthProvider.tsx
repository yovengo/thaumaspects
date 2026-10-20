'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect } from 'react'
import type { Availability } from '@/features/auth/availabilityStorage'
import { codeKey, sessionKey } from '@/features/auth/queryKeys'
import { readRecentAccessCodes, rememberRecentAccessCode } from '@/features/auth/recentAccessCodes'
import { type User, useCloudAvailability } from '@/features/auth/useCloudAvailability'
import { api } from '@/lib/apiClient'

type AuthContextValue = {
  user: User | null
  loading: boolean
  showSignedInIcon: boolean
  syncError: boolean
  login: (code: string) => Promise<void>
  register: () => Promise<string>
  logout: () => Promise<void>
  availabilityChanged: (before: Availability, after: Availability) => void
}

const Context = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  hasSessionCookie,
}: {
  children: ReactNode
  hasSessionCookie: boolean
}) {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: () => api<{ user: User | null }>('/api/auth/me'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnReconnect: false,
  })
  const user = session.data?.user ?? null
  const cloud = useCloudAvailability(user, session.isPending)

  useEffect(() => {
    if (!user || readRecentAccessCodes().some((entry) => entry.userId === user.id)) return
    const userId = user.id
    void queryClient
      .fetchQuery({
        queryKey: codeKey(userId),
        queryFn: () => api<{ code: string | null }>('/api/auth/code'),
        staleTime: Infinity,
      })
      .then(({ code }) => {
        if (code) rememberRecentAccessCode(userId, code)
      })
      .catch(() => {})
  }, [user, queryClient])

  const login = async (code: string) => {
    const result = await api<{ user: User }>('/api/auth/login', 'POST', { code })
    const digits = code.replace(/\D/g, '')
    const formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`
    queryClient.setQueryData(codeKey(result.user.id), { code: formatted })
    rememberRecentAccessCode(result.user.id, formatted)
    await cloud.activate(result.user, true)
  }

  const register = async () => {
    const result = await api<{ user: User; code: string }>('/api/auth/register', 'POST')
    queryClient.setQueryData(codeKey(result.user.id), { code: result.code })
    rememberRecentAccessCode(result.user.id, result.code)
    await cloud.activate(result.user, true)
    return result.code
  }

  const logout = async () => {
    await api('/api/auth/logout', 'POST')
    cloud.deactivate()
  }

  return (
    <Context.Provider
      value={{
        user,
        loading: session.isPending,
        showSignedInIcon: Boolean(user) || (session.isPending && hasSessionCookie),
        syncError: cloud.syncError || session.isError,
        login,
        register,
        logout,
        availabilityChanged: cloud.availabilityChanged,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('AuthProvider missing')
  return value
}
