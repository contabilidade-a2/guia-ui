import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { companiesApi, installmentPlansApi } from '../api/endpoints'
import type { BrazilianState, Company, InstallmentOrigin, InstallmentPlan, InstallmentPlanFilters, Page } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { MultiSelect } from '../components/MultiSelect'
import { SearchableSelect } from '../components/SearchableSelect'
import { ErrorBanner, Field, Loading, Modal } from '../components/ui'
import { ORIGIN_LABELS, STATE_LABELS } from '../lib/format'
import { onlyDigits } from '../lib/text'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 20

const EMPTY_FILTERS: InstallmentPlanFilters = {
  companyIds: null,
  number: '',
  cigamNumber: '',
  active: null,
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

  const hasFilters = filters.companyIds !== null || filters.number !== '' || filters.cigamNumber !== '' || filters.active !== null

  return (
    <>
      <div className="page-header">
        <h1>Parcelamentos</h1>
        {canManageInstallmentPlans && (
          <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
            Novo parcelamento
          </button>
        )}
      </div>

      <div className="card filters filters-plans">
        <Field label="Empresa" group className={hasFilters ? 'filter-wide' : 'filter-wider'}>
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
        <Field label="Status">
          <select
            value={filters.active === null ? '' : String(filters.active)}
            onChange={(e) => setFilter('active', e.target.value === '' ? null : e.target.value === 'true')}
          >
            <option value="">Todos</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </Field>
        {hasFilters && (
          <button
            type="button"
            className="button filters-clear"
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
        <div className="card">
          <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Origem</th>
                <th>UF</th>
                <th>Empresa</th>
                <th>Número Cigam</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {plans.data.items.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.number}</td>
                  <td>{ORIGIN_LABELS[plan.origin]}</td>
                  <td>{plan.state ?? ''}</td>
                  <td>{plan.company.label}</td>
                  <td>{plan.cigamNumber}</td>
                  <td>
                    <span className={`badge ${plan.active ? 'badge-paid' : 'badge-archived'}`}>
                      {plan.active ? 'Ativo' : 'Inativo'}
                    </span>
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
              {plans.data.totalItems} {plans.data.totalItems === 1 ? 'parcelamento' : 'parcelamentos'}
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
  const [active, setActive] = useState(plan?.active ?? true)
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
        active,
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
        <Field label="Número" error={errors.number}>
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
            <SearchableSelect
              label="Origem"
              options={Object.entries(ORIGIN_LABELS).map(([value, label]) => ({ value, label }))}
              value={origin}
              onChange={(value) => {
                setOrigin(value as InstallmentOrigin | '')
                // Only SEFAZ plans have a UF.
                if (value !== 'SEFAZ') setState('')
              }}
              required
            />
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
        <Field label="Número Cigam" error={errors.cigamNumber}>
          <input
            inputMode="numeric"
            maxLength={20}
            value={cigamNumber}
            onChange={(e) => setCigamNumber(onlyDigits(e.target.value))}
            required
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativo
        </label>
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
