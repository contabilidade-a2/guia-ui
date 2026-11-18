import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { companiesApi, slipTypesApi, slipsApi } from '../api/endpoints'
import type { InstallmentOrigin, SlipFilters, SlipSortField, SortState } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { DeleteIcon, EditIcon, IconButton, IconLink, PlusIcon, ViewIcon } from '../components/icons'
import { CurrencyInput } from '../components/CurrencyInput'
import { DateRangeChips } from '../components/DateRangeChips'
import { MultiSelect } from '../components/MultiSelect'
import { ErrorBanner, Field, Loading, Segmented, SendStatusBadge, SlipStatusBadge, SortableHeader } from '../components/ui'
import { errorMessage } from '../api/client'
import type { Page, SlipSummary } from '../api/types'
import { DELETE_SLIP_CONFIRMATION, ORIGIN_LABELS, SLIP_STATUS_LABELS, formatDate, formatInstantDate, formatMoney } from '../lib/format'
import { onlyDigits } from '../lib/text'
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
  planNumber: '',
  subject: '',
  amountFrom: '',
  amountTo: '',
}

/** `1500.00` → `R$ 1.500,00` */
function money(value: string): string {
  return formatMoney(Number(value))
}

function amountSummary(from: string, to: string): string {
  if (from && to) return from === to ? money(from) : `${money(from)} – ${money(to)}`
  if (from) return `a partir de ${money(from)}`
  return `até ${money(to)}`
}

export function SlipListPage() {
  const { canEditSlips } = useAuth()
  const [filters, setFilters] = useState<SlipFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<SortState<SlipSortField> | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Typed freely; only applied to the filter after a short pause, so each keystroke doesn't fire a request.
  const [cnpjInput, setCnpjInput] = useState('')
  const [planNumberInput, setPlanNumberInput] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [amountFromInput, setAmountFromInput] = useState('')
  const [amountToInput, setAmountToInput] = useState('')
  // "Até" copies "de" until the user edits it: one value is an exact search, two make a range.
  const [amountToEdited, setAmountToEdited] = useState(false)
  // Type, CNPJ, amount, plan and dates stay folded away; company, subject and status are always shown.
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const options = useLoad(() => Promise.all([companiesApi.list(), slipTypesApi.list()]), [])
  // A multi-value filter with every option unchecked matches nothing: no need to ask the server.
  const nothingSelected = [filters.companyIds, filters.slipTypeIds, filters.origins, filters.statuses].some((v) => v?.length === 0)
  const slips = useLoad(
    () =>
      nothingSelected
        ? Promise.resolve<Page<SlipSummary>>({ items: [], page: 0, size: PAGE_SIZE, totalItems: 0, totalPages: 0 })
        : slipsApi.search(filters, page, PAGE_SIZE, sort),
    [filters, page, sort],
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

  /** A new order starts from the first page, which now holds other slips. */
  function changeSort(next: SortState<SlipSortField> | null) {
    setSort(next)
    setPage(0)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setCnpjInput('')
    setPlanNumberInput('')
    setSubjectInput('')
    setAmountFromInput('')
    setAmountToInput('')
    setAmountToEdited(false)
    setPage(0)
  }

  useEffect(() => {
    const timeout = setTimeout(() => setFilter('companyCnpj', cnpjInput), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpjInput])

  useEffect(() => {
    const timeout = setTimeout(() => setFilter('planNumber', planNumberInput), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planNumberInput])

  useEffect(() => {
    const timeout = setTimeout(() => setFilter('subject', subjectInput), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectInput])

  useEffect(() => {
    const timeout = setTimeout(() => patchFilters({ amountFrom: amountFromInput, amountTo: amountToInput }), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountFromInput, amountToInput])

  function changeAmountFrom(value: string) {
    setAmountFromInput(value)
    if (!amountToEdited) setAmountToInput(value)
  }

  function changeAmountTo(value: string) {
    setAmountToInput(value)
    // Emptied: copy "de" again from now on.
    setAmountToEdited(value !== '')
  }

  function clearAmount() {
    setAmountFromInput('')
    setAmountToInput('')
    setAmountToEdited(false)
  }

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

  const selectedTypes = slipTypes.filter((slipType) => filters.slipTypeIds?.includes(String(slipType.id)))
  const activeAdvanced: { label: string; clear: () => void }[] = [
    ...(filters.slipTypeIds !== null
      ? [{
          label: `Tipo: ${selectedTypes.length === 1 ? selectedTypes[0].name : `${filters.slipTypeIds.length} tipos`}`,
          clear: () => setFilter('slipTypeIds', null),
        }]
      : []),
    ...(filters.companyCnpj ? [{ label: `CNPJ: ${filters.companyCnpj}`, clear: () => setCnpjInput('') }] : []),
    ...(filters.amountFrom || filters.amountTo
      ? [{ label: `Valor: ${amountSummary(filters.amountFrom ?? '', filters.amountTo ?? '')}`, clear: clearAmount }]
      : []),
    ...(filters.planNumber ? [{ label: `Parcelamento: ${filters.planNumber}`, clear: () => setPlanNumberInput('') }] : []),
    ...(filters.origins ? [{ label: `Origem: ${filters.origins.join(', ')}`, clear: () => setFilter('origins', null) }] : []),
  ]

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

      {/* Company, subject and status always in sight; the other filters open under "Filtros avançados". */}
      <div className="card filters filters-slips">
        <Field label="Empresa" group>
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
        <Field label="Assunto">
          <input type="search" value={subjectInput} onChange={(e) => setSubjectInput(e.target.value)} placeholder="Parte do assunto, ex.: IRPJ" />
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
        <button
          type="button"
          className={`button filters-toggle${advancedOpen ? ' filters-toggle-open' : ''}${!advancedOpen && activeAdvanced.length > 0 ? ' filters-toggle-active' : ''}`}
          aria-expanded={advancedOpen}
          aria-controls="advanced-filters"
          onClick={() => setAdvancedOpen(!advancedOpen)}
        >
          Filtros avançados
          <span className="filters-toggle-sign" aria-hidden="true">
            {advancedOpen ? '−' : '+'}
          </span>
        </button>

        {/* The dates stay in sight (asked on 18/11/2026); the other secondary filters open under the button. */}
        <div className="filter-row">
          <DateRangeChips filters={filters} onChange={patchFilters} />
          {!advancedOpen && activeAdvanced.length > 0 && (
            <>
              <span className="filter-row-divider" aria-hidden="true" />
              <span className="muted small">Filtros avançados:</span>
              {activeAdvanced.map((item) => (
                <span key={item.label} className="filter-chip filter-chip-on">
                  <button type="button" className="filter-chip-main" onClick={() => setAdvancedOpen(true)}>
                    {item.label}
                  </button>
                  <button type="button" className="filter-chip-remove" aria-label={`Remover filtro ${item.label}`} onClick={item.clear}>
                    ×
                  </button>
                </span>
              ))}
            </>
          )}
          {hasFilters && (
            <button type="button" className="link-button filter-row-end" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>

        {advancedOpen && (
          <div className="filters-advanced" id="advanced-filters">
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
            <Field label="CNPJ">
              <input type="text" value={cnpjInput} onChange={(e) => setCnpjInput(e.target.value)} placeholder="Completo ou parcial" />
            </Field>
            <Field label="Valor (R$)" group>
              <div className="range-input">
                <CurrencyInput value={amountFromInput} onChange={changeAmountFrom} aria-label="Valor: de" />
                <span className="range-input-separator" aria-hidden="true">
                  até
                </span>
                <CurrencyInput value={amountToInput} onChange={changeAmountTo} aria-label="Valor: até" />
              </div>
            </Field>
            <Field label="Nº do parcelamento">
              <input
                inputMode="numeric"
                maxLength={30}
                value={planNumberInput}
                onChange={(e) => setPlanNumberInput(onlyDigits(e.target.value))}
                placeholder="Completo ou parcial"
              />
            </Field>
            <Field label="Origem" group>
              <Segmented
                label="Origem do parcelamento"
                options={[
                  { value: '', label: 'Todas' },
                  ...(Object.keys(ORIGIN_LABELS) as InstallmentOrigin[]).map((value) => ({ value, label: ORIGIN_LABELS[value] })),
                ]}
                value={filters.origins?.[0] ?? ''}
                onChange={(value) => setFilter('origins', value === '' ? null : [value])}
              />
            </Field>
          </div>
        )}
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
                  <SortableHeader label="Tipo de guia" field="SLIP_TYPE" sort={sort} onSort={changeSort} />
                  <th>Envio</th>
                  <SortableHeader label="Enviada em" field="SENT_AT" sort={sort} onSort={changeSort} />
                  <SortableHeader label="Vencimento" field="DUE_DATE" sort={sort} onSort={changeSort} />
                  <SortableHeader label="Valor" field="AMOUNT" sort={sort} onSort={changeSort} className="numeric" />
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
                    <td className="numeric">{formatMoney(slip.amount)}</td>
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
                          <IconButton
                            label={slip.status === 'PAID' ? 'Guia com comprovante não pode ser excluída' : `Excluir ${slip.subject}`}
                            onClick={() => remove(slip)}
                            disabled={slip.status === 'PAID'}
                            danger
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted empty-row">
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
