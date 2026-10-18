'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/apiClient'
import { codeKey } from '@/lib/queryKeys'
import { useAuth } from './AuthProvider'

type Feedback = { kind: 'pending' | 'success'; label: string }

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
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [closing, setClosing] = useState(false)
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
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const operation = useRef(0)
  const close = useCallback((restoreFocus = false) => {
    operation.current += 1
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(false)
    setCode('')
    setCopied(false)
    setError('')
    setBusy(false)
    setFeedback(null)
    setClosing(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )

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
    if (open && !user && !feedback) inputRef.current?.focus()
  }, [open, user, feedback])
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
  const authAction = async (
    action: () => Promise<void>,
    pendingLabel: string,
    successLabel: string,
  ) => {
    const currentOperation = ++operation.current
    setBusy(true)
    setError('')
    setFeedback({ kind: 'pending', label: pendingLabel })
    try {
      await action()
      if (operation.current !== currentOperation) return
      setFeedback({ kind: 'success', label: successLabel })
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      feedbackTimer.current = setTimeout(
        () => {
          if (operation.current !== currentOperation) return
          if (reducedMotion) close(true)
          else {
            setClosing(true)
            closeTimer.current = setTimeout(() => close(true), 180)
          }
        },
        reducedMotion ? 650 : 900,
      )
    } catch (cause) {
      if (operation.current !== currentOperation) return
      setFeedback(null)
      setError(cause instanceof Error ? cause.message : 'Request failed.')
    } finally {
      if (operation.current === currentOperation) setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void authAction(() => login(code), 'Signing in…', 'Signed in')
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
  const signingOut = feedback?.label === 'Signing out…' || feedback?.label === 'Signed out'
  const showAccountIcon = showSignedInIcon || signingOut
  const accountLabel = feedback
    ? feedback.label
    : showSignedInIcon
      ? loading
        ? 'Account, checking session'
        : 'Account, signed in'
      : 'Sign in'

  return (
    <div className="account-control" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`account-trigger${showAccountIcon ? ' is-signed-in' : ''}`}
        type="button"
        aria-label={
          syncError && user && !feedback
            ? `${accountLabel}, favorites waiting to sync`
            : accountLabel
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? 'account-popover' : undefined}
        title={showAccountIcon ? 'Account' : 'Sign in'}
        disabled={loading || busy}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {showAccountIcon ? <AccountIcon /> : <KeyIcon />}
        {syncError && user && <span className="account-sync-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div
          id="account-popover"
          className={`account-popover${closing ? ' is-closing' : ''}`}
          role="dialog"
          aria-label={feedback ? 'Account status' : user ? 'Account' : 'Sign in'}
        >
          {feedback ? (
            <div
              className={`account-feedback is-${feedback.kind}`}
              role="status"
              aria-live="polite"
            >
              <span className="account-feedback-icon" aria-hidden="true">
                {feedback.kind === 'success' ? <CheckIcon /> : <KeyIcon />}
              </span>
              <strong>{feedback.label}</strong>
            </div>
          ) : user ? (
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
                onClick={() => void authAction(logout, 'Signing out…', 'Signed out')}
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
                  void authAction(
                    async () => {
                      await register()
                    },
                    'Creating code…',
                    'Code created',
                  )
                }
              >
                <span>Create an access code</span>
                <ArrowIcon />
              </button>
            </>
          )}
          {user && !feedback && codeQuery.isError && (
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
