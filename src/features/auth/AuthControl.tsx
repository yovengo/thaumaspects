'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccountIcon,
  ArrowIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  KeyIcon,
} from '@/features/auth/icons'
import { codeKey } from '@/features/auth/queryKeys'
import {
  forgetRecentAccessCode,
  type RecentAccessCode,
  readRecentAccessCodes,
  rememberRecentAccessCode,
} from '@/features/auth/recentAccessCodes'
import { api } from '@/lib/apiClient'
import { useAuth } from './AuthProvider'

type Feedback = { kind: 'pending' | 'success'; label: string }

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
  const [iconOverride, setIconOverride] = useState<boolean | null>(null)
  const [recentCodes, setRecentCodes] = useState<RecentAccessCode[]>([])
  const showAccountIcon = iconOverride ?? showSignedInIcon
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
    setIconOverride(null)
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
  useEffect(() => {
    if (!user) setRecentCodes(readRecentAccessCodes())
  }, [user])
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
    signedInAfterSuccess: boolean,
  ) => {
    const currentOperation = ++operation.current
    setBusy(true)
    setError('')
    setIconOverride(showAccountIcon)
    setFeedback({ kind: 'pending', label: pendingLabel })
    try {
      await action()
      if (operation.current !== currentOperation) return
      setIconOverride(signedInAfterSuccess)
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
      setIconOverride(null)
      setFeedback(null)
      setError(cause instanceof Error ? cause.message : 'Request failed.')
    } finally {
      if (operation.current === currentOperation) setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void authAction(() => login(code), 'Signing in…', 'Signed in', true)
  }
  const confirm = (event: FormEvent) => {
    event.preventDefault()
    void act(async () => {
      const result = await api<{ code: string }>('/api/auth/code', 'POST', { code })
      if (user) {
        queryClient.setQueryData(codeKey(user.id), result)
        rememberRecentAccessCode(user.id, result.code)
      }
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
  const accountLabel = feedback
    ? feedback.label
    : showAccountIcon
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
        onClick={() => {
          if (open) close()
          else {
            setRecentCodes(readRecentAccessCodes())
            setOpen(true)
          }
        }}
      >
        <span className="account-trigger-symbol" key={showAccountIcon ? 'account' : 'key'}>
          {showAccountIcon ? <AccountIcon /> : <KeyIcon />}
        </span>
        {syncError && user && feedback?.kind !== 'pending' && (
          <span className="account-sync-dot" aria-hidden="true" />
        )}
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
                onClick={() => void authAction(logout, 'Signing out…', 'Signed out', false)}
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
              {recentCodes.length > 0 && (
                <div className="account-recent">
                  <div className="account-recent-heading">
                    <span>Recent codes</span>
                    <span>On this device</span>
                  </div>
                  <ul className="account-recent-list">
                    {recentCodes.map((saved) => (
                      <li className="account-recent-item" key={saved.userId}>
                        <button
                          className="account-recent-choice"
                          type="button"
                          aria-label={`Sign in with saved code ${saved.code}`}
                          disabled={busy}
                          onClick={() => {
                            setCode(saved.code)
                            void authAction(
                              () => login(saved.code),
                              'Signing in…',
                              'Signed in',
                              true,
                            )
                          }}
                        >
                          <KeyIcon />
                          <span>{saved.code}</span>
                          <ArrowIcon />
                        </button>
                        <button
                          className="account-recent-remove"
                          type="button"
                          aria-label={`Forget saved code ${saved.code}`}
                          title="Forget code"
                          onClick={() => setRecentCodes(forgetRecentAccessCode(saved.code))}
                        >
                          <CloseIcon />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                    true,
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
