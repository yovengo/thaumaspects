'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { codeKey } from '@/lib/queryKeys'
import { useAuth } from './AuthProvider'

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="9" r="4" />
      <path d="m11 12 9 9m-3-3 2-2m-5-1 2-2" />
    </svg>
  )
}
function AccountIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.7 19a6.3 6.3 0 0 1 11.6-3.4M16.4 18.2l2 2 3.3-4" />
    </svg>
  )
}
function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 12 5 5L20 6" />
    </svg>
  )
}

function formatCodeInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export default function AuthControl() {
  const { user, loading, showSignedInIcon, syncError, login, register, logout } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const codeQuery = useQuery({
    queryKey: codeKey(user?.id ?? ''),
    queryFn: () => api<{ code: string | null }>('/api/auth/code'),
    enabled: open && Boolean(user),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnReconnect: false,
  })
  const accessCode = codeQuery.data?.code
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    setCode('')
    setCopied(false)
    setError('')
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open, close])
  useEffect(() => {
    if (open && !user) inputRef.current?.focus()
  }, [open, user])
  const act = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void act(async () => {
      await login(code)
      close(true)
    })
  }
  const confirm = (event: FormEvent) => {
    event.preventDefault()
    void act(async () => {
      const result = await api<{ code: string }>('/api/auth/code', 'POST', { code })
      if (user) queryClient.setQueryData(codeKey(user.id), result)
      setCode('')
    })
  }
  const copy = () => {
    if (!accessCode) return
    void navigator.clipboard
      .writeText(accessCode)
      .then(() => setCopied(true))
      .catch(() => setError('Copy failed. Select the code to copy it.'))
  }
  const accountLabel = showSignedInIcon
    ? loading
      ? 'Account, checking session'
      : 'Account, signed in'
    : 'Sign in'

  return (
    <div className="account-control" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`account-trigger${showSignedInIcon ? ' is-signed-in' : ''}`}
        type="button"
        aria-label={syncError && user ? `${accountLabel}, favorites waiting to sync` : accountLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? 'account-popover' : undefined}
        title={showSignedInIcon ? 'Account' : 'Sign in'}
        disabled={loading}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {showSignedInIcon ? <AccountIcon /> : <KeyIcon />}
        {syncError && user && <span className="account-sync-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div
          id="account-popover"
          className="account-popover"
          role="dialog"
          aria-label={user ? 'Account' : 'Sign in'}
        >
          {user ? (
            <>
              {codeQuery.isPending ? (
                <div className="account-code-row is-loading" role="status">
                  Loading code…
                </div>
              ) : accessCode ? (
                <div className="account-code-row">
                  <code>{accessCode}</code>
                  <button
                    type="button"
                    onClick={copy}
                    aria-label={copied ? 'Code copied' : 'Copy access code'}
                    title={copied ? 'Copied' : 'Copy code'}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              ) : !codeQuery.isError ? (
                <>
                  <form className="account-signin" onSubmit={confirm}>
                    <input
                      ref={inputRef}
                      aria-label="Confirm your access code"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Confirm your code"
                      maxLength={11}
                      value={code}
                      onChange={(event) => setCode(formatCodeInput(event.target.value))}
                    />
                    <button
                      type="submit"
                      aria-label="Confirm code"
                      title="Confirm code"
                      disabled={busy || code.length < 10}
                    >
                      <ArrowIcon />
                    </button>
                  </form>
                  <small>Confirm your existing code once to show it here.</small>
                </>
              ) : (
                <div className="account-code-row is-loading">Code unavailable</div>
              )}
              {syncError && <small role="status">Favorites are waiting to sync.</small>}
              <button
                className="account-signout"
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await logout()
                    close(true)
                  })
                }
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <strong>Access code</strong>
              <form className="account-signin" onSubmit={submit}>
                <input
                  ref={inputRef}
                  aria-label="Access code"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12345-67890"
                  maxLength={11}
                  value={code}
                  onChange={(event) => setCode(formatCodeInput(event.target.value))}
                />
                <button
                  type="submit"
                  aria-label="Sign in"
                  title="Sign in"
                  disabled={busy || code.length < 10}
                >
                  <ArrowIcon />
                </button>
              </form>
              <button
                className="account-create"
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await register()
                  })
                }
              >
                <span>Create an access code</span>
                <ArrowIcon />
              </button>
            </>
          )}
          {user && codeQuery.isError && (
            <p className="account-error" role="alert">
              {codeQuery.error.message}
            </p>
          )}
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
