import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import { ApiError, errorMessage, fieldErrors } from '../api/client'
import { closingApi } from '../api/endpoints'
import type {
  BalanceStatus,
  BankHolder,
  BankHolderInput,
  ClosingCompanyOption,
  HolderBalance,
  HolderType,
  ImportReport,
  MonthProgress,
  OverviewMonth,
  ClosingCompany,
  ClosingTask,
  PhaseDependency,
  SortState,
  TaskHistoryItem,
  TaskStatus,
  TaskTemplate,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CheckboxList } from '../components/CheckboxList'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { MonthInput } from '../components/MonthInput'
import { SignedMoneyInput } from '../components/SignedMoneyInput'
import { ErrorBanner, Field, Loading, Modal, Segmented, SortableHeader } from '../components/ui'
import {
  BALANCE_STATUS_BADGES,
  BALANCE_STATUS_LABELS,
  HOLDER_TYPE_LABELS,
  PHASE_TITLES,
  TASK_STATUS_BADGES,
  TASK_STATUS_LABELS,
  formatCnpjRoot,
  formatDateTime,
  formatInstantDate,
  formatMoney,
  todayIso,
} from '../lib/format'
import { normalize, onlyDigits } from '../lib/text'
import { useLoad } from '../lib/useLoad'
import { useDialogs } from '../components/dialogContext'

type Tab = 'month' | 'balances' | 'holders' | 'companies' | 'catalog'

/** Controle contábil, etapa 1: the monthly balance panel of the bank holders, and (administrator) its settings. */
export function ClosingPage() {
  const { isAdmin } = useAuth()
  // The overview (its own screen) opens a company's month here: /closing?company=1&competence=2026-10.
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('month')
  const access = useLoad(() => closingApi.access(), [])
  const companies = useLoad(() => closingApi.activeCompanies(), [])
  // The month and company are shared by Fechamento and Saldos: opening the balances keeps the same period.
  // null until the first month is known; after that, whatever is typed (even incomplete) stays, so the field
  // doesn't jump back to the default month while a new one is being typed.
  const [competence, setCompetence] = useState<string | null>(() => params.get('competence'))
  const [companyId, setCompanyId] = useState<number | null>(() => Number(params.get('company')) || null)
  const firstCompetence = access.data?.firstCompetence ?? ''
  if (competence === null && access.data) setCompetence(defaultCompetence(firstCompetence))
  const period: Period | null =
    access.data && companies.data && competence !== null
      ? {
          competence,
          companyId: companyId ?? companies.data[0]?.id ?? null,
          companies: companies.data,
          firstCompetence,
          setCompetence,
          setCompanyId,
        }
      : null


  return (
    <>
      <div className="page-header">
        <div>
          <h1>Controle contábil</h1>
        </div>
        <SectionTabs tab={tab} onChange={setTab} withRegisters={isAdmin} />
      </div>
      <ErrorBanner message={access.error ?? companies.error} onRetry={access.error ? access.reload : companies.reload} />
      {(access.loading || companies.loading) && !period && <Loading />}
      {period && tab === 'month' && <MonthView period={period} onOpenBalances={() => setTab('balances')} />}
      {period && tab === 'balances' && <BalancePanel period={period} canImport={isAdmin} />}
      {access.data && tab === 'holders' && <HoldersSection />}
      {access.data && tab === 'companies' && (
        <CompaniesSection
          accountingAccess={access.data.accountingAccess}
          phaseDependency={access.data.phaseDependency}
          onAccessChanged={access.reload}
        />
      )}
      {access.data && tab === 'catalog' && <CatalogSection />}
    </>
  )
}

const REGISTERS: { value: Tab; label: string }[] = [
  { value: 'holders', label: 'Portadores' },
  { value: 'companies', label: 'Empresas e acesso' },
  { value: 'catalog', label: 'Tarefas' },
]

/**
 * Fechamento and Saldos, the monthly work, side by side; the registers (administrator only) grouped under
 * "Cadastros", like the groups of the main menu (layout chosen by the user on 26/11/2026).
 */
function SectionTabs({ tab, onChange, withRegisters }: { tab: Tab; onChange: (tab: Tab) => void; withRegisters: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])
  const register = REGISTERS.find((item) => item.value === tab)

  return (
    <div className="segmented segmented-strong section-tabs" role="group" aria-label="Seção" ref={ref}>
      <button type="button" aria-pressed={tab === 'month'} onClick={() => onChange('month')}>
        Fechamento
      </button>
      <button type="button" aria-pressed={tab === 'balances'} onClick={() => onChange('balances')}>
        Saldos
      </button>
      {withRegisters && (
        <span className="section-tabs-group">
          <button type="button" aria-pressed={!!register} aria-expanded={open} onClick={() => setOpen(!open)}>
            {register ? `Cadastros: ${register.label}` : 'Cadastros'}
            <span className="section-tabs-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {open && (
            <span className="task-menu section-tabs-menu" role="menu">
              {REGISTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="menuitem"
                  className={item.value === tab ? 'current' : undefined}
                  onClick={() => {
                    setOpen(false)
                    onChange(item.value)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

/** The month and the company chosen on screen, shared by the task list and the balances. */
interface Period {
  competence: string
  companyId: number | null
  companies: ClosingCompany[]
  firstCompetence: string
  setCompetence: (value: string) => void
  setCompanyId: (value: number) => void
}

const validPeriod = (period: Period) =>
  period.competence !== '' && period.competence >= period.firstCompetence && period.competence <= todayIso().slice(0, 7)

function PeriodFields({ period }: { period: Period }) {
  return (
    <>
      <Field label="Competência">
        <MonthInput value={period.competence} onChange={period.setCompetence} label="Competência" />
      </Field>
      <Field label="Empresa">
        <select value={period.companyId ?? ''} onChange={(e) => period.setCompanyId(Number(e.target.value))}>
          {period.companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  )
}

function PeriodWarnings({ period }: { period: Period }) {
  if (period.companies.length === 0) return <div className="banner banner-error">Nenhuma empresa do fechamento está ativa.</div>
  if (period.competence !== '' && !validPeriod(period)) {
    const first = period.firstCompetence
    return (
      <div className="banner banner-error">
        A competência vai de {first.slice(5)}/{first.slice(0, 4)} até o mês atual.
      </div>
    )
  }
  return null
}

// ---------- Acompanhamento: every company over a period (asked by the user on 26/11/2026) ----------

/**
 * The grid of months chosen by the user: one row per active company with the % of the period and a small cell per
 * month (before the control: faded, counts as 100%; closed: lock; in progress: %; not started: grey). Opens on the
 * current fiscal year up to the previous month; a click on a month opens its Fechamento.
 */
/** Acompanhamento, its own screen in the Contábil menu (asked by the user on 26/11/2026). */
export function ClosingOverviewPage() {
  const navigate = useNavigate()
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Acompanhamento</h1>
        </div>
      </div>
      <OverviewSection onOpen={(company, month) => navigate(`/closing?company=${company}&competence=${month}`)} />
    </>
  )
}

function OverviewSection({ onOpen }: { onOpen: (companyId: number, competence: string) => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const valid = from === '' && to === '' ? true : from !== '' && to !== '' && from <= to
  const overview = useLoad(() => closingApi.overview(valid ? from : '', valid ? to : ''), [valid ? from : '', valid ? to : ''])
  const data = overview.data
  // The first answer brings the default period; the fields show it from then on.
  if (data && from === '' && to === '') {
    setFrom(data.from)
    setTo(data.to)
  }
  const label = data ? `${shortMonth(data.from)} a ${shortMonth(data.to)}` : ''

  return (
    <>
      <div className="card filters filters-overview">
        <Field label="De">
          <MonthInput value={from} onChange={setFrom} label="De" />
        </Field>
        <Field label="Até">
          <MonthInput value={to} onChange={setTo} label="Até" />
        </Field>
      </div>
      {!valid && from !== '' && to !== '' && <div className="banner banner-error">O mês inicial não pode ser depois do final.</div>}
      <ErrorBanner message={overview.error} onRetry={overview.reload} />
      {overview.loading && !data && <Loading />}
      {data && (
        <>
          <div className="overview-tiles">
            <div className="card overview-tile">
              <span>{label}</span>
              <strong>{data.percent}%</strong>
              <small>todas as empresas</small>
            </div>
            <div className="card overview-tile">
              <span>Meses fechados</span>
              <strong>
                {data.closedMonths} de {data.controlMonths}
              </strong>
            </div>
            <div className="card overview-tile">
              <span>Empresas em dia</span>
              <strong>
                {data.upToDate} de {data.companies.length}
              </strong>
            </div>
          </div>
          <div className="card table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>No período</th>
                  <th>Meses</th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((company) => (
                  <tr key={company.id}>
                    <td className="overview-company">{company.name}</td>
                    <td>
                      <span className="overview-percent">
                        {company.percent}%
                        <ProgressBar done={company.percent} total={100} />
                      </span>
                    </td>
                    <td>
                      <div className="overview-months">
                        {company.months.map((month) => (
                          <OverviewCell key={month.competence} month={month} onOpen={() => onOpen(company.id, month.competence)} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.companies.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted empty-row">
                      Nenhuma empresa do fechamento está ativa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function OverviewCell({ month, onOpen }: { month: OverviewMonth; onOpen: () => void }) {
  const name = MONTH_SHORT[Number(month.competence.slice(5)) - 1]
  if (month.beforeControl) {
    return (
      <span className="overview-cell overview-cell-before" title={`${shortMonth(month.competence)} · antes do controle`}>
        {name}
        <em>100%</em>
      </span>
    )
  }
  const state = month.closed ? 'closed' : month.started ? 'open' : 'idle'
  const title = `${shortMonth(month.competence)} · ${month.done} de ${month.total} tarefas`
  return (
    <button type="button" className={`overview-cell overview-cell-${state}`} title={title} onClick={onOpen}>
      {name}
      <em>{month.closed ? <LockIcon /> : `${month.percent}%`}</em>
    </button>
  )
}

// ---------- the month: tasks by stage (etapa 2) ----------

/** Concluded out of the tasks that apply (not applicable ones don't count). */
function progress(tasks: ClosingTask[]) {
  const applicable = tasks.filter((task) => task.status !== 'NOT_APPLICABLE')
  return { done: applicable.filter((task) => task.status === 'DONE').length, total: applicable.length }
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <span className="task-progress" aria-label={`${done} de ${total}`}>
      <span className="task-progress-fill" style={{ width: `${percent}%` }} />
    </span>
  )
}

/** A task as the screen shows it: numbered 1 to n in the catalog order (codes stay internal). */
interface NumberedTask extends ClosingTask {
  number: number
}

interface TaskFilter {
  stage: string
  name: string
  responsible: string
}

const EMPTY_TASK_FILTER: TaskFilter = { stage: '', name: '', responsible: '' }

type TaskSortField = 'NUMBER' | 'NAME' | 'STATUS' | 'RESPONSIBLE'

const TASK_STATUS_ORDER: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE']

/** Status ascending: pending, in progress, done, not applicable. Ties keep the task number. */
function compareTasks(a: NumberedTask, b: NumberedTask, field: TaskSortField, ascending: boolean): number {
  const sign = ascending ? 1 : -1
  const result = (() => {
    switch (field) {
      case 'NUMBER':
        return sign * (a.number - b.number)
      case 'NAME':
        return sign * byText(a.name, b.name)
      case 'STATUS':
        return sign * (TASK_STATUS_ORDER.indexOf(a.status) - TASK_STATUS_ORDER.indexOf(b.status))
      case 'RESPONSIBLE':
        return compareOptional(a.status === 'DONE' ? a.doneBy : null, b.status === 'DONE' ? b.doneBy : null, byText, ascending)
    }
  })()
  return result || a.number - b.number
}

function MonthView({ period, onOpenBalances }: { period: Period; onOpenBalances: () => void }) {
  const { competence, companyId } = period
  const valid = validPeriod(period)
  const tasks = useLoad(
    () => (companyId && valid ? closingApi.tasks(companyId, competence) : Promise.resolve([])),
    [companyId, competence],
  )
  const [statusFilter, setStatusFilter] = useState<'' | TaskStatus>('')
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_TASK_FILTER)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [sort, setSort] = useState<SortState<TaskSortField> | null>(null)
  // The strip of recent months is reloaded with the tasks, so a task concluded here updates it.
  const months = useLoad(
    () => (companyId ? closingApi.recentMonths(companyId) : Promise.resolve([])),
    [companyId, tasks.data],
  )

  const responsibles = [
    ...new Set((tasks.data ?? []).filter((task) => task.status === 'DONE' && task.doneBy).map((task) => task.doneBy as string)),
  ].sort(byText)
  const chips: FilterChip[] = [
    ...(filter.stage ? [{ label: `Etapa: ${PHASE_TITLES[Number(filter.stage)]}`, clear: () => setFilter({ ...filter, stage: '' }) }] : []),
    ...(filter.name.trim() ? [{ label: `Tarefa: ${filter.name.trim()}`, clear: () => setFilter({ ...filter, name: '' }) }] : []),
    ...(filter.responsible
      ? [{ label: `Responsável: ${filter.responsible}`, clear: () => setFilter({ ...filter, responsible: '' }) }]
      : []),
  ]
  const filtering = statusFilter !== '' || chips.length > 0

  return (
    <>
      <div className="card filters filters-month">
        <PeriodFields period={period} />
        <Field label="Status">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | TaskStatus)}>
            <option value="">Todos</option>
            {TASK_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
        <AdvancedToggle open={advancedOpen} inUse={chips.length > 0} onToggle={() => setAdvancedOpen(!advancedOpen)} />
        <FilterRow
          chips={chips}
          showChips={!advancedOpen}
          onOpen={() => setAdvancedOpen(true)}
          onClear={
            filtering
              ? () => {
                  setStatusFilter('')
                  setFilter(EMPTY_TASK_FILTER)
                }
              : undefined
          }
        />
        {months.data && months.data.length > 0 && (
          <RecentMonths months={months.data} current={competence} onSelect={period.setCompetence} />
        )}
        {advancedOpen && (
          <div className="filters-advanced filters-advanced-holders">
            <Field label="Etapa">
              <select value={filter.stage} onChange={(e) => setFilter({ ...filter, stage: e.target.value })}>
                <option value="">Todas</option>
                {Object.entries(PHASE_TITLES).map(([phase, title]) => (
                  <option key={phase} value={phase}>
                    {title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tarefa">
              <input
                type="search"
                value={filter.name}
                onChange={(e) => setFilter({ ...filter, name: e.target.value })}
                placeholder="Parte do nome"
              />
            </Field>
            <Field label="Responsável">
              <select value={filter.responsible} onChange={(e) => setFilter({ ...filter, responsible: e.target.value })}>
                <option value="">Todos</option>
                {responsibles.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>
      <PeriodWarnings period={period} />
      <ErrorBanner message={tasks.error} onRetry={tasks.reload} />
      {tasks.loading && !tasks.data && <Loading />}
      {tasks.data && companyId && valid && tasks.data.length > 0 && (
        <TaskList
          key={`${companyId}:${competence}`}
          initial={tasks.data}
          companyId={companyId}
          competence={competence}
          statusFilter={statusFilter}
          filter={filter}
          filtering={filtering}
          sort={sort}
          onSort={setSort}
          onOpenBalances={onOpenBalances}
          onChanged={months.reload}
        />
      )}
    </>
  )
}

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** `2026-09` → `Set/2026` */
const shortMonth = (competence: string) => `${MONTH_SHORT[Number(competence.slice(5)) - 1]}/${competence.slice(0, 4)}`

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

/**
 * The last three months as small tags (ideas 1 + 3 chosen by the user on 26/11/2026): closed in green with a lock,
 * in progress in amber with the count, not started in grey. A click opens that month.
 */
function RecentMonths({ months, current, onSelect }: { months: MonthProgress[]; current: string; onSelect: (month: string) => void }) {
  return (
    <div className="recent-months" aria-label="Últimos meses">
      <span className="muted">Últimos meses:</span>
      {months.map((month) => {
        const state = month.closed ? 'closed' : month.started ? 'open' : 'idle'
        return (
          <button
            key={month.competence}
            type="button"
            className={`month-tag month-tag-${state}${month.competence === current ? ' month-tag-current' : ''}`}
            aria-pressed={month.competence === current}
            title={month.closed ? 'Mês fechado' : month.started ? 'Em andamento' : 'Não iniciado'}
            onClick={() => onSelect(month.competence)}
          >
            {month.closed && <LockIcon />}
            {shortMonth(month.competence)}
            {!month.closed && month.started && ` · ${month.done} de ${month.total}`}
          </button>
        )
      })}
    </div>
  )
}

interface TaskListProps {
  initial: ClosingTask[]
  companyId: number
  competence: string
  statusFilter: '' | TaskStatus
  filter: TaskFilter
  filtering: boolean
  sort: SortState<TaskSortField> | null
  onSort: (sort: SortState<TaskSortField> | null) => void
  onOpenBalances: () => void
  /** After a task changes: the strip of recent months follows. */
  onChanged: () => void
}

function TaskList(props: TaskListProps) {
  const dialogs = useDialogs()
  const { initial, companyId, competence, statusFilter, filter, filtering, sort, onSort, onOpenBalances, onChanged } = props
  const [tasks, setTasks] = useState(initial)
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    setTasks(initial)
  }
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<NumberedTask | null>(null)
  const numbered: NumberedTask[] = tasks.map((task, index) => ({ ...task, number: index + 1 }))
  const total = progress(tasks)
  // The seal's date: the last conclusion of the month (the automatic balance task has none of its own).
  const closedAt = tasks.map((task) => (task.status === 'DONE' ? task.doneAt : null)).filter(Boolean).sort().at(-1) ?? null
  const name = normalize(filter.name.trim())
  const shown = numbered.filter(
    (task) =>
      (!statusFilter || task.status === statusFilter) &&
      (!filter.stage || task.phase === Number(filter.stage)) &&
      (!name || normalize(task.name).includes(name)) &&
      (!filter.responsible || (task.status === 'DONE' && task.doneBy === filter.responsible)),
  )
  const phases = [...new Set(tasks.map((task) => task.phase))].sort()

  async function change(task: ClosingTask, status: TaskStatus, note: string | null) {
    setError(null)
    let text = note?.trim() ? note.trim() : null
    if (task.kind === 'CALCULATED' && status === 'DONE' && !task.automatic && !text) {
      const typed = await dialogs.prompt({
        title: 'Portadores pendentes',
        message: 'Ainda há portadores pendentes ou divergentes.',
        label: 'Observação',
        confirmLabel: 'Concluir',
      })
      if (!typed) return
      text = typed
    }
    const send = (confirmDependency: boolean) =>
      closingApi.changeTask(task.templateId, { companyId, competence, status, note: text, confirmDependency })
    try {
      let saved: ClosingTask
      try {
        saved = await send(false)
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 428) throw caught
        if (!(await dialogs.confirm({ title: 'Etapa anterior aberta', message: caught.message, confirmLabel: 'Concluir mesmo assim' })))
          return
        saved = await send(true)
      }
      setTasks((current) => current.map((item) => (item.templateId === saved.templateId ? saved : item)))
      onChanged()
    } catch (caught) {
      setError(`${task.name}: ${errorMessage(caught)}`)
    }
  }

  return (
    <>
      <div className="card closing-summary task-summary">
        <div className="task-summary-total">
          <span className="task-summary-label">Tarefas concluídas</span>
          <strong>
            {total.done} de {total.total}
          </strong>
          <ProgressBar {...total} />
          {total.total > 0 && total.done === total.total && (
            <span className="month-seal">
              <LockIcon /> Mês fechado{closedAt ? ` · ${formatInstantDate(closedAt)}` : ''}
            </span>
          )}
        </div>
      </div>
      <ErrorBanner message={error} />
      {phases.map((phase) => {
        const rows = sortRows(
          shown.filter((task) => task.phase === phase),
          sort,
          compareTasks,
        )
        if (filtering && rows.length === 0) return null
        return (
          <TaskStage
            key={phase}
            title={PHASE_TITLES[phase] ?? `Etapa ${phase}`}
            tasks={rows}
            sort={sort}
            onSort={onSort}
            onChange={change}
            onHistory={setHistory}
            onOpenBalances={onOpenBalances}
          />
        )
      })}
      {filtering && shown.length === 0 && <p className="muted">Nenhuma tarefa com estes filtros.</p>}
      {history && (
        <TaskHistoryModal task={history} companyId={companyId} competence={competence} onClose={() => setHistory(null)} />
      )}
    </>
  )
}

interface TaskStageProps {
  title: string
  tasks: NumberedTask[]
  sort: SortState<TaskSortField> | null
  onSort: (sort: SortState<TaskSortField> | null) => void
  onChange: (task: ClosingTask, status: TaskStatus, note: string | null) => void
  onHistory: (task: NumberedTask) => void
  onOpenBalances: () => void
}

function TaskStage({ title, tasks, sort, onSort, onChange, onHistory, onOpenBalances }: TaskStageProps) {
  const [open, setOpen] = useState(true)
  return (
    <section className="card closing-group">
      <button type="button" className="closing-group-header" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="closing-group-caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <h2>{title}</h2>
      </button>
      {open && (
        <div className="table-wrapper">
          <table className="closing-table task-table">
            <thead>
              <tr>
                <th className="task-check" aria-label="Concluída" />
                <SortableHeader label="Nº" field="NUMBER" sort={sort} onSort={onSort} />
                <SortableHeader label="Tarefa" field="NAME" sort={sort} onSort={onSort} />
                <SortableHeader label="Status" field="STATUS" sort={sort} onSort={onSort} />
                <SortableHeader label="Responsável" field="RESPONSIBLE" sort={sort} onSort={onSort} />
                <th>Observação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <TaskLine key={task.templateId} task={task} onChange={onChange} onHistory={onHistory} onOpenBalances={onOpenBalances} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

interface TaskLineProps {
  task: NumberedTask
  onChange: (task: ClosingTask, status: TaskStatus, note: string | null) => void
  onHistory: (task: NumberedTask) => void
  onOpenBalances: () => void
}

function TaskLine({ task, onChange, onHistory, onOpenBalances }: TaskLineProps) {
  const [note, setNote] = useState(task.note ?? '')
  const [lastNote, setLastNote] = useState(task.note)
  if (task.note !== lastNote) {
    setLastNote(task.note)
    setNote(task.note ?? '')
  }
  const [whenOpen, setWhenOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLSpanElement>(null)
  // The status menu closes on a click outside it or on Esc, like the other menus.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])
  const locked = !task.applicable || task.automatic
  const done = task.status === 'DONE'
  const others = TASK_STATUS_ORDER.filter((status) => status !== task.status)
  const balances = task.balances

  return (
    <tr className={`task-row${!task.applicable ? ' task-row-na' : ''}`}>
      <td className="task-check">
        <input
          type="checkbox"
          aria-label={`Tarefa ${task.number}: concluída`}
          checked={done}
          disabled={locked}
          title={task.automatic ? 'Concluída sozinha: todos os portadores estão OK' : undefined}
          onChange={(e) => onChange(task, e.target.checked ? 'DONE' : 'PENDING', note)}
        />
      </td>
      <td className="task-number">{task.number}</td>
      <td>
        <div className="task-name" title={task.description ?? undefined}>
          {task.name}
        </div>
        {balances && task.applicable && (
          <div className="task-balances">
            <span className="muted">
              {balances.total === 0
                ? 'Nenhum portador no mês'
                : `${balances.ok + balances.noMovement} de ${balances.total} OK` +
                  (balances.divergent ? ` · ${balances.divergent} ${balances.divergent === 1 ? 'divergente' : 'divergentes'}` : '') +
                  (balances.pending ? ` · ${balances.pending} ${balances.pending === 1 ? 'pendente' : 'pendentes'}` : '')}
            </span>
            <button type="button" className="link-button" onClick={onOpenBalances}>
              Ver saldos
            </button>
          </div>
        )}
      </td>
      <td>
        <span className={`badge ${TASK_STATUS_BADGES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>
      </td>
      <td className="task-who">
        {task.automatic ? (
          <span className="muted">Automático</span>
        ) : done && task.doneBy && task.doneAt ? (
          <>
            <button
              type="button"
              className="task-who-button"
              aria-expanded={whenOpen}
              title={whenOpen ? 'Ocultar data e hora' : 'Mostrar data e hora'}
              onClick={() => setWhenOpen(!whenOpen)}
            >
              {task.doneBy}
              <span className="task-who-caret" aria-hidden="true">
                {whenOpen ? '▴' : '▾'}
              </span>
            </button>
            {whenOpen && <span className="muted task-when">{formatDateTime(task.doneAt)}</span>}
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        {task.applicable && (
          <input
            className="closing-note"
            aria-label={`Tarefa ${task.number}: observação`}
            maxLength={500}
            value={note}
            placeholder="—"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== (task.note ?? '') && onChange(task, task.status, note)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        )}
      </td>
      <td className="row-actions task-actions">
        <button type="button" className="icon-action" title="Histórico" aria-label={`Histórico da tarefa ${task.number}`} onClick={() => onHistory(task)}>
          <HistoryIcon />
        </button>
        {!locked && (
          <span className="task-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="icon-action"
              title="Outros status"
              aria-label={`Outros status da tarefa ${task.number}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ⋯
            </button>
            {menuOpen && (
              <span className="task-menu" role="menu">
                {others.map((status) => (
                  <button
                    key={status}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onChange(task, status, note)
                    }}
                  >
                    {TASK_STATUS_LABELS[status]}
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
      </td>
    </tr>
  )
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface TaskHistoryModalProps {
  task: NumberedTask
  companyId: number
  competence: string
  onClose: () => void
}

function TaskHistoryModal({ task, companyId, competence, onClose }: TaskHistoryModalProps) {
  const items = useLoad(() => closingApi.taskHistory(task.templateId, companyId, competence), [task.templateId])
  return (
    <Modal title={`Histórico · ${task.number}. ${task.name}`} onClose={onClose}>
      <ErrorBanner message={items.error} />
      {items.loading && <Loading />}
      {items.data && items.data.length === 0 && <p className="muted">Nenhuma alteração neste mês.</p>}
      {items.data && items.data.length > 0 && (
        <ul className="task-history">
          {items.data.map((item: TaskHistoryItem, index) => (
            <li key={index}>
              <span className="task-history-when">{formatDateTime(item.at)}</span>
              <span>
                <strong>{item.automatic ? 'Automático' : item.userName}</strong> · {TASK_STATUS_LABELS[item.fromStatus]} →{' '}
                {TASK_STATUS_LABELS[item.toStatus]}
                {item.note && <span className="muted task-history-note">{item.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// ---------- balance panel ----------

/** `yyyy-MM` of the month before today (the month usually being closed), never before the first one. */
function defaultCompetence(first: string): string {
  const [year, month] = todayIso().split('-').map(Number)
  const previous = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  return previous < first ? first : previous
}

const STATUS_ORDER: BalanceStatus[] = ['DIVERGENT', 'PENDING', 'OK', 'NO_MOVEMENT']
const OPEN_STATUSES = new Set<BalanceStatus>(['PENDING', 'DIVERGENT'])

/** Portador, Banco and Conta filters, shared by the balance panel and the holder register (asked on 25/11/2026). */
interface HolderFilter {
  holder: string
  bank: string
  account: string
}

type HolderFilterField = keyof HolderFilter

const EMPTY_HOLDER_FILTER: HolderFilter = { holder: '', bank: '', account: '' }

/** Portador: part of the code or the description; Banco: the bank chosen; Conta: part of it, with or without dots. */
function matchesHolder(holder: BankHolder, filter: HolderFilter): boolean {
  const text = normalize(filter.holder.trim())
  if (text && !normalize(holder.code).includes(text) && !normalize(holder.description).includes(text)) return false
  if (filter.bank && (holder.bank ?? '') !== filter.bank) return false
  const account = filter.account.trim()
  if (account) {
    const digits = onlyDigits(account)
    const value = holder.account ?? ''
    if (digits ? !onlyDigits(value).includes(digits) : !normalize(value).includes(normalize(account))) return false
  }
  return true
}

/** The banks of these holders, for the Banco filter. */
function bankOptions(holders: BankHolder[]): string[] {
  return [...new Set(holders.map((holder) => holder.bank).filter((bank): bank is string => !!bank))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
}

interface HolderFilterFieldsProps {
  filter: HolderFilter
  banks: string[]
  onChange: (filter: HolderFilter) => void
  /** Which of the three fields to show here (the others may be in sight elsewhere). */
  fields?: HolderFilterField[]
}

function HolderFilterFields({ filter, banks, onChange, fields = ['holder', 'bank', 'account'] }: HolderFilterFieldsProps) {
  return (
    <>
      {fields.includes('holder') && (
        <Field label="Portador">
          <input
            type="search"
            value={filter.holder}
            onChange={(e) => onChange({ ...filter, holder: e.target.value })}
            placeholder="Código ou nome"
          />
        </Field>
      )}
      {fields.includes('bank') && (
        <Field label="Banco">
          <select value={filter.bank} onChange={(e) => onChange({ ...filter, bank: e.target.value })}>
            <option value="">Todos</option>
            {banks.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
        </Field>
      )}
      {fields.includes('account') && (
        <Field label="Conta">
          <input
            type="search"
            value={filter.account}
            onChange={(e) => onChange({ ...filter, account: e.target.value })}
            placeholder="Número"
          />
        </Field>
      )}
    </>
  )
}

interface FilterChip {
  label: string
  clear: () => void
}

/** The holder filters in use, as removable chips ("Banco: ITAU ×"). */
function holderFilterChips(
  filter: HolderFilter,
  onChange: (filter: HolderFilter) => void,
  fields: HolderFilterField[],
): FilterChip[] {
  const labels: Record<HolderFilterField, string> = { holder: 'Portador', bank: 'Banco', account: 'Conta' }
  return fields
    .filter((field) => filter[field].trim() !== '')
    .map((field) => ({ label: `${labels[field]}: ${filter[field].trim()}`, clear: () => onChange({ ...filter, [field]: '' }) }))
}

/**
 * "Filtros avançados", as in the slip list (principle set by the user on 25/11/2026: only the main filters in sight,
 * the rest behind this button, so a screen stays functional and clean). Highlighted while closed with a filter in use.
 */
function AdvancedToggle({ open, inUse, onToggle }: { open: boolean; inUse: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`button filters-toggle${open ? ' filters-toggle-open' : ''}${!open && inUse ? ' filters-toggle-active' : ''}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      Filtros avançados
      <span className="filters-toggle-sign" aria-hidden="true">
        {open ? '−' : '+'}
      </span>
    </button>
  )
}

interface FilterRowProps {
  chips: FilterChip[]
  showChips: boolean
  onOpen: () => void
  onClear?: () => void
}

/** Under the main filters: the advanced ones in use (while the panel is closed) and "Limpar filtros". */
function FilterRow({ chips, showChips, onOpen, onClear }: FilterRowProps) {
  if ((!showChips || chips.length === 0) && !onClear) return null
  return (
    <div className="filter-row">
      {showChips && chips.length > 0 && (
        <>
          <span className="muted small">Filtros avançados:</span>
          {chips.map((chip) => (
            <span key={chip.label} className="filter-chip filter-chip-on">
              <button type="button" className="filter-chip-main" onClick={onOpen}>
                {chip.label}
              </button>
              <button type="button" className="filter-chip-remove" aria-label={`Remover filtro ${chip.label}`} onClick={chip.clear}>
                ×
              </button>
            </span>
          ))}
        </>
      )}
      {onClear && (
        <button type="button" className="link-button filter-row-end" onClick={onClear}>
          Limpar filtros
        </button>
      )}
    </div>
  )
}

// ---------- ordering by a clicked column (as in the other lists; asked by the user on 25/11/2026) ----------
// Every list here comes whole from the API, so it is ordered in the browser. No column = the API's order.

const byText = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true })

/** Holder codes by letters, then number: C1, C01, C2… A1 (as the API orders them). */
function byHolderCode(a: string, b: string): number {
  const letters = (code: string) => code.replace(/\d+$/, '')
  const number = (code: string) => Number(code.replace(/^\D+/, '')) || 0
  return byText(letters(a), letters(b)) || number(a) - number(b) || a.localeCompare(b)
}

/** A value that may be missing: missing ones always go last, whichever the direction. */
function compareOptional<T>(a: T | null, b: T | null, compare: (a: T, b: T) => number, ascending: boolean): number {
  if (a === null || b === null || a === '' || b === '') {
    const aMissing = a === null || a === ''
    const bMissing = b === null || b === ''
    return aMissing === bMissing ? 0 : aMissing ? 1 : -1
  }
  return ascending ? compare(a, b) : compare(b, a)
}

function sortRows<T, F extends string>(
  rows: T[],
  sort: SortState<F> | null,
  compare: (a: T, b: T, field: F, ascending: boolean) => number,
): T[] {
  if (!sort) return rows
  return [...rows].sort((a, b) => compare(a, b, sort.field, sort.ascending))
}

type BalanceSortField =
  | 'HOLDER'
  | 'BANK'
  | 'ACCOUNT'
  | 'IMPORTED'
  | 'NO_MOVEMENT'
  | 'STATEMENT'
  | 'LEDGER'
  | 'DIFFERENCE'
  | 'STATUS'

/** Status ascending reads as the summary: divergent, pending, OK, no movement. Ties keep the holder order. */
function compareBalances(a: HolderBalance, b: HolderBalance, field: BalanceSortField, ascending: boolean): number {
  const sign = ascending ? 1 : -1
  const byNumber = (x: number, y: number) => x - y
  const result = (() => {
    switch (field) {
      case 'HOLDER':
        return sign * byHolderCode(a.holder.code, b.holder.code)
      case 'BANK':
        return compareOptional(a.holder.bank, b.holder.bank, byText, ascending)
      case 'ACCOUNT':
        return compareOptional(a.holder.account, b.holder.account, byText, ascending)
      case 'IMPORTED':
        return sign * (Number(b.imported) - Number(a.imported))
      case 'NO_MOVEMENT':
        return sign * (Number(b.noMovement) - Number(a.noMovement))
      case 'STATEMENT':
        return compareOptional(a.statementBalance, b.statementBalance, byNumber, ascending)
      case 'LEDGER':
        return compareOptional(a.ledgerBalance, b.ledgerBalance, byNumber, ascending)
      case 'DIFFERENCE':
        return compareOptional(a.difference, b.difference, byNumber, ascending)
      case 'STATUS':
        return sign * (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
    }
  })()
  return result || byHolderCode(a.holder.code, b.holder.code)
}

type HolderSortField = 'CODE' | 'DESCRIPTION' | 'BANK' | 'ACCOUNT' | 'TYPE' | 'STATUS'

/** Type ascending: checking accounts, then investments; status ascending: active first. */
function compareHolders(a: BankHolder, b: BankHolder, field: HolderSortField, ascending: boolean): number {
  const sign = ascending ? 1 : -1
  const result = (() => {
    switch (field) {
      case 'CODE':
        return sign * byHolderCode(a.code, b.code)
      case 'DESCRIPTION':
        return sign * byText(a.description, b.description)
      case 'BANK':
        return compareOptional(a.bank, b.bank, byText, ascending)
      case 'ACCOUNT':
        return compareOptional(a.account, b.account, byText, ascending)
      case 'TYPE':
        return sign * (Number(a.type === 'INVESTMENT') - Number(b.type === 'INVESTMENT'))
      case 'STATUS':
        return sign * (Number(!a.active) - Number(!b.active))
    }
  })()
  return result || byHolderCode(a.code, b.code)
}

type ClosingCompanySortField = 'ROOT' | 'HEAD_OFFICE' | 'UNITS' | 'NAME' | 'STATUS'

/** Name: roots outside the control (no name) go last; status ascending: active, inactive, outside the control. */
function compareClosingCompanies(
  a: ClosingCompanyOption,
  b: ClosingCompanyOption,
  field: ClosingCompanySortField,
  ascending: boolean,
): number {
  const sign = ascending ? 1 : -1
  const statusRank = (option: ClosingCompanyOption) => (option.id === null ? 2 : option.active ? 0 : 1)
  const result = (() => {
    switch (field) {
      case 'ROOT':
        return sign * a.cnpjRoot.localeCompare(b.cnpjRoot)
      case 'HEAD_OFFICE':
        return sign * byText(a.headOfficeName, b.headOfficeName)
      case 'UNITS':
        return sign * (a.unitCount - b.unitCount)
      case 'NAME':
        return compareOptional(a.name, b.name, byText, ascending)
      case 'STATUS':
        return sign * (statusRank(a) - statusRank(b))
    }
  })()
  return result || byText(a.headOfficeName, b.headOfficeName)
}

/** "Pendentes e divergentes" is the panel's default: what still needs attention. */
type StatusFilter = 'OPEN' | 'ALL' | BalanceStatus

function countByStatus(rows: HolderBalance[]): Record<BalanceStatus, number> {
  const counts: Record<BalanceStatus, number> = { PENDING: 0, DIVERGENT: 0, OK: 0, NO_MOVEMENT: 0 }
  rows.forEach((row) => counts[row.status]++)
  return counts
}

const COUNT_LABELS: Record<BalanceStatus, [string, string]> = {
  DIVERGENT: ['divergente', 'divergentes'],
  PENDING: ['pendente', 'pendentes'],
  OK: ['OK', 'OK'],
  NO_MOVEMENT: ['sem movimento', 'sem movimento'],
}

function countLabel(status: BalanceStatus, count: number): string {
  return `${count} ${COUNT_LABELS[status][count === 1 ? 0 : 1]}`
}

/** Cents, to add money without floating-point drift. */
const cents = (value: number | null) => (value === null ? 0 : Math.round(value * 100))

function Money({ cents: value }: { cents: number }) {
  return <strong className={value < 0 ? 'negative' : undefined}>{formatMoney(value / 100)}</strong>
}

/**
 * Totals of the checking accounts on screen (asked by the user on 25/11/2026: investments are not added, and the
 * totals follow the filters): statement, ledger and the sum of the differences. A balance not filled in counts as
 * zero; a row missing either balance has no difference.
 */
function BalanceTotals({ rows }: { rows: HolderBalance[] }) {
  const statement = rows.reduce((sum, row) => sum + cents(row.statementBalance), 0)
  const ledger = rows.reduce((sum, row) => sum + cents(row.ledgerBalance), 0)
  const difference = rows.reduce((sum, row) => sum + cents(row.difference), 0)
  return (
    <dl className="closing-totals" aria-label="Totais das contas correntes mostradas">
      <div className="closing-totals-caption">
        <dt>Contas correntes</dt>
        <dd>
          {rows.length} {rows.length === 1 ? 'mostrada' : 'mostradas'}
        </dd>
      </div>
      <div>
        <dt>Saldo extrato</dt>
        <dd>
          <Money cents={statement} />
        </dd>
      </div>
      <div>
        <dt>Saldo contábil</dt>
        <dd>
          <Money cents={ledger} />
        </dd>
      </div>
      <div title="Soma das diferenças dos portadores com os dois saldos preenchidos">
        <dt>Diferença</dt>
        <dd className={difference !== 0 ? 'closing-difference' : undefined}>
          <Money cents={difference} />
        </dd>
      </div>
    </dl>
  )
}

function StatusCounts({ rows }: { rows: HolderBalance[] }) {
  const counts = countByStatus(rows)
  return (
    <span className="closing-counts">
      {STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => (
        <span key={status} className={`badge ${BALANCE_STATUS_BADGES[status]}`}>
          {countLabel(status, counts[status])}
        </span>
      ))}
    </span>
  )
}

/** The balances of the bank holders (the balance task), in their own tab, for the month and company chosen on screen. */
function BalancePanel({ period, canImport }: { period: Period; canImport: boolean }) {
  const [importing, setImporting] = useState(false)
  const { competence } = period
  const companyId = period.companyId ?? 0
  const valid = validPeriod(period) && period.companyId !== null
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN')
  const [holderFilter, setHolderFilter] = useState<HolderFilter>(EMPTY_HOLDER_FILTER)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [sort, setSort] = useState<SortState<BalanceSortField> | null>(null)
  const [rows, setRows] = useState<HolderBalance[]>([])
  /** Rows edited on screen stay visible under "Pendentes e divergentes", so a row doesn't vanish while being checked. */
  const [touched, setTouched] = useState<Set<number>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  const balances = useLoad(
    () => (valid ? closingApi.balances(companyId, competence) : Promise.resolve([])),
    [companyId, competence],
  )

  // A new load (another month or company) replaces the rows edited on screen.
  const [loaded, setLoaded] = useState(balances.data)
  if (balances.data !== loaded) {
    setLoaded(balances.data)
    if (balances.data) {
      setRows(balances.data)
      setTouched(new Set())
    }
  }

  async function save(row: HolderBalance, change: Partial<HolderBalance>) {
    const next = { ...row, ...change }
    const replace = (value: HolderBalance) =>
      setRows((current) => current.map((item) => (item.holder.id === row.holder.id ? value : item)))
    // Shown at once; the server's answer brings the difference and the status, or the row goes back if refused.
    replace(next)
    setSaveError(null)
    try {
      const saved = await closingApi.saveBalance({
        holderId: row.holder.id,
        companyId,
        competence,
        imported: next.imported,
        noMovement: next.noMovement,
        statementBalance: next.statementBalance,
        ledgerBalance: next.ledgerBalance,
        note: next.note?.trim() ? next.note.trim() : null,
      })
      replace(saved)
      setTouched((current) => new Set(current).add(row.holder.id))
    } catch (caught) {
      replace(row)
      setSaveError(`${row.holder.code}: ${errorMessage(caught)}`)
    }
  }

  const statusMatches = (row: HolderBalance) =>
    statusFilter === 'ALL' ||
    (statusFilter === 'OPEN' ? OPEN_STATUSES.has(row.status) || touched.has(row.holder.id) : row.status === statusFilter)
  const visible = rows.filter((row) => statusMatches(row) && matchesHolder(row.holder, holderFilter))
  const advancedChips = holderFilterChips(holderFilter, setHolderFilter, ['holder', 'bank', 'account'])
  const filtering = statusFilter !== 'OPEN' || advancedChips.length > 0
  const groups: { type: HolderType; title: string }[] = [
    { type: 'CHECKING', title: 'Contas correntes' },
    { type: 'INVESTMENT', title: 'Aplicações' },
  ]

  return (
    <>
      <div className={`card filters filters-closing${canImport ? ' filters-closing-import' : ''}`}>
        <PeriodFields period={period} />
        <Field label="Status">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="OPEN">Pendentes e divergentes</option>
            <option value="ALL">Todos</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {BALANCE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
        <AdvancedToggle open={advancedOpen} inUse={advancedChips.length > 0} onToggle={() => setAdvancedOpen(!advancedOpen)} />
        {canImport && (
          <button type="button" className="button closing-import-button" onClick={() => setImporting(true)}>
            Importar CSV
          </button>
        )}
        <FilterRow
          chips={advancedChips}
          showChips={!advancedOpen}
          onOpen={() => setAdvancedOpen(true)}
          onClear={
            filtering
              ? () => {
                  setStatusFilter('OPEN')
                  setHolderFilter(EMPTY_HOLDER_FILTER)
                }
              : undefined
          }
        />
        {advancedOpen && (
          <div className="filters-advanced filters-advanced-holders">
            <HolderFilterFields
              filter={holderFilter}
              banks={bankOptions(rows.map((row) => row.holder))}
              onChange={setHolderFilter}
            />
          </div>
        )}
      </div>
      <PeriodWarnings period={period} />
      <ErrorBanner message={saveError ?? balances.error} onRetry={balances.error ? balances.reload : undefined} />
      {balances.loading && rows.length === 0 && <Loading />}
      {rows.length > 0 && (
        <div className="closing-summary card">
          <div>
            <strong>{rows.length}</strong> {rows.length === 1 ? 'portador' : 'portadores'} no mês
          </div>
          <BalanceTotals rows={visible.filter((row) => row.holder.type === 'CHECKING')} />
          <StatusCounts rows={rows} />
        </div>
      )}
      {!balances.loading && balances.data && rows.length === 0 && valid && (
        <p className="muted">Nenhum portador vinculado a esta empresa.</p>
      )}
      {groups.map((group) => {
        const all = rows.filter((row) => row.holder.type === group.type)
        if (all.length === 0) return null
        return (
          <BalanceGroup
            key={group.type}
            title={group.title}
            all={all}
            shown={sortRows(
              visible.filter((row) => row.holder.type === group.type),
              sort,
              compareBalances,
            )}
            sort={sort}
            onSort={setSort}
            emptyText={filtering ? 'Nenhum portador deste grupo com estes filtros.' : 'Nada pendente ou divergente neste grupo.'}
            onSave={save}
          />
        )
      })}
      {importing && (
        <Modal title="Importar CSV" onClose={() => setImporting(false)}>
          <ImportSection
            firstCompetence={period.firstCompetence}
            initialCompetence={period.competence}
            onImported={balances.reload}
          />
        </Modal>
      )}
    </>
  )
}

interface BalanceGroupProps {
  title: string
  all: HolderBalance[]
  shown: HolderBalance[]
  emptyText: string
  onSave: (row: HolderBalance, change: Partial<HolderBalance>) => void
  /** Shared by both groups: one click orders checking accounts and investments the same way. */
  sort: SortState<BalanceSortField> | null
  onSort: (sort: SortState<BalanceSortField> | null) => void
}

function BalanceGroup({ title, all, shown, emptyText, onSave, sort, onSort }: BalanceGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <section className="card closing-group">
      <button type="button" className="closing-group-header" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="closing-group-caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <h2>{title}</h2>
        <span className="muted">{all.length}</span>
        <StatusCounts rows={all} />
      </button>
      {open && (
        <div className="table-wrapper">
          <table className="closing-table">
            <thead>
              <tr>
                <SortableHeader label="Portador" field="HOLDER" sort={sort} onSort={onSort} />
                <SortableHeader label="Banco" field="BANK" sort={sort} onSort={onSort} />
                <SortableHeader label="Conta" field="ACCOUNT" sort={sort} onSort={onSort} />
                <SortableHeader label="Importado" field="IMPORTED" sort={sort} onSort={onSort} className="center" />
                <SortableHeader label="Sem mov." field="NO_MOVEMENT" sort={sort} onSort={onSort} className="center" />
                <SortableHeader label="Saldo extrato" field="STATEMENT" sort={sort} onSort={onSort} className="number" />
                <SortableHeader label="Saldo contábil" field="LEDGER" sort={sort} onSort={onSort} className="number" />
                <SortableHeader label="Diferença" field="DIFFERENCE" sort={sort} onSort={onSort} className="number" />
                <SortableHeader label="Status" field="STATUS" sort={sort} onSort={onSort} />
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <BalanceLine key={row.holder.id} row={row} onSave={onSave} />
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted empty-row">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function BalanceLine({ row, onSave }: { row: HolderBalance; onSave: (row: HolderBalance, change: Partial<HolderBalance>) => void }) {
  const [note, setNote] = useState(row.note ?? '')
  const [lastNote, setLastNote] = useState(row.note)
  if (row.note !== lastNote) {
    setLastNote(row.note)
    setNote(row.note ?? '')
  }
  const { holder } = row
  // Bank and account have their own columns; the description only shows when it says something else.
  const repeated = normalize(holder.description) === normalize([holder.bank, holder.account].filter(Boolean).join(' '))
  const disabled = row.noMovement

  return (
    <tr className={`closing-row closing-row-${row.status.toLowerCase()}`}>
      <td>
        <span className="closing-code">{holder.code}</span>
        {!repeated && <span className="muted closing-holder-details">{holder.description}</span>}
      </td>
      <td className="nowrap">{holder.bank ?? <span className="muted">—</span>}</td>
      <td className="nowrap">{holder.account ?? <span className="muted">—</span>}</td>
      <td className="center">
        <input
          type="checkbox"
          aria-label={`${holder.code}: extrato importado`}
          checked={row.imported}
          disabled={disabled}
          onChange={(e) => onSave(row, { imported: e.target.checked })}
        />
      </td>
      <td className="center">
        <input
          type="checkbox"
          aria-label={`${holder.code}: sem movimento`}
          checked={row.noMovement}
          onChange={(e) => onSave(row, { noMovement: e.target.checked })}
        />
      </td>
      <td className="number">
        <SignedMoneyInput
          aria-label={`${holder.code}: saldo do extrato`}
          value={row.statementBalance}
          disabled={disabled}
          onCommit={(value) => onSave(row, { statementBalance: value })}
        />
      </td>
      <td className="number">
        <SignedMoneyInput
          aria-label={`${holder.code}: saldo contábil`}
          value={row.ledgerBalance}
          disabled={disabled}
          onCommit={(value) => onSave(row, { ledgerBalance: value })}
        />
      </td>
      <td className={`number nowrap${row.difference ? ' closing-difference' : ''}`}>
        {row.difference === null ? <span className="muted">—</span> : formatMoney(row.difference)}
      </td>
      <td>
        <span
          className={`badge ${BALANCE_STATUS_BADGES[row.status]}`}
          title={row.updatedBy && row.updatedAt ? `Alterado por ${row.updatedBy} em ${formatDateTime(row.updatedAt)}` : undefined}
        >
          {BALANCE_STATUS_LABELS[row.status]}
        </span>
      </td>
      <td>
        <input
          className="closing-note"
          aria-label={`${holder.code}: observação`}
          maxLength={500}
          value={note}
          placeholder="—"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note.trim() !== (row.note ?? '') && onSave(row, { note })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </td>
    </tr>
  )
}

// ---------- holders (administrator) ----------

function HoldersSection() {
  const dialogs = useDialogs()
  const holders = useLoad(() => closingApi.holders(), [])
  const companies = useLoad(() => closingApi.companyOptions(), [])
  const [editing, setEditing] = useState<BankHolder | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Portador and Status in sight; Banco and Conta under "Filtros avançados".
  const [filter, setFilter] = useState<HolderFilter>(EMPTY_HOLDER_FILTER)
  const [activeFilter, setActiveFilter] = useState<'' | 'active' | 'inactive'>('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const advancedChips = holderFilterChips(filter, setFilter, ['bank', 'account'])
  const filtering = filter.holder.trim() !== '' || advancedChips.length > 0 || activeFilter !== ''
  const [sort, setSort] = useState<SortState<HolderSortField> | null>(null)
  const shown = sortRows(
    (holders.data ?? []).filter(
      (holder) => matchesHolder(holder, filter) && (activeFilter === '' || holder.active === (activeFilter === 'active')),
    ),
    sort,
    compareHolders,
  )

  const closingCompanies = useMemo(
    () => (companies.data ?? []).filter((option) => option.id !== null) as (ClosingCompanyOption & { id: number })[],
    [companies.data],
  )
  const companyName = (id: number) => closingCompanies.find((company) => company.id === id)?.name ?? `#${id}`

  async function remove(holder: BankHolder) {
    if (!(await dialogs.confirm({ title: 'Excluir portador', message: holder.code, confirmLabel: 'Excluir', danger: true }))) return
    setError(null)
    try {
      await closingApi.deleteHolder(holder.id)
      holders.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <ErrorBanner message={error ?? holders.error ?? companies.error} onRetry={holders.error ? holders.reload : undefined} />
      {holders.loading && !holders.data && <Loading />}
      {holders.data && (
        <div className="card filters filters-holders">
          <HolderFilterFields filter={filter} banks={bankOptions(holders.data)} onChange={setFilter} fields={['holder']} />
          <Field label="Status" group>
            <Segmented
              label="Status"
              options={[
                { value: '', label: 'Todos' },
                { value: 'active', label: 'Ativo' },
                { value: 'inactive', label: 'Inativo' },
              ]}
              value={activeFilter}
              onChange={setActiveFilter}
            />
          </Field>
          <AdvancedToggle open={advancedOpen} inUse={advancedChips.length > 0} onToggle={() => setAdvancedOpen(!advancedOpen)} />
          <button type="button" className="button button-primary closing-import-button" onClick={() => setEditing('new')}>
            Novo portador
          </button>
          <FilterRow
            chips={advancedChips}
            showChips={!advancedOpen}
            onOpen={() => setAdvancedOpen(true)}
            onClear={
              filtering
                ? () => {
                    setFilter(EMPTY_HOLDER_FILTER)
                    setActiveFilter('')
                  }
                : undefined
            }
          />
          {advancedOpen && (
            <div className="filters-advanced filters-advanced-holders">
              <HolderFilterFields filter={filter} banks={bankOptions(holders.data)} onChange={setFilter} fields={['bank', 'account']} />
            </div>
          )}
        </div>
      )}
      {holders.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <SortableHeader label="Código" field="CODE" sort={sort} onSort={setSort} />
                <SortableHeader label="Descrição" field="DESCRIPTION" sort={sort} onSort={setSort} />
                <SortableHeader label="Banco" field="BANK" sort={sort} onSort={setSort} />
                <SortableHeader label="Conta" field="ACCOUNT" sort={sort} onSort={setSort} />
                <SortableHeader label="Tipo" field="TYPE" sort={sort} onSort={setSort} />
                <th>Empresas</th>
                <SortableHeader label="Status" field="STATUS" sort={sort} onSort={setSort} />
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {shown.map((holder) => (
                <tr key={holder.id}>
                  <td className="closing-code">{holder.code}</td>
                  <td>{holder.description}</td>
                  <td>{holder.bank ?? <span className="muted">—</span>}</td>
                  <td className="nowrap">{holder.account ?? <span className="muted">—</span>}</td>
                  <td className="nowrap">{HOLDER_TYPE_LABELS[holder.type]}</td>
                  <td>{holder.companyIds.map(companyName).join(', ') || <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge ${holder.active ? 'badge-paid' : 'badge-archived'}`}>
                      {holder.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <IconButton label={`Editar ${holder.code}`} onClick={() => setEditing(holder)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton label={`Excluir ${holder.code}`} onClick={() => remove(holder)} danger>
                      <DeleteIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted empty-row">
                    {filtering
                      ? 'Nenhum portador encontrado com estes filtros.'
                      : 'Nenhum portador cadastrado. Cadastre aqui ou importe um CSV.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <HolderForm
          holder={editing === 'new' ? null : editing}
          companies={closingCompanies}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            holders.reload()
          }}
        />
      )}
    </>
  )
}

interface HolderFormProps {
  holder: BankHolder | null
  companies: { id: number; name: string | null }[]
  onClose: () => void
  onSaved: () => void
}

function HolderForm({ holder, companies, onClose, onSaved }: HolderFormProps) {
  const [form, setForm] = useState<BankHolderInput>(() => ({
    code: holder?.code ?? '',
    description: holder?.description ?? '',
    bank: holder?.bank ?? '',
    account: holder?.account ?? '',
    type: holder?.type ?? 'CHECKING',
    active: holder?.active ?? true,
    companyIds: holder?.companyIds ?? [],
  }))
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setErrors({})
    const input = { ...form, bank: form.bank?.trim() || null, account: form.account?.trim() || null }
    try {
      if (holder) await closingApi.updateHolder(holder.id, input)
      else await closingApi.createHolder(input)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={holder ? `Editar portador ${holder.code}` : 'Novo portador'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <div className="form-row">
          <Field label="Código" error={errors.code}>
            <input
              required
              maxLength={7}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            />
          </Field>
          <Field label="Tipo" group>
            <Segmented
              label="Tipo"
              options={[
                { value: 'CHECKING', label: 'Conta corrente' },
                { value: 'INVESTMENT', label: 'Aplicação' },
              ]}
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
            />
          </Field>
        </div>
        <Field label="Descrição" error={errors.description}>
          <input required maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Banco" error={errors.bank}>
            <input maxLength={100} value={form.bank ?? ''} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          </Field>
          <Field label="Conta" error={errors.account}>
            <input maxLength={60} value={form.account ?? ''} onChange={(e) => setForm({ ...form, account: e.target.value })} />
          </Field>
        </div>
        <Field label="Empresas em que é conferido" group>
          <CheckboxList
            options={companies.map((company) => ({ value: String(company.id), label: company.name ?? '' }))}
            selected={form.companyIds.map(String)}
            onChange={(selected) => setForm({ ...form, companyIds: selected.map(Number) })}
            emptyText="Nenhuma empresa do fechamento cadastrada."
            selectAllText="Marcar todas"
            clearAllText="Desmarcar todas"
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Ativo
        </label>
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- closing companies and access (administrator) ----------

interface CompaniesSectionProps {
  accountingAccess: boolean
  phaseDependency: PhaseDependency
  onAccessChanged: () => void
}

function CompaniesSection({ accountingAccess, phaseDependency, onAccessChanged }: CompaniesSectionProps) {
  const options = useLoad(() => closingApi.companyOptions(), [])
  const [sort, setSort] = useState<SortState<ClosingCompanySortField> | null>(null)
  const [editing, setEditing] = useState<ClosingCompanyOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The choice shown at once, until the reloaded setting arrives. */
  const [pending, setPending] = useState<boolean | null>(null)
  const checked = pending ?? accountingAccess

  const [dependency, setDependency] = useState(phaseDependency)

  async function changeDependency(mode: PhaseDependency) {
    setError(null)
    setDependency(mode)
    try {
      await closingApi.setPhaseDependency(mode)
      onAccessChanged()
    } catch (caught) {
      setError(errorMessage(caught))
      setDependency(phaseDependency)
    }
  }

  async function toggleAccess(enabled: boolean) {
    setError(null)
    setPending(enabled)
    try {
      await closingApi.setAccountingAccess(enabled)
      onAccessChanged()
    } catch (caught) {
      setError(errorMessage(caught))
      setPending(null)
    }
  }

  return (
    <>
      <div className="card closing-access">
        <label className="checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => toggleAccess(e.target.checked)} />
          Liberar o Controle contábil para o perfil Contábil
        </label>
        <Field label="Concluir uma tarefa com a fase anterior aberta" className="closing-dependency">
          <select value={dependency} onChange={(e) => changeDependency(e.target.value as PhaseDependency)}>
            <option value="WARN">Avisar e permitir</option>
            <option value="BLOCK">Bloquear</option>
          </select>
        </Field>
      </div>
      <ErrorBanner message={error ?? options.error} onRetry={options.error ? options.reload : undefined} />
      {options.loading && !options.data && <Loading />}
      {options.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <SortableHeader label="Raiz do CNPJ" field="ROOT" sort={sort} onSort={setSort} />
                <SortableHeader label="Matriz no cadastro" field="HEAD_OFFICE" sort={sort} onSort={setSort} />
                <SortableHeader label="Unidades" field="UNITS" sort={sort} onSort={setSort} />
                <SortableHeader label="Nome no fechamento" field="NAME" sort={sort} onSort={setSort} />
                <SortableHeader label="Status" field="STATUS" sort={sort} onSort={setSort} />
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {sortRows(options.data, sort, compareClosingCompanies).map((option) => (
                <tr key={option.cnpjRoot}>
                  <td className="nowrap">{formatCnpjRoot(option.cnpjRoot)}</td>
                  <td>{option.headOfficeName}</td>
                  <td>{option.unitCount}</td>
                  <td>{option.name ?? <span className="muted">fora do controle</span>}</td>
                  <td>
                    {option.id !== null && (
                      <span className={`badge ${option.active ? 'badge-paid' : 'badge-archived'}`}>
                        {option.active ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </td>
                  <td className="row-actions">
                    <IconButton label={`Editar ${option.headOfficeName}`} onClick={() => setEditing(option)}>
                      <EditIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ClosingCompanyForm
          option={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            options.reload()
          }}
        />
      )}
    </>
  )
}

function ClosingCompanyForm({ option, onClose, onSaved }: { option: ClosingCompanyOption; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(option.name ?? '')
  const [active, setActive] = useState(option.id === null ? true : option.active)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await closingApi.saveCompany(option.cnpjRoot, name.trim(), active)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Empresa do fechamento · ${formatCnpjRoot(option.cnpjRoot)}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <p className="muted">
          Matriz no cadastro: {option.headOfficeName} ({option.unitCount} {option.unitCount === 1 ? 'unidade' : 'unidades'})
        </p>
        <Field label="Nome no fechamento">
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativa no controle
        </label>
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- task catalog: which companies do each task (administrator) ----------

function CatalogSection() {
  const templates = useLoad(() => closingApi.taskTemplates(), [])
  const companies = useLoad(() => closingApi.companyOptions(), [])
  const [editing, setEditing] = useState<TaskTemplate | null>(null)
  const closingCompanies = (companies.data ?? []).filter((option) => option.id !== null) as (ClosingCompanyOption & { id: number })[]
  const companyName = (id: number) => closingCompanies.find((company) => company.id === id)?.name ?? `#${id}`

  return (
    <>
      <ErrorBanner message={templates.error ?? companies.error} onRetry={templates.error ? templates.reload : undefined} />
      {templates.loading && !templates.data && <Loading />}
      {templates.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Tarefa</th>
                <th>Fase</th>
                <th>Empresas</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {templates.data.map((template) => (
                <tr key={template.id}>
                  <td className="closing-code">{template.code}</td>
                  <td>{template.name}</td>
                  <td>{template.phase}</td>
                  <td>{template.appliesToAll ? 'Todas' : template.companyIds.map(companyName).join(', ')}</td>
                  <td className="row-actions">
                    <IconButton label={`Editar ${template.code}`} onClick={() => setEditing(template)}>
                      <EditIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <TemplateCompaniesForm
          template={editing}
          companies={closingCompanies}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            templates.reload()
          }}
        />
      )}
    </>
  )
}

interface TemplateCompaniesFormProps {
  template: TaskTemplate
  companies: { id: number; name: string | null }[]
  onClose: () => void
  onSaved: () => void
}

function TemplateCompaniesForm({ template, companies, onClose, onSaved }: TemplateCompaniesFormProps) {
  const [all, setAll] = useState(template.appliesToAll)
  const [selected, setSelected] = useState(template.companyIds.map(String))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await closingApi.setTaskCompanies(template.id, all, all ? [] : selected.map(Number))
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`${template.code} ${template.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <label className="checkbox">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Todas as empresas
        </label>
        {!all && (
          <Field label="Empresas" group>
            <CheckboxList
              options={companies.map((company) => ({ value: String(company.id), label: company.name ?? '' }))}
              selected={selected}
              onChange={setSelected}
              emptyText="Nenhuma empresa do fechamento cadastrada."
              selectAllText="Marcar todas"
              clearAllText="Desmarcar todas"
            />
          </Field>
        )}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- CSV import (administrator) ----------

interface ImportSectionProps {
  firstCompetence: string
  /** The month on screen, suggested for the file. */
  initialCompetence: string
  /** Reloads the balances on screen after a successful import. */
  onImported: () => void
}

function ImportSection({ firstCompetence, initialCompetence, onImported }: ImportSectionProps) {
  const [competence, setCompetence] = useState(() => initialCompetence || defaultCompetence(firstCompetence))
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    setReport(null)
    try {
      setReport(await closingApi.importCsv(competence, csv))
      onImported()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="closing-import">
      <form className="card form" onSubmit={submit}>
        <p className="muted">
          Uma linha por portador e empresa, separada por ponto e vírgula:{' '}
          <code>empresa;codigo_portador;banco;conta;importado;saldo_extrato;saldo_contabil;observacao</code>. A empresa é
          o nome no fechamento; importado é <code>sim</code> ou <code>nao</code>; valores como <code>1.234,56</code> ou{' '}
          <code>-0,02</code>. Portador novo é cadastrado como conta corrente. Se alguma linha tiver erro, nada é gravado.
        </p>
        <div className="form-row">
          <Field label="Competência">
            <MonthInput value={competence} onChange={setCompetence} required label="Competência" />
          </Field>
          <Field label="Arquivo CSV" hint={fileName ? undefined : 'Ou cole o conteúdo abaixo'}>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setFileName(file.name)
                setCsv(await file.text())
              }}
            />
          </Field>
        </div>
        <Field label="Conteúdo">
          <textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} spellCheck={false} className="closing-csv" />
        </Field>
        <ErrorBanner message={error} />
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={sending || !csv.trim() || !competence}>
            {sending ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </form>
      {report && (
        <div className="card closing-report" role="status">
          <h2>Importação concluída</h2>
          <ul>
            <li>
              {report.balancesSaved} {report.balancesSaved === 1 ? 'saldo gravado' : 'saldos gravados'} ({report.linesRead} linhas lidas)
            </li>
            <li>
              {report.holdersCreated.length === 0
                ? 'Nenhum portador novo'
                : `Portadores cadastrados: ${report.holdersCreated.join(', ')}`}
            </li>
            {report.ignored.map((line) => (
              <li key={line.line} className="muted">
                Linha {line.line} ignorada: {line.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

