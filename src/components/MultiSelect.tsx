import { useEffect, useId, useRef, useState } from 'react'
import { normalize } from '../lib/text'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  label: string
  options: MultiSelectOption[]
  /** `null` means everything is selected, including options created later. */
  selected: string[] | null
  onChange: (selected: string[] | null) => void
  /** Shown when everything is selected, e.g. "Todas". */
  allText: string
  /** Shown when nothing is selected, e.g. "Nenhuma". */
  noneText: string
  /** Shown when some are selected, e.g. (3) => "3 empresas". */
  countText: (count: number) => string
}

/** Dropdown with checkboxes. Starts with everything checked; the user unchecks what to leave out. */
export function MultiSelect({ label, options, selected, onChange, allText, noneText, countText }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Clears the search so a leftover filter doesn't hide options the next time this opens.
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

  const allValues = options.map((option) => option.value)
  const isChecked = (value: string) => selected === null || selected.includes(value)

  function toggle(value: string) {
    const current = selected ?? allValues
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    // Checking the last missing option goes back to "everything", so later additions are included too.
    onChange(allValues.every((item) => next.includes(item)) ? null : next)
  }

  const summary =
    selected === null
      ? allText
      : selected.length === 0
        ? noneText
        : selected.length === 1
          ? (options.find((option) => option.value === selected[0])?.label ?? countText(1))
          : countText(selected.length)

  return (
    <div className="multi-select" ref={containerRef}>
      <button
        type="button"
        className="multi-select-button"
        aria-label={`${label}: ${summary}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="multi-select-summary">{summary}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="multi-select-menu" id={listId} role="group" aria-label={label}>
          {options.length === 0 && <span className="muted small">Nenhuma opção cadastrada.</span>}
          {options.length > 0 && (
            <div className="multi-select-header">
              <input
                ref={searchRef}
                type="text"
                className="multi-select-search"
                placeholder="Buscar..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="multi-select-actions">
                {selected !== null && (
                  <button type="button" className="link-button small" onClick={() => onChange(null)}>
                    Marcar tudo
                  </button>
                )}
                {(selected === null || selected.length > 0) && (
                  <button type="button" className="link-button small" onClick={() => onChange([])}>
                    Desmarcar tudo
                  </button>
                )}
              </div>
            </div>
          )}
          {options.length > 0 && visibleOptions.length === 0 && (
            <span className="muted small">Nenhuma opção encontrada.</span>
          )}
          {visibleOptions.map((option) => (
            <label key={option.value} className="checkbox multi-select-option">
              <input type="checkbox" checked={isChecked(option.value)} onChange={() => toggle(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
