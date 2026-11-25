import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

interface SignedMoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'onBlur'> {
  value: number | null
  /** Called when the field is left with a different value (null = emptied). */
  onCommit: (value: number | null) => void
}

const format = (value: number | null) =>
  value === null ? '' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** `1.234,56`, `-0,02`, `1234.56` → number; empty → null; anything else → undefined. */
function parse(text: string): number | null | undefined {
  const clean = text.replace(/\s|R\$/g, '')
  if (clean === '') return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined
  return Math.round(Number(normalized) * 100) / 100
}

/**
 * A money field that accepts negative values (balances can be overdrawn), typed freely in the Brazilian format and
 * tidied up when the field is left. `CurrencyInput` fills from the right and has no sign, so it doesn't fit here.
 */
export function SignedMoneyInput({ value, onCommit, className, ...rest }: SignedMoneyInputProps) {
  const [text, setText] = useState(() => format(value))
  const [lastValue, setLastValue] = useState(value)
  const [invalid, setInvalid] = useState(false)

  if (value !== lastValue) {
    setLastValue(value)
    setText(format(value))
    setInvalid(false)
  }

  function commit() {
    const parsed = parse(text)
    if (parsed === undefined) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setText(format(parsed))
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={[className, 'money-input', invalid ? 'input-invalid' : '', value !== null && value < 0 ? 'negative' : '']
        .filter(Boolean)
        .join(' ')}
      value={text}
      placeholder="0,00"
      title={invalid ? 'Valor inválido: use o formato 1.234,56 (com - na frente se for negativo).' : undefined}
      onChange={(event) => setText(event.target.value.replace(/[^\d,.\-\s]/g, ''))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}
