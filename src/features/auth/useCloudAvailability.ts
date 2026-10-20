'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Availability,
  accountNeedsSync,
  clearAnonymousAdditions,
  markAccountSynced,
  mergePending,
  type Pending,
  readAnonymousAdditions,
  readAvailability,
  readPending,
  rememberAnonymousAvailability,
  restoreAnonymousAvailability,
  updateAnonymousAdditions,
  writeAvailability,
  writePending,
} from '@/features/auth/availabilityStorage'
import {
  applyPendingFavorites,
  favoriteChanges,
  remainingFavoriteChanges,
} from '@/features/auth/favoriteSync'
import { favoritesKey, sessionKey } from '@/features/auth/queryKeys'
import { api } from '@/lib/apiClient'

export type User = { id: string }
type CloudItems = { items: string[]; unavailable: string[] }

export function useCloudAvailability(user: User | null, sessionPending: boolean) {
  const queryClient = useQueryClient()
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
          writePending(id, pending)
          writePending(id, unavailablePending, true)
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
        const needsSync = accountNeedsSync(id)
        if (needsSync.favorites || needsSync.unavailable) {
          const local = readAvailability()
          const remote = await api<CloudItems>('/api/favorites/sync', 'POST', {
            items: needsSync.favorites ? local.preferred : [],
            unavailable: needsSync.unavailable ? local.excluded : [],
          })
          if (userRef.current?.id !== id) return
          queryClient.setQueryData(favoritesKey(id), remote)
          markAccountSynced(id)
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
      if (explicitLogin) initialActivationRef.current = true
      if (explicitLogin || accountNeedsSync(next.id).favorites) rememberAnonymousAvailability()
      userRef.current = next
      if (explicitLogin) queryClient.setQueryData(sessionKey, { user: next })
      const earlyChanges = beforeAuthChangesRef.current
      const earlyUnavailableChanges = beforeAuthUnavailableChangesRef.current
      beforeAuthChangesRef.current = {}
      beforeAuthUnavailableChangesRef.current = {}
      const additions = Object.fromEntries(
        readAnonymousAdditions().map((item) => [item, 'add' as const]),
      )
      const unavailableAdditions = Object.fromEntries(
        readAnonymousAdditions(true).map((item) => [item, 'add' as const]),
      )
      mergePending(next.id, { ...additions, ...earlyChanges })
      mergePending(next.id, { ...unavailableAdditions, ...earlyUnavailableChanges }, true)
      await syncAccount(next.id)
      clearAnonymousAdditions()
    },
    [queryClient, syncAccount],
  )

  useEffect(() => {
    if (initialActivationRef.current || sessionPending) return
    let active = true
    queueMicrotask(() => {
      if (!active || initialActivationRef.current) return
      initialActivationRef.current = true
      if (user) void activate(user, false)
      else {
        beforeAuthChangesRef.current = {}
        beforeAuthUnavailableChangesRef.current = {}
      }
    })
    return () => {
      active = false
    }
  }, [activate, user, sessionPending])

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

  const deactivate = () => {
    userRef.current = null
    queryClient.setQueryData(sessionKey, { user: null })
    queryClient.removeQueries({ queryKey: ['auth', 'code'] })
    queryClient.removeQueries({ queryKey: ['favorites'] })
    setSyncError(false)
    restoreAnonymousAvailability()
  }

  const availabilityChanged = (before: Availability, after: Availability) => {
    const changes = favoriteChanges(before.preferred, after.preferred)
    const unavailableChanges = favoriteChanges(before.excluded, after.excluded)
    if (!Object.keys(changes).length && !Object.keys(unavailableChanges).length) return
    const id = userRef.current?.id
    if (!id) {
      if (sessionPending) {
        beforeAuthChangesRef.current = { ...beforeAuthChangesRef.current, ...changes }
        beforeAuthUnavailableChangesRef.current = {
          ...beforeAuthUnavailableChangesRef.current,
          ...unavailableChanges,
        }
      } else {
        updateAnonymousAdditions(changes)
        updateAnonymousAdditions(unavailableChanges, true)
      }
      return
    }
    mergePending(id, changes)
    mergePending(id, unavailableChanges, true)
    const needsSync = accountNeedsSync(id)
    if (!needsSync.favorites && !needsSync.unavailable) void drain(id)
  }

  return { activate, deactivate, availabilityChanged, syncError }
}
