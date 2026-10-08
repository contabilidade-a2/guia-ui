import { useEffect, useId, useRef, useState } from 'react'
import { normalize } from '../lib/text'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  /** Shown when nothing is chosen. */
  placeholder?: string
  /** When set, adds an entry at the top that clears the choice (for optional fields), e.g. "Nenhum". */
  clearLabel?: string
  disabled?: boolean
  required?: boolean
  /** Accessible name of the control. */
  label: string
}

/** Single choice from a long list: opens a menu where typing narrows the options (accents and case ignored). */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione…',
  clearLabel,
  disabled,
  required,
  label,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  function close() {
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const visibleOptions = query.trim()
    ? options.filter((option) => normalize(option.label).includes(normalize(query)))
    : options
  const selectedLabel = options.find((option) => option.value === value)?.label

  function choose(next: string) {
    onChange(next)
    close()
  }

  return (
    <div className="multi-select" ref={containerRef}>
      <button
        type="button"
        className="multi-select-button"
        aria-label={`${label}: ${selectedLabel ?? placeholder}`}
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="multi-select-summary">{selectedLabel ?? placeholder}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {/* A button can't be `required`; this hidden field makes the browser block an empty submit. */}
      {required && (
        <input className="visually-hidden" tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} />
      )}
      {open && (
        <div className="multi-select-menu" id={listId} role="listbox" aria-label={label}>
          <div className="multi-select-header">
            <input
              ref={searchRef}
              type="text"
              className="multi-select-search"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter picks the first match, so typing and pressing Enter is enough.
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (visibleOptions[0]) choose(visibleOptions[0].value)
                }
              }}
            />
          </div>
          {clearLabel && (
            <button type="button" role="option" aria-selected={value === ''} className="select-option" onClick={() => choose('')}>
              {clearLabel}
            </button>
          )}
          {visibleOptions.length === 0 && <span className="muted small">Nenhuma opção encontrada.</span>}
          {visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`select-option${option.value === value ? ' select-option-selected' : ''}`}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
