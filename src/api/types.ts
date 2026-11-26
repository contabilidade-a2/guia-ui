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
  /** Codes of the group's company mapping: digits as text (leading zeros kept), or null. */
  cigamCode: string | null
  dominioCode: string | null
}

export interface CompanyInput {
  name: string
  cnpj: string
  tradeName: string | null
  active: boolean
  notifiedUserIds: number[]
  cigamCode: string | null
  dominioCode: string | null
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

/** SN = Simples Nacional: no plan number, at most one per company. */
export type InstallmentOrigin = 'SEFAZ' | 'ECAC' | 'PGFN' | 'SN'

/** Only ACTIVE plans can be picked for a new slip. */
export type InstallmentStatus = 'ACTIVE' | 'RESCINDED' | 'SETTLED'
export type BrazilianState =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA' | 'MT' | 'MS' | 'MG' | 'PA'
  | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' | 'RN' | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO'

export interface InstallmentPlan {
  id: number
  /** Null for the Simples Nacional (SN) plan, which has no number. */
  number: string | null
  origin: InstallmentOrigin
  /** Only SEFAZ plans have a state (UF). */
  state: BrazilianState | null
  /** `Parcelamento SEFAZ SP 123`, `Parcelamento PGFN 123`, `Parcelamento 123` (ECAC) or `Parcelamento Simples Nacional`. */
  subject: string
  cigamNumber: string
  company: CompanyRef
  installmentCount: number
  status: InstallmentStatus
  createdAt: string
  updatedAt: string
}

export interface InstallmentPlanInput {
  number: string | null
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
  /** Part of the installment plan number; only the slip list has it (a deleted slip keeps no plan). */
  planNumber?: string
  /** Part of the subject, case and accents ignored; slip list only. */
  subject?: string
  /** Plain decimals (`1234.50`), inclusive; slip list only. */
  amountFrom?: string
  amountTo?: string
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
/** How close the system is to the free plans' limits (`GET /api/usage/limits`). */
export interface PlanLimits {
  email: { remainingToday: number | null; dailyLimit: number; unavailableReason: string | null }
  database: { sizeBytes: number | null; limitBytes: number; largestTables: { name: string; bytes: number }[]; unavailableReason: string | null }
  checkedAt: string
}

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

/** A column picked to order a list (the server sorts every page); `null` keeps the list's default order. */
export interface SortState<F extends string> {
  field: F
  ascending: boolean
}

/** Status, send status and subject are not sortable: their codes don't sort like their labels. */
export type SlipSortField = 'SLIP_TYPE' | 'SENT_AT' | 'DUE_DATE' | 'AMOUNT'

/** Origin, UF and status are not sortable, for the same reason. */
export type InstallmentPlanSortField = 'NUMBER' | 'COMPANY' | 'CIGAM_NUMBER' | 'INSTALLMENT_COUNT'

// ---------- Controle contábil (etapa 1: saldos dos portadores) ----------

export type HolderType = 'CHECKING' | 'INVESTMENT'
export type BalanceStatus = 'PENDING' | 'DIVERGENT' | 'OK' | 'NO_MOVEMENT'

/** Concluding a task while the previous phase is open: a warning to confirm, or refused. */
export type PhaseDependency = 'WARN' | 'BLOCK'

export interface ClosingAccess {
  allowed: boolean
  accountingAccess: boolean
  /** `yyyy-MM`: the first month the control covers. */
  firstCompetence: string
  phaseDependency: PhaseDependency
}

/** A CNPJ root of the register, and the closing company made from it, if any. */
export interface ClosingCompanyOption {
  cnpjRoot: string
  headOfficeName: string
  unitCount: number
  id: number | null
  name: string | null
  active: boolean
}

export interface ClosingCompany {
  id: number
  name: string
}

export interface BankHolder {
  id: number
  code: string
  description: string
  bank: string | null
  account: string | null
  type: HolderType
  active: boolean
  companyIds: number[]
}

export interface BankHolderInput {
  code: string
  description: string
  bank: string | null
  account: string | null
  type: HolderType
  active: boolean
  companyIds: number[]
}

export interface HolderBalance {
  holder: BankHolder
  imported: boolean
  noMovement: boolean
  statementBalance: number | null
  ledgerBalance: number | null
  difference: number | null
  status: BalanceStatus
  note: string | null
  updatedBy: string | null
  updatedAt: string | null
}

export interface HolderBalanceInput {
  holderId: number
  companyId: number
  competence: string
  imported: boolean
  noMovement: boolean
  statementBalance: number | null
  ledgerBalance: number | null
  note: string | null
}

export interface ImportReport {
  linesRead: number
  balancesSaved: number
  holdersCreated: string[]
  ignored: { line: number; message: string }[]
}

// ---------- Controle contábil (etapa 2: tarefas do mês) ----------

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'NOT_APPLICABLE'
export type TaskKind = 'MANUAL' | 'CALCULATED'

export interface BalanceSummary {
  total: number
  ok: number
  divergent: number
  pending: number
  noMovement: number
  allChecked: boolean
}

export interface ClosingTask {
  templateId: number
  code: string
  phase: number
  name: string
  description: string | null
  kind: TaskKind
  applicable: boolean
  status: TaskStatus
  /** Concluded by itself: every holder OK (the calculated task only). */
  automatic: boolean
  note: string | null
  doneBy: string | null
  doneAt: string | null
  updatedBy: string | null
  updatedAt: string | null
  balances: BalanceSummary | null
}

export interface TaskHistoryItem {
  fromStatus: TaskStatus
  toStatus: TaskStatus
  note: string | null
  userName: string
  at: string
  automatic: boolean
}

export interface TaskTemplate {
  id: number
  code: string
  phase: number
  name: string
  kind: TaskKind
  appliesToAll: boolean
  companyIds: number[]
}

export interface MonthProgress {
  /** `yyyy-MM` */
  competence: string
  done: number
  total: number
  started: boolean
  closed: boolean
}

/** Who used the system in a day; hours are 0–23 in Brazil. */
export interface DayUser {
  name: string
  calls: number
  firstHour: number
  lastHour: number
}

export interface DayDetail {
  /** `yyyy-MM-dd` */
  date: string
  calls: number
  startups: number
  users: DayUser[]
}
