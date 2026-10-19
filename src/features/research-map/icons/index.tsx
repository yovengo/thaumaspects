import Image from 'next/image'
import { aspectIconUrl } from '@/features/research-map/model/catalog'

export function AspectIcon({ aspect, muted = false }: { aspect: string; muted?: boolean }) {
  return (
    <Image
      className={`aspect-icon${aspect === 'constellation' ? ' is-astrum' : ''}`}
      src={aspectIconUrl(aspect, muted)}
      width={26}
      height={26}
      alt=""
    />
  )
}

export function WandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20 15.5 8.5" stroke="#4b3340" strokeWidth="3.2" />
      <path d="M4 20 15.5 8.5" stroke="#916b55" strokeWidth="1.3" />
      <path
        d="m17 1.7 1.25 3.55L21.8 6.5l-3.55 1.25L17 11.3l-1.25-3.55L12.2 6.5l3.55-1.25L17 1.7Z"
        fill="#fff1c7"
        stroke="#5d3f3b"
        strokeWidth=".8"
      />
      <path d="M9 2.2v2.4M7.8 3.4h2.4M21 12v1.8M20.1 12.9h1.8" stroke="#5d3f3b" strokeWidth="1.2" />
    </svg>
  )
}

export function BroomIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v11" stroke="#b58b62" strokeWidth="2.6" />
      <path d="M9 12h6v3H9z" fill="#9a774f" stroke="#e9d5a7" strokeWidth=".8" />
      <path
        d="m9 15-4 6.5c4.5 1.4 9.5 1.4 14 0L15 15H9Z"
        fill="#d5b77f"
        stroke="#e9d5a7"
        strokeWidth=".8"
      />
      <path d="m9 16-2 5M12 16v6M15 16l2 5" stroke="#886846" strokeWidth="1" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </svg>
  )
}

export function ArrowLeftIcon() {
  return <span aria-hidden="true">←</span>
}

export function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>
}

export function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      ↓
    </span>
  )
}

export function SwapIcon() {
  return <span aria-hidden="true">⇄</span>
}

export function ChevronDownIcon() {
  return <b aria-hidden="true">⌄</b>
}

export function SettingsIcon() {
  return (
    <span className="settings-icon" aria-hidden="true">
      ⚙
    </span>
  )
}

export function PlusIcon() {
  return <span aria-hidden="true">+</span>
}

export function MinusIcon() {
  return <span aria-hidden="true">−</span>
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      ×
    </span>
  )
}
