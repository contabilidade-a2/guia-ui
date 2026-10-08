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
}

/**
 * Inline checkbox list with a search box, for picking a set of ids inside a form (e.g. which
 * companies a user is notified about). Unlike `MultiSelect`, it's not a popover and `selected`
 * is a plain array — there's no "everything, including future options" sentinel here.
 */
export function CheckboxList({ options, selected, onChange, emptyText }: CheckboxListProps) {
  const [query, setQuery] = useState('')

  const visibleOptions = query.trim()
    ? options.filter((option) => normalize(option.label).includes(normalize(query)))
    : options

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
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
