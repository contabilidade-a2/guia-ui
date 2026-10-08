import { useState } from 'react'
import type { ChangeEvent } from 'react'

interface MonthInputProps {
  /** `yyyy-MM`, or empty while nothing valid has been typed. */
  value: string
  onChange: (value: string) => void
  required?: boolean
  /** Accessible name, for when there's no visible label of its own. */
  label?: string
}

const COMPLETE = /^(\d{2})\/(\d{4})$/

/** `2026-09` → `09/2026` */
function toText(value: string): string {
  return value ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : ''
}

/** `09/2026` → `2026-09`; empty when incomplete or not a real month. */
function toValue(text: string): string {
  const match = COMPLETE.exec(text)
  if (!match) return ''
  const month = Number(match[1])
  const year = Number(match[2])
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return ''
  return `${match[2]}-${match[1]}`
}

/** Typed month and year (`MM/AAAA`); the slash is added automatically. */
export function MonthInput({ value, onChange, required, label }: MonthInputProps) {
  const [text, setText] = useState(() => toText(value))
  const [lastValue, setLastValue] = useState(value)

  // When the value changes from outside (e.g. "Limpar filtros"), show it.
  if (value !== lastValue) {
    setLastValue(value)
    if (value !== toValue(text)) setText(toText(value))
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 6)
    const masked = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
    const parsed = toValue(masked)
    setText(masked)
    setLastValue(parsed)
    onChange(parsed)
    event.target.setCustomValidity(
      masked.length === 7 && !parsed ? 'Informe um mês válido, de 01 a 12, e o ano com 4 dígitos.' : '',
    )
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="MM/AAAA"
      value={text}
      onChange={handleChange}
      maxLength={7}
      pattern="(0[1-9]|1[0-2])/\d{4}"
      title="Mês e ano, no formato MM/AAAA"
      required={required}
      aria-label={label}
    />
  )
}
