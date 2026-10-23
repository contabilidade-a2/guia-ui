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
  /** An inactive company keeps its slips and plans, but isn't offered for new ones. */
  active: boolean
  label: string
  createdAt: string
  updatedAt: string
  /** Ids of the users notified about this company's slips. */
  notifiedUserIds: number[]
  accounting: AccountingSettings
}

/** What the accounting import needs about a company; only the administrator changes it. */
export interface AccountingSettings {
  /** How the company is named in the Depara/Fornecedores spreadsheets' columns. */
  shortName: string | null
  /** Domínio "Código Matriz/Filial". */
  matrixBranchCode: string | null
  /** Account debited when this company pays for another one of the group. */
  intercompanyAccount: string | null
  /** "Unidade Negocio" codes of the export, without leading zeros, in numeric order. */
  businessUnits: string[]
}

export interface CompanyInput {
  name: string
  cnpj: string
  tradeName: string | null
  active: boolean
  notifiedUserIds: number[]
  /** Only sent by the administrator; absent keeps what the company has. */
  accounting?: AccountingSettings
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

/** Usage metrics of one month, kept to decide about the hosting. Durations in milliseconds; null without data. */
export interface UsageSummary {
  /** `yyyy-MM` */
  month: string
  daysWithUse: number
  totalCalls: number
  distinctUsers: number
  startups: number
  averageStartupMillis: number | null
  maxStartupMillis: number | null
  waits: number
  averageWaitMillis: number | null
  maxWaitMillis: number | null
  /** Waits of 10 seconds or more. */
  longWaits: number
  averageLongWaitMillis: number | null
  /** Busiest first. `hour` is 0 to 23, in Brazil; `days` is in how many days that hour had calls. */
  peakHours: { hour: number; calls: number; days: number }[]
  days: { date: string; calls: number; users: number; startups: number }[]
}

export type AuditAction =
  | 'COMPANY_ACCOUNTING_UPDATED'
  | 'CHART_ACCOUNT_CREATED'
  | 'CHART_ACCOUNT_UPDATED'
  | 'CHART_ACCOUNT_DELETED'
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_DELETED'
  | 'REGISTRY_IMPORTED'
  | 'CONFLICT_REVIEWED'
  | 'IMPORT_ANALYZED'
  | 'IMPORT_GENERATED'

/** Something done in the accounting module. */
export interface AuditEntry {
  occurredAt: string
  userName: string
  action: AuditAction
  entity: string
  entityId: string | null
  details: string | null
}

/** A company's mapping of a source account; a company left out of the list is pending. */
export interface ChartAccountMapping {
  companyId: number
  domainCode: string | null
  /** The "0" of the spreadsheet: deliberately left out for that company. */
  ignored: boolean
}

/** A line of the Depara (chart of accounts). */
export interface ChartAccount {
  id: number
  sourceCode: string
  ledgerAccount: string | null
  description: string
  level: number | null
  accountType: string | null
  resultType: string | null
  mappings: ChartAccountMapping[]
  updatedAt: string
}

export interface ChartAccountInput {
  sourceCode: string
  ledgerAccount: string | null
  description: string
  accountType: string | null
  resultType: string | null
  mappings: ChartAccountMapping[]
}

export interface SupplierAccount {
  companyId: number
  domainAccount: string
}

/** A line of the Fornecedores registry. Several suppliers may share a company code. */
export interface Supplier {
  id: number
  companyCode: string
  name: string
  /** CPF or CNPJ digits. */
  document: string | null
  accounts: SupplierAccount[]
  updatedAt: string
}

export interface SupplierInput {
  companyCode: string
  name: string
  document: string | null
  accounts: SupplierAccount[]
}

/** What a bulk load of a registry did. */
export interface RegistryImportSummary {
  rows: number
  created: number
  filled: number
  unchanged: number
  conflicts: number
  skipped: number
}

export type RegistryBase = 'CHART_ACCOUNT' | 'SUPPLIER'

/** A value a load did not write because the record already had a different one. */
export interface RegistryConflict {
  id: number
  base: RegistryBase
  recordKey: string
  companyName: string | null
  currentValue: string | null
  suggestedValue: string | null
  source: string
  createdAt: string
  userName: string | null
  reviewed: boolean
}

