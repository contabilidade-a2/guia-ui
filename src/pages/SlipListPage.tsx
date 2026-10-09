import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { companiesApi, slipTypesApi, slipsApi } from '../api/endpoints'
import type { SlipFilters } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { DeleteIcon, EditIcon, IconButton, IconLink, PlusIcon, ViewIcon } from '../components/icons'
import { DateRangeChips } from '../components/DateRangeChips'
import { MultiSelect } from '../components/MultiSelect'
import { ErrorBanner, Field, Loading, Segmented, SendStatusBadge, SlipStatusBadge } from '../components/ui'
import { errorMessage } from '../api/client'
import type { Page, SlipSummary } from '../api/types'
import { DELETE_SLIP_CONFIRMATION, SLIP_STATUS_LABELS, formatDate, formatInstantDate } from '../lib/format'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 20

const EMPTY_FILTERS: SlipFilters = {
  companyIds: null,
  slipTypeIds: null,
  origins: null,
  statuses: null,
  competenceFrom: '',
  competenceTo: '',
  dueFrom: '',
  dueTo: '',
  sentFrom: '',
  sentTo: '',
  companyCnpj: '',
}

export function SlipListPage() {
  const { canEditSlips } = useAuth()
  const [filters, setFilters] = useState<SlipFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Typed freely; only applied to the filter after a short pause, so each keystroke doesn't fire a request.
  const [cnpjInput, setCnpjInput] = useState('')

  const options = useLoad(() => Promise.all([companiesApi.list(), slipTypesApi.list()]), [])
  // A multi-value filter with every option unchecked matches nothing: no need to ask the server.
  const nothingSelected = [filters.companyIds, filters.slipTypeIds, filters.origins, filters.statuses].some((v) => v?.length === 0)
  const slips = useLoad(
    () =>
      nothingSelected
        ? Promise.resolve<Page<SlipSummary>>({ items: [], page: 0, size: PAGE_SIZE, totalItems: 0, totalPages: 0 })
        : slipsApi.search(filters, page, PAGE_SIZE),
    [filters, page],
  )
  const [companies, slipTypes] = options.data ?? [[], []]

  function setFilter<K extends keyof SlipFilters>(name: K, value: SlipFilters[K]) {
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(0)
  }

  function patchFilters(patch: Partial<SlipFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(0)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setCnpjInput('')
    setPage(0)
  }

  useEffect(() => {
    const timeout = setTimeout(() => setFilter('companyCnpj', cnpjInput), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpjInput])

  async function remove(slip: SlipSummary) {
    if (!window.confirm(`${slip.subject}\n\n${DELETE_SLIP_CONFIRMATION}`)) return
    setDeleteError(null)
    try {
      await slipsApi.remove(slip.id)
      // Removing the last row of a page would leave it empty: step back one page.
      if (slips.data?.items.length === 1 && page > 0) setPage(page - 1)
      else slips.reload()
    } catch (caught) {
      setDeleteError(errorMessage(caught))
    }
  }

  const hasFilters = Object.values(filters).some((value) => (Array.isArray(value) ? true : Boolean(value)))
  const result = slips.data
  const firstShown = result && result.items.length > 0 ? page * PAGE_SIZE + 1 : 0
  const lastShown = result ? page * PAGE_SIZE + result.items.length : 0

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Guias</h1>
          <div className="page-subtitle">
            {result ? `${result.totalItems} ${result.totalItems === 1 ? 'guia encontrada' : 'guias encontradas'}` : '\u00a0'}
          </div>
        </div>
        {canEditSlips && (
          <Link to="/slips/new" className="button button-primary">
            <PlusIcon />
            Nova guia
          </Link>
        )}
      </div>

      {/* One line of filters (status as buttons), then a line with the date chips. */}
      <div className="card filters filters-slips">
        <Field label="Empresa" group className="filter-wide">
          <MultiSelect
            label="Empresa"
            options={companies.map((company) => ({ value: String(company.id), label: company.label }))}
            selected={filters.companyIds}
            onChange={(values) => setFilter('companyIds', values)}
            allText="Todas"
            noneText="Nenhuma"
            countText={(count) => `${count} empresas`}
          />
        </Field>
        <Field label="CNPJ">
          <input
            type="text"
            value={cnpjInput}
            onChange={(e) => setCnpjInput(e.target.value)}
            placeholder="Completo ou parcial"
          />
        </Field>
        <Field label="Tipo" group>
          <MultiSelect
            label="Tipo de guia"
            options={slipTypes.map((slipType) => ({ value: String(slipType.id), label: slipType.name }))}
            selected={filters.slipTypeIds}
            onChange={(values) => setFilter('slipTypeIds', values)}
            allText="Todos"
            noneText="Nenhum"
            countText={(count) => `${count} tipos`}
          />
        </Field>
        <Field label="Status" group>
          <Segmented
            label="Status da guia"
            options={[
              { value: '', label: 'Todos' },
              ...Object.entries(SLIP_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]}
            value={filters.statuses?.[0] ?? ''}
            onChange={(value) => setFilter('statuses', value === '' ? null : [value])}
          />
        </Field>
        <div className="filter-row">
          <DateRangeChips filters={filters} onChange={patchFilters} />
          {hasFilters && (
            <button type="button" className="link-button filter-row-end" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <ErrorBanner message={options.error ?? slips.error} onRetry={slips.reload} />
      <ErrorBanner message={deleteError} />
      {slips.loading && !result && <Loading />}

      {result && (
        <div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Assunto</th>
                  <th>Tipo de guia</th>
                  <th>Envio</th>
                  <th>Enviada em</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {result.items.map((slip) => (
                  <tr key={slip.id}>
                    <td>
                      <Link to={`/slips/${slip.id}`} className="plain-link cell-title">
                        {slip.subject}
                      </Link>
                      <div className="cell-sub">{slip.company.name}</div>
                    </td>
                    <td>{slip.slipType.name}</td>
                    <td>
                      <SendStatusBadge status={slip.sendStatus} />
                    </td>
                    <td className="muted">{formatInstantDate(slip.sentAt)}</td>
                    <td>{formatDate(slip.dueDate)}</td>
                    <td>
                      <SlipStatusBadge status={slip.status} />
                    </td>
                    <td className="row-actions">
                      <IconLink to={`/slips/${slip.id}`} label={`Ver detalhes de ${slip.subject}`}>
                        <ViewIcon />
                      </IconLink>
                      {canEditSlips && (
                        <>
                          <IconLink to={`/slips/${slip.id}/edit`} label={`Editar ${slip.subject}`}>
                            <EditIcon />
                          </IconLink>
                          <IconButton label={`Excluir ${slip.subject}`} onClick={() => remove(slip)} danger>
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted empty-row">
                      {nothingSelected
                        ? 'Marque ao menos uma opção em cada filtro de seleção.'
                        : hasFilters
                          ? 'Nenhuma guia encontrada com estes filtros.'
                          : 'Nenhuma guia cadastrada ainda.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="muted">
              {result.totalItems === 0 ? 'Nenhuma guia' : `Mostrando ${firstShown}–${lastShown} de ${result.totalItems}`}
            </span>
            <button type="button" className="button button-small" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>
              Página {result.totalPages === 0 ? 0 : page + 1} de {result.totalPages}
            </span>
            <button
              type="button"
              className="button button-small"
              disabled={page + 1 >= result.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </>
  )
}
