export type UserRole = 'FISCAL' | 'FINANCIAL' | 'ACCOUNTING' | 'ADMIN'
export type SendStatus = 'SENT' | 'CANCELED' | 'ARCHIVED'
export type SlipStatus = 'PENDING' | 'OVERDUE' | 'PAID'
export type HistoryEventType = 'CREATED' | 'OPENED' | 'RECEIPT_ADDED' | 'RECEIPT_REMOVED' | 'DELETED' | 'RESTORED'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  /** Ids of the companies whose slip e-mails this user receives. */
  notificationCompanyIds: number[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface UserInput {
  name: string
  email: string
  role: UserRole
  notificationCompanyIds: number[]
  active: boolean
  /** Empty keeps the current password when updating. */
  password?: string
}

export interface LoginResult {
  token: string
  expiresAt: string
  user: User
}

export interface Company {
  id: number
  name: string
  cnpj: string
  formattedCnpj: string
  tradeName: string | null
  label: string
  createdAt: string
  updatedAt: string
  /** Ids of the users notified about this company's slips. */
  notifiedUserIds: number[]
}

export interface CompanyInput {
  name: string
  cnpj: string
  tradeName: string | null
  notifiedUserIds: number[]
}

export interface CompanyRef {
  id: number
  name: string
  label: string
}

export interface SlipType {
  id: number
  name: string
  /** Slips of this type may be tied to an installment plan (parcelamento). */
  installment: boolean
}

export interface SlipTypeInput {
  name: string
  installment: boolean
}

export type InstallmentOrigin = 'SEFAZ' | 'ECAC' | 'PGFN'

/** Only ACTIVE plans can be picked for a new slip. */
export type InstallmentStatus = 'ACTIVE' | 'RESCINDED' | 'SETTLED'
export type BrazilianState =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA' | 'MT' | 'MS' | 'MG' | 'PA'
  | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' | 'RN' | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO'

export interface InstallmentPlan {
  id: number
  number: string
  origin: InstallmentOrigin
  /** Only SEFAZ plans have a state (UF). */
  state: BrazilianState | null
  /** `Parcelamento SEFAZ SP 123`, `Parcelamento PGFN 123` or `Parcelamento 123` (ECAC): the subject of its slips. */
  subject: string
  cigamNumber: string
  company: CompanyRef
  installmentCount: number
  status: InstallmentStatus
  createdAt: string
  updatedAt: string
}

export interface InstallmentPlanInput {
  number: string
  origin: InstallmentOrigin
  state: BrazilianState | null
  cigamNumber: string
  companyId: number
  installmentCount: number
  status: InstallmentStatus
}

export interface InstallmentPlanFilters {
  companyIds: string[] | null
  /** Part of the plan number; empty means any. */
  number: string
  /** Part of the Cigam number; empty means any. */
  cigamNumber: string
  /** `null` means "all" (no filter). */
  status: InstallmentStatus | null
  /** `null` means "all" (no filter). */
  origin: InstallmentOrigin | null
}

export interface SlipSummary {
  id: number
  subject: string
  slipType: SlipType
  company: CompanyRef
  amount: number
  sendStatus: SendStatus
  status: SlipStatus
  sentAt: string
  dueDate: string
}

export interface SlipDetail extends SlipSummary {
  note: string | null
  cigamNumber: string | null
  /** Origin of the slip's installment plan; null when it has none. */
  origin: InstallmentOrigin | null
  competenceDate: string
  sentBy: string
  /** Null when the server hides it from this user (canceled slip, Financial profile). */
  fileUrl: string | null
  receiptUrl: string | null
  paymentDate: string | null
  /** When set, the plan's company/subject/cigamNumber are the ones that count; see SlipFormPage. */
  installmentPlanId: number | null
  /** Which installment of the plan this slip pays; null without a plan. */
  installmentNumber: number | null
}

export interface SlipInput {
  subject: string
  note: string | null
  cigamNumber: string | null
  companyId: number | null
  slipTypeId: number | null
  amount: number | null
  competenceDate: string | null
  dueDate: string | null
  fileUrl: string
  sendStatus?: SendStatus
  installmentPlanId: number | null
  installmentNumber: number | null
}

/**
 * For the multi-value filters, `null` means "all" (no filter) and an array lists the values to keep.
 * An empty array therefore matches nothing.
 */
export interface SlipFilters {
  companyIds: string[] | null
  slipTypeIds: string[] | null
  origins: string[] | null
  statuses: string[] | null
  /** `yyyy-MM` */
  competenceFrom: string
  /** `yyyy-MM` */
  competenceTo: string
  dueFrom: string
  dueTo: string
  sentFrom: string
  sentTo: string
  /** Full or partial, with or without punctuation. */
  companyCnpj: string
}

export interface SlipDeleter {
  id: number
  name: string
}

/**
 * A slip as it was when deleted. `id` identifies this record and `slipId` is the id the slip had;
 * the company, the slip type and the user are copies and may no longer exist.
 */
export interface DeletedSlip extends SlipDetail {
  slipId: number
  fileUrl: string
  deletedAt: string
  deletedBy: SlipDeleter
}

export interface DeletedSlipFilters extends SlipFilters {
  deletedByUserIds: string[] | null
}

export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface HistoryEntry {
  eventType: HistoryEventType
  userName: string
  occurredAt: string
}

export interface CalendarDay {
  date: string
  total: number
  pending: number
  overdue: number
  paid: number
}

export interface CalendarSlip {
  id: number
  subject: string
  company: CompanyRef
  amount: number
  /** Null when the server hides it from this user (canceled slip, Financial profile). */
  fileUrl: string | null
  receiptUrl: string | null
  sendStatus: SendStatus
  status: SlipStatus
}

export interface SlipTypeGroup {
  slipType: SlipType
  slips: CalendarSlip[]
}
