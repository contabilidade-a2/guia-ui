import { firstDayOfMonth, lastDayOfMonth } from '../lib/format'
import { request } from './client'
import type {
  CalendarDay,
  Company,
  CompanyInput,
  DeletedSlip,
  DeletedSlipFilters,
  HistoryEntry,
  InstallmentPlan,
  InstallmentPlanFilters,
  InstallmentPlanInput,
  LoginResult,
  Page,
  SlipDeleter,
  SlipDetail,
  SlipFilters,
  SlipInput,
  SlipSummary,
  SlipType,
  SlipTypeInput,
  SlipTypeGroup,
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
  search: (filters: InstallmentPlanFilters, page: number, size: number) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
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
  return params
}

export const slipsApi = {
  search: (filters: SlipFilters, page: number, size: number) =>
    request<Page<SlipSummary>>('GET', `/api/slips?${slipSearchParams(filters, page, size)}`),
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
