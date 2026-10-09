import { useState } from 'react'
import { normalize } from '../lib/text'

export interface CheckboxListOption {
  value: string
  label: string
}

interface CheckboxListProps {
  options: CheckboxListOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  emptyText: string
  /** Labels of the two bulk links; the defaults are masculine ("todos"). */
  selectAllText?: string
  clearAllText?: string
}

/**
 * Inline checkbox list with a search box, for picking a set of ids inside a form (e.g. which
 * companies a user is notified about). Unlike `MultiSelect`, it's not a popover and `selected`
 * is a plain array — there's no "everything, including future options" sentinel here.
 */
export function CheckboxList({
  options,
  selected,
  onChange,
  emptyText,
  selectAllText = 'Marcar todos',
  clearAllText = 'Desmarcar todos',
}: CheckboxListProps) {
  const [query, setQuery] = useState('')

  const visibleOptions = query.trim()
    ? options.filter((option) => normalize(option.label).includes(normalize(query)))
    : options

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  // The bulk links act on what is listed, so a search narrows them ("Marcar todas" on the filtered ones).
  function selectVisible() {
    onChange([...new Set([...selected, ...visibleOptions.map((option) => option.value)])])
  }

  function clearVisible() {
    const hidden = new Set(visibleOptions.map((option) => option.value))
    onChange(selected.filter((item) => !hidden.has(item)))
  }

  if (options.length === 0) return <span className="muted small">{emptyText}</span>

  return (
    <div className="checkbox-list">
      <input
        type="text"
        className="multi-select-search"
        placeholder="Buscar..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="checkbox-list-bulk">
        <button type="button" className="link-button" onClick={selectVisible} disabled={visibleOptions.length === 0}>
          {selectAllText}
        </button>
        <button type="button" className="link-button" onClick={clearVisible} disabled={visibleOptions.length === 0}>
          {clearAllText}
        </button>
        <span className="muted small">{selected.length} de {options.length} marcados</span>
      </div>
      <div className="checkbox-list-options">
        {visibleOptions.length === 0 && <span className="muted small">Nenhuma opção encontrada.</span>}
        {visibleOptions.map((option) => (
          <label key={option.value} className="checkbox multi-select-option">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  )
}
