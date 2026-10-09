import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function ViewIcon() {
  return (
    <Icon>
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function EyeIcon() {
  return <ViewIcon />
}

export function EyeOffIcon() {
  return (
    <Icon>
      <path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5.5 19 1.5 12 1.5 12a19.8 19.8 0 0 1 5-5.9" />
      <path d="M9.9 4.2A10.4 10.4 0 0 1 12 5c6.5 0 10.5 7 10.5 7a19.9 19.9 0 0 1-2.2 3.2" />
      <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
      <path d="M1 1l22 22" />
    </Icon>
  )
}

export function EditIcon() {
  return (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Icon>
  )
}

export function DeleteIcon() {
  return (
    <Icon>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  )
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function ChevronLeftIcon() {
  return (
    <Icon>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  )
}

export function ChevronRightIcon() {
  return (
    <Icon>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  )
}

export function RestoreIcon() {
  return (
    <Icon>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Icon>
  )
}

/** The application mark shown next to its name. */
export function BrandIcon() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0e6b63" />
      <path d="M10 7h9l4 4v14H10z" fill="#fff" />
      <path d="M13 15h7M13 19h7M13 23h4" stroke="#0e6b63" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

interface IconLinkProps {
  to: string
  label: string
  children: ReactNode
}

/** Icon-only link; `label` is what screen readers and the tooltip say. */
export function IconLink({ to, label, children }: IconLinkProps) {
  return (
    <Link to={to} className="icon-action" title={label} aria-label={label}>
      {children}
    </Link>
  )
}

interface IconButtonProps {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  children: ReactNode
}

export function IconButton({ label, onClick, danger, disabled, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className={danger ? 'icon-action danger' : 'icon-action'}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
