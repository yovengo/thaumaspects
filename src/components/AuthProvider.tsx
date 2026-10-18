'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import {
  applyPendingFavorites,
  favoriteChanges,
  type PendingFavoriteChanges,
  remainingFavoriteChanges,
} from '@/lib/favoriteSync'
import { codeKey, favoritesKey, sessionKey } from '@/lib/queryKeys'
import { readRecentAccessCodes, rememberRecentAccessCode } from '@/lib/recentAccessCodes'

type User = { id: string }
type Availability = { preferred: string[]; excluded: string[]; stage: string }
type CloudItems = { items: string[]; unavailable: string[] }
type Pending = PendingFavoriteChanges
type AuthContextValue = {
  user: User | null
  loading: boolean
  showSignedInIcon: boolean
  syncError: boolean
  login: (code: string) => Promise<void>
  register: () => Promise<string>
  logout: () => Promise<void>
  rotate: () => Promise<string>
  availabilityChanged: (before: Availability, after: Availability) => void
}

const Context = createContext<AuthContextValue | null>(null)
const availabilityKey = 'thaumaspects:availability:v2'
const availabilityEvent = 'thaumaspects:availability-changed'
const anonymousKey = 'thaumaspects:anonymous-availability:v1'
const anonymousAdditionsKey = 'thaumaspects:anonymous-added:v1'
const anonymousUnavailableAdditionsKey = 'thaumaspects:anonymous-unavailable-added:v1'
const accountKey = (id: string) => `thaumaspects:cloud:${id}:v1`
const unavailableAccountKey = (id: string) => `thaumaspects:cloud-unavailable:${id}:v1`
const pendingKey = (id: string) => `thaumaspects:pending:${id}:v1`
const unavailablePendingKey = (id: string) => `thaumaspects:pending-unavailable:${id}:v1`

function readAvailability(): Availability {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(availabilityKey) || '{}',
    ) as Partial<Availability>
    return {
      preferred: Array.isArray(parsed.preferred)
        ? parsed.preferred.filter((item): item is string => typeof item === 'string')
        : [],
      excluded: Array.isArray(parsed.excluded)
        ? parsed.excluded.filter((item): item is string => typeof item === 'string')
        : [],
      stage: typeof parsed.stage === 'string' ? parsed.stage : 'NONE',
    }
  } catch {
    return { preferred: [], excluded: [], stage: 'NONE' }
  }
}

function writeAvailability(preferred: string[], excluded: string[]) {
  const current = readAvailability()
  if (
    current.preferred.length === preferred.length &&
    current.preferred.every((item, index) => item === preferred[index]) &&
    current.excluded.length === excluded.length &&
    current.excluded.every((item, index) => item === excluded[index])
  )
    return
  localStorage.setItem(availabilityKey, JSON.stringify({ ...current, preferred, excluded }))
  window.dispatchEvent(new Event(availabilityEvent))
}

function readPending(id: string, unavailable = false): Pending {
  try {
    const key = unavailable ? unavailablePendingKey(id) : pendingKey(id)
    const value = JSON.parse(localStorage.getItem(key) || '{}') as Pending
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, 'add' | 'remove'] =>
          (entry[1] === 'add' || entry[1] === 'remove') &&
          entry[0].length > 0 &&
          entry[0].length <= 2000,
      ),
    )
  } catch {
    return {}
  }
}

function readAnonymousAdditions(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(stored)
      ? stored.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function updateAnonymousAdditions(key: string, changes: Pending) {
  if (!Object.keys(changes).length) return
  const next = new Set(readAnonymousAdditions(key))
  for (const [item, action] of Object.entries(changes)) {
    if (action === 'add') next.add(item)
    else next.delete(item)
  }
  localStorage.setItem(key, JSON.stringify([...next]))
}

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
  const loading = session.isPending
  const showSignedInIcon = Boolean(user) || (loading && hasSessionCookie)
  const [syncError, setSyncError] = useState(false)
  const userRef = useRef<User | null>(null)
  const drainingRef = useRef<string | null>(null)
  const beforeAuthChangesRef = useRef<Pending>({})
  const beforeAuthUnavailableChangesRef = useRef<Pending>({})
  const initialActivationRef = useRef(false)

  const drain = useCallback(
    async (id: string) => {
      if (drainingRef.current === id || userRef.current?.id !== id) return
      drainingRef.current = id
      let completed = false
      try {
        let changed = false
        while (userRef.current?.id === id) {
          const sent = Object.fromEntries(Object.entries(readPending(id)).slice(0, 500)) as Pending
          const unavailableSent = Object.fromEntries(
            Object.entries(readPending(id, true)).slice(0, 500),
          ) as Pending
          if (!Object.keys(sent).length && !Object.keys(unavailableSent).length) break
          const remote = await api<CloudItems>('/api/favorites', 'PATCH', {
            changes: sent,
            unavailableChanges: unavailableSent,
          })
          if (userRef.current?.id !== id) return
          queryClient.setQueryData(favoritesKey(id), remote)
          const pending = remainingFavoriteChanges(readPending(id), sent)
          const unavailablePending = remainingFavoriteChanges(
            readPending(id, true),
            unavailableSent,
          )
          localStorage.setItem(pendingKey(id), JSON.stringify(pending))
          localStorage.setItem(unavailablePendingKey(id), JSON.stringify(unavailablePending))
          writeAvailability(
            applyPendingFavorites(remote.items, pending),
            applyPendingFavorites(remote.unavailable, unavailablePending),
          )
          changed = true
        }
        if (userRef.current?.id === id && !changed) {
          const remote = await queryClient.fetchQuery({
            queryKey: favoritesKey(id),
            queryFn: () => api<CloudItems>('/api/favorites'),
            staleTime: 60_000,
          })
          if (userRef.current?.id === id)
            writeAvailability(
              applyPendingFavorites(remote.items, readPending(id)),
              applyPendingFavorites(remote.unavailable, readPending(id, true)),
            )
        }
        if (userRef.current?.id === id) setSyncError(false)
        completed = true
      } catch {
        if (userRef.current?.id === id) setSyncError(true)
      } finally {
        if (drainingRef.current === id) drainingRef.current = null
        if (
          completed &&
          userRef.current?.id === id &&
          (Object.keys(readPending(id)).length || Object.keys(readPending(id, true)).length)
        )
          queueMicrotask(() => void drain(id))
      }
    },
    [queryClient],
  )

  const syncAccount = useCallback(
    async (id: string) => {
      try {
        const syncFavorites = !localStorage.getItem(accountKey(id))
        const syncUnavailable = !localStorage.getItem(unavailableAccountKey(id))
        if (syncFavorites || syncUnavailable) {
          const local = readAvailability()
          const remote = await api<CloudItems>('/api/favorites/sync', 'POST', {
            items: syncFavorites ? local.preferred : [],
            unavailable: syncUnavailable ? local.excluded : [],
          })
          if (userRef.current?.id !== id) return
          queryClient.setQueryData(favoritesKey(id), remote)
          localStorage.setItem(accountKey(id), '1')
          localStorage.setItem(unavailableAccountKey(id), '1')
          writeAvailability(
            applyPendingFavorites(remote.items, readPending(id)),
            applyPendingFavorites(remote.unavailable, readPending(id, true)),
          )
        }
        await drain(id)
      } catch {
        if (userRef.current?.id === id) setSyncError(true)
      }
    },
    [drain, queryClient],
  )

  const activate = useCallback(
    async (next: User, explicitLogin: boolean) => {
      if (explicitLogin || !localStorage.getItem(accountKey(next.id))) {
        if (!localStorage.getItem(anonymousKey))
          localStorage.setItem(anonymousKey, JSON.stringify(readAvailability()))
      }
      userRef.current = next
      if (explicitLogin) queryClient.setQueryData(sessionKey, { user: next })
      const earlyChanges = beforeAuthChangesRef.current
      const earlyUnavailableChanges = beforeAuthUnavailableChangesRef.current
      beforeAuthChangesRef.current = {}
      beforeAuthUnavailableChangesRef.current = {}
      const anonymousAdded = readAnonymousAdditions(anonymousAdditionsKey)
      const anonymousUnavailableAdded = readAnonymousAdditions(anonymousUnavailableAdditionsKey)
      if (Object.keys(earlyChanges).length || anonymousAdded.length) {
        const additions = Object.fromEntries(anonymousAdded.map((item) => [item, 'add' as const]))
        localStorage.setItem(
          pendingKey(next.id),
          JSON.stringify({ ...readPending(next.id), ...additions, ...earlyChanges }),
        )
      }
      if (Object.keys(earlyUnavailableChanges).length || anonymousUnavailableAdded.length) {
        const additions = Object.fromEntries(
          anonymousUnavailableAdded.map((item) => [item, 'add' as const]),
        )
        localStorage.setItem(
          unavailablePendingKey(next.id),
          JSON.stringify({
            ...readPending(next.id, true),
            ...additions,
            ...earlyUnavailableChanges,
          }),
        )
      }
      await syncAccount(next.id)
      localStorage.removeItem(anonymousAdditionsKey)
      localStorage.removeItem(anonymousUnavailableAdditionsKey)
    },
    [queryClient, syncAccount],
  )

  useEffect(() => {
    if (initialActivationRef.current || session.isPending) return
    let active = true
    queueMicrotask(() => {
      if (!active || initialActivationRef.current) return
      initialActivationRef.current = true
      if (session.data?.user) void activate(session.data.user, false)
      else {
        beforeAuthChangesRef.current = {}
        beforeAuthUnavailableChangesRef.current = {}
      }
    })
    return () => {
      active = false
    }
  }, [activate, session.data, session.isPending])

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

  useEffect(() => {
    const retry = () => {
      if (userRef.current) void syncAccount(userRef.current.id)
    }
    const visible = () => {
      if (document.visibilityState === 'visible') retry()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [syncAccount])

  const login = async (code: string) => {
    const result = await api<{ user: User }>('/api/auth/login', 'POST', { code })
    const digits = code.replace(/\D/g, '')
    queryClient.setQueryData(codeKey(result.user.id), {
      code: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    })
    rememberRecentAccessCode(result.user.id, `${digits.slice(0, 5)}-${digits.slice(5)}`)
    await activate(result.user, true)
  }
  const register = async () => {
    const result = await api<{ user: User; code: string }>('/api/auth/register', 'POST')
    queryClient.setQueryData(codeKey(result.user.id), { code: result.code })
    rememberRecentAccessCode(result.user.id, result.code)
    await activate(result.user, true)
    return result.code
  }
  const logout = async () => {
    await api('/api/auth/logout', 'POST')
    userRef.current = null
    queryClient.setQueryData(sessionKey, { user: null })
    queryClient.removeQueries({ queryKey: ['auth', 'code'] })
    queryClient.removeQueries({ queryKey: ['favorites'] })
    setSyncError(false)
    const anonymous = localStorage.getItem(anonymousKey)
    if (anonymous) {
      localStorage.setItem(availabilityKey, anonymous)
      window.dispatchEvent(new Event(availabilityEvent))
      localStorage.removeItem(anonymousKey)
    } else {
      writeAvailability([], [])
    }
  }
  const rotate = async () => {
    const result = await api<{ code: string }>('/api/auth/rotate-code', 'POST')
    if (userRef.current) {
      queryClient.setQueryData(codeKey(userRef.current.id), result)
      rememberRecentAccessCode(userRef.current.id, result.code)
    }
    return result.code
  }
  const availabilityChanged = (before: Availability, after: Availability) => {
    const changes = favoriteChanges(before.preferred, after.preferred)
    const unavailableChanges = favoriteChanges(before.excluded, after.excluded)
    if (!Object.keys(changes).length && !Object.keys(unavailableChanges).length) return
    const id = userRef.current?.id
    if (!id) {
      if (loading) {
        beforeAuthChangesRef.current = { ...beforeAuthChangesRef.current, ...changes }
        beforeAuthUnavailableChangesRef.current = {
          ...beforeAuthUnavailableChangesRef.current,
          ...unavailableChanges,
        }
      } else {
        updateAnonymousAdditions(anonymousAdditionsKey, changes)
        updateAnonymousAdditions(anonymousUnavailableAdditionsKey, unavailableChanges)
      }
      return
    }
    if (Object.keys(changes).length)
      localStorage.setItem(pendingKey(id), JSON.stringify({ ...readPending(id), ...changes }))
    if (Object.keys(unavailableChanges).length)
      localStorage.setItem(
        unavailablePendingKey(id),
        JSON.stringify({ ...readPending(id, true), ...unavailableChanges }),
      )
    if (localStorage.getItem(accountKey(id)) && localStorage.getItem(unavailableAccountKey(id)))
      void drain(id)
  }

  return (
    <Context.Provider
      value={{
        user,
        loading,
        showSignedInIcon,
        syncError: syncError || session.isError,
        login,
        register,
        logout,
        rotate,
        availabilityChanged,
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
