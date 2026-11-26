import { firstDayOfMonth, lastDayOfMonth } from '../lib/format'
import { request } from './client'
import type {
  BankHolder,
  MonthProgress,
  ClosingTask,
  PhaseDependency,
  TaskHistoryItem,
  TaskStatus,
  TaskTemplate,
  BankHolderInput,
  CalendarDay,
  ClosingAccess,
  ClosingCompany,
  ClosingCompanyOption,
  HolderBalance,
  HolderBalanceInput,
  ImportReport,
  Company,
  CompanyInput,
  DeletedSlip,
  DeletedSlipFilters,
  HistoryEntry,
  InstallmentPlan,
  InstallmentPlanFilters,
  InstallmentPlanSortField,
  InstallmentPlanInput,
  LoginResult,
  Page,
  SlipDeleter,
  SlipDetail,
  SlipFilters,
  SlipInput,
  SlipSortField,
  SortState,
  SlipSummary,
  SlipType,
  SlipTypeInput,
  SlipTypeGroup,
  PlanLimits, UsageSummary,
  User,
  UserInput,
} from './types'

export const authApi = {
  login: (email: string, password: string) => request<LoginResult>('POST', '/api/auth/login', { email, password }),
  me: () => request<User>('GET', '/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('PUT', '/api/auth/password', { currentPassword, newPassword }),
}

export const usersApi = {
  list: () => request<User[]>('GET', '/api/users'),
  create: (input: UserInput) => request<User>('POST', '/api/users', input),
  update: (id: number, input: UserInput) => request<User>('PUT', `/api/users/${id}`, input),
  remove: (id: number) => request<void>('DELETE', `/api/users/${id}`),
}

export const companiesApi = {
  list: () => request<Company[]>('GET', '/api/companies'),
  create: (input: CompanyInput) => request<Company>('POST', '/api/companies', input),
  update: (id: number, input: CompanyInput) =>
    request<Company>('PUT', `/api/companies/${id}`, input),
  remove: (id: number) => request<void>('DELETE', `/api/companies/${id}`),
}

export const slipTypesApi = {
  list: () => request<SlipType[]>('GET', '/api/slip-types'),
  create: (input: SlipTypeInput) => request<SlipType>('POST', '/api/slip-types', input),
  update: (id: number, input: SlipTypeInput) => request<SlipType>('PUT', `/api/slip-types/${id}`, input),
  remove: (id: number) => request<void>('DELETE', `/api/slip-types/${id}`),
}

export const installmentPlansApi = {
  search: (filters: InstallmentPlanFilters, page: number, size: number, sort: SortState<InstallmentPlanSortField> | null = null) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    appendSort(params, sort)
    filters.companyIds?.forEach((id) => params.append('companyId', id))
    if (filters.number) params.set('number', filters.number)
    if (filters.cigamNumber) params.set('cigamNumber', filters.cigamNumber)
    if (filters.status !== null) params.set('status', filters.status)
    if (filters.origin !== null) params.set('origin', filters.origin)
    return request<Page<InstallmentPlan>>('GET', `/api/installment-plans?${params}`)
  },
  /** The ACTIVE plans, unpaged: the plan select of the slip form. */
  activeOptions: () => request<InstallmentPlan[]>('GET', '/api/installment-plans/options?status=ACTIVE'),
  get: (id: number) => request<InstallmentPlan>('GET', `/api/installment-plans/${id}`),
  create: (input: InstallmentPlanInput) => request<InstallmentPlan>('POST', '/api/installment-plans', input),
  update: (id: number, input: InstallmentPlanInput) =>
    request<InstallmentPlan>('PUT', `/api/installment-plans/${id}`, input),
  remove: (id: number) => request<void>('DELETE', `/api/installment-plans/${id}`),
}

function appendSort(params: URLSearchParams, sort: SortState<string> | null) {
  if (!sort) return
  params.set('sort', sort.field)
  params.set('direction', sort.ascending ? 'ASC' : 'DESC')
}

/** Query string shared by the slip list and the deleted slips list. */
function slipSearchParams(filters: SlipFilters, page: number, size: number): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  // Repeated parameters (?status=PENDING&status=OVERDUE) match any of the values.
  filters.companyIds?.forEach((id) => params.append('companyId', id))
  filters.slipTypeIds?.forEach((id) => params.append('slipTypeId', id))
  filters.origins?.forEach((origin) => params.append('origin', origin))
  filters.statuses?.forEach((status) => params.append('status', status))
  if (filters.dueFrom) params.set('dueFrom', filters.dueFrom)
  if (filters.dueTo) params.set('dueTo', filters.dueTo)
  if (filters.sentFrom) params.set('sentFrom', filters.sentFrom)
  if (filters.sentTo) params.set('sentTo', filters.sentTo)
  // The API filters competence by date; the screen picks whole months.
  if (filters.competenceFrom) params.set('competenceFrom', firstDayOfMonth(filters.competenceFrom))
  if (filters.competenceTo) params.set('competenceTo', lastDayOfMonth(filters.competenceTo))
  if (filters.companyCnpj) params.set('companyCnpj', filters.companyCnpj)
  if (filters.planNumber) params.set('planNumber', filters.planNumber)
  if (filters.subject) params.set('subject', filters.subject)
  if (filters.amountFrom) params.set('amountFrom', filters.amountFrom)
  if (filters.amountTo) params.set('amountTo', filters.amountTo)
  return params
}

export const slipsApi = {
  search: (filters: SlipFilters, page: number, size: number, sort: SortState<SlipSortField> | null = null) => {
    const params = slipSearchParams(filters, page, size)
    appendSort(params, sort)
    return request<Page<SlipSummary>>('GET', `/api/slips?${params}`)
  },
  get: (id: number) => request<SlipDetail>('GET', `/api/slips/${id}`),
  create: (input: SlipInput) => request<SlipDetail>('POST', '/api/slips', input),
  update: (id: number, input: SlipInput) => request<SlipDetail>('PUT', `/api/slips/${id}`, input),
  remove: (id: number) => request<void>('DELETE', `/api/slips/${id}`),
  registerOpening: (id: number) => request<void>('POST', `/api/slips/${id}/openings`),
  registerPayment: (id: number, receiptUrl: string, paymentDate: string) =>
    request<SlipDetail>('POST', `/api/slips/${id}/payment`, { receiptUrl, paymentDate }),
  removePayment: (id: number) => request<SlipDetail>('DELETE', `/api/slips/${id}/payment`),
  history: (id: number) => request<HistoryEntry[]>('GET', `/api/slips/${id}/history`),
}

/** Administrator only. */
export const deletedSlipsApi = {
  search: (filters: DeletedSlipFilters, page: number, size: number) => {
    const params = slipSearchParams(filters, page, size)
    filters.deletedByUserIds?.forEach((id) => params.append('deletedByUserId', id))
    return request<Page<DeletedSlip>>('GET', `/api/deleted-slips?${params}`)
  },
  /** Who deleted the slips still kept, including users that no longer exist. */
  deleters: () => request<SlipDeleter[]>('GET', '/api/deleted-slips/deleters'),
  history: (id: number) => request<HistoryEntry[]>('GET', `/api/deleted-slips/${id}/history`),
  /** The slip comes back under the id it had (`slipId`). */
  restore: (id: number) => request<SlipDetail>('POST', `/api/deleted-slips/${id}/restore`),
}

export const calendarApi = {
  month: (year: number, month: number) => request<CalendarDay[]>('GET', `/api/calendar/${year}/${month}`),
  day: (date: string) => request<SlipTypeGroup[]>('GET', `/api/calendar/day/${date}`),
}

export const usageApi = {
  /** `month` as `yyyy-MM`; the current month when empty. */
  summary: (month: string) => request<UsageSummary>('GET', `/api/usage/summary${month ? `?month=${month}` : ''}`),
  /** E-mails left today (read from Brevo) and the database size, against the free plans' limits. */
  limits: () => request<PlanLimits>('GET', '/api/usage/limits'),
}

export const closingApi = {
  access: () => request<ClosingAccess>('GET', '/api/closing/access'),
  setAccountingAccess: (accountingAccess: boolean) => request<void>('PUT', '/api/closing/access', { accountingAccess }),
  companyOptions: () => request<ClosingCompanyOption[]>('GET', '/api/closing/companies'),
  saveCompany: (cnpjRoot: string, name: string, active: boolean) =>
    request<ClosingCompany>('PUT', `/api/closing/companies/${cnpjRoot}`, { name, active }),
  activeCompanies: () => request<ClosingCompany[]>('GET', '/api/closing/companies/active'),
  holders: () => request<BankHolder[]>('GET', '/api/closing/holders'),
  createHolder: (input: BankHolderInput) => request<BankHolder>('POST', '/api/closing/holders', input),
  updateHolder: (id: number, input: BankHolderInput) => request<BankHolder>('PUT', `/api/closing/holders/${id}`, input),
  deleteHolder: (id: number) => request<void>('DELETE', `/api/closing/holders/${id}`),
  /** `competence` as `yyyy-MM`. */
  balances: (companyId: number, competence: string) =>
    request<HolderBalance[]>('GET', `/api/closing/balances?companyId=${companyId}&competence=${competence}`),
  saveBalance: (input: HolderBalanceInput) => request<HolderBalance>('PUT', '/api/closing/balances', input),
  importCsv: (competence: string, csv: string) => request<ImportReport>('POST', '/api/closing/import', { competence, csv }),
  tasks: (companyId: number, competence: string) =>
    request<ClosingTask[]>('GET', `/api/closing/tasks?companyId=${companyId}&competence=${competence}`),
  /** A 428 answer means the previous phase is open: ask the user and send again with `confirmDependency`. */
  changeTask: (
    templateId: number,
    input: { companyId: number; competence: string; status: TaskStatus; note: string | null; confirmDependency?: boolean },
  ) => request<ClosingTask>('PUT', `/api/closing/tasks/${templateId}`, input),
  /** The last three months up to the current one, oldest first. */
  recentMonths: (companyId: number) => request<MonthProgress[]>('GET', `/api/closing/tasks/months?companyId=${companyId}`),
  taskHistory: (templateId: number, companyId: number, competence: string) =>
    request<TaskHistoryItem[]>(
      'GET',
      `/api/closing/tasks/${templateId}/history?companyId=${companyId}&competence=${competence}`,
    ),
  taskTemplates: () => request<TaskTemplate[]>('GET', '/api/closing/task-templates'),
  setTaskCompanies: (id: number, appliesToAll: boolean, companyIds: number[]) =>
    request<TaskTemplate>('PUT', `/api/closing/task-templates/${id}/companies`, { appliesToAll, companyIds }),
  setPhaseDependency: (mode: PhaseDependency) => request<void>('PUT', '/api/closing/phase-dependency', { mode }),
}
