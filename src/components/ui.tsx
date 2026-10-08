import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { SendStatus, SlipStatus } from '../api/types'
import { SEND_STATUS_LABELS, SLIP_STATUS_LABELS } from '../lib/format'

export function SlipStatusBadge({ status }: { status: SlipStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{SLIP_STATUS_LABELS[status]}</span>
}

export function SendStatusBadge({ status }: { status: SendStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{SEND_STATUS_LABELS[status]}</span>
}

export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div className="banner banner-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="button button-small" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function Loading() {
  return <p className="muted">Carregando…</p>
}

interface FieldProps {
  label: string
  /** For controls that hold several inputs (a nested <label> is invalid HTML). */
  group?: boolean
  className?: string
  error?: string
  hint?: string
  children: ReactNode
}

export function Field({ label, group, className, error, hint, children }: FieldProps) {
  const content = (
    <>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </>
  )
  const classes = className ? `field ${className}` : 'field'
  return group ? <div className={classes}>{content}</div> : <label className={classes}>{content}</label>
}

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
