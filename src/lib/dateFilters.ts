import type { SlipFilters } from '../api/types'
import { formatDate } from './format'

export type DateKind = 'competence' | 'due' | 'sent'
export type DateFilterName = 'competenceFrom' | 'competenceTo' | 'dueFrom' | 'dueTo' | 'sentFrom' | 'sentTo'
export type DateFilters = Pick<SlipFilters, DateFilterName>

export const DATE_KINDS: Record<DateKind, { label: string; from: DateFilterName; to: DateFilterName; month: boolean }> = {
  competence: { label: 'Competência', from: 'competenceFrom', to: 'competenceTo', month: true },
  due: { label: 'Vencimento', from: 'dueFrom', to: 'dueTo', month: false },
  sent: { label: 'Enviada em', from: 'sentFrom', to: 'sentTo', month: false },
}

/** Text of the chosen range (`01/10/2026 – 31/10/2026`), or empty when neither end is set. */
export function rangeSummary(kind: DateKind, filters: DateFilters): string {
  const { from, to, month } = DATE_KINDS[kind]
  const format = (value: string) => (month ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : formatDate(value))
  const start = filters[from]
  const end = filters[to]
  if (start && end) return start === end ? format(start) : `${format(start)} – ${format(end)}`
  if (start) return `a partir de ${format(start)}`
  if (end) return `até ${format(end)}`
  return ''
}
