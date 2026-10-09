import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { companiesApi, installmentPlansApi } from '../api/endpoints'
import type {
  BrazilianState,
  Company,
  InstallmentOrigin,
  InstallmentPlan,
  InstallmentPlanFilters,
  InstallmentStatus,
  Page,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { DeleteIcon, EditIcon, IconButton, PlusIcon } from '../components/icons'
import { MultiSelect } from '../components/MultiSelect'
import { SearchableSelect } from '../components/SearchableSelect'
import { ErrorBanner, Field, Loading, Modal, Segmented } from '../components/ui'
import { INSTALLMENT_STATUS_LABELS, ORIGIN_LABELS, STATE_LABELS } from '../lib/format'
import { onlyDigits } from '../lib/text'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 20

const EMPTY_FILTERS: InstallmentPlanFilters = {
  companyIds: null,
  number: '',
  cigamNumber: '',
  status: null,
}

export function InstallmentPlansPage() {
  const { canManageInstallmentPlans } = useAuth()
  const [filters, setFilters] = useState<InstallmentPlanFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  // Typed freely; only applied to the filter after a short pause, so each keystroke doesn't fire a request.
  const [numberInput, setNumberInput] = useState('')
  const [cigamInput, setCigamInput] = useState('')
  const companies = useLoad(() => companiesApi.list(), [])
  // A multi-value filter with every option unchecked matches nothing: no need to ask the server.
  const nothingSelected = filters.companyIds?.length === 0
  const plans = useLoad(
    () =>
      nothingSelected
        ? Promise.resolve<Page<InstallmentPlan>>({ items: [], page: 0, size: PAGE_SIZE, totalItems: 0, totalPages: 0 })
        : installmentPlansApi.search(filters, page, PAGE_SIZE),
    [filters, page],
  )
  // How many of the listed plans are active, for the subtitle; only needed while the status filter shows all.
  const activeCount = useLoad(
    () =>
      nothingSelected || filters.status !== null
        ? Promise.resolve(null)
        : installmentPlansApi.search({ ...filters, status: 'ACTIVE' }, 0, 1).then((result) => result.totalItems),
    [filters],
  )
  /** `null` = closed, `'new'` = creating, otherwise the plan being edited. */
  const [editing, setEditing] = useState<InstallmentPlan | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setFilter<K extends keyof InstallmentPlanFilters>(name: K, value: InstallmentPlanFilters[K]) {
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(0)
  }

  useEffect(() => {
    const timeout = setTimeout(() => setFilter('number', numberInput), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberInput])

  useEffect(() => {
    const timeout = setTimeout(() => setFilter('cigamNumber', cigamInput), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cigamInput])

  async function remove(plan: InstallmentPlan) {
    if (!window.confirm(`Excluir o ${plan.subject}?`)) return
    setError(null)
    try {
      await installmentPlansApi.remove(plan.id)
      // Removing the last row of a page would leave it empty: step back one page.
      if (plans.data?.items.length === 1 && page > 0) setPage(page - 1)
      else plans.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const hasFilters = filters.companyIds !== null || filters.number !== '' || filters.cigamNumber !== '' || filters.status !== null

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Parcelamentos</h1>
          <div className="page-subtitle">{plans.data ? planCount(plans.data.totalItems, activeCount.data) : '\u00a0'}</div>
        </div>
        {canManageInstallmentPlans && (
          <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
            <PlusIcon />
            Novo parcelamento
          </button>
        )}
      </div>

      <div className="card filters filters-plans">
        <Field label="Empresa" group className="filter-wide">
          <MultiSelect
            label="Empresa"
            options={(companies.data ?? []).map((company) => ({ value: String(company.id), label: company.label }))}
            selected={filters.companyIds}
            onChange={(values) => setFilter('companyIds', values)}
            allText="Todas"
            noneText="Nenhuma"
            countText={(count) => `${count} empresas`}
          />
        </Field>
        <Field label="Número">
          <input
            inputMode="numeric"
            maxLength={30}
            value={numberInput}
            onChange={(e) => setNumberInput(onlyDigits(e.target.value))}
            placeholder="Completo ou parcial"
          />
        </Field>
        <Field label="Número Cigam">
          <input
            inputMode="numeric"
            maxLength={20}
            value={cigamInput}
            onChange={(e) => setCigamInput(onlyDigits(e.target.value))}
            placeholder="Completo ou parcial"
          />
        </Field>
        <Field label="Status" group className="filter-status">
          <Segmented
            label="Status"
            options={[
              { value: '', label: 'Todos' },
              { value: 'ACTIVE', label: 'Ativos' },
              { value: 'RESCINDED', label: 'Rescindidos' },
              { value: 'SETTLED', label: 'Liquidados' },
            ]}
            value={filters.status ?? ''}
            onChange={(value) => setFilter('status', value === '' ? null : value)}
          />
        </Field>
        {hasFilters && (
          <button
            type="button"
            className="link-button filter-row filter-row-end"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              setNumberInput('')
              setCigamInput('')
              setPage(0)
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <ErrorBanner message={error ?? companies.error ?? plans.error} onRetry={plans.error ? plans.reload : undefined} />
      {plans.loading && !plans.data && <Loading />}
      {plans.data && (
        <div>
          <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Origem</th>
                <th>UF</th>
                <th>Empresa</th>
                <th>Número Cigam</th>
                <th>Nº parcelas</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {plans.data.items.map((plan) => (
                <tr key={plan.id}>
                  <td className="cell-title numeric-text">{plan.number}</td>
                  <td>{ORIGIN_LABELS[plan.origin]}</td>
                  <td>{plan.state ?? '—'}</td>
                  <td>{plan.company.name}</td>
                  <td>{plan.cigamNumber}</td>
                  <td>{plan.installmentCount}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGES[plan.status]}`}>{INSTALLMENT_STATUS_LABELS[plan.status]}</span>
                  </td>
                  <td className="row-actions">
                    {canManageInstallmentPlans && (
                      <>
                        <IconButton label={`Editar ${plan.subject}`} onClick={() => setEditing(plan)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton label={`Excluir ${plan.subject}`} onClick={() => remove(plan)} danger>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {plans.data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted empty-row">
                    {nothingSelected ? 'Marque ao menos uma empresa no filtro.' : 'Nenhum parcelamento encontrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="pagination">
            <span className="muted">
              {plans.data.totalItems === 0
                ? 'Nenhum parcelamento'
                : `Mostrando ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + plans.data.items.length} de ${plans.data.totalItems}`}
            </span>
            <button type="button" className="button button-small" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>
              Página {plans.data.totalPages === 0 ? 0 : page + 1} de {plans.data.totalPages}
            </span>
            <button
              type="button"
              className="button button-small"
              disabled={page + 1 >= plans.data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      {editing && (
        <InstallmentPlanForm
          plan={editing === 'new' ? null : editing}
          companies={companies.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            plans.reload()
          }}
        />
      )}
    </>
  )
}

interface InstallmentPlanFormProps {
  plan: InstallmentPlan | null
  companies: Company[]
  onClose: () => void
  onSaved: () => void
}

function InstallmentPlanForm({ plan, companies, onClose, onSaved }: InstallmentPlanFormProps) {
  const [number, setNumber] = useState(plan?.number ?? '')
  const [origin, setOrigin] = useState<InstallmentOrigin | ''>(plan?.origin ?? '')
  const [state, setState] = useState<BrazilianState | ''>(plan?.state ?? '')
  const [cigamNumber, setCigamNumber] = useState(plan?.cigamNumber ?? '')
  const [companyId, setCompanyId] = useState(plan ? String(plan.company.id) : '')
  const [installmentCount, setInstallmentCount] = useState(plan ? String(plan.installmentCount) : '')
  const [status, setStatus] = useState<InstallmentStatus>(plan?.status ?? 'ACTIVE')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    try {
      const input = {
        number,
        origin: origin as InstallmentOrigin,
        state: origin === 'SEFAZ' && state !== '' ? state : null,
        cigamNumber,
        companyId: Number(companyId),
        installmentCount: Number(installmentCount),
        status,
      }
      if (plan) await installmentPlansApi.update(plan.id, input)
      else await installmentPlansApi.create(input)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={plan ? 'Editar parcelamento' : 'Novo parcelamento'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <Field label="Número" error={errors.number} hint="Só dígitos, até 30. Pontos e traços colados são removidos.">
          <input
            inputMode="numeric"
            maxLength={30}
            value={number}
            onChange={(e) => setNumber(onlyDigits(e.target.value))}
            required
            autoFocus
          />
        </Field>
        <div className="form-row">
          <Field label="Origem" group error={errors.origin}>
            <Segmented
              label="Origem"
              strong
              options={(Object.keys(ORIGIN_LABELS) as InstallmentOrigin[]).map((value) => ({ value, label: ORIGIN_LABELS[value] }))}
              value={origin}
              onChange={(value) => {
                setOrigin(value)
                // Only SEFAZ plans have a UF.
                if (value !== 'SEFAZ') setState('')
              }}
            />
            {/* the buttons can't be `required`: this hidden input makes the browser ask for an origin */}
            <input className="visually-hidden" tabIndex={-1} aria-hidden="true" required value={origin} onChange={() => {}} />
          </Field>
          <Field
            label="UF"
            group
            error={errors.state}
            hint={origin === 'SEFAZ' ? undefined : 'Só para a origem SEFAZ.'}
          >
            <SearchableSelect
              label="UF"
              options={Object.entries(STATE_LABELS).map(([value, label]) => ({ value, label }))}
              value={state}
              onChange={(value) => setState(value as BrazilianState | '')}
              disabled={origin !== 'SEFAZ'}
              required={origin === 'SEFAZ'}
            />
          </Field>
        </div>
        <Field label="Empresa" group error={errors.companyId}>
          <SearchableSelect
            label="Empresa"
            options={companies.map((company) => ({ value: String(company.id), label: company.label }))}
            value={companyId}
            onChange={setCompanyId}
            required
          />
        </Field>
        <div className="form-row">
          <Field label="Número Cigam" error={errors.cigamNumber}>
            <input
              inputMode="numeric"
              maxLength={20}
              value={cigamNumber}
              onChange={(e) => setCigamNumber(onlyDigits(e.target.value))}
              required
            />
          </Field>
          <Field label="Quantidade de parcelas" error={errors.installmentCount}>
            <input
              type="number"
              min="1"
              max="999"
              step="1"
              value={installmentCount}
              onChange={(e) => setInstallmentCount(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Status" group error={errors.status}>
          <Segmented
            label="Status"
            options={(Object.keys(INSTALLMENT_STATUS_LABELS) as InstallmentStatus[]).map((value) => ({
              value,
              label: INSTALLMENT_STATUS_LABELS[value],
            }))}
            value={status}
            onChange={setStatus}
          />
        </Field>
        {number && (
          <div className="subject-preview">
            Assunto das guias: <strong>{planSubject(number, origin, state)}</strong>
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const STATUS_BADGES: Record<InstallmentStatus, string> = {
  ACTIVE: 'badge-paid',
  RESCINDED: 'badge-overdue',
  SETTLED: 'badge-archived',
}

/** `48 parcelamentos · 41 ativos`; the active part only when the list shows every status. */
function planCount(total: number, active: number | null): string {
  const text = total === 1 ? '1 parcelamento' : `${total} parcelamentos`
  if (active === null) return text
  return `${text} · ${active} ${active === 1 ? 'ativo' : 'ativos'}`
}

/** Same as the server's `InstallmentPlan.subject`: `Parcelamento 123`, or `Parcelamento 123 SP` on SEFAZ. */
function planSubject(number: string, origin: InstallmentOrigin | '', state: BrazilianState | ''): string {
  return origin === 'SEFAZ' && state ? `Parcelamento ${number} ${state}` : `Parcelamento ${number}`
}
