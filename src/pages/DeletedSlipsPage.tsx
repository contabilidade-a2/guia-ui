import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { companiesApi, deletedSlipsApi, slipTypesApi } from '../api/endpoints'
import type { DeletedSlip, DeletedSlipFilters, Page } from '../api/types'
import { IconButton, RestoreIcon, ViewIcon } from '../components/icons'
import { DateRangeChips } from '../components/DateRangeChips'
import { MultiSelect } from '../components/MultiSelect'
import { ErrorBanner, Field, Loading, Modal, SendStatusBadge, SlipStatusBadge } from '../components/ui'
import { HISTORY_EVENT_LABELS, SLIP_STATUS_LABELS, formatDate, formatDateTime, formatMonth, formatMoney } from '../lib/format'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 20

const EMPTY_FILTERS: DeletedSlipFilters = {
  companyIds: null,
  slipTypeIds: null,
  origins: null,
  statuses: null,
  deletedByUserIds: null,
  competenceFrom: '',
  competenceTo: '',
  dueFrom: '',
  dueTo: '',
  sentFrom: '',
  sentTo: '',
  companyCnpj: '',
}

const RESTORE_CONFIRMATION =
  'Restaurar esta guia? Ela volta para a lista de guias e para o calendário com os mesmos dados, comprovante e ' +
  'histórico. O status é recalculado pela data de vencimento.'

/** Administrator only: what was deleted, when and by whom, kept by the server for 6 months and restorable. */
export function DeletedSlipsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<DeletedSlipFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<DeletedSlip | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const options = useLoad(
    () => Promise.all([companiesApi.list(), slipTypesApi.list(), deletedSlipsApi.deleters()]),
    [],
  )
  // A multi-value filter with every option unchecked matches nothing: no need to ask the server.
  const nothingSelected = [filters.companyIds, filters.slipTypeIds, filters.statuses, filters.deletedByUserIds].some(
    (v) => v?.length === 0,
  )
  const slips = useLoad(
    () =>
      nothingSelected
        ? Promise.resolve<Page<DeletedSlip>>({ items: [], page: 0, size: PAGE_SIZE, totalItems: 0, totalPages: 0 })
        : deletedSlipsApi.search(filters, page, PAGE_SIZE),
    [filters, page],
  )
  const [companies, slipTypes, deleters] = options.data ?? [[], [], []]

  function setFilter<K extends keyof DeletedSlipFilters>(name: K, value: DeletedSlipFilters[K]) {
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(0)
  }

  async function restore(slip: DeletedSlip) {
    if (!window.confirm(`${slip.subject}\n\n${RESTORE_CONFIRMATION}`)) return
    setViewing(null)
    setRestoreError(null)
    try {
      const restored = await deletedSlipsApi.restore(slip.id)
      navigate(`/slips/${restored.id}`)
    } catch (caught) {
      setRestoreError(errorMessage(caught))
    }
  }

  const hasFilters = Object.values(filters).some((value) => (Array.isArray(value) ? true : Boolean(value)))
  const result = slips.data

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Guias excluídas</h1>
          <p className="muted">
            Cada guia excluída fica aqui por 6 meses, com os dados e o histórico, e pode ser restaurada nesse prazo.
          </p>
        </div>
      </div>

      {/* The choice filters (company takes the spare width), then a line with the date chips. */}
      <div className="card filters">
        <Field label="Empresa" group className="filter-medium">
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
        <Field label="Tipo de guia" group>
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
        <Field label="Status da guia" group>
          <MultiSelect
            label="Status da guia"
            options={Object.entries(SLIP_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            selected={filters.statuses}
            onChange={(values) => setFilter('statuses', values)}
            allText="Todos"
            noneText="Nenhum"
            countText={(count) => `${count} status`}
          />
        </Field>
        <Field label="Excluída por" group>
          <MultiSelect
            label="Excluída por"
            options={deleters.map((deleter) => ({ value: String(deleter.id), label: deleter.name }))}
            selected={filters.deletedByUserIds}
            onChange={(values) => setFilter('deletedByUserIds', values)}
            allText="Todos"
            noneText="Nenhum"
            countText={(count) => `${count} usuários`}
          />
        </Field>
        <div className="filter-row">
          <span className="muted small">Datas:</span>
          <DateRangeChips
            filters={filters}
            onChange={(patch) => {
              setFilters((current) => ({ ...current, ...patch }))
              setPage(0)
            }}
          />
          {hasFilters && (
            <button
              type="button"
              className="link-button filter-row-end"
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                setPage(0)
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <ErrorBanner message={options.error ?? slips.error} onRetry={slips.reload} />
      <ErrorBanner message={restoreError} />
      {slips.loading && !result && <Loading />}

      {result && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Assunto</th>
                  <th>Tipo de guia</th>
                  <th>Data de envio</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Excluída em</th>
                  <th>Excluída por</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {result.items.map((slip) => (
                  <tr key={slip.id}>
                    <td>
                      {slip.subject}
                      <div className="muted small">{slip.company.name}</div>
                    </td>
                    <td>{slip.slipType.name}</td>
                    <td>{formatDateTime(slip.sentAt)}</td>
                    <td>{formatDate(slip.dueDate)}</td>
                    <td>
                      <SlipStatusBadge status={slip.status} />
                    </td>
                    <td>{formatDateTime(slip.deletedAt)}</td>
                    <td>{slip.deletedBy.name}</td>
                    <td className="row-actions">
                      <IconButton label={`Ver os dados de ${slip.subject}`} onClick={() => setViewing(slip)}>
                        <ViewIcon />
                      </IconButton>
                      <IconButton label={`Restaurar ${slip.subject}`} onClick={() => restore(slip)}>
                        <RestoreIcon />
                      </IconButton>
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted empty-row">
                      {nothingSelected
                        ? 'Marque ao menos uma opção em cada filtro de seleção.'
                        : hasFilters
                          ? 'Nenhuma guia excluída encontrada com estes filtros.'
                          : 'Nenhuma guia foi excluída nos últimos 6 meses.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="muted">
              {result.totalItems} {result.totalItems === 1 ? 'guia excluída' : 'guias excluídas'}
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

      {viewing && (
        <DeletedSlipModal slip={viewing} onRestore={() => restore(viewing)} onClose={() => setViewing(null)} />
      )}
    </>
  )
}

interface DeletedSlipModalProps {
  slip: DeletedSlip
  onRestore: () => void
  onClose: () => void
}

function DeletedSlipModal({ slip, onRestore, onClose }: DeletedSlipModalProps) {
  const history = useLoad(() => deletedSlipsApi.history(slip.id), [slip.id])

  return (
    <Modal title={slip.subject} onClose={onClose}>
      <div className="badges">
        <SlipStatusBadge status={slip.status} />
        <SendStatusBadge status={slip.sendStatus} />
      </div>
      <dl className="details deleted-slip-details">
        <dt>Excluída em</dt>
        <dd>
          {formatDateTime(slip.deletedAt)} por {slip.deletedBy.name}
        </dd>
        <dt>Empresa</dt>
        <dd>{slip.company.label}</dd>
        <dt>Tipo de guia</dt>
        <dd>{slip.slipType.name}</dd>
        <dt>Valor</dt>
        <dd>{formatMoney(slip.amount)}</dd>
        <dt>Competência</dt>
        <dd>{formatMonth(slip.competenceDate)}</dd>
        <dt>Vencimento</dt>
        <dd>{formatDate(slip.dueDate)}</dd>
        <dt>Número Cigam</dt>
        <dd>{slip.cigamNumber ?? '—'}</dd>
        <dt>Enviada em</dt>
        <dd>
          {formatDateTime(slip.sentAt)} por {slip.sentBy}
        </dd>
        <dt>PDF da guia</dt>
        <dd>
          <a href={slip.fileUrl} target="_blank" rel="noreferrer">
            Abrir PDF
          </a>
        </dd>
        <dt>Pagamento</dt>
        <dd>
          {slip.receiptUrl && slip.paymentDate ? (
            <>
              Pago em {formatDate(slip.paymentDate)} ·{' '}
              <a href={slip.receiptUrl} target="_blank" rel="noreferrer">
                Abrir comprovante
              </a>
            </>
          ) : (
            'Nenhum pagamento registrado.'
          )}
        </dd>
        <dt>Observação</dt>
        <dd className="preserve-lines">{slip.note ?? '—'}</dd>
      </dl>

      <h3 className="deleted-slip-history-title">Histórico</h3>
      <ErrorBanner message={history.error} onRetry={history.reload} />
      {history.loading && !history.data && <Loading />}
      <ol className="history">
        {history.data?.map((entry, index) => (
          <li key={index}>
            <strong>{HISTORY_EVENT_LABELS[entry.eventType]}</strong>
            <span className="muted">
              {entry.userName} · {formatDateTime(entry.occurredAt)}
            </span>
          </li>
        ))}
      </ol>

      <div className="form-actions deleted-slip-actions">
        <button type="button" className="button" onClick={onClose}>
          Fechar
        </button>
        <button type="button" className="button button-primary" onClick={onRestore}>
          Restaurar guia
        </button>
      </div>
    </Modal>
  )
}
