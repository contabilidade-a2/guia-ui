import { useEffect, useRef, useState } from 'react'
import type { SlipFilters } from '../api/types'
import { firstDayOfMonth, formatDate, lastDayOfMonth, todayIso } from '../lib/format'
import { MonthInput } from './MonthInput'

type DateKind = 'competence' | 'due' | 'sent'
type DateFilterName = 'competenceFrom' | 'competenceTo' | 'dueFrom' | 'dueTo' | 'sentFrom' | 'sentTo'
type DateFilters = Pick<SlipFilters, DateFilterName>

const DATE_KINDS: Record<DateKind, { label: string; from: DateFilterName; to: DateFilterName; month: boolean }> = {
  competence: { label: 'Competência', from: 'competenceFrom', to: 'competenceTo', month: true },
  due: { label: 'Vencimento', from: 'dueFrom', to: 'dueTo', month: false },
  sent: { label: 'Enviada em', from: 'sentFrom', to: 'sentTo', month: false },
}

/** `2026-01` → `2025-12` */
function previousMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, '0')}`
}

function shortcuts(month: boolean): { label: string; from: string; to: string }[] {
  const today = todayIso()
  const thisMonth = today.slice(0, 7)
  const lastMonth = previousMonth(thisMonth)
  if (month) {
    return [
      { label: 'Este mês', from: thisMonth, to: thisMonth },
      { label: 'Mês passado', from: lastMonth, to: lastMonth },
      { label: 'Este ano', from: `${today.slice(0, 4)}-01`, to: `${today.slice(0, 4)}-12` },
    ]
  }
  return [
    { label: 'Hoje', from: today, to: today },
    { label: 'Este mês', from: firstDayOfMonth(thisMonth), to: lastDayOfMonth(thisMonth) },
    { label: 'Mês passado', from: firstDayOfMonth(lastMonth), to: lastDayOfMonth(lastMonth) },
  ]
}

/** Text of the chosen range (`01/10/2026 – 31/10/2026`), or empty when neither end is set. */
function rangeSummary(kind: DateKind, filters: DateFilters): string {
  const { from, to, month } = DATE_KINDS[kind]
  const format = (value: string) => (month ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : formatDate(value))
  const start = filters[from]
  const end = filters[to]
  if (start && end) return start === end ? format(start) : `${format(start)} – ${format(end)}`
  if (start) return `a partir de ${format(start)}`
  if (end) return `até ${format(end)}`
  return ''
}

interface DateRangeChipsProps {
  filters: DateFilters
  onChange: (patch: Partial<DateFilters>) => void
}

function DateChip({ kind, filters, onChange }: DateRangeChipsProps & { kind: DateKind }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { label, from, to, month } = DATE_KINDS[kind]
  const summary = rangeSummary(kind, filters)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const input = (name: DateFilterName, end: string) =>
    month ? (
      <MonthInput label={`${label}: ${end}`} value={filters[name]} onChange={(value) => onChange({ [name]: value })} />
    ) : (
      <input
        type="date"
        aria-label={`${label}: ${end}`}
        value={filters[name]}
        onChange={(e) => onChange({ [name]: e.target.value })}
      />
    )

  return (
    <div className="filter-chip-wrapper" ref={containerRef}>
      <span className={summary ? 'filter-chip filter-chip-on' : 'filter-chip'}>
        <button type="button" className="filter-chip-main" aria-expanded={open} onClick={() => setOpen(!open)}>
          {summary ? `${label}: ${summary}` : `+ ${label}`}
        </button>
        {summary && (
          <button
            type="button"
            className="filter-chip-remove"
            aria-label={`Remover filtro de ${label.toLowerCase()}`}
            onClick={() => {
              onChange({ [from]: '', [to]: '' })
              setOpen(false)
            }}
          >
            ×
          </button>
        )}
      </span>
      {open && (
        <div className="period-menu" role="group" aria-label={label}>
          <div className="period-shortcuts">
            {shortcuts(month).map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                className="period-shortcut"
                onClick={() => onChange({ [from]: shortcut.from, [to]: shortcut.to })}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
          {/* start and end inside one box, instead of two labelled fields */}
          <div className="range-input">
            {input(from, 'início')}
            <span className="range-input-separator" aria-hidden="true">
              –
            </span>
            {input(to, 'fim')}
          </div>
        </div>
      )}
    </div>
  )
}

/** The three date filters as chips: each only shows its period once set; clicking one opens the period. */
export function DateRangeChips({ filters, onChange }: DateRangeChipsProps) {
  return (
    <>
      <span className="muted small">Datas:</span>
      {(Object.keys(DATE_KINDS) as DateKind[]).map((kind) => (
        <DateChip key={kind} kind={kind} filters={filters} onChange={onChange} />
      ))}
    </>
  )
}
