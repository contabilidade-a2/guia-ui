import type { BrazilianState, HistoryEventType, InstallmentOrigin, SendStatus, SlipStatus, UserRole } from '../api/types'

const TIME_ZONE = 'America/Sao_Paulo'

/** `2026-10-05` → `05/10/2026`, without going through Date (no time zone shift). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

/** `2026-09-01` → `09/2026`. */
export function formatMonth(isoDate: string): string {
  const [year, month] = isoDate.split('-')
  return `${month}/${year}`
}

/** `2026-09` → first (`2026-09-01`) or last (`2026-09-30`) day of that month. */
export function firstDayOfMonth(month: string): string {
  return `${month}-01`
}

export function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return toIsoDate(year, monthNumber, new Date(year, monthNumber, 0).getDate())
}

export function formatDateTime(isoInstant: string): string {
  return new Date(isoInstant).toLocaleString('pt-BR', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' })
}

export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Today in Brazil as `yyyy-MM-dd`, whatever the browser's time zone. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Shared by the list and the details screen. */
export const DELETE_SLIP_CONFIRMATION = 'Você tem certeza que deseja excluir?'

export const ROLE_LABELS: Record<UserRole, string> = {
  FISCAL: 'Fiscal',
  FINANCIAL: 'Financeiro',
  ACCOUNTING: 'Contábil',
  ADMIN: 'Administrador',
}

export const ORIGIN_LABELS: Record<InstallmentOrigin, string> = {
  SEFAZ: 'SEFAZ',
  ECAC: 'ECAC',
  PGFN: 'PGFN',
}

export const STATE_LABELS: Record<BrazilianState, string> = {
  AC: 'AC – Acre',
  AL: 'AL – Alagoas',
  AP: 'AP – Amapá',
  AM: 'AM – Amazonas',
  BA: 'BA – Bahia',
  CE: 'CE – Ceará',
  DF: 'DF – Distrito Federal',
  ES: 'ES – Espírito Santo',
  GO: 'GO – Goiás',
  MA: 'MA – Maranhão',
  MT: 'MT – Mato Grosso',
  MS: 'MS – Mato Grosso do Sul',
  MG: 'MG – Minas Gerais',
  PA: 'PA – Pará',
  PB: 'PB – Paraíba',
  PR: 'PR – Paraná',
  PE: 'PE – Pernambuco',
  PI: 'PI – Piauí',
  RJ: 'RJ – Rio de Janeiro',
  RN: 'RN – Rio Grande do Norte',
  RS: 'RS – Rio Grande do Sul',
  RO: 'RO – Rondônia',
  RR: 'RR – Roraima',
  SC: 'SC – Santa Catarina',
  SP: 'SP – São Paulo',
  SE: 'SE – Sergipe',
  TO: 'TO – Tocantins',
}

export const SLIP_STATUS_LABELS: Record<SlipStatus, string> = {
  PENDING: 'Pendente',
  OVERDUE: 'Vencida',
  PAID: 'Paga',
}

export const SEND_STATUS_LABELS: Record<SendStatus, string> = {
  SENT: 'Enviado',
  CANCELED: 'Cancelado',
  ARCHIVED: 'Arquivado',
}

export const HISTORY_EVENT_LABELS: Record<HistoryEventType, string> = {
  CREATED: 'Guia cadastrada',
  OPENED: 'Guia aberta',
  RECEIPT_ADDED: 'Comprovante adicionado',
  RECEIPT_REMOVED: 'Comprovante removido',
  DELETED: 'Guia excluída',
  RESTORED: 'Guia restaurada',
}
